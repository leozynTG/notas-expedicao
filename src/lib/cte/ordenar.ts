/** Pure rules for sorting CTe (DACTE) pages by NF-e number. */

export function dvChaveValido(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === Number(chave[43]);
}

export function chaveValida(chave: string): boolean {
  return chave.substring(20, 22) === "55" && dvChaveValido(chave);
}

export const numeroNota = (chave: string) => parseInt(chave.substring(25, 34), 10);
export const serieNota = (chave: string) => chave.substring(22, 25);

/** Valid, unique NF-e keys found in one page's text. */
export function chavesDaPagina(texto: string): string[] {
  const candidatas: string[] = [];
  for (const m of texto.matchAll(/NF-?E:\s*([\d ]{44,70})/gi)) {
    const d = (m[1] ?? "").replace(/\D/g, "");
    if (d.length >= 44) candidatas.push(d.slice(0, 44));
  }
  let validas = [...new Set(candidatas)].filter(chaveValida);
  if (candidatas.length === 0) {
    const gerais = [...texto.matchAll(/(?:\d[ .]?){44}/g)].map((m) => m[0].replace(/\D/g, ""));
    validas = [...new Set(gerais)].filter((c) => c.length === 44 && chaveValida(c));
  }
  return validas;
}

export type Situacao = "OK" | "Várias notas" | "Não identificada" | "Duplicada";

export type TipoPagina = "cte" | "nfe" | "boleto" | "outro";

export interface PaginaCte {
  tipo: TipoPagina;
  /** Boleto: parcela n de total (ex.: 2/3). */
  parcela: { n: number; total: number } | null;
  arquivo: number;
  nomeArquivo: string;
  pagina: number; // 1-based
  chaves: string[];
  notas: number[];
  series: string[];
  manual: number | null;
}

export function montarPagina(arquivo: number, nomeArquivo: string, pagina: number, texto: string): PaginaCte {
  const chaves = chavesDaPagina(texto);
  const notas = [...new Set(chaves.map(numeroNota))].sort((a, b) => a - b);
  const series = [...new Set(chaves.map(serieNota))];
  return { tipo: "cte", parcela: null, arquivo, nomeArquivo, pagina, chaves, notas, series, manual: null };
}

/** Página de NF-e (DANFE) ou boleto: descobre o tipo e o número da nota pelo texto. */
export function montarPaginaApoio(arquivo: number, nomeArquivo: string, pagina: number, texto: string): PaginaCte {
  const base: PaginaCte = { tipo: "outro", parcela: null, arquivo, nomeArquivo, pagina, chaves: [], notas: [], series: [], manual: null };
  const ehDanfe = /DANFE/i.test(texto) && /CHAVE\s+DE\s+ACESSO/i.test(texto);
  if (ehDanfe) {
    const gerais = [...texto.matchAll(/(?:\d[ .]?){44}/g)].map((m) => m[0].replace(/\D/g, ""));
    const chave = [...new Set(gerais)].find((c) => c.length === 44 && chaveValida(c));
    if (chave) return { ...base, tipo: "nfe", notas: [numeroNota(chave)], series: [serieNota(chave)] };
    const m = texto.match(/N[º°o]\.?\s*(\d{3}\.\d{3}\.\d{3})/i);
    if (m) return { ...base, tipo: "nfe", notas: [parseInt(m[1]!.replace(/\./g, ""), 10)] };
    return { ...base, tipo: "nfe" };
  }
  const frac = texto.match(/\d{2}\/\d{2}\/\d{4}\s+(\d{1,9})\s+(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if (frac && /N[uú]mero\s+do\s+Documento/i.test(texto)) {
    return {
      ...base,
      tipo: "boleto",
      notas: [parseInt(frac[1]!, 10)],
      parcela: { n: parseInt(frac[2]!, 10), total: parseInt(frac[3]!, 10) },
    };
  }
  if (/N[uú]mero\s+do\s+Documento/i.test(texto) && /Vencimento/i.test(texto)) {
    const unico = texto.match(/\d{2}\/\d{2}\/\d{4}\s+(\d{3,9})\s+[A-Za-z]{2}\b/);
    return { ...base, tipo: "boleto", notas: unico ? [parseInt(unico[1]!, 10)] : [], parcela: unico ? { n: 1, total: 1 } : null };
  }
  return base;
}

const RANK: Record<TipoPagina, number> = { cte: 0, nfe: 1, outro: 1, boleto: 2 };

export const notaOrdem = (p: PaginaCte): number | null => p.notas[0] ?? p.manual;

export function ordenarPaginas(paginas: PaginaCte[]): PaginaCte[] {
  return [...paginas].sort((a, b) => {
    const na = notaOrdem(a);
    const nb = notaOrdem(b);
    if (na === null && nb !== null) return 1;
    if (nb === null && na !== null) return -1;
    if (na !== null && nb !== null && na !== nb) return na - nb;
    return (
      RANK[a.tipo] - RANK[b.tipo] ||
      (a.parcela?.n ?? 0) - (b.parcela?.n ?? 0) ||
      a.arquivo - b.arquivo ||
      a.pagina - b.pagina
    );
  });
}

/** Keys that appear on more than one page. */
export function chavesDuplicadas(paginas: PaginaCte[]): Set<string> {
  const vistas = new Map<string, number>();
  for (const p of paginas) for (const c of p.chaves) vistas.set(c, (vistas.get(c) ?? 0) + 1);
  return new Set([...vistas].filter(([, n]) => n > 1).map(([c]) => c));
}

export function situacao(p: PaginaCte, duplicadas: Set<string>): Situacao {
  if (p.chaves.length === 0 && notaOrdem(p) === null) return "Não identificada";
  if (p.chaves.some((c) => duplicadas.has(c))) return "Duplicada";
  return p.notas.length > 1 ? "Várias notas" : "OK";
}

/** Avisos de conferência quando há NF-e/boletos junto com os CTe. */
export function conferirConjunto(paginas: PaginaCte[]): string[] {
  const temApoio = paginas.some((p) => p.tipo !== "cte");
  if (!temApoio) return [];
  const avisos: string[] = [];
  const notas = [...new Set(paginas.map(notaOrdem).filter((n): n is number => n !== null))].sort((a, b) => a - b);
  for (const n of notas) {
    const doNota = paginas.filter((p) => notaOrdem(p) === n);
    const tem = (t: TipoPagina) => doNota.some((p) => p.tipo === t);
    if (!tem("cte")) avisos.push(`Nota ${n}: não tem CTe.`);
    if (!tem("nfe")) avisos.push(`Nota ${n}: não tem a NF-e.`);
    const bol = doNota.filter((p) => p.tipo === "boleto");
    const total = Math.max(0, ...bol.map((p) => p.parcela?.total ?? 0));
    const achadas = new Set(bol.map((p) => p.parcela?.n ?? 0));
    if (bol.length === 0) avisos.push(`Nota ${n}: nenhum boleto encontrado.`);
    else if (achadas.size < total) {
      const faltam = Array.from({ length: total }, (_, i) => i + 1).filter((i) => !achadas.has(i));
      avisos.push(`Nota ${n}: faltam os boletos ${faltam.map((i) => `${i}/${total}`).join(", ")}.`);
    }
    if (bol.length > achadas.size) avisos.push(`Nota ${n}: há boleto repetido.`);
  }
  return avisos;
}
