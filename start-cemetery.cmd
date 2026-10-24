@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or later, then reopen this file.
  goto failed
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number); process.exit(major>22 || major===22 && minor>=12 ? 0 : 1)"
if errorlevel 1 (
  echo Node.js 22.12 or later is required. Node.js 24 is recommended.
  goto failed
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with npm and reopen this file.
  goto failed
)
where git >nul 2>nul
if errorlevel 1 echo Git was not found. Install Git to scan local repositories.
if not exist "node_modules\tsx" (
  call npm.cmd ci --include=dev
  if errorlevel 1 goto failed
)
if not exist "dist\index.html" (
  call npm.cmd run build
  if errorlevel 1 goto failed
)
echo.
echo Code Cemetery: http://127.0.0.1:4317
echo Keep this window open. Press Ctrl+C to stop.
echo.
call npm.cmd start
if errorlevel 1 goto failed
exit /b 0
:failed
echo Could not start. See the error above.
pause
exit /b 1
