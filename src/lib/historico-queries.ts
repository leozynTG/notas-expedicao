import { queryOptions } from "@tanstack/react-query";
import { lerDashboard } from "@/lib/expedicao/dashboard";
import { buscarCargas, dashboardCargas, lerCarga } from "@/lib/api.functions";
import type { Database } from "@/lib/db-types";

type Carga = Database["public"]["Tables"]["cargas"]["Row"];
type Nota = Database["public"]["Tables"]["notas"]["Row"];

export const cargasQuery = (termo: string) =>
  queryOptions({
    queryKey: ["cargas", "lista", termo],
    queryFn: async () => (await buscarCargas({ data: { termo } })) as unknown as Carga[],
  });

export const cargaQuery = (id: string) =>
  queryOptions({
    queryKey: ["cargas", "detalhe", id],
    queryFn: async () => {
      const r = (await lerCarga({ data: { id } })) as unknown as { carga: Carga; notas: Nota[] } | null;
      return r;
    },
  });

export const dashboardQuery = (de: string | null, ate: string | null) =>
  queryOptions({
    queryKey: ["cargas", "dashboard", de, ate],
    queryFn: async () => lerDashboard(await dashboardCargas({ data: { de, ate } })),
  });
