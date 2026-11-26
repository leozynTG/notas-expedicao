import type { PaginaPdf } from "./picking";

interface ItemTexto {
  str: string;
  transform: number[];
  width: number;
}

/** Reads every page's text pieces with their positions (viewport coordinates, origin top-left). */
export async function lerPaginasPdf(arquivo: File): Promise<PaginaPdf[]> {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) })
    .promise;

  const paginas: PaginaPdf[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p);
    const viewport = pagina.getViewport({ scale: 1 });
    const conteudo = await pagina.getTextContent();
    const trechos: PaginaPdf["trechos"] = [];
    for (const item of conteudo.items as unknown[]) {
      const it = item as Partial<ItemTexto>;
      if (typeof it.str !== "string" || !it.transform || it.str.trim() === "") continue;
      const [, , , , x = 0, topo = 0] = pdfjs.Util.transform(viewport.transform, it.transform);
      trechos.push({ str: it.str, x, topo, largura: it.width ?? 0 });
    }
    paginas.push({ largura: viewport.width, altura: viewport.height, trechos });
  }
  return paginas;
}

/** Abre um PDF (pdf.js carregado sob demanda). */
export async function abrirPdf(dados: ArrayBuffer | Uint8Array) {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const copia = dados instanceof Uint8Array ? dados.slice() : new Uint8Array(dados.slice(0));
  return pdfjs.getDocument({ data: copia }).promise;
}
