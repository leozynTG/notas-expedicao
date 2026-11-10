interface ItemTexto {
  str: string;
  transform: number[];
  width: number;
}

/** Extracts the PDF text line by line (grouping text pieces by vertical position). */
export async function extrairTextoPdf(arquivo: File): Promise<string> {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) })
    .promise;

  const paginas: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p);
    const conteudo = await pagina.getTextContent();
    const linhas = new Map<number, ItemTexto[]>();
    for (const item of conteudo.items as unknown[]) {
      const it = item as Partial<ItemTexto>;
      if (typeof it.str !== "string" || !it.transform || it.str === "") continue;
      const y = Math.round((it.transform[5] ?? 0) / 2) * 2;
      const lista = linhas.get(y) ?? [];
      lista.push(it as ItemTexto);
      linhas.set(y, lista);
    }
    const ys = Array.from(linhas.keys()).sort((a, b) => b - a);
    for (const y of ys) {
      const itens = (linhas.get(y) ?? []).sort(
        (a, b) => (a.transform[4] ?? 0) - (b.transform[4] ?? 0),
      );
      let linha = "";
      let fimAnterior = -Infinity;
      for (const it of itens) {
        const x = it.transform[4] ?? 0;
        if (linha && x - fimAnterior > 1) linha += " ";
        linha += it.str;
        fimAnterior = x + it.width;
      }
      paginas.push(linha.replace(/\s+/g, " ").trim());
    }
  }
  return paginas.join("\n");
}
