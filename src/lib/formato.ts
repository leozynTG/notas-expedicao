export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const qtd = (v: number) => (v === 0 ? "–" : v.toLocaleString("pt-BR", { maximumFractionDigits: 4 }));
export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
