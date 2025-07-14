# Script para descargar e instalar OpenJDK 17
# Ejecutar como administrador en PowerShell

$jdkUrl = "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10%2B7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.10_7.msi"
$installerPath = "$env:TEMP\OpenJDK17-installer.msi"

Write-Host "🔽 Descargando OpenJDK 17..." -ForegroundColor Green
Invoke-WebRequest -Uri $jdkUrl -OutFile $installerPath

Write-Host "📦 Instalando OpenJDK 17..." -ForegroundColor Green
Start-Process msiexec.exe -Wait -ArgumentList "/i $installerPath /quiet /norestart"

Write-Host "🗑️ Limpiando archivos temporales..." -ForegroundColor Green
Remove-Item $installerPath

Write-Host "✅ OpenJDK 17 instalado correctamente!" -ForegroundColor Green
Write-Host "🔄 Reinicia tu terminal y ejecuta: java -version" -ForegroundColor Yellow
