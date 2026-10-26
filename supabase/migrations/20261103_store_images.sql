-- Fotos de productos y portada de la tienda online. Cada negocio sube solo en su carpeta
-- (<business_id>/...); la lectura es pública porque la tienda se ve sin iniciar sesión.

alter table public.businesses add column if not exists store_cover_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists "product_images_select" on storage.objects;
create policy "product_images_select" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = public.get_user_business_id()::text);

drop policy if exists "product_images_insert" on storage.objects;
create policy "product_images_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = public.get_user_business_id()::text
              and public.my_business_is_active());

drop policy if exists "product_images_update" on storage.objects;
create policy "product_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = public.get_user_business_id()::text
         and public.my_business_is_active());

drop policy if exists "product_images_delete" on storage.objects;
create policy "product_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = public.get_user_business_id()::text);
