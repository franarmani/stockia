@echo off
echo ====================================
echo    Scraper de Eventos Deportivos
echo ====================================
echo.

cd /d "c:\Users\franc\Desktop\proyectos\PELIS4K-ONLINE\src\python"

echo Verificando Python...
python --version
if %errorlevel% neq 0 (
    echo ERROR: Python no esta instalado o no esta en el PATH
    echo Por favor instala Python desde https://python.org
    pause
    exit /b 1
)

echo.
echo Verificando pip...
pip --version
if %errorlevel% neq 0 (
    echo ERROR: pip no esta disponible
    pause
    exit /b 1
)

echo.
echo Instalando dependencias...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: No se pudieron instalar las dependencias
    pause
    exit /b 1
)

echo.
echo ====================================
echo     Ejecutando scraper...
echo ====================================
echo.

python sports_scraper.py

echo.
echo ====================================
echo         Proceso completado
echo ====================================
echo.
echo El archivo sports_events.json ha sido creado en la carpeta public/
echo Presiona cualquier tecla para continuar...
pause >nul
