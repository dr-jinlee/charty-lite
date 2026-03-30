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
}

export default function TranscriptView({
  entries,
  partialText,
  partialSpeaker,
  isInterpreting,
}: TranscriptViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, partialText]);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xs font-semibold text-slate-400 mb-1 px-1 flex-shrink-0">
        실시간 기록
      </h2>

      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-1">
        {entries.length === 0 && !partialText && (
          <p className="text-xs text-slate-300 pt-4 text-center">상담을 시작하면 여기에 기록됩니다</p>
        )}

        <p className="text-[12px] leading-relaxed text-slate-700">
          {entries.map((entry) => (
            <span key={entry.id}>{entry.text} </span>
          ))}
          {partialText && (
            <span className="text-slate-400">{partialText}<span className="inline-block w-0.5 h-3 bg-purple-500 animate-pulse ml-px align-middle" /></span>
          )}
        </p>
      </div>
    </div>
  );
}
