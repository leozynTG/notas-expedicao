import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { baixarBackup } from "@/lib/api.functions";
import { History, LayoutDashboard, PackagePlus, FileStack, ShieldCheck, ClipboardCheck } from "lucide-react";

const ABA =
  "inline-flex items-center gap-2 border-b-[3px] border-transparent px-1 pb-3 pt-1 text-xs font-semibold uppercase tracking-wider text-blue-100/80 transition-colors hover:text-white";
const ABA_ATIVA = "border-brand-yellow text-white";

async function backup() {
  try {
    const b64 = await baixarBackup();
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `expedicao-backup-${new Date().toLocaleDateString("sv-SE")}.db`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch (e) {
    console.error(e);
    toast.error("Não foi possível gerar o backup.");
  }
}

export function AppShell({ children }: { children: ReactNode }) {
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
            <span className="ml-auto hidden items-center gap-1.5 pb-3 text-xs text-blue-100/80 md:flex">
              <ShieldCheck className="size-4 text-brand-yellow" />
              XML e PDF não saem do seu computador
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        {children}
      </main>
      <footer className="mt-10 border-t-4 border-brand-green bg-brand-navy px-5 py-4 text-center text-xs text-blue-100/80">
        CDLog Logística • Sua entrega sempre na frente •{" "}
        <button type="button" onClick={backup} className="underline underline-offset-2 hover:text-white">
          Baixar backup dos dados
        </button>
      </footer>
    </div>
  );
}
