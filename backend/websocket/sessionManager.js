const { v4: uuidv4 } = require('uuid');

// 활성 상담 세션 저장소
const sessions = new Map();

function createSession(ws, options = {}) {
  const sessionId = uuidv4();
  const session = {
    id: sessionId,
    ws,
    mode: options.mode || 'standard',         // standard / interpret
    micMode: options.micMode || 'single',      // single / dual
    targetLang: options.targetLang || null,     // 통역 대상 언어
    template: options.template || 'default',
    customerId: options.customerId || null,
    consultant: options.consultant || null,
    // 상태
    status: 'active',        // active / paused / ended
    startTime: Date.now(),
    // 누적 데이터
    audioChunks: [],         // 음성 청크 버퍼
    transcripts: [],         // 확정 텍스트 목록
    partialText: '',         // 현재 처리 중인 부분 텍스트
    speakers: new Map(),     // 화자별 음성 특성
  };

  sessions.set(sessionId, session);
  console.log(`[Session] 생성: ${sessionId} (모드: ${session.mode})`);
  return session;
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function getSessionByWs(ws) {
  for (const session of sessions.values()) {
    if (session.ws === ws) return session;
  }
  return null;
}

function addTranscript(sessionId, transcript) {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.transcripts.push({
    speaker: transcript.speaker,   // 'doctor' / 'patient' / 'unknown'
    text: transcript.text,
    lang: transcript.lang || 'ko',
    translation: transcript.translation || null,
    timestamp: Date.now(),
  });
}

function getFullTranscript(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return '';

  return session.transcripts
    .map(t => {
      const speaker = t.speaker === 'doctor' ? '의사' : t.speaker === 'patient' ? '환자' : '화자';
      let line = `${speaker}: ${t.text}`;
      if (t.translation) {
        line += `\n  [번역] ${t.translation}`;
      }
      return line;
    })
    .join('\n');
}

function pauseSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) session.status = 'paused';
}

function resumeSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) session.status = 'active';
}

function endSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.status = 'ended';
  session.endTime = Date.now();
  session.durationSeconds = Math.floor((session.endTime - session.startTime) / 1000);

  console.log(`[Session] 종료: ${sessionId} (${session.durationSeconds}초)`);
  return session;
}

function removeSession(sessionId) {
  sessions.delete(sessionId);
}

function getActiveSessions() {
  const active = [];
  for (const session of sessions.values()) {
    if (session.status === 'active' || session.status === 'paused') {
      active.push({
        id: session.id,
        mode: session.mode,
        status: session.status,
        startTime: session.startTime,
        transcriptCount: session.transcripts.length,
      });
    }
  }
  return active;
}

module.exports = {
  createSession,
  getSession,
  getSessionByWs,
  addTranscript,
  getFullTranscript,
  pauseSession,
  resumeSession,
  endSession,
  removeSession,
  getActiveSessions,
};
