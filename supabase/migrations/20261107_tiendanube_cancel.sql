-- Pedidos de Tiendanube cancelados: se anula la venta y se devuelve el stock (como "Anular venta" del programa).

alter table public.tiendanube_orders add column if not exists cancelled_at timestamptz;

create or replace function public.tiendanube_cancel_order(p_business_id uuid, p_tn_order_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_order tiendanube_orders;
  item record;
begin
  if coalesce(auth.role(), 'none') not in ('service_role', 'none') then
    raise exception 'Solo el servidor anula pedidos de Tiendanube' using errcode = '42501';
  end if;

  select * into v_order from tiendanube_orders where business_id = p_business_id and tn_order_id = p_tn_order_id for update;
  -- Nunca registrado o ya anulado: nada que hacer (Tiendanube puede repetir avisos).
  if not found or v_order.cancelled_at is not null then return false; end if;

  update tiendanube_orders set cancelled_at = now() where business_id = p_business_id and tn_order_id = p_tn_order_id;
  if v_order.sale_id is null then return true; end if;

  update sales set voided = true, voided_at = now() where id = v_order.sale_id and voided = false;
  for item in select product_id, quantity from sale_items where sale_id = v_order.sale_id loop
    update products set stock = stock + item.quantity where id = item.product_id and business_id = p_business_id;
    insert into stock_movements (business_id, product_id, type, quantity, qty_delta, reference_id, notes)
    values (p_business_id, item.product_id, 'adjustment', item.quantity, item.quantity, v_order.sale_id,
            'Pedido de Tiendanube #' || coalesce(v_order.order_number, p_tn_order_id::text) || ' cancelado');
  end loop;
  return true;
end $$;

revoke execute on function public.tiendanube_cancel_order(uuid, bigint) from public, anon, authenticated;
grant execute on function public.tiendanube_cancel_order(uuid, bigint) to service_role;
