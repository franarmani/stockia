@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo       CajaGo Desktop - Compilador Automatico EXE
echo ========================================================

set "MINGW=C:\Users\franc\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin"
set "CARGO_BIN=C:\Users\franc\.cargo\bin"
set "PATH=%MINGW%;%CARGO_BIN%;%PATH%"

echo.
echo Compilando aplicacion completa con Tauri...
call npx tauri build --no-bundle
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la compilacion de Tauri.
    exit /b %errorlevel%
)

echo.
echo Actualizando CajaGo.exe en la raiz del proyecto...
copy /Y "src-tauri\target\release\app.exe" "CajaGo.exe" >nul
if %errorlevel% neq 0 (
    echo [ERROR] No se pudo reemplazar CajaGo.exe. Cerra el programa y volve a correr este script.
    exit /b 1
)
copy /Y "src-tauri\target\release\app.exe" "src-tauri\target\release\CajaGo.exe" >nul

if exist "src-tauri\target\release\WebView2Loader.dll" (
    copy /Y "src-tauri\target\release\WebView2Loader.dll" "WebView2Loader.dll" >nul
)

echo.
echo ========================================================
echo [LISTO] CajaGo.exe compilado y actualizado con exito.
echo ========================================================
