-- Integración con Tiendanube (plan VIP): ventas pagadas entran a CajaGo y el stock de CajaGo
-- se replica en Tiendanube. Las credenciales y el estado viven solo en el servidor.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Una tienda por negocio. Sin políticas: solo la leen las edge functions.
create table if not exists public.tiendanube_connections (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  store_id bigint not null unique,
  access_token text not null,
  scope text,
  store_name text,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text
);
alter table public.tiendanube_connections enable row level security;

create table if not exists public.tiendanube_oauth_states (
  state text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.tiendanube_oauth_states enable row level security;

-- Producto de CajaGo ↔ variante de Tiendanube.
create table if not exists public.tiendanube_product_links (
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  tn_product_id bigint not null,
  tn_variant_id bigint not null,
  linked_by text not null default 'sku',
  primary key (business_id, tn_variant_id)
);
create index if not exists tiendanube_product_links_product on public.tiendanube_product_links (product_id);
alter table public.tiendanube_product_links enable row level security;

-- Pedidos recibidos (también sirve para no registrar dos veces el mismo pedido).
create table if not exists public.tiendanube_orders (
  business_id uuid not null references public.businesses(id) on delete cascade,
  tn_order_id bigint not null,
  order_number text,
  customer_name text,
  total numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  sale_id uuid references public.sales(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (business_id, tn_order_id)
);
alter table public.tiendanube_orders enable row level security;
drop policy if exists "Members read their Tiendanube orders" on public.tiendanube_orders;
create policy "Members read their Tiendanube orders" on public.tiendanube_orders for select
  using (business_id = public.get_user_business_id());
drop policy if exists "Requiere suscripcion activa" on public.tiendanube_orders;
create policy "Requiere suscripcion activa" on public.tiendanube_orders as restrictive for all
  using ((select public.is_superadmin()) or (select public.my_business_is_active()))
  with check ((select public.is_superadmin()) or (select public.my_business_is_active()));

-- Stock pendiente de mandar a Tiendanube.
create table if not exists public.tiendanube_stock_queue (
  product_id uuid primary key references public.products(id) on delete cascade,
  business_id uuid not null,
  queued_at timestamptz not null default now()
);
alter table public.tiendanube_stock_queue enable row level security;

create or replace function public.tiendanube_enqueue_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock is distinct from old.stock
     and exists (select 1 from tiendanube_product_links l where l.product_id = new.id) then
    insert into tiendanube_stock_queue (product_id, business_id) values (new.id, new.business_id)
    on conflict (product_id) do update set queued_at = now();
  end if;
  return null;
end $$;

drop trigger if exists tiendanube_enqueue_stock on public.products;
create trigger tiendanube_enqueue_stock after update of stock on public.products
  for each row execute function public.tiendanube_enqueue_stock();

-- Registra un pedido pagado como venta: líneas, descuento de stock y movimientos. Idempotente.
-- p_lines: [{ product_id, name, quantity, price }] (product_id null = producto sin vincular).
create or replace function public.tiendanube_record_order(
  p_business_id uuid, p_tn_order_id bigint, p_number text, p_customer text, p_total numeric, p_lines jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_sale uuid;
  v_seller uuid;
  v_cost numeric := 0;
  line jsonb;
  v_qty integer;
  v_price numeric;
  v_unit_cost numeric;
begin
  if coalesce(auth.role(), 'none') not in ('service_role', 'none') then
    raise exception 'Solo el servidor registra pedidos de Tiendanube' using errcode = '42501';
  end if;

  select sale_id into v_existing from tiendanube_orders where business_id = p_business_id and tn_order_id = p_tn_order_id;
  if found then return v_existing; end if;

  select id into v_seller from users where business_id = p_business_id order by (role = 'admin') desc, created_at limit 1;

  insert into sales (business_id, total, payment_method, seller_id, note)
  values (p_business_id, p_total, 'transfer', v_seller, left('Tiendanube #' || coalesce(p_number, p_tn_order_id::text) || coalesce(' · ' || p_customer, ''), 200))
  returning id into v_sale;

  for line in select * from jsonb_array_elements(p_lines) loop
    continue when line->>'product_id' is null;
    v_qty := greatest(1, round((line->>'quantity')::numeric))::integer;
    v_price := coalesce((line->>'price')::numeric, 0);
    select coalesce(purchase_price, 0) into v_unit_cost from products where id = (line->>'product_id')::uuid and business_id = p_business_id;
    continue when not found;

    insert into sale_items (sale_id, product_id, quantity, price, cost_at_sale)
    values (v_sale, (line->>'product_id')::uuid, v_qty, v_price, v_unit_cost);
    v_cost := v_cost + v_unit_cost * v_qty;

    update products set stock = greatest(0, stock - v_qty) where id = (line->>'product_id')::uuid and business_id = p_business_id;
    insert into stock_movements (business_id, product_id, type, quantity, qty_delta, reference_id, notes)
    values (p_business_id, (line->>'product_id')::uuid, 'sale', -v_qty, -v_qty, v_sale, 'Tiendanube #' || coalesce(p_number, p_tn_order_id::text));
  end loop;

  update sales set total_cost = v_cost, total_profit = p_total - v_cost where id = v_sale;

  insert into tiendanube_orders (business_id, tn_order_id, order_number, customer_name, total, items, sale_id)
  values (p_business_id, p_tn_order_id, p_number, p_customer, p_total, p_lines, v_sale);
  return v_sale;
end $$;

revoke execute on function public.tiendanube_record_order(uuid, bigint, text, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.tiendanube_record_order(uuid, bigint, text, text, numeric, jsonb) to service_role;
revoke execute on function public.tiendanube_enqueue_stock() from public, anon, authenticated;

-- Cada minuto, si hay stock pendiente, se despierta al worker. El secreto vive en Vault
-- (nombre 'tiendanube_cron_secret') y el mismo valor en el secreto TIENDANUBE_CRON_SECRET de las funciones.
select cron.unschedule('tiendanube-stock-push') where exists (select 1 from cron.job where jobname = 'tiendanube-stock-push');
select cron.schedule('tiendanube-stock-push', '* * * * *', $cron$
  select net.http_post(
    url := 'https://mrpenblsmooeqzegtcqp.supabase.co/functions/v1/tiendanube-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cajago-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'tiendanube_cron_secret')),
    body := '{}'::jsonb)
  where exists (select 1 from public.tiendanube_stock_queue)
$cron$);
