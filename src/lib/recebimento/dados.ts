import type { Database } from "@/integrations/supabase/types";
import {
  duracaoDescarga, escreverNumBr, finalAntesDoInicio, lerInteiro, lerNumBr, placaValida, type Ocorrencia,
} from "./regras";

export type Registro = Database["public"]["Tables"]["recebimentos"]["Row"];
export type NovoRegistro = Database["public"]["Tables"]["recebimentos"]["Insert"];

export interface Form {
  data_chegada: string; hora_chegada: string; hora_inicio: string; hora_final: string; data_saida: string;
  cliente: string; origem: string; motorista: string; transportadora: string; veiculo: string; placa: string;
  peso: string; valor: string; transporte: string; cubagem: string; volumes: string; quant_nfe: string; lacre: string;
  paletes_total: string; paletes_pbr: string; paletes_chep: string; paletes_descartavel: string; paletes_quebrados: string;
  tem_ocorrencia: boolean; ocorrencias: Ocorrencia[];
  lanc_kpi: boolean; lanc_controle_paletes: boolean; lanc_email: boolean;
  conferente: string; assinatura_conferente: string | null; assinatura_motorista: string | null;
}

export function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formVazio(): Form {
  return {
    data_chegada: hojeIso(), hora_chegada: "", hora_inicio: "", hora_final: "", data_saida: "",
    cliente: "", origem: "", motorista: "", transportadora: "", veiculo: "", placa: "",
    peso: "", valor: "", transporte: "", cubagem: "", volumes: "", quant_nfe: "", lacre: "",
    paletes_total: "", paletes_pbr: "", paletes_chep: "", paletes_descartavel: "", paletes_quebrados: "",
    tem_ocorrencia: false, ocorrencias: [],
    lanc_kpi: false, lanc_controle_paletes: false, lanc_email: false,
    conferente: "", assinatura_conferente: null, assinatura_motorista: null,
  };
}

const int = (v: number | null) => (v === null ? "" : String(v));

export function formDeRegistro(r: Registro): Form {
  return {
    data_chegada: r.data_chegada, hora_chegada: r.hora_chegada ?? "", hora_inicio: r.hora_inicio ?? "",
    hora_final: r.hora_final ?? "", data_saida: r.data_saida ?? "",
    cliente: r.cliente, origem: r.origem, motorista: r.motorista, transportadora: r.transportadora,
    veiculo: r.veiculo, placa: r.placa,
    peso: escreverNumBr(r.peso_kg, 3), valor: escreverNumBr(r.valor, 2), transporte: r.transporte,
    cubagem: escreverNumBr(r.cubagem_m3, 3), volumes: int(r.volumes), quant_nfe: int(r.quant_nfe), lacre: r.lacre,
    paletes_total: int(r.paletes_total), paletes_pbr: int(r.paletes_pbr), paletes_chep: int(r.paletes_chep),
    paletes_descartavel: int(r.paletes_descartavel), paletes_quebrados: int(r.paletes_quebrados),
    tem_ocorrencia: r.tem_ocorrencia,
    ocorrencias: Array.isArray(r.ocorrencias) ? (r.ocorrencias as unknown as Ocorrencia[]) : [],
    lanc_kpi: r.lanc_kpi, lanc_controle_paletes: r.lanc_controle_paletes, lanc_email: r.lanc_email,
    conferente: r.conferente, assinatura_conferente: r.assinatura_conferente, assinatura_motorista: r.assinatura_motorista,
  };
}

/** Erros que impedem salvar. */
export function validar(f: Form): string[] {
  const e: string[] = [];
  if (!f.data_chegada) e.push("Informe a data da chegada.");
  if (!f.cliente.trim()) e.push("Informe o cliente.");
  if (!f.motorista.trim()) e.push("Informe o motorista.");
  if (!f.placa.trim()) e.push("Informe a placa.");
  else if (!placaValida(f.placa)) e.push("Placa inválida (use AAA-0A00 ou AAA-0000).");
  const vol = lerInteiro(f.volumes);
  if (vol === null) e.push("Informe os volumes.");
  const nums: [string, number | null][] = [
    ["Peso", lerNumBr(f.peso)], ["Valor da carga", lerNumBr(f.valor)], ["Cubagem", lerNumBr(f.cubagem)],
  ];
  const ints: [string, number | null][] = [
    ["Volumes", vol], ["Quant. NF-e", lerInteiro(f.quant_nfe)], ["Total de paletes", lerInteiro(f.paletes_total)],
    ["PBR", lerInteiro(f.paletes_pbr)], ["CHEP", lerInteiro(f.paletes_chep)],
    ["Descartável", lerInteiro(f.paletes_descartavel)], ["Quebrados", lerInteiro(f.paletes_quebrados)],
  ];
  for (const [n, v] of nums) if (Number.isNaN(v)) e.push(`${n}: número inválido (ex.: 2.435,2).`);
  for (const [n, v] of ints) if (Number.isNaN(v)) e.push(`${n}: use um número inteiro.`);
  if (finalAntesDoInicio(f.hora_inicio, f.hora_final)) e.push("A hora final da descarga é antes da hora início.");
  if (f.tem_ocorrencia && f.ocorrencias.length === 0) e.push('Ocorrências marcadas como "Sim", mas nenhuma linha foi adicionada.');
  return e;
}

export function paraRegistro(f: Form): NovoRegistro {
  const n = (s: string) => lerNumBr(s);
  const i = (s: string) => lerInteiro(s);
  return {
    data_chegada: f.data_chegada, hora_chegada: f.hora_chegada || null, hora_inicio: f.hora_inicio || null,
    hora_final: f.hora_final || null, data_saida: f.data_saida || null,
    cliente: f.cliente.trim(), origem: f.origem.trim(), motorista: f.motorista.trim(),
    transportadora: f.transportadora.trim(), veiculo: f.veiculo.trim(), placa: f.placa.trim().toUpperCase(),
    peso_kg: n(f.peso), valor: n(f.valor), transporte: f.transporte.trim(), cubagem_m3: n(f.cubagem),
    volumes: i(f.volumes) ?? 0, quant_nfe: i(f.quant_nfe), lacre: f.lacre.trim(),
    paletes_total: i(f.paletes_total), paletes_pbr: i(f.paletes_pbr), paletes_chep: i(f.paletes_chep),
    paletes_descartavel: i(f.paletes_descartavel), paletes_quebrados: i(f.paletes_quebrados),
    tem_ocorrencia: f.tem_ocorrencia,
    ocorrencias: (f.tem_ocorrencia ? f.ocorrencias : []) as unknown as import("@/integrations/supabase/types").Json,
    lanc_kpi: f.lanc_kpi, lanc_controle_paletes: f.lanc_controle_paletes, lanc_email: f.lanc_email,
    conferente: f.conferente.trim(), assinatura_conferente: f.assinatura_conferente,
    assinatura_motorista: f.assinatura_motorista, atualizado_em: new Date().toISOString(),
  };
}

export const duracaoRegistro = (r: Pick<Registro, "hora_inicio" | "hora_final">) =>
  duracaoDescarga(r.hora_inicio ?? "", r.hora_final ?? "");

export const dataBr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");
