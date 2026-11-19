@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Rode primeiro o instalar.bat
  pause
  exit /b 1
)
start "" http://localhost:5050
".venv\Scripts\python.exe" app.py
pause
