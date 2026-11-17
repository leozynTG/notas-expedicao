import { cn } from "@/lib/utils";
import { brl, qtd } from "@/lib/formato";
import type { LinhaPlanilha } from "@/lib/expedicao/exportar";

const COLUNAS = ["NF", "Pedido", "Nº picking", "Tipo", "Destinatário", "Cidade/UF", "Valor", "Vol.", "CX", "FD", "UN", "Frac."];

export function TabelaNotas({ linhas, destaque }: { linhas: LinhaPlanilha[]; destaque?: string }) {
  const termo = destaque?.trim().toLowerCase() ?? "";
  const bate = (n: LinhaPlanilha) =>
    termo.length > 0 &&
    [n.nfTexto, n.pedido, n.destinatario].some((v) => v.toLowerCase().includes(termo));

  return (
    <div className="card-surface overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-primary text-primary-foreground">
          <tr>
            {COLUNAS.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((n, i) => (
            <tr key={`${n.chave}-${i}`} className={cn("border-t", bate(n) && "bg-accent")}>
              <td className="tabular px-3 py-2">{n.nfTexto}</td>
              <td className="tabular px-3 py-2">{n.pedido || <span className="text-destructive">—</span>}</td>
              <td className="tabular px-3 py-2">{n.numeroPicking}</td>
              <td className="px-3 py-2" title={n.natOp}>
                {n.tipo}
              </td>
              <td className="max-w-56 truncate px-3 py-2" title={n.destinatario}>
                {n.destinatario}
              </td>
              <td className="whitespace-nowrap px-3 py-2">{n.cidadeUf}</td>
              <td className="tabular whitespace-nowrap px-3 py-2 text-right">{brl(n.valor)}</td>
              <td className="tabular px-3 py-2 text-right">{n.volumes ?? ""}</td>
              {[n.qtdCx, n.qtdFd, n.qtdUn].map((v, j) => (
                <td key={j} className={cn("tabular px-3 py-2 text-right", n.fracionado && "bg-warning-soft")}>
                  {qtd(v)}
                </td>
              ))}
              <td className="px-3 py-2">{n.fracionado ? "Sim" : "Não"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
