import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Campo, Erro } from "@/components/app/Campos";
import { supabase } from "@/integrations/supabase/client";
import { criarAdministrador } from "@/lib/usuarios.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Expedição CDLog" },
      { name: "description", content: "Acesso restrito à equipe de expedição CDLog." },
      { property: "og:title", content: "Entrar — Expedição CDLog" },
      { property: "og:description", content: "Acesso restrito à equipe de expedição CDLog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Modo = "entrar" | "esqueci";

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const criarAdmin = useServerFn(criarAdministrador);

  const configurado = useQuery({
    queryKey: ["sistema-configurado"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sistema_configurado");
      if (error) throw error;
      return Boolean(data);
    },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) {
      setErro(
        error.message.toLowerCase().includes("invalid")
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Tente de novo.",
      );
      return;
    }
    navigate({ to: "/", replace: true });
  }

  async function esqueci(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/definir-senha`,
    });
    setEnviando(false);
    if (error) {
      setErro("Não foi possível enviar o e-mail. Tente de novo em alguns minutos.");
      return;
    }
    setAviso("Se esse e-mail tiver acesso, você vai receber um link para criar uma nova senha.");
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha !== senha2) {
      setErro("As senhas não são iguais.");
      return;
    }
    setEnviando(true);
    try {
      await criarAdmin({ data: { email, senha } });
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) throw error;
      toast.success("Conta de administrador criada.");
      navigate({ to: "/", replace: true });
    } catch (err) {
      setErro(err instanceof Error && err.message ? err.message : "Não foi possível criar a conta.");
      configurado.refetch();
    } finally {
      setEnviando(false);
    }
  }

  const primeiraConta = configurado.data === false;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card-surface w-full max-w-sm border-t-4 border-t-brand-yellow p-7">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo-cdlog.png" alt="CDlog" className="h-10 w-auto" />
          <div className="border-l pl-3">
            <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground">Expedição CDLog</h1>
            <p className="text-xs text-muted-foreground">Acesso somente para convidados</p>
          </div>
        </div>

        {configurado.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : primeiraConta ? (
          <form onSubmit={criar} className="space-y-4">
            <div>
              <h2 className="font-semibold text-foreground">Criar conta de administrador</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Esta é a primeira conta do sistema. Depois, só entra quem você convidar.
              </p>
            </div>
            <Campo id="email" rotulo="E-mail" tipo="email" valor={email} onChange={setEmail} auto="email" />
            <Campo id="senha" rotulo="Senha (mínimo 8 caracteres)" tipo="password" valor={senha} onChange={setSenha} auto="new-password" />
            <Campo id="senha2" rotulo="Repita a senha" tipo="password" valor={senha2} onChange={setSenha2} auto="new-password" />
            {erro && <Erro texto={erro} />}
            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" />} Criar conta
            </Button>
          </form>
        ) : modo === "entrar" ? (
          <form onSubmit={entrar} className="space-y-4">
            <Campo id="email" rotulo="E-mail" tipo="email" valor={email} onChange={setEmail} auto="email" />
            <Campo id="senha" rotulo="Senha" tipo="password" valor={senha} onChange={setSenha} auto="current-password" />
            {erro && <Erro texto={erro} />}
            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" />} Entrar
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => {
                setModo("esqueci");
                setErro(null);
              }}
            >
              Esqueci minha senha
            </button>
          </form>
        ) : (
          <form onSubmit={esqueci} className="space-y-4">
            <p className="text-sm text-muted-foreground">Informe seu e-mail para receber o link de nova senha.</p>
            <Campo id="email" rotulo="E-mail" tipo="email" valor={email} onChange={setEmail} auto="email" />
            {erro && <Erro texto={erro} />}
            {aviso && <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">{aviso}</p>}
            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" />} Enviar link
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => {
                setModo("entrar");
                setErro(null);
                setAviso(null);
              }}
            >
              Voltar para entrar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

