import { describe, expect, it } from "vitest";
import textos from "./fixtures-apoio.json";
import { conferirConjunto, montarPagina, montarPaginaApoio, ordenarPaginas } from "@/lib/cte/ordenar";

// Texto real (pdf.js) de um PDF com a NF-e 89054 (2 páginas) e 3 boletos fora de ordem (2/3, 3/3, 1/3).
const apoio = (t: string[]) => t.map((x, i) => montarPaginaApoio(0, "nota_boletos.pdf", i + 1, x));

describe("NF-e e boletos junto com CTe", () => {
  it("reconhece DANFE (2 páginas) e boletos com a parcela", () => {
    const p = apoio(textos as string[]);
    expect(p.map((x) => x.tipo)).toEqual(["nfe", "nfe", "boleto", "boleto", "boleto"]);
    expect(p.map((x) => x.notas[0])).toEqual([89054, 89054, 89054, 89054, 89054]);
    expect(p.slice(2).map((x) => x.parcela)).toEqual([
      { n: 2, total: 3 },
      { n: 3, total: 3 },
      { n: 1, total: 3 },
    ]);
  });

  it("ordena CTe → NF-e → boleto 1, 2, 3 por nota", () => {
    const cte = (nota: number, pg: number) => ({ ...montarPagina(1, "cte.pdf", pg, ""), notas: [nota], chaves: ["x"] });
    const todas = [cte(90000, 1), ...apoio(textos as string[]).map((x) => ({ ...x, arquivo: 2 })), cte(89054, 2)];
    const ordem = ordenarPaginas(todas).map((x) => `${x.notas[0]}-${x.tipo}${x.parcela ? x.parcela.n : ""}`);
    expect(ordem).toEqual([
      "89054-cte", "89054-nfe", "89054-nfe", "89054-boleto1", "89054-boleto2", "89054-boleto3", "90000-cte",
    ]);
    expect(conferirConjunto(todas)).toEqual([
      "Nota 90000: não tem a NF-e.",
      "Nota 90000: nenhum boleto encontrado.",
    ]);
  });

  it("avisa boleto faltando", () => {
    const p = apoio(textos as string[]).filter((x) => x.parcela?.n !== 3);
    expect(conferirConjunto(p)).toContain("Nota 89054: faltam os boletos 3/3.");
  });

  it("CTe com várias notas cobre todas e agrupa as notas depois dele", () => {
    const mk = (tipo: "cte" | "nfe" | "boleto", nota: number, n = 0, notas = [nota]) => ({
      ...montarPagina(0, "a.pdf", 1, ""), tipo, notas, chaves: tipo === "cte" ? ["x"] : [], parcela: n ? { n, total: 1 } : null,
    });
    const todas = [
      mk("nfe", 89130), mk("boleto", 89130, 1), mk("nfe", 89121), mk("boleto", 89121, 1),
      mk("nfe", 89125), mk("boleto", 89125, 1), mk("cte", 89121, 0, [89121, 89130]), mk("cte", 89125),
    ];
    const ordem = ordenarPaginas(todas).map((x) => `${x.notas.join("+")}-${x.tipo}`);
    expect(ordem).toEqual([
      "89121+89130-cte", "89121-nfe", "89121-boleto", "89130-nfe", "89130-boleto", "89125-cte",
      "89125-nfe", "89125-boleto",
    ]);
    expect(conferirConjunto(todas)).toEqual([]);
  });
});
