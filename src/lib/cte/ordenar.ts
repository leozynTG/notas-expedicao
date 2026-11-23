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

export interface PaginaCte {
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
  return { arquivo, nomeArquivo, pagina, chaves, notas, series, manual: null };
}

export const notaOrdem = (p: PaginaCte): number | null => p.notas[0] ?? p.manual;

export function ordenarPaginas(paginas: PaginaCte[]): PaginaCte[] {
  return [...paginas].sort((a, b) => {
    const na = notaOrdem(a);
    const nb = notaOrdem(b);
    if (na === null && nb !== null) return 1;
    if (nb === null && na !== null) return -1;
    if (na !== null && nb !== null && na !== nb) return na - nb;
    return a.arquivo - b.arquivo || a.pagina - b.pagina;
  });
}

/** Keys that appear on more than one page. */
export function chavesDuplicadas(paginas: PaginaCte[]): Set<string> {
  const vistas = new Map<string, number>();
  for (const p of paginas) for (const c of p.chaves) vistas.set(c, (vistas.get(c) ?? 0) + 1);
  return new Set([...vistas].filter(([, n]) => n > 1).map(([c]) => c));
}

export function situacao(p: PaginaCte, duplicadas: Set<string>): Situacao {
  if (p.chaves.length === 0) return "Não identificada";
  if (p.chaves.some((c) => duplicadas.has(c))) return "Duplicada";
  return p.notas.length > 1 ? "Várias notas" : "OK";
}
