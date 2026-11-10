import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { cargasDistintas, montarCarga, sugerirNumeroCarga } from "@/lib/expedicao/historico";
import type { NotaComArquivo } from "@/lib/expedicao/processar";
import { dataHora } from "@/lib/formato";

interface Existente {
  processada_em: string;
  processada_por_email: string;
  total_notas: number;
}

export function SalvarCarga({ notas }: { notas: NotaComArquivo[] }) {
  const queryClient = useQueryClient();
  const [numero, setNumero] = useState(() => sugerirNumeroCarga(notas));
  const [salvando, setSalvando] = useState(false);
  const [existente, setExistente] = useState<Existente | null>(null);
  const [salvaId, setSalvaId] = useState<string | null>(null);
  const distintas = cargasDistintas(notas);

  async function gravar(substituir: boolean) {
    const { carga, notas: linhas } = montarCarga(numero, notas);
    const { data, error } = await supabase.rpc("salvar_carga", {
      _carga: carga as unknown as Json,
      _notas: linhas as unknown as Json,
      _substituir: substituir,
    });
    if (error) {
      if (error.message.includes("CARGA_JA_EXISTE")) return "existe" as const;
      throw error;
    }
    setSalvaId(data as string);
    queryClient.invalidateQueries({ queryKey: ["cargas"] });
    toast.success(`Carga ${carga.numero_carga} salva no histórico.`);
    return "ok" as const;
  }

  async function verificarExistente(n: string) {
    const { data } = await supabase
      .from("cargas")
      .select("processada_em, processada_por_email, total_notas")
      .eq("numero_carga", n)
      .maybeSingle();
    return data;
  }

  async function salvar() {
    const n = numero.trim();
    if (!n) {
      toast.error("Informe o número da carga.");
      return;
    }
    setSalvando(true);
    try {
      const atual = await verificarExistente(n);
      if (atual) {
        setExistente(atual);
        return;
      }
      if ((await gravar(false)) === "existe") setExistente(await verificarExistente(n));
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar a carga. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function substituir() {
    setExistente(null);
    setSalvando(true);
    try {
      await gravar(true);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível substituir a carga. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  if (salvaId) {
    return (
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
        <CheckCircle2 className="size-5 shrink-0" />
        <span>
          Carga <span className="tabular font-medium">{numero.trim()}</span> salva no histórico.
        </span>
        <Button asChild size="sm" variant="outline" className="ml-auto">
          <Link to="/historico/$id" params={{ id: salvaId }}>
            Abrir no histórico
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="card-surface p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="numero-carga" className="flex items-center gap-2">
            <Database className="size-4 text-primary" /> Número da carga
          </Label>
          <Input
            id="numero-carga"
            className="tabular w-48"
            value={numero}
            placeholder="Ex.: 140894"
            onChange={(e) => setNumero(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()}
          />
        </div>
        <Button onClick={salvar} disabled={salvando || !numero.trim()}>
          {salvando && <Loader2 className="animate-spin" />} Salvar no histórico
        </Button>
        <p className="basis-full text-xs text-muted-foreground sm:basis-auto">
          {numero && distintas.includes(numero.trim())
            ? "Lido das informações complementares das notas. Confira ou corrija antes de salvar."
            : "Não encontramos o número da carga nas notas. Digite antes de salvar."}{" "}
          Só os dados da tabela são salvos; os XMLs e o PDF não.
        </p>
      </div>
      {distintas.length > 1 && (
        <p className="mt-3 text-xs text-warning-foreground">
          Este ZIP tem notas de mais de uma carga: {distintas.join(", ")}.
        </p>
      )}

      <AlertDialog open={existente !== null} onOpenChange={(o) => !o && setExistente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>A carga {numero.trim()} já está no histórico</AlertDialogTitle>
            <AlertDialogDescription>
              {existente &&
                `Ela foi processada por ${existente.processada_por_email || "usuário removido"} em ${dataHora(existente.processada_em)}, com ${existente.total_notas} nota(s). Deseja substituir pelos dados desta carga?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={substituir}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
