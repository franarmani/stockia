# Plan de despliegue a producción — Compras + Contabilidad

**Estado:** preparado, no ejecutado  
**Fecha de preparación:** 22/10/2026  
**Resultado técnico previo:** GO local (`52/52` SQL, `44` controles RLS cross-tenant, `24/24` tests y build productivo)  
**Producción:** sin cambios; requiere autorización explícita  
**Migración objetivo:** `supabase/migrations/20261021000000_purchases_accounting.sql`  
**Edge Function objetivo:** `supabase/functions/arca-supplier-lookup/index.ts`  
**Frontend objetivo:** build Vite publicado en Vercel según `vercel.json`

> Este documento es un runbook. Prepararlo no autoriza ni ejecuta `supabase link`, `db push`, despliegues de Edge Functions, despliegues de frontend ni escrituras en producción.

## 1. Alcance y condiciones de salida

El release incorpora proveedores ampliados, compras documentadas, cuenta corriente de proveedores, pagos, contabilidad, libro mayor, permisos/RLS y consulta de proveedores en ARCA. La secuencia obligatoria es:

1. backup;
2. preflight READ-ONLY;
3. migraciones;
4. Edge Function ARCA;
5. frontend;
6. smoke tests;
7. observación y cierre.

No se altera este orden. Durante los pasos 3 a 6 se congela la escritura de compras/proveedores y se evita cualquier cambio paralelo de esquema, policies, funciones, secretos o frontend.

### 1.1 Datos que se completan antes de la ventana

| Dato | Valor requerido |
| --- | --- |
| `RELEASE_ID` | `purchases-accounting-YYYYMMDD-HHMM` |
| Commit Git aprobado | SHA inmutable |
| Proyecto Supabase productivo | project ref confirmado por dos personas |
| Base productiva | host y nombre confirmados; conexión directa, no pooler transaccional |
| Deployment Vercel actual | ID/URL para rollback |
| Deployment frontend candidato | ID/URL del artefacto ya validado |
| Edge Function anterior | commit/bundle recuperable |
| Operador | nombre |
| Revisor | nombre distinto del operador |
| Responsable funcional/contador | aprobación registrada |
| Inicio/fin de ventana | timestamps UTC y ART |
| Negocio smoke A / usuario A | IDs dedicados |
| Negocio smoke B / usuario B | IDs dedicados |
| CUIT smoke reservado | CUIT válido, no perteneciente a un tercero real |

### 1.2 Gates duros de GO

Todos deben cumplirse:

- autorización explícita para producción que identifique `RELEASE_ID`, commit y proyecto;
- aprobación funcional/contable del plan de cuentas y reglas que continúan marcadas como sujetas a validación;
- backup administrado y backup lógico terminados y verificados;
- prueba de restauración en una base aislada satisfactoria;
- preflight sin filas `BLOCKER` y con evidencia archivada;
- historial remoto de migraciones reconciliado sin ambigüedades;
- dry-run que enumere **únicamente** la migración objetivo;
- secretos `ARCA_PADRON_ENDPOINT` y `ARCA_PADRON_ACCESS_TOKEN` presentes en el gestor seguro, sin exponer valores;
- artefactos de Edge y frontend construidos desde el mismo commit aprobado;
- dos tenants y dos usuarios normales disponibles para el smoke RLS;
- responsables de rollback y comunicación presentes durante la ventana.

Es **NO-GO** ante cualquier CUIT/comprobante duplicado, dato incompatible, `business_id` faltante, referencia huérfana, cruce de tenant, objeto parcial, versión histórica dudosa, backup no restaurable o acceso RLS cruzado.

## 2. Backup previo obligatorio

### 2.1 Congelamiento y punto de recuperación

1. Anunciar inicio de ventana y congelar escrituras administrativas/de compras.
2. Registrar métricas base: errores, latencia, sesiones, ventas por minuto y última venta confirmada.
3. Crear un backup/snapshot administrado o confirmar un punto PITR inmediatamente anterior al release.
4. Registrar ID y timestamp UTC del punto de recuperación, retención y procedimiento de restore.
5. Confirmar que el backup administrado cubre la base. Los archivos físicos de Storage deben respaldarse aparte si el proveedor no los incluye.

El snapshot/PITR administrado es la vía primaria de recuperación integral. El dump lógico es una segunda capa y una fuente de definiciones para rollback selectivo.

### 2.2 Dump lógico

Usar cliente PostgreSQL compatible con el major del servidor —la validación local fue sobre PostgreSQL 17— y una URL directa con TLS. La variable se obtiene del gestor de secretos y nunca se pega en tickets ni logs.

```powershell
$ErrorActionPreference = 'Stop'
$ReleaseId = 'purchases-accounting-YYYYMMDD-HHMM'
$Stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$BackupDir = Join-Path $env:USERPROFILE "secure-backups\$ReleaseId-$Stamp"
New-Item -ItemType Directory -Path $BackupDir | Out-Null

if ([string]::IsNullOrWhiteSpace($env:PRODUCTION_DATABASE_URL)) {
  throw 'Falta PRODUCTION_DATABASE_URL'
}

pg_dump --version
psql "$env:PRODUCTION_DATABASE_URL" -X -v ON_ERROR_STOP=1 `
  -c "select current_database(), inet_server_addr(), current_setting('server_version');"

pg_dump --dbname="$env:PRODUCTION_DATABASE_URL" `
  --format=custom --no-owner --no-acl `
  --schema=public --schema=auth --schema=storage `
  --file="$BackupDir\database.dump"
if ($LASTEXITCODE -ne 0) { throw 'Falló pg_dump de datos' }

pg_dump --dbname="$env:PRODUCTION_DATABASE_URL" `
  --schema-only --no-owner --no-acl `
  --schema=public --schema=auth --schema=storage `
  --file="$BackupDir\schema-before.sql"
if ($LASTEXITCODE -ne 0) { throw 'Falló pg_dump de esquema' }

pg_restore --list "$BackupDir\database.dump" |
  Set-Content "$BackupDir\database.contents.txt"
if ($LASTEXITCODE -ne 0) { throw 'El archivo no puede ser leído por pg_restore' }

Get-FileHash "$BackupDir\database.dump" -Algorithm SHA256 |
  Format-List | Out-File "$BackupDir\sha256.txt"
Get-FileHash "$BackupDir\schema-before.sql" -Algorithm SHA256 |
  Format-List | Out-File "$BackupDir\sha256.txt" -Append
```

El directorio debe estar cifrado, con acceso restringido y fuera del repositorio. El dump de `auth` contiene datos sensibles.

### 2.3 Evidencias adicionales

Guardar junto al backup:

- salida completa del preflight;
- `schema-before.sql` y lista de contenidos del dump;
- definiciones previas de functions, policies, triggers, views, constraints e índices afectados;
- inventario y configuración de `storage.buckets` y policies de `storage.objects`;
- IDs de deployments actual y candidato de Vercel;
- commit/bundle de la Edge Function anterior y candidata;
- nombres y digests/versiones de secretos, nunca sus valores;
- commit Git, lockfile, versiones de Node, Supabase CLI y PostgreSQL client;
- métricas y timestamps de inicio/cierre.

### 2.4 Ensayo de restauración

Restaurar `database.dump` en un proyecto/base **Supabase-compatible, vacío y aislado**. La URL de prueba debe ser distinta de producción y verificarse explícitamente antes de ejecutar `pg_restore`.

```powershell
if ([string]::IsNullOrWhiteSpace($env:RESTORE_TEST_DATABASE_URL)) {
  throw 'Falta RESTORE_TEST_DATABASE_URL'
}
if ($env:RESTORE_TEST_DATABASE_URL -eq $env:PRODUCTION_DATABASE_URL) {
  throw 'La base de restore no puede ser producción'
}

psql "$env:RESTORE_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 `
  -c "select current_database(), inet_server_addr();"
pg_restore --dbname="$env:RESTORE_TEST_DATABASE_URL" `
  --no-owner --no-acl "$BackupDir\database.dump"
if ($LASTEXITCODE -ne 0) { throw 'Restore de prueba fallido' }
```

Validar login aislado, conteos de tablas críticas y lectura de ventas/caja/stock. No avanzar sólo porque `pg_restore --list` funcione: se requiere restore real. Si no existe un entorno compatible para ensayarlo, el release queda en NO-GO o necesita aceptación formal del riesgo por el responsable de producción.

## 3. Preflight READ-ONLY

### 3.1 Forma segura de ejecución

Ejecutar con `psql`, no desde un editor que omita metacomandos. Guardar stdout/stderr y código de salida. El wrapper `READ ONLY` impide que las consultas modifiquen producción.

```sql
\set ON_ERROR_STOP on
\pset pager off
\pset null '(null)'
\timing on

BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '3s';
SET LOCAL idle_in_transaction_session_timeout = '10min';
```

Las secciones siguientes se ejecutan dentro de esa transacción y finalizan con `ROLLBACK`. Si una sección estructural devuelve `BLOCKER`, detenerse; no ejecutar dry-run ni migración.

### 3.2 Identidad, capacidad y actividad

```sql
SELECT
  CASE WHEN current_setting('transaction_read_only')::boolean THEN 'OK' ELSE 'BLOCKER' END AS result,
  now() AS checked_at,
  current_database() AS database_name,
  current_user AS database_user,
  inet_server_addr() AS server_address,
  current_setting('server_version') AS server_version,
  current_setting('transaction_read_only') AS transaction_read_only;

SELECT
  CASE WHEN current_setting('server_version_num')::integer / 10000 = 17
       THEN 'OK' ELSE 'BLOCKER_REVALIDATE_MAJOR' END AS result,
  current_setting('server_version') AS actual,
  '17.x (major validado localmente)' AS expected;

SELECT 'BLOCKER_LONG_TRANSACTION' AS result,
       pid, usename, application_name, client_addr, state,
       now() - xact_start AS transaction_age,
       left(query, 200) AS query_sample
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND xact_start IS NOT NULL
  AND now() - xact_start > interval '5 minutes'
ORDER BY xact_start;

WITH requirements(check_name, ok) AS (
  VALUES
    ('authenticated role', EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')),
    ('uuid-ossp available', EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'uuid-ossp')),
    ('CREATE database', has_database_privilege(current_user, current_database(), 'CREATE')),
    ('CREATE public', has_schema_privilege(current_user, 'public', 'CREATE')),
    ('USAGE public', has_schema_privilege(current_user, 'public', 'USAGE')),
    ('USAGE storage', has_schema_privilege(current_user, 'storage', 'USAGE')),
    ('INSERT storage.buckets', has_table_privilege(current_user, 'storage.buckets', 'INSERT'))
)
SELECT 'BLOCKER_PRIVILEGE_OR_EXTENSION' AS result, check_name
FROM requirements
WHERE NOT ok;

WITH target_relations(relation_name) AS (
  VALUES
    ('public.suppliers'::regclass),
    ('public.purchases'::regclass),
    ('public.purchase_items'::regclass)
)
SELECT 'BLOCKER_NOT_OWNER_FOR_DDL_OR_POLICIES' AS result,
       t.relation_name,
       owner_role.rolname AS owner_role,
       current_user AS migration_role
FROM target_relations t
JOIN pg_class c ON c.oid = t.relation_name
JOIN pg_roles owner_role ON owner_role.oid = c.relowner
WHERE owner_role.rolname <> current_user
  AND NOT pg_has_role(current_user, c.relowner, 'MEMBER')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_roles migration_role_row
    WHERE migration_role_row.rolname = current_user
      AND migration_role_row.rolsuper
  )
  AND NOT (
    t.relation_name = 'storage.objects'::regclass
    AND coalesce(
      (nullif(current_setting('supautils.policy_grants', true), '')::jsonb -> current_user)
        ? 'storage.objects',
      false
    )
  );
```

Resultado esperado: la primera consulta indica `OK`; las otras no devuelven blockers. Para `storage.objects`, esta migración sólo administra policies: se acepta la concesión explícita de `supautils.policy_grants` para el rol actual sin cambiar el propietario administrado. Esa excepción no autoriza otros DDL sobre Storage ni se aplica a las tablas de `public`. Referencia: [Supautils — Manage Policies](https://github.com/supabase/supautils#manage-policies).

Cualquier transacción antigua se investiga y termina por el dueño de esa sesión antes de migrar; el release no cancela sesiones ajenas automáticamente.

### 3.3 Historial remoto de migraciones

```sql
SELECT (to_regclass('supabase_migrations.schema_migrations') IS NOT NULL) AS migration_ledger_exists
\gset

\if :migration_ledger_exists
WITH local_versions(version) AS (
  VALUES
    ('20250101000000'), ('20250102000000'), ('20250103000000'),
    ('20250104000000'), ('20250105000000'), ('20250105500000'),
    ('20250106000000'), ('20250107000000'), ('20260228000000'),
    ('20260301000000'), ('20260302000000'), ('20260302000001'),
    ('20260303000000'), ('20260303000001'), ('20260304000000'),
    ('20260305000000'), ('20260414000000'), ('20260703000000'),
    ('20260819000000'), ('20260908000000'), ('20261002000000'),
    ('20261003000000'), ('20261021000000')
), state AS (
  SELECT l.version,
         EXISTS (
           SELECT 1
           FROM supabase_migrations.schema_migrations m
           WHERE m.version::text = l.version
         ) AS applied
  FROM local_versions l
)
SELECT
  CASE
    WHEN version = '20261021000000' AND applied THEN 'BLOCKER_TARGET_ALREADY_APPLIED'
    WHEN version <> '20261021000000' AND NOT applied THEN 'BLOCKER_LOCAL_HISTORY_MISSING_REMOTE'
    ELSE 'OK'
  END AS result,
  version,
  applied
FROM state
ORDER BY version;

WITH local_versions(version) AS (
  VALUES
    ('20250101000000'), ('20250102000000'), ('20250103000000'),
    ('20250104000000'), ('20250105000000'), ('20250105500000'),
    ('20250106000000'), ('20250107000000'), ('20260228000000'),
    ('20260301000000'), ('20260302000000'), ('20260302000001'),
    ('20260303000000'), ('20260303000001'), ('20260304000000'),
    ('20260305000000'), ('20260414000000'), ('20260703000000'),
    ('20260819000000'), ('20260908000000'), ('20261002000000'),
    ('20261003000000'), ('20261021000000')
)
SELECT 'BLOCKER_REMOTE_MIGRATION_NOT_IN_RELEASE_REPO' AS result,
       m.version::text AS remote_version
FROM supabase_migrations.schema_migrations m
LEFT JOIN local_versions l ON l.version = m.version::text
WHERE l.version IS NULL
ORDER BY m.version::text;
\else
SELECT 'BLOCKER_MIGRATION_LEDGER_MISSING' AS result;
\endif
```

El estado normal es: las primeras 22 versiones aplicadas, `20261021000000` no aplicada y ninguna versión remota desconocida. En particular, `20250105500000_afip_invoice_columns.sql` debe estar reconciliada antes del release.

No se corrige el ledger a ciegas:

- si una versión histórica falta pero su esquema es **exactamente equivalente**, preparar y aprobar por separado un `supabase migration repair --status applied <version>`;
- si no es equivalente o existe duda, **NO-GO**: crear una migración forward-only desde el esquema real, validarla otra vez y reprogramar;
- nunca marcar una versión como aplicada sólo para lograr que el dry-run quede limpio.

### 3.4 Dependencias y colisiones de esquema

```sql
WITH required_relations(object_name) AS (
  VALUES
    ('public.businesses'), ('public.users'), ('public.suppliers'),
    ('public.purchases'), ('public.purchase_items'), ('public.products'),
    ('public.stock_movements'), ('public.customers'), ('public.sales'),
    ('public.cash_sessions'), ('public.cash_movements'),
    ('public.customer_accounts'), ('public.account_movements'),
    ('storage.buckets'), ('storage.objects')
)
SELECT 'BLOCKER_REQUIRED_RELATION_MISSING' AS result, object_name
FROM required_relations
WHERE to_regclass(object_name) IS NULL;

WITH required_functions(signature) AS (
  VALUES
    ('public.get_user_business_id()'),
    ('auth.uid()'),
    ('storage.foldername(text)')
)
SELECT 'BLOCKER_REQUIRED_FUNCTION_MISSING' AS result, signature
FROM required_functions
WHERE to_regprocedure(signature) IS NULL;

WITH required_columns(table_schema, table_name, column_name) AS (
  VALUES
    ('public','businesses','id'),
    ('public','users','id'), ('public','users','business_id'),
    ('public','users','role'), ('public','users','is_superadmin'),
    ('public','suppliers','id'), ('public','suppliers','business_id'),
    ('public','suppliers','name'), ('public','suppliers','cuit'),
    ('public','suppliers','active'),
    ('public','purchases','id'), ('public','purchases','business_id'),
    ('public','purchases','supplier_id'), ('public','purchases','total'),
    ('public','purchases','notes'), ('public','purchases','user_id'),
    ('public','purchases','created_at'),
    ('public','purchase_items','id'), ('public','purchase_items','purchase_id'),
    ('public','purchase_items','product_id'), ('public','purchase_items','quantity'),
    ('public','purchase_items','unit_cost'), ('public','purchase_items','subtotal'),
    ('public','products','id'), ('public','products','business_id'),
    ('public','products','supplier_id'), ('public','products','stock'),
    ('public','products','purchase_price'),
    ('public','stock_movements','business_id'), ('public','stock_movements','product_id'),
    ('public','stock_movements','type'), ('public','stock_movements','quantity'),
    ('public','stock_movements','reference_id'),
    ('public','customers','id'), ('public','customers','business_id'),
    ('public','customers','balance'),
    ('public','sales','id'), ('public','sales','business_id'),
    ('public','sales','customer_id'), ('public','sales','seller_id'),
    ('public','cash_sessions','id'), ('public','cash_sessions','business_id'),
    ('public','cash_sessions','opened_by'), ('public','cash_sessions','status'),
    ('public','cash_movements','session_id'), ('public','cash_movements','type'),
    ('public','cash_movements','amount'), ('public','cash_movements','description'),
    ('public','customer_accounts','business_id'), ('public','customer_accounts','customer_id'),
    ('public','customer_accounts','balance'), ('public','customer_accounts','updated_at'),
    ('public','account_movements','business_id'), ('public','account_movements','customer_id'),
    ('public','account_movements','type'), ('public','account_movements','amount'),
    ('public','account_movements','sale_id'), ('public','account_movements','note'),
    ('public','account_movements','user_id'),
    ('storage','buckets','id'), ('storage','buckets','name'),
    ('storage','buckets','public'), ('storage','buckets','file_size_limit'),
    ('storage','buckets','allowed_mime_types'),
    ('storage','objects','bucket_id'), ('storage','objects','name')
)
SELECT 'BLOCKER_REQUIRED_COLUMN_MISSING' AS result,
       format('%I.%I.%I', r.table_schema, r.table_name, r.column_name) AS object_name
FROM required_columns r
LEFT JOIN information_schema.columns c
  ON c.table_schema = r.table_schema
 AND c.table_name = r.table_name
 AND c.column_name = r.column_name
WHERE c.column_name IS NULL
ORDER BY object_name;

WITH planned_relations(object_name) AS (
  VALUES
    ('public.purchase_concepts'), ('public.tax_types'),
    ('public.payment_methods'), ('public.bank_accounts'),
    ('public.purchase_taxes'), ('public.supplier_accounts'),
    ('public.supplier_payments'), ('public.supplier_payment_allocations'),
    ('public.supplier_ledger'), ('public.accounting_accounts'),
    ('public.accounting_entries'), ('public.accounting_entry_lines'),
    ('public.accounting_rules'), ('public.customer_collections'),
    ('public.document_attachments'), ('public.audit_logs'),
    ('public.user_permissions'), ('public.purchase_vat_summary'),
    ('public.general_ledger')
)
SELECT 'BLOCKER_PLANNED_RELATION_ALREADY_EXISTS' AS result,
       object_name,
       to_regclass(object_name)::text AS existing_object
FROM planned_relations
WHERE to_regclass(object_name) IS NOT NULL;

WITH planned_columns(table_name, column_name) AS (
  VALUES
    ('suppliers','legal_name'), ('suppliers','trade_name'),
    ('suppliers','vat_condition'), ('suppliers','city'),
    ('suppliers','province'), ('suppliers','postal_code'),
    ('suppliers','updated_at'),
    ('purchases','document_type'), ('purchases','letter'),
    ('purchases','point_of_sale'), ('purchases','document_number'),
    ('purchases','document_date'), ('purchases','due_date'),
    ('purchases','payment_condition'), ('purchases','currency'),
    ('purchases','exchange_rate'), ('purchases','subtotal'),
    ('purchases','vat_total'), ('purchases','perceptions_total'),
    ('purchases','withholdings_total'), ('purchases','other_taxes_total'),
    ('purchases','balance_due'), ('purchases','status'),
    ('purchases','is_fiscal'), ('purchases','is_internal'),
    ('purchases','stock_posted'), ('purchases','accounting_entry_id'),
    ('purchases','original_purchase_id'), ('purchases','updated_at'),
    ('purchases','voided_at'), ('purchases','voided_by'),
    ('purchase_items','concept_id'), ('purchase_items','description'),
    ('purchase_items','vat_rate'), ('purchase_items','vat_amount'),
    ('purchase_items','total'), ('purchase_items','created_at')
)
SELECT 'BLOCKER_PLANNED_COLUMN_ALREADY_EXISTS' AS result,
       format('public.%I.%I', p.table_name, p.column_name) AS object_name,
       c.data_type, c.udt_name, c.is_nullable, c.column_default
FROM planned_columns p
JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = p.table_name
 AND c.column_name = p.column_name
ORDER BY object_name;

WITH planned_indexes(index_name) AS (
  VALUES
    ('suppliers_business_cuit_uidx'), ('suppliers_search_idx'),
    ('purchases_document_uidx'), ('purchases_due_idx'),
    ('purchases_document_date_idx'), ('accounting_entries_source_uidx')
)
SELECT 'BLOCKER_PLANNED_INDEX_NAME_COLLISION' AS result,
       p.index_name,
       pg_get_indexdef(i.indexrelid) AS existing_definition
FROM planned_indexes p
JOIN pg_class c ON c.relname = p.index_name AND c.relkind = 'i'
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
JOIN pg_index i ON i.indexrelid = c.oid;

SELECT 'BLOCKER_PLANNED_CONSTRAINT_NAME_COLLISION' AS result,
       conname,
       conrelid::regclass AS relation,
       pg_get_constraintdef(oid, true) AS existing_definition
FROM pg_constraint
WHERE conname IN ('suppliers_cuit_valid_check',
                  'purchases_accounting_entry_id_fkey',
                  'supplier_payments_accounting_entry_id_fkey');

WITH planned_functions(signature) AS (
  VALUES
    ('public.normalize_cuit(text)'),
    ('public.is_valid_cuit(text)'),
    ('public.seed_purchases_accounting(uuid)'),
    ('public.has_permission(text)'),
    ('public.next_accounting_entry_number(uuid)'),
    ('public.confirm_accounting_entry(uuid)'),
    ('public.create_entry_from_purchase(uuid)'),
    ('public.create_purchase_document(uuid,jsonb,jsonb,jsonb,boolean)'),
    ('public.record_supplier_payment(uuid,numeric,date,uuid,jsonb,uuid,uuid,text,text)'),
    ('public.reverse_accounting_entry(uuid,text)'),
    ('public.void_purchase_document(uuid,text)'),
    ('public.create_manual_accounting_entry(jsonb,jsonb)'),
    ('public.record_customer_collection(uuid,numeric,date,uuid,uuid,uuid,text)'),
    ('public.audit_supplier_changes()'),
    ('public.validate_accounting_account_tenant()'),
    ('public.validate_accounting_rule_tenant()'),
    ('public.validate_user_permission_tenant()')
)
SELECT 'BLOCKER_PLANNED_FUNCTION_ALREADY_EXISTS' AS result,
       signature,
       pg_get_function_result(to_regprocedure(signature)) AS existing_result
FROM planned_functions
WHERE to_regprocedure(signature) IS NOT NULL;

WITH replaced_functions(signature, expected_result) AS (
  VALUES
    ('public.apply_account_payment(uuid,uuid,numeric,text,uuid)', 'jsonb'),
    ('public.charge_customer_account(uuid,uuid,numeric,uuid,uuid)', 'jsonb')
)
SELECT 'BLOCKER_REPLACED_FUNCTION_MISSING_OR_WRONG_RETURN' AS result,
       signature,
       pg_get_function_result(to_regprocedure(signature)) AS actual_result,
       expected_result
FROM replaced_functions
WHERE to_regprocedure(signature) IS NULL
   OR pg_get_function_result(to_regprocedure(signature)) <> expected_result;

SELECT
  CASE
    WHEN id IS NULL THEN 'OK_BUCKET_WILL_BE_CREATED'
    WHEN name = 'purchase-documents'
     AND public = false
     AND file_size_limit = 10485760
     AND allowed_mime_types @> ARRAY['application/pdf','image/jpeg','image/png']::text[]
     AND cardinality(allowed_mime_types) = 3
      THEN 'BLOCKER_BUCKET_ALREADY_EXISTS_EQUIVALENT_REQUIRES_RECONCILIATION'
    ELSE 'BLOCKER_BUCKET_CONFIGURATION_COLLISION'
  END AS result,
  id, name, public, file_size_limit, allowed_mime_types
FROM (SELECT 'purchase-documents'::text AS expected_id) e
LEFT JOIN storage.buckets b ON b.id = e.expected_id;
```

Para un primer despliegue limpio no debe existir ninguna relación, columna, índice o constraint planificado. Aunque una colisión parezca equivalente, `IF NOT EXISTS` podría ocultar drift; se detiene el release y se compara DDL completo antes de reconciliar.

### 3.5 CUIT duplicados e incompatibles

Estas consultas no dependen de las funciones nuevas.

```sql
WITH normalized AS (
  SELECT id,
         business_id,
         cuit,
         NULLIF(regexp_replace(COALESCE(cuit, ''), '[^0-9]', '', 'g'), '') AS normalized_cuit
  FROM public.suppliers
)
SELECT 'BLOCKER_DUPLICATE_NORMALIZED_CUIT' AS result,
       business_id,
       normalized_cuit,
       count(*) AS offending_rows,
       array_agg(id ORDER BY id) AS supplier_ids
FROM normalized
WHERE normalized_cuit IS NOT NULL
GROUP BY business_id, normalized_cuit
HAVING count(*) > 1
ORDER BY business_id, normalized_cuit;

WITH raw AS (
  SELECT id,
         business_id,
         cuit,
         regexp_replace(COALESCE(cuit, ''), '[^0-9]', '', 'g') AS digits
  FROM public.suppliers
  WHERE cuit IS NOT NULL
), calculated AS (
  SELECT *,
    CASE WHEN digits ~ '^[0-9]{11}$' THEN
      substring(digits, 1, 1)::integer * 5 +
      substring(digits, 2, 1)::integer * 4 +
      substring(digits, 3, 1)::integer * 3 +
      substring(digits, 4, 1)::integer * 2 +
      substring(digits, 5, 1)::integer * 7 +
      substring(digits, 6, 1)::integer * 6 +
      substring(digits, 7, 1)::integer * 5 +
      substring(digits, 8, 1)::integer * 4 +
      substring(digits, 9, 1)::integer * 3 +
      substring(digits,10, 1)::integer * 2
    END AS weighted_sum
  FROM raw
), validated AS (
  SELECT *,
    CASE
      WHEN weighted_sum IS NULL THEN NULL
      WHEN 11 - (weighted_sum % 11) = 11 THEN 0
      WHEN 11 - (weighted_sum % 11) = 10 THEN 9
      ELSE 11 - (weighted_sum % 11)
    END AS expected_digit
  FROM calculated
)
SELECT 'BLOCKER_CUIT_INCOMPATIBLE_WITH_NEW_CHECK' AS result,
       business_id, id AS supplier_id, cuit, digits, expected_digit
FROM validated
WHERE digits !~ '^[0-9]{11}$'
   OR expected_digit <> substring(digits, 11, 1)::integer
ORDER BY business_id, id;
```

La constraint de CUIT se crea `NOT VALID`, por lo que un CUIT histórico inválido no necesariamente aborta el DDL. Sin embargo, vuelve incompatibles futuras ediciones de esa fila y se considera blocker funcional hasta resolverlo mediante un proceso de saneamiento separado y autorizado. Este preflight **no corrige** el dato.

### 3.6 Comprobantes duplicados

Si las columnas nuevas no existen —estado esperado— las compras históricas recibirán `point_of_sale` y `document_number` nulos, por lo que no chocan con el índice parcial. Si hubo un despliegue parcial, la colisión estructural anterior ya es blocker; además ejecutar este chequeo condicional:

```sql
SELECT count(*) = 4 AS purchase_document_columns_exist
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'purchases'
  AND column_name IN ('document_type','point_of_sale','document_number','status')
\gset

\if :purchase_document_columns_exist
SELECT 'BLOCKER_DUPLICATE_PURCHASE_DOCUMENT' AS result,
       business_id,
       supplier_id,
       document_type,
       point_of_sale,
       document_number,
       count(*) AS offending_rows,
       array_agg(id ORDER BY id) AS purchase_ids
FROM public.purchases
WHERE supplier_id IS NOT NULL
  AND point_of_sale IS NOT NULL
  AND document_number IS NOT NULL
  AND status <> 'voided'
GROUP BY business_id, supplier_id, document_type, point_of_sale, document_number
HAVING count(*) > 1
ORDER BY business_id, supplier_id, document_type, point_of_sale, document_number;
\else
SELECT 'OK_PURCHASE_DOCUMENT_COLUMNS_NOT_PRESENT_YET' AS result;
\endif
```

### 3.7 Filas sin `business_id`

Las filas globales de `categories` y `category_aliases` admiten `business_id` nulo por diseño de `20260303000001_category_suggest.sql`; se informan como `INFO_GLOBAL_CATEGORY_ROWS`. Esta excepción no se extiende a otras tablas ni demuestra por sí sola que sus policies sean correctas.

Genera y ejecuta únicamente `SELECT count(*)` sobre todas las tablas base de `public` que tengan esa columna.

```sql
SELECT format(
  'SELECT %L AS result, %L AS relation, count(*)::bigint AS offending_rows FROM %I.%I WHERE business_id IS NULL HAVING count(*) > 0;',
  CASE WHEN c.table_name IN ('categories', 'category_aliases')
       THEN 'INFO_GLOBAL_CATEGORY_ROWS'
       ELSE 'BLOCKER_NULL_BUSINESS_ID' END,
  c.table_schema || '.' || c.table_name,
  c.table_schema,
  c.table_name
)
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema
 AND t.table_name = c.table_name
 AND t.table_type = 'BASE TABLE'
WHERE c.table_schema = 'public'
  AND c.column_name = 'business_id'
ORDER BY c.table_name
\gexec
```

Resultado esperado: cero filas.

### 3.8 Referencias huérfanas

Primero se revisan todas las foreign keys simples existentes; luego las referencias legacy que no tienen FK declarada.

```sql
WITH foreign_keys AS (
  SELECT con.oid,
         con.conname,
         child_ns.nspname AS child_schema,
         child.relname AS child_table,
         child_col.attname AS child_column,
         parent_ns.nspname AS parent_schema,
         parent.relname AS parent_table,
         parent_col.attname AS parent_column
  FROM pg_constraint con
  JOIN pg_class child ON child.oid = con.conrelid
  JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
  JOIN pg_class parent ON parent.oid = con.confrelid
  JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
  JOIN pg_attribute child_col
    ON child_col.attrelid = child.oid AND child_col.attnum = con.conkey[1]
  JOIN pg_attribute parent_col
    ON parent_col.attrelid = parent.oid AND parent_col.attnum = con.confkey[1]
  WHERE con.contype = 'f'
    AND child_ns.nspname = 'public'
    AND array_length(con.conkey, 1) = 1
)
SELECT format(
  'SELECT %L AS result, %L AS constraint_name, count(*)::bigint AS offending_rows FROM %I.%I c LEFT JOIN %I.%I p ON c.%I = p.%I WHERE c.%I IS NOT NULL AND p.%I IS NULL HAVING count(*) > 0;',
  'BLOCKER_ORPHAN_REFERENCE',
  conname,
  child_schema, child_table,
  parent_schema, parent_table,
  child_column, parent_column,
  child_column, parent_column
)
FROM foreign_keys
ORDER BY child_schema, child_table, conname
\gexec

SELECT 'BLOCKER_UNVALIDATED_FOREIGN_KEY' AS result,
       conrelid::regclass AS relation,
       conname,
       pg_get_constraintdef(oid, true) AS definition
FROM pg_constraint
WHERE contype = 'f'
  AND connamespace = 'public'::regnamespace
  AND NOT convalidated
ORDER BY conrelid::regclass::text, conname;

WITH checks AS (
  SELECT 'account_movements.sale_id -> sales.id' AS reference_name, count(*)::bigint AS offending_rows
  FROM public.account_movements m
  LEFT JOIN public.sales s ON s.id = m.sale_id
  WHERE m.sale_id IS NOT NULL AND s.id IS NULL
  UNION ALL
  SELECT 'account_movements.user_id -> users.id', count(*)::bigint
  FROM public.account_movements m
  LEFT JOIN public.users u ON u.id = m.user_id
  WHERE m.user_id IS NOT NULL AND u.id IS NULL
)
SELECT 'BLOCKER_ORPHAN_LOOSE_REFERENCE' AS result, reference_name, offending_rows
FROM checks
WHERE offending_rows > 0;
```

Una FK compuesta, si apareciera, se lista para revisión manual:

```sql
SELECT 'BLOCKER_COMPOSITE_FK_REQUIRES_MANUAL_ORPHAN_CHECK' AS result,
       conrelid::regclass AS relation,
       conname,
       pg_get_constraintdef(oid, true) AS definition
FROM pg_constraint
WHERE contype = 'f'
  AND connamespace = 'public'::regnamespace
  AND array_length(conkey, 1) > 1;
```

### 3.9 Cruces de tenant

```sql
WITH checks AS (
  SELECT 'purchases -> suppliers' AS relation, count(*)::bigint AS offending_rows
  FROM public.purchases p
  JOIN public.suppliers s ON s.id = p.supplier_id
  WHERE p.business_id IS DISTINCT FROM s.business_id

  UNION ALL
  SELECT 'purchases -> users', count(*)::bigint
  FROM public.purchases p
  JOIN public.users u ON u.id = p.user_id
  WHERE p.business_id IS DISTINCT FROM u.business_id

  UNION ALL
  SELECT 'purchase_items -> products', count(*)::bigint
  FROM public.purchase_items i
  JOIN public.purchases p ON p.id = i.purchase_id
  JOIN public.products pr ON pr.id = i.product_id
  WHERE p.business_id IS DISTINCT FROM pr.business_id

  UNION ALL
  SELECT 'products -> suppliers', count(*)::bigint
  FROM public.products pr
  JOIN public.suppliers s ON s.id = pr.supplier_id
  WHERE pr.business_id IS DISTINCT FROM s.business_id

  UNION ALL
  SELECT 'sales -> customers', count(*)::bigint
  FROM public.sales s
  JOIN public.customers c ON c.id = s.customer_id
  WHERE s.business_id IS DISTINCT FROM c.business_id

  UNION ALL
  SELECT 'sales -> seller', count(*)::bigint
  FROM public.sales s
  JOIN public.users u ON u.id = s.seller_id
  WHERE s.business_id IS DISTINCT FROM u.business_id

  UNION ALL
  SELECT 'cash_sessions -> opened_by', count(*)::bigint
  FROM public.cash_sessions cs
  JOIN public.users u ON u.id = cs.opened_by
  WHERE cs.business_id IS DISTINCT FROM u.business_id

  UNION ALL
  SELECT 'customer_accounts -> customers', count(*)::bigint
  FROM public.customer_accounts ca
  JOIN public.customers c ON c.id = ca.customer_id
  WHERE ca.business_id IS DISTINCT FROM c.business_id

  UNION ALL
  SELECT 'account_movements -> customers', count(*)::bigint
  FROM public.account_movements am
  JOIN public.customers c ON c.id = am.customer_id
  WHERE am.business_id IS DISTINCT FROM c.business_id

  UNION ALL
  SELECT 'account_movements -> sales', count(*)::bigint
  FROM public.account_movements am
  JOIN public.sales s ON s.id = am.sale_id
  WHERE am.business_id IS DISTINCT FROM s.business_id

  UNION ALL
  SELECT 'account_movements -> users', count(*)::bigint
  FROM public.account_movements am
  JOIN public.users u ON u.id = am.user_id
  WHERE am.business_id IS DISTINCT FROM u.business_id
)
SELECT 'BLOCKER_CROSS_TENANT_REFERENCE' AS result, relation, offending_rows
FROM checks
WHERE offending_rows > 0
ORDER BY relation;
```

Resultado esperado: cero filas. Estas inconsistencias podrían no abortar todo el DDL, pero invalidan el aislamiento y la contabilidad; son NO-GO.

### 3.10 Definiciones para rollback y línea base

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN ('suppliers','purchases','purchase_items'))
   OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY schemaname, tablename, policyname;

SELECT n.nspname AS schema_name,
       p.proname,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_function_result(p.oid) AS result_type,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'apply_account_payment',
    'charge_customer_account',
    'record_customer_collection',
    'get_user_business_id'
  )
ORDER BY p.proname, identity_arguments;

SELECT event_object_schema, event_object_table, trigger_name,
       action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('suppliers','purchases','purchase_items')
ORDER BY event_object_table, trigger_name, event_manipulation;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE (schemaname = 'public' AND tablename IN ('suppliers','purchases','purchase_items'))
   OR (schemaname = 'storage' AND tablename IN ('buckets','objects'))
ORDER BY schemaname, tablename, indexname;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema IN ('public','storage')
  AND table_name IN ('suppliers','purchases','purchase_items','objects')
ORDER BY table_schema, table_name, grantee, privilege_type;

SELECT relname AS relation,
       n_live_tup AS estimated_rows,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN (
    'businesses','users','suppliers','purchases','purchase_items',
    'products','stock_movements','customers','sales',
    'cash_sessions','cash_movements','customer_accounts','account_movements'
  )
ORDER BY relname;

ROLLBACK;
```

Archivar la salida sin editar. `ROLLBACK` debe aparecer y el proceso debe finalizar con código `0`.

### 3.11 Criterio de aprobación del preflight

| Resultado | Decisión |
| --- | --- |
| Cualquier fila `BLOCKER_*` | NO-GO |
| Major PostgreSQL distinto de 17 | revalidar migración en ese major; NO-GO hasta entonces |
| Versión histórica ausente/remota desconocida | reconciliar formalmente; NO-GO |
| Objeto/columna planificado ya existente | comparar DDL y datos; NO-GO |
| CUIT inválido aunque la constraint sea `NOT VALID` | saneamiento separado; NO-GO |
| Bucket preexistente, aun equivalente | comprobar origen y ledger; NO-GO hasta reconciliar |
| Todas las consultas limpias | candidato a GO, sujeto a dry-run y aprobación humana |

## 4. Orden exacto del despliegue

### Paso 0 — Preparación, sin cambios productivos

1. Fijar `RELEASE_ID`, commit y artefactos inmutables.
2. Ejecutar nuevamente en CI/local `npm ci`, `npm test` y `npm run build` sobre ese commit.
3. Verificar que `vercel.json` apunta al project ref productivo autorizado.
4. Confirmar credenciales ARCA por nombre y disponibilidad, no por valor.
5. Activar ventana y congelamiento de compras/proveedores.

### Paso 1 — Backup

Ejecutar íntegramente la sección 2. No avanzar sin snapshot/PITR, dump, hashes y restore de prueba aprobados por operador y revisor.

### Paso 2 — Preflight

Ejecutar íntegramente la sección 3 contra la conexión directa productiva en una transacción `READ ONLY`. Guardar salida. Operador y revisor firman el resultado. Cualquier blocker termina el intento sin modificaciones.

### Paso 3 — Migraciones

#### 3.1 Reconciliar historial antes del push

La ruta normal exige que el ledger remoto contenga las primeras 22 versiones y no contenga `20261021000000`.

Si falta una versión histórica:

1. detener release;
2. comparar `schema-before.sql` con el SQL local correspondiente;
3. si son equivalentes, preparar un comando `migration repair` específico y obtener una autorización adicional;
4. si no son equivalentes, crear migración forward-only y repetir validación completa;
5. no incluir el repair y la migración funcional en una misma decisión improvisada.

#### 3.2 Dry-run obligatorio

En la ventana autorizada, usando Supabase CLI `2.121.0` fijada por el proyecto y sin `supabase link`:

```powershell
npx.cmd --no-install supabase --version
npx.cmd --no-install supabase db push `
  --db-url "$env:PRODUCTION_DATABASE_URL" `
  --dry-run
```

La salida aceptable enumera **sólo**:

```text
20261021000000_purchases_accounting.sql
```

Si enumera `20250105500000`, cualquier otra histórica, ninguna migración o más de una migración: NO-GO.

#### 3.3 Aplicación

Sólo después de doble aprobación del dry-run:

```powershell
npx.cmd --no-install supabase db push `
  --db-url "$env:PRODUCTION_DATABASE_URL"
```

Guardar log y código de salida. No reintentar automáticamente. Ante error:

1. detenerse;
2. comprobar si la versión quedó registrada;
3. comprobar si existen objetos parciales;
4. no ejecutar manualmente fragmentos del archivo;
5. seguir la sección de rollback/incidente.

#### 3.4 Post-check inmediato de base

En una nueva transacción READ-ONLY verificar:

- versión `20261021000000` presente una sola vez en el ledger;
- todas las tablas, views, funciones, índices, triggers y policies objetivo presentes;
- `suppliers_cuit_valid_check` presente como `NOT VALID`, según diseño actual;
- RLS habilitado en todas las tablas nuevas;
- índices válidos (`pg_index.indisvalid` y `indisready`);
- cero filas en tablas contables nuevas antes del smoke, salvo configuración creada posteriormente por los RPC;
- bucket `purchase-documents` privado, límite 10 MiB y sólo PDF/JPEG/PNG;
- conteos de tablas legacy coherentes con la línea base;
- ventas, caja y stock legibles con usuario normal.

No iniciar Edge/frontend si falla cualquier post-check.

### Paso 4 — Edge Function ARCA

1. Confirmar que los secretos productivos existen: `ARCA_PADRON_ENDPOINT` y `ARCA_PADRON_ACCESS_TOKEN`.
2. Confirmar `SUPABASE_PROJECT_REF` contra el acta del release.
3. Desplegar sólo la función objetivo desde el commit aprobado, sin enlazar el repositorio:

```powershell
npx.cmd --no-install supabase functions deploy arca-supplier-lookup `
  --project-ref "$env:SUPABASE_PROJECT_REF"
```

4. Probar con JWT de usuario normal: sin token `401`, JSON malformado `400`, CUIT inválido `400`, CUIT válido con respuesta controlada `200` o `404` según ARCA.
5. No usar `service_role` en el smoke. No imprimir el access token ARCA.

### Paso 5 — Frontend

1. Promover en Vercel el artefacto inmutable construido desde el commit aprobado; no reconstruir desde otro commit durante la ventana.
2. Confirmar variables públicas de Supabase y el rewrite `/supabase-api` del proyecto productivo.
3. Registrar URL/ID nuevo y conservar URL/ID anterior.
4. Abrir en sesión limpia/incógnito para evitar service worker o assets cacheados.
5. Verificar que `index.html`, `sw.js`, manifests y `version.json` no quedan cacheados; los assets hash sí pueden ser inmutables.

La base se despliega antes que el frontend porque el frontend nuevo depende de RPC/tablas nuevas. Mantener congeladas las escrituras de compras durante el intervalo: la migración reemplaza policies y funciones, por lo que el frontend anterior no debe asumirse completamente compatible con el flujo nuevo.

### Paso 6 — Smoke tests

Ejecutar la sección 5 en orden. Ante una falla crítica, no continuar “para juntar más resultados”: iniciar rollback o contención según la sección 6.

### Paso 7 — Observación y cierre

1. Observar al menos 30 minutos errores de Auth, REST, Edge, PostgreSQL y frontend.
2. Comparar latencia/error rate/ventas contra la línea base.
3. Confirmar que no hay bloqueos prolongados ni asientos desbalanceados.
4. Cerrar ventana sólo con smoke completo y evidencia firmada.
5. Mantener backups y artefactos según política de retención.

## 5. Smoke tests productivos mínimos

### 5.1 Reglas del smoke

- Usar exclusivamente tenants smoke A y B; nunca un tenant real de cliente para escrituras de prueba.
- Usar usuarios `authenticated` normales con permisos reales; nunca `service_role`.
- Etiquetar toda escritura con `RELEASE_SMOKE_<RELEASE_ID>` en nombre, referencia o notas.
- Usar un CUIT válido reservado y aprobado; no inventar identidad de un tercero.
- Usar comprobante único, por ejemplo POS reservado y número derivado del timestamp UTC.
- Crear una factura A fiscal controlada de `100,00` + IVA 21% = `121,00`, sin actualizar stock.
- Registrar el pago por `121,00` mediante medio/cuenta bancaria smoke; no mover una caja o banco real.
- No borrar filas contables. Las correcciones son anulaciones/reversiones o intervención contable.

### 5.2 Secuencia y resultado esperado

| # | Prueba | Acción | Resultado esperado |
| ---: | --- | --- | --- |
| 1 | Login A | iniciar sesión limpia con usuario A | sesión válida, negocio A correcto, sin errores Auth |
| 2 | Login B | iniciar sesión separada con usuario B | sesión válida, negocio B correcto |
| 3 | Ventas existentes | abrir listado y detalle de una venta histórica de A | mismos totales/cliente/items; sólo lectura |
| 4 | Caja | abrir caja actual/histórica y movimientos | saldos y movimientos visibles; no se crea movimiento |
| 5 | Stock | abrir producto y movimientos | stock coincide con línea base; sólo lectura |
| 6 | Crear proveedor | crear `RELEASE_SMOKE_<id>` con CUIT reservado | proveedor visible sólo en A; auditoría `CREATE` |
| 7 | Crear compra | factura A fiscal controlada, neto 100, IVA 21, total 121, a cuenta, sin actualizar stock | compra confirmada, saldo 121, stock sin cambios |
| 8 | Cuenta corriente | abrir cuenta del proveedor | débito 121 y saldo 121 |
| 9 | Asiento compra | abrir asiento ligado a la compra | Compras 100 Debe + IVA crédito 21 Debe = Proveedores 121 Haber |
| 10 | Registrar pago | pago 121 imputado íntegramente con referencia smoke | pago confirmado; compra `paid`; saldo de compra 0 |
| 11 | Cuenta corriente final | recargar proveedor | movimiento crédito 121; saldo proveedor 0 |
| 12 | Asiento pago | abrir asiento ligado al pago | Proveedores 121 Debe = Banco/Caja smoke 121 Haber |
| 13 | Libro mayor | filtrar fecha/referencia smoke | aparecen ambos asientos; cada asiento y total están balanceados |
| 14 | IVA compras | abrir resumen de IVA | neto 100, IVA 21, total 121 para la compra |
| 15 | ARCA | consultar CUIT de prueba permitido | respuesta controlada sin exponer secretos; errores tipados correctamente |
| 16 | Regresión final | repetir lectura de ventas, caja y stock | sin cambios inesperados ni errores |

### 5.3 Verificaciones SQL READ-ONLY posteriores al smoke

Usar IDs capturados por la UI/RPC y sustituir variables de `psql`; no buscar por datos ambiguos.

```sql
\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';

-- Definir antes: \set purchase_id 'uuid', \set payment_id 'uuid', \set supplier_id 'uuid'

SELECT p.id, p.business_id, p.total, p.subtotal, p.vat_total,
       p.balance_due, p.status, p.stock_posted, p.accounting_entry_id
FROM public.purchases p
WHERE p.id = :'purchase_id'::uuid;

SELECT sa.business_id, sa.supplier_id, sa.balance
FROM public.supplier_accounts sa
WHERE sa.supplier_id = :'supplier_id'::uuid;

SELECT movement_type, debit, credit, purchase_id, payment_id, description
FROM public.supplier_ledger
WHERE supplier_id = :'supplier_id'::uuid
ORDER BY occurred_at, id;

SELECT ae.id, ae.business_id, ae.entry_number, ae.source_type, ae.source_id,
       ae.status, sum(ael.debit) AS debit, sum(ael.credit) AS credit
FROM public.accounting_entries ae
JOIN public.accounting_entry_lines ael ON ael.entry_id = ae.id
WHERE (ae.source_type = 'PURCHASE' AND ae.source_id = :'purchase_id'::uuid)
   OR (ae.source_type = 'PAYMENT' AND ae.source_id = :'payment_id'::uuid)
GROUP BY ae.id
ORDER BY ae.entry_number;

SELECT *
FROM public.purchase_vat_summary
WHERE purchase_id = :'purchase_id'::uuid;

SELECT gl.*
FROM public.general_ledger gl
JOIN public.accounting_entries ae ON ae.id = gl.entry_id
WHERE ae.source_id IN (:'purchase_id'::uuid, :'payment_id'::uuid)
ORDER BY gl.entry_number, gl.account_code;

SELECT 'BLOCKER_UNBALANCED_CONFIRMED_ENTRY' AS result, ae.id,
       sum(ael.debit) AS debit, sum(ael.credit) AS credit
FROM public.accounting_entries ae
JOIN public.accounting_entry_lines ael ON ael.entry_id = ae.id
WHERE ae.status = 'confirmed'
GROUP BY ae.id
HAVING sum(ael.debit) <> sum(ael.credit) OR sum(ael.debit) = 0;

ROLLBACK;
```

Esperado: compra y pago presentes, saldos cero, dos asientos confirmados y balanceados, IVA correcto y ninguna fila `BLOCKER_UNBALANCED_CONFIRMED_ENTRY`.

### 5.4 RLS con dos negocios

Conservar un ID conocido de proveedor, compra, pago, ledger, asiento y línea de asiento del tenant B.

1. Autenticado como A, consultar por ID las filas B en `suppliers`, `purchases`, `supplier_payments`, `supplier_ledger`, `accounting_entries` y `accounting_entry_lines`: devuelve cero filas.
2. Como A, intentar insertar usando `business_id` B por la API normal: debe fallar con RLS/permisos.
3. Como A, intentar `UPDATE` y `DELETE` sobre IDs B: cero filas afectadas o error autorizado; nunca éxito.
4. Como A, listar `purchase-documents` bajo prefijo B e intentar subir a ese prefijo: no puede leer ni escribir.
5. Autenticado como B, confirmar que sus filas siguen intactas y que no puede leer las filas smoke A.
6. Repetir una consulta legítima A sobre sus propias filas: debe funcionar, evitando falsos positivos por sesión/token inválido.

Falla crítica inmediata: cualquier lectura o mutación cross-tenant. Se revierte/contiene el release sin esperar el resto de la observación.

### 5.5 Tratamiento de datos smoke

No realizar `DELETE`. La compra puede anularse mediante el flujo soportado y generar asiento inverso, pero el pago a proveedor no tiene en esta entrega un flujo automático de anulación equivalente. Por eso:

- opción preferida: conservar los registros etiquetados en tenants smoke excluidos de reportes reales;
- si deben neutralizarse: contador/administrador registra la reversión o ajuste compensatorio aprobado;
- nunca editar saldos, ledger o asientos directamente;
- la limpieza del proveedor se hace sólo cuando no queden dependencias y mediante un procedimiento posterior aprobado.

## 6. Rollback

### 6.1 Disparadores

Iniciar rollback/contención ante cualquiera de estos eventos:

- migración con error o estado incierto;
- login o lectura de ventas/caja/stock rota;
- acceso cross-tenant;
- compra/pago parcial con datos inconsistentes;
- asiento desbalanceado o libro mayor incorrecto;
- incremento material y sostenido de errores 5xx/latencia;
- Edge ARCA rompe el frontend o filtra información sensible;
- frontend no carga o service worker mantiene una versión incompatible.

### 6.2 Decisión por momento del fallo

#### A. Antes de aplicar migraciones

Abortar. No hay rollback de datos: sólo cerrar intento, conservar evidencia y levantar congelamiento cuando se confirme que no hubo escritura.

#### B. Migración falla antes del commit

El runner de migraciones debe ejecutar el archivo de forma transaccional; PostgreSQL revierte el archivo al fallar. Aun así:

1. no reintentar;
2. comprobar ledger y objetos parciales en READ-ONLY;
3. si no quedó versión ni objeto, registrar rollback automático confirmado;
4. si hay estado parcial, tratar como incidente y no ejecutar SQL ad hoc.

#### C. Base aplicada, Edge/frontend aún no desplegados

1. mantener congeladas compras/proveedores;
2. verificar si ventas/caja/stock siguen normales;
3. preferir dejar el esquema aditivo y corregir hacia adelante;
4. si las policies/functions reemplazadas rompen el frontend anterior, aplicar una **migración de rollback previamente revisada** que restaure exactamente sus definiciones desde `schema-before.sql`;
5. no eliminar tablas/columnas nuevas automáticamente.

#### D. Edge Function defectuosa

1. redeploy del bundle anterior desde su commit inmutable;
2. restaurar la versión anterior de secretos sólo desde el gestor seguro si se cambiaron;
3. confirmar `401/400` y caso válido;
4. no tocar base ni frontend si son sanos.

#### E. Frontend defectuoso

1. promover/reasignar en Vercel el deployment productivo anterior;
2. invalidar/verificar `index.html`, `sw.js`, manifests y `version.json`;
3. mantener la base nueva si no causa regresión;
4. verificar compras: el frontend anterior puede no ser compatible con las policies nuevas, por lo que el congelamiento continúa hasta decidir restaurar policies/functions o publicar un hotfix.

#### F. Corrupción o incidente severo post-commit

1. detener escrituras y poner mantenimiento;
2. registrar timestamp del incidente y preservar logs;
3. decidir entre migración compensatoria, restauración selectiva o restore PITR;
4. para PITR/full restore, aceptar explícitamente la pérdida o reconciliación de escrituras posteriores al punto de backup;
5. restaurar en aislamiento, validar y luego conmutar según procedimiento del proveedor;
6. reconciliar ventas, caja, stock y comprobantes producidos desde el snapshot antes de reabrir.

Un restore total es la última opción: es manual, requiere outage, autorización del dueño de datos y reconciliación de toda escritura posterior.

### 6.3 Contenido mínimo de la migración de rollback preparada

Antes del GO debe existir, revisada pero no aplicada, una migración forward-only que pueda:

- restaurar definiciones previas de `apply_account_payment` y `charge_customer_account`;
- restaurar cualquier definición previa de `record_customer_collection` si existía;
- restaurar policies previas de `suppliers`, `purchases`, `purchase_items` y `storage.objects`;
- restaurar grants previos;
- retirar/inhabilitar triggers nuevos que afecten al flujo anterior, sólo si es necesario;
- opcionalmente retirar la constraint/índices nuevos si se demuestra que causan la regresión;
- **no** borrar tablas contables ni datos creados durante el release.

Las definiciones exactas sólo pueden generarse desde el snapshot de producción tomado en el preflight; no deben reconstruirse de memoria.

## 7. Reversibilidad

| Operación | Reversión automática | Reversión manual/controlada |
| --- | --- | --- |
| Preflight READ-ONLY | `ROLLBACK`; no escribe | no aplica |
| Dry-run | no escribe | no aplica |
| Migración que falla antes del commit | sí, rollback transaccional del archivo | verificar ledger/objetos antes de reintentar |
| Migración ya confirmada | no | forward rollback o restore |
| Nuevas tablas/columnas | no después del commit | dejarlas compatibles; drop sólo tras auditoría y sin datos útiles |
| Índices/constraints nuevos | no después del commit | drop/recreate en migración revisada |
| Policies/grants reemplazados | no después del commit | restaurar definiciones capturadas |
| Functions/views reemplazadas | no después del commit | restaurar definiciones capturadas |
| Trigger de auditoría | no después del commit | drop/restore mediante migración; conservar logs |
| Bucket/policies Storage | rollback transaccional sólo si falla el DDL | restaurar configuración/policies; no borrar objetos |
| Edge Function ARCA | no | redeploy inmediato del bundle anterior |
| Secretos ARCA | no | restaurar versión previa desde gestor seguro |
| Frontend Vercel | no | promover deployment anterior |
| Datos de compra smoke | no tras RPC confirmado | anular compra con flujo soportado; genera reversión contable |
| Pago smoke | no | ajuste/reversión contable aprobada; no hay anulación automática en esta entrega |
| Asientos/ledger | nunca se borran automáticamente | asientos compensatorios/reversos |
| Repair del ledger de migraciones | no | repair inverso sólo con evidencia; nunca automático |
| Restore PITR/full | no | operación manual destructiva con reconciliación posterior |

La estrategia normal de rollback post-release es **frontend anterior + Edge anterior + base aditiva conservada**. La base sólo se revierte cuando se demuestra que policies/functions/schema causan el incidente y existe SQL exacto, revisado y respaldado.

## 8. Checklist de cierre

### Antes de autorizar

- [ ] `RELEASE_ID`, commit y targets confirmados.
- [ ] Aprobación funcional/contable registrada.
- [ ] Snapshot/PITR registrado.
- [ ] Dump, hash y restore de prueba aprobados.
- [ ] Preflight sin blockers.
- [ ] Historial de migraciones reconciliado.
- [ ] Dry-run muestra sólo `20261021000000`.
- [ ] Rollback SQL selectivo preparado desde producción.
- [ ] Edge/frontend anterior recuperables.
- [ ] Tenants A/B y datos smoke preparados.

### Después de desplegar

- [ ] Migración y post-check de DB aprobados.
- [ ] Edge ARCA aprobada.
- [ ] Frontend aprobado en sesión limpia.
- [ ] Login, ventas, caja y stock aprobados.
- [ ] Proveedor, compra, pago y cuenta corriente aprobados.
- [ ] Asientos, IVA y libro mayor aprobados.
- [ ] RLS A/B y Storage aprobados.
- [ ] Observación de 30 minutos sin regresiones.
- [ ] Evidencias, IDs y timestamps archivados.
- [ ] Ventana cerrada y stakeholders informados.

## 9. Autorización requerida

Este plan no constituye autorización. Para comenzar cualquier interacción de despliegue debe recibirse una instrucción explícita equivalente a:

```text
AUTORIZO EL RELEASE DE PRODUCCIÓN
Release: <RELEASE_ID>
Commit: <SHA>
Supabase project ref: <PROJECT_REF>
Frontend target: <VERCEL_PROJECT/DEPLOYMENT>
Ventana: <INICIO/FIN>
Backup y preflight: autorizados
```

Hasta recibirla, no ejecutar `supabase link`, `db push`, `migration repair`, despliegues de funciones, cambios de secretos, despliegues/promociones de Vercel ni escrituras en producción.
