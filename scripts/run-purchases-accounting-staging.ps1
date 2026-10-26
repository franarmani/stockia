param(
  [Parameter(Mandatory = $true)][string]$StagingDatabaseUrl,
  [Parameter(Mandatory = $true)][string]$ExpectedHost,
  [Parameter(Mandatory = $true)][ValidateSet('STAGING_ONLY')][string]$Confirmation
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$databaseUri = [Uri]$StagingDatabaseUrl

if ($databaseUri.Host -ne $ExpectedHost) {
  throw "Host inesperado: $($databaseUri.Host). Se esperaba $ExpectedHost."
}
if ($ExpectedHost -match '(prod|production)' -or $StagingDatabaseUrl -match '(prod|production)') {
  throw 'La URL parece corresponder a produccion. Ejecucion bloqueada.'
}
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw 'psql no esta instalado o no esta disponible en PATH.'
}

$migration = Join-Path $workspaceRoot 'supabase/migrations/20261021000000_purchases_accounting.sql'
$seed = Join-Path $workspaceRoot 'supabase/tests/fixtures/purchases_accounting_seed.sql'
$tests = Join-Path $workspaceRoot 'supabase/tests/purchases_accounting.test.sql'

Write-Host "Aplicando migracion en STAGING: $ExpectedHost"
& psql $StagingDatabaseUrl -v ON_ERROR_STOP=1 -X --single-transaction -f $migration
if ($LASTEXITCODE -ne 0) { throw 'Fallo la migracion de staging.' }

Write-Host 'Cargando fixtures ficticios...'
& psql $StagingDatabaseUrl -v ON_ERROR_STOP=1 -X --single-transaction -f $seed
if ($LASTEXITCODE -ne 0) { throw 'Fallo el seed de staging.' }

Write-Host 'Ejecutando suite transaccional...'
& psql $StagingDatabaseUrl -v ON_ERROR_STOP=1 -X -f $tests
if ($LASTEXITCODE -ne 0) { throw 'Fallaron los tests de integracion.' }

Write-Host 'Validacion de staging completada. La suite hizo ROLLBACK de sus operaciones.'
