\set ON_ERROR_STOP on
\pset pager off
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT CASE WHEN count(*) = 1 THEN 'TARGET_VERSION_OK' ELSE 'BLOCKER_TARGET_VERSION' END AS result
FROM supabase_migrations.schema_migrations WHERE version = '20261021000000';

WITH expected(table_name) AS (
  VALUES ('purchase_concepts'), ('tax_types'), ('payment_methods'), ('bank_accounts'),
    ('purchase_taxes'), ('supplier_accounts'), ('supplier_payments'),
    ('supplier_payment_allocations'), ('supplier_ledger'), ('accounting_accounts'),
    ('accounting_entries'), ('accounting_entry_lines'), ('accounting_rules'),
    ('customer_collections'), ('document_attachments'), ('audit_logs'), ('user_permissions')
)
SELECT 'BLOCKER_TABLE_OR_RLS' AS result, expected.table_name
FROM expected
LEFT JOIN pg_class relation ON relation.oid = to_regclass('public.' || expected.table_name)
WHERE relation.oid IS NULL OR NOT relation.relrowsecurity;

WITH expected(function_name) AS (
  VALUES ('seed_purchases_accounting'), ('has_permission'), ('create_purchase_document'),
    ('record_supplier_payment'), ('void_purchase_document'), ('confirm_accounting_entry'),
    ('reverse_accounting_entry'), ('create_manual_accounting_entry'), ('record_customer_collection')
)
SELECT 'BLOCKER_MISSING_RPC' AS result, expected.function_name
FROM expected WHERE NOT EXISTS (
  SELECT 1 FROM pg_proc function_definition
  JOIN pg_namespace namespace ON namespace.oid = function_definition.pronamespace
  WHERE namespace.nspname = 'public' AND function_definition.proname = expected.function_name
);

SELECT 'BLOCKER_ANON_RPC_EXECUTION' AS result, function_definition.proname
FROM pg_proc function_definition
JOIN pg_namespace namespace ON namespace.oid = function_definition.pronamespace
WHERE namespace.nspname = 'public'
  AND function_definition.proname IN ('create_purchase_document', 'record_supplier_payment',
    'void_purchase_document', 'confirm_accounting_entry', 'reverse_accounting_entry',
    'create_manual_accounting_entry', 'record_customer_collection')
  AND has_function_privilege('anon', function_definition.oid, 'EXECUTE');

SELECT 'BLOCKER_INVALID_INDEX' AS result, index_name.relname
FROM pg_index index_definition
JOIN pg_class index_name ON index_name.oid = index_definition.indexrelid
JOIN pg_class table_name ON table_name.oid = index_definition.indrelid
JOIN pg_namespace namespace ON namespace.oid = table_name.relnamespace
WHERE namespace.nspname = 'public'
  AND table_name.relname IN ('suppliers', 'purchases', 'purchase_taxes', 'supplier_accounts',
    'supplier_payments', 'supplier_payment_allocations', 'supplier_ledger', 'accounting_accounts',
    'accounting_entries', 'accounting_entry_lines', 'accounting_rules', 'customer_collections',
    'document_attachments', 'audit_logs', 'user_permissions')
  AND (NOT index_definition.indisvalid OR NOT index_definition.indisready);

SELECT CASE WHEN count(*) = 1 AND NOT bool_or(convalidated)
  THEN 'CUIT_CHECK_NOT_VALID_OK' ELSE 'BLOCKER_CUIT_CHECK' END AS result
FROM pg_constraint
WHERE conrelid = 'public.suppliers'::regclass AND conname = 'suppliers_cuit_valid_check';

SELECT CASE WHEN count(*) = 1 AND bool_and(
    NOT public AND file_size_limit = 10485760
    AND allowed_mime_types @> ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
    AND cardinality(allowed_mime_types) = 3
  ) THEN 'PRIVATE_PURCHASE_BUCKET_OK' ELSE 'BLOCKER_PURCHASE_BUCKET' END AS result
FROM storage.buckets WHERE id = 'purchase-documents';

SELECT CASE WHEN count(*) = 2 THEN 'STORAGE_POLICIES_OK' ELSE 'BLOCKER_STORAGE_POLICIES' END AS result
FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname IN ('purchase_documents_storage_select', 'purchase_documents_storage_insert');

SELECT 'BLOCKER_UNBALANCED_CONFIRMED_ENTRY' AS result, entry.id
FROM public.accounting_entries entry
LEFT JOIN public.accounting_entry_lines entry_line ON entry_line.entry_id = entry.id
WHERE entry.status = 'confirmed'
GROUP BY entry.id
HAVING coalesce(sum(entry_line.debit), 0) <> coalesce(sum(entry_line.credit), 0)
   OR coalesce(sum(entry_line.debit), 0) = 0;

SELECT 'LEGACY_COUNTS' AS result,
  (SELECT count(*) FROM public.sales) AS sales,
  (SELECT count(*) FROM public.products) AS products,
  (SELECT count(*) FROM public.cash_sessions) AS cash_sessions,
  (SELECT count(*) FROM public.stock_movements) AS stock_movements;
ROLLBACK;
