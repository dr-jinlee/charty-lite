'use client';

import { useMemo } from 'react';

interface ConsultationProgressProps {
  transcriptText: string;
}

const STEPS = [
  { id: 'greeting', label: '첫인사',
    keywords: ['안녕하세요', '어서오세요', '반갑습니다', '오셨어요', '어서 오세요', '오늘 어떻게'] },
  { id: 'history', label: '이전 경과 확인',
    keywords: ['최근', '요즘', '변화', '달라진', '지난번', '이후', '경과', '어떠셨', '괜찮으셨', '그동안', '저번에', '전에 받으신'] },
  { id: 'concern', label: '고민/증상 파악',
    keywords: ['고민', '걱정', '신경', '불편', '어디가', '어떤 부분', '개선', '뭐가 제일', '가장 신경', '원하시는', '증상'] },
  { id: 'recommend', label: '시술 추천',
    keywords: ['추천', '권해', '좋을 것 같', '효과적', '맞을 것 같', '제안', '해보시는 게', '드려볼', '적합한'] },
  { id: 'explain', label: '시술 설명',
    keywords: ['원리', '효과는', '지속', '유지기간', '시간은', '과정은', '방법은', '어떻게 하냐면', '주입', '조사'] },
  { id: 'caution', label: '주의사항/부작용',
    keywords: ['주의', '부작용', '금지', '안 되', '삼가', '조심', '알레르기', '주의사항', '시술 후에', '하시면 안', '멍', '붓기'] },
  { id: 'price', label: '가격/회원권 안내',
    keywords: ['가격', '비용', '얼마', '만원', '할인', '이벤트', '회원', '프로그램', '패키지', '결제', '다회권', '총'] },
  { id: 'closing', label: '질의응답/후속안내',
    keywords: ['궁금', '질문', '물어볼', '더 있으', '괜찮으시', '결정', '하시겠', '진행할까', '예약', '다음에', '관리'] },
];

export default function ConsultationProgress({ transcriptText }: ConsultationProgressProps) {
  const textLower = transcriptText.toLowerCase();

  const completedSteps = useMemo(() => {
    const done = new Set<string>();
    for (const step of STEPS) {
      if (step.keywords.some(kw => textLower.includes(kw))) {
        done.add(step.id);
      }
    }
    return done;
  }, [textLower]);

  return (
    <div className="bg-white px-6 py-3 flex-shrink-0 shadow-[0_1px_2px_rgba(99,14,212,0.03)]">
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const done = completedSteps.has(step.id);
          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              {/* 스텝 */}
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                  done
                    ? 'bg-purple-600 text-white shadow-[0_0_8px_rgba(124,58,237,0.3)]'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-[9px] mt-1 text-center leading-tight whitespace-nowrap transition-colors ${
                  done ? 'text-purple-600 font-semibold' : 'text-slate-400'
                }`}>{step.label}</span>
              </div>
              {/* 연결선 (마지막 제외) */}
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-[2px] mx-1 rounded transition-colors duration-500 ${
                  done ? 'bg-purple-400' : 'bg-slate-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
