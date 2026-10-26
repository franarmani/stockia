import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [sqlFile, outputFile] = process.argv.slice(2);
if (!sqlFile || !outputFile) {
  throw new Error('Uso: node scripts/run-production-readonly.mjs <consulta.sql> <evidencia.txt>');
}
const sql = readFileSync(resolve(sqlFile), 'utf8');
if (!/^BEGIN(?:\s+ISOLATION\s+LEVEL\s+REPEATABLE\s+READ)?\s+READ\s+ONLY\s*;/im.test(sql)
  || !/\bROLLBACK\s*;\s*$/i.test(sql)) {
  throw new Error('La consulta debe abrir una transaccion READ ONLY y terminar con ROLLBACK.');
}

const environmentFile = readFileSync(resolve('.env'), 'utf8');
const matches = [...environmentFile.matchAll(/^\s*(?:export\s+)?PRODUCTION_DATABASE_URL\s*=\s*(.*?)\s*$/gm)];
let connection = matches.at(-1)?.[1];
if (connection?.startsWith("'") && connection.endsWith("'")
  || connection?.startsWith('"') && connection.endsWith('"')) {
  connection = connection.slice(1, -1);
}
if (!connection || /[\r\n]/.test(connection)) {
  throw new Error('Falta una conexion valida en .env.');
}
let connectionUrl;
try {
  connectionUrl = new URL(connection);
} catch {
  throw new Error('Formato de conexion invalido.');
}
if (!['postgres:', 'postgresql:'].includes(connectionUrl.protocol)
  || !connectionUrl.hostname.endsWith('.pooler.supabase.com')
  || connectionUrl.username !== 'postgres.mrpenblsmooeqzegtcqp'
  || connectionUrl.port !== '5432'
  || connectionUrl.pathname !== '/postgres') {
  throw new Error('La conexion no corresponde al Session pooler esperado.');
}

const redact = (value) => {
  let safe = value ?? '';
  for (const secret of [connection, connectionUrl.password]) {
    if (secret) {
      safe = safe.split(secret).join('[REDACTED]');
      try {
        const decoded = decodeURIComponent(secret);
        if (decoded) safe = safe.split(decoded).join('[REDACTED]');
      } catch {}
    }
  }
  return safe;
};
const container = 'supabase_db_nexoventas';
const containerSql = `/tmp/cajago-readonly-${process.pid}.sql`;
const copy = spawnSync('docker', ['cp', resolve(sqlFile), `${container}:${containerSql}`], {
  encoding: 'utf8', timeout: 30_000,
});
if (copy.error || copy.status !== 0) {
  throw new Error(`No se pudo copiar la consulta: ${redact(copy.error?.message ?? copy.stderr)}`);
}

const shellScript = `IFS= read -r connection; connection=$(printf '%s' "$connection" | tr -d '\\r'); export PGCONNECT_TIMEOUT=10 PGSSLMODE=require; export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=3000'; timeout 150 psql --dbname="$connection" -X -v ON_ERROR_STOP=1 -f ${containerSql}`;
const result = spawnSync('docker', ['exec', '-i', container, 'sh', '-c', shellScript], {
  input: `${connection}\n`, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
});
const evidence = redact(`${result.stdout ?? ''}${result.stderr ?? ''}`);
writeFileSync(resolve(outputFile), evidence, { encoding: 'utf8', mode: 0o600 });
if (result.error || result.status !== 0) {
  throw new Error(`Consulta READ ONLY fallida; ver evidencia redactada. ${redact(result.error?.message ?? `Codigo ${result.status}`)}`);
}
if (!/^ROLLBACK\s*$/m.test(result.stdout ?? '')) {
  throw new Error('No se confirmo ROLLBACK en la respuesta.');
}
process.stdout.write(`READ_ONLY_OK: ${resolve(outputFile)}\n`);
