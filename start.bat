@echo off
title Era Clash - localhost
cd /d "%~dp0"
rem auto-update from GitHub before starting (only if this folder is a git clone; never overwrites your unpushed work)
if exist ".git" (
  where git >nul 2>nul && (
    echo Checking GitHub for updates...
    git pull --ff-only origin main
    if errorlevel 1 echo [!] Could not auto-update: you have local changes. Run push.bat to send them first.
  )
)
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  echo Node not found, using Python on http://localhost:8080  ^(no live auto-update^)
  start "" http://localhost:8080
  python -m http.server 8080
  goto :eof
)
echo Neither Node.js nor Python found. Install Node.js from https://nodejs.org then run this again.
pause
