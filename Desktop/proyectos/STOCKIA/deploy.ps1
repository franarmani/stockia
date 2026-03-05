# ========================================
# STOCKIA - Deploy seguro a produccion
# ========================================
# Uso: .\deploy.ps1 "mensaje del commit"
# Ejemplo: .\deploy.ps1 "agregar boton de exportar"
# ========================================

param(
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  STOCKIA - Deploy a Produccion" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que estamos en el directorio correcto
if (-not (Test-Path "package.json")) {
    Write-Host "[ERROR] No se encontro package.json. Ejecuta desde la carpeta STOCKIA." -ForegroundColor Red
    exit 1
}

# 2. Verificar que hay cambios
$status = git status --porcelain
if (-not $status) {
    Write-Host "[!] No hay cambios para subir." -ForegroundColor Yellow
    $continuar = Read-Host "Queres forzar un redeploy igual? (s/n)"
    if ($continuar -ne "s") { exit 0 }
    
    Write-Host ""
    Write-Host "[3/4] Deploying a Vercel con cache limpio..." -ForegroundColor Cyan
    npx vercel --prod --force 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] Deploy exitoso!" -ForegroundColor Green
        Write-Host "     https://stockia-two.vercel.app" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Fallo el deploy." -ForegroundColor Red
    }
    exit $LASTEXITCODE
}

# Mostrar archivos modificados
Write-Host "[1/4] Archivos modificados:" -ForegroundColor Yellow
git status --short
Write-Host ""

# 3. Build local para verificar que no hay errores
Write-Host "[2/4] Verificando build local..." -ForegroundColor Cyan
$buildOutput = npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  [ERROR] EL BUILD FALLO!" -ForegroundColor Red
    Write-Host "  No se va a subir nada." -ForegroundColor Red
    Write-Host "  Corregi los errores y volve a intentar." -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host ($buildOutput | Select-String "error" | Out-String)
    exit 1
}
Write-Host "[OK] Build exitoso, sin errores." -ForegroundColor Green
Write-Host ""

# 4. Pedir mensaje de commit si no se paso como parametro
if (-not $Message) {
    $Message = Read-Host "Mensaje del commit"
    if (-not $Message) {
        $Message = "update: cambios varios"
    }
}

# 5. Git add + commit + push
Write-Host "[3/4] Subiendo a GitHub..." -ForegroundColor Cyan
git add -A
git commit -m $Message 2>&1 | Out-Null
git push 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Fallo el push a GitHub." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Pusheado a GitHub." -ForegroundColor Green
Write-Host ""

# 6. Deploy a Vercel con --force (cache limpio)
Write-Host "[4/4] Deploying a Vercel con cache limpio..." -ForegroundColor Cyan
npx vercel --prod --force 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Fallo el deploy a Vercel." -ForegroundColor Red
    Write-Host "Pero los cambios ya estan en GitHub." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  [OK] DEPLOY EXITOSO!" -ForegroundColor Green
Write-Host "  https://stockia-two.vercel.app" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
