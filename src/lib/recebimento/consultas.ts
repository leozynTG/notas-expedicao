import { queryOptions } from "@tanstack/react-query";
import { lerRecebimento, listarRecebimentos } from "@/lib/api.functions";
import type { Registro } from "./dados";
import type { Linha } from "./lista";

export const recebimentosQuery = queryOptions({
  queryKey: ["recebimentos", "lista"],
  queryFn: async (): Promise<Linha[]> => (await listarRecebimentos()) as unknown as Linha[],
});

export const recebimentoQuery = (id: string) =>
  queryOptions({
    queryKey: ["recebimentos", "detalhe", id],
    queryFn: async (): Promise<Registro | null> => (await lerRecebimento({ data: { id } })) as unknown as Registro | null,
  });
