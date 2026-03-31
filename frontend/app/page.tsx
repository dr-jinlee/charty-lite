'use client';

import { useState, useEffect, useRef } from 'react';
import TranscriptView, { TranscriptEntry } from '@/components/TranscriptView';
import ChartPreview from '@/components/ChartPreview';
import SessionControls from '@/components/SessionControls';
import ConsultationChecklist from '@/components/ConsultationChecklist';
import ConsultationProgress from '@/components/ConsultationProgress';
import { formatConsultant } from '@/lib/formatConsultant';
import { API_URL } from '@/lib/api';
import { instantTranslate } from '@/lib/medicalDict';

type AppStatus = 'idle' | 'recording' | 'paused' | 'processing' | 'done';
type InputMode = 'voice' | 'upload' | 'text';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export default function Home() {
  const [status, setStatus] = useState<AppStatus>('idle');
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [duration, setDuration] = useState(0);
  const [consultant, setConsultant] = useState('');
  const [consultType, setConsultType] = useState('doctor');
  const [doctorName, setDoctorName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [chartStyle, setChartStyle] = useState<'detailed' | 'balanced' | 'summary'>('detailed');
  const [sttLang, setSttLang] = useState<'ko' | 'en' | 'bilingual'>('ko');
  const [interpretMode, setInterpretMode] = useState(false);
  const [targetLang, setTargetLang] = useState('en');
  const [targetMinutes, setTargetMinutes] = useState(15);
  const [timeWarning, setTimeWarning] = useState(false);
  const [consultTemplate, setConsultTemplate] = useState<'first' | 'revisit' | 'post'>('first');

  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [partialText, setPartialText] = useState<string | null>(null);
  const [partialSpeaker, setPartialSpeaker] = useState<string>('unknown');

  const [chart, setChart] = useState('');
  const [summary, setSummary] = useState('');
  const [rawTranscript, setRawTranscript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [manualText, setManualText] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [checklistResetKey, setChecklistResetKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 3패널 너비
  const [colWidths, setColWidths] = useState<[number, number, number]>([0, 0, 0]);
  const draggingColRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // STT 용어 보정
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const correctionsRef = useRef<Record<string, string>>({});
  const correctionRegexRef = useRef<RegExp | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptsRef = useRef<TranscriptEntry[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recorderMimeRef = useRef('audio/webm');

  const isMountedRef = useRef(true);

  useEffect(() => { transcriptsRef.current = transcripts; }, [transcripts]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
      if (restartTimeoutRef.current) { clearTimeout(restartTimeoutRef.current); restartTimeoutRef.current = null; }
      if (interimTranslateRef.current) { clearTimeout(interimTranslateRef.current); }
    };
  }, []);

  // 초기 너비 (마운트 1회)
  useEffect(() => {
    if (containerRef.current) {
      const w = containerRef.current.getBoundingClientRect().width;
      setColWidths([w * 0.35, w * 0.2, w * 0.45]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 용어 보정 로드
  useEffect(() => {
    fetch(`${API_URL}/corrections`)
      .then(r => r.json())
      .then(d => {
        const map = d.corrections || {};
        setCorrections(map);
        correctionsRef.current = map;
        const keys = Object.keys(map);
        if (keys.length > 0) {
          keys.sort((a, b) => b.length - a.length);
          const escaped = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          correctionRegexRef.current = new RegExp(`(${escaped.join('|')})`, 'g');
        } else {
          correctionRegexRef.current = null;
        }
      })
      .catch(() => { correctionRegexRef.current = null; });
  }, []);

  function correctText(text: string): string {
    if (!correctionRegexRef.current) return text;
    return text.replace(correctionRegexRef.current, match => correctionsRef.current[match] || match);
  }

  // ─── 통번역 4단계 파이프라인 ───
  const interimTranslateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1단계: 사전 매칭 (0ms, 클라이언트)
  function dictTranslate(text: string, lang: string): string | null {
    return instantTranslate(text, lang);
  }

  // 2단계: interim 선번역 (중간 결과 일정 길이 이상이면 미리 번역 시작)
  function preTranslateInterim(text: string, lang: string) {
    if (!interpretMode || text.length < 8) return;
    if (interimTranslateRef.current) clearTimeout(interimTranslateRef.current);
    interimTranslateRef.current = setTimeout(() => {
      // 사전 매칭 결과를 partial 번역으로 미리 표시
      const dict = dictTranslate(text, lang);
      if (dict) setPartialTranslation(dict);
    }, 200);
  }

  const [partialTranslation, setPartialTranslation] = useState<string | null>(null);

  // 3단계: final 번역 (API, 정확)
  function translateFinal(entryId: string, text: string, lang: string) {
    // 즉시: 사전 매칭 표시
    const dictResult = dictTranslate(text, lang);
    if (dictResult) {
      setTranscripts(prev => prev.map(e =>
        e.id === entryId ? { ...e, translation: dictResult } : e
      ));
    }

    // API 번역 요청
    fetch(`${API_URL}/interpret/translate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang: 'ko', targetLang: lang, speakerRole: 'doctor' }),
    })
      .then(r => r.json())
      .then(data => {
        if (!isMountedRef.current) return;
        const translated = data.translatedText || data.translation || '';
        if (translated) {
          setTranscripts(prev => prev.map(e =>
            e.id === entryId ? { ...e, translation: translated } : e
          ));
        }
        schedulePostCorrection(entryId, text, translated, lang);
      })
      .catch(() => {});
  }

  // 4단계: 후보정 (3초 후, 각 문장 독립 실행 — 레이스 컨디션 없음)
  function schedulePostCorrection(entryId: string, original: string, firstTranslation: string, lang: string) {
    setTimeout(() => {
      // 앞뒤 문장 문맥 수집
      const allTexts = transcriptsRef.current;
      const idx = allTexts.findIndex(e => e.id === entryId);
      if (idx === -1) return;
      const contextBefore = allTexts.slice(Math.max(0, idx - 2), idx).map(e => e.text).join(' ');
      const contextAfter = allTexts.slice(idx + 1, idx + 2).map(e => e.text).join(' ');

      fetch(`${API_URL}/interpret/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: original,
          sourceLang: 'ko',
          targetLang: lang,
          speakerRole: 'doctor',
          customPrompt: `이전 문맥: "${contextBefore}". 다음 문맥: "${contextAfter}". 이 맥락에서 "${original}"을 자연스럽고 정확하게 번역하세요. 의료/미용 전문 용어를 정확히 사용하세요.`,
        }),
      })
        .then(r => r.json())
        .then(data => {
          const corrected = data.translatedText || data.translation || '';
          if (corrected && corrected !== firstTranslation && isMountedRef.current) {
            setTranscripts(prev => prev.map(e =>
              e.id === entryId ? { ...e, translation: corrected } : e
            ));
          }
        })
        .catch(() => {});
    }, 3000);
  }

  // 리사이즈 (movementX, 이벤트 1회 등록)
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (draggingColRef.current !== null) {
        const idx = draggingColRef.current;
        const delta = e.movementX;
        if (delta === 0) return;
        setColWidths(prev => {
          const next = [...prev] as [number, number, number];
          if (next[idx] + delta >= 150 && next[idx + 1] - delta >= 150) {
            next[idx] += delta;
            next[idx + 1] -= delta;
            return next;
          }
          return prev;
        });
      }
    }
    function onMouseUp() {
      draggingColRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  // 타이머 + 목표 시간 알림
  useEffect(() => {
    if (status === 'recording') {
      timerRef.current = setInterval(() => setDuration(d => {
        const next = d + 1;
        if (next === targetMinutes * 60) setTimeWarning(true);
        return next;
      }), 1000);
    } else if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, targetMinutes]);

  // Google STT
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sttFailCountRef = useRef(0);
  const MAX_STT_RETRIES = 5;

  function createRecognition() {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) { alert('Chrome 브라우저를 사용해주세요.'); return null; }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = sttLang === 'en' ? 'en-US' : 'ko-KR';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) finalText += text; else interimText += text;
      }
      if (interimText) {
        sttFailCountRef.current = 0; // 인식 성공 시 실패 카운트 리셋
        setPartialText(correctText(interimText));
        setPartialSpeaker('unknown'); setIsSpeaking(true); setAudioLevel(0.7);
        if (interpretMode) preTranslateInterim(correctText(interimText), targetLang);
      }
      if (finalText.trim()) {
        setPartialText(null); setPartialTranslation(null);
        setIsSpeaking(false); setAudioLevel(0);
        const corrected = correctText(finalText.trim());
        const entryId = `t-${Date.now()}-${Math.random()}`;
        setTranscripts(prev => [...prev, {
          id: entryId, speaker: 'unknown', text: corrected, lang: 'ko', timestamp: Date.now(),
        }]);
        // 통번역: 1→3→4단계 (사전→API→후보정)
        if (interpretMode) {
          translateFinal(entryId, corrected, targetLang);
        }
      }
    };
    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') return;
      if (event.error === 'not-allowed') { sttFailCountRef.current = MAX_STT_RETRIES; return; }
      sttFailCountRef.current++;
    };
    recognition.onend = () => {
      if (!isMountedRef.current || !recognitionRef.current) return;
      if (sttFailCountRef.current >= MAX_STT_RETRIES) {
        console.warn('[STT] 재시작 한도 초과, 중지');
        return;
      }
      restartTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current || !recognitionRef.current) return;
        try {
          const newRecog = createRecognition();
          if (newRecog) { newRecog.start(); recognitionRef.current = newRecog; sttFailCountRef.current = 0; }
        } catch { sttFailCountRef.current++; }
      }, 300);
    };
    return recognition;
  }

  function startRecognition() { sttFailCountRef.current = 0; const r = createRecognition(); if (r) { r.start(); recognitionRef.current = r; } }
  function stopRecognition() {
    if (restartTimeoutRef.current) { clearTimeout(restartTimeoutRef.current); restartTimeoutRef.current = null; }
    if (recognitionRef.current) { const ref = recognitionRef.current; recognitionRef.current = null; try { ref.stop(); } catch {} }
  }

  // 번역
  async function translateToKorean(text: string, mode: 'en' | 'bilingual' = 'en'): Promise<string> {
    try {
      const res = await fetch(`${API_URL}/interpret/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLang: mode === 'bilingual' ? 'mixed' : 'en', targetLang: 'ko', speakerRole: 'doctor' }),
      });
      const data = await res.json();
      return data.translatedText || text;
    } catch { return text; }
  }

  // 차트 생성 (SSE 스트리밍)
  async function requestChartGeneration(text: string, consultantName: string) {
    if (!text.trim()) { alert('상담 내용이 없습니다.'); setIsGenerating(false); setStatus('done'); return; }
    setRawTranscript(text); setIsGenerating(true); setStatus('processing');
    let chartText = text;
    if (sttLang === 'en') chartText = await translateToKorean(text, 'en');
    else if (sttLang === 'bilingual') chartText = await translateToKorean(text, 'bilingual');

    try {
      const res = await fetch(`${API_URL}/chart/generate-stream`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: chartText, consultant: consultantName, consultationType: 'auto', chartStyle }),
      });
      if (!res.ok || !res.body) { alert('서버 오류: ' + res.status); setIsGenerating(false); setStatus('done'); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let chartContent = ''; let buffer = ''; let firstChunk = true;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));
              if (eventData.text) { chartContent += eventData.text; setChart(chartContent); if (firstChunk) { setIsGenerating(false); firstChunk = false; } }
              if (eventData.done) setSummary(eventData.summary || '');
              if (eventData.error) alert('차트 생성 실패: ' + eventData.error);
            } catch {}
          }
        }
      }
      if (!chartContent) alert('차트가 비어있습니다.');
    } catch (err: any) { alert('서버 연결 실패: ' + err.message); }
    setIsGenerating(false); setStatus('done');
  }

  // 파일 업로드
  async function handleFileUpload(file: File) {
    setUploadStatus('음성 변환 중...');
    const formData = new FormData();
    formData.append('audio', file);
    try {
      const res = await fetch(`${API_URL}/transcribe/file`, { method: 'POST', body: formData });
      const data = await res.json();
      setUploadStatus('');
      if (data.error) { alert('변환 실패: ' + data.error); return; }
      const text = data.transcript || '';
      if (!text.trim()) { alert('음성에서 텍스트를 인식하지 못했습니다.'); return; }
      setTranscripts([{ id: `t-upload-${Date.now()}`, speaker: 'unknown', text, lang: 'ko', timestamp: Date.now() }]);
      setRawTranscript(text);
      setUploadStatus('변환 완료! "차트 생성" 버튼을 눌러주세요.');
    } catch (err: any) { alert('서버 연결 실패: ' + err.message); setUploadStatus(''); }
  }

  // 핸들러
  function handleStart() {
    setConsultant(formatConsultant(consultType, doctorName, managerName));
    setTranscripts([]); setChart(''); setSummary(''); setRawTranscript('');
    setDuration(0); setPartialText(null);
    startRecognition();
    setStatus('recording');
  }
  function handlePause() { stopRecognition(); setStatus('paused'); }
  function handleResume() { startRecognition(); setStatus('recording'); }
  async function handleStop() {
    stopRecognition();
    setIsSpeaking(false); setAudioLevel(0);
    const fullText = transcriptsRef.current.map(t => t.text).join('\n');
    requestChartGeneration(fullText, consultant);
  }
  function handleReset() {
    setStatus('idle'); setDuration(0); setTranscripts([]); setPartialText(null);
    setChart(''); setSummary(''); setRawTranscript(''); setIsGenerating(false);
    setManualText(''); setUploadStatus(''); setTimeWarning(false);
    setChecklistResetKey(k => k + 1);
  }
  function handleGenerateFromCurrent() {
    const name = formatConsultant(consultType, doctorName, managerName);
    if (inputMode === 'text') requestChartGeneration(manualText, name);
    else if (inputMode === 'upload') {
      const fullText = transcriptsRef.current.map(t => t.text).join('\n');
      requestChartGeneration(fullText, name);
    }
  }

  const transcriptText = inputMode === 'text'
    ? manualText
    : [...transcripts.map(t => t.text), ...(partialText ? [partialText] : [])].join(' ');

  return (
    <div className="flex flex-col h-screen">
      {/* 헤더 */}
      <header className="bg-white px-6 shadow-[0_1px_3px_rgba(99,14,212,0.04)]">
        <div className="flex items-center justify-between max-w-full mx-auto h-12">
          <div className="flex items-center gap-1.5 font-headline">
            <span className="text-sm font-extrabold text-purple-600 tracking-tight">centurion</span>
            <span className="text-sm font-bold text-[#191c1d] tracking-tight">charty</span>
            <span className="text-[10px] text-slate-400 ml-1">lite</span>
          </div>
          <div className="flex items-center gap-6">
            {([['voice', '실시간 녹음'], ['upload', '파일 업로드'], ['text', '텍스트 입력']] as [InputMode, string][]).map(([key, label]) => (
              <button key={key}
                onClick={() => { if (status === 'idle') { setInputMode(key); setTranscripts([]); setManualText(''); setUploadStatus(''); } }}
                className={`text-sm font-medium py-3 border-b-2 transition-colors ${inputMode === key ? 'text-purple-600 border-purple-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
              >{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-sm">
            {status === 'recording' && (
              <span className={`font-mono ${timeWarning ? 'text-red-500 font-bold animate-pulse' : duration >= targetMinutes * 60 * 0.8 ? 'text-orange-500' : 'text-slate-700'}`}>
                {Math.floor(duration / 60)}분 {duration % 60}초
                <span className="text-slate-400 font-normal"> / {targetMinutes}분</span>
              </span>
            )}
            <span className="text-slate-500">Charty Lite</span>
          </div>
        </div>
      </header>

      {/* 설정 바 */}
      {status === 'idle' && (
        <div className="bg-[#f3f4f5] px-6 py-2.5">
          <div className="flex items-center gap-3 max-w-full mx-auto">
            {inputMode === 'voice' && (
              <>
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">통번역</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setInterpretMode(!interpretMode)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${interpretMode ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-100'}`}>
                      {interpretMode ? 'ON' : 'OFF'}
                    </button>
                    {interpretMode && (
                      <select value={targetLang} onChange={e => setTargetLang(e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
                        <option value="en">English</option>
                        <option value="zh">中文</option>
                        <option value="ja">日本語</option>
                        <option value="vi">Tiếng Việt</option>
                      </select>
                    )}
                  </div>
                </div>
                <div className="w-px h-8 bg-slate-200" />
              </>
            )}
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5">상담 유형</p>
              <div className="flex items-center gap-1">
                {([['detailed', '상세형'], ['balanced', '절충형'], ['summary', '요약형']] as [string, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setChartStyle(key as any)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${chartStyle === key ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5">상담</p>
              <div className="flex items-center gap-1">
                {([['doctor', '원장 상담'], ['manager', '실장 상담']] as [string, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setConsultType(key)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${consultType === key ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5">담당자</p>
              <input type="text"
                value={consultType === 'doctor' ? doctorName : managerName}
                onChange={(e) => consultType === 'doctor' ? setDoctorName(e.target.value) : setManagerName(e.target.value)}
                placeholder="풀네임" className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-28 bg-white" />
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5">목표 시간</p>
              <select value={targetMinutes} onChange={e => setTargetMinutes(Number(e.target.value))}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
                <option value={10}>10분</option>
                <option value={15}>15분</option>
                <option value={20}>20분</option>
                <option value={30}>30분</option>
              </select>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5">상담 유형</p>
              <div className="flex items-center gap-1">
                {([['first', '첫방문'], ['revisit', '재방문'], ['post', '시술후']] as [string, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setConsultTemplate(key as any)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${consultTemplate === key ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상담 흐름 가이드 */}
      <ConsultationProgress transcriptText={transcriptText} />

      {/* 메인 3패널 */}
      <main ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* 왼쪽: 실시간 기록 */}
        <div style={{ width: colWidths[0] || '35%' }} className="flex flex-col min-w-0 flex-shrink-0">
          <div className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden">
            {inputMode === 'voice' && (
              <TranscriptView entries={transcripts} partialText={partialText} partialSpeaker={partialSpeaker}
                isInterpreting={interpretMode} targetLang={targetLang} partialTranslation={partialTranslation} />
            )}
            {inputMode === 'upload' && status === 'idle' && (
              <div className="flex flex-col h-full">
                <h2 className="text-xs font-semibold text-slate-400 mb-2">녹음 파일 업로드</h2>
                <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.mp4" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                {transcripts.length === 0 ? (
                  <div onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors">
                    <p className="text-slate-600 font-medium mb-1">클릭하여 파일 선택</p>
                    <p className="text-slate-400 text-sm">MP3, WAV, M4A, OGG 지원</p>
                    {uploadStatus && <p className="mt-3 text-sm text-blue-600">{uploadStatus}</p>}
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    <textarea value={transcripts[0]?.text || ''} onChange={(e) => setTranscripts([{ id: 'upload-edit', speaker: 'unknown', text: e.target.value, lang: 'ko', timestamp: Date.now() }])}
                      className="w-full h-64 text-sm leading-relaxed resize-none focus:outline-none bg-white border border-slate-200 rounded-lg p-3" />
                    {uploadStatus && <p className="text-sm text-green-600 mt-1">{uploadStatus}</p>}
                  </div>
                )}
              </div>
            )}
            {inputMode === 'text' && status === 'idle' && (
              <div className="flex flex-col h-full">
                <h2 className="text-xs font-semibold text-slate-400 mb-2">상담 텍스트 입력</h2>
                <textarea value={manualText} onChange={(e) => setManualText(e.target.value)}
                  placeholder="상담 내용을 입력하세요..."
                  className="flex-1 w-full p-3 text-sm leading-relaxed bg-white border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-200" />
                <p className="text-xs text-slate-400 mt-1">{manualText.length}자</p>
              </div>
            )}
            {inputMode !== 'voice' && status !== 'idle' && (
              <TranscriptView
                entries={inputMode === 'text' ? [{ id: 'manual', speaker: 'unknown', text: manualText, lang: 'ko', timestamp: Date.now() }] : transcripts}
                partialText={null} partialSpeaker="unknown" />
            )}
          </div>
        </div>

        {/* 구분선 1 */}
        <div onMouseDown={() => { draggingColRef.current = 0; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
          className="w-1 hover:w-1.5 panel-divider cursor-col-resize flex-shrink-0" />

        {/* 가운데: 체크리스트 */}
        <div style={{ width: colWidths[1] || '20%' }} className="flex flex-col min-w-0 flex-shrink-0">
          <ConsultationChecklist cart={[]} consultType={consultType} transcriptText={transcriptText} template={consultTemplate} resetKey={checklistResetKey} />
        </div>

        {/* 구분선 2 */}
        <div onMouseDown={() => { draggingColRef.current = 1; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
          className="w-1 hover:w-1.5 panel-divider cursor-col-resize flex-shrink-0" />

        {/* 오른쪽: 차트 */}
        <div style={{ width: colWidths[2] || '45%' }} className="flex flex-col min-w-0 flex-shrink-0">
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            <ChartPreview
              chart={chart} summary={summary} isGenerating={isGenerating} rawTranscript={rawTranscript}
              cart={[]} discountRate={0} selectedCurrency="KRW" exchangeRates={null}
            />
          </div>
        </div>
      </main>

      {/* 상담 종료 요약 카드 */}
      {status === 'done' && chart && (
        <div className="bg-gradient-to-r from-purple-50 to-slate-50 px-6 py-2 flex-shrink-0">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-purple-600 font-medium">
                {consultTemplate === 'first' ? '첫방문' : consultTemplate === 'revisit' ? '재방문' : '시술후'} · {Math.max(1, Math.round(duration / 60))}분
              </span>
              <span className="text-slate-500">{chartStyle === 'detailed' ? '상세형' : chartStyle === 'balanced' ? '절충형' : '요약형'}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => {
                const text = rawTranscript || transcripts.map(t => t.text).join('\n');
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = `상담녹취_${new Date().toISOString().slice(0,10)}.txt`; a.click();
              }} className="text-xs text-slate-500 hover:text-purple-600 transition-colors">
                녹취 저장
              </button>
              <button onClick={() => {
                const plain = chart.replace(/```/g, '').replace(/[━═──■]/g, '').replace(/\n{3,}/g, '\n\n').trim();
                navigator.clipboard.writeText(plain);
              }} className="text-xs text-slate-500 hover:text-purple-600 transition-colors">
                차트 복사 (텍스트)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 시간 초과 알림 */}
      {timeWarning && status === 'recording' && (
        <div className="bg-red-50 px-6 py-1.5 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-red-600 font-medium">목표 시간 {targetMinutes}분 초과</span>
          <button onClick={() => setTimeWarning(false)} className="text-xs text-red-400 hover:text-red-600">닫기</button>
        </div>
      )}

      {/* 하단 컨트롤 */}
      {inputMode === 'voice' ? (
        <SessionControls status={status} duration={duration} mode="standard"
          onStart={handleStart} onPause={handlePause} onResume={handleResume} onStop={handleStop} onReset={handleReset} />
      ) : (
        <div className="bg-white border-t border-slate-200 px-6 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div>
              {status === 'processing' && <span className="flex items-center gap-2 text-sm text-blue-600 font-medium"><div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />차트 생성 중...</span>}
              {status === 'done' && <span className="text-sm text-green-600 font-medium">차트 생성 완료</span>}
            </div>
            <div className="flex items-center gap-3">
              {status === 'idle' && (
                <button onClick={handleGenerateFromCurrent}
                  disabled={inputMode === 'text' ? !manualText.trim() : transcripts.length === 0}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-full font-medium transition-colors shadow-sm">
                  차트 생성
                </button>
              )}
              {status === 'done' && (
                <button onClick={handleReset}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-full font-medium transition-colors shadow-sm">
                  새 상담
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
