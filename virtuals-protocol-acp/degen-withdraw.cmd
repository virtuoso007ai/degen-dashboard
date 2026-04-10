@echo off
REM perp_withdraw — HL subaccount USDC to Base recipient (same shape as successful job).
REM Full balance:  degen-withdraw.cmd
REM Custom address: degen-withdraw.cmd 0xYourRecipient
REM Fixed amount:   degen-withdraw.cmd 0xYourRecipient 10
REM Amount only (active agent): degen-withdraw.cmd 10
cd /d "%~dp0"
call "%~dp0node_modules\.bin\tsx.cmd" "%~dp0scripts\degen\post-perp-withdraw.ts" %*
