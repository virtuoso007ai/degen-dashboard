@echo off
REM VIRTUAL long ~15 USDC notional (default 21 coins @ ~$0.71/VIRTUAL). Override: %~nx0 18
cd /d "%~dp0"
set SIZE=%~1
if "%SIZE%"=="" set SIZE=21
call "%~dp0node_modules\.bin\tsx.cmd" "%~dp0scripts\degen\post-perp-open-virtual.ts" %SIZE%
