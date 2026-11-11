ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS peso_liquido_kg numeric;
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS peso_bruto_kg numeric;
ALTER TABLE public.cargas ADD COLUMN IF NOT EXISTS peso_liquido_total_kg numeric;
ALTER TABLE public.cargas ADD COLUMN IF NOT EXISTS peso_bruto_total_kg numeric;

create or replace function public.salvar_carga(_carga jsonb, _notas jsonb, _substituir boolean)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  _id uuid;
  _numero text := trim(_carga->>'numero_carga');
begin
  if not public.is_member(auth.uid()) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if _numero is null or _numero = '' then
    raise exception 'Número da carga vazio';
  end if;
  if exists (select 1 from public.cargas where numero_carga = _numero) then
    if not _substituir then
      raise exception 'CARGA_JA_EXISTE' using errcode = 'P0001';
    end if;
    delete from public.cargas where numero_carga = _numero;
  end if;

  insert into public.cargas (numero_carga, processada_por, processada_por_email, total_notas, vendas, trocas,
    bonificacoes, brindes, amostras, outras, notas_fracionadas, notas_sem_volume,
    peso_liquido_total_kg, peso_bruto_total_kg)
  values (_numero, auth.uid(), coalesce((select email from public.profiles where id = auth.uid()), ''),
    coalesce((_carga->>'total_notas')::int, 0), coalesce((_carga->>'vendas')::int, 0),
    coalesce((_carga->>'trocas')::int, 0), coalesce((_carga->>'bonificacoes')::int, 0),
    coalesce((_carga->>'brindes')::int, 0), coalesce((_carga->>'amostras')::int, 0),
    coalesce((_carga->>'outras')::int, 0), coalesce((_carga->>'notas_fracionadas')::int, 0),
    coalesce((_carga->>'notas_sem_volume')::int, 0),
    (_carga->>'peso_liquido_total_kg')::numeric, (_carga->>'peso_bruto_total_kg')::numeric)
  returning id into _id;

  insert into public.notas (carga_id, nf, pedido, numero_troca, natureza_operacao, tipo, destinatario, cidade_uf,
    valor_nf, volumes, qtde_cx, qtde_fd, qtde_un, fracionado, especie_volume, chave_acesso,
    peso_liquido_kg, peso_bruto_kg)
  select _id, coalesce(n->>'nf', ''), coalesce(n->>'pedido', ''), nullif(n->>'numero_troca', ''),
    coalesce(n->>'natureza_operacao', ''), coalesce(n->>'tipo', ''), coalesce(n->>'destinatario', ''),
    coalesce(n->>'cidade_uf', ''), coalesce((n->>'valor_nf')::numeric, 0), (n->>'volumes')::numeric,
    coalesce((n->>'qtde_cx')::numeric, 0), coalesce((n->>'qtde_fd')::numeric, 0),
    coalesce((n->>'qtde_un')::numeric, 0), coalesce((n->>'fracionado')::boolean, false),
    coalesce(n->>'especie_volume', ''), coalesce(n->>'chave_acesso', ''),
    (n->>'peso_liquido_kg')::numeric, (n->>'peso_bruto_kg')::numeric
  from jsonb_array_elements(_notas) as n;

  return _id;
end;
$$;
revoke all on function public.salvar_carga(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.salvar_carga(jsonb, jsonb, boolean) to authenticated;