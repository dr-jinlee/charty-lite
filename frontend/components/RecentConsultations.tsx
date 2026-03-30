'use client';

import { useState, useEffect } from 'react';

interface Consultation {
  id: string;
  customer_id: string;
  consultant: string;
  consultation_type: string;
  summary: string;
  created_at: string;
  duration_seconds: number;
}

/**
 * 최근 상담 목록 사이드바 컴포넌트
 */
export default function RecentConsultations() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRecent();
  }, []);

  const fetchRecent = async () => {
    try {
      const res = await fetch('/api/history/consultations?limit=10');
      if (res.ok) {
        const data = await res.json();
        setConsultations(data);
      }
    } catch {
      // 서버 미연결 시 무시
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins}분`;
  };

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        최근 상담
      </h3>

      {isLoading && (
        <div className="text-xs text-slate-400 py-4 text-center">불러오는 중...</div>
      )}

      {!isLoading && consultations.length === 0 && (
        <div className="text-xs text-slate-400 py-4 text-center">
          아직 상담 기록이 없습니다
        </div>
      )}

      <div className="space-y-2">
        {consultations.map((c) => (
          <button
            key={c.id}
            className="w-full text-left p-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-100 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">{formatDate(c.created_at)}</span>
              {c.duration_seconds > 0 && (
                <span className="text-xs text-slate-400">{formatDuration(c.duration_seconds)}</span>
              )}
            </div>
            <p className="text-sm text-slate-700 line-clamp-2">
              {c.summary || '(요약 없음)'}
            </p>
            {c.consultant && (
              <span className="text-xs text-slate-400 mt-1 inline-block">
                담당: {c.consultant}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
