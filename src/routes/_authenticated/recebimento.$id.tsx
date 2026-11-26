import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Loader2, Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AppShell } from "@/components/app/AppShell";
import { FormRecebimento } from "@/components/recebimento/FormRecebimento";
import { Folha } from "@/components/recebimento/Folha";
import { formDeRegistro, paraRegistro, type Form } from "@/lib/recebimento/dados";
import { recebimentoQuery } from "@/lib/recebimento/consultas";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/recebimento/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(recebimentoQuery(params.id)),
  head: () => ({
    meta: [
      { title: "Recebimento — Expedição CDLog" },
      { name: "description", content: "Detalhes de um recebimento de carga." },
      { property: "og:title", content: "Recebimento — Expedição CDLog" },
      { property: "og:description", content: "Detalhes de um recebimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  pendingComponent: () => (
    <AppShell><div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div></AppShell>
  ),
  component: Detalhe,
});

function Detalhe() {
  const { id } = Route.useParams();
  const { data: r } = useSuspenseQuery(recebimentoQuery(id));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);

  if (!r) {
    return (
      <AppShell>
        <p className="card-surface px-5 py-10 text-center text-sm text-muted-foreground">Recebimento não encontrado.</p>
        <Link to="/recebimento" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="size-4" /> Voltar</Link>
      </AppShell>
    );
  }

  async function salvar(f: Form) {
    setSalvando(true);
    try {
      const { criado_por: _a, criado_por_email: _b, ...campos } = paraRegistro(f);
      const { error } = await supabase.from("recebimentos").update(campos).eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["recebimentos"] });
      toast.success("Alterações salvas.");
      setEditando(false);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar. O que você digitou continua na tela; tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function imprimir() {
    setImprimindo(true);
    try {
      const { abrirFolhaPdf } = await import("@/lib/recebimento/folha-pdf");
      if (r) await abrirFolhaPdf(r);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar a folha para impressão.");
    } finally {
      setImprimindo(false);
    }
  }

  async function excluir() {
    setExcluindo(true);
    try {
      const { error } = await supabase.from("recebimentos").delete().eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["recebimentos"] });
      toast.success("Recebimento excluído.");
      navigate({ to: "/recebimento" });
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível excluir.");
      setExcluindo(false);
    }
  }

  return (
    <AppShell>
      <Link to="/recebimento" className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" /> Recebimentos
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{editando ? "Editar recebimento" : "Recebimento"}</h1>
        {!editando && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={imprimir} disabled={imprimindo}>{imprimindo ? <Loader2 className="animate-spin" /> : <Printer />} Imprimir folha</Button>
            <Button variant="outline" onClick={() => setEditando(true)}><Pencil /> Editar</Button>
            <Button variant="outline" asChild>
              <Link to="/recebimento/novo" search={{ copiar: id }}><Copy /> Duplicar</Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive" disabled={excluindo}><Trash2 /> Excluir</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir este recebimento?</AlertDialogTitle>
                  <AlertDialogDescription>Essa ação não pode ser desfeita. As assinaturas também serão apagadas.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
      {editando ? (
        <>
          <FormRecebimento inicial={formDeRegistro(r)} onSalvar={salvar} salvando={salvando} />
          <Button variant="ghost" className="mt-3" onClick={() => setEditando(false)}>Cancelar edição</Button>
        </>
      ) : (
        <>
          <div className="card-surface overflow-x-auto p-2"><Folha r={r} /></div>
          <p className="mt-3 text-xs text-muted-foreground">
            Lançado por {r.criado_por_email || "usuário removido"}.
          </p>
        </>
      )}
    </AppShell>
  );
}
