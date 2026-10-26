-- WhatsApp con IA administrado por CajaGo (partner de Z-API): CajaGo crea una instancia por negocio VIP
-- y el comercio conecta su propio número escaneando un QR. La instancia se paga recién cuando se conecta.

alter table public.whatsapp_connections add column if not exists managed boolean not null default false;
alter table public.whatsapp_connections add column if not exists subscribed boolean not null default false;
