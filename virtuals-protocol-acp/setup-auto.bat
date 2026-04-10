@echo off
REM Same flow: browser login, then piped answers for the rest
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-auto.ps1" %*
