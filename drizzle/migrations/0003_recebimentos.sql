CREATE TABLE public.recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid DEFAULT auth.uid(),
  criado_por_email text NOT NULL DEFAULT '',
  data_chegada date NOT NULL,
  hora_chegada text,
  hora_inicio text,
  hora_final text,
  data_saida date,
  cliente text NOT NULL,
  origem text NOT NULL DEFAULT '',
  motorista text NOT NULL,
  transportadora text NOT NULL DEFAULT '',
  veiculo text NOT NULL DEFAULT '',
  placa text NOT NULL,
  peso_kg numeric,
  valor numeric,
  transporte text NOT NULL DEFAULT '',
  cubagem_m3 numeric,
  volumes integer NOT NULL,
  quant_nfe integer,
  lacre text NOT NULL DEFAULT '',
  paletes_total integer,
  paletes_pbr integer,
  paletes_chep integer,
  paletes_descartavel integer,
  paletes_quebrados integer,
  tem_ocorrencia boolean NOT NULL DEFAULT false,
  ocorrencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  lanc_kpi boolean NOT NULL DEFAULT false,
  lanc_controle_paletes boolean NOT NULL DEFAULT false,
  lanc_email boolean NOT NULL DEFAULT false,
  conferente text NOT NULL DEFAULT '',
  assinatura_conferente text,
  assinatura_motorista text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recebimentos TO authenticated;
GRANT ALL ON public.recebimentos TO service_role;
ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros leem recebimentos" ON public.recebimentos FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Membros inserem recebimentos" ON public.recebimentos FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()) AND criado_por = auth.uid());
CREATE POLICY "Membros editam recebimentos" ON public.recebimentos FOR UPDATE TO authenticated USING (public.is_member(auth.uid())) WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "Membros excluem recebimentos" ON public.recebimentos FOR DELETE TO authenticated USING (public.is_member(auth.uid()));
CREATE INDEX recebimentos_data_idx ON public.recebimentos (data_chegada DESC);