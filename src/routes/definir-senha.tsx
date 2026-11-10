import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Campo, Erro } from "@/components/app/Campos";

export const Route = createFileRoute("/definir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Definir senha — Expedição CDLog" },
      { name: "description", content: "Crie sua senha de acesso à Expedição CDLog." },
      { property: "og:title", content: "Definir senha — Expedição CDLog" },
      { property: "og:description", content: "Crie sua senha de acesso à Expedição CDLog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DefinirSenha,
});

function DefinirSenha() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<"carregando" | "pronto" | "invalido">("carregando");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        window.history.replaceState(null, "", window.location.pathname);
      }
      const { data } = await supabase.auth.getUser();
      if (!ativo) return;
      if (data.user) {
        setEmail(data.user.email ?? "");
        setEstado("pronto");
      } else {
        setEstado("invalido");
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== senha2) return setErro("As senhas não são iguais.");
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) {
      setErro(
        /weak|pwned|leaked/i.test(error.message)
          ? "Essa senha é fraca ou já vazou em outros sites. Escolha outra."
          : "Não foi possível salvar a senha. Tente de novo.",
      );
      return;
    }
    toast.success("Senha definida. Bem-vindo!");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card-surface w-full max-w-sm p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground">Definir senha</h1>
            <p className="text-xs text-muted-foreground">Expedição CDLog</p>
          </div>
        </div>

        {estado === "carregando" && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {estado === "invalido" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este link expirou ou já foi usado. Peça um novo convite ao administrador ou use "Esqueci minha senha".
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth">Ir para a tela de entrada</Link>
            </Button>
          </div>
        )}
        {estado === "pronto" && (
          <form onSubmit={salvar} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Crie a senha para <span className="font-medium text-foreground">{email}</span>.
            </p>
            <Campo id="senha" rotulo="Nova senha (mínimo 8 caracteres)" tipo="password" valor={senha} onChange={setSenha} auto="new-password" />
            <Campo id="senha2" rotulo="Repita a senha" tipo="password" valor={senha2} onChange={setSenha2} auto="new-password" />
            {erro && <Erro texto={erro} />}
            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" />} Salvar senha e entrar
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
