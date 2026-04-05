// ─── Procedure Hub 연동 모듈 ───
// GitHub Raw URL에서 프로시져 허브 데이터를 가져오는 유틸리티
// 배포/서버 불필요 — git push만 하면 자동 반영

const BASE_URL = "https://raw.githubusercontent.com/dr-jinlee/Procedure-Hub/main/src/data";

// 캐시 (같은 세션에서 중복 요청 방지)
const cache: Record<string, { data: unknown; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5분

async function fetchWithCache<T>(path: string): Promise<T> {
  const url = `${BASE_URL}/${path}`;
  const now = Date.now();

  // 캐시 히트
  if (cache[path] && now - cache[path].timestamp < CACHE_TTL) {
    return cache[path].data as T;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Procedure Hub fetch 실패: ${res.status} ${path}`);
  const data = await res.json();

  cache[path] = { data, timestamp: now };
  return data as T;
}

// ─── 타입 정의 ───

export interface Product {
  name: string;
  name_en: string;
  manufacturer: string;
  country: string;
  mfds?: boolean;
  type?: string;
  ingredient?: string;
  material?: string;
  note?: string;
}

export interface ExtractedData {
  overview?: string;
  mechanism?: string;
  indications?: { primary?: string[]; extended?: string[] };
  contraindications?: { absolute?: string[]; relative?: string[] };
  safety?: { common?: string[]; uncommon?: string[]; serious?: string[] };
  onset_duration?: { onset?: string; peak?: string; duration?: string };
  aftercare?: string[];
  related_techniques?: string[];
}

export interface TaxonomyItem {
  id?: string;
  name: string;
  detail: string;
}

export interface TaxonomySubcategory {
  id: string;
  label: string;
  items?: TaxonomyItem[];
}

export interface TaxonomyCategory {
  id: string;
  category: string;
  category_en: string;
  group?: string;
  subcategories: TaxonomySubcategory[];
  extracted?: ExtractedData;
  products?: Product[];
}

export interface TaxonomyData {
  modality: TaxonomyCategory[];
  problem: TaxonomyCategory[];
}

export interface SynergyLink {
  from: string;
  to: string;
  type: "함께" | "다음에" | "대신";
  reason: string;
  timing: string;
  target: string;
}

export interface Combo {
  name: string;
  combo: string[];
  reason: string;
  evidence: string;
}

export interface Procedure {
  name: string;
  category: string;
  role: string;
  products: string[];
}

export interface Complaint {
  cc: string;
  cc_detail: string;
  cc_group: string | null;
  procedures: Procedure[];
  combos: Combo[];
  alternatives: string[];
}

export interface ProblemPackage {
  problem_id: string;
  problem: string;
  complaints: Complaint[];
}

// ─── API 함수들 ───

/** 전체 시술 분류 데이터 (Modality 17개 + Problem 14개) */
export async function getTaxonomy(): Promise<TaxonomyData> {
  return fetchWithCache<TaxonomyData>("taxonomy.json");
}

/** 제품-제조사 매핑 (60개) */
export async function getProducts(): Promise<Record<string, { products: Product[] }>> {
  return fetchWithCache("products.json");
}

/** 시너지 링크 (116개) */
export async function getSynergyLinks(): Promise<SynergyLink[]> {
  const data = await fetchWithCache<{ links: SynergyLink[] }>("synergy.json");
  return data.links;
}

/** 고민별 상담 패키지 (14개 Problem, 117개 CC) */
export async function getProblemPackages(): Promise<ProblemPackage[]> {
  const data = await fetchWithCache<{ problems: ProblemPackage[] }>("problem-packages.json");
  return data.problems;
}

// ─── 편의 함수들 ───

/** 시술명으로 카테고리 찾기 */
export async function findProcedure(name: string): Promise<TaxonomyCategory | null> {
  const tax = await getTaxonomy();
  for (const cat of tax.modality) {
    for (const sub of cat.subcategories) {
      if (sub.items?.some(item => item.name.includes(name))) {
        return cat;
      }
    }
  }
  return null;
}

/** 고민(CC)으로 추천 시술 조합 찾기 */
export async function findRecommendations(complaint: string): Promise<Complaint | null> {
  const packages = await getProblemPackages();
  for (const problem of packages) {
    for (const cc of problem.complaints) {
      if (cc.cc.includes(complaint) || cc.cc_detail.includes(complaint)) {
        return cc;
      }
    }
  }
  return null;
}

/** 키워드로 전체 검색 (시술명, CC, 제품명 모두) */
export async function searchAll(keyword: string): Promise<{
  procedures: TaxonomyItem[];
  complaints: Complaint[];
  products: Product[];
}> {
  const q = keyword.toLowerCase();
  const [tax, packages, productsData] = await Promise.all([
    getTaxonomy(),
    getProblemPackages(),
    getProducts(),
  ]);

  // 시술 검색
  const procedures: TaxonomyItem[] = [];
  for (const cat of [...tax.modality, ...tax.problem]) {
    for (const sub of cat.subcategories) {
      for (const item of sub.items || []) {
        if (item.name.toLowerCase().includes(q)) {
          procedures.push(item);
        }
      }
    }
  }

  // CC 검색
  const complaints: Complaint[] = [];
  for (const problem of packages) {
    for (const cc of problem.complaints) {
      if (cc.cc.toLowerCase().includes(q) || cc.cc_detail.toLowerCase().includes(q)) {
        complaints.push(cc);
      }
    }
  }

  // 제품 검색
  const products: Product[] = [];
  for (const catData of Object.values(productsData)) {
    if (typeof catData === "object" && catData !== null && "products" in catData) {
      for (const prod of (catData as { products: Product[] }).products) {
        if (prod.name.toLowerCase().includes(q) || prod.name_en?.toLowerCase().includes(q)) {
          products.push(prod);
        }
      }
    }
  }

  return { procedures, complaints, products };
}
