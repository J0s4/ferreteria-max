@echo off
title Ferreteria Max
cd /d "%~dp0"

echo.
echo  =============================================
echo     Ferreteria Max - iniciando el sitio
echo  =============================================
echo.

where node >nul 2>nul
if errorlevel 1 goto sin_node

if exist node_modules goto arrancar
echo  Instalando las piezas del proyecto. Solo pasa la primera vez y necesita internet...
echo.
call npm install
if errorlevel 1 goto error_instalar

:arrancar
echo.
echo  Abriendo el sitio en el navegador. NO cierre esta ventana mientras use el sitio.
echo.
set ABRIR_NAVEGADOR=si
call npm start
echo.
pause
exit /b 0

:sin_node
echo  Esta computadora todavia no tiene Node.js.
echo  Se va a abrir la pagina de descarga: instale la version LTS,
echo  y despues vuelva a abrir este archivo INICIAR.bat
echo.
start "" "https://nodejs.org/es/download"
pause
exit /b 1

:error_instalar
echo.
echo  No se pudo instalar. Revise su conexion a internet y vuelva a abrir INICIAR.bat
pause
exit /b 1
