import { escreverNumBr, lerNumBr, normalizarPlaca } from "./regras";

export interface DadosManifesto {
  cliente: string;
  origem: string;
  motorista: string;
  transportadora: string;
  placa: string;
  peso: string;
  valor: string;
  volumes: string;
  quant_nfe: string;
  lacre: string;
}

const PARAR = new Set(["TECNORISK", "GEREN", "RISCO", "AUTORIZACÃO", "AUTORIZAÇÃO", "QTDE", "PESO", "CTE", "CTRC"]);
const MAIUSC = "A-ZÀ-ÖØ-Þ";

/** Lê o texto (já extraído, uma string por página) de um DAMDFE e devolve os campos do Controle de Recebimento. */
export function lerManifesto(paginas: string[]): { dados: Partial<DadosManifesto>; avisos: string[] } {
  const t = paginas.join(" \n ").replace(/\s+/g, " ");
  const d: Partial<DadosManifesto> = {};
  const avisos: string[] = [];

  if (!/MANIFESTO ELETR/i.test(t)) avisos.push("Este PDF não parece ser um manifesto (DAMDFE).");

  // Lacres: "LACRES: HARALD-1216519/1216520" → embarcador + números.
  const lac = t.match(new RegExp(`LACRES: ?([${MAIUSC}][${MAIUSC} .&]*?)-([\\d/ -]+?)(?= •|$)`));
  if (lac) {
    d.cliente = lac[1]!.trim();
    d.lacre = lac[2]!.trim();
  }

  // Origem: primeira "CIDADE/UF(XXX)" (a de destino vem depois).
  const org = t.match(new RegExp(`([${MAIUSC}]+(?: [${MAIUSC}]+)*)/([A-Z]{2})\\([A-Z]{3}\\)`));
  if (org) d.origem = `${org[1]}/${org[2]}`;

  // Motorista(s): CPF seguido do nome em maiúsculas.
  const nomes: string[] = [];
  for (const m of t.matchAll(new RegExp(`\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2} ((?:[${MAIUSC}]+ ?)+)`, "g"))) {
    const palavras = m[1]!.trim().split(" ");
    const corte = palavras.findIndex((p) => PARAR.has(p));
    const nome = (corte >= 0 ? palavras.slice(0, corte) : palavras).join(" ");
    if (nome && !nomes.includes(nome)) nomes.push(nome);
  }
  if (nomes.length) d.motorista = nomes.join(" / ");

  // Transportadora: emitente do manifesto (primeira linha).
  const tr = t.match(new RegExp(`([${MAIUSC}][${MAIUSC} .&]+?(?:LTDA|S\\.?A\\.?|ME|EPP))(?= |$)`));
  if (tr) d.transportadora = /^CDLOG/.test(tr[1]!) ? "CDLOG" : tr[1]!.trim();

  // Placas: "PLACA RYW8H20 - RENAVAM…" (observações) ou a lista do cabeçalho.
  let placas = [...t.matchAll(/PLACA ([A-Z]{3}\d[A-Z0-9]\d{2})\b/g)].map((m) => m[1]!);
  if (placas.length === 0) placas = [...t.matchAll(/\b([A-Z]{3}\d[A-Z0-9]\d{2})\b/g)].map((m) => m[1]!);
  placas = [...new Set(placas)].slice(0, 2);
  if (placas.length) d.placa = placas.map(normalizarPlaca).join(" / ");

  // Totais do MDF-e: "23 CTRCs 18.126,0 18.126,0 1662 463.943,47 23.145,53 2.777,47" (a de maior quantidade).
  const tot = [...t.matchAll(/(\d+) CTRCs ([\d.]+,\d) ([\d.]+,\d) (\d+) ([\d.]+,\d{2}) ([\d.]+,\d{2}) ([\d.]+,\d{2})/g)].sort(
    (a, b) => Number(b[1]) - Number(a[1]),
  )[0];
  if (tot) {
    d.peso = escreverNumBr(lerNumBr(tot[2]!), 3);
    d.volumes = tot[4]!;
    d.valor = escreverNumBr(lerNumBr(tot[5]!), 2);
  } else avisos.push("Não consegui achar os totais (peso, volumes e valor) no manifesto.");

  const nf = t.match(/NOTAS FISCAIS NO MDFE: ?(\d+)/);
  if (nf) d.quant_nfe = nf[1]!;

  if (nomes.length) avisos.push("Confira o nome do motorista: o manifesto pode cortar nomes longos.");
  return { dados: d, avisos };
}
