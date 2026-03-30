'use client';

import { useEffect, useRef } from 'react';

export interface TranscriptEntry {
  id: string;
  speaker: 'doctor' | 'patient' | 'unknown';
  text: string;
  lang: string;
  translation?: string;
  timestamp: number;
  isPartial?: boolean;
}

interface TranscriptViewProps {
  entries: TranscriptEntry[];
  partialText: string | null;
  partialSpeaker: string;
  isInterpreting?: boolean;
  targetLang?: string;
  partialTranslation?: string | null;
}

const LANG_LABELS: Record<string, string> = {
  en: 'EN', zh: '中', ja: '日', vi: 'VI',
};

export default function TranscriptView({
  entries, partialText, partialSpeaker, isInterpreting, targetLang, partialTranslation,
}: TranscriptViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, partialText]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-1 px-1 flex-shrink-0">
        <h2 className="text-xs font-semibold text-slate-400">실시간 기록</h2>
        {isInterpreting && targetLang && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 font-medium">
            통번역 {LANG_LABELS[targetLang] || targetLang}
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-1">
        {entries.length === 0 && !partialText && (
          <p className="text-xs text-slate-300 pt-4 text-center">상담을 시작하면 여기에 기록됩니다</p>
        )}

        <div className="space-y-1">
          {entries.map((entry) => (
            <div key={entry.id}>
              <p className="text-[12px] leading-relaxed text-slate-700">{entry.text}</p>
              {entry.translation && (
                <p className="text-[11px] leading-relaxed text-purple-500 ml-2">{entry.translation}</p>
              )}
            </div>
          ))}
          {partialText && (
            <div>
              <p className="text-[12px] text-slate-400">
                {partialText}<span className="inline-block w-0.5 h-3 bg-purple-500 animate-pulse ml-px align-middle" />
              </p>
              {partialTranslation && (
                <p className="text-[11px] text-purple-300 ml-2">{partialTranslation}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
