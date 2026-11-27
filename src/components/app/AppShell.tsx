import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { History, LayoutDashboard, LogOut, PackagePlus, FileStack, ShieldAlert, ShieldCheck, Users, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useEu } from "@/hooks/use-eu";
import { cn } from "@/lib/utils";

const ABA =
  "inline-flex items-center gap-2 border-b-[3px] border-transparent px-1 pb-3 pt-1 text-xs font-semibold uppercase tracking-wider text-blue-100/80 transition-colors hover:text-white";
const ABA_ATIVA = "border-brand-yellow text-white";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: eu, isLoading } = useEu();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b-4 border-brand-yellow bg-brand-blue text-white">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex items-center gap-3 py-4">
            <img src="/logo-cdlog.png" alt="CDlog — Sua entrega sempre na frente" className="h-12 w-auto rounded-lg bg-white px-3 py-1" />
            <div>
              <p className="text-lg font-bold leading-tight tracking-tight text-white">Expedição CDLog</p>
              <p className="text-xs text-blue-100/80">Conferência de notas da carga</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden max-w-56 truncate text-xs text-blue-100/90 sm:block" title={eu?.email}>
                {eu?.email}
              </span>
              <Button variant="outline" size="sm" className="border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={sair}>
                <LogOut /> Sair
              </Button>
            </div>
          </div>
          <nav className="flex gap-6" aria-label="Seções">
            <Link to="/" className={ABA} activeProps={{ className: ABA_ATIVA }} activeOptions={{ exact: true }}>
              <PackagePlus className="size-4" /> Nova carga
            </Link>
            <Link to="/historico" className={ABA} activeProps={{ className: ABA_ATIVA }}>
              <History className="size-4" /> Histórico
            </Link>
            <Link to="/dashboard" className={ABA} activeProps={{ className: ABA_ATIVA }}>
              <LayoutDashboard className="size-4" /> Dashboard
            </Link>
            <Link to="/cte" className={ABA} activeProps={{ className: ABA_ATIVA }}>
              <FileStack className="size-4" /> Organizar CTe
            </Link>
            <Link to="/recebimento" className={ABA} activeProps={{ className: ABA_ATIVA }}>
              <ClipboardCheck className="size-4" /> Recebimento
            </Link>
            {eu?.isAdmin && (
              <Link to="/usuarios" className={ABA} activeProps={{ className: ABA_ATIVA }}>
                <Users className="size-4" /> Usuários
              </Link>
            )}
            <span className="ml-auto hidden items-center gap-1.5 pb-3 text-xs text-blue-100/80 md:flex">
              <ShieldCheck className="size-4 text-brand-yellow" />
              XML e PDF não saem do seu computador
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        {!isLoading && eu && !eu.isMembro ? (
          <div className={cn("card-surface mx-auto max-w-md p-6 text-center")}>
            <ShieldAlert className="mx-auto size-8 text-destructive" />
            <h1 className="mt-3 text-lg font-semibold text-foreground">Sem acesso</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sua conta não tem acesso liberado. Peça ao administrador para convidar você de novo.
            </p>
          </div>
        ) : (
          children
        )}
      </main>
      <footer className="mt-10 border-t-4 border-brand-green bg-brand-navy px-5 py-4 text-center text-xs text-blue-100/80">
        CDLog Logística • Sua entrega sempre na frente
      </footer>
    </div>
  );
}
