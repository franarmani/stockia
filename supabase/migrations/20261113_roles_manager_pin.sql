-- Rol "Vendedor Jr" y código de encargado (PIN) para anular ventas, hacer descuentos o quitar productos.

alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('admin', 'seller', 'seller_jr'));

-- El PIN se guarda con bcrypt y nadie lo puede leer: solo se verifica con las funciones de abajo.
create table if not exists public.manager_pins (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.manager_pins enable row level security;

-- Intentos fallidos, para frenar a quien pruebe códigos al azar.
create table if not exists public.manager_pin_attempts (
  id bigserial primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists manager_pin_attempts_idx on public.manager_pin_attempts (business_id, user_id, created_at desc);
alter table public.manager_pin_attempts enable row level security;

create or replace function public.set_manager_pin(p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_business uuid := public.get_user_business_id();
begin
  perform public.assert_business_access(v_business);
  if public.my_role() is distinct from 'admin' then
    raise exception 'Solo un administrador cambia el código de encargado' using errcode = '42501';
  end if;
  if p_pin is null then
    delete from manager_pins where business_id = v_business;
    return;
  end if;
  if p_pin !~ '^[0-9]{4,8}$' then raise exception 'El código tiene que tener de 4 a 8 números'; end if;
  insert into manager_pins (business_id, pin_hash) values (v_business, crypt(p_pin, gen_salt('bf', 8)))
  on conflict (business_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
end $$;

create or replace function public.has_manager_pin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from manager_pins where business_id = public.get_user_business_id())
$$;

-- No lanza error al fallar (así el intento fallido queda guardado).
create or replace function public.verify_manager_pin(p_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  v_business uuid := public.get_user_business_id();
  v_hash text;
begin
  perform public.assert_business_access(v_business);
  if (select count(*) from manager_pin_attempts
      where business_id = v_business and user_id = auth.uid() and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Demasiados intentos. Esperá unos minutos.' using errcode = '42501';
  end if;
  select pin_hash into v_hash from manager_pins where business_id = v_business;
  if v_hash is not null and p_pin is not null and crypt(p_pin, v_hash) = v_hash then
    return true;
  end if;
  insert into manager_pin_attempts (business_id, user_id) values (v_business, auth.uid());
  return false;
end $$;

-- Anulación atómica: marca la venta, devuelve stock y descuenta la cuenta corriente.
-- Devuelve 'ok', 'already_voided' o 'bad_pin'.
create or replace function public.void_sale(p_sale_id uuid, p_pin text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_sale sales;
  item record;
begin
  select * into v_sale from sales where id = p_sale_id for update;
  if not found then raise exception 'Venta inexistente'; end if;
  perform public.assert_business_access(v_sale.business_id);
  if v_sale.voided then return 'already_voided'; end if;
  if public.my_role() is distinct from 'admin' and not public.verify_manager_pin(p_pin) then
    return 'bad_pin';
  end if;

  update sales set voided = true, voided_at = now(), voided_by = auth.uid() where id = p_sale_id;
  for item in select product_id, quantity from sale_items where sale_id = p_sale_id loop
    update products set stock = stock + item.quantity where id = item.product_id and business_id = v_sale.business_id;
    insert into stock_movements (business_id, product_id, type, quantity, qty_delta, reference_id, notes, user_id)
    values (v_sale.business_id, item.product_id, 'adjustment', round(item.quantity)::int, item.quantity, p_sale_id, 'Anulación de venta', auth.uid());
  end loop;
  if v_sale.payment_method = 'account' and v_sale.customer_id is not null then
    update customers set balance = greatest(0, balance - v_sale.total) where id = v_sale.customer_id and business_id = v_sale.business_id;
  end if;
  return 'ok';
end $$;

revoke all on function public.set_manager_pin(text) from public, anon;
revoke all on function public.has_manager_pin() from public, anon;
revoke all on function public.verify_manager_pin(text) from public, anon;
revoke all on function public.void_sale(uuid, text) from public, anon;
grant execute on function public.set_manager_pin(text) to authenticated;
grant execute on function public.has_manager_pin() to authenticated;
grant execute on function public.verify_manager_pin(text) to authenticated;
grant execute on function public.void_sale(uuid, text) to authenticated;
