import { useEffect, useRef } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Assinatura({ rotulo, valor, onChange }: { rotulo: string; valor: string | null; onChange: (v: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (valor) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = valor;
    }
    // só no carregamento inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const p = ponto(e);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(ultimo.current!.x, ultimo.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo.current = p;
  }

  function fim() {
    if (!desenhando.current) return;
    desenhando.current = false;
    onChange(ref.current!.toDataURL("image/png"));
  }

  function limpar() {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    onChange(null);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{rotulo}</span>
        <Button type="button" variant="ghost" size="sm" onClick={limpar}>
          <Eraser /> Limpar
        </Button>
      </div>
      <canvas
        ref={ref}
        width={600}
        height={200}
        aria-label={`Assinatura ${rotulo}`}
        className="h-40 w-full touch-none rounded-md border-2 border-dashed border-input bg-card"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          desenhando.current = true;
          ultimo.current = ponto(e);
        }}
        onPointerMove={mover}
        onPointerUp={fim}
        onPointerCancel={fim}
      />
    </div>
  );
}
