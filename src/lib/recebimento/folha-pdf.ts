import { dataBr, type Registro } from "./dados";
import { escreverNumBr, type Ocorrencia } from "./regras";

/**
 * Preenche o modelo oficial "Controle de Recebimento" (public/folha-recebimento.pdf) com os dados
 * do registro, sem alterar o desenho. Coordenadas em pontos, medidas do próprio PDF (A4, topo = 0).
 */
const ALTURA = 841.92;
const y = (topo: number) => ALTURA - topo;

// Campos com linha: [x inicial, x final, topo da linha]
const CAMPO = {
  cliente: [103.4, 559.5, 208.9],
  origem: [103.4, 559.5, 235.5],
  motorista: [103.4, 361.4, 274.7],
  transp: [415.4, 559.5, 274.7],
  veiculo: [103.4, 206.6, 301.4],
  placa1: [262, 404, 301.4],
  placa2: [417, 559.5, 301.4],
  peso: [103.4, 258.2, 328.2],
  valor: [361.4, 559.5, 328.2],
  transporte: [103.4, 309.8, 354.9],
  cubagem: [415.4, 559.5, 354.9],
  volumes: [103.4, 206.6, 381.7],
  quant: [309.8, 415.4, 381.7],
  lacre: [467.1, 559.5, 381.7],
} as const;

// Data "__/__/__" e hora "__:__": faixas de cada parte e linha de base (topo).
const DATAS = {
  chegada: { partes: [[138.5, 166.3], [170, 199.6], [203.5, 232.8]], base: 127.5 },
  saida: { partes: [[447.1, 474.9], [479, 508.2], [512, 541.4]], base: 165.5 },
} as const;
const HORAS = {
  chegada: { partes: [[463.5, 491.4], [495.4, 523]], base: 127.5 },
  inicio: { partes: [[105.2, 133], [137, 164.7]], base: 165.5 },
  final: { partes: [[271.5, 299.3], [303.3, 330.9]], base: 165.5 },
} as const;

const COLUNAS = [35.8, 102.9, 257.8, 309.4, 415, 559.5];
const LINHAS_TOPO = 462.7;
const ALTURA_LINHA = 18.1;
const LINHAS_POR_PAGINA = 14;
const LOGO = { x0: 41.8, x1: 193.2, topo: 46.9, base: 91.6 };

export async function gerarFolhaPdf(r: Registro): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const base = document.baseURI;
  const [modelo, logo] = await Promise.all([
    fetch(new URL("folha-recebimento.pdf", base)).then((x) => x.arrayBuffer()),
    fetch(new URL("logo-cdlog.png", base)).then((x) => x.arrayBuffer()),
  ]);
  const saida = await PDFDocument.create();
  const [tpl] = (await saida.embedPdf(await PDFDocument.load(modelo), [0])) as [Awaited<ReturnType<typeof saida.embedPdf>>[number]];
  const imgLogo = await saida.embedPng(logo);
  const fonte = await saida.embedFont(StandardFonts.Helvetica);
  const tinta = rgb(0.05, 0.1, 0.45);

  const oc = (Array.isArray(r.ocorrencias) ? r.ocorrencias : []) as unknown as Ocorrencia[];
  const nPaginas = Math.max(1, Math.ceil(oc.length / LINHAS_POR_PAGINA));

  for (let pg = 0; pg < nPaginas; pg++) {
    const pagina = saida.addPage([595.32, ALTURA]);
    pagina.drawPage(tpl);

    // Logo em alta resolução sobre a do modelo.
    pagina.drawRectangle({ x: LOGO.x0 - 2, y: y(LOGO.base + 2), width: LOGO.x1 - LOGO.x0 + 4, height: LOGO.base - LOGO.topo + 4, color: rgb(1, 1, 1) });
    const lw = LOGO.x1 - LOGO.x0;
    const lh = LOGO.base - LOGO.topo;
    const esc = Math.min(lw / imgLogo.width, lh / imgLogo.height);
    pagina.drawImage(imgLogo, { x: LOGO.x0, y: y(LOGO.base) + (lh - imgLogo.height * esc) / 2, width: imgLogo.width * esc, height: imgLogo.height * esc });

    const texto = (t: string, x0: number, x1: number, topoLinha: number, tam = 11, f = fonte, folga = 2.5) => {
      if (!t) return;
      let s = tam;
      while (s > 6 && f.widthOfTextAtSize(t, s) > x1 - x0 - 4) s -= 0.5;
      pagina.drawText(t, { x: x0 + 2, y: y(topoLinha - folga), size: s, font: f, color: tinta });
    };
    const centro = (t: string, x0: number, x1: number, topoBase: number, tam = 11) => {
      if (!t) return;
      const w = fonte.widthOfTextAtSize(t, tam);
      pagina.drawText(t, { x: (x0 + x1) / 2 - w / 2, y: y(topoBase), size: tam, font: fonte, color: tinta });
    };
    const xis = (xa: number, xb: number, topoBase: number) => centro("X", xa, xb, topoBase, 12);

    if (pg > 0) {
      pagina.drawText(`Continuação — ${r.cliente} — ${r.placa} — ${dataBr(r.data_chegada)}`, { x: 36, y: y(30), size: 8, font: fonte, color: tinta });
    } else {
      const n = (v: number | null | undefined, c = 0) => (v === null || v === undefined ? "" : escreverNumBr(v, c));
      const parte = (campo: readonly [number, number, number], t: string, tam?: number) => texto(t, campo[0], campo[1], campo[2], tam);

      const data = (k: keyof typeof DATAS, iso: string | null) => {
        if (!iso) return;
        const [a, m, d] = iso.split("-");
        [d, m, a].forEach((v, i) => centro(v ?? "", DATAS[k].partes[i]![0], DATAS[k].partes[i]![1], DATAS[k].base));
      };
      const hora = (k: keyof typeof HORAS, h: string | null) => {
        const m = (h ?? "").match(/^(\d{1,2}):(\d{2})/);
        if (!m) return;
        [m[1]!.padStart(2, "0"), m[2]!].forEach((v, i) => centro(v, HORAS[k].partes[i]![0], HORAS[k].partes[i]![1], HORAS[k].base));
      };
      data("chegada", r.data_chegada);
      hora("chegada", r.hora_chegada);
      hora("inicio", r.hora_inicio);
      hora("final", r.hora_final);
      data("saida", r.data_saida);

      parte(CAMPO.cliente, r.cliente);
      parte(CAMPO.origem, r.origem);
      parte(CAMPO.motorista, r.motorista);
      parte(CAMPO.transp, r.transportadora);
      parte(CAMPO.veiculo, r.veiculo);
      const placas = r.placa.split("/").map((x) => x.trim());
      parte(CAMPO.placa1, placas[0] ?? "");
      parte(CAMPO.placa2, placas[1] ?? "");
      parte(CAMPO.peso, n(r.peso_kg, 3));
      parte(CAMPO.valor, n(r.valor, 2));
      parte(CAMPO.transporte, r.transporte);
      parte(CAMPO.cubagem, n(r.cubagem_m3, 3));
      parte(CAMPO.volumes, n(r.volumes));
      parte(CAMPO.quant, n(r.quant_nfe));
      parte(CAMPO.lacre, r.lacre);

      // Paletes: um número dentro de cada parêntese do modelo.
      const pal: [number | null, number, number][] = [
        [r.paletes_pbr, 139, 167], [r.paletes_chep, 201, 229], [r.paletes_descartavel, 271, 299], [r.paletes_quebrados, 391, 419],
      ];
      for (const [v, xa, xb] of pal) if (v !== null && v !== undefined) centro(String(v), xa, xb, 404.5);

      if (r.tem_ocorrencia) xis(287.7, 303.3, 432);
      else xis(393.4, 408.9, 432);
      if (r.lanc_kpi) xis(41.3, 53.8, 804);
      if (r.lanc_controle_paletes) xis(86.5, 102, 804);
      if (r.lanc_email) xis(227.8, 243.4, 804);

      const assina = async (dataUrl: string | null, x0: number, x1: number) => {
        if (!dataUrl) return;
        try {
          const img = dataUrl.includes("image/jpeg") ? await saida.embedJpg(dataUrl) : await saida.embedPng(dataUrl);
          const maxW = x1 - x0 - 10;
          const maxH = 44;
          const e = Math.min(maxW / img.width, maxH / img.height);
          pagina.drawImage(img, { x: (x0 + x1) / 2 - (img.width * e) / 2, y: y(753.4) + 1, width: img.width * e, height: img.height * e });
        } catch (e) {
          console.error("assinatura", e);
        }
      };
      await assina(r.assinatura_conferente, 34.9, 206.6);
      await assina(r.assinatura_motorista, 361.4, 560.6);
      if (r.conferente) centro(r.conferente, 34.9, 206.6, 778.5, 7);
      if (r.motorista) centro(r.motorista, 361.4, 560.6, 778.5, 7);
    }

    // Tabela de ocorrências desta página.
    oc.slice(pg * LINHAS_POR_PAGINA, (pg + 1) * LINHAS_POR_PAGINA).forEach((o, i) => {
      const topoLinha = LINHAS_TOPO + ALTURA_LINHA * (i + 1);
      [o.codigo, o.produto, o.quant, o.nota, o.motivo].forEach((c, j) => {
        const t = String(c ?? "");
        if (t) texto(t, COLUNAS[j]!, COLUNAS[j + 1]!, topoLinha, 9, fonte, 4.5);
      });
    });
  }
  return saida.save();
}

/** Gera o PDF e abre numa nova aba (já no visualizador, pronto para imprimir). */
export async function abrirFolhaPdf(r: Registro): Promise<void> {
  const bytes = await gerarFolhaPdf(r);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const w = window.open(url, "_blank");
  if (!w) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `controle-recebimento-${r.data_chegada}.pdf`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
