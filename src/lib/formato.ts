export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const qtd = (v: number) => (v === 0 ? "–" : v.toLocaleString("pt-BR", { maximumFractionDigits: 4 }));
export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
export const kg = (v: number | null) =>
  v === null ? "–" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`;
export const numBr = (v: number, casas = 0) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
export const pct = (v: number | null) => (v === null ? "–" : `${numBr(v, 1)}%`);
export const toneladas = (kgTotal: number) => `${numBr(kgTotal / 1000, 2)} t`;
