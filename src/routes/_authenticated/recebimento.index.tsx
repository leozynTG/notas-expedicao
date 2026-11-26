import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileSpreadsheet, Loader2, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/app/AppShell";
import { recebimentosQuery } from "@/lib/recebimento/consultas";
import { FILTROS_VAZIOS, duracaoLinha, filtrar, resumoLista, temDivergencia, type Filtros } from "@/lib/recebimento/lista";
import { dataBr } from "@/lib/recebimento/dados";
import { escreverNumBr, formatarDuracao } from "@/lib/recebimento/regras";
import { baixar } from "@/lib/expedicao/exportar";
import { brl } from "@/lib/formato";
import { cn } from "@/lib/utils";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const Route = createFileRoute("/_authenticated/recebimento/")({
  head: () => ({
    meta: [
      { title: "Recebimento — Expedição CDLog" },
      { name: "description", content: "Controle de recebimento de cargas, com filtros, resumo e planilha." },
      { property: "og:title", content: "Recebimento — Expedição CDLog" },
      { property: "og:description", content: "Recebimentos registrados pela equipe de expedição." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ListaRecebimentos,
});

function Indicador({ rotulo, valor, destaque }: { rotulo: string; valor: string | number; destaque?: boolean }) {
  return (
    <div className={cn("card-surface p-4", destaque && "border-warning/60 bg-warning-soft")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="tabular mt-1 text-2xl font-medium text-foreground">{valor}</p>
    </div>
  );
}

function ListaRecebimentos() {
  const { data, isLoading, error } = useQuery(recebimentosQuery);
  const [f, setF] = useState<Filtros>(FILTROS_VAZIOS);
  const [gerando, setGerando] = useState(false);
  const lista = useMemo(() => filtrar(data ?? [], f), [data, f]);
  const res = useMemo(() => resumoLista(lista), [lista]);
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setF((x) => ({ ...x, [k]: v }));

  async function exportar() {
    setGerando(true);
    try {
      const { planilhaRecebimentos } = await import("@/lib/recebimento/planilha");
      baixar(await planilhaRecebimentos(lista), "recebimentos.xlsx", XLSX_MIME);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar a planilha.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Recebimento</h1>
          <p className="mt-1 text-sm text-muted-foreground">Controle de recebimento de cargas, do mais recente para o mais antigo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportar} disabled={gerando || lista.length === 0}>
            {gerando ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Exportar planilha
          </Button>
          <Button asChild>
            <Link to="/recebimento/novo"><Plus /> Novo recebimento</Link>
          </Button>
        </div>
      </div>

      <div className="card-surface mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5"><Label htmlFor="de">Chegada de</Label><Input id="de" type="date" value={f.de} onChange={(e) => set("de", e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="ate">até</Label><Input id="ate" type="date" value={f.ate} onChange={(e) => set("ate", e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="cli">Cliente</Label><Input id="cli" value={f.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Parte do nome" /></div>
        <div className="space-y-1.5"><Label htmlFor="tr">Transportadora</Label><Input id="tr" value={f.transportadora} onChange={(e) => set("transportadora", e.target.value)} placeholder="Parte do nome" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="oc">Ocorrências</Label>
          <select id="oc" value={f.ocorrencia} onChange={(e) => set("ocorrencia", e.target.value as Filtros["ocorrencia"])}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="todas">Todas</option>
            <option value="com">Com ocorrências</option>
            <option value="sem">Sem ocorrências</option>
          </select>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Indicador rotulo="Recebimentos" valor={res.total} />
        <Indicador rotulo="Volumes" valor={escreverNumBr(res.volumes)} />
        <Indicador rotulo="Peso (kg)" valor={escreverNumBr(res.peso, 1)} />
        <Indicador rotulo="Valor" valor={brl(res.valor)} />
        <Indicador rotulo="Paletes" valor={escreverNumBr(res.paletes)} />
        <Indicador rotulo="Com divergência" valor={res.comDivergencia} destaque={res.comDivergencia > 0} />
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
            Não foi possível carregar os recebimentos. Recarregue a página.
          </p>
        ) : lista.length === 0 ? (
          <p className="card-surface px-5 py-10 text-center text-sm text-muted-foreground">
            {data && data.length > 0 ? "Nenhum recebimento com esses filtros." : "Nenhum recebimento registrado ainda."}
          </p>
        ) : (
          <div className="card-surface overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Chegada", "Cliente", "Origem", "Motorista", "Transportadora", "Placa", "Vol.", "NF-e", "Peso (kg)", "Valor", "Paletes", "Ocorr.", "Descarga"].map((h, i) => (
                    <th key={h} className={cn("px-3 py-2.5 font-medium", [6, 7, 8, 9, 10].includes(i) && "text-right")}>{h}</th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => {
                  const n = Array.isArray(r.ocorrencias) ? r.ocorrencias.length : 0;
                  return (
                    <tr key={r.id} className="group relative border-t hover:bg-accent/60">
                      <td className="tabular px-3 py-3">
                        <Link to="/recebimento/$id" params={{ id: r.id }} className="font-medium text-primary after:absolute after:inset-0">
                          {dataBr(r.data_chegada)}
                        </Link>
                        <div className="text-xs text-muted-foreground">{r.hora_chegada ?? ""}</div>
                      </td>
                      <td className="max-w-48 truncate px-3 py-3" title={r.cliente}>{r.cliente}</td>
                      <td className="px-3 py-3">{r.origem}</td>
                      <td className="max-w-40 truncate px-3 py-3">{r.motorista}</td>
                      <td className="max-w-40 truncate px-3 py-3">{r.transportadora}</td>
                      <td className="tabular px-3 py-3">{r.placa}</td>
                      <td className="tabular px-3 py-3 text-right">{r.volumes}</td>
                      <td className="tabular px-3 py-3 text-right">{r.quant_nfe ?? ""}</td>
                      <td className="tabular px-3 py-3 text-right">{escreverNumBr(r.peso_kg, 1)}</td>
                      <td className="tabular px-3 py-3 text-right">{r.valor === null ? "" : brl(r.valor)}</td>
                      <td className="tabular px-3 py-3 text-right">{r.paletes_total ?? ""}</td>
                      <td className="px-3 py-3">
                        {r.tem_ocorrencia ? (
                          <span className="inline-flex items-center gap-1 rounded bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning-foreground">
                            <TriangleAlert className="size-3" /> Sim ({n})
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{temDivergencia(r) ? "Paletes" : "Não"}</span>
                        )}
                      </td>
                      <td className="tabular px-3 py-3">{formatarDuracao(duracaoLinha(r))}</td>
                      <td className="px-2 py-3 text-muted-foreground"><ChevronRight className="size-4" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
