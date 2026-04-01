// 문맥 기반 STT 보정 엔진
// 1. 슬라이딩 윈도우 역보정: 이전 세그먼트를 새 문맥으로 재검증
// 2. 유사도 기반 매칭: 편집 거리로 시술명 후보 탐색

// 미용 클리닉 시술명 사전 (정식 명칭)
const PROCEDURE_NAMES = [
  '보톡스', '필러', '울쎄라', '써마지', '슈링크', '실리프팅', '인모드', '포텐자', '티타늄',
  '리쥬란', '쥬베룩', '물광', '엑소좀', '스킨부스터', '프로파일로',
  '피코토닝', '레이저토닝', '제네시스', '엑셀V', '실펌', '시크릿',
  '쥬비덤', '레스틸렌', '볼류마', '엘란쎄', '스컬트라',
  '올리지오', '코그', '나보타', '제오민',
  '사각턱', '승모근', '팔자주름', '턱끝', '애교살',
  '지방분해', '윤곽주사', '제모', '필링',
  'IPL', 'CO2', 'PRP',
];

// 편집 거리 (Levenshtein Distance)
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// 유사도 기반 시술명 매칭
// 입력 단어가 시술명과 유사하면 교정 후보 반환
// STT 오인식 → 시술명 직접 매핑 (편집 거리로 못 잡는 것들)
const KNOWN_MISRECOGNITIONS: Record<string, string> = {
  '싱크': '슈링크', '씽크': '슈링크', '싱크대': '',
  '서머지': '써마지', '더마지': '써마지', '터마지': '써마지',
  '얼떠라': '울쎄라', '울떠라': '울쎄라', '울테라': '울쎄라',
  '보택스': '보톡스', '바톡스': '보톡스', '보탁스': '보톡스',
  '필라': '필러',
  '레주란': '리쥬란', '레쮸란': '리쥬란',
  '주베룩': '쥬베룩', '주벨룩': '쥬베룩',
  '엑소솜': '엑소좀',
  '포텐져': '포텐자',
  '쉬링크': '슈링크',
};

export function findSimilarProcedure(word: string): string | null {
  if (word.length < 2) return null;

  // 1) 직접 매핑 체크 (가장 빠름)
  const direct = KNOWN_MISRECOGNITIONS[word];
  if (direct !== undefined) return direct || null; // 빈 문자열은 null (싱크대 등)

  // 2) 편집 거리 체크
  let bestMatch = '';
  let bestDist = Infinity;

  for (const proc of PROCEDURE_NAMES) {
    const dist = editDistance(word, proc);
    // 짧은 단어(2-3자)는 거리 1까지, 긴 단어(4자+)는 거리 2까지 허용
    const maxDist = word.length <= 3 ? 1 : 2;
    if (dist <= maxDist && dist > 0 && dist < bestDist) {
      bestDist = dist;
      bestMatch = proc;
    }
  }

  return bestMatch || null;
}

// 슬라이딩 윈도우 역보정
// 새 세그먼트가 들어오면, 이전 세그먼트들의 오인식을 문맥으로 교정
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
    if (recentText.includes(proc)) {
      confirmedProcedures.push(proc);
    }
  }

  if (confirmedProcedures.length === 0) return [];

  // 이전 세그먼트들에서 오인식 찾아서 역보정
  const checkRange = segments.slice(Math.max(0, segments.length - windowSize - 2), -1);
  for (const seg of checkRange) {
    let corrected = seg.text;
    let changed = false;

    // 오인식 사전에서 확인된 시술명과 매칭되는 것 교정
    for (const [wrong, right] of Object.entries(KNOWN_MISRECOGNITIONS)) {
      if (right && corrected.includes(wrong) && confirmedProcedures.includes(right)) {
        corrected = corrected.replaceAll(wrong, right);
        changed = true;
      }
    }

    // 편집 거리 기반 역보정 (단어 단위)
    const words = corrected.split(/(\s+)/);
    const newWords = words.map(word => {
      if (word.trim().length < 2 || /^\s+$/.test(word)) return word;
      if (PROCEDURE_NAMES.includes(word)) return word;
      for (const proc of confirmedProcedures) {
        const dist = editDistance(word, proc);
        if (dist > 0 && dist <= 2 && word.length >= 2) {
          changed = true;
          return proc;
        }
      }
      return word;
    });

    if (changed) {
      corrections.push({ id: seg.id, corrected: newWords.join('') });
    }
  }

  return corrections;
}

// 텍스트에서 유사도 기반 시술명 일괄 교정
export function correctBySimilarity(text: string): string {
  const words = text.split(/(\s+)/); // 공백 유지하면서 분리
  return words.map(word => {
    if (word.trim().length < 2) return word;
    if (/^\s+$/.test(word)) return word;

    const similar = findSimilarProcedure(word.trim());
    if (similar) return similar;
    return word;
  }).join('');
}
