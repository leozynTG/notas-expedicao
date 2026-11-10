import { soDigitos, type NotaFiscal } from "./nfe";
import type { Aviso } from "./tipos";

export interface Picking {
  numero: string;
  pedido: string;
  descricao: string;
  cnpj: string;
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
  for (const bloco of blocos) {
    const primeira = bloco.map((l) => l.trim()).find((l) => l !== "") ?? "";
    const numero = /^\d+$/.test(primeira) ? primeira : (primeira.match(/^(\d+)\b/)?.[1] ?? "");
    const corpo = bloco.join("\n");
    const cnpj = soDigitos(corpo.match(/CNPJ\.*:\s*([\d./-]+)/i)?.[1] ?? "");
    for (const m of corpo.matchAll(/PEDIDO N\S+:\s*\d+-(\w+)\s*\|\s*(.+)/gi)) {
      pickings.push({
        numero,
        pedido: (m[1] ?? "").toUpperCase(),
        descricao: (m[2] ?? "").trim(),
        cnpj,
      });
    }
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
