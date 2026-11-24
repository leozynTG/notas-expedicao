import type { Registro } from "./dados";
import { dataBr, duracaoRegistro } from "./dados";
import { formatarDuracao, type Ocorrencia } from "./regras";

const FONTE = { name: "Arial", size: 10 };

type Lista = Omit<Registro, "assinatura_conferente" | "assinatura_motorista">;

export async function planilhaRecebimentos(regs: Lista[]): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();

  function estilo(ws: import("exceljs").Worksheet, ultimaCol: string, linhas: number, total: boolean) {
    ws.eachRow({ includeEmpty: true }, (row) => row.eachCell({ includeEmpty: true }, (c) => (c.font = { ...FONTE })));
    ws.getRow(1).eachCell((c) => {
      c.font = { ...FONTE, bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: "A1", to: `${ultimaCol}${linhas + 1}` };
    if (total) ws.lastRow?.eachCell({ includeEmpty: true }, (c) => { c.font = { ...FONTE, bold: true }; c.border = { top: { style: "thin" } }; });
  }

  const ws = wb.addWorksheet("Recebimentos");
  const cab = ["Data chegada", "Hora chegada", "Cliente", "Origem", "Motorista", "Transportadora", "Veículo", "Placa",
    "Volumes", "Quant. NF-e", "Peso (kg)", "Valor (R$)", "Cubagem (m³)", "Paletes", "PBR", "CHEP", "Descartável", "Quebrados",
    "Ocorrências", "Nº ocorrências", "Início descarga", "Fim descarga", "Duração", "Data saída", "Lacre", "Conferente",
    "KPI", "Controle paletes", "E-mail enviado"];
  ws.addRow(cab);
  ws.columns.forEach((c, i) => (c.width = [3, 4, 5].includes(i) ? 28 : 14));
  const sn = (b: boolean) => (b ? "Sim" : "Não");
  for (const r of regs) {
    const oc = Array.isArray(r.ocorrencias) ? r.ocorrencias.length : 0;
    ws.addRow([dataBr(r.data_chegada), r.hora_chegada ?? "", r.cliente, r.origem, r.motorista, r.transportadora, r.veiculo,
      r.placa, r.volumes, r.quant_nfe, r.peso_kg, r.valor, r.cubagem_m3, r.paletes_total, r.paletes_pbr, r.paletes_chep,
      r.paletes_descartavel, r.paletes_quebrados, sn(r.tem_ocorrencia), oc, r.hora_inicio ?? "", r.hora_final ?? "",
      formatarDuracao(duracaoRegistro(r)), dataBr(r.data_saida), r.lacre, r.conferente, sn(r.lanc_kpi),
      sn(r.lanc_controle_paletes), sn(r.lanc_email)]);
  }
  const u = regs.length + 1;
  const sum = (col: string) => ({ formula: `SUM(${col}2:${col}${u})` });
  ws.addRow(["TOTAL", "", "", "", "", "", "", "", sum("I"), sum("J"), sum("K"), sum("L"), sum("M"), sum("N"), sum("O"),
    sum("P"), sum("Q"), sum("R"), { formula: `COUNTIF(S2:S${u},"Sim")` }, sum("T")]);
  estilo(ws, "AC", regs.length, true);
  ws.getColumn(11).numFmt = "#,##0.000";
  ws.getColumn(12).numFmt = "#,##0.00";

  const wo = wb.addWorksheet("Ocorrências");
  wo.addRow(["Data", "Cliente", "Motorista", "Código", "Produto", "Quant.", "Nota", "Motivo"]);
  wo.columns.forEach((c, i) => (c.width = [1, 4].includes(i) ? 32 : 14));
  let n = 0;
  for (const r of regs) {
    for (const o of (Array.isArray(r.ocorrencias) ? r.ocorrencias : []) as unknown as Ocorrencia[]) {
      wo.addRow([dataBr(r.data_chegada), r.cliente, r.motorista, o.codigo, o.produto, o.quant, o.nota, o.motivo]);
      n++;
    }
  }
  estilo(wo, "H", n, false);

  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}
