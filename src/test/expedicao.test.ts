import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { classificar, grupoZip, lerNfe } from "@/lib/expedicao/nfe";
import { lerPickings } from "@/lib/expedicao/picking";
import { processarCarga } from "@/lib/expedicao/processar";
import { gerarPlanilha, gerarZips } from "@/lib/expedicao/exportar";

interface Opts {
  nNF: string;
  natOp: string;
  fisco?: string;
  cpl?: string;
  cnpj?: string;
  qVol?: string | null;
  itens?: [string, string][];
}

function xml(o: Opts): string {
  const itens = (o.itens ?? [["CX", "10.0000"]])
    .map(([u, q], i) => `<det nItem="${i + 1}"><prod><uCom>${u}</uCom><qCom>${q}</qCom></prod></det>`)
    .join("");
  const vol = o.qVol === null ? "<vol><esp>CAIXA</esp></vol>" : `<vol><qVol>${o.qVol ?? "5"}</qVol><esp>CAIXA</esp></vol>`;
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe352511000000000000005500100${o.nNF.padStart(9, "0")}10000000" versao="4.00">
<ide><natOp>${o.natOp}</natOp><nNF>${o.nNF}</nNF></ide>
<emit><xNome>EMITENTE LTDA</xNome></emit>
<dest><CNPJ>${o.cnpj ?? "11222333000181"}</CNPJ><xNome>CLIENTE ${o.nNF}</xNome><enderDest><xMun>CAMPINAS</xMun><UF>SP</UF></enderDest></dest>
${itens}
<total><ICMSTot><vNF>150.50</vNF></ICMSTot></total>
<transp>${vol}</transp>
<infAdic><infAdFisco>${o.fisco ?? ""}</infAdFisco><infCpl>${o.cpl ?? `PEDIDO: AAJM${o.nNF}  CARGA: 123`}</infCpl></infAdic>
</infNFe></NFe></nfeProc>`;
}

describe("classificação (coluna Tipo)", () => {
  it("OUTRA SAIDA com TROCA no infAdFisco é Troca, sem diferenciar maiúsculas", () => {
    expect(classificar("OUTRA SAIDA - MERC", "ref. troca de mercadoria")).toBe("Troca");
  });
  it("OUTRA SAIDA com BRINDE é Brinde", () => {
    expect(classificar("OUTRA SAIDA", "BRINDE PROMOCIONAL")).toBe("Brinde");
  });
  it("OUTRA SAIDA sem troca/brinde é Outra saída", () => {
    expect(classificar("OUTRA SAIDA", "")).toBe("Outra saída");
  });
  it("AMOSTRA, BONIFICACAO, VENDA e Outro", () => {
    expect(classificar("REMESSA DE AMOSTRA GRATIS", "")).toBe("Amostra");
    expect(classificar("REMESSA EM BONIFICACAO", "")).toBe("Bonificação");
    expect(classificar("VENDA DE MERCADORIA", "")).toBe("Venda");
    expect(classificar("DEVOLUCAO", "")).toBe("Outro");
  });
  it("ZIP de trocas recebe OUTRA SAIDA ou AMOSTRA; bonificação vai para demais", () => {
    expect(grupoZip("OUTRA SAIDA")).toBe("trocas_brindes_amostras");
    expect(grupoZip("REMESSA DE AMOSTRA")).toBe("trocas_brindes_amostras");
    expect(grupoZip("REMESSA EM BONIFICACAO")).toBe("demais_notas");
    expect(grupoZip("VENDA")).toBe("demais_notas");
  });
});

describe("leitura do XML", () => {
  it("extrai o pedido do infCpl e a chave sem o prefixo NFe", () => {
    const n = lerNfe(xml({ nNF: "123", natOp: "VENDA", cpl: "PEDIDO: AAJM42  CARGA: 9" }), "a.xml");
    expect(n.pedido).toBe("AAJM42");
    expect(n.chave.startsWith("NFe")).toBe(false);
    expect(n.chave).toHaveLength(44);
    expect(n.cidadeUf).toBe("CAMPINAS/SP");
    expect(n.valor).toBe(150.5);
  });
  it("volume ausente fica vazio (null), nunca 0", () => {
    expect(lerNfe(xml({ nNF: "1", natOp: "VENDA", qVol: null }), "a.xml").volumes).toBeNull();
  });
  it("soma qCom por unidade e marca fracionado quando a soma tem decimal", () => {
    const n = lerNfe(
      xml({ nNF: "1", natOp: "VENDA", itens: [["CX", "6.5000"], ["CX", "0.2500"], ["FD", "2"], ["UN", "3"]] }),
      "a.xml",
    );
    expect(n.qtdCx).toBe(6.75);
    expect(n.qtdFd).toBe(2);
    expect(n.qtdUn).toBe(3);
    expect(n.fracionado).toBe(true);
  });
  it("somas inteiras não são fracionadas", () => {
    const n = lerNfe(xml({ nNF: "1", natOp: "VENDA", itens: [["CX", "0.5"], ["CX", "0.5"]] }), "a.xml");
    expect(n.qtdCx).toBe(1);
    expect(n.fracionado).toBe(false);
  });
});

const MAPA = `MAPA ANALITICO
IMPRESSO DIA 10/11/2026 14:00
778899
CLIENTE 2
CNPJ....: 11.222.333/0001-81
PEDIDO N?MERO: 01-AAJM2 | TROCA ARMAZENAMENTO
IMPRESSO DIA 10/11/2026 14:00
778899
CNPJ....: 99.888.777/0001-66
PEDIDO NÚMERO: 01-AAJM3 | TROCA ARMAZENAMENTO
`;

describe("pickings", () => {
  it("lê número do picking (linha após IMPRESSO DIA), pedido e CNPJ", () => {
    const p = lerPickings(MAPA);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ numero: "778899", pedido: "AAJM2", cnpj: "11222333000181" });
    expect(p[1]?.pedido).toBe("AAJM3");
  });

  it("preenche Nº troca só nas trocas e avisa CNPJ divergente e troca sem picking", async () => {
    const zip = new JSZip();
    zip.file("pasta/1.xml", xml({ nNF: "1", natOp: "VENDA" }));
    zip.file("pasta/2.xml", xml({ nNF: "2", natOp: "OUTRA SAIDA", fisco: "TROCA" }));
    zip.file("3.xml", xml({ nNF: "3", natOp: "OUTRA SAIDA", fisco: "TROCA" }));
    zip.file("4.xml", xml({ nNF: "4", natOp: "OUTRA SAIDA", fisco: "TROCA" }));
    zip.file("leia-me.txt", "ignorar");
    const r = await processarCarga(await zip.generateAsync({ type: "uint8array" }), MAPA);
    const nf = (n: number) => r.notas.find((x) => x.nf === n)!;
    expect(r.notas).toHaveLength(4);
    expect(nf(1).numeroTroca).toBe("");
    expect(nf(2).numeroTroca).toBe("778899");
    expect(nf(3).numeroTroca).toBe("778899");
    expect(r.avisos.some((a) => a.categoria === "CNPJ divergente" && a.mensagem.includes("NF 3"))).toBe(true);
    expect(r.avisos.some((a) => a.categoria === "Troca sem picking" && a.mensagem.includes("NF 4"))).toBe(true);
    expect(r.resumo.trocasSemPicking).toBe(1);
  });
});

describe("saídas", () => {
  it("separa os XMLs nos dois ZIPs sem repetir notas duplicadas", async () => {
    const zip = new JSZip();
    zip.file("a/1.xml", xml({ nNF: "1", natOp: "VENDA" }));
    zip.file("b/1.xml", xml({ nNF: "1", natOp: "VENDA" }));
    zip.file("2.xml", xml({ nNF: "2", natOp: "OUTRA SAIDA", fisco: "BRINDE" }));
    zip.file("3.xml", xml({ nNF: "3", natOp: "AMOSTRA GRATIS" }));
    zip.file("4.xml", xml({ nNF: "4", natOp: "BONIFICACAO" }));
    const r = await processarCarga(await zip.generateAsync({ type: "uint8array" }), null);
    const { trocas, demais } = await gerarZips(r.notas);
    const t = Object.keys((await JSZip.loadAsync(trocas)).files).sort();
    const d = Object.keys((await JSZip.loadAsync(demais)).files).sort();
    expect(t).toEqual(["2.xml", "3.xml"]);
    expect(d).toEqual(["1.xml", "4.xml"]);
  });

  it("planilha tem TOTAL com SUM/COUNTIF e chave como texto", async () => {
    const zip = new JSZip();
    zip.file("2.xml", xml({ nNF: "2", natOp: "VENDA", itens: [["CX", "1.5"]] }));
    zip.file("1.xml", xml({ nNF: "1", natOp: "VENDA", qVol: null }));
    const r = await processarCarga(await zip.generateAsync({ type: "uint8array" }), null);
    const bytes = await gerarPlanilha(r.notas);
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const ws = wb.getWorksheet("Notas")!;
    expect(ws.getCell("A2").value).toBe(1);
    expect(ws.getCell("I2").value).toBeNull();
    expect(ws.getCell("H4").value).toMatchObject({ formula: "SUM(H2:H3)" });
    expect(ws.getCell("M4").value).toMatchObject({ formula: 'COUNTIF(M2:M3,"Sim")' });
    expect(typeof ws.getCell("O2").value).toBe("string");
    expect(ws.getCell("O2").numFmt).toBe("@");
  });
});
