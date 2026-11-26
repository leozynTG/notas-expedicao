import type { NotaFiscal } from "@/lib/expedicao/nfe";

/** "2.435,2" → 2435.2 ; "" → null ; inválido → NaN */
export function lerNumBr(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (t === "") return null;
  let norm: string;
  if (t.includes(",")) norm = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) norm = t.replace(/\./g, "");
  else norm = t;
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return NaN;
  return Number(norm);
}

export function lerInteiro(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

export function escreverNumBr(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
}

function placaUma(s: string): string {
  const t = s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  return t.length > 3 ? `${t.slice(0, 3)}-${t.slice(3)}` : t;
}

/** Aceita uma ou duas placas (cavalo / carreta), separadas por "/". */
export function normalizarPlaca(s: string): string {
  const limpo = s.toUpperCase();
  let partes = limpo.split(/[/,;]/);
  if (partes.length === 1) {
    const t = limpo.replace(/[^A-Z0-9]/g, "");
    partes = t.length > 7 ? [t.slice(0, 7), t.slice(7, 14)] : [t];
  }
  return partes.slice(0, 2).map(placaUma).join(" / ");
}

/** AAA-0A00 (Mercosul) ou AAA-0000 (antiga); hífen opcional. Aceita duas placas separadas por "/". */
export function placaValida(s: string): boolean {
  const partes = s.split("/").map((x) => x.trim().toUpperCase());
  return partes.length <= 2 && partes.every((x) => /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/.test(x));
}

function minutos(h: string): number | null {
  const m = h.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Duração em minutos (hora final - hora início); null se faltar hora ou se final < início. */
export function duracaoDescarga(inicio: string, fim: string): number | null {
  const a = minutos(inicio);
  const b = minutos(fim);
  if (a === null || b === null || b < a) return null;
  return b - a;
}

export function finalAntesDoInicio(inicio: string, fim: string): boolean {
  const a = minutos(inicio);
  const b = minutos(fim);
  return a !== null && b !== null && b < a;
}

export function formatarDuracao(min: number | null): string {
  if (min === null) return "–";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export interface Paletes {
  total: number | null;
  pbr: number | null;
  chep: number | null;
  descartavel: number | null;
  quebrados: number | null;
}

export function somaPaletes(p: Paletes): number {
  return (p.pbr ?? 0) + (p.chep ?? 0) + (p.descartavel ?? 0) + (p.quebrados ?? 0);
}

/** Mensagem de aviso, ou null se bate (ou se nada foi informado). */
export function avisoPaletes(p: Paletes): string | null {
  const soma = somaPaletes(p);
  const algum = [p.pbr, p.chep, p.descartavel, p.quebrados].some((v) => v !== null);
  if (p.total === null && !algum) return null;
  const total = p.total ?? 0;
  if (soma === total) return null;
  return `A soma dos tipos (${soma}) não bate com o total (${total})`;
}

export interface Ocorrencia {
  codigo: string;
  produto: string;
  quant: string;
  nota: string;
  motivo: string;
}

export const MOTIVOS = ["Falta", "Avaria", "Sobra", "Troca", "Outro"];

/** Totais para preencher o formulário a partir dos XMLs. */
export function resumoXml(notas: Pick<NotaFiscal, "valor" | "pesoBruto" | "volumes" | "cidadeUf" | "destinatario">[]) {
  const comPeso = notas.filter((n) => n.pesoBruto !== null);
  const comVol = notas.filter((n) => n.volumes !== null);
  const ufs = new Set(notas.map((n) => n.cidadeUf.split("/")[1] ?? "").filter(Boolean));
  return {
    quantNfe: notas.length,
    valor: Math.round(notas.reduce((s, n) => s + n.valor, 0) * 100) / 100,
    peso: comPeso.length ? Math.round(comPeso.reduce((s, n) => s + (n.pesoBruto ?? 0), 0) * 1000) / 1000 : null,
    volumes: comVol.length ? Math.round(comVol.reduce((s, n) => s + (n.volumes ?? 0), 0)) : null,
    semPeso: notas.length - comPeso.length,
    semVolume: notas.length - comVol.length,
    origem: ufs.size === 1 ? [...ufs][0]! : "",
  };
}
