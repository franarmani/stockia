-- Código propio del producto (corto, para escribirlo en la caja en vez del nombre). Distinto del código de barras.
alter table public.products add column if not exists code text
  check (code is null or (length(code) between 1 and 30));
create unique index if not exists products_business_code_uidx on public.products (business_id, lower(code)) where code is not null;
