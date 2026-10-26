import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const database = process.argv[2];
if (!/^cajago_audit_\d{14}$/.test(database ?? '')) {
  throw new Error('Indicar una base cajago_audit_<timestamp> restaurada desde el backup original.');
}

const query = `
BEGIN READ ONLY;
SELECT json_build_object(
  'migrations', (SELECT coalesce(json_agg(row_to_json(history)), '[]') FROM
    (SELECT version, name, statements FROM supabase_migrations.schema_migrations ORDER BY version) history),
  'tables', (SELECT coalesce(json_agg(table_name), '[]') FROM information_schema.tables WHERE table_schema = 'public'),
  'columns', (SELECT coalesce(json_agg(table_name || '.' || column_name), '[]') FROM information_schema.columns WHERE table_schema = 'public'),
  'functions', (SELECT coalesce(json_agg(proname), '[]') FROM pg_proc JOIN pg_namespace ON pg_namespace.oid = pronamespace WHERE nspname = 'public'),
  'indexes', (SELECT coalesce(json_agg(indexname), '[]') FROM pg_indexes WHERE schemaname = 'public')
);
ROLLBACK;
`;
const result = spawnSync('docker', [
  'exec', '-i', 'supabase_db_nexoventas', 'psql', '-U', 'supabase_admin',
  '-d', database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
], { input: query, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
if (result.error || result.status !== 0) {
  throw new Error(`Fallo la lectura de la copia local: ${result.error?.message ?? result.stderr}`);
}
const snapshot = JSON.parse(result.stdout.trim());
const migrationDirectory = resolve('supabase/migrations');
const files = readdirSync(migrationDirectory).filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort();
const history = new Map(snapshot.migrations.map((migration) => [migration.version, migration]));
const normalize = (text) => text.replace(/\r\n/g, '\n').trim();
const hash = (text) => createHash('sha256').update(normalize(text)).digest('hex');
const report = {
  database,
  scope: 'Copia local; presencia de objetos no demuestra equivalencia de definiciones, datos, permisos o policies.',
  remoteOnly: snapshot.migrations.filter((migration) => !files.some((name) => name.startsWith(`${migration.version}_`))).map(({ version, name }) => ({ version, name })),
  migrations: [],
};

for (const filename of files) {
  const version = filename.slice(0, 14);
  const content = readFileSync(resolve(migrationDirectory, filename), 'utf8');
  const remote = history.get(version);
  const exported = Array.isArray(remote?.statements) ? `${remote.statements.join(';\n\n')};` : null;

  const sql = content.replace(/^\s*--[^\n]*/gm, '');
  const checks = [];
  for (const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z_0-9]*)/gi)) {
    checks.push({ kind: 'table', name: match[1], present: snapshot.tables.includes(match[1]) });
  }
  for (const match of sql.matchAll(/ALTER\s+TABLE\s+(?:public\.)?([a-z_][a-z_0-9]*)([^;]*);/gi)) {
    for (const column of match[2].matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z_0-9]*)/gi)) {
      const name = `${match[1]}.${column[1]}`;
      checks.push({ kind: 'column', name, present: snapshot.columns.includes(name) });
    }
  }
  for (const match of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z_][a-z_0-9]*)/gi)) {
    checks.push({ kind: 'function_name', name: match[1], present: snapshot.functions.includes(match[1]) });
  }
  for (const match of sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z_0-9]*)/gi)) {
    checks.push({ kind: 'index_name', name: match[1], present: snapshot.indexes.includes(match[1]) });
  }
  report.migrations.push({
    version, filename,
    status: remote ? 'RECORDED' : version === '20261021000000' ? 'TARGET_NOT_RECORDED' : 'HISTORY_NOT_RECORDED',
    statementCount: remote?.statements?.length ?? null,
    exportedTextMatches: exported === null ? null : normalize(exported) === normalize(content),
    localSha256: hash(content), exportedSha256: exported === null ? null : hash(exported),
    missingObjects: checks.filter((check) => !check.present), presentObjectCount: checks.filter((check) => check.present).length,
    equivalenceProven: false,
  });
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
