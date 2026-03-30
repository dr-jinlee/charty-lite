'use client';

import { useCallback } from 'react';

interface SessionControlsProps {
  status: 'idle' | 'recording' | 'paused' | 'processing' | 'done';
  duration: number;
  mode: 'standard' | 'interpret';
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
}

/**
 * 상담 세션 컨트롤 (액션 버튼 + 상태 표시)
 * 설정 드롭다운은 상단 탭 바로 이동됨
 */
export default function SessionControls({
  status, duration, mode,
  onStart, onPause, onResume, onStop, onReset,
}: SessionControlsProps) {
  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return (
    <div className="bg-white border-t border-slate-200 px-6 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* 왼쪽: 상태 표시 */}
        <div className="flex items-center gap-4">
          {(status === 'recording' || status === 'paused') && (
            <div className="flex items-center gap-3">
              {status === 'recording' && (
                <span className="flex items-center gap-2 text-red-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 recording-pulse" />
                  녹음 중
                </span>
              )}
              {status === 'paused' && (
                <span className="flex items-center gap-2 text-amber-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  일시정지
                </span>
              )}
              <span className="text-lg font-mono text-slate-700">
                {formatDuration(duration)}
              </span>
              {mode === 'interpret' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  통역 모드
                </span>
              )}
            </div>
          )}

          {status === 'processing' && (
            <span className="flex items-center gap-2 text-clinic-600 font-medium">
              <div className="w-4 h-4 border-2 border-clinic-200 border-t-clinic-600 rounded-full animate-spin" />
              차트 생성 중...
            </span>
          )}

          {status === 'done' && (
            <span className="text-green-600 font-medium">차트 생성 완료</span>
          )}
        </div>

        {/* 오른쪽: 액션 버튼 */}
        <div className="flex items-center gap-3">
          {status === 'idle' && (
            <button onClick={onStart}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium transition-colors shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-white" />
              상담 시작
            </button>
          )}

          {status === 'recording' && (
            <>
              <button onClick={onPause}
                className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-full text-sm font-medium transition-colors">
                일시정지
              </button>
              <button onClick={onStop}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-full font-medium transition-colors shadow-sm">
                <span className="w-2.5 h-2.5 rounded-sm bg-white" />
                상담 종료
              </button>
            </>
          )}

          {status === 'paused' && (
            <>
              <button onClick={onResume}
                className="px-4 py-2.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-full text-sm font-medium transition-colors">
                재개
              </button>
              <button onClick={onStop}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-full font-medium transition-colors shadow-sm">
                <span className="w-2.5 h-2.5 rounded-sm bg-white" />
                상담 종료
              </button>
            </>
          )}

          {status === 'done' && (
            <button onClick={onReset}
              className="px-6 py-2.5 bg-clinic-500 hover:bg-clinic-600 text-white rounded-full font-medium transition-colors shadow-sm">
              새 상담
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
