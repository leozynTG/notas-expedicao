import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Campo(props: {
  id: string;
  rotulo: string;
  tipo: string;
  valor: string;
  onChange: (v: string) => void;
  auto?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.id}>{props.rotulo}</Label>
      <Input
        id={props.id}
        type={props.tipo}
        value={props.valor}
        autoComplete={props.auto}
        required
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

export function Erro({ texto }: { texto: string }) {
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">
      {texto}
    </p>
  );
}
