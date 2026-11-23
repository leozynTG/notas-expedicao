import { montarPagina, type PaginaCte } from "./ordenar";

/** Reads each page's text (items joined by spaces) and builds the page records. Browser-only. */
export async function lerCtes(arquivos: File[], progresso: (atual: number, total: number) => void) {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const docs = await Promise.all(
    arquivos.map(async (f) => pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise),
  );
  const total = docs.reduce((s, d) => s + d.numPages, 0);
  const paginas: PaginaCte[] = [];
  let atual = 0;
  for (const [i, doc] of docs.entries()) {
    for (let p = 1; p <= doc.numPages; p++) {
      progresso(++atual, total);
      const c = await (await doc.getPage(p)).getTextContent();
      const texto = (c.items as { str?: string }[]).map((it) => it.str ?? "").join(" ");
      paginas.push(montarPagina(i, arquivos[i]!.name, p, texto));
    }
  }
  return paginas;
}

export async function gerarPdfOrdenado(arquivos: File[], ordem: PaginaCte[]) {
  const { PDFDocument } = await import("pdf-lib");
  const fontes = await Promise.all(
    arquivos.map(async (f) => PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })),
  );
  const saida = await PDFDocument.create();
  for (const p of ordem) {
    const [pg] = await saida.copyPages(fontes[p.arquivo]!, [p.pagina - 1]);
    saida.addPage(pg!);
  }
  return saida.save();
}
