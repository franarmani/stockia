-- Precio mayorista por producto (opcional, con cantidad mínima) y clientes mayoristas.
alter table public.products add column if not exists wholesale_price numeric;
alter table public.products add column if not exists wholesale_min_qty numeric;
alter table public.customers add column if not exists is_wholesale boolean not null default false;
