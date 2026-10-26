param(
  [switch]$SkipStart
)

$ErrorActionPreference = 'Stop'
$projectId = 'nexoventas'
$databaseContainer = "supabase_db_$projectId"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  $userDockerBin = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin'
  if (Test-Path (Join-Path $userDockerBin 'docker.exe')) {
    $env:Path = "$userDockerBin;$env:Path"
  }
}

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Falta el comando requerido: $Name"
  }
}

function Assert-LocalDatabaseUrl([string]$DatabaseUrl, [string]$Source) {
  if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    return
  }

  try {
    $uri = [Uri]$DatabaseUrl
  } catch {
    throw "URL de base invalida en ${Source}: $DatabaseUrl"
  }

  if ($uri.Host -notin @('127.0.0.1', 'localhost', '::1')) {
    throw "ABORTADO: ${Source} apunta a una base no local ($($uri.Host))."
  }
}

function Invoke-LocalSql([string]$Path) {
  $resolvedPath = Resolve-Path $Path
  Write-Host "Ejecutando $resolvedPath"
  Get-Content -Raw $resolvedPath |
    docker exec -i $databaseContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo SQL en $resolvedPath"
  }
}

Assert-Command docker
Assert-Command node

foreach ($variableName in @('SUPABASE_DB_URL', 'DATABASE_URL', 'POSTGRES_URL')) {
  Assert-LocalDatabaseUrl ([Environment]::GetEnvironmentVariable($variableName)) "`$$variableName"
}

docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw 'Docker Desktop no esta iniciado.'
}

Write-Host "Node: $(node --version)"
Write-Host "Supabase CLI: $(npx supabase --version)"
Write-Host "Docker: $(docker --version)"
Write-Host "Compose: $(docker compose version)"

if (-not $SkipStart) {
  npx supabase start
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar Supabase local.' }
}

$statusOutput = npx supabase status --output json
if ($LASTEXITCODE -ne 0) { throw 'El stack local no esta saludable.' }
$status = ($statusOutput -join "`n") | ConvertFrom-Json
Assert-LocalDatabaseUrl ([string]$status.DB_URL) 'supabase status'
if ($status.linked_project) {
  throw "ABORTADO: el directorio esta enlazado al proyecto remoto $($status.linked_project)."
}
Write-Host "Supabase local verificado: $(([Uri]$status.DB_URL).Host):$(([Uri]$status.DB_URL).Port)"

npx supabase db reset --local --no-seed
if ($LASTEXITCODE -ne 0) { throw 'Fallo la reconstruccion completa desde migraciones.' }

docker exec $databaseContainer psql -U postgres -d postgres -Atc 'SHOW server_version;'
if ($LASTEXITCODE -ne 0) { throw 'No se pudo obtener la version de PostgreSQL.' }

Invoke-LocalSql 'supabase/tests/fixtures/purchases_accounting_seed.sql'

$databaseTestPath = 'supabase/tests/purchases_accounting.test.sql'
$assertionCount = (Select-String -LiteralPath $databaseTestPath -Pattern '(SELECT|PERFORM)\s+pg_temp\.assert_true\(').Count
if ($assertionCount -ne 52) {
  throw "La suite SQL contiene $assertionCount aserciones; se esperaban exactamente 52."
}

Invoke-LocalSql $databaseTestPath
Write-Host "DATABASE SQL TESTS: $assertionCount/52 PASSED"
Invoke-LocalSql 'supabase/tests/purchases_accounting_rls.test.sql'
Write-Host 'RLS DIRECT TESTS: PASS'

npx supabase db lint --local --level warning --fail-on error
if ($LASTEXITCODE -ne 0) { throw 'Database lint encontro errores.' }

Write-Host 'OK: migraciones, fixtures, suite SQL y lint local completados.'
