-- SOLO STAGING/LOCAL. Datos ficticios deterministas para validacion.
-- No ejecutar en produccion.

INSERT INTO public.businesses (id, name, email, plan, subscription_status)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Negocio Test A', 'staging-a@example.test', 'premium', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'Negocio Test B', 'staging-b@example.test', 'premium', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'admin-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'compras-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'contador-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000104', 'authenticated', 'authenticated', 'vendedor-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000201', 'authenticated', 'authenticated', 'admin-b@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, business_id, name, email, role)
VALUES
  ('10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000001', 'Admin Test A', 'admin-a@example.test', 'admin'),
  ('10000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000001', 'Compras Test A', 'compras-a@example.test', 'seller'),
  ('10000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-000000000001', 'Contador Test A', 'contador-a@example.test', 'seller'),
  ('10000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-000000000001', 'Vendedor Test A', 'vendedor-a@example.test', 'seller'),
  ('20000000-0000-0000-0000-000000000201', '20000000-0000-0000-0000-000000000002', 'Admin Test B', 'admin-b@example.test', 'admin')
ON CONFLICT (id) DO NOTHING;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000101', false);
SELECT public.seed_purchases_accounting('10000000-0000-0000-0000-000000000001');
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000201', false);
SELECT public.seed_purchases_accounting('20000000-0000-0000-0000-000000000002');

INSERT INTO public.user_permissions (business_id, user_id, permission, allowed)
VALUES
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000102', 'purchases.read', true),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000102', 'purchases.manage', true),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000103', 'accounting.read', true),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000103', 'accounting.manage', true)
ON CONFLICT (user_id, permission) DO UPDATE SET allowed = excluded.allowed;

INSERT INTO public.suppliers (id, business_id, name, legal_name, trade_name, cuit, vat_condition, active)
VALUES
  ('10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000001', 'Proveedor Test S.A.', 'Proveedor Test S.A.', 'Proveedor Test', '20-12345678-6', 'Responsable Inscripto', true),
  ('20000000-0000-0000-0000-000000000301', '20000000-0000-0000-0000-000000000002', 'Proveedor Privado B S.A.', 'Proveedor Privado B S.A.', 'Proveedor B', '30-12345678-1', 'Responsable Inscripto', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (id, business_id, name, purchase_price, sale_price, stock, stock_min, active)
VALUES
  ('10000000-0000-0000-0000-000000000401', '10000000-0000-0000-0000-000000000001', 'Producto Test A', 100000, 150000, 10, 1, true),
  ('10000000-0000-0000-0000-000000000402', '10000000-0000-0000-0000-000000000001', 'Producto Test Multi IVA', 1000, 1600, 20, 1, true),
  ('20000000-0000-0000-0000-000000000401', '20000000-0000-0000-0000-000000000002', 'Producto Privado B', 500, 900, 5, 1, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, business_id, name, email, balance)
VALUES
  ('10000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000001', 'Cliente Test A', 'cliente-a@example.test', 0),
  ('20000000-0000-0000-0000-000000000501', '20000000-0000-0000-0000-000000000002', 'Cliente Privado B', 'cliente-b@example.test', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bank_accounts (id, business_id, name, bank_name, account_number, active)
VALUES
  ('10000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000001', 'Banco Test', 'Banco Ficticio', 'TEST-001', true),
  ('20000000-0000-0000-0000-000000000601', '20000000-0000-0000-0000-000000000002', 'Banco Privado B', 'Banco Ficticio', 'TEST-002', true)
ON CONFLICT (id) DO NOTHING;

SELECT set_config('request.jwt.claim.sub', '', false);
