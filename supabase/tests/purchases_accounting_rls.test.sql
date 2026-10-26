-- Validacion RLS directa con usuarios authenticated reales de dos empresas.
-- Se ejecuta separada de las 52 aserciones funcionales y revierte todos sus cambios.

BEGIN;

CREATE TEMP TABLE rls_test_ids (key TEXT PRIMARY KEY, value UUID NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON rls_test_ids TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.assert_zero_visible_rows(statement TEXT, message TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE visible_rows BIGINT;
BEGIN
  EXECUTE statement INTO visible_rows;
  IF visible_rows <> 0 THEN
    RAISE EXCEPTION 'RLS ASSERT FAILED: % (% rows visible)', message, visible_rows;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_zero_affected_rows(statement TEXT, message TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE affected_rows BIGINT;
BEGIN
  EXECUTE statement;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'RLS ASSERT FAILED: % (% rows affected)', message, affected_rows;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_insert_denied(statement TEXT, message TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN;
  END;
  RAISE EXCEPTION 'RLS ASSERT FAILED: %', message;
END;
$$;

SET LOCAL ROLE authenticated;

-- Empresa B prepara datos privados mediante sus RPC autorizadas.
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000201', true);

INSERT INTO suppliers (id, business_id, name, legal_name, active)
VALUES (
  '20000000-0000-0000-0000-000000000302',
  '20000000-0000-0000-0000-000000000002',
  'Proveedor Privado B 2',
  'Proveedor Privado B 2 S.A.',
  true
);

INSERT INTO rls_test_ids VALUES ('purchase_b', public.create_purchase_document(
  '20000000-0000-0000-0000-000000000301',
  '{"document_type":"invoice","letter":"A","point_of_sale":"2","document_number":"9101","document_date":"2026-10-27","payment_condition":"account","total":"1210","is_fiscal":true}'::jsonb,
  '[{"product_id":"20000000-0000-0000-0000-000000000401","description":"Privado B","quantity":"1","unit_cost":"1000","vat_rate":"21"}]'::jsonb,
  '[]'::jsonb,
  false
));

INSERT INTO rls_test_ids
SELECT 'purchase_item_b', id FROM purchase_items
WHERE purchase_id = (SELECT value FROM rls_test_ids WHERE key = 'purchase_b')
LIMIT 1;

INSERT INTO rls_test_ids
SELECT 'purchase_tax_b', id FROM purchase_taxes
WHERE purchase_id = (SELECT value FROM rls_test_ids WHERE key = 'purchase_b')
LIMIT 1;

INSERT INTO rls_test_ids
SELECT 'tax_type_b', tax_type_id FROM purchase_taxes
WHERE purchase_id = (SELECT value FROM rls_test_ids WHERE key = 'purchase_b')
LIMIT 1;

INSERT INTO rls_test_ids
SELECT 'purchase_entry_b', accounting_entry_id FROM purchases
WHERE id = (SELECT value FROM rls_test_ids WHERE key = 'purchase_b');

INSERT INTO rls_test_ids
SELECT 'account_b', account_id FROM accounting_entry_lines
WHERE entry_id = (SELECT value FROM rls_test_ids WHERE key = 'purchase_entry_b')
LIMIT 1;

INSERT INTO rls_test_ids VALUES ('payment_b', public.record_supplier_payment(
  '20000000-0000-0000-0000-000000000301',
  1210,
  '2026-10-28',
  (SELECT id FROM payment_methods WHERE business_id = '20000000-0000-0000-0000-000000000002' AND code = 'bank'),
  jsonb_build_array(jsonb_build_object('purchase_id', (SELECT value FROM rls_test_ids WHERE key = 'purchase_b'), 'amount', 1210)),
  NULL,
  '20000000-0000-0000-0000-000000000601',
  'RLS-B-1',
  'Pago privado B'
));

INSERT INTO rls_test_ids
SELECT 'allocation_b', id FROM supplier_payment_allocations
WHERE payment_id = (SELECT value FROM rls_test_ids WHERE key = 'payment_b');

INSERT INTO rls_test_ids VALUES ('unallocated_payment_b', public.record_supplier_payment(
  '20000000-0000-0000-0000-000000000301',
  1,
  '2026-10-28',
  (SELECT id FROM payment_methods WHERE business_id = '20000000-0000-0000-0000-000000000002' AND code = 'bank'),
  '[]'::jsonb,
  NULL,
  '20000000-0000-0000-0000-000000000601',
  'RLS-B-2',
  'Pago privado B sin imputar'
));

-- Usuario A intenta leer datos de B directamente.
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000101', true);

SELECT pg_temp.assert_zero_visible_rows($sql$SELECT count(*) FROM suppliers WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'SELECT suppliers B');
SELECT pg_temp.assert_zero_visible_rows($sql$SELECT count(*) FROM purchases WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'SELECT purchases B');
SELECT pg_temp.assert_zero_visible_rows(format('SELECT count(*) FROM purchase_items WHERE purchase_id = %L::uuid', (SELECT value FROM rls_test_ids WHERE key = 'purchase_b')), 'SELECT purchase_items B');
SELECT pg_temp.assert_zero_visible_rows(format('SELECT count(*) FROM purchase_taxes WHERE purchase_id = %L::uuid', (SELECT value FROM rls_test_ids WHERE key = 'purchase_b')), 'SELECT purchase_taxes B');
SELECT pg_temp.assert_zero_visible_rows($sql$SELECT count(*) FROM supplier_accounts WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'SELECT supplier_accounts B');
SELECT pg_temp.assert_zero_visible_rows($sql$SELECT count(*) FROM supplier_payments WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'SELECT supplier_payments B');
SELECT pg_temp.assert_zero_visible_rows(format('SELECT count(*) FROM supplier_payment_allocations WHERE payment_id = %L::uuid', (SELECT value FROM rls_test_ids WHERE key = 'payment_b')), 'SELECT supplier_payment_allocations B');
SELECT pg_temp.assert_zero_visible_rows($sql$SELECT count(*) FROM supplier_ledger WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'SELECT supplier_ledger B');
SELECT pg_temp.assert_zero_visible_rows($sql$SELECT count(*) FROM accounting_accounts WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'SELECT accounting_accounts B');
SELECT pg_temp.assert_zero_visible_rows($sql$SELECT count(*) FROM accounting_entries WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'SELECT accounting_entries B');
SELECT pg_temp.assert_zero_visible_rows(format('SELECT count(*) FROM accounting_entry_lines WHERE entry_id = %L::uuid', (SELECT value FROM rls_test_ids WHERE key = 'purchase_entry_b')), 'SELECT accounting_entry_lines B');

-- UPDATE directo: ninguna fila de B puede ser afectada por A.
SELECT pg_temp.assert_zero_affected_rows($sql$UPDATE suppliers SET name = name WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'UPDATE suppliers B');
SELECT pg_temp.assert_zero_affected_rows($sql$UPDATE purchases SET notes = notes WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'UPDATE purchases B');
SELECT pg_temp.assert_zero_affected_rows(format('UPDATE purchase_items SET description = description WHERE purchase_id = %L::uuid', (SELECT value FROM rls_test_ids WHERE key = 'purchase_b')), 'UPDATE purchase_items B');
SELECT pg_temp.assert_zero_affected_rows(format('UPDATE purchase_taxes SET amount = amount WHERE purchase_id = %L::uuid', (SELECT value FROM rls_test_ids WHERE key = 'purchase_b')), 'UPDATE purchase_taxes B');
SELECT pg_temp.assert_zero_affected_rows($sql$UPDATE supplier_accounts SET balance = balance WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'UPDATE supplier_accounts B');
SELECT pg_temp.assert_zero_affected_rows($sql$UPDATE supplier_payments SET notes = notes WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'UPDATE supplier_payments B');
SELECT pg_temp.assert_zero_affected_rows(format('UPDATE supplier_payment_allocations SET amount = amount WHERE payment_id = %L::uuid', (SELECT value FROM rls_test_ids WHERE key = 'payment_b')), 'UPDATE supplier_payment_allocations B');
SELECT pg_temp.assert_zero_affected_rows($sql$UPDATE supplier_ledger SET description = description WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'UPDATE supplier_ledger B');
SELECT pg_temp.assert_zero_affected_rows($sql$UPDATE accounting_accounts SET name = name WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'UPDATE accounting_accounts B');
SELECT pg_temp.assert_zero_affected_rows($sql$UPDATE accounting_entries SET description = description WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'UPDATE accounting_entries B');
SELECT pg_temp.assert_zero_affected_rows(format('UPDATE accounting_entry_lines SET description = description WHERE entry_id = %L::uuid', (SELECT value FROM rls_test_ids WHERE key = 'purchase_entry_b')), 'UPDATE accounting_entry_lines B');

-- DELETE directo: ninguna fila de B puede ser afectada por A.
SELECT pg_temp.assert_zero_affected_rows($sql$DELETE FROM suppliers WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'DELETE suppliers B');
SELECT pg_temp.assert_zero_affected_rows($sql$DELETE FROM purchases WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'DELETE purchases B');
SELECT pg_temp.assert_zero_affected_rows(format('DELETE FROM purchase_items WHERE purchase_id = %L::uuid', (SELECT value FROM rls_test_ids WHERE key = 'purchase_b')), 'DELETE purchase_items B');
SELECT pg_temp.assert_zero_affected_rows(format('DELETE FROM purchase_taxes WHERE purchase_id = %L::uuid', (SELECT value FROM rls_test_ids WHERE key = 'purchase_b')), 'DELETE purchase_taxes B');
SELECT pg_temp.assert_zero_affected_rows($sql$DELETE FROM supplier_accounts WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'DELETE supplier_accounts B');
SELECT pg_temp.assert_zero_affected_rows($sql$DELETE FROM supplier_payments WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'DELETE supplier_payments B');
SELECT pg_temp.assert_zero_affected_rows(format('DELETE FROM supplier_payment_allocations WHERE payment_id = %L::uuid', (SELECT value FROM rls_test_ids WHERE key = 'payment_b')), 'DELETE supplier_payment_allocations B');
SELECT pg_temp.assert_zero_affected_rows($sql$DELETE FROM supplier_ledger WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'DELETE supplier_ledger B');
SELECT pg_temp.assert_zero_affected_rows($sql$DELETE FROM accounting_accounts WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'DELETE accounting_accounts B');
SELECT pg_temp.assert_zero_affected_rows($sql$DELETE FROM accounting_entries WHERE business_id = '20000000-0000-0000-0000-000000000002'$sql$, 'DELETE accounting_entries B');
SELECT pg_temp.assert_zero_affected_rows(format('DELETE FROM accounting_entry_lines WHERE entry_id = %L::uuid', (SELECT value FROM rls_test_ids WHERE key = 'purchase_entry_b')), 'DELETE accounting_entry_lines B');

-- INSERT directo: A no puede crear filas adjudicadas a B.
SELECT pg_temp.assert_insert_denied($sql$INSERT INTO suppliers (id, business_id, name) VALUES ('30000000-0000-0000-0000-000000000301', '20000000-0000-0000-0000-000000000002', 'Intrusion A')$sql$, 'INSERT suppliers B');
SELECT pg_temp.assert_insert_denied($sql$INSERT INTO purchases (id, business_id, supplier_id, total, user_id) VALUES ('30000000-0000-0000-0000-000000000302', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000302', 1, '20000000-0000-0000-0000-000000000201')$sql$, 'INSERT purchases B');
SELECT pg_temp.assert_insert_denied(format('INSERT INTO purchase_items (id, purchase_id, quantity, unit_cost, subtotal, description) VALUES (%L::uuid, %L::uuid, 1, 1, 1, %L)', '30000000-0000-0000-0000-000000000303', (SELECT value FROM rls_test_ids WHERE key = 'purchase_b'), 'Intrusion A'), 'INSERT purchase_items B');
SELECT pg_temp.assert_insert_denied(format('INSERT INTO purchase_taxes (id, purchase_id, tax_type_id, taxable_base, rate, amount) VALUES (%L::uuid, %L::uuid, %L::uuid, 1, 21, 0.21)', '30000000-0000-0000-0000-000000000304', (SELECT value FROM rls_test_ids WHERE key = 'purchase_b'), (SELECT value FROM rls_test_ids WHERE key = 'tax_type_b')), 'INSERT purchase_taxes B');
SELECT pg_temp.assert_insert_denied($sql$INSERT INTO supplier_accounts (id, business_id, supplier_id, balance) VALUES ('30000000-0000-0000-0000-000000000305', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000302', 0)$sql$, 'INSERT supplier_accounts B');
SELECT pg_temp.assert_insert_denied($sql$INSERT INTO supplier_payments (id, business_id, supplier_id, amount, created_by) VALUES ('30000000-0000-0000-0000-000000000306', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000302', 1, '20000000-0000-0000-0000-000000000201')$sql$, 'INSERT supplier_payments B');
SELECT pg_temp.assert_insert_denied(format('INSERT INTO supplier_payment_allocations (id, payment_id, purchase_id, amount) VALUES (%L::uuid, %L::uuid, %L::uuid, 1)', '30000000-0000-0000-0000-000000000307', (SELECT value FROM rls_test_ids WHERE key = 'unallocated_payment_b'), (SELECT value FROM rls_test_ids WHERE key = 'purchase_b')), 'INSERT supplier_payment_allocations B');
SELECT pg_temp.assert_insert_denied($sql$INSERT INTO supplier_ledger (id, business_id, supplier_id, movement_type, debit, created_by) VALUES ('30000000-0000-0000-0000-000000000308', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000302', 'adjustment', 1, '20000000-0000-0000-0000-000000000201')$sql$, 'INSERT supplier_ledger B');
SELECT pg_temp.assert_insert_denied($sql$INSERT INTO accounting_accounts (id, business_id, code, name, account_type) VALUES ('30000000-0000-0000-0000-000000000309', '20000000-0000-0000-0000-000000000002', 'RLS.TEST', 'Intrusion A', 'asset')$sql$, 'INSERT accounting_accounts B');
SELECT pg_temp.assert_insert_denied($sql$INSERT INTO accounting_entries (id, business_id, entry_number, description, created_by) VALUES ('30000000-0000-0000-0000-000000000310', '20000000-0000-0000-0000-000000000002', 999999, 'Intrusion A', '20000000-0000-0000-0000-000000000201')$sql$, 'INSERT accounting_entries B');
SELECT pg_temp.assert_insert_denied(format('INSERT INTO accounting_entry_lines (id, entry_id, account_id, debit, description) VALUES (%L::uuid, %L::uuid, %L::uuid, 1, %L)', '30000000-0000-0000-0000-000000000311', (SELECT value FROM rls_test_ids WHERE key = 'purchase_entry_b'), (SELECT value FROM rls_test_ids WHERE key = 'account_b'), 'Intrusion A'), 'INSERT accounting_entry_lines B');

RESET ROLE;
ROLLBACK;

\echo 'OK: RLS authenticated A/B bloquea SELECT, INSERT, UPDATE y DELETE cross-tenant.'
