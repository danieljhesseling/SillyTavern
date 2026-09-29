@echo off
rem ==========================================================================
rem  Jugar.bat: el juego, con un doble clic (J0.9 de ROADMAP_SIN_CONEXION).
rem
rem  1. Si el servidor ya esta encendido, solo abre el navegador.
rem  2. Si no, lo enciende con Start.bat, que instala lo que falte y abre el
rem     navegador el solo cuando el servidor esta listo.
rem
rem  El navegador entra directo en la portada del juego: se abre sola al
rem  entrar, salvo que la hayas apagado en Opciones, "Abrir el juego al entrar".
rem
rem  (Los comentarios van sin tildes a proposito: esta ventana no las lee bien
rem  hasta la linea de chcp. Lo que se ve en pantalla si las lleva.)
rem
rem  Mientras juegas, esta ventana negra es el servidor: si la cierras, el
rem  juego se para. Para abrirlo a tus amigos, mira wiki/SERVIDOR_PRIVADO.md.
rem ==========================================================================

rem Para que las tildes se vean bien en esta ventana.
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Jugar

rem Sin Node.js no hay servidor: se dice claro y se para aqui.
where node >nul 2>nul
if errorlevel 1 (
    echo No encuentro Node.js, y el juego lo necesita para arrancar.
    echo Instálalo desde https://nodejs.org/ ^(la versión LTS^) y vuelve a abrir Jugar.bat.
    pause
    exit /b 1
)

rem El puerto sale de config.yaml, de la linea "port: 8000". Si no esta, 8000.
set "PUERTO=8000"
if exist config.yaml (
    for /f "tokens=2 delims=: " %%p in ('findstr /b /c:"port:" config.yaml') do set "PUERTO=%%p"
)
rem 127.0.0.1 y no localhost: es la direccion que abre el servidor, y el navegador
rem guarda las opciones del juego por direccion.
set "DIRECCION=http://127.0.0.1:%PUERTO%/"

rem Si ya esta encendido, alguien contesta en ese puerto.
powershell -NoProfile -Command "$c = New-Object Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', %PUERTO%); exit 0 } catch { exit 1 } finally { $c.Close() }" >nul 2>nul
if not errorlevel 1 (
    echo El juego ya está encendido. Abro el navegador en %DIRECCION%
    start "" "%DIRECCION%"
    timeout /t 3 >nul
    exit /b 0
)

echo Enciendo el juego. La primera vez tarda un poco: se instala lo que falta.
echo El navegador se abrirá solo cuando esté listo.
echo No cierres esta ventana mientras juegas: es el servidor.
echo.
rem --browserLaunchEnabled abre el navegador aunque config.yaml diga que no.
call "%~dp0Start.bat" --browserLaunchEnabled
