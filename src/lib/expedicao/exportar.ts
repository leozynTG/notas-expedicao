import JSZip from "jszip";
import type { NotaComArquivo } from "./processar";
import type { NotaFiscal } from "./nfe";

export const CABECALHO = [
  "NF",
  "Pedido",
  "Nº troca (picking)",
  "Natureza da operação",
  "Tipo",
  "Destinatário",
  "Cidade/UF",
  "Valor da NF (R$)",
  "Volumes (XML)",
  "Qtde CX",
  "Qtde FD",
  "Qtde UN",
  "Fracionado",
  "Espécie volume",
  "Peso bruto (kg)",
  "Peso líquido (kg)",
  "Chave de acesso",
] as const;

const LARGURAS = [10, 12, 18, 34, 13, 40, 26, 16, 13, 10, 10, 10, 12, 16, 15, 16, 48];
const FONTE = { name: "Arial", size: 10 };

/** Campos da nota que a planilha usa — vale para notas recém-lidas e para notas do histórico. */
export type LinhaPlanilha = Pick<
  NotaFiscal,
  | "nf"
  | "nfTexto"
  | "pedido"
  | "numeroTroca"
  | "natOp"
  | "tipo"
  | "destinatario"
  | "cidadeUf"
  | "valor"
  | "volumes"
  | "qtdCx"
  | "qtdFd"
  | "qtdUn"
  | "fracionado"
  | "especie"
  | "pesoBruto"
  | "pesoLiquido"
  | "chave"
>;

export async function gerarPlanilha(notas: LinhaPlanilha[]): Promise<Uint8Array> {
  const mod = await import("exceljs");
  const ExcelJS = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Expedição CDLog";
  const ws = wb.addWorksheet("Notas", { views: [{ state: "frozen", ySplit: 1 }] });

  ws.addRow([...CABECALHO]);
  LARGURAS.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  for (const n of notas) {
    const row = ws.addRow([
      n.nf ?? n.nfTexto,
      n.pedido,
      n.numeroTroca,
      n.natOp,
      n.tipo,
      n.destinatario,
      n.cidadeUf,
      n.valor,
      n.volumes,
      n.qtdCx,
      n.qtdFd,
      n.qtdUn,
      n.fracionado ? "Sim" : "Não",
      n.especie,
      n.pesoBruto,
      n.pesoLiquido,
      n.chave,
    ]);
    row.getCell(17).numFmt = "@";
    if (n.fracionado) {
      for (const c of [10, 11, 12]) {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
      }
    }
  }

  const ultima = notas.length + 1;
  const soma = (col: string, valores: number[]) => ({
    formula: `SUM(${col}2:${col}${ultima})`,
    result: Math.round(valores.reduce((s, v) => s + v, 0) * 10000) / 10000,
  });
  const total = ws.addRow([
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    soma("H", notas.map((n) => n.valor)),
    soma("I", notas.map((n) => n.volumes ?? 0)),
    soma("J", notas.map((n) => n.qtdCx)),
    soma("K", notas.map((n) => n.qtdFd)),
    soma("L", notas.map((n) => n.qtdUn)),
    { formula: `COUNTIF(M2:M${ultima},"Sim")`, result: notas.filter((n) => n.fracionado).length },
    "",
    soma("O", notas.map((n) => n.pesoBruto ?? 0)),
    soma("P", notas.map((n) => n.pesoLiquido ?? 0)),
    "",
  ]);

  ws.eachRow({ includeEmpty: true }, (row, nr) => {
    row.eachCell({ includeEmpty: true }, (cell, nc) => {
      cell.font = { ...FONTE };
      if (nc === 8 && nr > 1) cell.numFmt = "#,##0.00";
      if ((nc === 15 || nc === 16) && nr > 1) cell.numFmt = "#,##0.000";
    });
  });
  ws.getRow(1).eachCell((cell) => {
    cell.font = { ...FONTE, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    cell.alignment = { vertical: "middle" };
  });
  total.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { ...FONTE, bold: true };
    cell.border = { top: { style: "thin" } };
  });

  ws.autoFilter = { from: "A1", to: `Q${ultima}` };

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

function nomeBase(caminho: string): string {
  return caminho.split("/").pop() ?? caminho;
}

async function zipar(notas: NotaComArquivo[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const usados = new Set<string>();
  for (const n of notas) {
    let nome = nomeBase(n.arquivo);
    let i = 2;
    while (usados.has(nome.toLowerCase())) {
      nome = nomeBase(n.arquivo).replace(/(\.xml)$/i, `_${i++}$1`);
    }
    usados.add(nome.toLowerCase());
    zip.file(nome, n.bytes);
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export async function gerarZips(notas: NotaComArquivo[]) {
  const trocas = notas.filter((n) => n.grupoZip === "trocas_brindes_amostras");
  const demais = notas.filter((n) => n.grupoZip === "demais_notas");
  return { trocas: await zipar(trocas), demais: await zipar(demais) };
}

export function baixar(dados: Uint8Array, nome: string, tipo: string) {
  const blob = new Blob([dados as BlobPart], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
