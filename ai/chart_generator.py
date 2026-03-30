"""
차트 생성 모듈
Claude API를 사용하여 상담 텍스트를 구조화된 차트로 변환
"""
import os
import json
import anthropic
from datetime import datetime

# 스타일별 모델/토큰 설정 (요약형·절충형은 Haiku로 속도 향상)
STYLE_CONFIG = {
    "detailed": {"model": "claude-sonnet-4-20250514", "max_tokens": 4096},
    "balanced": {"model": "claude-haiku-4-5-20251001", "max_tokens": 2048},
    "summary":  {"model": "claude-haiku-4-5-20251001", "max_tokens": 1024},
}

api_key = os.getenv("ANTHROPIC_API_KEY", "")
if not api_key or api_key == "sk-ant-xxxxx":
    print("[Chart] ⚠️  ANTHROPIC_API_KEY가 설정되지 않았습니다!")
    print("[Chart]    .env 파일에 실제 API 키를 입력해주세요.")

client = anthropic.Anthropic(api_key=api_key)


def load_terminology():
    """용어 사전 JSON을 읽어서 시스템 프롬프트용 텍스트로 변환"""
    terminology_path = os.path.join(os.path.dirname(__file__), "terminology", "dermatology_ko.json")
    try:
        with open(terminology_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return ""

    sections = []

    # 시술 용어
    if "procedures" in data:
        proc_lines = []
        for category, items in data["procedures"].items():
            names = [f"{item['term']}({item['formal']})" for item in items]
            proc_lines.append(f"  - {category}: {', '.join(names)}")
        sections.append("### 시술 용어 사전\n" + "\n".join(proc_lines))

    # 부위 용어
    if "areas" in data:
        area_lines = []
        for region, items in data["areas"].items():
            names = [item["term"] for item in items]
            area_lines.append(f"  - {region}: {', '.join(names)}")
        sections.append("### 시술 부위\n" + "\n".join(area_lines))

    # 증상/고민 용어
    if "conditions" in data:
        cond_lines = []
        for category, items in data["conditions"].items():
            names = [f"{item['term']}({item['formal']})" for item in items]
            cond_lines.append(f"  - {category}: {', '.join(names)}")
        sections.append("### 피부 고민/증상 용어\n" + "\n".join(cond_lines))

    # 부작용 용어
    if "side_effects" in data:
        se_lines = [f"  - {item['term']}({item['formal']})" for item in data["side_effects"]]
        sections.append("### 부작용/시술후 반응 용어\n" + "\n".join(se_lines))

    # 은어/줄임말
    if "slang" in data:
        slang_lines = []
        for category, items in data["slang"].items():
            for item in items:
                slang_lines.append(f"  - \"{item['slang']}\" = {item['meaning']}")
        sections.append("### 커뮤니티 은어/줄임말\n"
                        "고객이 커뮤니티(강남언니, 바비톡, 더쿠 등)에서 쓰는 표현입니다.\n"
                        + "\n".join(slang_lines))

    # 고객이 자주 쓰는 표현
    if "customer_expressions" in data:
        expr_lines = []
        for category, expressions in data["customer_expressions"].items():
            expr_lines.append(f"  [{category}]")
            for expr in expressions:
                expr_lines.append(f"    - \"{expr}\"")
        sections.append("### 고객이 상담에서 자주 쓰는 표현\n"
                        "이런 표현이 녹취에 나오면 해당 고민 카테고리로 분류하세요.\n"
                        + "\n".join(expr_lines))

    # 의료 약어
    if "medical_abbreviations" in data:
        abbr_lines = [f"  - {item['abbr']} = {item['meaning']}" for item in data["medical_abbreviations"]]
        sections.append("### 의료 약어\n" + "\n".join(abbr_lines))

    # STT 오인식 보정 매핑 (aliases → 정식 용어)
    corrections = []
    for category_data in [data.get("procedures", {}), data.get("conditions", {})]:
        for items in category_data.values():
            for item in items:
                if item.get("aliases"):
                    for alias in item["aliases"]:
                        corrections.append(f"  - \"{alias}\" → {item['term']}")
    # 부작용 aliases도 포함
    for item in data.get("side_effects", []):
        if item.get("aliases"):
            for alias in item["aliases"]:
                corrections.append(f"  - \"{alias}\" → {item['term']}")
    if corrections:
        sections.append("### 음성 인식(STT) 오인식 보정\n"
                        "아래는 고객이나 상담사가 자주 쓰는 줄임말/별칭입니다. "
                        "녹취에 이런 표현이 나오면 정식 용어로 이해하세요.\n"
                        + "\n".join(corrections))

    return "\n\n".join(sections)


# 용어 사전을 한 번만 로드
TERMINOLOGY_CONTEXT = load_terminology()


def load_clinic_pricing():
    """클리닉 가격 데이터를 읽어서 시스템 프롬프트용 텍스트로 변환"""
    pricing_path = os.path.join(os.path.dirname(__file__), "terminology", "clinic_pricing.json")
    try:
        with open(pricing_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return ""

    lines = []
    clinic_name = data.get("clinic_name", "").split("|")[0].strip()
    if clinic_name:
        lines.append(f"클리닉명: {clinic_name}")

    crawled_at = data.get("crawled_at", "")
    if crawled_at:
        lines.append(f"가격 기준일: {crawled_at[:10]}")

    # 시술별 가격 정리 (이름이 있고 가격이 있는 항목만)
    seen = set()
    for proc in data.get("procedures", []):
        name = proc.get("name", "").strip()
        price = proc.get("current_price", 0)
        # 이름이 가격만인 항목이나 너무 짧은 항목 제외
        if not name or price <= 0 or len(name) < 5:
            continue
        if name.replace(",", "").replace("원", "").strip().isdigit():
            continue
        # 대괄호로 시작하는 카테고리만 있는 항목 제외
        if name.startswith("[") and "원" in name:
            continue
        key = f"{name[:30]}_{price}"
        if key in seen:
            continue
        seen.add(key)
        lines.append(f"  - {name[:80]}: {price:,}원")

    if len(lines) <= 2:
        return ""

    return "### 우리 클리닉 시술 및 가격\n" + "\n".join(lines)


CLINIC_PRICING_CONTEXT = load_clinic_pricing()


def load_taxonomy_context():
    """Procedure Hub taxonomy에서 시술 분류 컨텍스트 로드"""
    try:
        import urllib.request
        url = "https://raw.githubusercontent.com/dr-jinlee/Procedure-Hub/main/src/data/taxonomy.json"
        req = urllib.request.Request(url, headers={"User-Agent": "Charty/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        lines = ["### 시술 분류 체계 (Procedure Hub)"]
        for cat in data.get("modality", []):
            category = cat.get("category", "")
            subs = [s.get("label", "") for s in cat.get("subcategories", [])]
            prods = [p.get("name", "") for p in cat.get("products", [])[:5]]
            line = f"  - {category}: {', '.join(subs)}"
            if prods:
                line += f" (제품: {', '.join(prods)})"
            lines.append(line)

        print(f"[Chart] Taxonomy 컨텍스트 로드: {len(data.get('modality', []))}개 modality")
        return "\n".join(lines)
    except Exception as e:
        print(f"[Chart] Taxonomy 로드 실패: {e}")
        return ""


TAXONOMY_CONTEXT = load_taxonomy_context()

SYSTEM_PROMPT = f"""당신은 한국의 미용 클리닉(피부과/성형외과) 전문 상담 차트 작성 비서입니다.

## 클리닉 배경
- 이곳은 **미용 목적의 피부과/성형외과 클리닉**입니다
- 주요 시술: 보톡스, 필러, 리프팅(울쎄라/써마지/실리프팅), 레이저(토닝/IPL/피코), 스킨부스터(리쥬란/물광), 체형시술(지방분해/크라이오), 제모 등
- 고객은 질병 치료가 아닌 **외모 개선/안티에이징/피부 관리**를 위해 방문합니다
- 상담은 보통 "고객의 고민 청취 → 피부 상태 분석 → 시술 추천 → 결정"  순서로 진행됩니다
- 녹취에는 고객과 상담사(또는 원장)의 대화가 섞여 있을 수 있습니다

## 핵심 원칙
1. "환자"가 아니라 "고객"으로 인식 (단, 차트에는 의료 관행상 "환자"도 허용)
2. "증상/질환"이 아니라 "고민/희망사항"으로 표현
3. "치료"가 아니라 "시술/관리/프로그램"으로 표현
4. "진단"이 아니라 "피부 분석/현재 상태"로 표현
5. 고객이 말한 표현을 가능하면 살려서 기록 (큰따옴표로 구분)
6. 시술명은 클리닉에서 통용되는 이름 사용 (보톡스, 필러 등)
7. 고민별로 구분해서 추천 시술을 매칭

## 고민 카테고리
- 주름: 이마/미간/눈가/팔자/마리오넷/목주름/입술주름
- 탄력·처짐: 볼처짐/턱선/눈밑꺼짐/눈꺼풀처짐/전체 탄력 저하
- 색소: 기미/잡티/검버섯/주근깨/PIH/다크서클/칙칙한 피부톤
- 모공·피부결: 넓은 모공/블랙헤드/울퉁불퉁 피부결/여드름 흉터/모공각화증
- 트러블: 여드름(부위별)/좁쌀/낭종성/성인여드름/등여드름
- 홍조·혈관: 안면홍조/로제이시아/실핏줄/사과볼/민감성 피부
- 볼륨·윤곽: 이마/관자/애교살/턱끝/코/입술/볼/광대
- 체형·바디: 이중턱/팔뚝/복부/허벅지/브라라인/등살/셀룰라이트
- 제모: 겨드랑이/팔·다리/비키니/인중/구레나룻
- 기타: 흉터/튼살/다한증/문신제거/점제거/사마귀/한관종

{TERMINOLOGY_CONTEXT}

## 시술 결정 표기
- [O] 결정 (오늘 시술 또는 예약 확정)
- [△] 보류/검토 중
- [X] 안 함

## 중요: 안전 관련 항목은 반드시 포함
- 알러지 정보는 ⚠️로 강조
- 이전 시술에서 문제 발생한 건 ⚠️/❌로 표시하고 주의사항에 반영
- 복용 약물이 시술에 영향 주는 경우 명시

{CLINIC_PRICING_CONTEXT}

{TAXONOMY_CONTEXT}
"""

FIRST_VISIT_TEMPLATE = """## 출력 양식: 첫 방문 상담

아래 양식에 맞춰 상담 내용을 정리하세요. 정보가 없는 항목은 "미확인"으로 표시하세요.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 첫 방문 상담  |  {date}  |  담당: {consultant}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 핵심 요약
══════════════════════════════════════════
  고민: (주요 고민 키워드 나열)

  오늘 시술: (오늘 한 시술 + 핵심 스펙)
  예정: (확정된 다음 시술)
  보류: (결정 안 된 것)

  ⚠️ (알러지·주의사항·금기 - 매번 반복 표시)

■ 고객 프로필
══════════════════════════════════════════
  성별/연령:
  직업 참고:
  내원 경로:

■ 고객 성향  ⚠️ 상담 시 참고
══════════════════════════════════════════
  통증 민감도:  ★☆☆☆☆ ~ ★★★★★
  성격 유형:   (꼼꼼/즉흥적/예민/무관심 등)
  의사결정:    (즉시결정/비교후결정/타인상의)
  컴플레인 이력: 없음 / 있음 (상세)
  특이 메모:

■ 안전 체크  🚨
══════════════════════════════════════════
  알러지:
  복용약:
  기저질환:
  임신·수유:
  켈로이드:
  마취 반응:
  최근 시술 (4주 이내):

■ 이전 시술 이력 + 문제 이력
══════════════════════════════════════════
  시기 / 시술 / 부위 / 어디서 / 결과·문제
  -

  ⚠️ 반복 주의 사항:
  - (이전 문제에서 도출된 주의사항)

■ 고민 상담
══════════════════════════════════════════
  (고민별로 구분선으로 나누어 작성)

  고민 N: (고민 내용) [카테고리]
  ──────────────────────────────────────
  고객 표현: "(고객이 말한 그대로)"
  현재 상태: (객관적 분석)
  원하는 결과: (고객 희망)

  추천 시술: (시술명 + 스펙)
  제품 선택: (제품명)
  시술 방법: (니들/캐뉼라 등 + 이유)
  마취: (마취 방법 - 알러지 반영)
  기대효과: (효과 + 유지기간)
  주의: (이전 문제이력 반영한 주의사항)

■ 시술 결정
══════════════════════════════════════════
  시술 / 결정 / 비고
  - (시술명) [O] (비고)
  - (시술명) [△] (비고)
  - (시술명) [X] (비고)

■ 오늘 시술 기록 (시술한 경우)
══════════════════════════════════════════
  시술:
  부위:
  용량/세팅:
  방법:
  마취:
  시술자:
  특이사항:

■ 시술 후 안내 (고객 전달 완료 ✔)
══════════════════════════════════════════
  ✔ (안내 항목들)

■ 다음 일정
══════════════════════════════════════════
  -

■ 내부 메모 (차트 복사 시 제외 가능)
══════════════════════════════════════════
  -
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
"""

REVISIT_TEMPLATE = """## 출력 양식: 재방문 상담

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 재방문 상담  |  {date}  |  담당: {consultant}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 핵심 요약
══════════════════════════════════════════
  이전 경과: (지난 시술 결과 한 줄 요약)

  오늘 고민: (오늘 상담한 고민 키워드)
  오늘 시술: (오늘 한 시술 + 핵심 스펙)
  보류: (결정 안 된 것)

  ⚠️ (알러지·주의사항 - 매번 반복 표시)

  다음 내원: (가장 가까운 예약)

■ 고객 요약 (이전 차트 기반)
══════════════════════════════════════════
  성별/연령:
  성향: 통증 민감도(★N), 성격, 의사결정 스타일
  알러지:
  주의: (이전 문제이력 요약)

■ 이전 시술 경과 확인
══════════════════════════════════════════
  (날짜) (시술명) 경과
  - (경과 항목들)
  - 만족도: (매우만족/만족/보통/불만)
  - 문제: 없음 / (문제 상세)

■ 오늘 고민
══════════════════════════════════════════
  (고민별 구분선으로 나누어 작성 - 첫 방문과 동일 구조)

■ 시술 결정 / 오늘 시술 기록 / 시술 후 안내 / 다음 일정 / 내부 메모
  (첫 방문과 동일 구조)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
"""



# ─── 절충형 템플릿 ───
BALANCED_FIRST_VISIT = """## 출력 양식: 첫 방문 상담 (절충형)

핵심 정보 위주로 간결하게 정리하되, 고민별 시술 추천은 유지하세요.
정보가 없는 항목은 생략하세요 ("미확인"으로 채우지 마세요).

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 첫 방문 상담  |  {date}  |  담당: {consultant}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 핵심 요약
══════════════════════════════════════════
  고민: (주요 고민 키워드)
  오늘 시술: (시술명 + 스펙)
  예정/보류: (있으면 기재)
  ⚠️ (알러지·주의사항)

■ 고객 정보
══════════════════════════════════════════
  성별/연령:
  성향: 통증 민감도(★N), 의사결정 스타일
  안전: 알러지 / 복용약 / 켈로이드 (해당사항만)

■ 고민 및 시술
══════════════════════════════════════════
  (고민별로 구분선으로 나누어 작성)

  고민 N: (고민 내용)
  ──────────────────────────────────────
  고객: "(핵심 표현)"
  추천: (시술명 + 스펙 + 제품)
  결정: [O]/[△]/[X] (비고)

■ 오늘 시술 기록 (시술한 경우)
══════════════════════════════════════════
  시술/부위/용량/마취/시술자

■ 다음 일정
══════════════════════════════════════════
  -

■ 내부 메모 (차트 복사 시 제외 가능)
══════════════════════════════════════════
  -
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
"""

BALANCED_REVISIT = """## 출력 양식: 재방문 상담 (절충형)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 재방문 상담  |  {date}  |  담당: {consultant}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 핵심 요약
══════════════════════════════════════════
  이전 경과: (한 줄 요약)
  오늘 시술: (시술명 + 스펙)
  ⚠️ (주의사항)

■ 이전 시술 경과
══════════════════════════════════════════
  (시술명) → 만족도 / 문제 유무

■ 오늘 고민 및 시술
══════════════════════════════════════════
  (절충형 첫 방문과 동일 구조)

■ 다음 일정 / 내부 메모
  (동일)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
"""

# ─── 요약형 템플릿 ───
SUMMARY_FIRST_VISIT = """## 출력 양식: 첫 방문 상담 (요약형)

최대한 짧고 간결하게 정리하세요. 불필요한 섹션은 전부 생략하세요.
핵심만 빠르게 파악할 수 있도록 해주세요.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 상담 요약  |  {date}  |  담당: {consultant}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 요약
══════════════════════════════════════════
  고객: 성별/연령
  고민: (키워드 나열)
  ⚠️ 안전: (알러지/주의사항 - 있는 경우만)

■ 시술 결정
══════════════════════════════════════════
  - (시술명) [O/△/X] (부위, 스펙, 비고)

■ 오늘 시술 (시술한 경우)
══════════════════════════════════════════
  (시술/부위/용량 한 줄로)

■ 다음: (일정)
■ 메모: (내부 참고사항)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
"""

SUMMARY_REVISIT = """## 출력 양식: 재방문 상담 (요약형)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 재방문 요약  |  {date}  |  담당: {consultant}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 요약
══════════════════════════════════════════
  이전: (지난 시술 결과 한 줄)
  오늘 고민: (키워드)
  ⚠️ 안전: (주의사항)

■ 시술 결정
══════════════════════════════════════════
  - (시술명) [O/△/X] (비고)

■ 오늘 시술 (시술한 경우)
══════════════════════════════════════════
  (한 줄 요약)

■ 다음: (일정)
■ 메모: (내부 참고사항)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
"""


def generate_chart(transcript, customer_profile=None, consultation_type="auto", consultant="", chart_style="detailed"):
    """
    상담 텍스트를 차트로 변환

    Args:
        transcript: 화자 분리된 전체 상담 텍스트
        customer_profile: 기존 고객 정보 (재방문 시)
        consultation_type: auto / first_visit / revisit
        consultant: 담당 원장/상담사 이름
        chart_style: detailed / balanced / summary

    Returns:
        {"chart": 완성된 차트, "summary": 핵심 요약}
    """
    today = datetime.now().strftime("%Y.%m.%d")

    # 상담 유형 자동 판별
    if consultation_type == "auto":
        if customer_profile and customer_profile.get("consultations"):
            consultation_type = "revisit"
        else:
            consultation_type = "first_visit"

    # 템플릿 선택 (스타일 × 방문유형)
    templates = {
        "detailed": (FIRST_VISIT_TEMPLATE, REVISIT_TEMPLATE),
        "balanced": (BALANCED_FIRST_VISIT, BALANCED_REVISIT),
        "summary":  (SUMMARY_FIRST_VISIT, SUMMARY_REVISIT),
    }
    first_tmpl, revisit_tmpl = templates.get(chart_style, templates["detailed"])

    if consultation_type == "revisit":
        template_text = revisit_tmpl.format(date=today, consultant=consultant or "미지정")
    else:
        template_text = first_tmpl.format(date=today, consultant=consultant or "미지정")

    # 고객 이력 정보 구성
    context_parts = []
    if customer_profile:
        if customer_profile.get("traits"):
            traits = customer_profile["traits"]
            context_parts.append(f"[고객 성향] 통증민감도: {traits.get('pain_sensitivity', '미확인')}/5, "
                               f"성격: {traits.get('personality', '미확인')}, "
                               f"의사결정: {traits.get('decision_style', '미확인')}")

        if customer_profile.get("safety"):
            safety = customer_profile["safety"]
            context_parts.append(f"[안전정보] 알러지: {safety.get('allergies', '없음')}, "
                               f"복용약: {safety.get('medications', '없음')}, "
                               f"켈로이드: {'있음' if safety.get('keloid_tendency') else '없음'}")

        if customer_profile.get("warnings"):
            warnings = customer_profile["warnings"]
            warning_texts = [f"- {w['procedure_name']}({w['area']}): {w['warning_note']}" for w in warnings]
            context_parts.append(f"[⚠️ 주의 시술 이력]\n" + "\n".join(warning_texts))

        if customer_profile.get("procedures"):
            procs = customer_profile["procedures"][:10]  # 최근 10개
            proc_texts = [f"- {p['procedure_date']} {p['procedure_name']}({p['area']}) @ {p['clinic']} → {p['result_icon']} {p['result']}"
                         for p in procs]
            context_parts.append(f"[시술 이력]\n" + "\n".join(proc_texts))

    customer_context = "\n\n".join(context_parts) if context_parts else "신규 고객 (이전 이력 없음)"

    # Claude API 호출
    user_message = f"""다음 상담 녹취를 아래 양식에 맞춰 차트로 정리해주세요.

## 기존 고객 정보
{customer_context}

## 상담 녹취 원문
{transcript}

{template_text}

중요:
- 녹취에 언급되지 않은 정보는 "미확인"으로 표시하세요
- 고객이 한 말은 큰따옴표로 원문 그대로 기록하세요
- 이전 시술에서 문제가 있었던 경우 추천 시술에 반드시 반영하세요
- 알러지/약물 정보는 시술 방법·마취 선택에 반드시 반영하세요
- 핵심 요약의 ⚠️ 경고에 알러지·주의사항을 반드시 포함하세요
"""

    config = STYLE_CONFIG.get(chart_style, STYLE_CONFIG["detailed"])
    print(f"[Chart] 모델: {config['model']}, 최대 토큰: {config['max_tokens']}")

    response = client.messages.create(
        model=config["model"],
        max_tokens=config["max_tokens"],
        system=[{
            "type": "text",
            "text": SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"}
        }],
        messages=[{"role": "user", "content": user_message}],
    )

    chart_text = response.content[0].text

    # 핵심 요약 추출 (차트에서 ■ 핵심 요약 블록)
    summary = extract_summary(chart_text)

    return {
        "chart": chart_text,
        "summary": summary,
    }


def generate_chart_stream(transcript, customer_profile=None, consultation_type="auto", consultant="", chart_style="detailed"):
    """
    스트리밍 차트 생성 — 청크 단위로 yield
    프론트엔드에서 차트가 실시간으로 나타남
    """
    today = datetime.now().strftime("%Y.%m.%d")

    if consultation_type == "auto":
        if customer_profile and customer_profile.get("consultations"):
            consultation_type = "revisit"
        else:
            consultation_type = "first_visit"

    templates = {
        "detailed": (FIRST_VISIT_TEMPLATE, REVISIT_TEMPLATE),
        "balanced": (BALANCED_FIRST_VISIT, BALANCED_REVISIT),
        "summary":  (SUMMARY_FIRST_VISIT, SUMMARY_REVISIT),
    }
    first_tmpl, revisit_tmpl = templates.get(chart_style, templates["detailed"])

    if consultation_type == "revisit":
        template_text = revisit_tmpl.format(date=today, consultant=consultant or "미지정")
    else:
        template_text = first_tmpl.format(date=today, consultant=consultant or "미지정")

    context_parts = []
    if customer_profile:
        if customer_profile.get("traits"):
            traits = customer_profile["traits"]
            context_parts.append(f"[고객 성향] 통증민감도: {traits.get('pain_sensitivity', '미확인')}/5, "
                               f"성격: {traits.get('personality', '미확인')}, "
                               f"의사결정: {traits.get('decision_style', '미확인')}")
        if customer_profile.get("safety"):
            safety = customer_profile["safety"]
            context_parts.append(f"[안전정보] 알러지: {safety.get('allergies', '없음')}, "
                               f"복용약: {safety.get('medications', '없음')}, "
                               f"켈로이드: {'있��' if safety.get('keloid_tendency') else '없음'}")
        if customer_profile.get("warnings"):
            warnings = customer_profile["warnings"]
            warning_texts = [f"- {w['procedure_name']}({w['area']}): {w['warning_note']}" for w in warnings]
            context_parts.append("[⚠️ 주의 시술 이력]\n" + "\n".join(warning_texts))
        if customer_profile.get("procedures"):
            procs = customer_profile["procedures"][:10]
            proc_texts = [f"- {p['procedure_date']} {p['procedure_name']}({p['area']}) @ {p['clinic']} → {p['result_icon']} {p['result']}"
                         for p in procs]
            context_parts.append("[시술 이력]\n" + "\n".join(proc_texts))

    customer_context = "\n\n".join(context_parts) if context_parts else "신규 고객 (이전 이력 없음)"

    user_message = f"""다음 상담 녹취를 아래 양식에 맞춰 차트로 정리해주세요.

## 기존 고객 정보
{customer_context}

## 상담 녹취 원문
{transcript}

{template_text}

중요:
- 녹취에 언급되지 않은 정보는 "미확인"으로 표시하세요
- 고객이 한 말은 큰따옴표로 원문 그대로 기록하세요
- 이전 시술에서 문제가 있었던 경우 추천 시술에 반드시 반영하세요
- 알러지/약물 정보는 시술 방법·마취 선택에 반드시 반영하세��
- 핵심 요약의 ⚠️ 경고에 알러지·주의사항을 반드시 포함하세요
"""

    config = STYLE_CONFIG.get(chart_style, STYLE_CONFIG["detailed"])
    print(f"[Chart Stream] 모델: {config['model']}, 최대 토큰: {config['max_tokens']}")

    with client.messages.stream(
        model=config["model"],
        max_tokens=config["max_tokens"],
        system=[{
            "type": "text",
            "text": SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"}
        }],
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        for text in stream.text_stream:
            yield text


def extract_summary(chart_text):
    """차트에서 핵심 요약 블록 추출"""
    lines = chart_text.split("\n")
    in_summary = False
    summary_lines = []

    for line in lines:
        if "■ 핵심 요약" in line:
            in_summary = True
            continue
        if in_summary:
            # 다음 ■ 섹션이 시작되면 종료
            if line.strip().startswith("■"):
                break
            # 구분선 건너뛰기
            stripped = line.strip()
            if stripped and all(c in '═─━' for c in stripped):
                continue
            if stripped:
                summary_lines.append(stripped)

    return "\n".join(summary_lines)
