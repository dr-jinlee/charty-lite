'use client';

import { useMemo } from 'react';

interface ConsultationProgressProps {
  transcriptText: string;
}

const STEPS = [
  { id: 'greeting', label: '첫인사',
    keywords: ['안녕하세요', '어서오세요', '반갑습니다', '오셨어요', '어서 오세요', '오늘 어떻게'] },
  { id: 'status', label: '근황/변동사항',
    keywords: ['최근', '요즘', '변화', '달라진', '지난번', '이후', '경과', '어떠셨', '괜찮으셨', '불편한', '그동안', '저번에'] },
  { id: 'concern', label: '고민 파악',
    keywords: ['고민', '걱정', '신경', '불편', '어디가', '어떤 부분', '개선', '뭐가 제일', '가장 신경', '원하시는'] },
  { id: 'recommend', label: '시술 추천',
    keywords: ['추천', '권해', '좋을 것 같', '효과적', '맞을 것 같', '제안', '해보시는 게', '드려볼', '적합한'] },
  { id: 'explain', label: '시술 설명',
    keywords: ['원리', '효과는', '지속', '유지기간', '시간은', '과정은', '방법은', '어떻게 하냐면', '주입', '조사'] },
  { id: 'caution', label: '주의사항',
    keywords: ['주의', '부작용', '금지', '안 되', '삼가', '조심', '알레르기', '주의사항', '시술 후에', '하시면 안'] },
  { id: 'price', label: '가격 안내',
    keywords: ['가격', '비용', '얼마', '만원', '할인', '이벤트', '회원', '프로그램', '패키지', '결제'] },
  { id: 'qa', label: '질의응답',
    keywords: ['궁금', '질문', '물어볼', '더 있으', '괜찮으시', '결정', '하시겠', '진행할까', '예약'] },
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

  const progress = STEPS.length > 0 ? (completedSteps.size / STEPS.length) * 100 : 0;

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-2 flex-shrink-0">
      <div className="relative flex items-center justify-between max-w-full">
        {/* 진행 라인 (배경) */}
        <div className="absolute top-[9px] left-[20px] right-[20px] h-[2px] bg-slate-200" />
        {/* 진행 라인 (완료) */}
        <div className="absolute top-[9px] left-[20px] h-[2px] bg-green-400 transition-all duration-500"
          style={{ width: `calc(${progress}% - 40px * ${progress}/100)` }} />

        {STEPS.map((step) => {
          const done = completedSteps.has(step.id);
          return (
            <div key={step.id} className="flex flex-col items-center z-10" style={{ width: `${100 / STEPS.length}%` }}>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                done
                  ? 'bg-green-500 border-green-500'
                  : 'bg-white border-slate-300'
              }`}>
                {done && <span className="text-white text-[9px]">✓</span>}
              </div>
              <span className={`text-[10px] mt-1 text-center leading-tight transition-colors ${
                done ? 'text-green-600 font-medium' : 'text-slate-400'
              }`}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
