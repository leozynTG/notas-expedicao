-- Papéis
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- "Autorizado" = tem qualquer papel (admin ou user)
create or replace function public.is_member(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

-- Só diz se o sistema já tem administrador (usado na tela de entrada)
create or replace function public.sistema_configurado()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where role = 'admin')
$$;
revoke all on function public.sistema_configurado() from public;
grant execute on function public.sistema_configurado() to anon, authenticated;

-- Torna o usuário administrador somente se ainda não existir nenhum (atômico)
create or replace function public.reivindicar_admin(_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  lock table public.user_roles in exclusive mode;
  if exists (select 1 from public.user_roles where role = 'admin') then
    return false;
  end if;
  insert into public.user_roles (user_id, role) values (_user_id, 'admin');
  return true;
end;
$$;
revoke all on function public.reivindicar_admin(uuid) from public, anon, authenticated;
grant execute on function public.reivindicar_admin(uuid) to service_role;

create policy "Membros veem perfis" on public.profiles
  for select to authenticated using (public.is_member(auth.uid()));

create policy "Ver os próprios papéis" on public.user_roles
  for select to authenticated using (user_id = auth.uid());
create policy "Admin vê todos os papéis" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admin remove acesso de usuários" on public.user_roles
  for delete to authenticated using (public.has_role(auth.uid(), 'admin') and role = 'user');

-- Perfil criado automaticamente para cada conta
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cargas
create table public.cargas (
  id uuid primary key default gen_random_uuid(),
  numero_carga text not null unique,
  processada_em timestamptz not null default now(),
  processada_por uuid references public.profiles(id) on delete set null,
  processada_por_email text not null default '',
  total_notas integer not null default 0,
  vendas integer not null default 0,
  trocas integer not null default 0,
  bonificacoes integer not null default 0,
  brindes integer not null default 0,
  amostras integer not null default 0,
  outras integer not null default 0,
  notas_fracionadas integer not null default 0,
  notas_sem_volume integer not null default 0
);
grant select, insert, delete on public.cargas to authenticated;
grant all on public.cargas to service_role;
alter table public.cargas enable row level security;
create policy "Membros leem cargas" on public.cargas
  for select to authenticated using (public.is_member(auth.uid()));
create policy "Membros inserem cargas" on public.cargas
  for insert to authenticated with check (public.is_member(auth.uid()) and processada_por = auth.uid());
create policy "Membros excluem cargas" on public.cargas
  for delete to authenticated using (public.is_member(auth.uid()));

create table public.notas (
  id uuid primary key default gen_random_uuid(),
  carga_id uuid not null references public.cargas(id) on delete cascade,
  nf text not null default '',
  pedido text not null default '',
  numero_troca text,
  natureza_operacao text not null default '',
  tipo text not null default '',
  destinatario text not null default '',
  cidade_uf text not null default '',
  valor_nf numeric(14,2) not null default 0,
  volumes numeric,
  qtde_cx numeric not null default 0,
  qtde_fd numeric not null default 0,
  qtde_un numeric not null default 0,
  fracionado boolean not null default false,
  especie_volume text not null default '',
  chave_acesso text not null default ''
);
create index notas_carga_id_idx on public.notas (carga_id);
grant select, insert, delete on public.notas to authenticated;
grant all on public.notas to service_role;
alter table public.notas enable row level security;
create policy "Membros leem notas" on public.notas
  for select to authenticated using (public.is_member(auth.uid()));
create policy "Membros inserem notas" on public.notas
  for insert to authenticated with check (public.is_member(auth.uid()));
create policy "Membros excluem notas" on public.notas
  for delete to authenticated using (public.is_member(auth.uid()));

-- Salva carga + notas de uma vez (com RLS do usuário). Substitui se pedido.
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
    bonificacoes, brindes, amostras, outras, notas_fracionadas, notas_sem_volume)
  values (_numero, auth.uid(), coalesce((select email from public.profiles where id = auth.uid()), ''),
    coalesce((_carga->>'total_notas')::int, 0), coalesce((_carga->>'vendas')::int, 0),
    coalesce((_carga->>'trocas')::int, 0), coalesce((_carga->>'bonificacoes')::int, 0),
    coalesce((_carga->>'brindes')::int, 0), coalesce((_carga->>'amostras')::int, 0),
    coalesce((_carga->>'outras')::int, 0), coalesce((_carga->>'notas_fracionadas')::int, 0),
    coalesce((_carga->>'notas_sem_volume')::int, 0))
  returning id into _id;

  insert into public.notas (carga_id, nf, pedido, numero_troca, natureza_operacao, tipo, destinatario, cidade_uf,
    valor_nf, volumes, qtde_cx, qtde_fd, qtde_un, fracionado, especie_volume, chave_acesso)
  select _id, coalesce(n->>'nf', ''), coalesce(n->>'pedido', ''), nullif(n->>'numero_troca', ''),
    coalesce(n->>'natureza_operacao', ''), coalesce(n->>'tipo', ''), coalesce(n->>'destinatario', ''),
    coalesce(n->>'cidade_uf', ''), coalesce((n->>'valor_nf')::numeric, 0), (n->>'volumes')::numeric,
    coalesce((n->>'qtde_cx')::numeric, 0), coalesce((n->>'qtde_fd')::numeric, 0),
    coalesce((n->>'qtde_un')::numeric, 0), coalesce((n->>'fracionado')::boolean, false),
    coalesce(n->>'especie_volume', ''), coalesce(n->>'chave_acesso', '')
  from jsonb_array_elements(_notas) as n;

  return _id;
end;
$$;
revoke all on function public.salvar_carga(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.salvar_carga(jsonb, jsonb, boolean) to authenticated;

-- Busca no histórico: número da carga, ou NF/pedido/destinatário em qualquer carga
create or replace function public.buscar_cargas(_termo text)
returns setof public.cargas language sql stable security invoker set search_path = public as $$
  select c.* from public.cargas c
  where coalesce(trim(_termo), '') = ''
     or c.numero_carga ilike '%' || trim(_termo) || '%'
     or exists (
       select 1 from public.notas n
       where n.carga_id = c.id
         and (n.nf ilike '%' || trim(_termo) || '%'
           or n.pedido ilike '%' || trim(_termo) || '%'
           or n.destinatario ilike '%' || trim(_termo) || '%')
     )
  order by c.processada_em desc
  limit 500
$$;
revoke all on function public.buscar_cargas(text) from public, anon;
grant execute on function public.buscar_cargas(text) to authenticated;
