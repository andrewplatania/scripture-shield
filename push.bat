@echo off
cd /d "%~dp0"
set MSG=update
if not exist .git git init -b main
git remote get-url origin >nul 2>&1 || gh repo create scripture-shield --public --source=. --remote=origin --description "Offline desktop app that shows Bible verses to quote out loud against temptation. KJV and BSB, one passage at a time, random order every launch."
git rev-parse HEAD >nul 2>&1 || set MSG=Initial commit
git add -A
git commit -m "%MSG%"
git push -u origin main
