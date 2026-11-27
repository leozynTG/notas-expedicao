import { describe, expect, it } from "vitest";
import { lerManifesto } from "@/lib/recebimento/manifesto";
import { normalizarPlaca, placaValida } from "@/lib/recebimento/regras";

// Texto sintético no formato do pdf.js para um DAMDFE (dados fictícios).
const TEXTO = [
  `DOCUMENTO AUXILIAR DE MANIFESTO ELETRÔNICO DE DOCUMENTOS FISCAIS ORIGEM DA PRESTAÇÃO PLACAS DESTINO DA PRESTAÇÃO MOTORISTAS (CPF/NOME)
   TRANSPORTES EXEMPLO LTDA 123456789 CIDADEX/SP(SAO) AAA1B23 BBB2C34 OUTRACIDADE/SC(FLN) 111.222.333-44 JOAO DA SILVA TECNORISK 99 18.126,0`,
  `T O T A I S D O M D F E 23 CTRCs 18.126,0 18.126,0 1662 463.943,47 23.145,53 2.777,47 • TOTAL DE NOTAS FISCAIS NO MDFE: 26 •
   LACRES: ACME-1216519/1216520 • CTRB: X • PLACA AAA1B23 - RENAVAM 1 • PLACA BBB2C34 RENAVAM 2 •`,
];

describe("manifesto (DAMDFE)", () => {
  it("lê os campos", () => {
    const { dados } = lerManifesto(TEXTO);
    expect(dados).toMatchObject({
      cliente: "ACME",
      lacre: "1216519/1216520",
      origem: "CIDADEX/SP",
      motorista: "JOAO DA SILVA",
      placa: "AAA-1B23 / BBB-2C34",
      peso: "18.126",
      volumes: "1662",
      valor: "463.943,47",
      quant_nfe: "26",
    });
  });
  it("aceita duas placas", () => {
    expect(normalizarPlaca("ryw8h20qhz7d21")).toBe("RYW-8H20 / QHZ-7D21");
    expect(normalizarPlaca("ryw8h20/")).toBe("RYW-8H20 / ");
    expect(placaValida("RYW-8H20 / QHZ-7D21")).toBe(true);
    expect(placaValida("RYW-8H20 / QHZ")).toBe(false);
  });
});
