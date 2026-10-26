\set ON_ERROR_STOP on
\pset pager off
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT current_user AS migration_role,
       current_setting('transaction_read_only') AS transaction_read_only,
       current_setting('server_version') AS server_version;
SELECT c.relname, owner_role.rolname AS owner_role,
       coalesce(
         (nullif(current_setting('supautils.policy_grants', true), '')::jsonb -> current_user)
           ? 'storage.objects',
         false
       ) AS storage_policy_grant,
       pg_has_role(current_user, c.relowner, 'MEMBER') AS owner_membership
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_roles owner_role ON owner_role.oid = c.relowner
WHERE n.nspname = 'storage' AND c.relname = 'objects';
SELECT name, setting
FROM pg_settings
WHERE name IN ('shared_preload_libraries', 'supautils.policy_grants');
ROLLBACK;
