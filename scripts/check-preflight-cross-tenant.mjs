import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const database = process.argv[2];
if (!/^cajago_audit_\d{14}$/.test(database ?? '')) {
  throw new Error('Indicar una copia local cajago_audit_<timestamp>.');
}
const runbook = readFileSync('PRODUCTION-DEPLOYMENT-PLAN.md', 'utf8');
const sectionStart = runbook.indexOf('### 3.9 ');
const sectionEnd = runbook.indexOf('### 3.10 ');
if (sectionStart < 0 || sectionEnd <= sectionStart) {
  throw new Error('No se encontro la comprobacion cross-tenant del runbook.');
}
const section = runbook.slice(sectionStart, sectionEnd);
const sqlBlock = section.match(/```sql\s*\r?\n([\s\S]*?)```/);
if (!sqlBlock) throw new Error('Falta el bloque SQL cross-tenant.');
const auditQuery = sqlBlock[1].trim().replace(/;$/, '');
const query = `
BEGIN READ ONLY;
WITH reported AS (${auditQuery})
SELECT json_build_object(
  'reported_seller_mismatches', coalesce((SELECT offending_rows FROM reported WHERE relation = 'sales -> seller'), 0),
  'expected_seller_mismatches', (
    SELECT count(*) FROM public.sales sale
    JOIN public.users seller ON seller.id = sale.seller_id
    WHERE sale.business_id IS DISTINCT FROM seller.business_id
  )
);
ROLLBACK;
`;
const result = spawnSync('docker', [
  'exec', '-i', 'supabase_db_nexoventas', 'psql', '-U', 'supabase_admin',
  '-d', database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
], { input: query, encoding: 'utf8', timeout: 60_000 });
if (result.error || result.status !== 0) {
  throw new Error(`Fallo la comprobacion local: ${result.error?.message ?? result.stderr}`);
}
const counts = JSON.parse(result.stdout.trim());
if (counts.expected_seller_mismatches === 0) {
  throw new Error('La copia no contiene ventas cruzadas; no permite comprobar este caso de regresion.');
}
if (counts.reported_seller_mismatches !== counts.expected_seller_mismatches) {
  throw new Error(`Falso negativo: el runbook detecta ${counts.reported_seller_mismatches}, pero existen ${counts.expected_seller_mismatches} ventas cruzadas.`);
}
process.stdout.write(`CROSS_TENANT_QUERY_OK: ${counts.expected_seller_mismatches} ventas cruzadas detectadas.\n`);
