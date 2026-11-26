import type { Registro } from "./dados";
import { duracaoDescarga, somaPaletes } from "./regras";

export type Linha = Omit<Registro, "assinatura_conferente" | "assinatura_motorista">;

export interface Filtros {
  de: string;
  ate: string;
  cliente: string;
  transportadora: string;
  ocorrencia: "todas" | "com" | "sem";
}

export const FILTROS_VAZIOS: Filtros = { de: "", ate: "", cliente: "", transportadora: "", ocorrencia: "todas" };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function filtrar<T extends Pick<Linha, "data_chegada" | "cliente" | "transportadora" | "tem_ocorrencia">>(
  regs: T[],
  f: Filtros,
): T[] {
  const cli = norm(f.cliente);
  const tr = norm(f.transportadora);
  return regs.filter(
    (r) =>
      (!f.de || r.data_chegada >= f.de) &&
      (!f.ate || r.data_chegada <= f.ate) &&
      (!cli || norm(r.cliente).includes(cli)) &&
      (!tr || norm(r.transportadora).includes(tr)) &&
      (f.ocorrencia === "todas" || (f.ocorrencia === "com") === r.tem_ocorrencia),
  );
}

/** Há divergência quando houve ocorrência marcada ou a soma dos tipos de palete não bate com o total. */
export function temDivergencia(r: Pick<Linha, "tem_ocorrencia" | "paletes_total" | "paletes_pbr" | "paletes_chep" | "paletes_descartavel" | "paletes_quebrados">): boolean {
  if (r.tem_ocorrencia) return true;
  const tipos = [r.paletes_pbr, r.paletes_chep, r.paletes_descartavel, r.paletes_quebrados];
  if (r.paletes_total === null && tipos.every((v) => v === null)) return false;
  return (
    somaPaletes({
      total: r.paletes_total, pbr: r.paletes_pbr, chep: r.paletes_chep,
      descartavel: r.paletes_descartavel, quebrados: r.paletes_quebrados,
    }) !== (r.paletes_total ?? 0)
  );
}

export function resumoLista(regs: Linha[]) {
  return {
    total: regs.length,
    volumes: regs.reduce((s, r) => s + r.volumes, 0),
    peso: regs.reduce((s, r) => s + (r.peso_kg ?? 0), 0),
    valor: regs.reduce((s, r) => s + (r.valor ?? 0), 0),
    paletes: regs.reduce((s, r) => s + (r.paletes_total ?? 0), 0),
    comDivergencia: regs.filter(temDivergencia).length,
  };
}

export function duracaoLinha(r: Pick<Linha, "hora_inicio" | "hora_final">): number | null {
  return duracaoDescarga(r.hora_inicio ?? "", r.hora_final ?? "");
}
