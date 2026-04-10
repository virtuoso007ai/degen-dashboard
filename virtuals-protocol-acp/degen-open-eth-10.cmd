@echo off
REM ETH long — size = USDC notional. Default 12 (min order $10 on HL; 10 can be rejected).
REM Override: %~nx0 15
cd /d "%~dp0"
set SZ=%~1
if "%SZ%"=="" set SZ=12
call "%~dp0node_modules\.bin\tsx.cmd" "%~dp0scripts\degen\post-perp-open-eth.ts" %SZ%
