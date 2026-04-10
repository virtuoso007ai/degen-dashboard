@echo off
REM join_leaderboard — needs RSA publicKey in degen_join_requirements.json or JOIN_LEADERBOARD_PUBLIC_KEY
cd /d "%~dp0"
call "%~dp0node_modules\.bin\tsx.cmd" "%~dp0scripts\degen\post-join-leaderboard.ts" %*
