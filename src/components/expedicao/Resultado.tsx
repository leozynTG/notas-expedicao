import { useMemo } from "react";
import { AlertTriangle, CircleAlert, Download, FileSpreadsheet, Info, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TIPOS } from "@/lib/expedicao/nfe";
import type { ResultadoCarga } from "@/lib/expedicao/processar";
import type { Aviso, NivelAviso } from "@/lib/expedicao/tipos";

export interface Arquivos {
  planilha: Uint8Array;
  trocas: Uint8Array;
  demais: Uint8Array;
}

interface Props {
  resultado: ResultadoCarga;
  onBaixar: (qual: keyof Arquivos) => void;
  onNova: () => void;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const qtd = (v: number) => (v === 0 ? "–" : v.toLocaleString("pt-BR", { maximumFractionDigits: 4 }));

const ORDEM: NivelAviso[] = ["erro", "alerta", "info"];
const ESTILO_NIVEL: Record<NivelAviso, { caixa: string; icone: typeof Info }> = {
  erro: { caixa: "border-destructive/30 bg-destructive-soft text-destructive", icone: CircleAlert },
  alerta: { caixa: "border-warning/50 bg-warning-soft text-warning-foreground", icone: AlertTriangle },
  info: { caixa: "border-border bg-secondary text-muted-foreground", icone: Info },
};

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

export function Resultado({ resultado, onBaixar, onNova }: Props) {
  const { resumo, notas, avisos } = resultado;

  const grupos = useMemo(() => {
    const m = new Map<string, { nivel: NivelAviso; itens: Aviso[] }>();
    for (const a of avisos) {
      const g = m.get(a.categoria) ?? { nivel: a.nivel, itens: [] };
      g.itens.push(a);
      m.set(a.categoria, g);
    }
    return Array.from(m.entries()).sort((a, b) => ORDEM.indexOf(a[1].nivel) - ORDEM.indexOf(b[1].nivel));
  }, [avisos]);

  const previa = notas.slice(0, 15);

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Indicador rotulo="XMLs lidos" valor={resumo.total} />
        <Indicador rotulo="Fracionadas" valor={resumo.fracionadas} destaque={resumo.fracionadas > 0} />
        <Indicador rotulo="Sem volume no XML" valor={resumo.semVolume} destaque={resumo.semVolume > 0} />
        <Indicador rotulo="Sem pedido" valor={resumo.semPedido} destaque={resumo.semPedido > 0} />
        <Indicador
          rotulo="Trocas sem picking"
          valor={resumo.trocasSemPicking}
          destaque={resumo.trocasSemPicking > 0}
        />
        <Indicador rotulo="Valor total" valor={brl(resumo.valorTotal)} />
      </section>

      <section className="card-surface p-5">
        <h2 className="text-sm font-semibold text-foreground">Notas por tipo</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {TIPOS.filter((t) => resumo.porTipo[t] > 0).map((t) => (
            <span key={t} className="inline-flex items-center gap-2 rounded-md border bg-secondary px-3 py-1.5 text-sm">
              {t}
              <span className="tabular font-medium text-primary">{resumo.porTipo[t]}</span>
            </span>
          ))}
        </div>
        {resultado.pickingEnviado && (
          <p className="mt-3 text-xs text-muted-foreground">
            {resultado.pickingsLidos} pedido(s) reconhecido(s) no mapa analítico.
          </p>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Button variant="download" size="tile" onClick={() => onBaixar("planilha")}>
          <FileSpreadsheet />
          <span className="flex flex-col items-start">
            <span>Planilha de notas</span>
            <span className="text-xs font-normal opacity-80">.xlsx · {resumo.total} linhas</span>
          </span>
          <Download className="ml-auto" />
        </Button>
        <Button
          variant="downloadOutline"
          size="tile"
          disabled={resumo.noZipTrocas === 0}
          onClick={() => onBaixar("trocas")}
        >
          <span className="flex flex-col items-start">
            <span>trocas_brindes_amostras.zip</span>
            <span className="text-xs font-normal text-muted-foreground">{resumo.noZipTrocas} XML(s)</span>
          </span>
          <Download className="ml-auto" />
        </Button>
        <Button
          variant="downloadOutline"
          size="tile"
          disabled={resumo.noZipDemais === 0}
          onClick={() => onBaixar("demais")}
        >
          <span className="flex flex-col items-start">
            <span>demais_notas.zip</span>
            <span className="text-xs font-normal text-muted-foreground">{resumo.noZipDemais} XML(s)</span>
          </span>
          <Download className="ml-auto" />
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Avisos {avisos.length > 0 && <span className="tabular text-muted-foreground">({avisos.length})</span>}
        </h2>
        {grupos.length === 0 ? (
          <p className="rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
            Nenhum aviso. Tudo conferido.
          </p>
        ) : (
          grupos.map(([categoria, g]) => {
            const { caixa, icone: Icone } = ESTILO_NIVEL[g.nivel];
            return (
              <details key={categoria} open={g.nivel !== "info"} className={cn("rounded-lg border px-4 py-3", caixa)}>
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                  <Icone className="size-4 shrink-0" />
                  {categoria}
                  <span className="tabular font-normal opacity-80">· {g.itens.length}</span>
                </summary>
                <ul className="mt-2 space-y-1 pl-6 text-sm text-foreground">
                  {g.itens.map((a, i) => (
                    <li key={i} className="list-disc">
                      {a.mensagem}
                    </li>
                  ))}
                </ul>
              </details>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Prévia <span className="font-normal text-muted-foreground">— primeiras {previa.length} de {notas.length} notas</span>
        </h2>
        <div className="card-surface overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                {["NF", "Pedido", "Nº troca", "Tipo", "Destinatário", "Cidade/UF", "Valor", "Vol.", "CX", "FD", "UN", "Frac."].map(
                  (h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {previa.map((n) => (
                <tr key={n.chave || n.arquivo} className="border-t">
                  <td className="tabular px-3 py-2">{n.nfTexto}</td>
                  <td className="tabular px-3 py-2">{n.pedido || <span className="text-destructive">—</span>}</td>
                  <td className="tabular px-3 py-2">{n.numeroTroca}</td>
                  <td className="px-3 py-2">{n.tipo}</td>
                  <td className="max-w-56 truncate px-3 py-2" title={n.destinatario}>
                    {n.destinatario}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{n.cidadeUf}</td>
                  <td className="tabular whitespace-nowrap px-3 py-2 text-right">{brl(n.valor)}</td>
                  <td className="tabular px-3 py-2 text-right">{n.volumes ?? ""}</td>
                  {[n.qtdCx, n.qtdFd, n.qtdUn].map((v, i) => (
                    <td key={i} className={cn("tabular px-3 py-2 text-right", n.fracionado && "bg-warning-soft")}>
                      {qtd(v)}
                    </td>
                  ))}
                  <td className="px-3 py-2">{n.fracionado ? "Sim" : "Não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex justify-center pb-4">
        <Button variant="outline" onClick={onNova}>
          <RotateCcw /> Processar outra carga
        </Button>
      </div>
    </div>
  );
}
