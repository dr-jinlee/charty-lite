'use client';

import { useState, useMemo, useEffect, useRef } from 'react';

interface CartItem {
  proc: { category: string; name: string; price: number; original_price: number | null; price_type?: string };
  id: string;
  free?: boolean;
  discount?: number;
}

interface ConsultationChecklistProps {
  cart: CartItem[];
  consultType: string;
  transcriptText?: string;
}

const STATIC_CHECKS = [
  { id: 'allergy', label: '알레르기', keywords: ['알레르기', '알러지', '과민', '두드러기'] },
  { id: 'medication', label: '복용약물', keywords: ['약', '복용', '아스피린', '혈전', '오메가', '한약', '영양제', '비타민'] },
  { id: 'disease', label: '기저질환', keywords: ['고혈압', '당뇨', '질환', '간', '갑상선', '심장'] },
  { id: 'pregnancy', label: '임신·수유', keywords: ['임신', '수유', '생리', '피임'] },
  { id: 'keloid', label: '켈로이드', keywords: ['켈로이드', '흉터', '상처'] },
  { id: 'past_procedure', label: '시술이력', keywords: ['전에', '예전에', '저번에', '맞았', '했었', '받으신', '시술 받'] },
  { id: 'past_sideeffect', label: '부작용이력', keywords: ['부작용', '문제', '부종', '괴사', '멍이', '부어', '아팠'] },
];

// 고지사항 (상담사가 반드시 안내해야 할 항목)
const NOTICE_CHECKS = [
  { id: 'minor_side', label: '가벼운 부작용', keywords: ['멍', '붓기', '발적', '열감', '통증', '뻣뻣'] },
  { id: 'serious_side', label: '심각한 부작용', keywords: ['괴사', '혈관폐색', '감염', '화상', '신경손상', '실명'] },
  { id: 'downtime', label: '다운타임', keywords: ['다운타임', '회복기간', '쉬어야', '며칠', '일주일'] },
  { id: 'duration', label: '시술유지기간', keywords: ['유지기간', '유지', '지속', '개월', '오래가'] },
  { id: 'cycle', label: '재시술 주기', keywords: ['주기', '간격', '다음에', '후에 다시', '개월마다', '주마다'] },
  { id: 'sessions', label: '재시술 횟수', keywords: ['몇 번', '몇번', '회', '차', '횟수', '반복'] },
  { id: 'price', label: '가격안내', keywords: ['가격', '비용', '얼마', '만원', '원', '할인'] },
  { id: 'package', label: '다회권/회원권', keywords: ['다회권', '회원권', '패키지', '프로그램', '묶음', '세트'] },
];

const PROCEDURE_CHECKS: Record<string, {
  label: string;
  keywords: string[];
  items: { id: string; label: string; color: 'orange' | 'blue' | 'emerald'; detectWords?: string[] }[];
}> = {
  botox: {
    label: '보톡스', keywords: ['보톡스', '보톡', '톡신', '나보타', '제오민', '보툴렉스', '코어톡스', '사각턱', '승모근', '턱보', '승모보', '스킨보톡스'],
    items: [
      { id: 'se1', label: '멍/부종', color: 'orange' }, { id: 'se2', label: '두통', color: 'orange' }, { id: 'se3', label: '눈꺼풀처짐', color: 'orange' },
      { id: 'pre1', label: '혈전방지제 확인', color: 'blue' }, { id: 'pre2', label: '음주금지 안내', color: 'blue' },
      { id: 'post1', label: '4시간 눕지않기', color: 'emerald' }, { id: 'post2', label: '마사지 금지', color: 'emerald' }, { id: 'post3', label: '사우나 1주 금지', color: 'emerald' },
    ],
  },
  filler: {
    label: '필러', keywords: ['필러', '쥬비덤', '레스틸렌', '볼류마', '벨로테로', '이브아르', '뉴라미스', '팔자', '턱끝', '애교살', '코필러', '입술', '엘란쎄', '스컬트라'],
    items: [
      { id: 'se1', label: '멍/부종', color: 'orange' }, { id: 'se2', label: '비대칭', color: 'orange' }, { id: 'se3', label: '혈관폐색(응급)', color: 'orange' },
      { id: 'pre1', label: '오메가3 중단 확인', color: 'blue' }, { id: 'pre2', label: '이전 필러 이력', color: 'blue' },
      { id: 'post1', label: '압박 금지', color: 'emerald' }, { id: 'post2', label: '통증/변색 시 내원', color: 'emerald' },
    ],
  },
  ulthera: {
    label: '울쎄라', keywords: ['울쎄라', '울써라', '울쎄라피'],
    items: [
      { id: 'se1', label: '시술중 통증', color: 'orange' }, { id: 'se2', label: '부종', color: 'orange' }, { id: 'se3', label: '감각둔화', color: 'orange' },
      { id: 'pre1', label: '보형물/필러 확인', color: 'blue' }, { id: 'pre2', label: '통증민감도 확인', color: 'blue' },
      { id: 'post1', label: '사우나 1주 금지', color: 'emerald' }, { id: 'post2', label: '효과 2~3개월 안내', color: 'emerald' },
    ],
  },
  thermage: {
    label: '써마지', keywords: ['써마지', '서마지', 'FLX'],
    items: [
      { id: 'se1', label: '열감/통증', color: 'orange' }, { id: 'se2', label: '발적', color: 'orange' },
      { id: 'pre1', label: '금속보형물 확인', color: 'blue' }, { id: 'pre2', label: '페이스메이커', color: 'blue' },
      { id: 'post1', label: '보습 관리', color: 'emerald' }, { id: 'post2', label: '자외선 차단', color: 'emerald' },
    ],
  },
  lifting: {
    label: '리프팅', keywords: ['리프팅', '슈링크', '실리프팅', '올리지오', '인모드', '포텐자', '티타늄', '코그'],
    items: [
      { id: 'se1', label: '통증', color: 'orange' }, { id: 'se2', label: '부종 1~2주', color: 'orange' }, { id: 'se3', label: '감각저하', color: 'orange' },
      { id: 'pre1', label: '피부상태 확인', color: 'blue' },
      { id: 'post1', label: '운동 1주 금지', color: 'emerald' }, { id: 'post2', label: '효과 1~3개월', color: 'emerald' },
    ],
  },
  laser: {
    label: '레이저', keywords: ['레이저', '토닝', '피코', 'IPL', '제네시스', '엑셀V', '실펌', '시크릿', 'CO2', '프락셀', '큐스위치'],
    items: [
      { id: 'se1', label: '발적/열감', color: 'orange' }, { id: 'se2', label: '색소침착', color: 'orange' }, { id: 'se3', label: '딱지/각질', color: 'orange' },
      { id: 'pre1', label: '레티놀 중단', color: 'blue' }, { id: 'pre2', label: '구순포진 이력', color: 'blue' },
      { id: 'post1', label: 'SPF50+ 필수', color: 'emerald' }, { id: 'post2', label: '각질 제거 금지', color: 'emerald' },
    ],
  },
  skinbooster: {
    label: '스킨부스터', keywords: ['스킨부스터', '리쥬란', '쥬베룩', '물광', '엑소좀', '연어주사', '프로파일로', '샤넬주사', '필로르가', '스킨바이브'],
    items: [
      { id: 'se1', label: '발적/멍', color: 'orange' }, { id: 'se2', label: '붓기 1~3일', color: 'orange' },
      { id: 'pre1', label: '트러블/염증 확인', color: 'blue' },
      { id: 'post1', label: '당일 메이크업 자제', color: 'emerald' }, { id: 'post2', label: '음주 2~3일 금지', color: 'emerald' },
    ],
  },
  removal: {
    label: '제모', keywords: ['제모', '겨드랑이', '비키니', '아발란체'],
    items: [
      { id: 'se1', label: '발적/열감', color: 'orange' }, { id: 'se2', label: '모낭염', color: 'orange' },
      { id: 'pre1', label: '왁싱 1개월 중단', color: 'blue' },
      { id: 'post1', label: '자외선 차단', color: 'emerald' }, { id: 'post2', label: '사우나 2~3일 금지', color: 'emerald' },
    ],
  },
  fat: {
    label: '지방분해', keywords: ['지방분해', '지방', '윤곽주사', '이중턱', '팻', '비만주사', 'HPL'],
    items: [
      { id: 'se1', label: '부종/통증', color: 'orange' }, { id: 'se2', label: '멍/경결', color: 'orange' },
      { id: 'pre1', label: '혈액순환 장애', color: 'blue' },
      { id: 'post1', label: '부위 마사지', color: 'emerald' }, { id: 'post2', label: '수분 섭취', color: 'emerald' },
    ],
  },
};

const COLORS = {
  orange: { on: 'bg-orange-500 text-white border-orange-500', off: 'bg-white text-orange-600 border-orange-300 hover:bg-orange-50' },
  blue: { on: 'bg-blue-500 text-white border-blue-500', off: 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50' },
  emerald: { on: 'bg-emerald-500 text-white border-emerald-500', off: 'bg-white text-emerald-600 border-emerald-300 hover:bg-emerald-50' },
  green: { on: 'bg-green-500 text-white border-green-500', off: 'bg-white text-green-600 border-green-300 hover:bg-green-50' },
  purple: { on: 'bg-purple-500 text-white border-purple-500', off: 'bg-white text-purple-600 border-purple-300 hover:bg-purple-50' },
};

export default function ConsultationChecklist({ cart, consultType, transcriptText = '' }: ConsultationChecklistProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [autoDetected, setAutoDetected] = useState<Set<string>>(new Set());
  const prevTextLenRef = useRef(0);

  // STT 텍스트에서 키워드 감지 → 자동 체크
  useEffect(() => {
    // 텍스트 초기화(새 상담) 시 자동감지도 리셋
    if (transcriptText.length === 0) {
      prevTextLenRef.current = 0;
      setAutoDetected(new Set());
      return;
    }
    if (transcriptText.length <= prevTextLenRef.current) {
      prevTextLenRef.current = transcriptText.length;
      return;
    }
    prevTextLenRef.current = transcriptText.length;
    const textLower = transcriptText.toLowerCase();

    const newAuto = new Set(autoDetected);
    const newChecked = new Set(checked);

    // 정적 체크 자동 감지
    for (const item of STATIC_CHECKS) {
      const id = `s-${item.id}`;
      if (!newAuto.has(id) && item.keywords.some(kw => textLower.includes(kw))) {
        newAuto.add(id);
        newChecked.add(id);
      }
    }

    // 고지사항 자동 감지
    for (const item of NOTICE_CHECKS) {
      const id = `n-${item.id}`;
      if (!newAuto.has(id) && item.keywords.some(kw => textLower.includes(kw))) {
        newAuto.add(id);
        newChecked.add(id);
      }
    }

    // 동적 체크 자동 감지 (부작용/시술전후 관련 키워드)
    for (const disclosure of Object.values(PROCEDURE_CHECKS)) {
      const cartText = cart.map(c => `${c.proc.name} ${c.proc.category}`).join(' ').toLowerCase();
      if (!disclosure.keywords.some(kw => cartText.includes(kw.toLowerCase()))) continue;

      for (const item of disclosure.items) {
        const id = `${disclosure.label}-${item.id}`;
        if (!newAuto.has(id)) {
          // 라벨의 핵심 키워드로 감지 (예: "멍" → "멍", "부종" → "부종")
          const labelWords = item.label.replace(/[()\/]/g, ' ').split(/\s+/).filter(w => w.length >= 1);
          if (labelWords.some(w => textLower.includes(w.toLowerCase())) ||
              (item.detectWords && item.detectWords.some(w => textLower.includes(w)))) {
            newAuto.add(id);
            newChecked.add(id);
          }
        }
      }
    }

    if (newAuto.size !== autoDetected.size) {
      setAutoDetected(newAuto);
      setChecked(newChecked);
    }
  }, [transcriptText, cart]);

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const activeDisclosures = useMemo(() => {
    if (cart.length === 0) return [];
    const cartText = cart.map(c => `${c.proc.name} ${c.proc.category}`).join(' ').toLowerCase();
    return Object.values(PROCEDURE_CHECKS).filter(d =>
      d.keywords.some(kw => cartText.includes(kw.toLowerCase()))
    );
  }, [cart]);

  const staticDone = STATIC_CHECKS.filter(c => checked.has(`s-${c.id}`)).length;
  const noticeDone = NOTICE_CHECKS.filter(c => checked.has(`n-${c.id}`)).length;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <span className="text-sm font-semibold text-slate-700">체크리스트</span>
        {checked.size > 0 && (
          <button onClick={() => setChecked(new Set())}
            className="text-[10px] text-slate-400 hover:text-red-500">초기화</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-3">

        {/* 정적: 필수 확인 */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-slate-600">필수 확인</span>
            <span className="text-[10px] text-slate-400">{staticDone}/{STATIC_CHECKS.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...STATIC_CHECKS].sort((a, b) => {
              const aDone = checked.has(`s-${a.id}`) ? 1 : 0;
              const bDone = checked.has(`s-${b.id}`) ? 1 : 0;
              return aDone - bDone;
            }).map(item => {
              const id = `s-${item.id}`;
              const done = checked.has(id);
              return (
                <button key={id} onClick={() => toggle(id)}
                  className={`text-[11px] px-2 py-1 rounded-full border transition-all duration-300 ${
                    done ? `${COLORS.green.on} opacity-50 scale-95` : COLORS.green.off
                  } ${autoDetected.has(id) && done ? 'ring-1 ring-green-300' : ''}`}>
                  {done && <span className="mr-0.5">{autoDetected.has(id) ? '⚡' : '✓'}</span>}{item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 고지사항 */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-purple-600">고지사항</span>
            <span className="text-[10px] text-slate-400">{noticeDone}/{NOTICE_CHECKS.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...NOTICE_CHECKS].sort((a, b) => {
              const aDone = checked.has(`n-${a.id}`) ? 1 : 0;
              const bDone = checked.has(`n-${b.id}`) ? 1 : 0;
              return aDone - bDone;
            }).map(item => {
              const id = `n-${item.id}`;
              const done = checked.has(id);
              return (
                <button key={id} onClick={() => toggle(id)}
                  className={`text-[11px] px-2 py-1 rounded-full border transition-all duration-300 ${
                    done ? `${COLORS.purple.on} opacity-50 scale-95` : COLORS.purple.off
                  } ${autoDetected.has(id) && done ? 'ring-1 ring-purple-300' : ''}`}>
                  {done && <span className="mr-0.5">{autoDetected.has(id) ? '⚡' : '✓'}</span>}{item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 동적: 시술별 체크 */}
        {activeDisclosures.map(disclosure => {
          const orangeItems = disclosure.items.filter(i => i.color === 'orange');
          const blueItems = disclosure.items.filter(i => i.color === 'blue');
          const emeraldItems = disclosure.items.filter(i => i.color === 'emerald');

          return (
            <div key={disclosure.label}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] font-bold text-purple-700">{disclosure.label}</span>
              </div>

              {/* 부작용 고지 */}
              {orangeItems.length > 0 && (
                <div className="mb-1.5">
                  <p className="text-[10px] text-orange-500 font-medium mb-1">부작용</p>
                  <div className="flex flex-wrap gap-1">
                    {orangeItems.map(item => {
                      const id = `${disclosure.label}-${item.id}`;
                      const done = checked.has(id);
                      return (
                        <button key={id} onClick={() => toggle(id)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            done ? COLORS.orange.on : COLORS.orange.off
                          }`}>
                          {done && <span className="mr-0.5">{autoDetected.has(id) ? '⚡' : '✓'}</span>}{item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 시술 전 */}
              {blueItems.length > 0 && (
                <div className="mb-1.5">
                  <p className="text-[10px] text-blue-500 font-medium mb-1">시술 전</p>
                  <div className="flex flex-wrap gap-1">
                    {blueItems.map(item => {
                      const id = `${disclosure.label}-${item.id}`;
                      const done = checked.has(id);
                      return (
                        <button key={id} onClick={() => toggle(id)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            done ? COLORS.blue.on : COLORS.blue.off
                          }`}>
                          {done && <span className="mr-0.5">{autoDetected.has(id) ? '⚡' : '✓'}</span>}{item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 시술 후 */}
              {emeraldItems.length > 0 && (
                <div className="mb-1.5">
                  <p className="text-[10px] text-emerald-500 font-medium mb-1">시술 후</p>
                  <div className="flex flex-wrap gap-1">
                    {emeraldItems.map(item => {
                      const id = `${disclosure.label}-${item.id}`;
                      const done = checked.has(id);
                      return (
                        <button key={id} onClick={() => toggle(id)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            done ? COLORS.emerald.on : COLORS.emerald.off
                          }`}>
                          {done && <span className="mr-0.5">{autoDetected.has(id) ? '⚡' : '✓'}</span>}{item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {activeDisclosures.length === 0 && (
          <p className="text-[11px] text-slate-300 text-center pt-2">시술 담으면 체크항목 추가</p>
        )}
      </div>
    </div>
  );
}
