#!/bin/bash
# Charty Lite 초기 설정 (Mac) — 처음 1회만 실행
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "═══════════════════════════════════════"
echo "  Charty Lite 초기 설정"
echo "═══════════════════════════════════════"

# 1. Node.js 확인
echo ""
echo "[1/5] Node.js 확인..."
if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js가 설치되어 있지 않습니다."
  echo "  https://nodejs.org 에서 LTS 버전을 설치해주세요."
  echo "  설치 후 이 스크립트를 다시 실행하세요."
  read -p "  (Enter를 누르면 종료)"
  exit 1
fi
echo "  ✓ Node.js $(node -v)"

# 2. Python 확인
echo "[2/5] Python 확인..."
PYTHON_CMD=""
if command -v python3 &>/dev/null; then PYTHON_CMD="python3"
elif command -v python &>/dev/null; then PYTHON_CMD="python"
fi
if [ -z "$PYTHON_CMD" ]; then
  echo "  ✗ Python이 설치되어 있지 않습니다."
  echo "  https://python.org 에서 3.10+ 버전을 설치해주세요."
  read -p "  (Enter를 누르면 종료)"
  exit 1
fi
echo "  ✓ Python $($PYTHON_CMD --version)"

# 3. Python 가상환경 + 패키지
echo "[3/5] AI 서버 설정..."
cd "$DIR/ai"
if [ ! -d "venv" ]; then
  echo "  가상환경 생성 중..."
  $PYTHON_CMD -m venv venv
fi
source venv/bin/activate
echo "  패키지 설치 중... (시간이 걸릴 수 있습니다)"
pip install -q -r requirements.txt
echo "  ✓ AI 서버 설정 완료"

# 4. 백엔드 npm
echo "[4/5] 백엔드 설정..."
cd "$DIR/backend"
npm install --silent 2>/dev/null
echo "  ✓ 백엔드 설정 완료"

# 5. 프론트엔드 npm
echo "[5/5] 프론트엔드 설정..."
cd "$DIR/frontend"
npm install --silent 2>/dev/null
echo "  ✓ 프론트엔드 설정 완료"

# 6. API 키 설정
echo ""
echo "═══════════════════════════════════════"
if [ ! -f "$DIR/.env" ] || grep -q "sk-ant-xxxxx" "$DIR/.env" 2>/dev/null; then
  echo "  ⚠ Claude API 키 설정이 필요합니다."
  echo "  https://console.anthropic.com/settings/keys 에서 발급 후"
  echo "  $DIR/.env 파일의 ANTHROPIC_API_KEY를 수정해주세요."
  echo ""
  if [ ! -f "$DIR/.env" ]; then
    cp "$DIR/.env.example" "$DIR/.env" 2>/dev/null
    echo "  .env 파일이 생성되었습니다."
  fi
else
  echo "  ✓ API 키 설정 확인됨"
fi

echo ""
echo "  설정 완료! start.command를 더블클릭하면 실행됩니다."
echo "═══════════════════════════════════════"
read -p "  (Enter를 누르면 종료)"
