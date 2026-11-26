import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileStack, Loader2, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { baixar } from "@/lib/expedicao/exportar";
import { chavesDuplicadas, conferirConjunto, notaOrdem, ordenarPaginas, situacao, type PaginaCte, type Situacao, type TipoPagina } from "@/lib/cte/ordenar";

export const Route = createFileRoute("/_authenticated/cte")({
  head: () => ({
    meta: [
      { title: "Organizar CTe — Expedição CDLog" },
      { name: "description", content: "Junte os PDFs de CTe em um único arquivo ordenado pelo número da NF-e, direto no navegador." },
      { property: "og:title", content: "Organizar CTe — Expedição CDLog" },
      { property: "og:description", content: "CTe ordenados pela nota fiscal, sem enviar arquivos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrganizarCte,
});

const ESTILO: Record<Situacao, string> = {
  OK: "bg-success/15 text-success",
  "Várias notas": "bg-accent text-accent-foreground",
  "Não identificada": "bg-destructive-soft text-destructive",
  Duplicada: "bg-warning-soft text-warning-foreground",
};

function Indicador({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={cn("card-surface p-4", destaque && "border-warning/60 bg-warning-soft")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="tabular mt-1 text-2xl font-medium text-foreground">{valor}</p>
    </div>
  );
}

const NOME_TIPO: Record<TipoPagina, string> = { cte: "CTe", nfe: "NF-e", boleto: "Boleto", outro: "Não reconhecida" };

function ZonaPdf({
  titulo, dica, arquivos, onAdicionar, onRemover,
}: {
  titulo: string; dica: string; arquivos: File[];
  onAdicionar: (l: FileList | null) => void; onRemover: (i: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={titulo}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => { e.preventDefault(); setArrastando(false); onAdicionar(e.dataTransfer.files); }}
      className={cn(
        "mt-4 flex min-h-28 cursor-pointer flex-col justify-center gap-3 rounded-lg border-2 border-dashed bg-card p-5 transition-colors",
        arrastando ? "border-primary bg-accent" : "border-input hover:border-primary/60",
      )}
    >
      <input ref={input} type="file" accept=".pdf,application/pdf" multiple className="hidden"
        onChange={(e) => { onAdicionar(e.target.files); e.target.value = ""; }} />
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground"><FileStack className="size-5" /></div>
        <div>
          <p className="font-semibold text-foreground">{titulo}</p>
          <p className="text-sm text-muted-foreground">{dica}</p>
        </div>
      </div>
      {arquivos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {arquivos.map((f, i) => (
            <li key={i} className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm text-primary">
              <span className="tabular max-w-60 truncate">{f.name}</span>
              <button type="button" aria-label="Remover arquivo" className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); onRemover(i); }}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrganizarCte() {
  const [ctes, setCtes] = useState<File[]>([]);
  const [apoio, setApoio] = useState<File[]>([]);
  const arquivos = useMemo(() => [...ctes, ...apoio], [ctes, apoio]);
  const [paginas, setPaginas] = useState<PaginaCte[] | null>(null);
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function adicionar(set: React.Dispatch<React.SetStateAction<File[]>>, lista: FileList | null) {
    if (!lista) return;
    const novos = [...lista].filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (novos.length < lista.length) setErro("Só arquivos PDF são aceitos.");
    else setErro(null);
    set((a) => [...a, ...novos]);
    setPaginas(null);
  }

  async function analisar() {
    setErro(null);
    setPaginas(null);
    try {
      const { lerCtes } = await import("@/lib/cte/pdf");
      setPaginas(await lerCtes(arquivos, (atual, total) => setProgresso({ atual, total }), ctes.length));
    } catch (e) {
      console.error(e);
      setErro("Não foi possível ler os PDFs. Confira se os arquivos estão corretos.");
    } finally {
      setProgresso(null);
    }
  }

  const ordem = useMemo(() => (paginas ? ordenarPaginas(paginas) : []), [paginas]);
  const dup = useMemo(() => chavesDuplicadas(ordem), [ordem]);
  const avisosConjunto = useMemo(() => conferirConjunto(ordem), [ordem]);
  const cont = useMemo(() => {
    const s = ordem.map((p) => situacao(p, dup));
    return {
      identificadas: ordem.filter((p) => notaOrdem(p) !== null && p.tipo !== "outro").length,
      varias: ordem.filter((p) => p.notas.length > 1).length,
      nao: s.filter((x) => x === "Não identificada").length,
    };
  }, [ordem, dup]);

  function definirManual(p: PaginaCte, v: string) {
    const n = v === "" ? null : parseInt(v, 10);
    setPaginas((ps) => ps!.map((x) => (x === p ? { ...x, manual: Number.isFinite(n) ? n : null } : x)));
  }

  async function baixarPdf() {
    setGerando(true);
    try {
      const { gerarPdfOrdenado } = await import("@/lib/cte/pdf");
      baixar(await gerarPdfOrdenado(arquivos, ordem), apoio.length > 0 ? "Documentos_organizados_por_nota.pdf" : "CTEs_organizados_por_nota.pdf", "application/pdf");
    } catch (e) {
      console.error(e);
      setErro("Não foi possível gerar o PDF ordenado.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Organizar CTe</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Envie os PDFs de CTe — e, se quiser, as NF-e e os boletos — e receba um único PDF em ordem crescente pelo número da nota: CTe, NF-e e boletos de cada nota, prontos para imprimir.
      </p>

      <ZonaPdf
        titulo="PDFs de CTe (DACTE)"
        dica="Arraste um ou mais PDFs aqui ou clique para escolher"
        arquivos={ctes}
        onAdicionar={(l) => adicionar(setCtes, l)}
        onRemover={(i) => { setCtes((a) => a.filter((_, j) => j !== i)); setPaginas(null); }}
      />
      <ZonaPdf
        titulo="NF-e (DANFE) e boletos — opcional"
        dica="Pode ser um PDF com nota e boletos juntos, ou PDFs separados. Cada nota entra depois do seu CTe, seguida dos boletos 1, 2, 3…"
        arquivos={apoio}
        onAdicionar={(l) => adicionar(setApoio, l)}
        onRemover={(i) => { setApoio((a) => a.filter((_, j) => j !== i)); setPaginas(null); }}
      />

      {erro && <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">{erro}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button size="lg" disabled={ctes.length === 0 || !!progresso} onClick={analisar}>
          {progresso && <Loader2 className="animate-spin" />} Analisar e ordenar
        </Button>
        {paginas && (
          <Button size="lg" variant="outline" disabled={gerando || ordem.length === 0} onClick={baixarPdf}>
            {gerando ? <Loader2 className="animate-spin" /> : <Download />} Baixar PDF ordenado
          </Button>
        )}
      </div>

      {progresso && (
        <div className="mt-4 max-w-md">
          <Progress value={(progresso.atual / progresso.total) * 100} />
          <p className="tabular mt-2 text-sm text-muted-foreground">Lendo página {progresso.atual} de {progresso.total}</p>
        </div>
      )}

      {paginas && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Indicador rotulo="Total de páginas" valor={ordem.length} />
            <Indicador rotulo="Identificadas" valor={cont.identificadas} />
            <Indicador rotulo="Com várias notas" valor={cont.varias} />
            <Indicador rotulo="Não identificadas" valor={cont.nao} destaque={cont.nao > 0} />
          </div>
          {avisosConjunto.length > 0 && (
            <div role="status" className="mt-6 rounded-md border border-warning/60 bg-warning-soft px-4 py-3 text-sm text-warning-foreground">
              <p className="font-medium">Confira antes de imprimir:</p>
              <ul className="mt-1 list-disc pl-5">{avisosConjunto.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
          )}
          <div className="card-surface mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>{["#", "Tipo", "Arquivo", "Pág.", "Notas", "Parcela", "Série", "Situação", "Nota manual"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {ordem.map((p, i) => {
                  const s = situacao(p, dup);
                  return (
                    <tr key={`${p.arquivo}-${p.pagina}`} className="border-t">
                      <td className="tabular px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2">{NOME_TIPO[p.tipo]}</td>
                      <td className="max-w-48 truncate px-3 py-2" title={p.nomeArquivo}>{p.nomeArquivo}</td>
                      <td className="tabular px-3 py-2">{p.pagina}</td>
                      <td className="tabular px-3 py-2">{p.notas.join(", ") || "–"}</td>
                      <td className="tabular px-3 py-2">{p.parcela ? `${p.parcela.n}/${p.parcela.total}` : "–"}</td>
                      <td className="tabular px-3 py-2">{p.series.join(", ") || "–"}</td>
                      <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ESTILO[s])}>{s}</span></td>
                      <td className="px-3 py-2">
                        {p.notas.length === 0 && (
                          <Input type="number" inputMode="numeric" aria-label={`Nota manual da página ${p.pagina}`} className="h-8 w-32"
                            defaultValue={p.manual ?? ""} onBlur={(e) => definirManual(p, e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && definirManual(p, e.currentTarget.value)} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
