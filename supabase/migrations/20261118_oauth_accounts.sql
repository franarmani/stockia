-- Ingreso con Google: evita crear un segundo negocio para quien ya tiene cuenta con ese email.

-- ¿Existe otro usuario de CajaGo (con otro id) con el mismo email que el usuario actual?
-- Si Supabase vinculó las identidades, el id es el mismo y esto devuelve false.
create or replace function public.email_has_other_account()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.users u
    where u.id <> auth.uid()
      and lower(u.email) = lower(coalesce((select email from auth.users where id = auth.uid()), ''))
  )
$$;

-- ¿El usuario actual ya tiene su perfil/negocio?
create or replace function public.i_have_profile()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid())
$$;

revoke all on function public.email_has_other_account() from public, anon;
revoke all on function public.i_have_profile() from public, anon;
grant execute on function public.email_has_other_account() to authenticated;
grant execute on function public.i_have_profile() to authenticated;
