@echo off
title Servidor Scraper Ayjale
cd /d "%~dp0"
echo ==================================================
echo 🚀 Iniciando Servidor del Scraper Ayjale...
echo 📂 Directorio: %~dp0
echo ==================================================

start http://localhost:3000
node server.js
pause
