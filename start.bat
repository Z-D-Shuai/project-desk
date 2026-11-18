@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 is required. No software was installed.
  pause
  exit /b 1
)
call node -e "if(Number(process.versions.node.split('.')[0])!==24)process.exit(1);require('node:sqlite')" >nul 2>&1
if errorlevel 1 (
  echo Node.js 24 with built-in SQLite is required.
  pause
  exit /b 1
)
call node scripts\launch.mjs
if errorlevel 1 (
  echo Startup failed. See the messages above. File logging may be unavailable.
  pause
  exit /b 1
)
