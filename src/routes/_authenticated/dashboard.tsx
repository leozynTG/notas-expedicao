import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Loader2, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { AppShell } from "@/components/app/AppShell";
import { dashboardQuery } from "@/lib/historico-queries";
import {
  intervaloPeriodo,
  seriePorCarga,
  topCidades,
  totais,
  type CargaDash,
  type CidadeDash,
  type CriterioCidade,
  type Totais,
} from "@/lib/expedicao/dashboard";
import { brl, dataHora, numBr, pct, toneladas } from "@/lib/formato";
import { cn } from "@/lib/utils";

type Busca = { de?: string; ate?: string; carga?: string };
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (s: Record<string, unknown>): Busca => {
    const r: Busca = {};
    if (typeof s["de"] === "string" && DATA.test(s["de"])) r.de = s["de"];
    if (typeof s["ate"] === "string" && DATA.test(s["ate"])) r.ate = s["ate"];
    if (typeof s["carga"] === "string" && s["carga"]) r.carga = s["carga"];
    return r;
  },
  head: () => ({
    meta: [
      { title: "Dashboard — Expedição CDLog" },
      {
        name: "description",
        content: "Totais acumulados das cargas: valor, peso, volumes, trocas e cidades, com filtro por período.",
      },
      { property: "og:title", content: "Dashboard — Expedição CDLog" },
      { property: "og:description", content: "Visão geral das cargas processadas pela expedição." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Cartao({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string | undefined;
  destaque?: boolean;
}) {
  return (
    <div className={cn("card-surface p-4", destaque && "border-warning/60 bg-warning-soft")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="tabular mt-1 text-2xl font-medium text-foreground">{valor}</p>
      {detalhe && <p className="tabular mt-0.5 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

const kgTxt = (v: number) => `${numBr(v, v >= 100 ? 0 : 2)} kg`;
const media = (v: number | null, casas = 1) => (v === null ? "–" : numBr(v, casas));

function Cartoes({ t }: { t: Totais }) {
  const semPeso = Math.max(t.notasSemPesoBruto, t.notasSemPesoLiquido);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao rotulo="Cargas" valor={numBr(t.cargas)} detalhe={`${numBr(t.notas)} notas no total`} />
        <Cartao rotulo="Média de notas por carga" valor={media(t.mediaNotasPorCarga)} />
        <Cartao
          rotulo="Valor total"
          valor={brl(t.valor)}
          detalhe={t.ticketMedio === null ? undefined : `Ticket médio ${brl(t.ticketMedio)} por nota`}
        />
        <Cartao
          rotulo="Volumes"
          valor={numBr(t.volumes)}
          detalhe={`Média de ${media(t.mediaVolumesPorCarga)} por carga`}
        />
        <Cartao rotulo="Peso bruto" valor={kgTxt(t.pesoBruto)} detalhe={toneladas(t.pesoBruto)} />
        <Cartao rotulo="Peso líquido" valor={kgTxt(t.pesoLiquido)} detalhe={toneladas(t.pesoLiquido)} />
        <Cartao
          rotulo="Notas de troca"
          valor={numBr(t.trocas)}
          detalhe={`${pct(t.pctTrocas)} das notas`}
        />
        <Cartao
          rotulo="Valor das trocas"
          valor={brl(t.valorTrocas)}
          detalhe={`${pct(t.pctValorTrocas)} do valor total`}
        />
      </div>
      {semPeso > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-warning/60 bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t.notasSemPesoBruto === t.notasSemPesoLiquido
            ? `${numBr(semPeso)} nota(s) sem peso no XML ficaram de fora dos totais de peso.`
            : `Ficaram de fora dos totais de peso: ${numBr(t.notasSemPesoBruto)} nota(s) sem peso bruto e ${numBr(t.notasSemPesoLiquido)} sem peso líquido.`}
        </p>
      )}
    </>
  );
}

const cfgPeso = { pesoBruto: { label: "Peso bruto (kg)", color: "var(--chart-1)" } } satisfies ChartConfig;
const cfgTroca = { taxaTroca: { label: "Taxa de troca (%)", color: "var(--chart-5)" } } satisfies ChartConfig;
const cfgCidade = {
  valor: { label: "Valor (R$)", color: "var(--chart-2)" },
  notas: { label: "Notas", color: "var(--chart-2)" },
} satisfies ChartConfig;

function Grafico({ titulo, sub, children, acao }: { titulo: string; sub?: string; children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="card-surface p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        {acao}
      </div>
      {children}
    </div>
  );
}

function Graficos({ cargas, cidades }: { cargas: CargaDash[]; cidades: CidadeDash[] }) {
  const [criterio, setCriterio] = useState<CriterioCidade>("valor");
  const serie = useMemo(() => seriePorCarga(cargas), [cargas]);
  const top = useMemo(() => topCidades(cidades, criterio), [cidades, criterio]);
  const rotuloCarga = (carga: string) => {
    const p = serie.find((s) => s.carga === carga);
    return p ? `Carga ${carga} · ${dataHora(p.processadaEm)}` : `Carga ${carga}`;
  };

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Grafico titulo="Peso bruto por carga" sub="Em kg, da mais antiga para a mais recente">
        <ChartContainer config={cfgPeso} className="aspect-auto h-64 w-full">
          <BarChart data={serie} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="carga" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
            <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => numBr(v)} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(l) => rotuloCarga(String(l))}
                  formatter={(v) => (v === null || v === undefined ? "sem peso" : kgTxt(Number(v)))}
                />
              }
            />
            <Bar dataKey="pesoBruto" fill="var(--color-pesoBruto)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </Grafico>

      <Grafico titulo="Taxa de troca por carga" sub="% das notas da carga que são troca">
        <ChartContainer config={cfgTroca} className="aspect-auto h-64 w-full">
          <LineChart data={serie} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="carga" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `${numBr(v)}%`} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(l) => rotuloCarga(String(l))}
                  formatter={(v) => pct(Number(v))}
                />
              }
            />
            <Line dataKey="taxaTroca" stroke="var(--color-taxaTroca)" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
          </LineChart>
        </ChartContainer>
      </Grafico>

      <div className="lg:col-span-2">
        <Grafico
          titulo="Top 10 cidades"
          sub={criterio === "valor" ? "Por valor das notas" : "Por quantidade de notas"}
          acao={
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={criterio}
              onValueChange={(v) => v && setCriterio(v as CriterioCidade)}
              aria-label="Ordenar cidades por"
            >
              <ToggleGroupItem value="valor">Valor</ToggleGroupItem>
              <ToggleGroupItem value="notas">Nº de notas</ToggleGroupItem>
            </ToggleGroup>
          }
        >
          {top.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem notas no período.</p>
          ) : (
            <ChartContainer config={cfgCidade} className="aspect-auto w-full" style={{ height: 36 + top.length * 30 }}>
              <BarChart data={top} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} />
                <XAxis
                  type="number"
                  dataKey={criterio}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (criterio === "valor" ? `R$ ${v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })}` : numBr(v))}
                />
                <YAxis type="category" dataKey="cidade" tickLine={false} axisLine={false} width={170} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(v) => (criterio === "valor" ? brl(Number(v)) : `${numBr(Number(v))} notas`)}
                    />
                  }
                />
                <Bar dataKey={criterio} fill={`var(--color-${criterio})`} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </Grafico>
      </div>
    </div>
  );
}

function Dashboard() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const periodo = intervaloPeriodo(busca.de, busca.ate);
  const { data, isLoading, isFetching, error } = useQuery({
    ...dashboardQuery(periodo.de, periodo.ate),
    placeholderData: keepPreviousData,
  });

  const cargas = data?.cargas ?? [];
  const cidades = data?.cidades ?? [];
  const geral = useMemo(() => totais(cargas), [cargas]);
  const recentes = useMemo(() => [...cargas].reverse(), [cargas]);
  const selecionada = cargas.find((c) => c.id === busca.carga) ?? recentes[0] ?? null;
  const daCarga = useMemo(() => (selecionada ? totais([selecionada]) : null), [selecionada]);
  const cidadesDaCarga = useMemo(
    () => (selecionada ? topCidades(cidades, "valor", 5, new Set([selecionada.id])) : []),
    [cidades, selecionada],
  );

  const setBusca = (p: { [K in keyof Busca]?: Busca[K] | undefined }) =>
    navigate({
      search: (s) => {
        const novo: Record<string, string | undefined> = { ...s, ...p };
        return Object.fromEntries(Object.entries(novo).filter(([, v]) => v)) as Busca;
      },
      replace: true,
    });

  const textoPeriodo =
    busca.de && busca.ate
      ? `de ${fmtDia(busca.de)} a ${fmtDia(busca.ate)}`
      : busca.de
        ? `a partir de ${fmtDia(busca.de)}`
        : busca.ate
          ? `até ${fmtDia(busca.ate)}`
          : "todo o período";

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cargas salvas no histórico, {textoPeriodo}.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="de" className="text-xs">De</Label>
            <Input
              id="de"
              type="date"
              className="w-40"
              value={busca.de ?? ""}
              max={busca.ate}
              onChange={(e) => setBusca({ de: e.target.value || undefined, carga: undefined })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ate" className="text-xs">Até</Label>
            <Input
              id="ate"
              type="date"
              className="w-40"
              value={busca.ate ?? ""}
              min={busca.de}
              onChange={(e) => setBusca({ ate: e.target.value || undefined, carga: undefined })}
            />
          </div>
          {(busca.de || busca.ate) && (
            <Button variant="ghost" size="sm" onClick={() => setBusca({ de: undefined, ate: undefined, carga: undefined })}>
              <X /> Limpar período
            </Button>
          )}
          {isFetching && !isLoading && <Loader2 className="mb-2.5 size-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="mt-6 rounded-md border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          Não foi possível carregar o dashboard. Recarregue a página.
        </p>
      ) : cargas.length === 0 ? (
        <p className="card-surface mt-6 px-5 py-10 text-center text-sm text-muted-foreground">
          {busca.de || busca.ate
            ? "Nenhuma carga salva nesse período."
            : "Nenhuma carga salva ainda. Processe uma carga e salve no histórico."}
        </p>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              Geral <span className="font-normal text-muted-foreground">(todas as cargas)</span>
            </h2>
            <Cartoes t={geral} />
            <Graficos cargas={cargas} cidades={cidades} />
          </section>

          {selecionada && daCarga && (
            <section className="mt-12 border-t pt-8">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Por carga</h2>
                  <p className="text-sm text-muted-foreground">
                    Processada em <span className="tabular">{dataHora(selecionada.processada_em)}</span> ·{" "}
                    <Link
                      to="/historico/$id"
                      params={{ id: selecionada.id }}
                      className="inline-flex items-center text-primary hover:underline"
                    >
                      abrir no histórico <ChevronRight className="size-3.5" />
                    </Link>
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Carga</Label>
                  <Select value={selecionada.id} onValueChange={(v) => setBusca({ carga: v })}>
                    <SelectTrigger className="w-56" aria-label="Escolher carga">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {recentes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          Carga {c.numero_carga}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Cartoes t={daCarga} />
              {cidadesDaCarga.length > 0 && (
                <div className="card-surface mt-4 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Principais cidades da carga</h3>
                  <ul className="divide-y text-sm">
                    {cidadesDaCarga.map((c) => (
                      <li key={c.cidade} className="flex justify-between gap-4 py-1.5">
                        <span>{c.cidade}</span>
                        <span className="tabular text-muted-foreground">
                          {numBr(c.notas)} nota(s) · <span className="text-foreground">{brl(c.valor)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}

function fmtDia(d: string) {
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}
