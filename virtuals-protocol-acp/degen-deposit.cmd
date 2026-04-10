@echo off
REM Usage: degen-deposit.cmd 45   (USDC amount as string for perp_deposit)
cd /d "%~dp0"
if "%~1"=="" (
  echo Usage: %~nx0 ^<amount_usdc^>
  echo Example: %~nx0 45
  exit /b 1
)
call "%~dp0node_modules\.bin\tsx.cmd" "%~dp0scripts\degen\post-perp-deposit.ts" %*
