-- 고객 프로필
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT,
  gender TEXT,                    -- M / F
  birth_year INTEGER,
  phone TEXT,
  visit_source TEXT,              -- 내원 경로 (인스타, 지인소개, 네이버 등)
  occupation TEXT,                -- 직업 참고
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 고객 성향 (누적 업데이트)
CREATE TABLE IF NOT EXISTS customer_traits (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  pain_sensitivity INTEGER DEFAULT 3,   -- 통증 민감도 1~5
  personality TEXT,                      -- 성격 유형 (꼼꼼, 즉흥적, 예민 등)
  decision_style TEXT,                   -- 의사결정 스타일
  complaint_history TEXT,               -- 컴플레인 이력
  notes TEXT,                           -- 특이 메모
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 안전 체크 (알러지, 복용약 등)
CREATE TABLE IF NOT EXISTS safety_info (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  allergies TEXT,                 -- 알러지 목록 (JSON 배열)
  medications TEXT,               -- 복용약 목록 (JSON 배열)
  conditions TEXT,                -- 기저질환 (JSON 배열)
  pregnancy_status TEXT,          -- 임신/수유 상태
  keloid_tendency BOOLEAN DEFAULT 0,
  anesthesia_notes TEXT,          -- 마취 관련 메모
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 시술 이력
CREATE TABLE IF NOT EXISTS procedure_history (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  procedure_date DATE,
  procedure_name TEXT,            -- 시술명
  area TEXT,                      -- 부위
  detail TEXT,                    -- 제품명, 용량 등 상세
  clinic TEXT,                    -- 시술 장소 (본원/타원명)
  practitioner TEXT,              -- 시술자
  result TEXT,                    -- 결과 (만족/불만/문제)
  result_icon TEXT,               -- ✅ / ⚠️ / ❌
  problem_notes TEXT,             -- 문제 발생 시 상세
  is_warning BOOLEAN DEFAULT 0,  -- 주의 필요 시술인지
  warning_note TEXT,              -- 주의 사항 메모
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 상담 세션
CREATE TABLE IF NOT EXISTS consultations (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  consultant TEXT,                -- 담당 원장/상담사
  consultation_type TEXT,         -- first_visit / revisit / simple
  mode TEXT DEFAULT 'standard',   -- standard / interpret
  target_lang TEXT,               -- 통역 대상 언어
  raw_transcript TEXT,            -- 원본 텍스트 전체
  chart_output TEXT,              -- 생성된 차트
  summary TEXT,                   -- 핵심 요약
  recording_path TEXT,            -- 녹음 파일 경로
  duration_seconds INTEGER,       -- 상담 시간
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 상담 내 고민 항목
CREATE TABLE IF NOT EXISTS consultation_concerns (
  id TEXT PRIMARY KEY,
  consultation_id TEXT NOT NULL,
  category TEXT,                  -- 대분류 (주름, 탄력, 색소 등)
  subcategory TEXT,               -- 세부 (팔자, 이마 등)
  customer_expression TEXT,       -- 고객 표현 그대로
  current_status TEXT,            -- 현재 상태
  desired_result TEXT,            -- 원하는 결과
  recommended_procedure TEXT,     -- 추천 시술
  recommendation_detail TEXT,     -- 추천 상세
  expected_effect TEXT,           -- 기대 효과
  decision TEXT DEFAULT 'pending', -- decided / pending / rejected
  decision_note TEXT,             -- 결정 관련 메모
  FOREIGN KEY (consultation_id) REFERENCES consultations(id)
);

-- 차트 양식 템플릿
CREATE TABLE IF NOT EXISTS chart_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template_type TEXT,             -- first_visit / revisit / simple
  template_content TEXT,          -- 양식 내용
  is_default BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 커스텀 용어 사전
CREATE TABLE IF NOT EXISTS terminology (
  id TEXT PRIMARY KEY,
  category TEXT,                  -- procedure / product / area / condition
  term TEXT NOT NULL,             -- 용어
  aliases TEXT,                   -- 별칭들 (JSON 배열)
  formal_name TEXT,               -- 정식 명칭
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_procedure_history_customer ON procedure_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_consultations_customer ON consultations(customer_id);
CREATE INDEX IF NOT EXISTS idx_consultation_concerns_consultation ON consultation_concerns(consultation_id);
CREATE INDEX IF NOT EXISTS idx_terminology_term ON terminology(term);
