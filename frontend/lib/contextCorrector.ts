// 문맥 기반 STT 보정 엔진
// 1. 직접 매핑 (가장 빠름)
// 2. 부분 문자열 매칭 (조사 붙어있어도 잡음)
// 3. 편집 거리 유사도
// 4. 슬라이딩 윈도우 역보정

// 미용 클리닉 시술명 사전 (정식 명칭 — 세부 포함)
const PROCEDURE_NAMES = [
  // 톡신
  '보톡스', '스킨보톡스', '턱보톡스', '승모근보톡스', '나보타', '제오민', '보툴렉스', '코어톡스',
  // 필러
  '필러', '쥬비덤', '볼류마', '레스틸렌', '벨로테로', '엘란쎄', '스컬트라', '래디에스',
  // 리프팅
  '울쎄라', '써마지', '슈링크', '실리프팅', '올리지오', '인모드', '포텐자', '티타늄', '코그',
  // 스킨부스터
  '리쥬란', '쥬베룩', '물광', '엑소좀', '스킨부스터', '프로파일로', '샤넬주사',
  // 레이저
  '피코토닝', '레이저토닝', '제네시스', '엑셀V', 'IPL', '실펌', '시크릿', 'CO2', '프락셀',
  // 기타
  '사각턱', '승모근', '팔자주름', '턱끝', '애교살',
  '지방분해', '윤곽주사', '제모', '필링', 'PRP', '백옥주사',
];

// STT 오인식 → 정식 시술명 직접 매핑
const KNOWN_MISRECOGNITIONS: Record<string, string> = {
  // 슈링크
  '싱크': '슈링크', '씽크': '슈링크', '쉬링크': '슈링크', '슁크': '슈링크',
  '싱크대': '', // 실제 싱크대는 무시
  // 써마지
  '서머지': '써마지', '더마지': '써마지', '터마지': '써마지', '서마지': '써마지', '떠마지': '써마지',
  // 울쎄라
  '얼떠라': '울쎄라', '울떠라': '울쎄라', '울테라': '울쎄라', '울세라': '울쎄라', '울떼라': '울쎄라',
  // 보톡스
  '보택스': '보톡스', '바톡스': '보톡스', '보탁스': '보톡스',
  // 필러
  '필라': '필러', '빌러': '필러',
  // 리쥬란
  '레주란': '리쥬란', '레쮸란': '리쥬란', '리주란': '리쥬란', '레쥬란': '리쥬란',
  // 쥬베룩
  '주베룩': '쥬베룩', '주벨룩': '쥬베룩', '쥬벨룩': '쥬베룩',
  // 쥬비덤
  '주비덤': '쥬비덤', '주비 덤': '쥬비덤', '쥬비 덤': '쥬비덤',
  // 엑소좀
  '엑소솜': '엑소좀', '엑소 좀': '엑소좀',
  // 포텐자
  '포텐져': '포텐자', '포텐 자': '포텐자',
  // 스컬트라
  '스컬프트라': '스컬트라', '스컬 트라': '스컬트라',
  // 엘란쎄
  '엘란세': '엘란쎄', '엘란 쎄': '엘란쎄',
  // 인모드
  '인모 드': '인모드',
  // 스킨부스터
  '스킨 부스터': '스킨부스터', '스킨부스타': '스킨부스터',
  // 피코토닝
  '피코 토닝': '피코토닝',
  // 프로파일로
  '프로파일 로': '프로파일로', '프로파일러': '프로파일로',
  // 실펌
  '실펌 엑스': '실펌X', '실펌엑스': '실펌X',
  // 올리지오
  '올리지 오': '올리지오',
  // 나보타
  '나보 타': '나보타',
  // 제오민
  '제오 민': '제오민',
};

// 편집 거리
function editDistance(a: string, b: string): number {
  const m = a.length; const n = b.length;
  if (m === 0) return n; if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// 유사도 기반 시술명 매칭
export function findSimilarProcedure(word: string): string | null {
  if (word.length < 2) return null;

  // 1) 직접 매핑
  const direct = KNOWN_MISRECOGNITIONS[word];
  if (direct !== undefined) return direct || null;

  // 2) 편집 거리
  let bestMatch = '';
  let bestDist = Infinity;
  for (const proc of PROCEDURE_NAMES) {
    const dist = editDistance(word, proc);
    const maxDist = word.length <= 3 ? 1 : 2;
    if (dist <= maxDist && dist > 0 && dist < bestDist) {
      bestDist = dist;
      bestMatch = proc;
    }
  }
  return bestMatch || null;
}

// 텍스트에서 부분 문자열 + 유사도 기반 교정
// 한국어 특성: "슈링크를", "보톡스가" 처럼 조사가 붙으므로 부분 매칭 필수
export function correctBySimilarity(text: string): string {
  let result = text;

  // 1) 직접 매핑 (부분 문자열 매칭 — 조사 붙어있어도 잡음)
  // 긴 키부터 매칭 (예: "스킨 부스터"가 "스킨"보다 먼저)
  const sortedKeys = Object.keys(KNOWN_MISRECOGNITIONS).sort((a, b) => b.length - a.length);
  for (const wrong of sortedKeys) {
    const right = KNOWN_MISRECOGNITIONS[wrong];
    if (right && result.includes(wrong)) {
      result = result.replaceAll(wrong, right);
    }
  }

  // 2) 단어 경계 없이 시술명 유사도 체크 (공백 분리 단어만)
  const parts = result.split(/(\s+)/);
  result = parts.map(part => {
    if (/^\s+$/.test(part) || part.length < 2) return part;
    // 이미 정식 시술명이면 스킵
    if (PROCEDURE_NAMES.some(p => part.includes(p))) return part;
    // 조사 제거 후 체크 (을/를/이/가/에/도/는/은/로)
    const stripped = part.replace(/[을를이가에도는은로의와]$/, '');
    if (stripped.length < 2) return part;
    const similar = findSimilarProcedure(stripped);
    if (similar) return similar + part.slice(stripped.length);
    return part;
  }).join('');

  return result;
}

// 슬라이딩 윈도우 역보정
export function retroCorrect(
  segments: { id: string; text: string }[],
  windowSize: number = 3,
): { id: string; corrected: string }[] {
  if (segments.length < 2) return [];

  const corrections: { id: string; corrected: string }[] = [];

  // 최근 N개 세그먼트에서 확인된 시술명 수집
  const recentText = segments.slice(-windowSize).map(s => s.text).join(' ');
  const confirmedProcedures: string[] = [];
  for (const proc of PROCEDURE_NAMES) {
    if (recentText.includes(proc)) confirmedProcedures.push(proc);
  }
  if (confirmedProcedures.length === 0) return [];

  // 이전 세그먼트들에서 오인식 교정
  const start = Math.max(0, segments.length - windowSize - 2);
  const checkRange = segments.slice(start, -1);

  for (const seg of checkRange) {
    let corrected = seg.text;
    let changed = false;

    // 1) 직접 매핑 역보정 (부분 문자열)
    for (const [wrong, right] of Object.entries(KNOWN_MISRECOGNITIONS)) {
      if (right && corrected.includes(wrong) && confirmedProcedures.includes(right)) {
        corrected = corrected.replaceAll(wrong, right);
        changed = true;
      }
    }

    // 2) 편집 거리 역보정 (조사 제거 후 매칭)
    const parts = corrected.split(/(\s+)/);
    const newParts = parts.map(part => {
      if (/^\s+$/.test(part) || part.length < 2) return part;
      if (PROCEDURE_NAMES.some(p => part.includes(p))) return part;
      const stripped = part.replace(/[을를이가에도는은로의와]$/, '');
      if (stripped.length < 2) return part;
      for (const proc of confirmedProcedures) {
        const dist = editDistance(stripped, proc);
        if (dist > 0 && dist <= 2) {
          changed = true;
          return proc + part.slice(stripped.length);
        }
      }
      return part;
    });

    if (changed) {
      corrections.push({ id: seg.id, corrected: newParts.join('') });
    }
  }

  return corrections;
}
