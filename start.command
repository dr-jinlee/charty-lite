#!/bin/bash
# Charty Lite 실행 (Mac) — 더블클릭하면 시작
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "═══════════════════════════════════════"
echo "  Charty Lite 시작 중..."
echo "═══════════════════════════════════════"

# AI 서버
echo "[1/3] AI 서버..."
cd "$DIR/ai"
source "$DIR/ai/venv/bin/activate"
AI_PORT=8081 python server.py &
AI_PID=$!

# 백엔드
echo "[2/3] 백엔드..."
cd "$DIR/backend"
node server.js &
BACKEND_PID=$!

# 프론트엔드
echo "[3/3] 프론트엔드..."
cd "$DIR/frontend"
npx next dev --port 3001 &
FRONTEND_PID=$!

sleep 4
echo ""
echo "═══════════════════════════════════════"
echo "  Charty Lite 실행 중!"
echo "  http://localhost:3001"
echo "  종료: 이 터미널 닫기"
echo "═══════════════════════════════════════"

open -a "Google Chrome" "http://localhost:3001"
trap "kill $AI_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM EXIT
wait
