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
  origem: "pdf" | "txt";
  /** Unique (número + pedido) pairs, in reading order. */
  pickings: Picking[];
  /** True when the file has no readable text at all (e.g. a scanned PDF). */
  semTexto: boolean;
}

const RE_PEDIDO = /PEDIDO N\S+:\s*\d+-(\w+)\s*\|\s*(.+)/gi;
const RE_CNPJ = /CNPJ\.*:\s*([\d./-]+)/i;
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

function pedidosDoTexto(texto: string, numero: string): Picking[] {
  const cnpj = soDigitos(texto.match(RE_CNPJ)?.[1] ?? "");
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

/** Fills numeroTroca on Troca notes and returns the cross-check warnings. */
export function cruzarPickings(
  notas: NotaFiscal[],
  pickings: Picking[],
): { notas: NotaFiscal[]; avisos: Aviso[] } {
  const avisos: Aviso[] = [];
  const porPedido = new Map<string, Picking[]>();
  for (const p of pickings) {
    const lista = porPedido.get(p.pedido) ?? [];
    lista.push(p);
    porPedido.set(p.pedido, lista);
  }
  const pedidosNf = new Set(notas.map((n) => n.pedido.toUpperCase()).filter(Boolean));

  const saida = notas.map((n) => {
    const nota = { ...n, numeroTroca: "" };
    const achados = nota.pedido ? (porPedido.get(nota.pedido.toUpperCase()) ?? []) : [];

    for (const p of achados) {
      if (p.cnpj && nota.documento && p.cnpj !== nota.documento) {
        avisos.push({
          categoria: "CNPJ divergente",
          nivel: "erro",
          mensagem: `NF ${nota.nfTexto} (pedido ${nota.pedido}): destinatário ${formatarDoc(nota.documento)}, picking ${p.numero || "?"} tem ${formatarDoc(p.cnpj)}.`,
        });
      }
    }

    if (nota.tipo === "Troca") {
      if (!nota.pedido) {
        avisos.push({
          categoria: "Troca sem picking",
          nivel: "erro",
          mensagem: `NF ${nota.nfTexto} (${nota.destinatario}) é troca, mas o XML não tem pedido para cruzar.`,
        });
      } else if (achados.length === 0) {
        avisos.push({
          categoria: "Troca sem picking",
          nivel: "erro",
          mensagem: `NF ${nota.nfTexto} (${nota.destinatario}): pedido ${nota.pedido} não encontrado nos pickings.`,
        });
      } else {
        const numeros = Array.from(new Set(achados.map((p) => p.numero).filter(Boolean)));
        nota.numeroTroca = numeros.join(" / ");
        if (numeros.length > 1) {
          avisos.push({
            categoria: "Vários pickings para o mesmo pedido",
            nivel: "alerta",
            mensagem: `NF ${nota.nfTexto}: pedido ${nota.pedido} aparece nos pickings ${numeros.join(", ")}.`,
          });
        }
        if (numeros.length === 0) {
          avisos.push({
            categoria: "Troca sem picking",
            nivel: "erro",
            mensagem: `NF ${nota.nfTexto}: pedido ${nota.pedido} encontrado, mas o número do picking não foi lido.`,
          });
        }
      }
    }
    return nota;
  });

  for (const [pedido, lista] of porPedido) {
    if (!pedidosNf.has(pedido)) {
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
