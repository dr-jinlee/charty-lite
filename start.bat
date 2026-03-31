@echo off
chcp 65001 >nul
title Charty Lite
echo ═══════════════════════════════════════
echo   Charty Lite 시작 중...
echo ═══════════════════════════════════════

:: AI 서버
echo [1/3] AI 서버 시작...
cd /d "%~dp0ai"
call venv\Scripts\activate.bat
start /b "" python server.py

:: 백엔드
echo [2/3] 백엔드 시작...
cd /d "%~dp0backend"
start /b "" node server.js

:: 프론트엔드
echo [3/3] 프론트엔드 시작...
cd /d "%~dp0frontend"
start /b "" npx next dev --port 3001

timeout /t 5 /nobreak >nul

echo.
echo ═══════════════════════════════════════
echo   Charty Lite 실행 중!
echo   http://localhost:3001
echo ═══════════════════════════════════════
echo   종료: 이 창을 닫으세요
echo ═══════════════════════════════════════

:: 크롬 열기
start chrome "http://localhost:3001"

:: 대기
pause >nul
