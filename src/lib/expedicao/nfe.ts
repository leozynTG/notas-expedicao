export type Tipo =
  | "Venda"
  | "Troca"
  | "Brinde"
  | "Amostra"
  | "Bonificação"
  | "Outra saída"
  | "Outro";

export const TIPOS: Tipo[] = [
  "Venda",
  "Troca",
  "Brinde",
  "Amostra",
  "Bonificação",
  "Outra saída",
  "Outro",
];

export type GrupoZip = "trocas_brindes_amostras" | "demais_notas";

export interface NotaFiscal {
  arquivo: string;
  nf: number | null;
  nfTexto: string;
  chave: string;
  natOp: string;
  tipo: Tipo;
  destinatario: string;
  documento: string;
  cidadeUf: string;
  valor: number;
  pedido: string;
  /** Número da carga lido de infCpl ("CARGA: 140894"); vazio se não houver. */
  carga: string;
  infAdFisco: string;
  volumes: number | null;
  especie: string;
  qtdCx: number;
  qtdFd: number;
  qtdUn: number;
  fracionado: boolean;
  outrasUnidades: string[];
  grupoZip: GrupoZip;
  numeroTroca: string;
}

/** Uppercase and strip accents so "BONIFICAÇÃO" and "BONIFICACAO" compare equal. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function classificar(natOp: string, infAdFisco: string): Tipo {
  const nat = normalizar(natOp);
  const fisco = normalizar(infAdFisco);
  if (nat.startsWith("OUTRA SAIDA")) {
    if (fisco.includes("TROCA")) return "Troca";
    if (fisco.includes("BRINDE")) return "Brinde";
    return "Outra saída";
  }
  if (nat.includes("AMOSTRA")) return "Amostra";
  if (nat.includes("BONIFICACAO")) return "Bonificação";
  if (nat.startsWith("VENDA")) return "Venda";
  return "Outro";
}

export function grupoZip(natOp: string): GrupoZip {
  const nat = normalizar(natOp);
  return nat.startsWith("OUTRA SAIDA") || nat.includes("AMOSTRA")
    ? "trocas_brindes_amostras"
    : "demais_notas";
}

export function extrairPedido(infCpl: string): string {
  return infCpl.match(/PEDIDO:\s*(\S+)/i)?.[1] ?? "";
}

export function extrairCarga(infCpl: string): string {
  return infCpl.match(/CARGA:\s*([^\s,;|]+)/i)?.[1] ?? "";
}

export function arred(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function temDecimal(n: number): boolean {
  return Math.abs(arred(n) % 1) > 0;
}

export function soDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

function filhos(el: Element, nome: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === nome);
}

function no(el: Element | null, caminho: string): Element | null {
  let atual: Element | null = el;
  for (const parte of caminho.split("/")) {
    if (!atual) return null;
    atual = filhos(atual, parte)[0] ?? null;
  }
  return atual;
}

function txt(el: Element | null, caminho: string): string {
  return no(el, caminho)?.textContent?.trim() ?? "";
}

function num(s: string): number {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

export class XmlIgnorado extends Error {}

export function lerNfe(xml: string, arquivo: string): NotaFiscal {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new XmlIgnorado("XML inválido (não foi possível ler o arquivo)");
  }
  const inf = doc.getElementsByTagNameNS("*", "infNFe")[0] ?? null;
  if (!inf) throw new XmlIgnorado("não é uma NF-e (sem infNFe)");

  const nfTexto = txt(inf, "ide/nNF");
  const natOp = txt(inf, "ide/natOp");
  const infCpl = txt(inf, "infAdic/infCpl");
  const infAdFisco = txt(inf, "infAdic/infAdFisco");
  const dest = no(inf, "dest");
  const mun = txt(dest, "enderDest/xMun");
  const uf = txt(dest, "enderDest/UF");

  const transp = no(inf, "transp");
  const vols = transp ? filhos(transp, "vol") : [];
  let volumes: number | null = null;
  const especies = new Set<string>();
  for (const v of vols) {
    const q = txt(v, "qVol");
    if (q !== "") volumes = (volumes ?? 0) + num(q);
    const e = txt(v, "esp");
    if (e) especies.add(e);
  }

  const somas: Record<string, number> = {};
  for (const det of filhos(inf, "det")) {
    const prod = no(det, "prod");
    const u = normalizar(txt(prod, "uCom"));
    somas[u] = (somas[u] ?? 0) + num(txt(prod, "qCom"));
  }
  const qtdCx = arred(somas["CX"] ?? 0);
  const qtdFd = arred(somas["FD"] ?? 0);
  const qtdUn = arred(somas["UN"] ?? 0);
  const outrasUnidades = Object.keys(somas).filter((u) => !["CX", "FD", "UN"].includes(u));
  const fracionado = Object.values(somas).some(temDecimal);

  const nfNum = parseInt(nfTexto, 10);
  return {
    arquivo,
    nf: Number.isFinite(nfNum) ? nfNum : null,
    nfTexto,
    chave: (inf.getAttribute("Id") ?? "").replace(/^NFe/i, ""),
    natOp,
    tipo: classificar(natOp, infAdFisco),
    destinatario: txt(dest, "xNome"),
    documento: soDigitos(txt(dest, "CNPJ") || txt(dest, "CPF")),
    cidadeUf: mun || uf ? `${mun}/${uf}` : "",
    valor: num(txt(inf, "total/ICMSTot/vNF")),
    pedido: extrairPedido(infCpl),
    carga: extrairCarga(infCpl),
    infAdFisco,
    volumes: volumes === null ? null : arred(volumes),
    especie: Array.from(especies).join(", "),
    qtdCx,
    qtdFd,
    qtdUn,
    fracionado,
    outrasUnidades,
    grupoZip: grupoZip(natOp),
    numeroTroca: "",
  };
}
