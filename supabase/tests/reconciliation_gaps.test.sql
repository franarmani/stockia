\set ON_ERROR_STOP on
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition BOOLEAN, message TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE(condition, false) THEN
    RAISE EXCEPTION 'ASSERT FAILED: %', message;
  END IF;
END;
$$;

INSERT INTO public.sales (id, business_id, seller_id, payment_method, total, created_at)
VALUES
  ('10000000-0000-0000-0000-000000000801', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000101', 'cash', 2, now()),
  ('20000000-0000-0000-0000-000000000801', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000201', 'cash', 2, now());
INSERT INTO public.sale_items (sale_id, product_id, quantity, price)
VALUES
  ('10000000-0000-0000-0000-000000000801', '10000000-0000-0000-0000-000000000401', 1, 1),
  ('10000000-0000-0000-0000-000000000801', '10000000-0000-0000-0000-000000000402', 1, 1),
  ('10000000-0000-0000-0000-000000000801', '20000000-0000-0000-0000-000000000401', 1, 1),
  ('20000000-0000-0000-0000-000000000801', '10000000-0000-0000-0000-000000000401', 1, 1),
  ('20000000-0000-0000-0000-000000000801', '20000000-0000-0000-0000-000000000401', 1, 1);

SELECT pg_temp.assert_true(
  NOT has_function_privilege('anon', 'public.frequently_bought_together(uuid,uuid,integer)', 'EXECUTE'),
  'anon no puede ejecutar recomendaciones'
);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000101', true);
SELECT pg_temp.assert_true((
  SELECT count(*) = 1 AND min(product_name) = 'Producto Test Multi IVA' AND min(co_count) = 1
  FROM public.frequently_bought_together('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000401')
), 'recomendaciones A incluyen solo su producto y su venta');
SELECT pg_temp.assert_true((
  SELECT count(*) = 0
  FROM public.frequently_bought_together('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000401')
), 'usuario A no puede consultar negocio B');
SELECT pg_temp.assert_true((
  SELECT count(*) = 0
  FROM public.frequently_bought_together('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000401')
), 'producto B no se usa como origen en A aunque exista una linea inconsistente');
SELECT pg_temp.assert_true((
  SELECT count(*) = 0
  FROM public.frequently_bought_together('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000401', 0)
), 'limite cero no devuelve recomendaciones');
RESET ROLE;
ROLLBACK;
\echo 'OK: 5 controles de recomendaciones y aislamiento cross-tenant.'
