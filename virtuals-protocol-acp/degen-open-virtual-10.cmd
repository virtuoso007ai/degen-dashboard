@echo off
REM VIRTUAL long ~10 USDC notional (size=14 coins @ ~$0.71/VIRTUAL). Override: %~nx0 15
cd /d "%~dp0"
set SIZE=%~1
if "%SIZE%"=="" set SIZE=14
call "%~dp0node_modules\.bin\tsx.cmd" "%~dp0scripts\degen\post-perp-open-virtual.ts" %SIZE%
