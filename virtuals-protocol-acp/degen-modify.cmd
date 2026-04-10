@echo off
REM perp_modify — TP/SL on HL position (pair stopLoss takeProfit)
REM Example: degen-modify.cmd VIRTUAL 0.62 0.78
cd /d "%~dp0"
if "%~3"=="" (
  echo Usage: %~nx0 ^<pair^> ^<stopLoss^> ^<takeProfit^>
  exit /b 1
)
call "%~dp0node_modules\.bin\tsx.cmd" "%~dp0scripts\degen\post-perp-modify.ts" %*
