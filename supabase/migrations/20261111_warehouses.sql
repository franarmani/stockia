-- Stock por depósito (plan Premium).
-- El "Local" no es una fila: es el stock de venta = products.stock − lo guardado en depósitos.
-- Así ventas, compras, Tiendanube y el programa sin internet siguen tocando solo products.stock.

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists warehouses_business_idx on public.warehouses (business_id);

create table if not exists public.warehouse_stock (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, product_id)
);
create index if not exists warehouse_stock_business_idx on public.warehouse_stock (business_id);

-- Historial e idempotencia (el programa puede reenviar la misma operación al recuperar internet).
create table if not exists public.warehouse_movements (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  from_warehouse_id uuid references public.warehouses(id) on delete set null,
  to_warehouse_id uuid references public.warehouses(id) on delete set null,
  kind text not null check (kind in ('transfer', 'count')),
  quantity numeric not null,
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists warehouse_movements_business_idx on public.warehouse_movements (business_id, created_at desc);

alter table public.warehouses enable row level security;
alter table public.warehouse_stock enable row level security;
alter table public.warehouse_movements enable row level security;

drop policy if exists warehouses_business_isolation on public.warehouses;
create policy warehouses_business_isolation on public.warehouses
  for all
  using (business_id = public.get_user_business_id())
  with check (business_id = public.get_user_business_id() and public.business_has_premium(business_id));

-- Las cantidades solo se cambian con las funciones de abajo.
drop policy if exists warehouse_stock_read on public.warehouse_stock;
create policy warehouse_stock_read on public.warehouse_stock
  for select using (business_id = public.get_user_business_id());

drop policy if exists warehouse_movements_read on public.warehouse_movements;
create policy warehouse_movements_read on public.warehouse_movements
  for select using (business_id = public.get_user_business_id());

do $$
declare t text;
begin
  foreach t in array array['warehouses', 'warehouse_stock', 'warehouse_movements'] loop
    execute format('drop policy if exists "Requiere suscripcion activa" on public.%I', t);
    execute format(
      'create policy "Requiere suscripcion activa" on public.%I as restrictive for all
         using (business_id is null or (select public.is_superadmin()) or (select public.my_business_is_active()))
         with check (business_id is null or (select public.is_superadmin()) or (select public.my_business_is_active()))',
      t);
  end loop;
end $$;

-- Valida negocio, plan y que el depósito sea del negocio.
create or replace function public.warehouse_check(p_business_id uuid, p_product_id uuid, p_warehouse_id uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_business_access(p_business_id);
  if not public.business_has_premium(p_business_id) then
    raise exception 'Los depósitos son del plan Premium' using errcode = '42501';
  end if;
  if not exists (select 1 from products where id = p_product_id and business_id = p_business_id) then
    raise exception 'Producto inexistente' using errcode = '42501';
  end if;
  if p_warehouse_id is not null and not exists (select 1 from warehouses where id = p_warehouse_id and business_id = p_business_id) then
    raise exception 'Depósito inexistente' using errcode = '42501';
  end if;
end $$;

-- Pasa mercadería entre el Local (null) y los depósitos. No cambia el stock total.
create or replace function public.warehouse_transfer(
  p_id uuid, p_business_id uuid, p_product_id uuid, p_from uuid, p_to uuid, p_quantity numeric
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_available numeric;
begin
  perform public.warehouse_check(p_business_id, p_product_id, p_from);
  perform public.warehouse_check(p_business_id, p_product_id, p_to);
  if p_quantity is null or p_quantity <= 0 then raise exception 'Cantidad inválida'; end if;
  if p_from is not distinct from p_to then raise exception 'Elegí depósitos distintos'; end if;

  insert into warehouse_movements (id, business_id, product_id, from_warehouse_id, to_warehouse_id, kind, quantity)
  values (p_id, p_business_id, p_product_id, p_from, p_to, 'transfer', p_quantity)
  on conflict (id) do nothing;
  if not found then return; end if;

  perform 1 from products where id = p_product_id for update;
  if p_from is null then
    select p.stock - coalesce((select sum(quantity) from warehouse_stock where product_id = p_product_id), 0)
      into v_available from products p where p.id = p_product_id;
  else
    select coalesce((select quantity from warehouse_stock where warehouse_id = p_from and product_id = p_product_id), 0)
      into v_available;
  end if;
  if v_available < p_quantity then
    raise exception 'No hay stock suficiente (disponible: %)', greatest(v_available, 0);
  end if;

  if p_from is not null then
    update warehouse_stock set quantity = quantity - p_quantity, updated_at = now()
    where warehouse_id = p_from and product_id = p_product_id;
  end if;
  if p_to is not null then
    insert into warehouse_stock (business_id, warehouse_id, product_id, quantity)
    values (p_business_id, p_to, p_product_id, p_quantity)
    on conflict (warehouse_id, product_id) do update set quantity = warehouse_stock.quantity + excluded.quantity, updated_at = now();
  end if;
end $$;

-- Recuento: deja la cantidad contada en un depósito y ajusta el stock total por la diferencia.
create or replace function public.warehouse_set_quantity(
  p_id uuid, p_business_id uuid, p_product_id uuid, p_warehouse_id uuid, p_quantity numeric
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_current numeric;
  v_delta numeric;
  v_name text;
begin
  if p_warehouse_id is null then raise exception 'Elegí un depósito'; end if;
  perform public.warehouse_check(p_business_id, p_product_id, p_warehouse_id);
  if p_quantity is null or p_quantity < 0 then raise exception 'Cantidad inválida'; end if;

  perform 1 from products where id = p_product_id for update;
  select coalesce((select quantity from warehouse_stock where warehouse_id = p_warehouse_id and product_id = p_product_id), 0)
    into v_current;
  v_delta := p_quantity - v_current;

  insert into warehouse_movements (id, business_id, product_id, to_warehouse_id, kind, quantity)
  values (p_id, p_business_id, p_product_id, p_warehouse_id, 'count', v_delta)
  on conflict (id) do nothing;
  if not found or v_delta = 0 then return; end if;

  insert into warehouse_stock (business_id, warehouse_id, product_id, quantity)
  values (p_business_id, p_warehouse_id, p_product_id, p_quantity)
  on conflict (warehouse_id, product_id) do update set quantity = excluded.quantity, updated_at = now();

  update products set stock = stock + v_delta where id = p_product_id;

  select name into v_name from warehouses where id = p_warehouse_id;
  insert into stock_movements (business_id, product_id, type, quantity, qty_delta, notes, user_id)
  values (p_business_id, p_product_id, 'adjustment', round(v_delta)::int, v_delta, 'Recuento en depósito ' || v_name, auth.uid());
end $$;

revoke all on function public.warehouse_check(uuid, uuid, uuid) from public, anon;
revoke all on function public.warehouse_transfer(uuid, uuid, uuid, uuid, uuid, numeric) from public, anon;
revoke all on function public.warehouse_set_quantity(uuid, uuid, uuid, uuid, numeric) from public, anon;
grant execute on function public.warehouse_transfer(uuid, uuid, uuid, uuid, uuid, numeric) to authenticated;
grant execute on function public.warehouse_set_quantity(uuid, uuid, uuid, uuid, numeric) to authenticated;
