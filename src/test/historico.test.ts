import { describe, expect, it } from "vitest";
import { extrairCarga, lerNfe } from "@/lib/expedicao/nfe";
import { linhasDoHistorico, montarCarga, sugerirNumeroCarga } from "@/lib/expedicao/historico";

const base = {
  nfTexto: "10",
  pedido: "P1",
  numeroTroca: "",
  natOp: "VENDA",
  tipo: "Venda" as const,
  destinatario: "CLIENTE",
  cidadeUf: "CAMPINAS/SP",
  valor: 10,
  volumes: 2 as number | null,
  qtdCx: 1,
  qtdFd: 0,
  qtdUn: 0,
  fracionado: false,
  especie: "CAIXA",
  chave: "123",
};

describe("número da carga", () => {
  it('lê "CARGA: 140894" do infCpl', () => {
    expect(extrairCarga("PEDIDO: AAJM1  CARGA: 140894 OBS")).toBe("140894");
    expect(extrairCarga("sem carga aqui")).toBe("");
  });
  it("lerNfe preenche a carga", () => {
    const xml = `<NFe><infNFe Id="NFe1"><ide><nNF>1</nNF><natOp>VENDA</natOp></ide><infAdic><infCpl>PEDIDO: X CARGA: 140894</infCpl></infAdic></infNFe></NFe>`;
    expect(lerNfe(xml, "a.xml").carga).toBe("140894");
  });
  it("sugere o número mais frequente entre as notas", () => {
    expect(sugerirNumeroCarga([{ carga: "140894" }, { carga: "" }, { carga: "140894" }, { carga: "9" }])).toBe("140894");
    expect(sugerirNumeroCarga([{ carga: "" }])).toBe("");
  });
});

describe("dados salvos no histórico", () => {
  it("conta notas por tipo, fracionadas e sem volume", () => {
    const { carga } = montarCarga(" 140894 ", [
      base,
      { ...base, tipo: "Troca", numeroTroca: "555" },
      { ...base, tipo: "Bonificação", fracionado: true },
      { ...base, tipo: "Brinde", volumes: null },
      { ...base, tipo: "Amostra" },
      { ...base, tipo: "Outra saída" },
    ]);
    expect(carga).toEqual({
      numero_carga: "140894",
      total_notas: 6,
      vendas: 1,
      trocas: 1,
      bonificacoes: 1,
      brindes: 1,
      amostras: 1,
      outras: 1,
      notas_fracionadas: 1,
      notas_sem_volume: 1,
    });
  });
  it("Nº troca vazio vira nulo e volume ausente continua nulo", () => {
    const { notas } = montarCarga("1", [{ ...base, volumes: null }, { ...base, numeroTroca: "555" }]);
    expect(notas[0]?.numero_troca).toBeNull();
    expect(notas[0]?.volumes).toBeNull();
    expect(notas[1]?.numero_troca).toBe("555");
  });
  it("notas do histórico voltam ordenadas por NF, com volume nulo preservado", () => {
    const { notas } = montarCarga("1", [{ ...base, nfTexto: "20", volumes: null }, { ...base, nfTexto: "3" }]);
    const linhas = linhasDoHistorico(notas.map((n) => ({ ...n, valor_nf: String(n.valor_nf) })));
    expect(linhas.map((l) => l.nf)).toEqual([3, 20]);
    expect(linhas[1]?.volumes).toBeNull();
    expect(linhas[0]?.valor).toBe(10);
  });
});
