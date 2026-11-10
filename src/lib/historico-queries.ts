import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const cargasQuery = (termo: string) =>
  queryOptions({
    queryKey: ["cargas", "lista", termo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("buscar_cargas", { _termo: termo });
      if (error) throw error;
      return data ?? [];
    },
  });

export const cargaQuery = (id: string) =>
  queryOptions({
    queryKey: ["cargas", "detalhe", id],
    queryFn: async () => {
      const { data: carga, error } = await supabase.from("cargas").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!carga) return null;
      const notas = [];
      const LOTE = 1000;
      for (let de = 0; ; de += LOTE) {
        const { data, error: e2 } = await supabase
          .from("notas")
          .select("*")
          .eq("carga_id", id)
          .order("id")
          .range(de, de + LOTE - 1);
        if (e2) throw e2;
        notas.push(...(data ?? []));
        if (!data || data.length < LOTE) break;
      }
      return { carga, notas };
    },
  });
