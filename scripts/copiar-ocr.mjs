import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/ocr", { recursive: true });
copyFileSync("node_modules/tesseract.js/dist/worker.min.js", "public/ocr/worker.min.js");
for (const n of ["tesseract-core-lstm", "tesseract-core-simd-lstm", "tesseract-core-relaxedsimd-lstm"])
  copyFileSync(`node_modules/tesseract.js-core/${n}.wasm.js`, `public/ocr/${n}.wasm.js`);
copyFileSync("node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "public/ocr/eng.traineddata.gz");
copyFileSync("node_modules/node-unrar-js/esm/js/unrar.wasm", "public/unrar.wasm");
console.log("ok");
