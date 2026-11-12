import type { NotaFiscal, Tipo } from "./nfe";
import type { LinhaPlanilha } from "./exportar";

/** Número de carga mais frequente entre as notas (infCpl "CARGA: ..."). Vazio se nenhuma tiver. */
export function sugerirNumeroCarga(notas: Pick<NotaFiscal, "carga">[]): string {
  const cont = new Map<string, number>();
  for (const n of notas) {
    const c = n.carga.trim();
    if (c) cont.set(c, (cont.get(c) ?? 0) + 1);
  }
  let melhor = "";
  let max = 0;
  for (const [c, q] of cont) {
    if (q > max) {
      melhor = c;
      max = q;
    }
  }
  return melhor;
}

/** Números de carga diferentes encontrados (para avisar quando o ZIP mistura cargas). */
export function cargasDistintas(notas: Pick<NotaFiscal, "carga">[]): string[] {
  return Array.from(new Set(notas.map((n) => n.carga.trim()).filter(Boolean)));
}

export interface CargaPayload {
  numero_carga: string;
  total_notas: number;
  vendas: number;
  trocas: number;
  bonificacoes: number;
  brindes: number;
  amostras: number;
  outras: number;
  notas_fracionadas: number;
  notas_sem_volume: number;
  /** Soma dos pesos das notas que trazem o campo; null se nenhuma trouxer. */
  peso_bruto_total_kg: number | null;
  peso_liquido_total_kg: number | null;
}

export interface NotaPayload {
  nf: string;
  pedido: string;
  numero_troca: string | null;
  natureza_operacao: string;
  tipo: string;
  destinatario: string;
  cidade_uf: string;
  valor_nf: number;
  volumes: number | null;
  qtde_cx: number;
  qtde_fd: number;
  qtde_un: number;
  fracionado: boolean;
  especie_volume: string;
  peso_bruto_kg: number | null;
  peso_liquido_kg: number | null;
  chave_acesso: string;
}

type NotaParaSalvar = Pick<
  NotaFiscal,
  | "nfTexto"
  | "pedido"
  | "numeroTroca"
  | "natOp"
  | "tipo"
  | "destinatario"
  | "cidadeUf"
  | "valor"
  | "volumes"
  | "qtdCx"
  | "qtdFd"
  | "qtdUn"
  | "fracionado"
  | "especie"
  | "pesoBruto"
  | "pesoLiquido"
  | "chave"
>;

/** Soma ignorando notas sem o campo; null quando nenhuma nota tem valor. */
export function somaPesos(valores: (number | null)[]): number | null {
  const presentes = valores.filter((v): v is number => v !== null);
  if (presentes.length === 0) return null;
  return Math.round(presentes.reduce((s, v) => s + v, 0) * 10000) / 10000;
}

/** Monta só os dados extraídos (nada do XML/PDF em si) para salvar no histórico. */
export function montarCarga(
  numero: string,
  notas: NotaParaSalvar[],
): { carga: CargaPayload; notas: NotaPayload[] } {
  const conta = (t: Tipo) => notas.filter((n) => n.tipo === t).length;
  return {
    carga: {
      numero_carga: numero.trim(),
      total_notas: notas.length,
      vendas: conta("Venda"),
      trocas: conta("Troca"),
      bonificacoes: conta("Bonificação"),
      brindes: conta("Brinde"),
      amostras: conta("Amostra"),
      outras: conta("Outra saída") + conta("Outro"),
      notas_fracionadas: notas.filter((n) => n.fracionado).length,
      notas_sem_volume: notas.filter((n) => n.volumes === null).length,
      peso_bruto_total_kg: somaPesos(notas.map((n) => n.pesoBruto)),
      peso_liquido_total_kg: somaPesos(notas.map((n) => n.pesoLiquido)),
    },
    notas: notas.map((n) => ({
      nf: n.nfTexto,
      pedido: n.pedido,
      numero_troca: n.numeroTroca ? n.numeroTroca : null,
      natureza_operacao: n.natOp,
      tipo: n.tipo,
      destinatario: n.destinatario,
      cidade_uf: n.cidadeUf,
      valor_nf: n.valor,
      volumes: n.volumes,
      qtde_cx: n.qtdCx,
      qtde_fd: n.qtdFd,
      qtde_un: n.qtdUn,
      fracionado: n.fracionado,
      especie_volume: n.especie,
      peso_bruto_kg: n.pesoBruto,
      peso_liquido_kg: n.pesoLiquido,
      chave_acesso: n.chave,
    })),
  };
}

export interface NotaSalva {
  nf: string;
  pedido: string;
  numero_troca: string | null;
  natureza_operacao: string;
  tipo: string;
  destinatario: string;
  cidade_uf: string;
  valor_nf: number | string;
  volumes: number | string | null;
  qtde_cx: number | string;
  qtde_fd: number | string;
  qtde_un: number | string;
  fracionado: boolean;
  especie_volume: string;
  peso_bruto_kg: number | string | null;
  peso_liquido_kg: number | string | null;
  chave_acesso: string;
}

const numero = (v: number | string) => (typeof v === "number" ? v : Number(v) || 0);
const numeroOuNulo = (v: number | string | null) => (v === null ? null : numero(v));

/** Converte notas do histórico de volta para linhas da planilha, ordenadas por NF. */
export function linhasDoHistorico(notas: NotaSalva[]): LinhaPlanilha[] {
  return notas
    .map((n) => {
      const nf = parseInt(n.nf, 10);
      return {
        nf: Number.isFinite(nf) ? nf : null,
        nfTexto: n.nf,
        pedido: n.pedido,
        numeroTroca: n.numero_troca ?? "",
        natOp: n.natureza_operacao,
        tipo: n.tipo as Tipo,
        destinatario: n.destinatario,
        cidadeUf: n.cidade_uf,
        valor: numero(n.valor_nf),
        volumes: n.volumes === null ? null : numero(n.volumes),
        qtdCx: numero(n.qtde_cx),
        qtdFd: numero(n.qtde_fd),
        qtdUn: numero(n.qtde_un),
        fracionado: n.fracionado,
        especie: n.especie_volume,
        pesoBruto: numeroOuNulo(n.peso_bruto_kg),
        pesoLiquido: numeroOuNulo(n.peso_liquido_kg),
        chave: n.chave_acesso,
      };
    })
    .sort((a, b) => (a.nf ?? Number.MAX_SAFE_INTEGER) - (b.nf ?? Number.MAX_SAFE_INTEGER));
}
