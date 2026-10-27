-- Descuento por monto mínimo de compra (por ejemplo 15% desde $50.000).
alter table public.promotions add column if not exists min_amount numeric(12,2) check (min_amount is null or min_amount > 0);
alter table public.promotions drop constraint if exists promotions_kind_check;
alter table public.promotions add constraint promotions_kind_check check (kind in ('nxm', 'percent', 'second_unit', 'min_total'));
alter table public.promotions drop constraint if exists promotions_min_total_check;
alter table public.promotions add constraint promotions_min_total_check check (kind <> 'min_total' or min_amount is not null);
