@echo off
title Antigravity Telegram Bridge
cd /d "%~dp0"
echo ========================================================
echo        Starting Antigravity Telegram Bridge...
echo ========================================================
echo.
python telegram_bridge.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Bridge stopped with an error. Check the messages above.
)
pause
