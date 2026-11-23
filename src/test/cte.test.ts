import { describe, expect, it } from "vitest";
import { chavesDaPagina, dvChaveValido, montarPagina, numeroNota, ordenarPaginas, chavesDuplicadas, situacao } from "@/lib/cte/ordenar";

function comDv(base43: string) {
  let s = 0, p = 2;
  for (let i = 42; i >= 0; i--) { s += Number(base43[i]) * p; p = p === 9 ? 2 : p + 1; }
  const r = s % 11;
  return base43 + (r < 2 ? 0 : 11 - r);
}
const chave = (nf: number, modelo = "55") =>
  comDv("4125117809977700014" + "2" + modelo + "001" + String(nf).padStart(9, "0") + "1" + "12345678");

describe("CTe", () => {
  it("lê número da nota das posições 25-33", () => {
    expect(numeroNota(chave(1490374))).toBe(1490374);
    expect(dvChaveValido(chave(1490374))).toBe(true);
  });
  it("aceita chave com espaços e descarta DV inválido e modelo diferente", () => {
    const k = chave(1502137);
    const ruim = k.slice(0, 43) + ((Number(k[43]) + 1) % 10);
    const txt = `NF-E: ${k.replace(/(\d{4})/g, "$1 ")} NF-E: ${ruim} NF-E: ${chave(5, "57")}`;
    expect(chavesDaPagina(txt)).toEqual([k]);
  });
  it("página com várias notas ordena pela menor; não identificadas vão ao final", () => {
    const a = montarPagina(0, "a.pdf", 1, `NF-E: ${chave(20)} NF-E: ${chave(10)}`);
    const b = montarPagina(0, "a.pdf", 2, "sem chave");
    const c = montarPagina(0, "a.pdf", 3, `NF-E: ${chave(15)}`);
    expect(ordenarPaginas([a, b, c]).map((p) => p.pagina)).toEqual([1, 3, 2]);
    expect(situacao(a, new Set())).toBe("Várias notas");
    b.manual = 12;
    expect(ordenarPaginas([a, b, c]).map((p) => p.pagina)).toEqual([1, 2, 3]);
  });
  it("marca chave repetida em duas páginas como Duplicada", () => {
    const a = montarPagina(0, "a.pdf", 1, `NF-E: ${chave(7)}`);
    const b = montarPagina(1, "b.pdf", 1, `NF-E: ${chave(7)}`);
    expect(situacao(a, chavesDuplicadas([a, b]))).toBe("Duplicada");
  });
});
