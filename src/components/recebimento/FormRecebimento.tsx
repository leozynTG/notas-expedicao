import { useRef, useState, type ReactNode } from "react";
import { FileArchive, Loader2, Plus, Save, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Erro } from "@/components/app/Campos";
import { Assinatura } from "./Assinatura";
import { validar, type Form } from "@/lib/recebimento/dados";
import {
  avisoPaletes, duracaoDescarga, escreverNumBr, finalAntesDoInicio, formatarDuracao, lerInteiro, MOTIVOS,
  normalizarPlaca, resumoXml,
} from "@/lib/recebimento/regras";
import { cn } from "@/lib/utils";

function Secao({ n, titulo, children, acao }: { n: number; titulo: string; children: ReactNode; acao?: ReactNode }) {
  return (
    <section className="card-surface p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{n}</span>
        <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
        <div className="ml-auto">{acao}</div>
      </div>
      {children}
    </section>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-md border border-warning/60 bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" /> <span>{children}</span>
    </p>
  );
}

type Modo = "texto" | "decimal" | "inteiro" | "data" | "hora";

export function FormRecebimento({ inicial, onSalvar, salvando }: { inicial: Form; onSalvar: (f: Form) => Promise<void>; salvando: boolean }) {
  const [f, setF] = useState<Form>(inicial);
  const [erros, setErros] = useState<string[]>([]);
  const [lendo, setLendo] = useState(false);
  const [avisosXml, setAvisosXml] = useState<string[]>([]);
  const arquivo = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  function campo(k: keyof Form, rotulo: string, modo: Modo = "texto", extra?: { obrig?: boolean; ph?: string; cls?: string }) {
    const tipo = modo === "data" ? "date" : modo === "hora" ? "time" : "text";
    const im = modo === "decimal" ? "decimal" : modo === "inteiro" ? "numeric" : undefined;
    return (
      <div className={cn("space-y-1.5", extra?.cls)}>
        <Label htmlFor={k}>
          {rotulo}
          {extra?.obrig && <span className="text-destructive"> *</span>}
        </Label>
        <Input
          id={k}
          type={tipo}
          inputMode={im}
          placeholder={extra?.ph}
          className="h-11 text-base"
          value={f[k] as string}
          onChange={(e) => {
            let v = e.target.value;
            if (k === "placa") v = normalizarPlaca(v);
            if (modo === "inteiro") v = v.replace(/\D/g, "");
            set(k, v as never);
          }}
        />
      </div>
    );
  }

  async function lerXml(file: File) {
    setLendo(true);
    setAvisosXml([]);
    try {
      const { processarCarga } = await import("@/lib/expedicao/processar");
      const r = await processarCarga(await file.arrayBuffer(), null);
      const s = resumoXml(r.notas);
      let cliente = "";
      let origem = s.origem;
      const primeira = r.notas[0];
      if (primeira) {
        const doc = new DOMParser().parseFromString(new TextDecoder().decode(primeira.bytes), "application/xml");
        const emit = doc.getElementsByTagNameNS("*", "emit")[0];
        const t = (tag: string) => emit?.getElementsByTagNameNS("*", tag)[0]?.textContent?.trim() ?? "";
        cliente = t("xNome");
        if (t("xMun") || t("UF")) origem = `${t("xMun")}/${t("UF")}`;
      }
      setF((x) => ({
        ...x,
        quant_nfe: String(s.quantNfe),
        valor: escreverNumBr(s.valor, 2),
        peso: s.peso === null ? x.peso : escreverNumBr(s.peso, 3),
        volumes: s.volumes === null ? x.volumes : String(s.volumes),
        cliente: cliente || x.cliente,
        origem: origem || x.origem,
      }));
      const av: string[] = [];
      if (s.semPeso) av.push(`${s.semPeso} nota(s) sem peso no XML ficaram fora do peso.`);
      if (s.semVolume) av.push(`${s.semVolume} nota(s) sem volume no XML ficaram fora dos volumes.`);
      setAvisosXml(av);
      toast.success(`${s.quantNfe} notas lidas. Confira os campos preenchidos.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o ZIP.");
    } finally {
      setLendo(false);
      if (arquivo.current) arquivo.current.value = "";
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const er = validar(f);
    setErros(er);
    if (er.length) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    await onSalvar(f);
  }

  const dur = duracaoDescarga(f.hora_inicio, f.hora_final);
  const avPal = avisoPaletes({
    total: lerInteiro(f.paletes_total), pbr: lerInteiro(f.paletes_pbr), chep: lerInteiro(f.paletes_chep),
    descartavel: lerInteiro(f.paletes_descartavel), quebrados: lerInteiro(f.paletes_quebrados),
  });
  const setOc = (i: number, k: keyof Form["ocorrencias"][number], v: string) =>
    set("ocorrencias", f.ocorrencias.map((o, j) => (j === i ? { ...o, [k]: v } : o)));

  return (
    <form onSubmit={salvar} className="space-y-5" noValidate>
      {erros.length > 0 && (
        <div className="space-y-2">
          {erros.map((x) => <Erro key={x} texto={x} />)}
        </div>
      )}

      <div className="card-surface flex flex-wrap items-center gap-3 p-4">
        <input ref={arquivo} type="file" accept=".zip,.rar" className="hidden" onChange={(e) => e.target.files?.[0] && lerXml(e.target.files[0])} />
        <Button type="button" variant="outline" onClick={() => arquivo.current?.click()} disabled={lendo}>
          {lendo ? <Loader2 className="animate-spin" /> : <FileArchive />} Preencher a partir dos XMLs da carga
        </Button>
        <p className="text-xs text-muted-foreground">Opcional. O ZIP é lido no seu computador e não é enviado.</p>
        {avisosXml.map((a) => <Aviso key={a}>{a}</Aviso>)}
      </div>

      <Secao n={1} titulo="Chegada">
        <div className="grid gap-4 sm:grid-cols-2">
          {campo("data_chegada", "Data da chegada", "data", { obrig: true })}
          {campo("hora_chegada", "Horário da chegada", "hora")}
        </div>
      </Secao>

      <Secao n={2} titulo="Descarga">
        <div className="grid gap-4 sm:grid-cols-4">
          {campo("hora_inicio", "Hora início", "hora")}
          {campo("hora_final", "Hora final", "hora")}
          {campo("data_saida", "Data da saída", "data")}
          <div className="space-y-1.5">
            <Label>Duração</Label>
            <p className="tabular flex h-11 items-center rounded-md border bg-secondary px-3 text-base font-medium">{formatarDuracao(dur)}</p>
          </div>
        </div>
        {finalAntesDoInicio(f.hora_inicio, f.hora_final) && <Aviso>A hora final é antes da hora início.</Aviso>}
      </Secao>

      <Secao n={3} titulo="Embarcador">
        <div className="grid gap-4 sm:grid-cols-2">
          {campo("cliente", "Cliente", "texto", { obrig: true })}
          {campo("origem", "Origem", "texto", { ph: "Cidade ou UF" })}
        </div>
      </Secao>

      <Secao n={4} titulo="Dados da carga">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campo("motorista", "Motorista", "texto", { obrig: true })}
          {campo("transportadora", "Transportadora")}
          {campo("veiculo", "Veículo", "texto", { ph: "3/4, Truck…" })}
          {campo("placa", "Placa", "texto", { obrig: true, ph: "AAA-0A00" })}
          {campo("peso", "Peso (kg)", "decimal", { ph: "2.435,2" })}
          {campo("valor", "Valor da carga (R$)", "decimal", { ph: "177.993,51" })}
          {campo("transporte", "Transporte")}
          {campo("cubagem", "Cubagem (m³)", "decimal")}
          {campo("volumes", "Volumes", "inteiro", { obrig: true })}
          {campo("quant_nfe", "Quant. NF-e", "inteiro")}
          {campo("lacre", "Lacre")}
        </div>
      </Secao>

      <Secao n={5} titulo="Paletes">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {campo("paletes_total", "Total", "inteiro")}
          {campo("paletes_pbr", "PBR", "inteiro")}
          {campo("paletes_chep", "CHEP", "inteiro")}
          {campo("paletes_descartavel", "Descartável", "inteiro")}
          {campo("paletes_quebrados", "Quebrados", "inteiro")}
        </div>
        {avPal && <Aviso>{avPal}</Aviso>}
      </Secao>

      <Secao n={6} titulo="Ocorrências / divergências">
        <div className="flex gap-2" role="radiogroup" aria-label="Houve ocorrências?">
          {[false, true].map((v) => (
            <Button key={String(v)} type="button" role="radio" aria-checked={f.tem_ocorrencia === v}
              variant={f.tem_ocorrencia === v ? "default" : "outline"} className="h-11 w-24"
              onClick={() => set("tem_ocorrencia", v)}>
              {v ? "Sim" : "Não"}
            </Button>
          ))}
        </div>
        {f.tem_ocorrencia && (
          <div className="mt-4 space-y-3">
            <datalist id="motivos">{MOTIVOS.map((m) => <option key={m} value={m} />)}</datalist>
            {f.ocorrencias.map((o, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-[1fr_2fr_0.7fr_1fr_1fr_auto]">
                <Input aria-label="Código" placeholder="Código" className="h-11" value={o.codigo} onChange={(e) => setOc(i, "codigo", e.target.value)} />
                <Input aria-label="Produto" placeholder="Produto" className="h-11" value={o.produto} onChange={(e) => setOc(i, "produto", e.target.value)} />
                <Input aria-label="Quant." placeholder="Quant." inputMode="decimal" className="h-11" value={o.quant} onChange={(e) => setOc(i, "quant", e.target.value)} />
                <Input aria-label="Nota" placeholder="Nota (NF)" inputMode="numeric" className="h-11" value={o.nota} onChange={(e) => setOc(i, "nota", e.target.value)} />
                <Input aria-label="Motivo" placeholder="Motivo" list="motivos" className="h-11" value={o.motivo} onChange={(e) => setOc(i, "motivo", e.target.value)} />
                <Button type="button" variant="ghost" size="icon" className="h-11" aria-label="Remover linha"
                  onClick={() => set("ocorrencias", f.ocorrencias.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => set("ocorrencias", [...f.ocorrencias, { codigo: "", produto: "", quant: "", nota: "", motivo: "" }])}>
              <Plus /> Adicionar linha
            </Button>
          </div>
        )}
      </Secao>

      <Secao n={7} titulo="Lançamentos">
        <div className="flex flex-wrap gap-6">
          {([["lanc_kpi", "KPI"], ["lanc_controle_paletes", "Controle de Paletes"], ["lanc_email", "Enviado e-mail"]] as const).map(([k, r]) => (
            <label key={k} className="flex items-center gap-2 text-base">
              <Checkbox className="size-6" checked={f[k]} onCheckedChange={(v) => set(k, v === true)} /> {r}
            </label>
          ))}
        </div>
      </Secao>

      <Secao n={8} titulo="Assinaturas">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            {campo("conferente", "Conferente")}
            <Assinatura rotulo="Assinatura do conferente" valor={f.assinatura_conferente} onChange={(v) => set("assinatura_conferente", v)} />
          </div>
          <div className="space-y-3 md:pt-[4.5rem]">
            <Assinatura rotulo={`Assinatura do motorista${f.motorista ? ` (${f.motorista})` : ""}`} valor={f.assinatura_motorista} onChange={(v) => set("assinatura_motorista", v)} />
          </div>
        </div>
      </Secao>

      <div className="sticky bottom-0 -mx-5 flex justify-end border-t bg-background/95 px-5 py-3 backdrop-blur">
        <Button type="submit" size="lg" disabled={salvando}>
          {salvando ? <Loader2 className="animate-spin" /> : <Save />} Salvar recebimento
        </Button>
      </div>
    </form>
  );
}
