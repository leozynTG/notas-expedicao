import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileArchive, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/expedicao/DropZone";
import { Resultado, type Arquivos } from "@/components/expedicao/Resultado";
import { SalvarCarga } from "@/components/expedicao/SalvarCarga";
import { AppShell } from "@/components/app/AppShell";
import { processarCarga, type ResultadoCarga } from "@/lib/expedicao/processar";
import { baixar, gerarPlanilha, gerarZips } from "@/lib/expedicao/exportar";
import { lerPickingsPdf, lerPickingsTexto, type LeituraPickings } from "@/lib/expedicao/picking";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Expedição CDLog — Organizar XMLs da carga" },
      {
        name: "description",
        content:
          "Leia os XMLs de NF-e de uma carga, cruze as notas com os pickings e baixe a planilha e os ZIPs separados. Tudo no navegador.",
      },
      { property: "og:title", content: "Expedição CDLog" },
      {
        property: "og:description",
        content: "Planilha de notas e ZIPs separados por tipo, gerados direto no navegador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function Index() {
  const [zip, setZip] = useState<File | null>(null);
  const [mapa, setMapa] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);
  const [arquivos, setArquivos] = useState<Arquivos | null>(null);

  const base = zip ? zip.name.replace(/\.zip$/i, "") : "carga";

  async function processar() {
    if (!zip) return;
    setErro(null);
    setProcessando(true);
    try {
      let leitura: LeituraPickings | null = null;
      if (mapa) {
        if (mapa.name.toLowerCase().endsWith(".pdf")) {
          const { lerPaginasPdf } = await import("@/lib/expedicao/pdf-texto");
          leitura = lerPickingsPdf(await lerPaginasPdf(mapa));
        } else {
          leitura = lerPickingsTexto(await mapa.text());
        }
      }
      const r = await processarCarga(await zip.arrayBuffer(), leitura);
      const [planilha, zips] = await Promise.all([gerarPlanilha(r.notas), gerarZips(r.notas)]);
      setArquivos({ planilha, ...zips });
      setResultado(r);
    } catch (e) {
      console.error(e);
      setErro(
        e instanceof Error && e.message
          ? e.message
          : "Não foi possível ler os arquivos. Confira se o ZIP e o PDF estão corretos.",
      );
    } finally {
      setProcessando(false);
    }
  }

  function onBaixar(qual: keyof Arquivos) {
    if (!arquivos) return;
    if (qual === "planilha") baixar(arquivos.planilha, `notas_${base}.xlsx`, XLSX_MIME);
    if (qual === "trocas") baixar(arquivos.trocas, "trocas_brindes_amostras.zip", "application/zip");
    if (qual === "demais") baixar(arquivos.demais, "demais_notas.zip", "application/zip");
  }

  function nova() {
    setResultado(null);
    setArquivos(null);
    setZip(null);
    setMapa(null);
    setErro(null);
  }

  return (
    <AppShell>
        {resultado ? (
          <>
            <div className="mb-6 flex flex-wrap items-baseline gap-x-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Resumo da carga</h1>
              <span className="tabular text-sm text-muted-foreground">{zip?.name}</span>
            </div>
            <div className="mb-8">
              <SalvarCarga key={zip?.name} notas={resultado.notas} />
            </div>
            <Resultado resultado={resultado} onBaixar={onBaixar} onNova={nova} />
          </>
        ) : (
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Organizar XMLs da carga</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Envie o ZIP com as notas e, se tiver, o mapa analítico dos pedidos. Você recebe a planilha e os XMLs
              separados em dois ZIPs.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <DropZone
                titulo="1. ZIP com os XMLs"
                dica="Arraste o .zip aqui ou clique para escolher"
                aceita=".zip,application/zip"
                extensoes={[".zip"]}
                icone={<FileArchive />}
                arquivo={zip}
                onArquivo={setZip}
                onErro={setErro}
              />
              <DropZone
                titulo="2. Mapa analítico (pickings)"
                dica="PDF ou .txt da impressão dos pedidos"
                aceita=".pdf,.txt,application/pdf,text/plain"
                extensoes={[".pdf", ".txt"]}
                icone={<FileText />}
                arquivo={mapa}
                opcional
                onArquivo={setMapa}
                onErro={setErro}
              />
            </div>

            {erro && (
              <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
                {erro}
              </p>
            )}

            <div className="mt-6 flex items-center gap-4">
              <Button size="lg" disabled={!zip || processando} onClick={processar}>
                {processando && <Loader2 className="animate-spin" />}
                {processando ? "Processando…" : "Processar carga"}
              </Button>
              {!mapa && zip && (
                <span className="text-sm text-muted-foreground">
                  Sem o mapa, as notas ficam sem número de picking.
                </span>
              )}
            </div>
          </div>
        )}
    </AppShell>
  );
}
