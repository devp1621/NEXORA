@echo off
cd /d "%~dp0"
echo Starting Nexora...
python start.py
if errorlevel 1 (
  echo.
  echo If Python was not found, install it from python.org and tick "Add Python to PATH".
  py -3 start.py
)
echo.
pause
