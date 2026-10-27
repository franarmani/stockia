-- Tienda online: productos destacados (aparecen primero) y forma de entrega del pedido.
alter table public.products add column if not exists store_featured boolean not null default false;
alter table public.online_orders add column if not exists delivery_method text not null default 'pickup'
  check (delivery_method in ('pickup', 'delivery'));
alter table public.online_orders add column if not exists delivery_address text check (delivery_address is null or length(delivery_address) <= 200);
