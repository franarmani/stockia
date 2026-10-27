# Publica la web en el proyecto de Vercel "cajago" sin pasar por GitHub.
#
# Vercel (plan gratuito) bloquea los deploys cuyo commit tiene coautores que no son de la cuenta,
# así que se compila acá y se sube el resultado ya armado desde una carpeta sin historial de git.
# Las reglas son las mismas de vercel.json, escritas en el formato Build Output API v3.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

Push-Location $root
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación de la web.' }
} finally {
  Pop-Location
}

$stage = Join-Path $env:TEMP 'cajago-web-deploy'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force -Confirm:$false }
$output = Join-Path $stage '.vercel\output'
New-Item -ItemType Directory -Force (Join-Path $output 'static') | Out-Null
Copy-Item (Join-Path $root 'dist\*') (Join-Path $output 'static') -Recurse
Copy-Item (Join-Path $root '.vercel\project.json') (Join-Path $stage '.vercel\project.json')

$noCache = @{ 'Cache-Control' = 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0'; Pragma = 'no-cache'; Expires = '0' }
$config = [ordered]@{
  version = 3
  routes = @(
    [ordered]@{ src = '^/assets/(.*)$'; headers = @{ 'Cache-Control' = 'public, max-age=31536000, immutable' }; continue = $true },
    [ordered]@{ src = '^/(index\.html|sw\.js|manifest\.webmanifest|manifest\.json|version\.json)$'; headers = $noCache; continue = $true },
    [ordered]@{ src = '^/supabase-api/(.*)$'; dest = 'https://mrpenblsmooeqzegtcqp.supabase.co/$1' },
    [ordered]@{ handle = 'filesystem' },
    [ordered]@{ src = '^/(?!assets/|supabase-api/).*$'; dest = '/index.html'; headers = $noCache }
  )
}
[IO.File]::WriteAllText((Join-Path $output 'config.json'), ($config | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))

Push-Location $stage
# Vercel escribe avisos en stderr: con 'Stop', PowerShell 5.1 los toma como error y corta.
$ErrorActionPreference = 'Continue'
try {
  $log = (npx vercel deploy --prebuilt --prod --yes 2>&1 | Out-String)
  $match = [regex]::Match($log, 'https://cajago-[a-z0-9]+-[a-z0-9-]+\.vercel\.app')
  if ($LASTEXITCODE -ne 0 -or -not $match.Success) { Write-Output $log; throw 'Falló la publicación en Vercel.' }
  $deployUrl = $match.Value
  # Los dominios se asignaron con alias: hay que moverlos a cada publicación nueva.
  foreach ($domain in @('cajago.net', 'www.cajago.net', 'cajago.vercel.app')) {
    npx vercel alias set $deployUrl $domain
    if ($LASTEXITCODE -ne 0) { throw "No se pudo apuntar $domain a la publicación nueva." }
  }
  Write-Output "Web publicada: https://cajago.net ($deployUrl)"
} finally {
  Pop-Location
}
