import type { ReactNode } from "react";
import { dataBr, duracaoRegistro, type Registro } from "@/lib/recebimento/dados";
import { escreverNumBr, formatarDuracao, type Ocorrencia } from "@/lib/recebimento/regras";

function Linha({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-neutral-300 py-1.5">
      {itens.map(([r, v]) => (
        <div key={r} className="min-w-40 flex-1">
          <span className="text-[11px] uppercase tracking-wide text-neutral-500">{r}</span>
          <div className="min-h-5 text-sm font-medium text-neutral-900">{v || "—"}</div>
        </div>
      ))}
    </div>
  );
}

function Caixa({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-3 border-2 border-neutral-800 px-3 pb-2 pt-1">
      <h3 className="-mt-3 mb-1 w-fit bg-white px-2 text-xs font-bold uppercase text-neutral-700">{titulo}</h3>
      {children}
    </section>
  );
}

/** Layout da folha de papel "CONTROLE DE RECEBIMENTO" (tela e impressão A4). */
export function Folha({ r }: { r: Registro }) {
  const oc = (Array.isArray(r.ocorrencias) ? r.ocorrencias : []) as unknown as Ocorrencia[];
  const n = (v: number | null | undefined, c = 0) => (v === null || v === undefined ? "" : escreverNumBr(v, c));
  return (
    <div className="folha-print mx-auto max-w-[210mm] bg-white p-6 text-neutral-900">
      <div className="mb-4 flex items-end justify-between border-b-2 border-neutral-800 pb-2">
        <div>
          <p className="text-3xl font-black leading-none tracking-tight text-neutral-700">CDlog</p>
          <p className="text-[11px] italic text-neutral-500">Sua entrega sempre na frente</p>
        </div>
        <h2 className="text-xl font-black tracking-tight">CONTROLE DE RECEBIMENTO</h2>
      </div>

      <Linha itens={[["Data da chegada", dataBr(r.data_chegada)], ["Horário da chegada", r.hora_chegada]]} />

      <div className="mt-3" />
      <Caixa titulo="Descarga">
        <Linha itens={[["Hora início", r.hora_inicio], ["Hora final", r.hora_final], ["Duração", formatarDuracao(duracaoRegistro(r)) === "–" ? "" : formatarDuracao(duracaoRegistro(r))], ["Data da saída", dataBr(r.data_saida)]]} />
      </Caixa>
      <Caixa titulo="Embarcador">
        <Linha itens={[["Cliente", r.cliente], ["Origem", r.origem]]} />
      </Caixa>
      <Caixa titulo="Dados da carga">
        <Linha itens={[["Motorista", r.motorista], ["Transp.", r.transportadora]]} />
        <Linha itens={[["Veículo", r.veiculo], ["Placa", r.placa]]} />
        <Linha itens={[["Peso (kg)", n(r.peso_kg, 3)], ["Valor da carga (R$)", n(r.valor, 2)]]} />
        <Linha itens={[["Transporte", r.transporte], ["Cubagem (m³)", n(r.cubagem_m3, 3)]]} />
        <Linha itens={[["Volumes", n(r.volumes)], ["Quant. NF-e", n(r.quant_nfe)], ["Lacre", r.lacre]]} />
        <Linha itens={[["Total de paletes", n(r.paletes_total)], ["PBR", n(r.paletes_pbr)], ["CHEP", n(r.paletes_chep)], ["Descartável", n(r.paletes_descartavel)], ["Quebrados", n(r.paletes_quebrados)]]} />
      </Caixa>

      <p className="mb-1 text-sm font-bold">
        OCORRÊNCIAS / DIVERGÊNCIAS: <span className="ml-2">({r.tem_ocorrencia ? "X" : " "}) SIM</span>
        <span className="ml-4">({r.tem_ocorrencia ? " " : "X"}) NÃO</span>
      </p>
      <table className="mb-4 w-full border-2 border-neutral-800 text-sm">
        <thead>
          <tr className="border-b-2 border-neutral-800 text-left text-xs uppercase">
            {["Código", "Produto", "Quant", "Nota", "Motivo"].map((h) => <th key={h} className="border-r border-neutral-800 px-2 py-1 last:border-r-0">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.max(6, oc.length) }).map((_, i) => {
            const o = oc[i];
            return (
              <tr key={i} className="h-7 border-b border-neutral-400">
                {[o?.codigo, o?.produto, o?.quant, o?.nota, o?.motivo].map((c, j) => <td key={j} className="border-r border-neutral-400 px-2 last:border-r-0">{c}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-6 grid grid-cols-2 gap-10">
        {([["Conferente", r.assinatura_conferente, r.conferente], ["Motorista", r.assinatura_motorista, r.motorista]] as const).map(([rot, img, nome]) => (
          <div key={rot} className="text-center">
            <div className="flex h-20 items-end justify-center border-b border-neutral-800">
              {img && <img src={img} alt={`Assinatura ${rot}`} className="max-h-20" />}
            </div>
            <p className="mt-1 text-sm font-semibold">{rot}</p>
            <p className="text-xs text-neutral-600">{nome}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm">
        Lançamentos: ({r.lanc_kpi ? "X" : " "}) KPI &nbsp; ({r.lanc_controle_paletes ? "X" : " "}) Controle de Paletes &nbsp; ({r.lanc_email ? "X" : " "}) Enviado e-mail
      </p>
    </div>
  );
}
