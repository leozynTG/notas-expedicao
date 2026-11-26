import { soDigitos, type NotaFiscal } from "./nfe";
import type { Aviso } from "./tipos";

export interface Picking {
  numero: string;
  pedido: string;
  /** Text after "|" on the PEDIDO line (the picking type, e.g. "TROCA ARMAZENAMENTO"). */
  descricao: string;
  cnpj: string;
}

/** One text piece of a PDF page, in viewport coordinates (x from the left, topo from the top). */
export interface TrechoPdf {
  str: string;
  x: number;
  topo: number;
  largura: number;
}

export interface PaginaPdf {
  largura: number;
  altura: number;
  trechos: TrechoPdf[];
}

export interface LeituraPickings {
  origem: "pdf" | "txt" | "ocr";
  /** Avisos gerados na leitura (ex.: número de picking suspeito no OCR). */
  avisos?: Aviso[];
  /** Unique (número + pedido) pairs, in reading order. */
  pickings: Picking[];
  /** True when the file has no readable text at all (e.g. a scanned PDF). */
  semTexto: boolean;
}

const RE_PEDIDO = /PEDIDO N\S+:\s*\d+-(\w+)\s*\|\s*(.+)/gi;
/** Client document: "CNPJ....:" (or "CPF....:") with two or more dots. The issuer header uses a single "CNPJ:". */
const RE_DOC_CLIENTE = /(?:CNPJ|CPF)\s*\.{2,}\s*:\s*([\d./-]+)/gi;
/** Issuer (Ninfa) CNPJ, never a client. */
export const CNPJ_EMISSOR = "78099777000142";
/** Picking number region: top 25% of the page, right half. */
const TOPO_MAX = 0.25;
const ESQUERDA_MIN = 0.5;
const TOLERANCIA_LINHA = 3;

/** Rebuilds the page text line by line from coordinates, ignoring the order pdf.js returns pieces in. */
export function textoDaPagina(pagina: PaginaPdf): string {
  const trechos = pagina.trechos.filter((t) => t.str.trim() !== "").sort((a, b) => a.topo - b.topo);
  const linhas: TrechoPdf[][] = [];
  for (const t of trechos) {
    const ultima = linhas[linhas.length - 1];
    if (ultima && Math.abs(t.topo - ultima[0]!.topo) <= TOLERANCIA_LINHA) ultima.push(t);
    else linhas.push([t]);
  }
  return linhas
    .map((linha) => {
      let texto = "";
      let fim = -Infinity;
      for (const t of linha.sort((a, b) => a.x - b.x)) {
        if (texto && t.x - fim > 1) texto += " ";
        texto += t.str;
        fim = t.x + t.largura;
      }
      return texto.replace(/\s+/g, " ").trim();
    })
    .join("\n");
}

/** Picking number: a 1–4 digit piece in the top-right corner; the highest one wins, then the rightmost. */
export function numeroNoTopo(pagina: PaginaPdf): string {
  const candidatos = pagina.trechos.filter(
    (t) =>
      /^\d{1,4}$/.test(t.str.trim()) &&
      t.topo <= pagina.altura * TOPO_MAX &&
      t.x >= pagina.largura * ESQUERDA_MIN,
  );
  candidatos.sort((a, b) =>
    Math.abs(a.topo - b.topo) > TOLERANCIA_LINHA ? a.topo - b.topo : b.x - a.x,
  );
  return candidatos[0]?.str.trim() ?? "";
}

function adicionar(lista: Picking[], vistos: Map<string, Picking>, p: Picking) {
  const chave = `${p.numero}|${p.pedido}`;
  const existente = vistos.get(chave);
  if (existente) {
    if (!existente.cnpj && p.cnpj) existente.cnpj = p.cnpj;
    return;
  }
  vistos.set(chave, p);
  lista.push(p);
}

/**
 * Client CNPJ/CPF (digits only) of one picking block. Only "CNPJ....:" / "CPF....:" count;
 * the issuer CNPJ is always skipped, and the one on the "Nome Cliente:" line wins.
 */
export function documentoCliente(texto: string): string {
  let primeiro = "";
  for (const linha of texto.split(/\r?\n/)) {
    for (const m of linha.matchAll(RE_DOC_CLIENTE)) {
      const doc = soDigitos(m[1] ?? "");
      if (!doc || doc === CNPJ_EMISSOR) continue;
      if (/Nome\s+Cliente\s*:/i.test(linha)) return doc;
      primeiro ||= doc;
    }
  }
  return primeiro;
}

function pedidosDoTexto(texto: string, numero: string): Picking[] {
  const cnpj = documentoCliente(texto);
  return Array.from(texto.matchAll(RE_PEDIDO), (m) => ({
    numero,
    pedido: (m[1] ?? "").toUpperCase(),
    descricao: (m[2] ?? "").trim(),
    cnpj,
  }));
}

/**
 * Reads the pickings from the PDF pages. A long picking can span several pages:
 * a page without a number keeps the previous page's number, and the same
 * número + pedido is counted only once.
 */
export function lerPickingsPdf(paginas: PaginaPdf[]): LeituraPickings {
  const pickings: Picking[] = [];
  const vistos = new Map<string, Picking>();
  let numeroAnterior = "";
  let temTexto = false;
  for (const pagina of paginas) {
    if (pagina.trechos.some((t) => t.str.trim() !== "")) temTexto = true;
    const numero = numeroNoTopo(pagina) || numeroAnterior;
    numeroAnterior = numero;
    for (const p of pedidosDoTexto(textoDaPagina(pagina), numero)) adicionar(pickings, vistos, p);
  }
  return { origem: "pdf", pickings, semTexto: !temTexto };
}

/** Reads the .txt export of the map: blocks start after each "IMPRESSO DIA" line; the number is the next line. */
export function lerPickingsTexto(texto: string): LeituraPickings {
  return { origem: "txt", pickings: lerPickings(texto), semTexto: texto.trim() === "" };
}

/** Splits the "Mapa analítico" text into blocks that start after each "IMPRESSO DIA" line. */
export function lerPickings(texto: string): Picking[] {
  const blocos: string[][] = [];
  let atual: string[] | null = null;
  for (const linha of texto.split(/\r?\n/)) {
    if (/IMPRESSO\s+DIA/i.test(linha)) {
      atual = [];
      blocos.push(atual);
      continue;
    }
    atual?.push(linha);
  }

  const pickings: Picking[] = [];
  const vistos = new Map<string, Picking>();
  for (const bloco of blocos) {
    const primeira = bloco.map((l) => l.trim()).find((l) => l !== "") ?? "";
    const numero = /^\d+$/.test(primeira) ? primeira : (primeira.match(/^(\d+)\b/)?.[1] ?? "");
    for (const p of pedidosDoTexto(bloco.join("\n"), numero)) adicionar(pickings, vistos, p);
  }
  return pickings;
}

/** Chave tolerante a erros típicos de OCR (O/0, I/1, S/5, B/8, Z/2). */
export function chaveOcr(s: string): string {
  return s.toUpperCase().replace(/[OQD]/g, "0").replace(/[IL]/g, "1").replace(/S/g, "5").replace(/B/g, "8").replace(/Z/g, "2");
}

/** Classes de caracteres que o OCR confunde: 0/O/Q/D, 1/I/L, 2/Z, 5/S/8/B, 9/Y. */
export function classeOcr(s: string): string {
  return s.toUpperCase().replace(/[OQD]/g, "0").replace(/[IL]/g, "1").replace(/Z/g, "2").replace(/[S8B]/g, "5").replace(/Y/g, "9");
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}

function docParecido(a: string, b: string): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  return lev(a, b) <= 3;
}

/**
 * Fills numeroPicking on every note (any Tipo) by pedido and returns the cross-check warnings.
 * tolerante=true (leitura por OCR): casa pedidos com confusões O/0 etc., desempata pelo CNPJ.
 */
export function cruzarPickings(
  notas: NotaFiscal[],
  pickings: Picking[],
  tolerante = false,
): { notas: NotaFiscal[]; avisos: Aviso[] } {
  const avisos: Aviso[] = [];
  const porPedido = new Map<string, Picking[]>();
  for (const p of pickings) {
    const lista = porPedido.get(p.pedido) ?? [];
    lista.push(p);
    porPedido.set(p.pedido, lista);
  }
  const pedidosNf = new Set(notas.map((n) => n.pedido.toUpperCase()).filter(Boolean));

  const atribuicao = new Map<NotaFiscal, Picking[]>();
  if (tolerante) {
    const docOk = (p: Picking, n: NotaFiscal) => !!p.cnpj && !!n.documento && docParecido(p.cnpj, n.documento);
    const reclamados = new Set<Picking>();
    // 1) pedido idêntico + CNPJ compatível
    for (const n of notas) {
      if (!n.pedido) continue;
      const ped = n.pedido.toUpperCase();
      const t = pickings.filter((p) => p.pedido === ped && docOk(p, n));
      if (t.length) { atribuicao.set(n, t); t.forEach((p) => reclamados.add(p)); }
    }
    // 2) restantes: pedido "parecido" (classes de OCR / 1 erro) + CNPJ compatível, só entre pickings ainda não usados
    for (const n of notas) {
      if (!n.pedido || atribuicao.has(n)) continue;
      const k = classeOcr(n.pedido);
      const livres = pickings.filter((p) => !reclamados.has(p) && docOk(p, n));
      let t = livres.filter((p) => classeOcr(p.pedido) === k);
      if (!t.length) {
        const dist = livres.map((p) => [lev(classeOcr(p.pedido), k), p] as const).filter(([d]) => d <= 1);
        const melhor = Math.min(...dist.map(([d]) => d));
        t = dist.filter(([d]) => d === melhor).map(([, p]) => p);
        if (new Set(t.map((p) => p.pedido)).size > 1) t = [];
      }
      if (t.length) { atribuicao.set(n, t); t.forEach((p) => reclamados.add(p)); }
    }
    // 3) sem CNPJ compatível: só pedido equivalente e único (gera aviso de CNPJ divergente)
    for (const n of notas) {
      if (!n.pedido || atribuicao.has(n)) continue;
      const k = classeOcr(n.pedido);
      const t = pickings.filter((p) => !reclamados.has(p) && classeOcr(p.pedido) === k);
      if (t.length === 1) atribuicao.set(n, t);
    }
  }

  const saida = notas.map((n) => {
    const nota = { ...n, numeroPicking: "" };
    let achados = nota.pedido ? (porPedido.get(nota.pedido.toUpperCase()) ?? []) : [];
    if (tolerante && nota.pedido) achados = atribuicao.get(n) ?? [];

    for (const p of achados) {
      const diverge = tolerante ? !docParecido(p.cnpj, nota.documento) : p.cnpj !== nota.documento;
      if (p.cnpj && nota.documento && diverge) {
        avisos.push({
          categoria: "CNPJ divergente",
          nivel: "erro",
          mensagem: `NF ${nota.nfTexto} (pedido ${nota.pedido}): cliente no picking ${p.numero || "?"} = ${formatarDoc(p.cnpj)}; destinatário da NF = ${formatarDoc(nota.documento)}.`,
        });
      }
    }

    const ident = `NF ${nota.nfTexto} — ${nota.destinatario || "destinatário não informado"} — pedido ${nota.pedido || "não informado"}`;
    if (!nota.pedido) {
      avisos.push({
        categoria: "Nota sem picking",
        nivel: "erro",
        mensagem: `${ident}: o XML não tem pedido para cruzar com os pickings.`,
      });
    } else if (achados.length === 0) {
      avisos.push({
        categoria: "Nota sem picking",
        nivel: "erro",
        mensagem: `${ident}: pedido não encontrado nos pickings.`,
      });
    } else {
      // The same pedido can appear in two pickings (e.g. remessa + brindes) with the same number: not an error.
      const numeros = Array.from(new Set(achados.map((p) => p.numero).filter(Boolean)));
      nota.numeroPicking = numeros.join(" / ");
      if (numeros.length > 1) {
        avisos.push({
          categoria: "Vários pickings para o mesmo pedido",
          nivel: "alerta",
          mensagem: `NF ${nota.nfTexto}: pedido ${nota.pedido} aparece nos pickings ${numeros.join(", ")}.`,
        });
      }
      if (numeros.length === 0) {
        avisos.push({
          categoria: "Nota sem picking",
          nivel: "erro",
          mensagem: `${ident}: pedido encontrado, mas o número do picking não foi lido.`,
        });
      }
    }
    return nota;
  });

  const usados = new Set<Picking>(Array.from(atribuicao.values()).flat());
  for (const [pedido, lista] of porPedido) {
    if (!pedidosNf.has(pedido) && !(tolerante && lista.every((p) => usados.has(p)))) {
      avisos.push({
        categoria: "Picking sem NF",
        nivel: "info",
        mensagem: `Pedido ${pedido} (picking ${lista.map((p) => p.numero || "?").join(", ")}) não tem XML nesta carga.`,
      });
    }
  }

  return { notas: saida, avisos };
}

export function formatarDoc(d: string): string {
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return d;
}
