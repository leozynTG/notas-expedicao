import JSZip from "jszip";
import { lerNfe, XmlIgnorado, TIPOS, type NotaFiscal, type Tipo } from "./nfe";
import { cruzarPickings, lerPickings } from "./picking";
import type { Aviso } from "./tipos";

export interface NotaComArquivo extends NotaFiscal {
  bytes: Uint8Array;
}

export interface Resumo {
  total: number;
  porTipo: Record<Tipo, number>;
  fracionadas: number;
  semVolume: number;
  semPedido: number;
  trocasSemPicking: number;
  valorTotal: number;
  noZipTrocas: number;
  noZipDemais: number;
}

export interface ResultadoCarga {
  notas: NotaComArquivo[];
  avisos: Aviso[];
  resumo: Resumo;
  pickingEnviado: boolean;
  pickingsLidos: number;
}

function decodificar(bytes: Uint8Array): string {
  const cabecalho = new TextDecoder("ascii").decode(bytes.slice(0, 200));
  const enc = cabecalho.match(/encoding=["']([\w-]+)["']/i)?.[1]?.toLowerCase() ?? "utf-8";
  try {
    return new TextDecoder(enc).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export function resumir(notas: NotaFiscal[]): Resumo {
  const porTipo = Object.fromEntries(TIPOS.map((t) => [t, 0])) as Record<Tipo, number>;
  for (const n of notas) porTipo[n.tipo] += 1;
  return {
    total: notas.length,
    porTipo,
    fracionadas: notas.filter((n) => n.fracionado).length,
    semVolume: notas.filter((n) => n.volumes === null).length,
    semPedido: notas.filter((n) => !n.pedido).length,
    trocasSemPicking: notas.filter((n) => n.tipo === "Troca" && !n.numeroTroca).length,
    valorTotal: notas.reduce((s, n) => s + n.valor, 0),
    noZipTrocas: notas.filter((n) => n.grupoZip === "trocas_brindes_amostras").length,
    noZipDemais: notas.filter((n) => n.grupoZip === "demais_notas").length,
  };
}

export async function processarCarga(
  zipData: ArrayBuffer | Uint8Array,
  pickingTexto: string | null,
): Promise<ResultadoCarga> {
  const zip = await JSZip.loadAsync(zipData);
  const avisos: Aviso[] = [];
  const porChave = new Map<string, NotaComArquivo>();

  const entradas = Object.values(zip.files).filter((f) => {
    if (f.dir) return false;
    const nome = f.name.split("/").pop() ?? "";
    if (f.name.startsWith("__MACOSX/") || nome.startsWith("._")) return false;
    return nome.toLowerCase().endsWith(".xml");
  });

  for (const entrada of entradas) {
    const bytes = await entrada.async("uint8array");
    try {
      const nota = lerNfe(decodificar(bytes), entrada.name);
      const chave = nota.chave || entrada.name;
      const existente = porChave.get(chave);
      if (existente) {
        avisos.push({
          categoria: "Nota repetida no ZIP",
          nivel: "alerta",
          mensagem: `NF ${nota.nfTexto} aparece em "${existente.arquivo}" e "${entrada.name}". Considerada uma vez só.`,
        });
        continue;
      }
      porChave.set(chave, { ...nota, bytes });
      if (!nota.pedido) {
        avisos.push({
          categoria: "XML sem pedido",
          nivel: "alerta",
          mensagem: `NF ${nota.nfTexto} (${nota.destinatario}): não foi encontrado "PEDIDO:" nas informações complementares.`,
        });
      }
      if (nota.outrasUnidades.length > 0) {
        avisos.push({
          categoria: "Unidade fora de CX/FD/UN",
          nivel: "info",
          mensagem: `NF ${nota.nfTexto}: unidade(s) ${nota.outrasUnidades.join(", ")} não somada(s) em Qtde CX/FD/UN.`,
        });
      }
    } catch (e) {
      if (!(e instanceof XmlIgnorado)) throw e;
      avisos.push({
        categoria: "Arquivo ignorado",
        nivel: "info",
        mensagem: `"${entrada.name}": ${e.message}.`,
      });
    }
  }

  if (porChave.size === 0) {
    throw new Error("Nenhum XML de NF-e foi encontrado dentro do ZIP.");
  }

  let notas = Array.from(porChave.values()).sort(
    (a, b) => (a.nf ?? Number.MAX_SAFE_INTEGER) - (b.nf ?? Number.MAX_SAFE_INTEGER),
  );

  let pickingsLidos = 0;
  if (pickingTexto !== null) {
    const pickings = lerPickings(pickingTexto);
    pickingsLidos = pickings.length;
    if (pickings.length === 0) {
      avisos.push({
        categoria: "Pickings",
        nivel: "erro",
        mensagem: "Nenhum picking foi reconhecido no arquivo do mapa analítico.",
      });
    }
    const cruzado = cruzarPickings(notas, pickings);
    const bytesPorArquivo = new Map(notas.map((n) => [n.arquivo, n.bytes]));
    notas = cruzado.notas.map((n) => ({ ...n, bytes: bytesPorArquivo.get(n.arquivo)! }));
    avisos.push(...cruzado.avisos);
  } else if (notas.some((n) => n.tipo === "Troca")) {
    avisos.push({
      categoria: "Pickings",
      nivel: "info",
      mensagem: "O mapa analítico não foi enviado, então as trocas ficaram sem número de picking.",
    });
  }

  return { notas, avisos, resumo: resumir(notas), pickingEnviado: pickingTexto !== null, pickingsLidos };
}
