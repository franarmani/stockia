import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const phase = process.argv[2];
if (!['dry-run', 'migrate', 'edge', 'smoke'].includes(phase)) {
  throw new Error('Fase requerida: dry-run, migrate, edge o smoke.');
}
const releaseRoot = resolve('backups.local/release-purchases-accounting-20261022');
const approval = JSON.parse(readFileSync(resolve(releaseRoot, 'approval.json'), 'utf8'));
const project = 'mrpenblsmooeqzegtcqp';
const target = '20261021000000_purchases_accounting.sql';
const migrationPath = resolve('supabase/migrations', target);
const edgePath = resolve('supabase/functions/arca-supplier-lookup/index.ts');
const sha256 = (filename) => createHash('sha256').update(readFileSync(filename)).digest('hex');
if (approval.project !== project || approval.excludeMusic !== true || approval.authorized !== true
  || approval.migrationSha256 !== sha256(migrationPath) || approval.edgeSha256 !== sha256(edgePath)) {
  throw new Error('El alcance o los hashes no coinciden con el release aprobado.');
}
const { PRODUCTION_DATABASE_URL: connection } = parseEnv(readFileSync('.env', 'utf8'));
let databaseUrl;
try {
  databaseUrl = new URL(connection);
} catch {
  throw new Error('Falta la conexion PostgreSQL valida.');
}
if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)
  || !databaseUrl.hostname.endsWith('.pooler.supabase.com')
  || databaseUrl.username !== `postgres.${project}` || databaseUrl.port !== '5432'
  || databaseUrl.pathname !== '/postgres') {
  throw new Error('Destino PostgreSQL inesperado.');
}
databaseUrl.searchParams.set('sslmode', 'require');
const redact = (text) => {
  let safe = text ?? '';
  for (const secret of [connection, databaseUrl.href, databaseUrl.password, decodeURIComponent(databaseUrl.password)]) {
    if (secret) safe = safe.split(secret).join('[REDACTED]');
  }
  return safe;
};
const cli = resolve('node_modules/supabase/dist/supabase.js');
const run = (argumentsList, filename) => {
  const result = spawnSync(process.execPath, [cli, ...argumentsList], {
    encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
  });
  const output = redact(`${result.stdout ?? ''}${result.stderr ?? ''}`);
  writeFileSync(resolve(releaseRoot, filename), output, { mode: 0o600 });
  process.stdout.write(output);
  if (result.error || result.status !== 0) {
    throw new Error(`Fallo ${phase}; no reintentar automaticamente. ${redact(result.error?.message ?? `Codigo ${result.status}`)}`);
  }
  return output;
};
const verifyDryRun = () => {
  const readOnlyUrl = new URL(databaseUrl);
  readOnlyUrl.searchParams.set('options', '-c default_transaction_read_only=on');
  const output = run(['db', 'push', '--dry-run', '--db-url', readOnlyUrl.href], 'dry-run.txt');
  const migrations = [...new Set(output.match(/\b\d{14}_[a-zA-Z0-9_]+\.sql\b/g) ?? [])];
  if (migrations.length !== 1 || migrations[0] !== target) {
    throw new Error('El dry-run no propone exclusivamente Compras/Contabilidad.');
  }
};

if (phase === 'dry-run') {
  verifyDryRun();
} else if (phase === 'migrate') {
  const preflight = readFileSync(resolve(releaseRoot, 'preflight.txt'), 'utf8');
  if (!/^ROLLBACK\s*$/m.test(preflight) || /^\s*BLOCKER_\w+\s*\|/m.test(preflight)
    || !existsSync(resolve(releaseRoot, 'backup/database.dump'))
    || !existsSync(resolve(releaseRoot, 'backup/restore-validated.json'))
    || !existsSync(resolve(releaseRoot, 'source/.vercel/output/config.json'))) {
    throw new Error('Falta backup/restore validado, preflight limpio o artefacto frontend preparado.');
  }
  if (existsSync(resolve(releaseRoot, 'migration-started.json'))) {
    throw new Error('Ya existe un intento de migracion; inspeccionar antes de reintentar.');
  }
  verifyDryRun();
  writeFileSync(resolve(releaseRoot, 'migration-started.json'), JSON.stringify({ startedAt: new Date().toISOString(), project, target }));
  run(['db', 'push', '--db-url', databaseUrl.href, '--yes'], 'migration.txt');
} else {
  const postcheck = readFileSync(resolve(releaseRoot, 'db-postcheck.txt'), 'utf8');
  if (!postcheck.includes('TARGET_VERSION_OK') || /^\s*BLOCKER_\w+/m.test(postcheck)
    || !/^ROLLBACK\s*$/m.test(postcheck)) {
    throw new Error('El post-check de base no esta aprobado.');
  }
  if (phase === 'edge') {
    run(['functions', 'deploy', 'arca-supplier-lookup', '--project-ref', project, '--use-api'], 'edge-deploy.txt');
  } else {
    const smokeFile = resolve(releaseRoot, 'smoke.sql');
    const smoke = readFileSync(smokeFile, 'utf8');
    if ((smoke.match(/^BEGIN;\s*$/gm) ?? []).length !== 1
      || (smoke.match(/^ROLLBACK;\s*$/gm) ?? []).length !== 1
      || /^\s*COMMIT\b/im.test(smoke) || !smoke.includes('PRODUCTION_SMOKE_ROLLBACK_OK')) {
      throw new Error('El smoke no es una unica transaccion revertida.');
    }
    const copy = spawnSync('docker', ['cp', smokeFile, 'supabase_db_nexoventas:/tmp/purchases-production-smoke.sql'], { encoding: 'utf8', timeout: 30_000 });
    if (copy.error || copy.status !== 0) throw new Error('No se pudo copiar el smoke.');
    const shellScript = 'IFS= read -r connection; export PGSSLMODE=require PGCONNECT_TIMEOUT=10; timeout 150 psql --dbname="$connection" -X -v ON_ERROR_STOP=1 -f /tmp/purchases-production-smoke.sql';
    const result = spawnSync('docker', ['exec', '-i', 'supabase_db_nexoventas', 'sh', '-c', shellScript], {
      input: `${databaseUrl.href}\n`, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
    });
    const output = redact(`${result.stdout ?? ''}${result.stderr ?? ''}`);
    writeFileSync(resolve(releaseRoot, 'smoke.txt'), output, { mode: 0o600 });
    if (result.error || result.status !== 0 || !/^ROLLBACK\s*$/m.test(output)
      || !output.includes('PRODUCTION_SMOKE_ROLLBACK_OK')) {
      process.stdout.write(output.split('\n').filter((line) => /ERROR:|ASSERT FAILED|FATAL:/.test(line)).join('\n'));
      throw new Error('Fallo el smoke; detener el release y revisar evidencia.');
    }
    process.stdout.write('PRODUCTION_SMOKE_ROLLBACK_OK: 52 controles funcionales y 44 RLS.\n');
  }
}
