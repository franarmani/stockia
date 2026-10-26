param(
  [string]$ExpectedVersion,
  [switch]$RequireSigningKey
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

$package = Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json
$tauri = Get-Content -LiteralPath (Join-Path $repoRoot 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json
$publicVersion = Get-Content -LiteralPath (Join-Path $repoRoot 'public\version.json') -Raw | ConvertFrom-Json
$cargoText = Get-Content -LiteralPath (Join-Path $repoRoot 'src-tauri\Cargo.toml') -Raw

if ($cargoText -notmatch '(?m)^version\s*=\s*"([^"]+)"') {
  throw 'No se pudo leer la versión de src-tauri/Cargo.toml.'
}

$versions = [ordered]@{
  package = [string]$package.version
  tauri = [string]$tauri.version
  cargo = [string]$Matches[1]
  public = [string]$publicVersion.version
}

$uniqueVersions = @($versions.Values | Select-Object -Unique)
if ($uniqueVersions.Count -ne 1) {
  throw "Versiones desalineadas: $($versions | ConvertTo-Json -Compress)"
}

$version = $uniqueVersions[0]
if ($ExpectedVersion -and $version -ne $ExpectedVersion) {
  throw "La versión solicitada ($ExpectedVersion) no coincide con la versión del proyecto ($version)."
}

$expectedEndpoint = 'https://mrpenblsmooeqzegtcqp.supabase.co/storage/v1/object/public/releases/latest.json'
if (@($tauri.plugins.updater.endpoints) -notcontains $expectedEndpoint) {
  throw 'El updater no apunta al manifiesto oficial de CajaGo en Supabase Storage.'
}

if ([string]::IsNullOrWhiteSpace([string]$tauri.plugins.updater.pubkey)) {
  throw 'Falta la clave pública del updater.'
}

try {
  $decodedKey = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([string]$tauri.plugins.updater.pubkey))
} catch {
  throw 'La clave pública del updater no es Base64 válido.'
}

if ($decodedKey -notmatch 'minisign public key') {
  throw 'La clave pública configurada no tiene el formato Minisign esperado.'
}

if ($tauri.bundle.createUpdaterArtifacts -ne $true) {
  throw 'createUpdaterArtifacts debe permanecer habilitado.'
}

if (@($tauri.bundle.targets) -notcontains 'nsis') {
  throw 'El release de Windows debe generar el instalador NSIS.'
}

if ($tauri.bundle.windows.allowDowngrades -ne $false) {
  throw 'allowDowngrades debe estar deshabilitado.'
}

if ($RequireSigningKey) {
  if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)) {
    throw 'Falta TAURI_SIGNING_PRIVATE_KEY en el proceso actual.'
  }
  if ($null -eq $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
    throw 'Falta TAURI_SIGNING_PRIVATE_KEY_PASSWORD en el proceso actual.'
  }
}

Write-Output "RELEASE_CONFIG_PASS version=$version target=nsis updater=supabase"
