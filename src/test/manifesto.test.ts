import { describe, expect, it } from "vitest";
import textos from "./fixtures-manifesto.json";
import { lerManifesto } from "@/lib/recebimento/manifesto";
import { normalizarPlaca, placaValida } from "@/lib/recebimento/regras";

describe("manifesto (DAMDFE)", () => {
  it("lê os campos do manifesto CDLog", () => {
    const { dados } = lerManifesto(textos as string[]);
    expect(dados).toEqual({
      cliente: "HARALD",
      lacre: "1216519/1216520",
      origem: "CAJAMAR/SP",
      motorista: "JAIR SILVEIRA LEMOS JU",
      transportadora: "CDLOG",
      placa: "RYW-8H20 / QHZ-7D21",
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
