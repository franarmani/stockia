# Publica una versión nueva de CajaGo para que los programas instalados se actualicen solos.
#
#   .\release_app.ps1 -Version 1.13.1 -Notes "- Novedad 1`n- Novedad 2"
#   .\release_app.ps1 -Version 1.13.1 -SkipPublish   # solo compila el instalador firmado
#
# Para que la actualización sea obligatoria, incluir en las notas: "minimum_version: 1.13.1".
# La clave de firma vive fuera del repo, en %USERPROFILE%\.tauri (hacer copia de seguridad: sin ella
# no se pueden publicar actualizaciones para los programas ya instalados).

param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$Version,

  [string]$Notes = 'Mejoras de estabilidad y experiencia de uso.',

  [switch]$SkipPublish,

  # Publica un instalador ya compilado con -SkipPublish, sin volver a compilar
  [switch]$PublishOnly
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$keyDir = Join-Path $env:USERPROFILE '.tauri'
$utf8 = [Text.UTF8Encoding]::new($false)

# 1. Misma versión en todos lados
$packagePath = Join-Path $root 'package.json'
[IO.File]::WriteAllText($packagePath, ((Get-Content $packagePath -Raw) -replace '(?m)^(\s*"version":\s*")[^"]+(")', "`${1}$Version`${2}"), $utf8)
$tauriPath = Join-Path $root 'src-tauri\tauri.conf.json'
[IO.File]::WriteAllText($tauriPath, ((Get-Content $tauriPath -Raw) -replace '(?m)^(\s*"version":\s*")[^"]+(")', "`${1}$Version`${2}"), $utf8)
$cargoPath = Join-Path $root 'src-tauri\Cargo.toml'
[IO.File]::WriteAllText($cargoPath, ((Get-Content $cargoPath -Raw) -replace '(?m)^version\s*=\s*"[^"]+"', "version = `"$Version`""), $utf8)
$versionJson = [ordered]@{ version = $Version; buildDate = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); critical = $true } | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $root 'public\version.json'), $versionJson, $utf8)

# 2. Instalador firmado
if (-not $PublishOnly) {
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content (Join-Path $keyDir 'cajago-updater.key') -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content (Join-Path $keyDir 'cajago-updater.password.txt') -Raw).Trim()
$env:PATH = "C:\Users\franc\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin;C:\Users\franc\.cargo\bin;$env:PATH"
Push-Location $root
try {
  npx tauri build
  if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del instalador.' }
} finally {
  Pop-Location
  Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY, Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
}
}

$installer = Get-ChildItem (Join-Path $root 'src-tauri\target\release\bundle\nsis') -Filter "CajaGo_$($Version)_*-setup.exe" | Select-Object -First 1
if (-not $installer) { throw "No se encontró el instalador de la versión $Version." }
Write-Output "Instalador: $($installer.FullName)"
if ($SkipPublish) { return }

# 3. Manifiesto y publicación (latest.json se sube al final)
$releaseDir = Join-Path $env:TEMP "cajago-release-$Version-$(Get-Date -Format yyyyMMddHHmmss)"
& (Join-Path $root 'scripts\prepare-supabase-release.ps1') -Version $Version -ArtifactPath $installer.FullName -SignaturePath "$($installer.FullName).sig" -Notes $Notes -OutputDirectory $releaseDir

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_ROLE_KEY)) {
  $keys = npx supabase projects api-keys --project-ref mrpenblsmooeqzegtcqp -o json | ConvertFrom-Json
  $env:SUPABASE_SERVICE_ROLE_KEY = ($keys | Where-Object { $_.name -eq 'service_role' }).api_key
}
try {
  & (Join-Path $root 'scripts\publish-supabase-release.ps1') -ReleaseDirectory $releaseDir
} finally {
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
}
