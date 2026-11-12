/** Métricas do Dashboard: funções puras sobre os agregados vindos de `dashboard_cargas`. */

export interface CargaDash {
  id: string;
  numero_carga: string;
  processada_em: string;
  notas: number;
  trocas: number;
  valor: number;
  valor_trocas: number;
  volumes: number;
  /** Soma só das notas com peso; null quando nenhuma nota da carga tem peso. */
  peso_bruto: number | null;
  peso_liquido: number | null;
  notas_sem_peso_bruto: number;
  notas_sem_peso_liquido: number;
}

export interface CidadeDash {
  carga_id: string;
  cidade_uf: string;
  notas: number;
  valor: number;
}

const n = (v: unknown) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};
const nOuNulo = (v: unknown) => (v === null || v === undefined ? null : n(v));
const arred = (v: number) => Math.round(v * 10000) / 10000;
const div = (a: number, b: number) => (b > 0 ? a / b : null);

/** Normaliza o JSON da função do banco (números podem vir como texto). */
export function lerDashboard(json: unknown): { cargas: CargaDash[]; cidades: CidadeDash[] } {
  const o = (json ?? {}) as { cargas?: Record<string, unknown>[]; cidades?: Record<string, unknown>[] };
  return {
    cargas: (o.cargas ?? []).map((c) => ({
      id: String(c["id"]),
      numero_carga: String(c["numero_carga"] ?? ""),
      processada_em: String(c["processada_em"] ?? ""),
      notas: n(c["notas"]),
      trocas: n(c["trocas"]),
      valor: n(c["valor"]),
      valor_trocas: n(c["valor_trocas"]),
      volumes: n(c["volumes"]),
      peso_bruto: nOuNulo(c["peso_bruto"]),
      peso_liquido: nOuNulo(c["peso_liquido"]),
      notas_sem_peso_bruto: n(c["notas_sem_peso_bruto"]),
      notas_sem_peso_liquido: n(c["notas_sem_peso_liquido"]),
    })),
    cidades: (o.cidades ?? []).map((c) => ({
      carga_id: String(c["carga_id"]),
      cidade_uf: String(c["cidade_uf"] ?? ""),
      notas: n(c["notas"]),
      valor: n(c["valor"]),
    })),
  };
}

export interface Totais {
  cargas: number;
  notas: number;
  valor: number;
  ticketMedio: number | null;
  pesoBruto: number;
  pesoLiquido: number;
  notasSemPesoBruto: number;
  notasSemPesoLiquido: number;
  volumes: number;
  mediaVolumesPorCarga: number | null;
  trocas: number;
  /** 0–100 */
  pctTrocas: number | null;
  valorTrocas: number;
  /** 0–100 */
  pctValorTrocas: number | null;
  mediaNotasPorCarga: number | null;
}

export function totais(cargas: CargaDash[]): Totais {
  const soma = (f: (c: CargaDash) => number) => arred(cargas.reduce((s, c) => s + f(c), 0));
  const notas = soma((c) => c.notas);
  const valor = soma((c) => c.valor);
  const volumes = soma((c) => c.volumes);
  const trocas = soma((c) => c.trocas);
  const valorTrocas = soma((c) => c.valor_trocas);
  const pctT = div(trocas, notas);
  const pctV = div(valorTrocas, valor);
  return {
    cargas: cargas.length,
    notas,
    valor,
    ticketMedio: div(valor, notas),
    pesoBruto: soma((c) => c.peso_bruto ?? 0),
    pesoLiquido: soma((c) => c.peso_liquido ?? 0),
    notasSemPesoBruto: soma((c) => c.notas_sem_peso_bruto),
    notasSemPesoLiquido: soma((c) => c.notas_sem_peso_liquido),
    volumes,
    mediaVolumesPorCarga: div(volumes, cargas.length),
    trocas,
    pctTrocas: pctT === null ? null : pctT * 100,
    valorTrocas,
    pctValorTrocas: pctV === null ? null : pctV * 100,
    mediaNotasPorCarga: div(notas, cargas.length),
  };
}

export type CriterioCidade = "valor" | "notas";

/** Top N cidades somando as cargas informadas (todas, se `cargaIds` não for passado). */
export function topCidades(
  cidades: CidadeDash[],
  criterio: CriterioCidade,
  limite = 10,
  cargaIds?: Set<string>,
): { cidade: string; notas: number; valor: number }[] {
  const mapa = new Map<string, { cidade: string; notas: number; valor: number }>();
  for (const c of cidades) {
    if (cargaIds && !cargaIds.has(c.carga_id)) continue;
    const nome = c.cidade_uf.trim() || "(sem cidade)";
    const atual = mapa.get(nome) ?? { cidade: nome, notas: 0, valor: 0 };
    atual.notas += c.notas;
    atual.valor = arred(atual.valor + c.valor);
    mapa.set(nome, atual);
  }
  return Array.from(mapa.values())
    .sort((a, b) => b[criterio] - a[criterio] || a.cidade.localeCompare(b.cidade))
    .slice(0, limite);
}

/** Série por carga em ordem cronológica (mais antiga primeiro). */
export function seriePorCarga(cargas: CargaDash[]) {
  return [...cargas]
    .sort((a, b) => a.processada_em.localeCompare(b.processada_em))
    .map((c) => ({
      id: c.id,
      carga: c.numero_carga,
      processadaEm: c.processada_em,
      pesoBruto: c.peso_bruto,
      taxaTroca: c.notas > 0 ? Math.round((c.trocas / c.notas) * 10000) / 100 : 0,
    }));
}

/** "AAAA-MM-DD" (dia local) → intervalo [de, até) em ISO. Até é inclusivo no dia escolhido. */
export function intervaloPeriodo(de?: string, ate?: string): { de: string | null; ate: string | null } {
  const inicio = (d: string) => new Date(`${d}T00:00:00`);
  let fim: Date | null = null;
  if (ate) {
    fim = inicio(ate);
    fim.setDate(fim.getDate() + 1);
  }
  return { de: de ? inicio(de).toISOString() : null, ate: fim ? fim.toISOString() : null };
}
