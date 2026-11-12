create or replace function public.dashboard_cargas(_de timestamptz, _ate timestamptz)
returns jsonb language sql stable security invoker set search_path = public as $$
  with c as (
    select id, numero_carga, processada_em from public.cargas
    where (_de is null or processada_em >= _de) and (_ate is null or processada_em < _ate)
  ),
  pc as (
    select c.id, c.numero_carga, c.processada_em,
      count(n.id)::int as notas,
      (count(n.id) filter (where n.tipo = 'Troca'))::int as trocas,
      coalesce(sum(n.valor_nf), 0) as valor,
      coalesce(sum(n.valor_nf) filter (where n.tipo = 'Troca'), 0) as valor_trocas,
      coalesce(sum(n.volumes), 0) as volumes,
      sum(n.peso_bruto_kg) as peso_bruto,
      sum(n.peso_liquido_kg) as peso_liquido,
      (count(n.id) filter (where n.peso_bruto_kg is null))::int as notas_sem_peso_bruto,
      (count(n.id) filter (where n.peso_liquido_kg is null))::int as notas_sem_peso_liquido
    from c left join public.notas n on n.carga_id = c.id
    group by c.id, c.numero_carga, c.processada_em
  ),
  cid as (
    select n.carga_id, n.cidade_uf, count(*)::int as notas, coalesce(sum(n.valor_nf), 0) as valor
    from public.notas n join c on c.id = n.carga_id
    group by n.carga_id, n.cidade_uf
  )
  select jsonb_build_object(
    'cargas', coalesce((select jsonb_agg(to_jsonb(pc) order by pc.processada_em) from pc), '[]'::jsonb),
    'cidades', coalesce((select jsonb_agg(to_jsonb(cid)) from cid), '[]'::jsonb)
  )
$$;
revoke all on function public.dashboard_cargas(timestamptz, timestamptz) from public, anon;
grant execute on function public.dashboard_cargas(timestamptz, timestamptz) to authenticated;