import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/app/AppShell";
import { cargasQuery } from "@/lib/historico-queries";
import { dataHora } from "@/lib/formato";

export const Route = createFileRoute("/_authenticated/historico/")({
  head: () => ({
    meta: [
      { title: "Histórico de cargas — Expedição CDLog" },
      { name: "description", content: "Cargas processadas, com busca por número da carga, NF, pedido ou destinatário." },
      { property: "og:title", content: "Histórico de cargas — Expedição CDLog" },
      { property: "og:description", content: "Cargas processadas pela equipe de expedição." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Historico,
});

function Historico() {
  const [texto, setTexto] = useState("");
  const [termo, setTermo] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setTermo(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  const { data, isLoading, isFetching, error } = useQuery({ ...cargasQuery(termo), placeholderData: keepPreviousData });

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Histórico de cargas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Da mais recente para a mais antiga.</p>
        </div>
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Nº da carga, NF, pedido ou destinatário"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Buscar no histórico"
          />
          {isFetching && !isLoading && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
            Não foi possível carregar o histórico. Recarregue a página.
          </p>
        ) : !data || data.length === 0 ? (
          <p className="card-surface px-5 py-10 text-center text-sm text-muted-foreground">
            {termo ? `Nenhuma carga encontrada para "${termo}".` : "Nenhuma carga salva ainda. Processe uma carga e salve no histórico."}
          </p>
        ) : (
          <div className="card-surface overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Carga</th>
                  <th className="px-4 py-2.5 font-medium">Processada</th>
                  <th className="px-4 py-2.5 text-right font-medium">Notas</th>
                  <th className="px-4 py-2.5 font-medium">Por tipo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Frac.</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sem vol.</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {data.map((c) => {
                  const tipos = [
                    ["Venda", c.vendas],
                    ["Troca", c.trocas],
                    ["Bonif.", c.bonificacoes],
                    ["Brinde", c.brindes],
                    ["Amostra", c.amostras],
                    ["Outras", c.outras],
                  ].filter(([, v]) => Number(v) > 0);
                  return (
                    <tr key={c.id} className="group relative border-t hover:bg-accent/60">
                      <td className="px-4 py-3">
                        <Link
                          to="/historico/$id"
                          params={{ id: c.id }}
                          search={termo ? { q: termo } : {}}
                          className="tabular font-medium text-primary after:absolute after:inset-0"
                        >
                          {c.numero_carga}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="tabular text-foreground">{dataHora(c.processada_em)}</div>
                        <div className="max-w-52 truncate text-xs text-muted-foreground">
                          {c.processada_por_email || "usuário removido"}
                        </div>
                      </td>
                      <td className="tabular px-4 py-3 text-right">{c.total_notas}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {tipos.map(([t, v]) => (
                            <span key={t} className="rounded border bg-secondary px-1.5 py-0.5 text-xs">
                              {t} <span className="tabular font-medium text-primary">{v}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="tabular px-4 py-3 text-right">{c.notas_fracionadas}</td>
                      <td className="tabular px-4 py-3 text-right">{c.notas_sem_volume}</td>
                      <td className="px-2 py-3 text-muted-foreground">
                        <ChevronRight className="size-4" />
                      </td>
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
