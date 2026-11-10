import { useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  titulo: string;
  dica: string;
  aceita: string;
  extensoes: string[];
  icone: ReactNode;
  arquivo: File | null;
  opcional?: boolean;
  onArquivo: (f: File | null) => void;
  onErro: (msg: string) => void;
}

export function DropZone({ titulo, dica, aceita, extensoes, icone, arquivo, opcional, onArquivo, onErro }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  function escolher(f: File | undefined) {
    if (!f) return;
    const nome = f.name.toLowerCase();
    if (!extensoes.some((e) => nome.endsWith(e))) {
      onErro(`"${f.name}" não é um arquivo aceito aqui (${extensoes.join(", ")}).`);
      return;
    }
    onArquivo(f);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={titulo}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        escolher(e.dataTransfer.files[0]);
      }}
      className={cn(
        "group relative flex min-h-48 cursor-pointer flex-col justify-between rounded-lg border-2 border-dashed bg-card p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        arrastando ? "border-primary bg-accent" : "border-input hover:border-primary/60",
        arquivo && "border-solid border-primary/50",
      )}
    >
      <input
        ref={input}
        type="file"
        accept={aceita}
        className="hidden"
        onChange={(e) => {
          escolher(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground [&_svg]:size-5">
          {icone}
        </div>
        {opcional && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
            opcional
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="font-semibold text-foreground">{titulo}</p>
        {arquivo ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="tabular truncate text-sm text-primary">{arquivo.name}</span>
            <span className="tabular shrink-0 text-xs text-muted-foreground">
              {(arquivo.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB
            </span>
            <button
              type="button"
              aria-label="Remover arquivo"
              onClick={(e) => {
                e.stopPropagation();
                onArquivo(null);
              }}
              className="ml-auto rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{dica}</p>
        )}
      </div>
    </div>
  );
}
