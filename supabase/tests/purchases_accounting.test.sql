-- Suite de integracion para staging/local. Todas las operaciones se revierten.
-- Requiere aplicar la migracion y luego fixtures/purchases_accounting_seed.sql.

BEGIN;

CREATE TEMP TABLE test_ids (key TEXT PRIMARY KEY, value UUID NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON test_ids TO authenticated;
CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition BOOLEAN, message TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN IF NOT COALESCE(condition, false) THEN RAISE EXCEPTION 'ASSERT FAILED: %', message; END IF; END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000101', true);

-- Compra Factura A: neto 100.000 + IVA 21.000 = 121.000.
INSERT INTO test_ids VALUES ('invoice', public.create_purchase_document(
  '10000000-0000-0000-0000-000000000301',
  '{"document_type":"invoice","letter":"A","point_of_sale":"1","document_number":"1001","document_date":"2026-10-21","due_date":"2026-11-21","payment_condition":"account","currency":"ARS","total":"121000","is_fiscal":true,"is_internal":false}'::jsonb,
  '[{"product_id":"10000000-0000-0000-0000-000000000401","description":"Mercaderia test","quantity":"1","unit_cost":"100000","vat_rate":"21"}]'::jsonb,
  '[]'::jsonb,
  false
));

SELECT pg_temp.assert_true((SELECT total = 121000 AND subtotal = 100000 AND vat_total = 21000 AND balance_due = 121000 FROM purchases WHERE id = (SELECT value FROM test_ids WHERE key = 'invoice')), 'factura y totales');
SELECT pg_temp.assert_true((SELECT count(*) = 1 AND sum(amount) = 21000 FROM purchase_taxes WHERE purchase_id = (SELECT value FROM test_ids WHERE key = 'invoice')), 'IVA 21 registrado');
SELECT pg_temp.assert_true((SELECT balance = 121000 FROM supplier_accounts WHERE supplier_id = '10000000-0000-0000-0000-000000000301'), 'saldo proveedor 121000');
SELECT pg_temp.assert_true((SELECT sum(debit) = 121000 AND sum(credit) = 121000 FROM accounting_entry_lines WHERE entry_id = (SELECT accounting_entry_id FROM purchases WHERE id = (SELECT value FROM test_ids WHERE key = 'invoice'))), 'asiento compra balanceado');
SELECT pg_temp.assert_true((SELECT count(*) = 3 FROM accounting_entry_lines WHERE entry_id = (SELECT accounting_entry_id FROM purchases WHERE id = (SELECT value FROM test_ids WHERE key = 'invoice'))), 'asiento compra con tres lineas');

-- Duplicado de comprobante rechazado por la base.
DO $$ BEGIN
  PERFORM public.create_purchase_document(
    '10000000-0000-0000-0000-000000000301',
    '{"document_type":"invoice","letter":"A","point_of_sale":"1","document_number":"1001","document_date":"2026-10-21","payment_condition":"account","total":"121000","is_fiscal":true}'::jsonb,
    '[{"description":"Duplicado","quantity":"1","unit_cost":"100000","vat_rate":"21"}]'::jsonb, '[]'::jsonb, false);
  RAISE EXCEPTION 'ASSERT FAILED: duplicate invoice accepted';
EXCEPTION WHEN unique_violation THEN NULL; END $$;

-- CUIT duplicado normalizado rechazado.
DO $$ BEGIN
  INSERT INTO suppliers (business_id, name, legal_name, cuit) VALUES ('10000000-0000-0000-0000-000000000001', 'Duplicado', 'Duplicado', '20123456786');
  RAISE EXCEPTION 'ASSERT FAILED: duplicate CUIT accepted';
EXCEPTION WHEN unique_violation THEN NULL; END $$;

-- Pago parcial 60.000 por banco.
INSERT INTO test_ids VALUES ('partial_payment', public.record_supplier_payment(
  '10000000-0000-0000-0000-000000000301', 60000, '2026-10-22',
  (SELECT id FROM payment_methods WHERE business_id = '10000000-0000-0000-0000-000000000001' AND code = 'bank'),
  jsonb_build_array(jsonb_build_object('purchase_id', (SELECT value FROM test_ids WHERE key = 'invoice'), 'amount', 60000)),
  NULL, '10000000-0000-0000-0000-000000000601', 'TRX-TEST-1', 'Pago parcial'
));
SELECT pg_temp.assert_true((SELECT balance_due = 61000 AND total = 121000 FROM purchases WHERE id = (SELECT value FROM test_ids WHERE key = 'invoice')), 'pago parcial conserva total y deja 61000');
SELECT pg_temp.assert_true((SELECT balance = 61000 FROM supplier_accounts WHERE supplier_id = '10000000-0000-0000-0000-000000000301'), 'saldo proveedor tras pago parcial');
SELECT pg_temp.assert_true((SELECT sum(debit) = 60000 AND sum(credit) = 60000 FROM accounting_entry_lines WHERE entry_id = (SELECT accounting_entry_id FROM supplier_payments WHERE id = (SELECT value FROM test_ids WHERE key = 'partial_payment'))), 'asiento pago parcial balanceado');

-- Pago final 61.000.
INSERT INTO test_ids VALUES ('final_payment', public.record_supplier_payment(
  '10000000-0000-0000-0000-000000000301', 61000, '2026-10-23',
  (SELECT id FROM payment_methods WHERE business_id = '10000000-0000-0000-0000-000000000001' AND code = 'bank'),
  jsonb_build_array(jsonb_build_object('purchase_id', (SELECT value FROM test_ids WHERE key = 'invoice'), 'amount', 61000)),
  NULL, '10000000-0000-0000-0000-000000000601', 'TRX-TEST-2', 'Pago final'
));
SELECT pg_temp.assert_true((SELECT balance_due = 0 AND status = 'paid' FROM purchases WHERE id = (SELECT value FROM test_ids WHERE key = 'invoice')), 'factura pagada');
SELECT pg_temp.assert_true((SELECT balance = 0 FROM supplier_accounts WHERE supplier_id = '10000000-0000-0000-0000-000000000301'), 'saldo proveedor cero');

-- Nota de credito relacionada, con impacto fiscal y contable inverso.
INSERT INTO test_ids VALUES ('credit_note', public.create_purchase_document(
  '10000000-0000-0000-0000-000000000301',
  jsonb_build_object('document_type','credit_note','letter','A','point_of_sale','1','document_number','2001','document_date','2026-10-24','payment_condition','account','total','12100','is_fiscal',true,'original_purchase_id',(SELECT value FROM test_ids WHERE key = 'invoice')),
  '[{"description":"Bonificacion","quantity":"1","unit_cost":"10000","vat_rate":"21"}]'::jsonb, '[]'::jsonb, false
));
SELECT pg_temp.assert_true((SELECT original_purchase_id = (SELECT value FROM test_ids WHERE key = 'invoice') AND balance_due = -12100 FROM purchases WHERE id = (SELECT value FROM test_ids WHERE key = 'credit_note')), 'nota de credito relacionada');
SELECT pg_temp.assert_true((SELECT balance = -12100 FROM supplier_accounts WHERE supplier_id = '10000000-0000-0000-0000-000000000301'), 'nota de credito impacta cuenta corriente');
SELECT pg_temp.assert_true((SELECT taxable_net = -10000 AND vat_21 = -2100 AND total = -12100 FROM purchase_vat_summary WHERE purchase_id = (SELECT value FROM test_ids WHERE key = 'credit_note')), 'nota de credito impacta IVA con signo inverso');
SELECT pg_temp.assert_true((SELECT sum(debit) = 12100 AND sum(credit) = 12100 FROM accounting_entry_lines WHERE entry_id = (SELECT accounting_entry_id FROM purchases WHERE id = (SELECT value FROM test_ids WHERE key = 'credit_note'))), 'asiento nota credito balanceado');

-- Nota de debito: incrementa deuda, IVA y contabilidad con signo positivo.
INSERT INTO test_ids VALUES ('debit_note', public.create_purchase_document(
  '10000000-0000-0000-0000-000000000301',
  '{"document_type":"debit_note","letter":"A","point_of_sale":"1","document_number":"3001","document_date":"2026-10-24","payment_condition":"account","total":"6050","is_fiscal":true}'::jsonb,
  '[{"description":"Ajuste debito","quantity":"1","unit_cost":"5000","vat_rate":"21"}]'::jsonb, '[]'::jsonb, false
));
SELECT pg_temp.assert_true((SELECT balance_due = 6050 FROM purchases WHERE id = (SELECT value FROM test_ids WHERE key = 'debit_note')), 'nota de debito genera deuda');
SELECT pg_temp.assert_true((SELECT taxable_net = 5000 AND vat_21 = 1050 AND total = 6050 FROM purchase_vat_summary WHERE purchase_id = (SELECT value FROM test_ids WHERE key = 'debit_note')), 'nota de debito impacta IVA positivo');
SELECT pg_temp.assert_true((SELECT sum(debit) = 6050 AND sum(credit) = 6050 FROM accounting_entry_lines WHERE entry_id = (SELECT accounting_entry_id FROM purchases WHERE id = (SELECT value FROM test_ids WHERE key = 'debit_note'))), 'asiento nota debito balanceado');

-- IVA 10,5%, 27% y factura multialicuota.
INSERT INTO test_ids VALUES ('vat105', public.create_purchase_document('10000000-0000-0000-0000-000000000301','{"document_type":"invoice","letter":"A","point_of_sale":"1","document_number":"1010","document_date":"2026-10-25","payment_condition":"account","total":"11050","is_fiscal":true}'::jsonb,'[{"description":"IVA 10.5","quantity":"1","unit_cost":"10000","vat_rate":"10.5"}]'::jsonb,'[]'::jsonb,false));
INSERT INTO test_ids VALUES ('vat27', public.create_purchase_document('10000000-0000-0000-0000-000000000301','{"document_type":"invoice","letter":"A","point_of_sale":"1","document_number":"1027","document_date":"2026-10-25","payment_condition":"account","total":"12700","is_fiscal":true}'::jsonb,'[{"description":"IVA 27","quantity":"1","unit_cost":"10000","vat_rate":"27"}]'::jsonb,'[]'::jsonb,false));
INSERT INTO test_ids VALUES ('vatmulti', public.create_purchase_document('10000000-0000-0000-0000-000000000301','{"document_type":"invoice","letter":"A","point_of_sale":"1","document_number":"1099","document_date":"2026-10-25","payment_condition":"account","total":"35850","is_fiscal":true}'::jsonb,'[{"description":"IVA 10.5","quantity":"1","unit_cost":"10000","vat_rate":"10.5"},{"description":"IVA 21","quantity":"1","unit_cost":"10000","vat_rate":"21"},{"description":"IVA 27","quantity":"1","unit_cost":"10000","vat_rate":"27"}]'::jsonb,'[]'::jsonb,false));
SELECT pg_temp.assert_true((SELECT vat_105 = 1050 FROM purchase_vat_summary WHERE purchase_id = (SELECT value FROM test_ids WHERE key = 'vat105')), 'IVA 10.5');
SELECT pg_temp.assert_true((SELECT vat_27 = 2700 FROM purchase_vat_summary WHERE purchase_id = (SELECT value FROM test_ids WHERE key = 'vat27')), 'IVA 27');
SELECT pg_temp.assert_true((SELECT vat_105 = 1050 AND vat_21 = 2100 AND vat_27 = 2700 FROM purchase_vat_summary WHERE purchase_id = (SELECT value FROM test_ids WHERE key = 'vatmulti')), 'IVA multiple');

-- Asiento manual desbalanceado rechazado y sin cabecera residual.
DO $$ DECLARE before_count BIGINT; BEGIN
  SELECT count(*) INTO before_count FROM accounting_entries;
  BEGIN
    PERFORM create_manual_accounting_entry('{"date":"2026-10-26","description":"Desbalanceado"}'::jsonb,
      jsonb_build_array(
        jsonb_build_object('account_id',(SELECT id FROM accounting_accounts WHERE business_id='10000000-0000-0000-0000-000000000001' AND code='1.1.01'),'debit',100,'credit',0),
        jsonb_build_object('account_id',(SELECT id FROM accounting_accounts WHERE business_id='10000000-0000-0000-0000-000000000001' AND code='5.2.01'),'debit',0,'credit',90)));
    RAISE EXCEPTION 'ASSERT FAILED: unbalanced entry accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ASSERT FAILED:%' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.assert_true((SELECT count(*) FROM accounting_entries) = before_count, 'rollback asiento desbalanceado');
END $$;

-- Anulacion comercial y reversion contable sin DELETE.
SELECT public.void_purchase_document((SELECT value FROM test_ids WHERE key = 'vat105'), 'Prueba de reversion');
SELECT pg_temp.assert_true((SELECT status = 'voided' AND balance_due = 0 AND voided_at IS NOT NULL FROM purchases WHERE id = (SELECT value FROM test_ids WHERE key = 'vat105')), 'comprobante anulado sin borrar');
SELECT pg_temp.assert_true((SELECT e.status = 'reversed' AND EXISTS (SELECT 1 FROM accounting_entries r WHERE r.reversal_of_id = e.id AND r.status = 'confirmed') FROM purchases p JOIN accounting_entries e ON e.id = p.accounting_entry_id WHERE p.id = (SELECT value FROM test_ids WHERE key = 'vat105')), 'trazabilidad original y reversion');

-- Cuenta corriente reconstruible y mayores disponibles.
SELECT pg_temp.assert_true((SELECT COALESCE(sum(debit-credit),0) FROM supplier_ledger WHERE supplier_id='10000000-0000-0000-0000-000000000301') = (SELECT balance FROM supplier_accounts WHERE supplier_id='10000000-0000-0000-0000-000000000301'), 'saldo reconstruible desde movimientos');
SELECT pg_temp.assert_true((SELECT count(*) > 0 FROM general_ledger WHERE account_code IN ('2.1.01','1.1.02','5.1.01','1.3.01')), 'libro mayor para cuentas esperadas');

-- Error forzado cross-tenant: rollback completo de compra y derivados.
DO $$ DECLARE
  purchases_before BIGINT; taxes_before BIGINT; ledger_before BIGINT; entries_before BIGINT; lines_before BIGINT; balance_before NUMERIC;
BEGIN
  SELECT count(*) INTO purchases_before FROM purchases;
  SELECT count(*) INTO taxes_before FROM purchase_taxes;
  SELECT count(*) INTO ledger_before FROM supplier_ledger;
  SELECT count(*) INTO entries_before FROM accounting_entries;
  SELECT count(*) INTO lines_before FROM accounting_entry_lines;
  SELECT balance INTO balance_before FROM supplier_accounts WHERE supplier_id='10000000-0000-0000-0000-000000000301';
  BEGIN
    PERFORM create_purchase_document('10000000-0000-0000-0000-000000000301','{"document_type":"invoice","point_of_sale":"1","document_number":"7777","total":"121"}'::jsonb,'[{"product_id":"20000000-0000-0000-0000-000000000401","description":"Cross tenant","quantity":"1","unit_cost":"100","vat_rate":"21"}]'::jsonb,'[]'::jsonb,false);
    RAISE EXCEPTION 'ASSERT FAILED: cross-tenant product accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ASSERT FAILED:%' THEN RAISE; END IF; END;
  PERFORM pg_temp.assert_true((SELECT count(*) FROM purchases) = purchases_before, 'rollback documento compra fallida');
  PERFORM pg_temp.assert_true((SELECT count(*) FROM purchase_taxes) = taxes_before, 'rollback impuestos compra fallida');
  PERFORM pg_temp.assert_true((SELECT count(*) FROM supplier_ledger) = ledger_before, 'rollback deuda compra fallida');
  PERFORM pg_temp.assert_true((SELECT count(*) FROM accounting_entries) = entries_before, 'rollback cabecera contable compra fallida');
  PERFORM pg_temp.assert_true((SELECT count(*) FROM accounting_entry_lines) = lines_before, 'rollback lineas contables compra fallida');
  PERFORM pg_temp.assert_true((SELECT balance FROM supplier_accounts WHERE supplier_id='10000000-0000-0000-0000-000000000301') = balance_before, 'rollback saldo compra fallida');
END $$;

-- Error a mitad de pago: no deja pago, imputacion, movimiento, asiento ni saldo parcial.
DO $$ DECLARE
  payments_before BIGINT; allocations_before BIGINT; ledger_before BIGINT; entries_before BIGINT; balance_before NUMERIC;
BEGIN
  SELECT count(*) INTO payments_before FROM supplier_payments;
  SELECT count(*) INTO allocations_before FROM supplier_payment_allocations;
  SELECT count(*) INTO ledger_before FROM supplier_ledger;
  SELECT count(*) INTO entries_before FROM accounting_entries;
  SELECT balance INTO balance_before FROM supplier_accounts WHERE supplier_id='10000000-0000-0000-0000-000000000301';
  BEGIN
    PERFORM record_supplier_payment(
      '10000000-0000-0000-0000-000000000301', 100, '2026-10-27',
      (SELECT id FROM payment_methods WHERE business_id='10000000-0000-0000-0000-000000000001' AND code='bank'),
      '[{"purchase_id":"ffffffff-ffff-ffff-ffff-ffffffffffff","amount":100}]'::jsonb,
      NULL, '10000000-0000-0000-0000-000000000601', 'TRX-ROLLBACK', 'Debe revertirse');
    RAISE EXCEPTION 'ASSERT FAILED: invalid payment accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'ASSERT FAILED:%' THEN RAISE; END IF; END;
  PERFORM pg_temp.assert_true((SELECT count(*) FROM supplier_payments) = payments_before, 'rollback pago fallido');
  PERFORM pg_temp.assert_true((SELECT count(*) FROM supplier_payment_allocations) = allocations_before, 'rollback imputacion fallida');
  PERFORM pg_temp.assert_true((SELECT count(*) FROM supplier_ledger) = ledger_before, 'rollback movimiento pago fallido');
  PERFORM pg_temp.assert_true((SELECT count(*) FROM accounting_entries) = entries_before, 'rollback asiento pago fallido');
  PERFORM pg_temp.assert_true((SELECT balance FROM supplier_accounts WHERE supplier_id='10000000-0000-0000-0000-000000000301') = balance_before, 'rollback saldo pago fallido');
END $$;

-- Crear registros privados de B usando un usuario autenticado real de B.
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000201', true);
INSERT INTO test_ids VALUES ('invoice_b', public.create_purchase_document(
  '20000000-0000-0000-0000-000000000301',
  '{"document_type":"invoice","letter":"A","point_of_sale":"2","document_number":"9001","document_date":"2026-10-27","payment_condition":"account","total":"1210","is_fiscal":true}'::jsonb,
  '[{"product_id":"20000000-0000-0000-0000-000000000401","description":"Privado B","quantity":"1","unit_cost":"1000","vat_rate":"21"}]'::jsonb,
  '[]'::jsonb, false
));
INSERT INTO test_ids SELECT 'entry_b', accounting_entry_id FROM purchases WHERE id=(SELECT value FROM test_ids WHERE key='invoice_b');
INSERT INTO test_ids VALUES ('payment_b', public.record_supplier_payment(
  '20000000-0000-0000-0000-000000000301', 1210, '2026-10-27',
  (SELECT id FROM payment_methods WHERE business_id='20000000-0000-0000-0000-000000000002' AND code='bank'),
  jsonb_build_array(jsonb_build_object('purchase_id',(SELECT value FROM test_ids WHERE key='invoice_b'),'amount',1210)),
  NULL, '20000000-0000-0000-0000-000000000601', 'TRX-B', 'Pago privado B'
));

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000101', true);

-- Aislamiento RLS directo: Admin A no ve datos B.
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM suppliers WHERE business_id='20000000-0000-0000-0000-000000000002'), 'RLS suppliers B');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM purchases WHERE business_id='20000000-0000-0000-0000-000000000002'), 'RLS purchases B');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM purchase_items WHERE purchase_id=(SELECT value FROM test_ids WHERE key='invoice_b')), 'RLS purchase items B');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM purchase_taxes WHERE purchase_id=(SELECT value FROM test_ids WHERE key='invoice_b')), 'RLS purchase taxes B');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM supplier_payments WHERE business_id='20000000-0000-0000-0000-000000000002'), 'RLS payments B');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM supplier_payment_allocations WHERE payment_id=(SELECT value FROM test_ids WHERE key='payment_b')), 'RLS payment allocations B');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM accounting_accounts WHERE business_id='20000000-0000-0000-0000-000000000002'), 'RLS accounts B');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM accounting_entries WHERE business_id='20000000-0000-0000-0000-000000000002'), 'RLS entries B');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM accounting_entry_lines WHERE entry_id=(SELECT value FROM test_ids WHERE key='entry_b')), 'RLS entry lines B');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM general_ledger WHERE business_id='20000000-0000-0000-0000-000000000002'), 'RLS ledger B');

-- Vendedor sin permisos no ve Compras ni Contabilidad.
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000104', true);
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM suppliers), 'vendedor sin proveedores');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM accounting_entries), 'vendedor sin asientos');

-- COMPRAS ve compras pero no Contabilidad; CONTADOR ve contabilidad pero no proveedores.
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000102', true);
SELECT pg_temp.assert_true((SELECT count(*) > 0 FROM purchases), 'rol COMPRAS accede a compras');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM accounting_entries), 'rol COMPRAS no accede a contabilidad');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000103', true);
SELECT pg_temp.assert_true((SELECT count(*) > 0 FROM accounting_entries), 'rol CONTADOR accede a contabilidad');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM suppliers), 'rol CONTADOR no accede a proveedores');

RESET ROLE;
ROLLBACK;

\echo 'OK: purchases_accounting.test.sql completo; todos los cambios fueron revertidos.'
