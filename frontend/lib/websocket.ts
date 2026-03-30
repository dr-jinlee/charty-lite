/**
 * WebSocket 클라이언트
 * 백엔드 서버와 실시간 통신
 */

export type MessageType =
  | 'connected'
  | 'session.started'
  | 'session.paused'
  | 'session.resumed'
  | 'session.ended'
  | 'transcript.partial'
  | 'transcript.final'
  | 'chart.generating'
  | 'chart.complete'
  | 'chart.error'
  | 'tts.audio'
  | 'error';

export interface WSMessage {
  type: MessageType;
  [key: string]: any;
}

export interface SessionStartOptions {
  mode: 'standard' | 'interpret';
  micMode: 'single' | 'dual';
  targetLang?: string;
  template?: string;
  customerId?: string;
  consultant?: string;
}

type MessageHandler = (message: WSMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(url: string = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[WS] 연결됨');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            this.emit(message.type, message);
            this.emit('*', message); // 모든 메시지 수신용
          } catch {
            console.error('[WS] 메시지 파싱 실패');
          }
        };

        this.ws.onclose = () => {
          console.log('[WS] 연결 종료');
          this.emit('disconnected', { type: 'disconnected' as any });
        };

        this.ws.onerror = (error) => {
          console.error('[WS] 에러:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // 상담 시작
  startSession(options: SessionStartOptions) {
    this.send({ type: 'session.start', ...options });
  }

  // 상담 일시정지
  pauseSession() {
    this.send({ type: 'session.pause' });
  }

  // 상담 재개
  resumeSession() {
    this.send({ type: 'session.resume' });
  }

  // 상담 종료 (차트 생성 요청)
  endSession() {
    this.send({ type: 'session.end' });
  }

  // 음성 데이터 전송 (바이너리)
  sendAudio(audioData: ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    }
  }

  // JSON 메시지 전송
  private send(message: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // 이벤트 리스너
  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    }
  }

  private emit(type: string, message: WSMessage) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// 싱글톤 인스턴스
export const wsClient = new WebSocketClient();
