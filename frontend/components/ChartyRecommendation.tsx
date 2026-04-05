'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '@/lib/api';
import { getTaxonomy } from '@/lib/procedureHub';
import type { TaxonomyCategory, ExtractedData } from '@/lib/procedureHub';

interface ChartyRecommendationProps {
  transcriptText: string;
}

export default function ChartyRecommendation({ transcriptText }: ChartyRecommendationProps) {
  const [recommendation, setRecommendation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const prevLenRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // 시술 정보 호버
  const [taxonomy, setTaxonomy] = useState<TaxonomyCategory[]>([]);
  const [hoverInfo, setHoverInfo] = useState<{ keyword: string; data: ExtractedData } | null>(null);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiCacheRef = useRef<Record<string, ExtractedData>>({});

  useEffect(() => {
    isMountedRef.current = true;
    getTaxonomy().then(t => setTaxonomy(t.modality)).catch(() => {});
    return () => {
      isMountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // STT 텍스트에서 시술 키워드 감지
  useEffect(() => {
    if (taxonomy.length === 0 || !transcriptText) { setMatchedKeywords([]); return; }
    const text = transcriptText.toLowerCase();
    const found: string[] = [];
    for (const cat of taxonomy) {
      if (text.includes(cat.category.toLowerCase())) {
        found.push(cat.category);
        continue;
      }
      for (const sub of cat.subcategories) {
        for (const item of sub.items || []) {
          if (text.includes(item.name.toLowerCase())) { found.push(cat.category); break; }
        }
        if (found.includes(cat.category)) break;
      }
    }
    setMatchedKeywords([...new Set(found)]);
  }, [taxonomy, transcriptText]);

  useEffect(() => {
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

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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
      if (isMountedRef.current) setRecommendation(data.recommendation || '');
    } catch (err) {
      console.warn('[Charty Pick] 추천 로드 실패:', err);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }

  const handleTagEnter = useCallback((keyword: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(async () => {
      const cat = taxonomy.find(c => c.category === keyword);
      if (cat?.extracted) {
        setHoverInfo({ keyword, data: cat.extracted });
      } else if (aiCacheRef.current[keyword]) {
        setHoverInfo({ keyword, data: aiCacheRef.current[keyword] });
      } else {
        try {
          const res = await fetch(`${API_URL}/procedure-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword }),
          });
          const d = await res.json();
          if (d.extracted) {
            aiCacheRef.current[keyword] = d.extracted;
            setHoverInfo({ keyword, data: d.extracted });
          }
        } catch {}
      }
    }, 200);
  }, [taxonomy]);

  const handleTagLeave = useCallback(() => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    setHoverInfo(null);
  }, []);

  return (
    <div className="flex flex-col flex-shrink-0">
      {/* Charty's Pick */}
      <div className="px-3 py-1 bg-gradient-to-r from-purple-50 to-white border-b border-purple-100">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-purple-500 uppercase tracking-wider flex-shrink-0">Charty's Pick</span>
          {isLoading ? (
            <span className="text-[11px] text-slate-400 animate-pulse">분석 중...</span>
          ) : recommendation ? (
            <span className="text-[11px] text-purple-700 font-medium">{recommendation}</span>
          ) : null}
        </div>
      </div>

      {/* 감지된 시술 태그 + 호버 정보 */}
      {matchedKeywords.length > 0 && (
        <div className="border-b border-slate-100">
          <div className="px-3 py-1.5 flex flex-wrap gap-1 items-center">
            <span className="text-[9px] text-slate-400 mr-1">감지</span>
            {matchedKeywords.map(kw => (
              <button key={kw}
                onMouseEnter={() => handleTagEnter(kw)}
                onMouseLeave={handleTagLeave}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                  hoverInfo?.keyword === kw
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                }`}>{kw}</button>
            ))}
          </div>

          {/* 호버 시 시술 정보 패널 */}
          {hoverInfo && (
            <div className="px-3 py-2 bg-white border-t border-slate-100 text-[11px] leading-relaxed">
              <p className="font-bold text-purple-700 mb-1">{hoverInfo.keyword}</p>
              {hoverInfo.data.mechanism && (
                <p className="text-slate-600 mb-1">{hoverInfo.data.mechanism}</p>
              )}
              {(hoverInfo.data.onset_duration?.onset || hoverInfo.data.onset_duration?.duration) && (
                <div className="flex gap-2 mb-1">
                  {hoverInfo.data.onset_duration.onset && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 rounded">발현 <span className="font-bold text-blue-700">{hoverInfo.data.onset_duration.onset}</span></span>
                  )}
                  {hoverInfo.data.onset_duration.duration && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 rounded">지속 <span className="font-bold text-emerald-700">{hoverInfo.data.onset_duration.duration}</span></span>
                  )}
                </div>
              )}
              {hoverInfo.data.safety?.common && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-[9px] text-orange-400">부작용</span>
                  {hoverInfo.data.safety.common.slice(0, 4).map((s, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-red-600 font-bold rounded">{s}</span>
                  ))}
                </div>
              )}
              {hoverInfo.data.aftercare && hoverInfo.data.aftercare.length > 0 && (
                <div className="mt-1">
                  <span className="text-[9px] text-emerald-500">시술 후</span>
                  {hoverInfo.data.aftercare.slice(0, 3).map((s, i) => (
                    <p key={i} className="text-[10px] text-slate-500">· {s}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
