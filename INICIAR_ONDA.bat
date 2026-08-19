@echo off
title ONDA Studio OS
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado. Instale o Node.js 18 ou superior.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:3000"
echo Iniciando ONDA Studio OS...
echo Para encerrar, feche esta janela ou pressione Ctrl+C.
node server.mjs
if errorlevel 1 pause
