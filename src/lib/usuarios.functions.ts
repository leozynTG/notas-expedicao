import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarEmail(v: unknown): string {
  const email = String(v ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 255) throw new Error("Informe um e-mail válido.");
  return email;
}

/**
 * Cria a primeira conta (administradora). Público por necessidade, mas só funciona
 * enquanto não existir nenhum administrador; a checagem final é atômica no banco.
 */
export const criarAdministrador = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; senha: string }) => {
    const senha = String(input?.senha ?? "");
    if (senha.length < 8 || senha.length > 72) throw new Error("A senha precisa ter de 8 a 72 caracteres.");
    return { email: validarEmail(input?.email), senha };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: configurado, error: errCfg } = await supabaseAdmin.rpc("sistema_configurado");
    if (errCfg) throw new Error("Não foi possível verificar o sistema. Tente de novo.");
    if (configurado) throw new Error("O administrador já foi criado. Peça um convite a ele.");

    const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
    });
    if (error || !criado.user) {
      throw new Error(error?.message?.includes("weak") || error?.message?.includes("pwned")
        ? "Essa senha é fraca ou já vazou em outros sites. Escolha outra."
        : "Não foi possível criar a conta. Confira o e-mail e a senha.");
    }

    const { data: ok } = await supabaseAdmin.rpc("reivindicar_admin", { _user_id: criado.user.id });
    if (!ok) {
      await supabaseAdmin.auth.admin.deleteUser(criado.user.id);
      throw new Error("O administrador já foi criado. Peça um convite a ele.");
    }
    return { ok: true };
  });

/** Admin convida um usuário por e-mail; ele define a senha pelo link recebido. */
export const convidarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; redirectTo: string }) => {
    let redirectTo: string;
    try {
      const u = new URL(String(input?.redirectTo ?? ""));
      if (!/^https?:$/.test(u.protocol)) throw new Error();
      redirectTo = `${u.origin}/definir-senha`;
    } catch {
      throw new Error("Endereço de retorno inválido.");
    }
    return { email: validarEmail(input?.email), redirectTo };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Só o administrador pode convidar usuários.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | null = null;
    let jaExistia = false;

    const { data: conv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (conv?.user) {
      userId = conv.user.id;
    } else {
      const { data: perfil } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", data.email)
        .maybeSingle();
      if (!perfil) {
        console.error("Falha no convite:", error?.message);
        throw new Error("Não foi possível enviar o convite. Tente de novo em alguns minutos.");
      }
      userId = perfil.id;
      jaExistia = true;
    }

    const { error: errRole } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "user" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (errRole) throw new Error("O convite foi enviado, mas não foi possível liberar o acesso.");

    return { jaExistia };
  });
