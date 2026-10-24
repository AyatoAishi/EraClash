@echo off
title Era Clash - one-time git setup
cd /d "%~dp0"
where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed. Install it from https://git-scm.com/download/win and run this again.
  pause & exit /b 1
)
if exist ".git" (
  echo This folder is already linked to GitHub.
  git status -sb
  pause & exit /b 0
)
echo Linking this folder to github.com/AyatoAishi/EraClash ...
git init -b main
git remote add origin https://github.com/AyatoAishi/EraClash.git
git fetch origin main
if errorlevel 1 (
  echo Could not reach GitHub. Check your internet / GitHub login and run this again.
  pause & exit /b 1
)
rem keep every file as it is on disk, just attach the history
git reset origin/main
git branch --set-upstream-to=origin/main main
rem bring back files that only exist on GitHub (e.g. .github)
for /f "delims=" %%f in ('git ls-files -d') do git checkout -- "%%f"
echo.
echo Files that differ from GitHub (your own unpushed edits), if any:
git status -s
echo.
echo Done. start.bat now auto-updates from GitHub, push.bat sends your changes.
pause
