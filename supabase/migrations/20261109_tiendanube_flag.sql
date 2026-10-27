-- La tienda web de CajaGo es para quien no usa Tiendanube: al conectar Tiendanube se apaga y se oculta.
alter table public.businesses add column if not exists tiendanube_connected boolean not null default false;
update public.businesses b set tiendanube_connected = exists (select 1 from public.tiendanube_connections c where c.business_id = b.id);
