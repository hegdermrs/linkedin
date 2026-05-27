@echo off
cd /d "%~dp0"
title LinkedIn Outreach Agent
echo Starting LinkedIn Outreach Agent...
call npx pnpm@9.15.0 start
if errorlevel 1 pause
