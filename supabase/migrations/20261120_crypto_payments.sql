-- Pagos internacionales en USDT (manual). Nada de claves privadas ni seed phrases: solo la dirección de
-- RECEPCIÓN del dueño de CajaGo. El cliente informa el pago, el administrador lo verifica a mano.
-- `provider` y `provider_ref` dejan lista la tabla para reemplazar el paso manual por una pasarela
-- automática (el webhook de la pasarela llamaría a la misma función de aprobación).

create table if not exists public.crypto_settings (
  id text primary key default 'main' check (id = 'main'),   -- una sola fila
  enabled boolean not null default false,
  wallet_address text,
  network text,
  platform text,
  instructions text,
  price_basic_usdt numeric(12,2) check (price_basic_usdt is null or price_basic_usdt > 0),
  price_premium_usdt numeric(12,2) check (price_premium_usdt is null or price_premium_usdt > 0),
  price_vip_usdt numeric(12,2) check (price_vip_usdt is null or price_vip_usdt > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
insert into public.crypto_settings (id) values ('main') on conflict do nothing;

create table if not exists public.crypto_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid default auth.uid(),
  plan text not null check (plan in ('basic', 'premium', 'vip')),
  expected_usdt numeric(12,2) not null,
  network text,
  wallet_address text,                       -- dirección vigente cuando el cliente pagó
  received_usdt numeric(14,2),
  tx_hash text check (tx_hash is null or length(tx_hash) <= 200),
  paid_at timestamptz,
  customer_note text check (customer_note is null or length(customer_note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  provider text not null default 'manual_usdt',
  provider_ref text,
  created_at timestamptz not null default now()
);
create index if not exists crypto_payments_business_idx on public.crypto_payments (business_id, created_at desc);
create index if not exists crypto_payments_status_idx on public.crypto_payments (status, created_at desc);
-- Un mismo hash no puede acreditar dos pagos.
create unique index if not exists crypto_payments_tx_uidx on public.crypto_payments (lower(tx_hash)) where tx_hash is not null and status <> 'rejected';

alter table public.crypto_settings enable row level security;
alter table public.crypto_payments enable row level security;

-- Cualquier usuario ve la configuración (la dirección de depósito y los precios son públicos para quien paga).
drop policy if exists crypto_settings_read on public.crypto_settings;
create policy crypto_settings_read on public.crypto_settings for select to authenticated using (true);
drop policy if exists crypto_settings_admin on public.crypto_settings;
create policy crypto_settings_admin on public.crypto_settings for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Cada negocio ve solo sus pagos; el superadmin ve todos. Las altas y los cambios van por las funciones.
-- (Sin la política "Requiere suscripción activa": una cuenta vencida tiene que poder pagar.)
drop policy if exists crypto_payments_read on public.crypto_payments;
create policy crypto_payments_read on public.crypto_payments for select to authenticated
  using (business_id = public.get_user_business_id() or public.is_superadmin());

-- El cliente informa que pagó. Nunca activa nada por sí mismo.
create or replace function public.report_crypto_payment(p_plan text, p_tx_hash text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := public.get_user_business_id();
  v_settings crypto_settings;
  v_price numeric;
  v_id uuid;
  v_hash text := nullif(trim(coalesce(p_tx_hash, '')), '');
begin
  if auth.uid() is null or v_business is null then raise exception 'Acceso denegado' using errcode = '42501'; end if;
  if p_plan not in ('basic', 'premium', 'vip') then raise exception 'Plan inválido'; end if;
  select * into v_settings from crypto_settings where id = 'main';
  if not coalesce(v_settings.enabled, false) or v_settings.wallet_address is null then
    raise exception 'El pago en USDT no está disponible por ahora';
  end if;
  v_price := case p_plan when 'basic' then v_settings.price_basic_usdt when 'premium' then v_settings.price_premium_usdt else v_settings.price_vip_usdt end;
  if v_price is null then raise exception 'Ese plan no tiene precio en USDT'; end if;
  if (select count(*) from crypto_payments where business_id = v_business and status = 'pending') >= 3 then
    raise exception 'Ya tenés pagos pendientes de verificación. Esperá a que los revisemos.';
  end if;
  if v_hash is not null and exists (select 1 from crypto_payments where lower(tx_hash) = lower(v_hash) and status <> 'rejected') then
    raise exception 'Ese hash de transacción ya fue informado';
  end if;

  insert into crypto_payments (business_id, plan, expected_usdt, network, wallet_address, tx_hash, customer_note)
  values (v_business, p_plan, v_price, v_settings.network, v_settings.wallet_address, v_hash, left(p_note, 500))
  returning id into v_id;
  return v_id;
end $$;

-- El administrador aprueba o rechaza. Aprobar activa/renueva la suscripción (misma regla que los pagos por transferencia).
create or replace function public.review_crypto_payment(
  p_id uuid, p_action text, p_received numeric default null, p_tx_hash text default null, p_paid_at timestamptz default null, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  r crypto_payments;
  v_group text;
  v_plan text;
begin
  if not public.is_superadmin() and coalesce(auth.role(), 'none') <> 'service_role' then
    raise exception 'Solo el administrador puede revisar pagos' using errcode = '42501';
  end if;
  if p_action not in ('approve', 'reject') then raise exception 'Acción inválida'; end if;

  select * into r from crypto_payments where id = p_id for update;
  if not found then raise exception 'Pago no encontrado'; end if;
  if r.status <> 'pending' then return; end if;   -- ya revisado: no se acredita dos veces

  if p_action = 'reject' then
    update crypto_payments set status = 'rejected', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now() where id = r.id;
    return;
  end if;

  update crypto_payments set
    status = 'approved',
    received_usdt = coalesce(p_received, expected_usdt),
    tx_hash = coalesce(nullif(trim(coalesce(p_tx_hash, '')), ''), tx_hash),
    paid_at = coalesce(p_paid_at, paid_at, now()),
    admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = r.id;

  select billing_group, plan into v_group, v_plan from businesses where id = r.business_id;
  update businesses set
    subscription_status = 'active',
    trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + interval '30 days',
    plan = case when id = r.business_id then r.plan else plan end,
    pending_discount_pct = 0,
    pending_discount_note = null
  where id = r.business_id or (r.plan = 'vip' and v_group is not null and billing_group = v_group);
end $$;

revoke all on function public.report_crypto_payment(text, text, text) from public, anon;
revoke all on function public.review_crypto_payment(uuid, text, numeric, text, timestamptz, text) from public, anon;
grant execute on function public.report_crypto_payment(text, text, text) to authenticated;
grant execute on function public.review_crypto_payment(uuid, text, numeric, text, timestamptz, text) to authenticated, service_role;

-- Aviso al dueño (Telegram) cuando un cliente informa un pago en USDT
create or replace function public.alert_on_crypto_payment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_admin_alert('pago_informado', new.business_id,
    jsonb_build_object('amount', new.expected_usdt, 'plan', new.plan, 'currency', 'USDT', 'network', new.network, 'tx_hash', new.tx_hash));
  return new;
end $$;
drop trigger if exists admin_alert_crypto_payment on public.crypto_payments;
create trigger admin_alert_crypto_payment after insert on public.crypto_payments
  for each row execute function public.alert_on_crypto_payment();
