import JSZip from "jszip";

const eh = (d: Uint8Array, ...b: number[]) => b.every((v, i) => d[i] === v);

/** Aceita .zip ou .rar (detectado pelos primeiros bytes) e devolve sempre os bytes de um ZIP. */
export async function paraZip(dados: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const bytes = dados instanceof Uint8Array ? dados : new Uint8Array(dados);
  if (eh(bytes, 0x50, 0x4b)) return bytes;
  if (!eh(bytes, 0x52, 0x61, 0x72, 0x21)) {
    throw new Error("Formato não reconhecido: envie um arquivo .zip ou .rar com os XMLs.");
  }
  const [{ createExtractorFromData }, wasm] = await Promise.all([
    import("node-unrar-js"),
    import("node-unrar-js/esm/js/unrar.wasm?url"),
  ]);
  const wasmBinary = await (await fetch(wasm.default)).arrayBuffer();
  const extrator = await createExtractorFromData({ wasmBinary, data: bytes.slice().buffer as ArrayBuffer });
  const zip = new JSZip();
  for (const f of extrator.extract().files) {
    if (f.fileHeader.flags.directory || !f.extraction) continue;
    zip.file(f.fileHeader.name, f.extraction as unknown as Uint8Array);
  }
  return zip.generateAsync({ type: "uint8array" });
}
