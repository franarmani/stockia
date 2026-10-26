-- Tercer plan: VIP ($110.000). Básico 2 usuarios, Premium 5, VIP y prueba sin límite.

alter table public.businesses drop constraint if exists businesses_mp_plan_check;
alter table public.businesses add constraint businesses_mp_plan_check
  check (mp_plan is null or mp_plan in ('basic', 'premium', 'vip'));

-- null = sin límite. Mismos topes que PLAN_LIMITS en src/config/plans.ts.
create or replace function public.business_user_limit(p_business_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case
    when b.subscription_status = 'trial' or b.plan = 'vip' then null
    when b.plan = 'basic' then 2
    else 5
  end
  from businesses b where b.id = p_business_id
$$;

revoke execute on function public.business_user_limit(uuid) from public, anon;
grant execute on function public.business_user_limit(uuid) to authenticated, service_role;

drop policy if exists "Admins add users to their business" on public.users;
create policy "Admins add users to their business" on public.users for insert
  with check (
    business_id = public.get_user_business_id()
    and public.my_role() = 'admin'
    and public.my_business_is_active()
    and (public.business_user_limit(business_id) is null
         or public.business_member_count(business_id) < public.business_user_limit(business_id))
  );

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
    plan = case when id = r.business_id and r.plan in ('basic', 'premium', 'vip') then r.plan else plan end,
    pending_discount_pct = 0,
    pending_discount_note = null
  where id = r.business_id or (v_group is not null and billing_group = v_group);

  update referrals set referrer_rewarded = true where referrer_business_id = r.business_id;
  update referrals set referred_rewarded = true where referred_business_id = r.business_id;
end $$;
