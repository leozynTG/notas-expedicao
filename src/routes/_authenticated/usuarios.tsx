import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MailPlus, UserMinus } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AppShell } from "@/components/app/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useEu } from "@/hooks/use-eu";
import { convidarUsuario } from "@/lib/usuarios.functions";
import { dataHora } from "@/lib/formato";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Expedição CDLog" },
      { name: "description", content: "Convide pessoas da equipe para acessar a Expedição CDLog." },
      { property: "og:title", content: "Usuários — Expedição CDLog" },
      { property: "og:description", content: "Gestão de acesso da equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Usuarios,
});

function Usuarios() {
  const { data: eu, isLoading } = useEu();
  return <AppShell>{isLoading ? null : eu?.isAdmin ? <PainelUsuarios meuId={eu.id} /> : <SoAdmin />}</AppShell>;
}

function SoAdmin() {
  return (
    <div className="card-surface mx-auto max-w-md p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">Somente o administrador</h1>
      <p className="mt-1 text-sm text-muted-foreground">Esta tela é usada para convidar novos usuários.</p>
    </div>
  );
}

function PainelUsuarios({ meuId }: { meuId: string }) {
  const queryClient = useQueryClient();
  const convidar = useServerFn(convidarUsuario);
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);

  const lista = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const [perfis, papeis] = await Promise.all([
        supabase.from("profiles").select("id, email, created_at").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (perfis.error) throw perfis.error;
      if (papeis.error) throw papeis.error;
      return (perfis.data ?? []).map((p) => {
        const roles = (papeis.data ?? []).filter((r) => r.user_id === p.id).map((r) => r.role);
        return { ...p, papel: roles.includes("admin") ? "admin" : roles.includes("user") ? "user" : null };
      });
    },
  });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = await convidar({ data: { email, redirectTo: window.location.origin } });
      toast.success(
        r.jaExistia
          ? `${email.trim()} já tinha conta: o acesso foi liberado.`
          : `Convite enviado para ${email.trim()}.`,
      );
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Não foi possível enviar o convite.");
    } finally {
      setEnviando(false);
    }
  }

  async function remover(id: string, mail: string) {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "user");
    if (error) {
      toast.error("Não foi possível remover o acesso.");
      return;
    }
    toast.success(`Acesso de ${mail} removido.`);
    queryClient.invalidateQueries({ queryKey: ["usuarios"] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Só entra quem for convidado. A pessoa recebe um e-mail com um link para criar a senha.
        </p>
      </div>

      <form onSubmit={enviar} className="card-surface flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-64 flex-1 space-y-1.5">
          <Label htmlFor="convite-email">E-mail da pessoa</Label>
          <Input
            id="convite-email"
            type="email"
            required
            value={email}
            placeholder="nome@empresa.com.br"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" /> : <MailPlus />} Enviar convite
        </Button>
      </form>

      <div className="card-surface overflow-hidden">
        {lista.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul>
            {(lista.data ?? []).map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 border-t px-5 py-3 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{u.email}</p>
                  <p className="text-xs text-muted-foreground">Desde {dataHora(u.created_at)}</p>
                </div>
                <span
                  className={
                    u.papel === "admin"
                      ? "rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
                      : u.papel === "user"
                        ? "rounded border bg-secondary px-2 py-0.5 text-xs"
                        : "rounded border border-destructive/30 bg-destructive-soft px-2 py-0.5 text-xs text-destructive"
                  }
                >
                  {u.papel === "admin" ? "Administrador" : u.papel === "user" ? "Usuário" : "Sem acesso"}
                </span>
                {u.papel === "user" && u.id !== meuId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-muted-foreground">
                        <UserMinus /> Remover acesso
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover o acesso de {u.email}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A pessoa não verá mais o histórico nem poderá salvar cargas. Você pode convidá-la de novo depois.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remover(u.id, u.email)}>Remover acesso</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
