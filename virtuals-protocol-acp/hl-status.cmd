@echo off
REM Hyperliquid: account value, margin, open perps (uses active agent wallet from config)
cd /d "%~dp0"
call "%~dp0node_modules\.bin\tsx.cmd" "%~dp0scripts\hl-clearinghouse.ts" %*
