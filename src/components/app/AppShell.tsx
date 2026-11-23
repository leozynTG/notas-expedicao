import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { History, LayoutDashboard, LogOut, PackagePlus, FileStack, ShieldAlert, ShieldCheck, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useEu } from "@/hooks/use-eu";
import { cn } from "@/lib/utils";

const ABA =
  "inline-flex items-center gap-2 border-b-2 border-transparent px-1 pb-3 pt-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
const ABA_ATIVA = "border-primary text-foreground";

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
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex items-center gap-3 py-4">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Truck className="size-5" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight tracking-tight text-foreground">Expedição CDLog</p>
              <p className="text-xs text-muted-foreground">Conferência de notas da carga</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden max-w-56 truncate text-xs text-muted-foreground sm:block" title={eu?.email}>
                {eu?.email}
              </span>
              <Button variant="outline" size="sm" onClick={sair}>
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
            {eu?.isAdmin && (
              <Link to="/usuarios" className={ABA} activeProps={{ className: ABA_ATIVA }}>
                <Users className="size-4" /> Usuários
              </Link>
            )}
            <span className="ml-auto hidden items-center gap-1.5 pb-3 text-xs text-muted-foreground md:flex">
              <ShieldCheck className="size-4 text-success" />
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
    </div>
  );
}
