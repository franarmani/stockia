param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$')]
  [string]$Version,

  [Parameter(Mandatory = $true)]
  [string]$ArtifactPath,

  [Parameter(Mandatory = $true)]
  [string]$SignaturePath,

  [string]$Notes = 'Mejoras de estabilidad y experiencia de uso.',
  [string]$Platform = 'windows-x86_64',
  [string]$ProjectRef = 'mrpenblsmooeqzegtcqp',
  [string]$Bucket = 'releases',
  [string]$OutputDirectory = (Join-Path $env:TEMP "cajago-release-$Version")
)

$ErrorActionPreference = 'Stop'

& (Join-Path $PSScriptRoot 'validate-release-config.ps1') -ExpectedVersion $Version

$artifact = Get-Item -LiteralPath $ArtifactPath
$signature = (Get-Content -LiteralPath $SignaturePath -Raw).Trim()

if ($artifact.Extension -notin @('.exe', '.msi')) {
  throw 'El artefacto debe ser un instalador Windows .exe o .msi generado por Tauri.'
}

if (-not $signature) {
  throw 'El archivo de firma está vacío.'
}

if (Test-Path -LiteralPath $OutputDirectory) {
  $existing = @(Get-ChildItem -LiteralPath $OutputDirectory -Force)
  if ($existing.Count -gt 0) {
    throw "El directorio de salida ya contiene archivos: $OutputDirectory"
  }
} else {
  New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
}

$artifactName = "CajaGo-$Version-$Platform$($artifact.Extension)"
$releaseArtifact = Join-Path $OutputDirectory $artifactName
Copy-Item -LiteralPath $artifact.FullName -Destination $releaseArtifact -Force
$releaseSignature = "$releaseArtifact.sig"
Copy-Item -LiteralPath $SignaturePath -Destination $releaseSignature -Force

$publicBaseUrl = "https://$ProjectRef.supabase.co/storage/v1/object/public/$Bucket"
$manifest = [ordered]@{
  version = $Version
  notes = $Notes
  pub_date = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  platforms = [ordered]@{
    $Platform = [ordered]@{
      signature = $signature
      url = "$publicBaseUrl/$Version/$artifactName"
    }
  }
}

$manifestPath = Join-Path $OutputDirectory 'latest.json'
$manifestJson = $manifest | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($manifestPath, $manifestJson, [Text.UTF8Encoding]::new($false))

$hashes = @(
  Get-FileHash -LiteralPath $releaseArtifact -Algorithm SHA256
  Get-FileHash -LiteralPath $releaseSignature -Algorithm SHA256
  Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256
)
$hashPath = Join-Path $OutputDirectory 'SHA256SUMS.txt'
$hashLines = $hashes | ForEach-Object { "$($_.Hash.ToLowerInvariant())  $([IO.Path]::GetFileName($_.Path))" }
[IO.File]::WriteAllLines($hashPath, $hashLines, [Text.UTF8Encoding]::new($false))

Write-Output "Release preparado en: $OutputDirectory"
Write-Output "Subir primero: $Version/$artifactName"
Write-Output 'Subir al final: latest.json'
Write-Output 'La clave privada de firma no fue leída ni copiada.'
