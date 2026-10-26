-- Seguridad: aislamiento entre negocios, datos de suscripción protegidos y bloqueo real por falta de pago.
--
-- Antes de esto: cualquier usuario podía leer todos los negocios, sumarse a un negocio ajeno,
-- activarse la suscripción desde el navegador y llamar funciones privilegiadas sobre otros negocios.

-- ─────────────────────────────────────────────────────────────
-- 1. Funciones auxiliares
-- ─────────────────────────────────────────────────────────────

alter table public.businesses add column if not exists created_by uuid default auth.uid();

-- Vigencia del servicio. 'active' vence en trial_ends_at más 3 días de gracia (sin fecha = sin vencimiento,
-- solo lo puede poner el superadmin); la prueba vence en trial_ends_at; 'expired' siempre bloquea.
create or replace function public.business_is_active(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when b.subscription_status = 'expired' then false
      when b.subscription_status = 'active' then b.trial_ends_at is null or b.trial_ends_at + interval '3 days' > now()
      else b.trial_ends_at is not null and b.trial_ends_at > now()
    end
    from businesses b where b.id = p_business_id
  ), false)
$$;

create or replace function public.my_business_is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select public.business_is_active(public.get_user_business_id())
$$;

create or replace function public.business_has_premium(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select b.plan is distinct from 'basic' or b.subscription_status = 'trial' from businesses b where b.id = p_business_id), false)
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from users where id = auth.uid()
$$;

create or replace function public.business_member_count(p_business_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from users where business_id = p_business_id
$$;

create or replace function public.business_created_by(p_business_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select created_by from businesses where id = p_business_id
$$;

-- Llamadas del servidor (service_role, cron, consola) o del superadmin: sin restricciones.
create or replace function public.is_trusted_caller()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.role(), 'none') in ('service_role', 'none') or public.is_superadmin()
$$;

-- Para funciones privilegiadas: solo el propio negocio y con la suscripción al día.
create or replace function public.assert_business_access(p_business_id uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_trusted_caller() then return; end if;
  if p_business_id is null or p_business_id is distinct from public.get_user_business_id() then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;
  if not public.business_is_active(p_business_id) then
    raise exception 'La suscripción de este negocio está vencida' using errcode = '42501';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Negocios: solo el propio, y la suscripción no se toca desde el cliente
-- ─────────────────────────────────────────────────────────────

-- Invoker a propósito: current_user distingue al cliente (authenticated/anon) de las funciones del servidor.
create or replace function public.protect_business_billing()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_trusted_caller() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.subscription_status := 'trial';
    new.trial_ends_at := now() + interval '5 days';
    new.plan := 'premium';
    new.billing_group := null;
    new.referral_code := null;
    new.pending_discount_pct := 0;
    new.pending_discount_note := null;
    new.mp_preapproval_id := null;
    new.mp_subscription_status := null;
    new.mp_payer_email := null;
    new.mp_next_payment_at := null;
    new.mp_plan := null;
    return new;
  end if;

  -- Se restauran en silencio: el cliente a veces reenvía la fila completa con valores viejos.
  new.id := old.id;
  new.created_by := old.created_by;
  new.subscription_status := old.subscription_status;
  new.trial_ends_at := old.trial_ends_at;
  new.plan := old.plan;
  new.billing_group := old.billing_group;
  new.referral_code := old.referral_code;
  new.pending_discount_pct := old.pending_discount_pct;
  new.pending_discount_note := old.pending_discount_note;
  new.mp_preapproval_id := old.mp_preapproval_id;
  new.mp_subscription_status := old.mp_subscription_status;
  new.mp_payer_email := old.mp_payer_email;
  new.mp_next_payment_at := old.mp_next_payment_at;
  new.mp_plan := old.mp_plan;
  return new;
end $$;

drop trigger if exists protect_business_billing on public.businesses;
create trigger protect_business_billing before insert or update on public.businesses
  for each row execute function public.protect_business_billing();

drop policy if exists "Authenticated users can view businesses" on public.businesses;
drop policy if exists "Members can view their business" on public.businesses;
create policy "Members can view their business" on public.businesses for select
  using (id = public.get_user_business_id() or created_by = auth.uid());

drop policy if exists "Authenticated users can insert a business" on public.businesses;
drop policy if exists "Users without business can create one" on public.businesses;
create policy "Users without business can create one" on public.businesses for insert
  with check (auth.uid() is not null and public.get_user_business_id() is null);

-- ─────────────────────────────────────────────────────────────
-- 3. Usuarios: nadie se suma a un negocio ajeno ni se sube el rol
-- ─────────────────────────────────────────────────────────────

create or replace function public.protect_user_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_trusted_caller() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_superadmin := false;
    return new;
  end if;

  new.id := old.id;
  new.business_id := old.business_id;
  new.is_superadmin := old.is_superadmin;
  if public.my_role() is distinct from 'admin' then
    new.role := old.role;
  end if;
  return new;
end $$;

drop trigger if exists protect_user_fields on public.users;
create trigger protect_user_fields before insert or update on public.users
  for each row execute function public.protect_user_fields();

drop policy if exists "Users can insert their own profile" on public.users;
drop policy if exists "Owner creates own profile for new business" on public.users;
drop policy if exists "Admins add users to their business" on public.users;
create policy "Owner creates own profile for new business" on public.users for insert
  with check (
    id = auth.uid()
    and role = 'admin'
    and public.get_user_business_id() is null
    and public.business_created_by(business_id) = auth.uid()
    and public.business_member_count(business_id) = 0
  );
create policy "Admins add users to their business" on public.users for insert
  with check (
    business_id = public.get_user_business_id()
    and public.my_role() = 'admin'
    and public.my_business_is_active()
    and (public.business_has_premium(business_id) or public.business_member_count(business_id) < 2)
  );

drop policy if exists "Admins can update users in their business" on public.users;
drop policy if exists "Users update self, admins update team" on public.users;
create policy "Users update self, admins update team" on public.users for update
  using (business_id = public.get_user_business_id() and (id = auth.uid() or public.my_role() = 'admin'))
  with check (business_id = public.get_user_business_id());

drop policy if exists "Admins can delete users in their business" on public.users;
drop policy if exists "Admins delete other users in their business" on public.users;
create policy "Admins delete other users in their business" on public.users for delete
  using (business_id = public.get_user_business_id() and public.my_role() = 'admin' and id <> auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 4. Bloqueo por falta de pago en todas las tablas del negocio
-- ─────────────────────────────────────────────────────────────
-- Política restrictiva: se suma (AND) a las existentes. Las tablas hijas sin business_id (sale_items,
-- cash_movements, invoice_items...) quedan cubiertas porque sus políticas consultan la tabla padre.
-- Quedan afuera las tablas necesarias para ver el vencimiento y pagar.

do $$
declare r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'business_id' and t.table_type = 'BASE TABLE'
      and c.table_name not in ('users', 'mp_subscription_payments', 'payment_requests', 'notifications', 'referrals')
  loop
    execute format('drop policy if exists "Requiere suscripcion activa" on public.%I', r.table_name);
    execute format(
      'create policy "Requiere suscripcion activa" on public.%I as restrictive for all
         using (business_id is null or (select public.is_superadmin()) or (select public.my_business_is_active()))
         with check (business_id is null or (select public.is_superadmin()) or (select public.my_business_is_active()))',
      r.table_name);
  end loop;
end $$;

-- Límite del plan Básico también en el servidor.
create or replace function public.enforce_basic_product_limit()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_trusted_caller() then return new; end if;
  if public.business_has_premium(new.business_id) then return new; end if;
  if (select count(*) from products where business_id = new.business_id and active is not false) >= 500 then
    raise exception 'El plan Básico permite hasta 500 productos' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists enforce_basic_product_limit on public.products;
create trigger enforce_basic_product_limit before insert on public.products
  for each row execute function public.enforce_basic_product_limit();

-- ─────────────────────────────────────────────────────────────
-- 5. Funciones privilegiadas: nada para anónimos, y solo sobre el propio negocio al día
-- ─────────────────────────────────────────────────────────────

do $$
declare f record;
begin
  for f in
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', f.oid::regprocedure);
    execute format('grant execute on function %s to authenticated, service_role', f.oid::regprocedure);
  end loop;
end $$;

-- Las que usan las políticas también las evalúa el rol anónimo.
grant execute on function public.get_user_business_id() to anon;
grant execute on function public.is_superadmin() to anon;
grant execute on function public.has_permission(text) to anon;
grant execute on function public.my_business_is_active() to anon;
grant execute on function public.business_is_active(uuid) to anon;

-- Sin uso desde el cliente o peligrosas: solo el servidor.
revoke execute on function public.deduct_stock(uuid, integer) from authenticated;
revoke execute on function public.validate_stock(uuid, integer) from authenticated;
revoke execute on function public.extend_linked_subscriptions() from authenticated;
revoke execute on function public.apply_mp_subscription_payment(uuid, text, text, numeric, timestamptz) from authenticated;

-- Control de acceso al principio de cada función que trabaja sobre un negocio.
do $$
declare
  f record;
  def text;
  arg text;
begin
  for f in
    select p.oid, p.proname from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.prokind = 'f'
      and p.proname in (
        'apply_account_payment', 'charge_customer_account', 'ensure_referral_code', 'generate_daily_summary',
        'generate_notifications', 'next_accounting_entry_number', 'next_quote_number', 'redeem_referral_code',
        'seed_purchases_accounting', 'confirm_accounting_entry', 'create_entry_from_purchase',
        'create_manual_accounting_entry', 'create_purchase_document', 'record_customer_collection',
        'record_supplier_payment', 'reverse_accounting_entry', 'void_purchase_document')
  loop
    def := pg_get_functiondef(f.oid);
    continue when position('assert_business_access' in def) > 0;
    arg := case when def ~ '\mp_business_id\M' then 'p_business_id' else 'public.get_user_business_id()' end;
    def := regexp_replace(def, '(\$function\$.*?\mBEGIN\M)', E'\\1\n  PERFORM public.assert_business_access(' || arg || E');', 'i');
    execute def;
  end loop;
end $$;

create or replace function public.top_selling_products(p_business_id uuid, p_days integer default 7, p_limit integer default 10)
returns table(product_id uuid, product_name text, total_qty numeric, total_revenue numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_business_access(p_business_id);
  return query
    select p.id, p.name::text, sum(si.quantity)::numeric, sum(si.quantity * si.price)::numeric
    from sale_items si join sales s on s.id = si.sale_id join products p on p.id = si.product_id
    where s.business_id = p_business_id and s.voided = false
      and s.created_at >= now() - (p_days || ' days')::interval
    group by p.id, p.name order by sum(si.quantity) desc limit p_limit;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 6. Pagos informados: quedan pendientes hasta que el superadmin los aprueba
-- ─────────────────────────────────────────────────────────────

alter table public.payment_requests add column if not exists plan text;

drop policy if exists "Payment requests start pending" on public.payment_requests;
create policy "Payment requests start pending" on public.payment_requests as restrictive for insert
  with check (status = 'pending' or public.is_superadmin());

create or replace function public.approve_payment_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r payment_requests;
  v_group text;
begin
  if not public.is_superadmin() and coalesce(auth.role(), 'none') <> 'service_role' then
    raise exception 'Solo el administrador puede aprobar pagos' using errcode = '42501';
  end if;

  select * into r from payment_requests where id = p_request_id for update;
  if not found then raise exception 'Pago no encontrado'; end if;
  if r.reviewed_at is not null and r.status = 'approved' then return; end if;

  update payment_requests set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid() where id = r.id;

  select billing_group into v_group from businesses where id = r.business_id;
  update businesses set
    subscription_status = 'active',
    trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + interval '30 days',
    plan = case when id = r.business_id and r.plan in ('basic', 'premium') then r.plan else plan end,
    pending_discount_pct = 0,
    pending_discount_note = null
  where id = r.business_id or (v_group is not null and billing_group = v_group);

  update referrals set referrer_rewarded = true where referrer_business_id = r.business_id;
  update referrals set referred_rewarded = true where referred_business_id = r.business_id;
end $$;

revoke execute on function public.approve_payment_request(uuid) from public, anon;
grant execute on function public.approve_payment_request(uuid) to authenticated, service_role;

-- Comprobantes: cada negocio sube solo en su carpeta; los ve su negocio y el superadmin.
drop policy if exists "payment_proofs_upload" on storage.objects;
create policy "payment_proofs_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = public.get_user_business_id()::text);
drop policy if exists "payment_proofs_read" on storage.objects;
create policy "payment_proofs_read" on storage.objects for select
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = public.get_user_business_id()::text or public.is_superadmin()));
