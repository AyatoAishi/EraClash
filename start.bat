@echo off
title Era Clash - localhost
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  echo Node not found, using Python on http://localhost:8080
  start "" http://localhost:8080
  python -m http.server 8080
  goto :eof
)
echo Neither Node.js nor Python found. Install Node.js from https://nodejs.org then run this again.
pause
