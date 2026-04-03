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
    if (transcriptText.length < 15) return;
    if (transcriptText.length - prevLenRef.current < 30) return;

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
      const res = await fetch(`${API_URL}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rec = data.recommendation || '';
      if (isMountedRef.current) setRecommendation(rec);
    } catch (err) {
      console.warn('[Charty Pick] 추천 로드 실패:', err);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }

  return (
    <div className="px-3 py-1 bg-gradient-to-r from-purple-50 to-white border-b border-purple-100 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold text-purple-500 uppercase tracking-wider flex-shrink-0">Charty's Pick</span>
        {isLoading ? (
          <span className="text-[11px] text-slate-400 animate-pulse">분석 중...</span>
        ) : recommendation ? (
          <span className="text-[11px] text-purple-700 font-medium">{recommendation}</span>
        ) : (
          <span className="text-[11px] text-slate-300">상담이 진행되면 시술 추천이 나타납니다</span>
        )}
      </div>
    </div>
  );
}
