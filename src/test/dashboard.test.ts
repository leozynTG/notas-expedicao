import { describe, expect, it } from "vitest";
import { lerDashboard, seriePorCarga, topCidades, totais, type CargaDash } from "@/lib/expedicao/dashboard";

const carga = (o: Partial<CargaDash>): CargaDash => ({
  id: "c1",
  numero_carga: "1",
  processada_em: "2026-11-01T10:00:00Z",
  notas: 10,
  trocas: 0,
  valor: 1000,
  valor_trocas: 0,
  volumes: 50,
  peso_bruto: 100,
  peso_liquido: 90,
  notas_sem_peso_bruto: 0,
  notas_sem_peso_liquido: 0,
  ...o,
});

describe("dashboard — visão geral", () => {
  const cargas = [
    carga({ id: "a", notas: 10, trocas: 2, valor: 1000, valor_trocas: 100, volumes: 40, peso_bruto: 1500, peso_liquido: 1400 }),
    carga({ id: "b", notas: 30, trocas: 3, valor: 3000, valor_trocas: 300, volumes: 80, peso_bruto: null, peso_liquido: null, notas_sem_peso_bruto: 30, notas_sem_peso_liquido: 30 }),
  ];
  const t = totais(cargas);

  it("soma cargas, notas, valor e calcula ticket médio por nota", () => {
    expect(t.cargas).toBe(2);
    expect(t.notas).toBe(40);
    expect(t.valor).toBe(4000);
    expect(t.ticketMedio).toBe(100);
  });
  it("peso ignora notas sem peso e conta quantas ficaram de fora", () => {
    expect(t.pesoBruto).toBe(1500);
    expect(t.pesoLiquido).toBe(1400);
    expect(t.notasSemPesoBruto).toBe(30);
    expect(t.notasSemPesoLiquido).toBe(30);
  });
  it("volumes totais e média por carga; média de notas por carga", () => {
    expect(t.volumes).toBe(120);
    expect(t.mediaVolumesPorCarga).toBe(60);
    expect(t.mediaNotasPorCarga).toBe(20);
  });
  it("trocas: quantidade, % das notas, valor e % do valor", () => {
    expect(t.trocas).toBe(5);
    expect(t.pctTrocas).toBe(12.5);
    expect(t.valorTrocas).toBe(400);
    expect(t.pctValorTrocas).toBe(10);
  });
  it("sem cargas não divide por zero", () => {
    const v = totais([]);
    expect(v.ticketMedio).toBeNull();
    expect(v.pctTrocas).toBeNull();
    expect(v.mediaNotasPorCarga).toBeNull();
  });
});

describe("dashboard — gráficos", () => {
  it("série por carga em ordem cronológica, com taxa de troca em %", () => {
    const s = seriePorCarga([
      carga({ id: "b", numero_carga: "B", processada_em: "2026-11-05T00:00:00Z", notas: 4, trocas: 1 }),
      carga({ id: "a", numero_carga: "A", processada_em: "2026-11-01T00:00:00Z", notas: 3, trocas: 0, peso_bruto: null }),
    ]);
    expect(s.map((p) => p.carga)).toEqual(["A", "B"]);
    expect(s[0]?.pesoBruto).toBeNull();
    expect(s[1]?.taxaTroca).toBe(25);
  });
  it("top 10 cidades somadas entre cargas, por valor ou por quantidade", () => {
    const cidades = Array.from({ length: 12 }, (_, i) => ({ carga_id: "a", cidade_uf: `C${i}/SP`, notas: 12 - i, valor: i * 10 }));
    cidades.push({ carga_id: "b", cidade_uf: "C0/SP", notas: 5, valor: 1000 });
    const porValor = topCidades(cidades, "valor");
    expect(porValor).toHaveLength(10);
    expect(porValor[0]).toEqual({ cidade: "C0/SP", notas: 17, valor: 1000 });
    expect(topCidades(cidades, "notas")[1]?.cidade).toBe("C1/SP");
    expect(topCidades(cidades, "valor", 10, new Set(["b"]))).toHaveLength(1);
  });
  it("lê números que o banco devolve como texto e mantém peso nulo", () => {
    const d = lerDashboard({ cargas: [{ id: "x", notas: "3", valor: "10.5", peso_bruto: null }], cidades: [] });
    expect(d.cargas[0]?.valor).toBe(10.5);
    expect(d.cargas[0]?.peso_bruto).toBeNull();
  });
});
