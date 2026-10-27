-- Avisos al dueño de CajaGo por Telegram (registro, intención de compra, activación y vencimientos).
-- La clave compartida vive en Vault ('admin_alerts_secret') y en el secreto ADMIN_ALERTS_SECRET de la función.

create table if not exists public.admin_alert_log (
  id bigserial primary key,
  kind text not null,
  business_id uuid references public.businesses(id) on delete cascade,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);
alter table public.admin_alert_log enable row level security;  -- sin políticas: solo el servidor

create or replace function public.notify_admin_alert(p_event text, p_business_id uuid, p_extra jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'admin_alerts_secret';
  if v_secret is null then return; end if;
  perform net.http_post(
    url := 'https://mrpenblsmooeqzegtcqp.supabase.co/functions/v1/admin-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cajago-alerts', v_secret),
    body := jsonb_build_object('event', p_event, 'business_id', p_business_id, 'extra', coalesce(p_extra, '{}'::jsonb)));
exception when others then
  null;  -- un aviso que falla nunca tiene que romper un registro o un pago
end $$;

revoke all on function public.notify_admin_alert(text, uuid, jsonb) from public, anon, authenticated;

-- Nuevo negocio registrado
create or replace function public.alert_on_business_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_admin_alert('registro', new.id);
  return new;
end $$;
drop trigger if exists admin_alert_business_insert on public.businesses;
create trigger admin_alert_business_insert after insert on public.businesses
  for each row execute function public.alert_on_business_insert();

-- Pago por transferencia informado (quiere comprar)
create or replace function public.alert_on_payment_request() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_admin_alert('pago_informado', new.business_id,
    jsonb_build_object('amount', new.amount, 'plan', new.plan));
  return new;
end $$;
drop trigger if exists admin_alert_payment_request on public.payment_requests;
create trigger admin_alert_payment_request after insert on public.payment_requests
  for each row execute function public.alert_on_payment_request();

-- Suscripción de Mercado Pago iniciada (quiere comprar) y suscripción activada
create or replace function public.alert_on_business_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.mp_preapproval_id is null and new.mp_preapproval_id is not null then
    perform public.notify_admin_alert('suscripcion_mp', new.id, jsonb_build_object('plan', coalesce(new.mp_plan, new.plan)));
  end if;
  if new.subscription_status = 'active' and old.subscription_status is distinct from 'active' then
    perform public.notify_admin_alert('activada', new.id, jsonb_build_object('plan', new.plan));
  end if;
  return new;
end $$;
drop trigger if exists admin_alert_business_update on public.businesses;
create trigger admin_alert_business_update after update on public.businesses
  for each row execute function public.alert_on_business_update();

-- Vencimientos: una revisión por día, 9:00 hora argentina (12:00 UTC).
select cron.unschedule('admin-alerts-daily') where exists (select 1 from cron.job where jobname = 'admin-alerts-daily');
select cron.schedule('admin-alerts-daily', '0 12 * * *', $cron$
  select net.http_post(
    url := 'https://mrpenblsmooeqzegtcqp.supabase.co/functions/v1/admin-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cajago-alerts', (select decrypted_secret from vault.decrypted_secrets where name = 'admin_alerts_secret')),
    body := '{"daily": true}'::jsonb)
$cron$);
