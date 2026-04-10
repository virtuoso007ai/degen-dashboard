@echo off
REM AIXBT long ~10 USDC notional (default size=40 coins; override: %~nx0 35)
cd /d "%~dp0"
set SIZE=%~1
if "%SIZE%"=="" set SIZE=40
call "%~dp0node_modules\.bin\tsx.cmd" "%~dp0scripts\degen\post-perp-open-aixbt.ts" %SIZE%
