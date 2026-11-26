import { createWorker, type Worker } from "tesseract.js";
import { abrirPdf } from "./pdf-texto";
import type { Picking, LeituraPickings } from "./picking";
import type { Aviso } from "./tipos";

/**
 * Leitura por OCR do Mapa Analítico quando o PDF não tem texto legível (fontes Type 3 sem Unicode).
 * Para cada página: recorta (1) o número no canto superior direito e (2) o bloco "Cliente + PEDIDO".
 */

const ESCALA = 3;

// Regiões em fração da página (calibradas no mapa analítico Ninfa, A4 retrato).
const REGS_NUMERO = [
  { x0: 0.865, x1: 0.928, y0: 0.022, y1: 0.05 },
  { x0: 0.85, x1: 0.935, y0: 0.02, y1: 0.055 },
  { x0: 0.86, x1: 0.931, y0: 0.024, y1: 0.048 },
];
const REG_BLOCO = { x0: 0.04, x1: 0.66, y0: 0.088, y1: 0.162 };

export type Progresso = (feito: number, total: number) => void;

function base(): string {
  return new URL("ocr/", document.baseURI).href;
}

async function novoWorker(): Promise<Worker> {
  const b = base();
  return createWorker("eng", 1, {
    workerPath: b + "worker.min.js",
    corePath: b,
    langPath: b,
    gzip: true,
    workerBlobURL: false,
  } as any);
}

function recortar(origem: HTMLCanvasElement, r: { x0: number; x1: number; y0: number; y1: number }, borda: number): HTMLCanvasElement {
  const w = origem.width;
  const h = origem.height;
  const sx = Math.floor(r.x0 * w);
  const sy = Math.floor(r.y0 * h);
  const sw = Math.ceil((r.x1 - r.x0) * w);
  const sh = Math.ceil((r.y1 - r.y0) * h);
  const c = document.createElement("canvas");
  c.width = sw + borda * 2;
  c.height = sh + borda * 2;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(origem, sx, sy, sw, sh, borda, borda, sw, sh);
  return c;
}

/** Apaga linhas/bordas longas (horizontais e verticais) que atrapalham a leitura dos dígitos. */
function tirarLinhas(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext("2d")!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const escuro = (x: number, y: number) => d[(y * c.width + x) * 4]! < 225;
  const linhas: number[] = [];
  const cols: number[] = [];
  for (let y = 0; y < c.height; y++) {
    let n = 0;
    for (let x = 0; x < c.width; x++) if (escuro(x, y)) n++;
    if (n > c.width * 0.5) linhas.push(y - 1, y, y + 1);
  }
  for (let x = 0; x < c.width; x++) {
    let n = 0;
    for (let y = 0; y < c.height; y++) if (escuro(x, y)) n++;
    if (n > c.height * 0.5) cols.push(x - 1, x, x + 1);
  }
  const branco = (x: number, y: number) => { const k = (y * c.width + x) * 4; d[k] = d[k + 1] = d[k + 2] = 255; };
  for (const y of linhas) if (y >= 0 && y < c.height) for (let x = 0; x < c.width; x++) branco(x, y);
  for (const x of cols) if (x >= 0 && x < c.width) for (let y = 0; y < c.height; y++) branco(x, y);
  for (let k = 0; k < d.length; k += 4) { const v = d[k]! < 150 ? 0 : 255; d[k] = d[k + 1] = d[k + 2] = v; }
  ctx.putImageData(img, 0, 0);
  return c;
}

function ampliar(c: HTMLCanvasElement, f: number): HTMLCanvasElement {
  const o = document.createElement("canvas");
  o.width = c.width * f;
  o.height = c.height * f;
  const x = o.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  x.drawImage(c, 0, 0, o.width, o.height);
  return o;
}

/** O→0 etc. em campos que só podem ter dígitos. */
function soNumeros(s: string): string {
  return s.replace(/[OoQD]/g, "0").replace(/[Il|]/g, "1").replace(/S/g, "5").replace(/B/g, "8").replace(/[^0-9]/g, "");
}

export function interpretarBloco(texto: string): { pedido: string; descricao: string; cnpj: string }[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let cnpj = "";
  for (const l of linhas) {
    const m = l.match(/CNPJ\s*[.,:_]{2,}\s*:?\s*([0-9OoIl|SB.,\/\-\s]{14,24})/i) ?? l.match(/CPF\s*[.,:_]{2,}\s*:?\s*([0-9OoIl|SB.,\/\-\s]{11,18})/i);
    if (m) {
      const d = soNumeros(m[1]!);
      if (d && d !== "78099777000142") {
        cnpj = d;
        break;
      }
    }
  }
  const saida: { pedido: string; descricao: string; cnpj: string }[] = [];
  for (const l of linhas) {
    const m = l.match(/PEDIDO\b.{0,16}?[:;]\s*([0-9OoIl]{2})\s*[-–—~_]\s*([A-Za-z0-9]{3,9})\s*(?:[|Il!\]\[]\s*(.*))?$/i);
    if (m) saida.push({ pedido: m[2]!.toUpperCase(), descricao: (m[3] ?? "").trim(), cnpj });
  }
  return saida;
}

export async function lerPickingsOcr(arquivo: File, progresso?: Progresso): Promise<LeituraPickings> {
  const pdf = await abrirPdf(await arquivo.arrayBuffer());
  const wNum = await novoWorker();
  const wBloco = await novoWorker();
  await wNum.setParameters({
    tessedit_char_whitelist: "0123456789",
    tessedit_pageseg_mode: "7" as any,
  });
  await wBloco.setParameters({ tessedit_pageseg_mode: "6" as any });

  const pickings: Picking[] = [];
  const vistos = new Set<string>();
  const avisos: Aviso[] = [];
  let anterior = "";
  let anteriorN = 0;
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i);
      const vp = pg.getViewport({ scale: ESCALA });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      await pg.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas } as any).promise;

      const rb = await wBloco.recognize(recortar(canvas, REG_BLOCO, 20));
      const cands: number[] = [];
      const noIntervalo = (c: number) => c === anteriorN || c === anteriorN + 1 || (c > anteriorN && c <= anteriorN + 3);
      tentativas: for (const fator of [2, 3, 1.5, 4]) {
        for (const reg of REGS_NUMERO) {
          const cv = ampliar(tirarLinhas(recortar(canvas, reg, 30)), fator);
          const rn = await wNum.recognize(cv);
          const d = (rn.data.text || "").replace(/\D/g, "");
          if (d.length >= 1 && d.length <= 4) cands.push(parseInt(d, 10));
          if (cands.some(noIntervalo) && cands.length >= 2) break tentativas;
        }
        if (!anteriorN && cands.length >= 3) break;
      }
      let escolhido: number | undefined = cands.find((c) => c === anteriorN + 1) ?? cands.find((c) => c === anteriorN) ?? cands.filter((c) => c > anteriorN && c <= anteriorN + 3).sort((a, b) => a - b)[0];
      if (escolhido === undefined && cands.length) {
        const freq = new Map<number, number>();
        for (const c of cands) freq.set(c, (freq.get(c) ?? 0) + 1);
        escolhido = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
      }
      const numero = escolhido === undefined ? "" : String(escolhido);
      let usado = numero || anterior;
      if (numero) {
        const n = parseInt(numero, 10);
        if (anteriorN && (n < anteriorN || n > anteriorN + 1)) {
          avisos.push({
            categoria: "Número de picking suspeito",
            nivel: "alerta",
            mensagem: `Página ${i} do mapa: número lido ${n} após ${anteriorN}. Confira o número manualmente.`,
          });
        }
        anteriorN = n;
      }
      anterior = usado;
      for (const p of interpretarBloco(rb.data.text || "")) {
        const chave = `${usado}|${p.pedido}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        pickings.push({ numero: usado, pedido: p.pedido, descricao: p.descricao, cnpj: p.cnpj });
      }
      progresso?.(i, pdf.numPages);
      canvas.width = canvas.height = 0;
    }
  } finally {
    await wNum.terminate();
    await wBloco.terminate();
  }
  return { origem: "ocr", pickings, semTexto: false, avisos };
}
