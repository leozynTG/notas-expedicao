import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { FILTROS_VAZIOS, filtrar, resumoLista, temDivergencia, type Linha } from "@/lib/recebimento/lista";
import { paraZip } from "@/lib/expedicao/compactado";

const base = {
  tem_ocorrencia: false, paletes_total: null, paletes_pbr: null, paletes_chep: null, paletes_descartavel: null,
  paletes_quebrados: null, volumes: 10, peso_kg: 100, valor: 50, transportadora: "Truckbem", cliente: "Aurora",
  data_chegada: "2026-11-19",
} as unknown as Linha;
const l = (o: Partial<Linha>): Linha => ({ ...base, ...o });

describe("lista de recebimentos", () => {
  const regs = [
    l({ cliente: "Aurora", data_chegada: "2026-11-19", tem_ocorrencia: true }),
    l({ cliente: "Marfrig", data_chegada: "2026-11-20", transportadora: "Rápido Sul" }),
    l({ cliente: "Aurora Foods", data_chegada: "2026-11-25", paletes_total: 6, paletes_pbr: 3, paletes_chep: 2 }),
  ];
  it("filtra por período, nome sem acento e ocorrência", () => {
    expect(filtrar(regs, { ...FILTROS_VAZIOS, de: "2026-11-20" })).toHaveLength(2);
    expect(filtrar(regs, { ...FILTROS_VAZIOS, ate: "2026-11-19" })).toHaveLength(1);
    expect(filtrar(regs, { ...FILTROS_VAZIOS, cliente: "aurora" })).toHaveLength(2);
    expect(filtrar(regs, { ...FILTROS_VAZIOS, transportadora: "rapido" })).toHaveLength(1);
    expect(filtrar(regs, { ...FILTROS_VAZIOS, ocorrencia: "com" })).toHaveLength(1);
    expect(filtrar(regs, { ...FILTROS_VAZIOS, ocorrencia: "sem" })).toHaveLength(2);
  });
  it("divergência = ocorrência ou soma de paletes diferente do total", () => {
    expect(temDivergencia(regs[0]!)).toBe(true);
    expect(temDivergencia(regs[1]!)).toBe(false);
    expect(temDivergencia(regs[2]!)).toBe(true);
  });
  it("resume o período", () => {
    const r = resumoLista(regs);
    expect(r).toMatchObject({ total: 3, volumes: 30, peso: 300, valor: 150, paletes: 6, comDivergencia: 2 });
  });
});

describe("arquivo compactado", () => {
  it("deixa ZIP como está e recusa formato desconhecido", async () => {
    const z = new JSZip();
    z.file("a.xml", "<x/>");
    const bytes = await z.generateAsync({ type: "uint8array" });
    expect(await paraZip(bytes)).toBe(bytes);
    await expect(paraZip(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/zip.*rar/i);
  });
});
