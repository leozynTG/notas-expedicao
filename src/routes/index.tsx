import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileArchive, FileText, Loader2, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/expedicao/DropZone";
import { Resultado, type Arquivos } from "@/components/expedicao/Resultado";
import { processarCarga, type ResultadoCarga } from "@/lib/expedicao/processar";
import { baixar, gerarPlanilha, gerarZips } from "@/lib/expedicao/exportar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Expedição CDLog — Organizar XMLs da carga" },
      {
        name: "description",
        content:
          "Leia os XMLs de NF-e de uma carga, cruze as trocas com os pickings e baixe a planilha e os ZIPs separados. Tudo no navegador.",
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
      let textoMapa: string | null = null;
      if (mapa) {
        if (mapa.name.toLowerCase().endsWith(".pdf")) {
          const { extrairTextoPdf } = await import("@/lib/expedicao/pdf-texto");
          textoMapa = await extrairTextoPdf(mapa);
        } else {
          textoMapa = await mapa.text();
        }
      }
      const r = await processarCarga(await zip.arrayBuffer(), textoMapa);
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
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Truck className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground">Expedição CDLog</h1>
            <p className="text-xs text-muted-foreground">Conferência de notas da carga</p>
          </div>
          <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <ShieldCheck className="size-4 text-success" />
            Os arquivos não saem do seu computador
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        {resultado ? (
          <>
            <div className="mb-6 flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Resumo da carga</h2>
              <span className="tabular text-sm text-muted-foreground">{zip?.name}</span>
            </div>
            <Resultado resultado={resultado} onBaixar={onBaixar} onNova={nova} />
          </>
        ) : (
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Organizar XMLs da carga</h2>
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
                  Sem o mapa, as trocas ficam sem número de picking.
                </span>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
