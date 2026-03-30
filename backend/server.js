const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { initDatabase } = require('./database/db');
const { handleConnection } = require('./websocket/handler');
const historyRouter = require('./routes/history');
const settingsRouter = require('./routes/settings');

const PORT = process.env.BACKEND_PORT || 8080;

// Express 앱
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// REST API 라우트
app.use('/api/history', historyRouter);
app.use('/api/settings', settingsRouter);

// 상태 확인
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// HTTP 서버
const server = http.createServer(app);

// WebSocket 서버 (같은 포트에서 /ws 경로로)
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', handleConnection);

// DB 초기화 후 서버 시작
initDatabase();

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║        Voice to Chart 서버 시작           ║
  ╠══════════════════════════════════════════╣
  ║  REST API:   http://localhost:${PORT}       ║
  ║  WebSocket:  ws://localhost:${PORT}/ws      ║
  ╚══════════════════════════════════════════╝
  `);
});
