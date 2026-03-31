@echo off
chcp 65001 >nul
title Charty Lite 초기 설정
echo ═══════════════════════════════════════
echo   Charty Lite 초기 설정 (Windows)
echo ═══════════════════════════════════════
echo.

:: 1. Node.js
echo [1/5] Node.js 확인...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo   X Node.js가 설치되어 있지 않습니다.
  echo   https://nodejs.org 에서 LTS 버전을 설치해주세요.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo   V Node.js %%v

:: 2. Python
echo [2/5] Python 확인...
where python >nul 2>nul
if %errorlevel% neq 0 (
  echo   X Python이 설치되어 있지 않습니다.
  echo   https://python.org 에서 3.10+ 버전을 설치해주세요.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do echo   V %%v

:: 3. Python 가상환경 + 패키지
echo [3/5] AI 서버 설정...
cd /d "%~dp0ai"
if not exist "venv" (
  echo   가상환경 생성 중...
  python -m venv venv
)
call venv\Scripts\activate.bat
echo   패키지 설치 중...
pip install -q -r requirements.txt
echo   V AI 서버 설정 완료

:: 4. 백엔드
echo [4/5] 백엔드 설정...
cd /d "%~dp0backend"
call npm install --silent 2>nul
echo   V 백엔드 설정 완료

:: 5. 프론트엔드
echo [5/5] 프론트엔드 설정...
cd /d "%~dp0frontend"
call npm install --silent 2>nul
echo   V 프론트엔드 설정 완료

:: 6. API 키
echo.
echo ═══════════════════════════════════════
if not exist "%~dp0.env" (
  copy "%~dp0.env.example" "%~dp0.env" >nul 2>nul
  echo   ! .env 파일이 생성되었습니다.
)
echo   Claude API 키를 설정해주세요:
echo   %~dp0.env 파일의 ANTHROPIC_API_KEY 수정
echo.
echo   설정 완료! start.bat를 더블클릭하면 실행됩니다.
echo ═══════════════════════════════════════
pause
