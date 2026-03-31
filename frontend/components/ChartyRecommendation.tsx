'use client';

import { useState, useEffect, useRef } from 'react';
import { API_URL } from '@/lib/api';

interface ChartyRecommendationProps {
  transcriptText: string;
}

export default function ChartyRecommendation({ transcriptText }: ChartyRecommendationProps) {
  const [recommendation, setRecommendation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const prevLenRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    // 텍스트 초기화 시 리셋
    if (!transcriptText || transcriptText.length === 0) {
      prevLenRef.current = 0;
      setRecommendation('');
      return;
    }
    if (transcriptText.length < 30) return;
    if (transcriptText.length - prevLenRef.current < 50) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      prevLenRef.current = transcriptText.length;
      fetchRecommendation(transcriptText);
    }, 3000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [transcriptText]);

  async function fetchRecommendation(text: string) {
    if (isLoading || !isMountedRef.current) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/interpret/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.slice(-800),
          sourceLang: 'ko',
          targetLang: 'ko',
          speakerRole: 'doctor',
          customPrompt: `당신은 미용 클리닉 상담 보조 AI입니다. 아래 상담 녹취를 읽고, 상담사에게 추가로 추천할 시술을 한 줄로 제안하세요.
규칙:
- 반드시 한 줄, 30자 이내
- "~도 같이 추천해보세요" 형태
- 현재 언급된 시술과 시너지가 좋은 것만
- 이미 언급된 시술은 추천하지 마세요
- 추천할 게 없으면 "현재 상담이 잘 진행되고 있습니다" 라고만

녹취:
${text.slice(-800)}

한 줄 추천:`,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rec = data.translatedText || data.translation || '';
      if (rec && isMountedRef.current) setRecommendation(rec);
    } catch (err) {
      console.warn('[Charty Pick] 추천 로드 실패:', err);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }

  if (!recommendation && !isLoading) return null;

  return (
    <div className="px-3 py-2 bg-gradient-to-r from-purple-50 to-white border-b border-purple-100 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold text-purple-500 uppercase tracking-wider flex-shrink-0">Charty's Pick</span>
        {isLoading ? (
          <span className="text-[11px] text-slate-400 animate-pulse">분석 중...</span>
        ) : (
          <span className="text-[11px] text-purple-700 font-medium">{recommendation}</span>
        )}
      </div>
    </div>
  );
}
