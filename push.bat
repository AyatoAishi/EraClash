@echo off
setlocal EnableDelayedExpansion
title Era Clash - push update
cd /d "%~dp0"
if not exist ".git" ( echo Run setup-git.bat first. & pause & exit /b 1 )
echo Changed files:
git status -s
echo.
echo Your commit message becomes the in-game patch note (see CONTRIBUTING.md).
echo Start the title with "feat:" for a new feature/troop, or "v0.13.0:" to set the version.
set "TITLE="
set /p "TITLE=Title: "
if "!TITLE!"=="" ( echo Cancelled. & pause & exit /b 0 )
set "F=%TEMP%\eraclash_commit_msg.txt"
> "%F%" echo(!TITLE!
>> "%F%" echo(
:items
set "ITEM="
set /p "ITEM=- change (Enter when done): "
if "!ITEM!"=="" goto commit
>> "%F%" echo(- !ITEM!
goto items
:commit
git add -A
git commit -F "%F%"
echo Pulling your teammate's latest changes first...
git pull --rebase origin main
if errorlevel 1 (
  echo.
  echo [!] Conflict with a teammate's change. Open the files git lists, fix them, then run:
  echo     git add -A  ^&^&  git rebase --continue  ^&^&  git push origin HEAD:main
  pause & exit /b 1
)
git push origin HEAD:main
if errorlevel 1 ( echo [!] Push failed. & pause & exit /b 1 )
echo.
echo Pushed. The patch-notes bot adds its entry in about a minute; start.bat / the running server pull it automatically.
pause
