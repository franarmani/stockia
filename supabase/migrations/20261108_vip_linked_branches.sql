-- Sucursales vinculadas (billing_group) incluidas solo en el VIP: un pago VIP extiende a todo el grupo;
-- en Básico y Premium cada negocio se paga y se extiende por separado.

create or replace function public.apply_mp_subscription_payment(p_business_id uuid, p_preapproval_id text, p_mp_payment_id text, p_amount numeric, p_paid_at timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_group text;
  v_plan text;
  v_until timestamptz;
begin
  insert into mp_subscription_payments (business_id, mp_payment_id, mp_preapproval_id, amount, paid_at)
  values (p_business_id, p_mp_payment_id, p_preapproval_id, p_amount, p_paid_at)
  on conflict (mp_payment_id) do nothing;

  -- Ya aplicado antes: no se extiende de nuevo.
  if not found then return false; end if;

  select billing_group, coalesce(mp_plan, plan) into v_group, v_plan from businesses where id = p_business_id;

  update businesses
  set subscription_status = 'active',
      plan = case when id = p_business_id then v_plan else plan end,
      trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + interval '1 month'
  where id = p_business_id
     or (v_plan = 'vip' and v_group is not null and billing_group = v_group);

  select trial_ends_at into v_until from businesses where id = p_business_id;
  update mp_subscription_payments set extended_until = v_until where mp_payment_id = p_mp_payment_id;
  return true;
end $$;

revoke execute on function public.apply_mp_subscription_payment(uuid, text, text, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_mp_subscription_payment(uuid, text, text, numeric, timestamptz) to service_role;

create or replace function public.approve_payment_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r payment_requests;
  v_group text;
  v_plan text;
begin
  if not public.is_superadmin() and coalesce(auth.role(), 'none') <> 'service_role' then
    raise exception 'Solo el administrador puede aprobar pagos' using errcode = '42501';
  end if;

  select * into r from payment_requests where id = p_request_id for update;
  if not found then raise exception 'Pago no encontrado'; end if;
  if r.reviewed_at is not null and r.status = 'approved' then return; end if;

  update payment_requests set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid() where id = r.id;

  select billing_group, case when r.plan in ('basic', 'premium', 'vip') then r.plan else plan end
    into v_group, v_plan from businesses where id = r.business_id;

  update businesses set
    subscription_status = 'active',
    trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + interval '30 days',
    plan = case when id = r.business_id then v_plan else plan end,
    pending_discount_pct = 0,
    pending_discount_note = null
  where id = r.business_id or (v_plan = 'vip' and v_group is not null and billing_group = v_group);

  update referrals set referrer_rewarded = true where referrer_business_id = r.business_id;
  update referrals set referred_rewarded = true where referred_business_id = r.business_id;
end $$;

revoke execute on function public.approve_payment_request(uuid) from public, anon;
grant execute on function public.approve_payment_request(uuid) to authenticated, service_role;
