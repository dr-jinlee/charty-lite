const sessionManager = require('./sessionManager');
const http = require('http');

// AI 서버 호출 헬퍼
function callAIServer(endpoint, data) {
  const AI_PORT = process.env.AI_PORT || 8081;
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const req = http.request(
      {
        hostname: 'localhost',
        port: AI_PORT,
        path: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ error: 'AI 서버 응답 파싱 실패', raw: body });
          }
        });
      }
    );
    req.on('error', (err) => reject(err));
    req.setTimeout(120000);
    req.write(postData);
    req.end();
  });
}

// 클라이언트에 메시지 전송 헬퍼
function sendToClient(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

// 음성 청크 카운터 (로그 빈도 제한용)
let audioChunkCount = 0;

// WebSocket 메시지 핸들러
async function handleMessage(ws, rawMessage, isBinary) {
  // 바이너리 데이터(음성)인 경우
  if (isBinary) {
    audioChunkCount++;
    if (audioChunkCount % 20 === 1) {
      console.log(`[Handler] 음성 청크 수신 #${audioChunkCount}, 크기: ${rawMessage.length} bytes`);
    }

    const session = sessionManager.getSessionByWs(ws);
    if (!session) {
      if (audioChunkCount % 50 === 1) {
        console.log('[Handler] 세션 없음 - 음성 무시');
      }
      return;
    }
    if (session.status !== 'active') {
      return;
    }

    // 음성 청크를 AI 서버로 전송
    try {
      const result = await callAIServer('/stt/chunk', {
        sessionId: session.id,
        audio: rawMessage.toString('base64'),
        micMode: session.micMode,
      });

      if (result.partial) {
        sendToClient(ws, {
          type: 'transcript.partial',
          speaker: result.speaker || 'unknown',
          text: result.partial,
          lang: result.lang || 'ko',
        });
      }

      if (result.final) {
        console.log('[Handler] STT 확정:', result.final);
        const transcript = {
          speaker: result.speaker || 'unknown',
          text: result.final,
          lang: result.lang || 'ko',
          translation: result.translation || null,
        };

        sessionManager.addTranscript(session.id, transcript);

        sendToClient(ws, {
          type: 'transcript.final',
          ...transcript,
        });

        if (session.mode === 'interpret' && result.ttsAudio) {
          sendToClient(ws, {
            type: 'tts.audio',
            data: result.ttsAudio,
            lang: session.targetLang,
          });
        }
      }
    } catch (err) {
      console.error('[Handler] STT 처리 오류:', err.message);
    }
    return;
  }

  // JSON 메시지
  let message;
  try {
    message = JSON.parse(rawMessage.toString());
  } catch (err) {
    sendToClient(ws, { type: 'error', message: '메시지 파싱 실패' });
    return;
  }

  console.log('[Handler] JSON 수신:', message.type);

  switch (message.type) {
    case 'session.start': {
      const session = sessionManager.createSession(ws, {
        mode: message.mode,
        micMode: message.micMode,
        targetLang: message.targetLang,
        template: message.template,
        customerId: message.customerId,
        consultant: message.consultant,
      });

      audioChunkCount = 0;

      // AI 서버에 세션 초기화 알림
      try {
        const initResult = await callAIServer('/session/init', {
          sessionId: session.id,
          mode: session.mode,
          micMode: session.micMode,
          targetLang: session.targetLang,
        });
        console.log('[Handler] AI 세션 초기화:', initResult);
      } catch (err) {
        console.error('[Handler] AI 세션 초기화 실패:', err.message);
        // 실패해도 세션은 유지 (로컬 텍스트라도 쌓이게)
      }

      sendToClient(ws, {
        type: 'session.started',
        sessionId: session.id,
      });
      break;
    }

    case 'session.pause': {
      const session = sessionManager.getSessionByWs(ws);
      if (session) {
        sessionManager.pauseSession(session.id);
        sendToClient(ws, { type: 'session.paused' });
      }
      break;
    }

    case 'session.resume': {
      const session = sessionManager.getSessionByWs(ws);
      if (session) {
        sessionManager.resumeSession(session.id);
        sendToClient(ws, { type: 'session.resumed' });
      }
      break;
    }

    case 'session.end': {
      const session = sessionManager.getSessionByWs(ws);
      if (!session) break;

      const endedSession = sessionManager.endSession(session.id);
      const fullTranscript = sessionManager.getFullTranscript(session.id);

      console.log('[Handler] 상담 종료, 텍스트 길이:', fullTranscript.length);

      sendToClient(ws, {
        type: 'session.ended',
        duration: endedSession.durationSeconds,
      });

      sendToClient(ws, { type: 'chart.generating' });

      try {
        const chartResult = await callAIServer('/chart/generate', {
          sessionId: session.id,
          transcript: fullTranscript,
          customerId: session.customerId,
          consultationType: session.consultationType || 'auto',
          template: session.template,
        });

        sendToClient(ws, {
          type: 'chart.complete',
          chart: chartResult.chart,
          summary: chartResult.summary,
          rawTranscript: fullTranscript,
        });
      } catch (err) {
        console.error('[Handler] 차트 생성 오류:', err.message);
        sendToClient(ws, {
          type: 'chart.error',
          message: '차트 생성 실패: ' + err.message,
          rawTranscript: fullTranscript,
        });
      }

      sessionManager.removeSession(session.id);
      break;
    }

    default:
      sendToClient(ws, { type: 'error', message: `알 수 없는 메시지 타입: ${message.type}` });
  }
}

// WebSocket 연결 핸들러
function handleConnection(ws) {
  console.log('[WS] 새 클라이언트 연결');

  ws.on('message', (data, isBinary) => handleMessage(ws, data, isBinary));

  ws.on('close', () => {
    const session = sessionManager.getSessionByWs(ws);
    if (session) {
      console.log(`[WS] 연결 종료, 세션 정리: ${session.id}`);
      sessionManager.endSession(session.id);
      sessionManager.removeSession(session.id);
    }
  });

  ws.on('error', (err) => {
    console.error('[WS] 에러:', err.message);
  });

  sendToClient(ws, { type: 'connected', message: 'Voice to Chart 서버 연결됨' });
}

module.exports = { handleConnection };
