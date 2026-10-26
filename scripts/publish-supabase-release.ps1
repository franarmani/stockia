param(
  [Parameter(Mandatory = $true)]
  [string]$ReleaseDirectory,

  [string]$ProjectRef = 'mrpenblsmooeqzegtcqp',
  [string]$Bucket = 'releases'
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_ROLE_KEY)) {
  throw 'Falta SUPABASE_SERVICE_ROLE_KEY en el proceso actual.'
}

$manifestPath = Join-Path $ReleaseDirectory 'latest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$platform = $manifest.platforms.PSObject.Properties | Select-Object -First 1

if (-not $platform) {
  throw 'latest.json no contiene una plataforma.'
}

$version = [string]$manifest.version
$artifactName = [IO.Path]::GetFileName(([Uri]$platform.Value.url).AbsolutePath)
$artifactPath = Join-Path $ReleaseDirectory $artifactName
$hashPath = Join-Path $ReleaseDirectory 'SHA256SUMS.txt'

if (-not (Test-Path -LiteralPath $artifactPath)) {
  throw "No se encontró el artefacto esperado: $artifactName"
}

if (-not (Test-Path -LiteralPath $hashPath)) {
  throw 'Falta SHA256SUMS.txt; la publicación no puede verificarse.'
}

$expectedPublicBase = "https://$ProjectRef.supabase.co/storage/v1/object/public/$Bucket"
$artifactUrl = [string]$platform.Value.url
if (-not $artifactUrl.StartsWith("$expectedPublicBase/$version/", [StringComparison]::OrdinalIgnoreCase)) {
  throw 'La URL del artefacto no coincide con el proyecto, bucket y versión autorizados.'
}

$expectedHashes = @{}
foreach ($line in Get-Content -LiteralPath $hashPath) {
  if ($line -match '^([0-9a-fA-F]{64})\s+(.+)$') {
    $expectedHashes[$Matches[2]] = $Matches[1].ToLowerInvariant()
  }
}

foreach ($file in @($artifactPath, $manifestPath)) {
  $name = [IO.Path]::GetFileName($file)
  $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  if (-not $expectedHashes.ContainsKey($name) -or $expectedHashes[$name] -ne $actual) {
    throw "Hash inválido o ausente para $name."
  }
}

$baseUrl = "https://$ProjectRef.supabase.co/storage/v1/object/$Bucket"
$headers = @{
  apikey = $env:SUPABASE_SERVICE_ROLE_KEY
  Authorization = "Bearer $($env:SUPABASE_SERVICE_ROLE_KEY)"
  'x-upsert' = 'true'
}

Invoke-WebRequest -Uri "$baseUrl/$version/$artifactName" -Method Post -Headers $headers -ContentType 'application/octet-stream' -InFile $artifactPath -UseBasicParsing | Out-Null
Invoke-WebRequest -Uri "$baseUrl/$version/SHA256SUMS.txt" -Method Post -Headers $headers -ContentType 'text/plain' -InFile $hashPath -UseBasicParsing | Out-Null
Invoke-WebRequest -Uri "$baseUrl/latest.json" -Method Post -Headers $headers -ContentType 'application/json' -InFile $manifestPath -UseBasicParsing | Out-Null

Write-Output "Release $version publicado. latest.json se subió al final."
Write-Output 'No se imprimió ni persistió SUPABASE_SERVICE_ROLE_KEY.'
