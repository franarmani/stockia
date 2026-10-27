-- Varios locales (VIP): ver el resumen de cada local vinculado (billing_group) y cambiar de local.

create or replace function public.business_has_vip(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select b.plan = 'vip' or b.subscription_status = 'trial' from businesses b where b.id = p_business_id), false)
$$;

-- Locales del grupo del usuario (incluido el actual) con sus números del día y del mes.
create or replace function public.linked_business_summaries()
returns table (
  id uuid, name text, city text, is_current boolean, subscription_status text,
  sales_today numeric, sales_today_count integer, sales_month numeric, low_stock integer, cash_open boolean
) language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := public.get_user_business_id();
  v_group text;
begin
  perform public.assert_business_access(v_me);
  if public.my_role() is distinct from 'admin' then raise exception 'Solo un administrador ve los otros locales' using errcode = '42501'; end if;
  if not public.business_has_vip(v_me) then raise exception 'Varios locales es del plan VIP' using errcode = '42501'; end if;
  select billing_group into v_group from businesses where businesses.id = v_me;

  return query
  select b.id, b.name, b.city, b.id = v_me, b.subscription_status,
    coalesce((select sum(s.total) from sales s where s.business_id = b.id and not coalesce(s.voided, false)
              and s.created_at >= date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'), 0),
    coalesce((select count(*)::int from sales s where s.business_id = b.id and not coalesce(s.voided, false)
              and s.created_at >= date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'), 0),
    coalesce((select sum(s.total) from sales s where s.business_id = b.id and not coalesce(s.voided, false)
              and s.created_at >= date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'), 0),
    coalesce((select count(*)::int from products p where p.business_id = b.id and p.active and p.stock <= p.stock_min), 0),
    exists (select 1 from cash_sessions c where c.business_id = b.id and c.status = 'open')
  from businesses b
  where b.id = v_me or (v_group is not null and b.billing_group = v_group)
  order by b.id <> v_me, b.name;
end $$;

-- Pasa al usuario (administrador) a otro local del mismo grupo.
create or replace function public.switch_business(p_business_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.get_user_business_id();
  v_group text;
begin
  perform public.assert_business_access(v_me);
  if public.my_role() is distinct from 'admin' then raise exception 'Solo un administrador cambia de local' using errcode = '42501'; end if;
  if not public.business_has_vip(v_me) then raise exception 'Varios locales es del plan VIP' using errcode = '42501'; end if;
  select billing_group into v_group from businesses where id = v_me;
  if v_group is null or not exists (select 1 from businesses where id = p_business_id and billing_group = v_group) then
    raise exception 'Ese local no está vinculado al tuyo' using errcode = '42501';
  end if;
  update users set business_id = p_business_id where id = auth.uid();
end $$;

revoke all on function public.business_has_vip(uuid) from public, anon;
revoke all on function public.linked_business_summaries() from public, anon;
revoke all on function public.switch_business(uuid) from public, anon;
grant execute on function public.business_has_vip(uuid) to authenticated;
grant execute on function public.linked_business_summaries() to authenticated;
grant execute on function public.switch_business(uuid) to authenticated;
