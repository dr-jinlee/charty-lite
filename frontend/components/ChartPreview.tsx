'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { API_URL } from '@/lib/api';

function RadarChart({ metrics }: { metrics: { name: string; score: number; emoji: string }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 200;
  const center = size / 2;
  const radius = 70;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || metrics.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 고해상도
    canvas.width = size * 2;
    canvas.height = size * 2;
    ctx.scale(2, 2);

    ctx.clearRect(0, 0, size, size);
    const count = metrics.length;
    const angleStep = (Math.PI * 2) / count;
    const startAngle = -Math.PI / 2;

    // 배경 동심원
    for (const r of [0.2, 0.4, 0.6, 0.8, 1.0]) {
      ctx.beginPath();
      for (let i = 0; i <= count; i++) {
        const angle = startAngle + angleStep * (i % count);
        const x = center + Math.cos(angle) * radius * r;
        const y = center + Math.sin(angle) * radius * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = r === 1.0 ? '#CBD5E1' : '#E2E8F0';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // 축선
    for (let i = 0; i < count; i++) {
      const angle = startAngle + angleStep * i;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // 데이터 영역 (입체 그라데이션)
    ctx.beginPath();
    for (let i = 0; i <= count; i++) {
      const angle = startAngle + angleStep * (i % count);
      const val = metrics[i % count].score / 100;
      const x = center + Math.cos(angle) * radius * val;
      const y = center + Math.sin(angle) * radius * val;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();

    // 그라데이션 채우기
    const grad = ctx.createRadialGradient(center, center, 0, center, center, radius);
    grad.addColorStop(0, 'rgba(124, 58, 237, 0.35)');
    grad.addColorStop(1, 'rgba(124, 58, 237, 0.05)');
    ctx.fillStyle = grad;
    ctx.fill();

    // 글로우 효과
    ctx.shadowColor = 'rgba(124, 58, 237, 0.4)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#7C3AED';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 내부 하이라이트 (입체감)
    ctx.beginPath();
    for (let i = 0; i <= count; i++) {
      const angle = startAngle + angleStep * (i % count);
      const val = metrics[i % count].score / 100 * 0.6;
      const x = center + Math.cos(angle) * radius * val;
      const y = center + Math.sin(angle) * radius * val;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(167, 139, 250, 0.12)';
    ctx.fill();

    // 꼭짓점 점 (글로우)
    for (let i = 0; i < count; i++) {
      const angle = startAngle + angleStep * i;
      const val = metrics[i].score / 100;
      const x = center + Math.cos(angle) * radius * val;
      const y = center + Math.sin(angle) * radius * val;
      // 외부 글로우
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(124, 58, 237, 0.2)';
      ctx.fill();
      // 내부 점
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#7C3AED';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - 0.5, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();
    }

    // 라벨
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < count; i++) {
      const angle = startAngle + angleStep * i;
      const lx = center + Math.cos(angle) * (radius + 22);
      const ly = center + Math.sin(angle) * (radius + 22);
      ctx.fillStyle = '#475569';
      ctx.fillText(`${metrics[i].emoji}${metrics[i].name}`, lx, ly);
    }
  }, [metrics]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
}

interface EvalResult {
  score: number;
  grade: string;
  metrics: { name: string; score: number; emoji: string; comment: string }[];
  summary: string;
  strengths: string[];
  improvements: string[];
}

interface CartItem {
  proc: { category: string; name: string; price: number; original_price: number | null; price_type?: string };
  id: string;
  free?: boolean;
  discount?: number;
}

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  updated_at: string;
}

interface ChartPreviewProps {
  chart: string;
  summary: string;
  isGenerating: boolean;
  rawTranscript: string;
  cart: CartItem[];
  discountRate: number;
  selectedCurrency: string;
  exchangeRates: ExchangeRates | null;
}

const CURRENCIES: Record<string, string> = {
  USD: 'USD', JPY: 'JPY', CNY: 'CNY', HKD: 'HKD', TWD: 'TWD',
};

export default function ChartPreview({
  chart, summary, isGenerating, rawTranscript,
  cart, discountRate, selectedCurrency, exchangeRates,
}: ChartPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedChart, setEditedChart] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'raw' | 'eval'>('chart');
  const [copyTarget, setCopyTarget] = useState<'all' | 'no-memo'>('all');
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [showReport, setShowReport] = useState(false);

  async function handleReport() {
    setIsReporting(true);
    setShowReport(true);
    try {
      const res = await fetch(`${API_URL}/consultation/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart: displayChart,
          transcript: rawTranscript,
          cartItems: cart.map(c => c.proc.name),
          duration: 0,
          evalSummary: evalResult ? `${evalResult.grade}등급 ${evalResult.score}점` : '',
        }),
      });
      const data = await res.json();
      if (data.error) alert('리포트 생성 실패: ' + data.error);
      else setReport(data);
    } catch { alert('서버 연결 실패'); }
    setIsReporting(false);
  }

  async function handleEvaluate() {
    setIsEvaluating(true);
    setActiveTab('eval');
    try {
      const res = await fetch(`${API_URL}/consultation/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart: displayChart,
          transcript: rawTranscript,
          cartItems: cart.map(c => c.proc.name),
          duration: 0,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert('평가 실패: ' + data.error);
      } else {
        setEvalResult(data);
      }
    } catch {
      alert('서버 연결 실패');
    }
    setIsEvaluating(false);
  }

  const displayChart = isEditing ? editedChart : chart;

  // 환율 변환
  const convertPrice = useCallback((krw: number): string | null => {
    if (selectedCurrency === 'KRW' || !exchangeRates) return null;
    const rate = exchangeRates.rates[selectedCurrency];
    if (!rate) return null;
    const converted = krw * rate;
    const isInteger = selectedCurrency === 'JPY' || selectedCurrency === 'TWD';
    const formatted = isInteger
      ? Math.round(converted).toLocaleString()
      : converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted} ${selectedCurrency}`;
  }, [selectedCurrency, exchangeRates]);

  function formatPrice(price: number): string {
    const krw = `${price.toLocaleString()}원`;
    const foreign = convertPrice(price);
    return foreign ? `${krw} (${foreign})` : krw;
  }

  // 개별 할인 적용된 시술 가격
  function getItemPrice(item: CartItem): number {
    if (item.free) return 0;
    const d = item.discount || 0;
    return d > 0 ? Math.round(item.proc.price * (1 - d / 100)) : item.proc.price;
  }

  // 가격 요약 텍스트 생성 (차트 본문에 삽입용)
  function buildPricingSummary(): string {
    if (cart.length === 0) return '';
    const total = cart.reduce((s, i) => s + getItemPrice(i), 0);
    const totalVat = Math.round(total * 1.1);

    let text = '■ 시술 가격 안내\n';
    text += '══════════════════════════════════════════\n';
    cart.forEach((item, i) => {
      const tag = item.free ? '[무료]' : (item.proc.price_type === '이벤트' ? '[이벤트]' : '[정규가]');
      const discountTag = !item.free && (item.discount || 0) > 0 ? ` (${item.discount}% 할인)` : '';
      text += `  ${i + 1}. ${tag}${discountTag} ${item.proc.name.substring(0, 40)}\n`;
      text += `     ${item.free ? '무료 (서비스)' : formatPrice(getItemPrice(item))}\n`;
    });
    text += '  ──────────────────────────────────────\n';
    text += `  합계 (VAT 별도): ${formatPrice(total)}\n`;
    text += `  합계 (VAT 포함): ${formatPrice(totalVat)}\n`;
    if (discountRate > 0) {
      const discountedFinal = discountRate === 100 ? 0 : Math.round(totalVat * (1 - discountRate / 100));
      text += discountRate === 100
        ? `  협찬 (100% 할인): 0원\n`
        : `  추가 ${discountRate}% 할인: ${formatPrice(discountedFinal)}\n`;
    }
    return text;
  }

  // 가격 요약이 삽입된 차트 텍스트 (화면 표시 + 복사 공용)
  const chartWithPricing = useMemo(() => {
    if (!displayChart) return displayChart;
    const pricingSummary = buildPricingSummary();
    if (!pricingSummary) return displayChart;

    // ■ 핵심 요약 앞에 삽입
    const insertPoints = ['■ 핵심 요약', '■ 고객 프로필', '■ 고객 요약'];
    for (const point of insertPoints) {
      const idx = displayChart.indexOf(point);
      if (idx > -1) {
        return displayChart.substring(0, idx) + pricingSummary + '\n' + displayChart.substring(idx);
      }
    }
    return displayChart + '\n' + pricingSummary;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayChart, cart, discountRate, selectedCurrency, exchangeRates]);

  // 복사
  const handleCopy = async () => {
    let textToCopy = chartWithPricing || displayChart;

    if (copyTarget === 'no-memo') {
      const memoIndex = textToCopy.indexOf('■ 내부 메모');
      if (memoIndex > -1) {
        textToCopy = textToCopy.substring(0, memoIndex).trimEnd();
        textToCopy += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
      }
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEdit = () => { setEditedChart(chart); setIsEditing(true); };
  const handleSaveEdit = () => { setIsEditing(false); };
  const handleCancelEdit = () => { setEditedChart(''); setIsEditing(false); };

  // 가격 요약 UI (차트 위에 시각적 표시용)
  function renderPricingSummary() {
    if (cart.length === 0) return null;
    const total = cart.reduce((s, i) => s + getItemPrice(i), 0);
    const totalVat = Math.round(total * 1.1);
    const discounted = discountRate > 0 ? Math.round(totalVat * (1 - discountRate / 100)) : 0;

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
        <span className="text-sm font-bold text-blue-800">시술 가격 안내</span>
        <div className="space-y-1.5 mt-2">
          {cart.map((item, i) => (
            <div key={item.id} className={`flex justify-between items-start text-xs gap-2 ${item.free ? 'opacity-70' : ''}`}>
              <div className="flex-1 min-w-0">
                <span className={`text-[9px] px-1 py-px rounded ${
                  item.free ? 'bg-green-500 text-white' : (item.proc.price_type === '이벤트' ? 'bg-orange-500 text-white' : 'bg-slate-400 text-white')
                }`}>
                  {item.free ? '무료' : (item.proc.price_type || '정규가')}
                </span>
                {!item.free && (item.discount || 0) > 0 && (
                  <span className="text-[9px] px-1 py-px rounded bg-red-500 text-white ml-0.5">{item.discount}%</span>
                )}
                <span className={`ml-1 ${item.free ? 'text-green-700' : 'text-slate-700'}`}>{item.proc.name.substring(0, 45)}</span>
              </div>
              <span className={`font-bold whitespace-nowrap ${item.free ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                {item.free ? '무료' : formatPrice(getItemPrice(item))}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-blue-200 mt-2 pt-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-600">합계 (VAT 별도)</span>
            <span className="font-bold">{formatPrice(total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">합계 (VAT 포함)</span>
            <span className="font-bold">{formatPrice(totalVat)}</span>
          </div>
          {discountRate > 0 && (
            <div className={`flex justify-between text-sm -mx-1 px-1 py-1 rounded ${discountRate === 100 ? 'bg-purple-100' : 'bg-blue-100'}`}>
              <span className={`font-bold ${discountRate === 100 ? 'text-purple-700' : 'text-blue-700'}`}>
                {discountRate === 100 ? '협찬 (100% 할인)' : `추가 ${discountRate}% 할인`}
              </span>
              <span className={`font-black ${discountRate === 100 ? 'text-purple-700' : 'text-blue-700'}`}>{formatPrice(discounted)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* 탭 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'chart' ? 'bg-clinic-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >차트</button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'raw' ? 'bg-clinic-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >원본 텍스트</button>
          {chart && (
            <button
              onClick={handleEvaluate}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'eval' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
              }`}
            >{isEvaluating ? '평가 중...' : '평가하기'}</button>
          )}
        </div>

        {chart && activeTab === 'chart' && (
          <div className="flex items-center gap-2">
            <select value={copyTarget} onChange={(e) => setCopyTarget(e.target.value as 'all' | 'no-memo')}
              className="text-xs border border-slate-200 rounded px-2 py-1">
              <option value="all">전체 복사</option>
              <option value="no-memo">내부 메모 제외</option>
            </select>
            {!isEditing ? (
              <>
                <button onClick={handleCopy}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    copied ? 'bg-green-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}>{copied ? '복사 완료!' : '복사'}</button>
                <button onClick={handleEdit}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                  편집</button>
              </>
            ) : (
              <>
                <button onClick={handleSaveEdit}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-500 hover:bg-green-600 text-white transition-colors">저장</button>
                <button onClick={handleCancelEdit}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">취소</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isGenerating && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-8 h-8 border-4 border-clinic-200 border-t-clinic-600 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">차트를 생성하고 있습니다...</p>
          </div>
        )}

        {!isGenerating && !chart && activeTab === 'chart' && (
          <div className="flex items-center justify-center h-full text-slate-400">
            <div className="text-center">
              <p className="text-sm mb-1">상담 종료 후</p>
              <p className="text-sm">여기에 차트가 생성됩니다</p>
            </div>
          </div>
        )}

        {activeTab === 'chart' && chart && !isEditing && (
          <div>
            {renderPricingSummary()}
            <div className="chart-preview bg-white rounded-lg border border-slate-200 p-4 shadow-sm whitespace-pre-wrap">
              {chartWithPricing}
            </div>
          </div>
        )}

        {activeTab === 'chart' && isEditing && (
          <textarea value={editedChart} onChange={(e) => setEditedChart(e.target.value)}
            className="w-full h-full chart-preview bg-white rounded-lg border border-blue-300 p-4 shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
        )}

        {activeTab === 'raw' && (
          <div className="chart-preview bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            {rawTranscript || '(상담 기록이 없습니다)'}
          </div>
        )}

        {activeTab === 'eval' && (
          <div className="p-4">
            {isEvaluating && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-6 h-6 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                <p className="text-sm text-slate-500">상담을 평가하고 있습니다...</p>
              </div>
            )}
            {!isEvaluating && evalResult && (
              <div className="space-y-3">
                {/* 종합 점수 */}
                <div className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 p-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-white ${
                    evalResult.score >= 90 ? 'bg-green-500' :
                    evalResult.score >= 70 ? 'bg-blue-500' :
                    evalResult.score >= 50 ? 'bg-orange-500' : 'bg-red-500'
                  }`}>{evalResult.grade}</div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{evalResult.score}<span className="text-sm text-slate-400 font-normal">점</span></p>
                    <p className="text-xs text-slate-500">{evalResult.summary}</p>
                  </div>
                </div>

                {/* 오각형 + 메트릭 점수 */}
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-3">
                    <RadarChart metrics={evalResult.metrics || []} />
                    <div className="flex-1 space-y-1.5">
                      {evalResult.metrics?.map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{m.emoji} {m.name}</span>
                          <span className={`font-bold ${m.score >= 80 ? 'text-green-600' : m.score >= 60 ? 'text-blue-600' : 'text-red-600'}`}>{m.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {evalResult.metrics?.map((m, i) => (
                    <p key={i} className="text-[10px] text-slate-400 mt-1">{m.emoji} {m.comment}</p>
                  ))}
                </div>

                {/* 잘한 점 + 개선점 */}
                <div className="grid grid-cols-2 gap-2">
                  {evalResult.strengths?.length > 0 && (
                    <div className="bg-green-50 rounded-lg border border-green-200 p-2.5">
                      <p className="text-[10px] font-semibold text-green-700 mb-1">잘한 점</p>
                      {evalResult.strengths.map((s, i) => (
                        <p key={i} className="text-[11px] text-green-600">· {s}</p>
                      ))}
                    </div>
                  )}
                  {evalResult.improvements?.length > 0 && (
                    <div className="bg-orange-50 rounded-lg border border-orange-200 p-2.5">
                      <p className="text-[10px] font-semibold text-orange-700 mb-1">개선점</p>
                      {evalResult.improvements.map((s, i) => (
                        <p key={i} className="text-[11px] text-orange-600">· {s}</p>
                      ))}
                    </div>
                  )}
                </div>

                {/* 리포트 작성 버튼 */}
                <button onClick={handleReport} disabled={isReporting}
                  className="w-full py-2 text-sm font-bold rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white transition-colors">
                  {isReporting ? '리포트 작성 중...' : '상세 리포트 작성'}
                </button>
              </div>
            )}
            {!isEvaluating && !evalResult && (
              <p className="text-sm text-slate-400 text-center pt-8">평가하기 버튼을 눌러주세요</p>
            )}
          </div>
        )}
      </div>

      {copied && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 toast-animation">
          <div className="bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
            클립보드에 복사되었습니다 (가격 포함)
          </div>
        </div>
      )}

      {/* 상세 리포트 모달 */}
      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[680px] max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-purple-50">
              <div>
                <h2 className="text-lg font-bold text-purple-800">상담 평가 리포트</h2>
                {report && <p className="text-xs text-purple-500">{report.date}</p>}
              </div>
              <button onClick={() => setShowReport(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {isReporting && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500">Sonnet이 상세 리포트를 작성하고 있습니다...</p>
                </div>
              )}

              {!isReporting && report && (
                <>
                  {/* 종합 */}
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg ${
                      (report.overall?.score || 0) >= 90 ? 'bg-green-500' :
                      (report.overall?.score || 0) >= 70 ? 'bg-blue-500' :
                      (report.overall?.score || 0) >= 50 ? 'bg-orange-500' : 'bg-red-500'
                    }`}>{report.overall?.grade}</div>
                    <div>
                      <p className="text-3xl font-bold text-slate-800">{report.overall?.score}<span className="text-sm text-slate-400 font-normal ml-1">/ 100</span></p>
                      <p className="text-sm text-slate-500">{report.overall?.one_liner}</p>
                    </div>
                    <div className="ml-auto">
                      <RadarChart metrics={report.metrics || []} />
                    </div>
                  </div>

                  {/* 메트릭별 상세 */}
                  {report.metrics?.map((m: any, i: number) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-700">{m.emoji} {m.name}</span>
                        <span className={`text-lg font-black ${m.score >= 80 ? 'text-green-600' : m.score >= 60 ? 'text-blue-600' : 'text-red-600'}`}>{m.score}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full mb-2">
                        <div className={`h-full rounded-full ${m.score >= 80 ? 'bg-green-500' : m.score >= 60 ? 'bg-blue-500' : 'bg-red-500'}`}
                          style={{ width: `${m.score}%` }} />
                      </div>
                      <p className="text-xs text-slate-600 mb-2">{m.analysis}</p>
                      {m.examples?.map((ex: string, j: number) => (
                        <p key={j} className="text-[11px] text-slate-400 italic ml-2">"{ex}"</p>
                      ))}
                      {m.suggestion && (
                        <div className="mt-2 bg-white rounded-lg px-3 py-2 border border-slate-200">
                          <p className="text-[11px] text-purple-600">💡 {m.suggestion}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 하이라이트 / 리스크 / 액션 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                      <p className="text-xs font-bold text-green-700 mb-1.5">잘한 점</p>
                      {report.highlights?.map((s: string, i: number) => (
                        <p key={i} className="text-[11px] text-green-600 mb-0.5">· {s}</p>
                      ))}
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                      <p className="text-xs font-bold text-red-700 mb-1.5">리스크/주의</p>
                      {report.risks?.map((s: string, i: number) => (
                        <p key={i} className="text-[11px] text-red-600 mb-0.5">· {s}</p>
                      ))}
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                      <p className="text-xs font-bold text-blue-700 mb-1.5">다음 액션</p>
                      {report.action_items?.map((s: string, i: number) => (
                        <p key={i} className="text-[11px] text-blue-600 mb-0.5">· {s}</p>
                      ))}
                    </div>
                  </div>

                  {/* 코칭 메시지 */}
                  {report.coaching && (
                    <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                      <p className="text-xs font-bold text-purple-700 mb-1">코칭 메시지</p>
                      <p className="text-sm text-purple-600 leading-relaxed">{report.coaching}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
