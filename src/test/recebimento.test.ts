import { describe, expect, it } from "vitest";
import {
  avisoPaletes, duracaoDescarga, finalAntesDoInicio, lerInteiro, lerNumBr, normalizarPlaca, placaValida, resumoXml, somaPaletes,
} from "@/lib/recebimento/regras";

describe("números pt-BR", () => {
  it("lê peso e valor", () => {
    expect(lerNumBr("2.435,2")).toBe(2435.2);
    expect(lerNumBr("177.993,51")).toBe(177993.51);
    expect(lerNumBr("1.500")).toBe(1500);
    expect(lerNumBr("12")).toBe(12);
    expect(lerNumBr("")).toBeNull();
    expect(lerNumBr("abc")).toBeNaN();
  });
  it("inteiros", () => {
    expect(lerInteiro("42")).toBe(42);
    expect(lerInteiro("4,5")).toBeNaN();
  });
});

describe("placa", () => {
  it("aceita Mercosul e antiga", () => {
    expect(placaValida("ABC-1D23")).toBe(true);
    expect(placaValida("ABC-1234")).toBe(true);
    expect(placaValida("AB-1234")).toBe(false);
    expect(placaValida("ABC-12345")).toBe(false);
  });
  it("normaliza para maiúscula com hífen", () => {
    expect(normalizarPlaca("abc1d23")).toBe("ABC-1D23");
  });
});

describe("descarga", () => {
  it("calcula duração", () => {
    expect(duracaoDescarga("08:15", "10:00")).toBe(105);
    expect(duracaoDescarga("10:00", "08:00")).toBeNull();
    expect(finalAntesDoInicio("10:00", "08:00")).toBe(true);
  });
});

describe("paletes", () => {
  it("soma e avisa divergência", () => {
    const p = { total: 10, pbr: 4, chep: 3, descartavel: 2, quebrados: 0 };
    expect(somaPaletes(p)).toBe(9);
    expect(avisoPaletes(p)).toBe("A soma dos tipos (9) não bate com o total (10)");
    expect(avisoPaletes({ ...p, quebrados: 1 })).toBeNull();
  });
});

describe("XMLs", () => {
  it("ignora notas sem peso/volume", () => {
    const r = resumoXml([
      { valor: 100, pesoBruto: 10, volumes: 2, cidadeUf: "X/SC", destinatario: "" },
      { valor: 50.5, pesoBruto: null, volumes: null, cidadeUf: "Y/SC", destinatario: "" },
    ]);
    expect(r).toMatchObject({ quantNfe: 2, valor: 150.5, peso: 10, volumes: 2, semPeso: 1, semVolume: 1, origem: "SC" });
  });
});
