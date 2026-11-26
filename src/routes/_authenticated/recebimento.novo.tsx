import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { FormRecebimento } from "@/components/recebimento/FormRecebimento";
import { formDeRegistro, formVazio, hojeIso, paraRegistro, type Form } from "@/lib/recebimento/dados";
import { recebimentoQuery } from "@/lib/recebimento/consultas";
import { supabase } from "@/integrations/supabase/client";
import { useEu } from "@/hooks/use-eu";

export const Route = createFileRoute("/_authenticated/recebimento/novo")({
  validateSearch: (s: Record<string, unknown>): { copiar?: string } =>
    typeof s["copiar"] === "string" && s["copiar"] ? { copiar: s["copiar"] } : {},
  head: () => ({
    meta: [
      { title: "Novo recebimento — Expedição CDLog" },
      { name: "description", content: "Registre o recebimento de uma carga." },
      { property: "og:title", content: "Novo recebimento — Expedição CDLog" },
      { property: "og:description", content: "Formulário de controle de recebimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovoRecebimento,
});

function NovoRecebimento() {
  const { copiar } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: eu } = useEu();
  const [salvando, setSalvando] = useState(false);
  const origem = useQuery({ ...recebimentoQuery(copiar ?? ""), enabled: !!copiar });

  async function salvar(f: Form) {
    setSalvando(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? eu?.id ?? null;
      const { data, error } = await supabase
        .from("recebimentos")
        .insert({ ...paraRegistro(f), criado_por: uid, criado_por_email: auth.user?.email ?? eu?.email ?? "" })
        .select("id")
        .single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["recebimentos"] });
      toast.success("Recebimento salvo.");
      navigate({ to: "/recebimento/$id", params: { id: data.id } });
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar. O que você digitou continua na tela; tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  let inicial: Form | null = formVazio();
  if (copiar) {
    inicial = origem.data
      ? {
          ...formDeRegistro(origem.data),
          data_chegada: hojeIso(), hora_chegada: "", hora_inicio: "", hora_final: "", data_saida: "",
          assinatura_conferente: null, assinatura_motorista: null,
          lanc_kpi: false, lanc_controle_paletes: false, lanc_email: false,
        }
      : null;
  }

  return (
    <AppShell>
      <Link to="/recebimento" className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" /> Recebimentos
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        {copiar ? "Duplicar recebimento" : "Novo recebimento"}
      </h1>
      {!inicial ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <FormRecebimento key={copiar ?? "novo"} inicial={inicial} onSalvar={salvar} salvando={salvando} />
      )}
    </AppShell>
  );
}
