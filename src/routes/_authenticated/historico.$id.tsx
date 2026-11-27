import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileSpreadsheet, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AppShell } from "@/components/app/AppShell";
import { TabelaNotas } from "@/components/expedicao/TabelaNotas";
import { excluirCarga } from "@/lib/api.functions";
import { cargaQuery } from "@/lib/historico-queries";
import { linhasDoHistorico } from "@/lib/expedicao/historico";
import { brl, dataHora, kg } from "@/lib/formato";
import { cn } from "@/lib/utils";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const Route = createFileRoute("/_authenticated/historico/$id")({
  validateSearch: (s: Record<string, unknown>): { q?: string } =>
    typeof s["q"] === "string" && s["q"] ? { q: s["q"] } : {},
  loader: ({ context, params }) => context.queryClient.ensureQueryData(cargaQuery(params.id)),
  head: ({ loaderData }) => {
    const titulo = loaderData ? `Carga ${loaderData.carga.numero_carga} — Expedição CDLog` : "Carga — Expedição CDLog";
    return {
      meta: [
        { title: titulo },
        { name: "description", content: "Notas da carga, quem processou e quando, com download da planilha." },
        { property: "og:title", content: titulo },
        { property: "og:description", content: "Detalhes de uma carga processada." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  pendingComponent: () => (
    <AppShell>
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    </AppShell>
  ),
  component: DetalheCarga,
});

function Indicador({ rotulo, valor, destaque }: { rotulo: string; valor: number | string; destaque?: boolean }) {
  return (
    <div className={cn("card-surface p-4", destaque && "border-warning/60 bg-warning-soft")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={cn("tabular mt-1 text-2xl font-medium", destaque ? "text-warning-foreground" : "text-foreground")}>
        {valor}
      </p>
    </div>
  );
}

function DetalheCarga() {
  const { id } = Route.useParams();
  const { q } = Route.useSearch();
  const { data } = useSuspenseQuery(cargaQuery(id));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [baixando, setBaixando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const linhas = useMemo(() => (data ? linhasDoHistorico(data.notas) : []), [data]);

  if (!data) {
    return (
      <AppShell>
        <div className="card-surface mx-auto max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">Carga não encontrada</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ela pode ter sido excluída.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/historico">Voltar ao histórico</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const { carga } = data;
  const valorTotal = linhas.reduce((s, n) => s + n.valor, 0);

  async function baixarPlanilha() {
    setBaixando(true);
    try {
      const [{ gerarPlanilha, baixar }] = await Promise.all([import("@/lib/expedicao/exportar")]);
      const bytes = await gerarPlanilha(linhas);
      baixar(bytes, `notas_carga_${carga.numero_carga}.xlsx`, XLSX_MIME);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar a planilha.");
    } finally {
      setBaixando(false);
    }
  }

  async function excluir() {
    setExcluindo(true);
    let falhou = false;
    try {
      await excluirCarga({ data: { id: carga.id } });
    } catch (e) {
      console.error(e);
      falhou = true;
    }
    setExcluindo(false);
    if (falhou) {
      toast.error("Não foi possível excluir a carga.");
      return;
    }
    toast.success(`Carga ${carga.numero_carga} excluída.`);
    queryClient.removeQueries({ queryKey: ["cargas", "detalhe", carga.id] });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cargas", "lista"] }),
      queryClient.invalidateQueries({ queryKey: ["cargas", "dashboard"] }),
    ]);
    navigate({ to: "/historico", replace: true });
  }

  const tipos = [
    ["Venda", carga.vendas],
    ["Troca", carga.trocas],
    ["Bonificação", carga.bonificacoes],
    ["Brinde", carga.brindes],
    ["Amostra", carga.amostras],
    ["Outras", carga.outras],
  ] as const;

  return (
    <AppShell>
      <Link
        to="/historico"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Histórico
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Carga <span className="tabular">{carga.numero_carga}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Processada por <span className="text-foreground">{carga.processada_por_email || "usuário removido"}</span>{" "}
            em <span className="tabular text-foreground">{dataHora(carga.processada_em)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="download" onClick={baixarPlanilha} disabled={baixando}>
            {baixando ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Baixar planilha
            <Download />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir a carga {carga.numero_carga}?</AlertDialogTitle>
                <AlertDialogDescription>
                  A carga e as {carga.total_notas} nota(s) dela serão apagadas do histórico. Isso não pode ser desfeito.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={excluir}
                  disabled={excluindo}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir carga
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Indicador rotulo="Notas" valor={carga.total_notas} />
        <Indicador rotulo="Fracionadas" valor={carga.notas_fracionadas} destaque={carga.notas_fracionadas > 0} />
        <Indicador rotulo="Sem volume no XML" valor={carga.notas_sem_volume} destaque={carga.notas_sem_volume > 0} />
        <Indicador rotulo="Valor total" valor={brl(valorTotal)} />
        <Indicador rotulo="Peso bruto" valor={kg(carga.peso_bruto_total_kg)} />
        <Indicador rotulo="Peso líquido" valor={kg(carga.peso_liquido_total_kg)} />
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        {tipos
          .filter(([, v]) => v > 0)
          .map(([t, v]) => (
            <span key={t} className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
              {t}
              <span className="tabular font-medium text-primary">{v}</span>
            </span>
          ))}
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Notas <span className="font-normal text-muted-foreground">({linhas.length})</span>
          {q && <span className="ml-2 font-normal text-muted-foreground">— destacando "{q}"</span>}
        </h2>
        <TabelaNotas linhas={linhas} destaque={q ?? ""} />
      </section>
    </AppShell>
  );
}
