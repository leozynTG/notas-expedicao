import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Linha } from "./lista";

const COLUNAS =
  "id,criado_em,atualizado_em,criado_por,criado_por_email,data_chegada,hora_chegada,hora_inicio,hora_final,data_saida,cliente,origem,motorista,transportadora,veiculo,placa,peso_kg,valor,transporte,cubagem_m3,volumes,quant_nfe,lacre,paletes_total,paletes_pbr,paletes_chep,paletes_descartavel,paletes_quebrados,tem_ocorrencia,ocorrencias,lanc_kpi,lanc_controle_paletes,lanc_email,conferente";

export const recebimentosQuery = queryOptions({
  queryKey: ["recebimentos", "lista"],
  queryFn: async (): Promise<Linha[]> => {
    const todos: Linha[] = [];
    const LOTE = 1000;
    for (let de = 0; ; de += LOTE) {
      const { data, error } = await supabase
        .from("recebimentos")
        .select(COLUNAS)
        .order("data_chegada", { ascending: false })
        .order("criado_em", { ascending: false })
        .range(de, de + LOTE - 1);
      if (error) throw error;
      todos.push(...((data ?? []) as unknown as Linha[]));
      if (!data || data.length < LOTE) break;
    }
    return todos;
  },
});

export const recebimentoQuery = (id: string) =>
  queryOptions({
    queryKey: ["recebimentos", "detalhe", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("recebimentos").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
