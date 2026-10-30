-- ==============================================================================
-- CajaGo - Migración 20261121: Gestión Financiera, Crédito, Multimoneda,
-- Rentabilidad, Materias Primas, Producción y Trazabilidad de Stock
-- ==============================================================================

-- 1. EXTENSIÓN DE CLIENTES: SISTEMA DE CRÉDITO Y LÍMITES
alter table public.customers add column if not exists credit_enabled boolean not null default false;
alter table public.customers add column if not exists credit_limit numeric not null default 0 check (credit_limit >= 0);
alter table public.customers add column if not exists credit_unlimited boolean not null default false;
alter table public.customers add column if not exists credit_terms_days integer not null default 30 check (credit_terms_days >= 0);
alter table public.customers add column if not exists credit_status text not null default 'normal' check (credit_status in ('normal', 'warn', 'blocked'));
alter table public.customers add column if not exists credit_notes text;

-- 2. EXTENSIÓN DE PROVEEDORES: CUENTA CORRIENTE Y CRÉDITO
alter table public.suppliers add column if not exists balance numeric not null default 0;
alter table public.suppliers add column if not exists credit_terms_days integer not null default 30 check (credit_terms_days >= 0);
alter table public.suppliers add column if not exists credit_limit numeric not null default 0 check (credit_limit >= 0);

-- Movimientos de cuenta corriente con proveedores
create table if not exists public.supplier_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete set null,
  type text not null check (type in ('purchase', 'payment', 'credit_note', 'debit_note', 'adjustment')),
  amount numeric not null,
  balance_after numeric not null default 0,
  document_ref text,
  due_date date,
  note text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists supplier_movements_business_supplier_idx on public.supplier_movements (business_id, supplier_id, created_at desc);

-- 3. AUDITORÍA Y AUTORIZACIONES DE CRÉDITO EXCEDIDO
create table if not exists public.credit_authorizations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  requested_amount numeric not null,
  credit_limit numeric not null,
  used_amount numeric not null,
  authorized_by uuid not null references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists credit_authorizations_business_idx on public.credit_authorizations (business_id, created_at desc);

-- 4. CUENTAS FINANCIERAS (Cajas, Bancos, Billeteras, Cripto)
create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  type text not null check (type in ('cash', 'bank', 'wallet', 'crypto', 'other')),
  currency text not null default 'ARS',
  balance numeric not null default 0,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists financial_accounts_business_idx on public.financial_accounts (business_id);

-- 5. GASTOS Y CATEGORÍAS DE GASTOS
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  is_recurring boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists expense_categories_business_idx on public.expense_categories (business_id);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.expense_categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  financial_account_id uuid references public.financial_accounts(id) on delete set null,
  date date not null default current_date,
  description text not null,
  amount numeric not null check (amount > 0),
  currency text not null default 'ARS',
  exchange_rate numeric not null default 1 check (exchange_rate > 0),
  amount_converted numeric not null check (amount_converted > 0),
  payment_method text not null default 'cash',
  voucher_number text,
  attachment_url text,
  is_recurring boolean not null default false,
  recurrence_period text check (recurrence_period in ('monthly', 'weekly', 'yearly', null)),
  status text not null default 'paid' check (status in ('paid', 'pending', 'cancelled')),
  notes text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists expenses_business_date_idx on public.expenses (business_id, date desc);

-- 6. MOVIMIENTOS FINANCIEROS UNIFICADOS (Trazabilidad caja / banco / ingresos / egresos)
create table if not exists public.financial_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  financial_account_id uuid not null references public.financial_accounts(id) on delete cascade,
  kind text not null check (kind in ('sale', 'purchase', 'expense', 'income', 'expense_manual', 'transfer_in', 'transfer_out', 'adjustment')),
  origin_type text,
  origin_id uuid,
  amount numeric not null,
  currency text not null default 'ARS',
  exchange_rate numeric not null default 1,
  amount_converted numeric not null,
  description text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists financial_movements_business_acc_idx on public.financial_movements (business_id, financial_account_id, created_at desc);

-- 7. MULTIMONEDA Y COTIZACIONES
create table if not exists public.currencies (
  code text primary key,
  name text not null,
  symbol text not null,
  is_crypto boolean not null default false,
  created_at timestamptz not null default now()
);

-- Insertar monedas principales por defecto si no existen
insert into public.currencies (code, name, symbol, is_crypto) values
  ('ARS', 'Peso Argentino', '$', false),
  ('USD', 'Dólar Estadounidense', 'US$', false),
  ('EUR', 'Euro', '€', false),
  ('BRL', 'Real Brasileño', 'R$', false),
  ('UYU', 'Peso Uruguayo', '$U', false),
  ('CLP', 'Peso Chileno', 'CLP$', false),
  ('USDT', 'Tether USD', 'USDT', true)
on conflict (code) do nothing;

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  currency_code text not null references public.currencies(code) on delete restrict,
  buy_rate numeric not null check (buy_rate > 0),
  sell_rate numeric not null check (sell_rate > 0),
  date date not null default current_date,
  source text not null default 'manual',
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists exchange_rates_business_curr_idx on public.exchange_rates (business_id, currency_code, date desc);

-- 8. EXTENSIÓN DE PRODUCTOS: MATERIA PRIMA, MULTIMONEDA Y MÁRGENES
alter table public.products add column if not exists product_type text not null default 'resale' check (product_type in ('finished', 'raw_material', 'resale', 'service', 'supply'));
alter table public.products add column if not exists currency text not null default 'ARS';
alter table public.products add column if not exists cost_price_original numeric;
alter table public.products add column if not exists sale_price_original numeric;
alter table public.products add column if not exists auto_update_price boolean not null default false;
alter table public.products add column if not exists rate_mode text default 'sell' check (rate_mode in ('buy', 'sell', 'custom'));
alter table public.products add column if not exists margin_target numeric default 0;
alter table public.products add column if not exists margin_min numeric default 0;

-- Rentabilidad histórica congelada en cada venta:
alter table public.sale_items add column if not exists cost_unit numeric not null default 0;
alter table public.sale_items add column if not exists markup numeric;
alter table public.sale_items add column if not exists margin numeric;

-- 9. RECETAS / BILL OF MATERIALS (BOM)
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  finished_product_id uuid not null references public.products(id) on delete cascade,
  yield_quantity numeric not null default 1 check (yield_quantity > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, finished_product_id)
);
create index if not exists recipes_business_idx on public.recipes (business_id);

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  raw_material_id uuid not null references public.products(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  waste_percent numeric not null default 0 check (waste_percent >= 0 and waste_percent < 100),
  created_at timestamptz not null default now()
);
create index if not exists recipe_items_recipe_idx on public.recipe_items (recipe_id);

-- 10. ÓRDENES DE PRODUCCIÓN
create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_number serial,
  finished_product_id uuid not null references public.products(id),
  recipe_id uuid references public.recipes(id),
  quantity_target numeric not null check (quantity_target > 0),
  quantity_produced numeric not null default 0 check (quantity_produced >= 0),
  status text not null default 'draft' check (status in ('draft', 'pending', 'in_production', 'completed', 'cancelled')),
  cost_estimated numeric not null default 0,
  cost_real numeric not null default 0,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  notes text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists production_orders_business_idx on public.production_orders (business_id, created_at desc);

create table if not exists public.production_order_items (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  raw_material_id uuid not null references public.products(id),
  quantity_needed numeric not null,
  quantity_consumed numeric not null default 0,
  unit_cost numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists production_order_items_order_idx on public.production_order_items (production_order_id);

-- 11. MERMAS, ROTURAS Y DESPERDICIOS (Shrinkage)
create table if not exists public.shrinkages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  quantity numeric not null check (quantity > 0),
  reason text not null check (reason in ('breakage', 'expiry', 'loss', 'production_waste', 'inventory_diff', 'other')),
  unit_cost numeric not null default 0,
  total_cost numeric not null default 0,
  notes text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists shrinkages_business_idx on public.shrinkages (business_id, created_at desc);

-- 12. HISTORIAL DE MOVIMIENTOS DE STOCK UNIFICADO
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  type text not null check (type in ('VENTA', 'COMPRA', 'TRANSFERENCIA', 'PRODUCCION', 'CONSUMO', 'MERMA', 'DEVOLUCION', 'AJUSTE', 'IMPORTACION')),
  quantity numeric not null,
  quantity_before numeric not null,
  quantity_after numeric not null,
  from_location text,
  to_location text,
  reference_id uuid,
  reference_type text,
  reason text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_business_prod_idx on public.stock_movements (business_id, product_id, created_at desc);

-- 13. AUDITORÍA GENERAL DEL SISTEMA
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_business_idx on public.audit_logs (business_id, created_at desc);

-- ==============================================================================
-- RLS (ROW LEVEL SECURITY) POLICIES
-- ==============================================================================

alter table public.supplier_movements enable row level security;
alter table public.credit_authorizations enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.financial_movements enable row level security;
alter table public.currencies enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.production_orders enable row level security;
alter table public.production_order_items enable row level security;
alter table public.shrinkages enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_logs enable row level security;

-- Currencies es catálogo público legible por cualquier usuario autenticado
drop policy if exists currencies_read on public.currencies;
create policy currencies_read on public.currencies for select using (true);

-- Macro políticas multi-tenant por negocio
do $$
declare
  tbl text;
  business_tables text[] := array[
    'supplier_movements',
    'credit_authorizations',
    'financial_accounts',
    'expense_categories',
    'expenses',
    'financial_movements',
    'exchange_rates',
    'recipes',
    'production_orders',
    'shrinkages',
    'stock_movements',
    'audit_logs'
  ];
begin
  foreach tbl in array business_tables loop
    execute format('drop policy if exists %I_business_isolation on public.%I', tbl, tbl);
    execute format(
      'create policy %I_business_isolation on public.%I
         for all
         using (business_id = public.get_user_business_id())
         with check (business_id = public.get_user_business_id())',
      tbl, tbl
    );

    execute format('drop policy if exists "Requiere suscripcion activa" on public.%I', tbl);
    execute format(
      'create policy "Requiere suscripcion activa" on public.%I as restrictive for all
         using (business_id is null or (select public.is_superadmin()) or (select public.my_business_is_active()))
         with check (business_id is null or (select public.is_superadmin()) or (select public.my_business_is_active()))',
      tbl
    );
  end loop;
end $$;

-- Recipe items y production order items verifican a través del padre
drop policy if exists recipe_items_isolation on public.recipe_items;
create policy recipe_items_isolation on public.recipe_items
  for all using (
    exists (select 1 from public.recipes r where r.id = recipe_items.recipe_id and r.business_id = public.get_user_business_id())
  );

drop policy if exists production_order_items_isolation on public.production_order_items;
create policy production_order_items_isolation on public.production_order_items
  for all using (
    exists (select 1 from public.production_orders o where o.id = production_order_items.production_order_id and o.business_id = public.get_user_business_id())
  );

