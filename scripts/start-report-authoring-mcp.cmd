@echo off
setlocal
set SCRIPT_DIR=%~dp0
for %%I in ("%SCRIPT_DIR%..") do set PLUGIN_ROOT=%%~fI
node "%PLUGIN_ROOT%\server\powerbi-report-authoring-server.js"
