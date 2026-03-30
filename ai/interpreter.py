"""
통역 모듈
실시간 다국어 번역 (의학 맥락 기반)
"""
import os
import anthropic

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

INTERPRETER_SYSTEM = """당신은 미용 클리닉(피부과) 전문 의료 통역사입니다.

## 통역 원칙
1. 단순 직역이 아닌 의미 기반 통역
2. 의학/시술 용어는 해당 언어에서 통용되는 표현으로 자연스럽게 변환
3. 고객에게 전달할 때는 쉽고 친절한 어조 유지
4. 의사에게 전달할 때는 전문 용어 포함 가능
5. 수치/용량은 정확하게 유지 (20유닛, 1cc 등)

## 용어 변환 예시 (한→영)
- 보톡스 → Botox
- 필러 → dermal filler
- 팔자주름 → nasolabial folds / smile lines
- 기미 → melasma / dark spots (환자용)
- 피코토닝 → Pico laser toning
- 울쎄라 → Ultherapy
- 인모드 → InMode
- 리쥬란 → Rejuran
- 연고마취 → numbing cream / topical anesthesia

## 용어 변환 예시 (한→중)
- 보톡스 → 肉毒素/瘦脸针
- 필러 → 玻尿酸填充
- 팔자주름 → 法令纹
- 기미 → 黄褐斑
- 피코토닝 → 皮秒激光

## 용어 변환 예시 (한→일)
- 보톡스 → ボトックス
- 필러 → ヒアルロン酸フィラー
- 팔자주름 → ほうれい線
- 기미 → 肝斑(かんぱん)
"""

SUPPORTED_LANGUAGES = {
    "en": "영어 (English)",
    "zh": "중국어 (中文)",
    "ja": "일본어 (日本語)",
    "vi": "베트남어 (Tiếng Việt)",
    "ko": "한국어",
}


def translate(text, source_lang, target_lang, speaker_role="doctor", custom_prompt=None):
    """
    텍스트 번역

    Args:
        text: 번역할 텍스트
        source_lang: 원본 언어 코드 (ko, en, zh, ja, vi, mixed)
        target_lang: 대상 언어 코드
        speaker_role: 발화자 역할 (doctor/patient) - 어조 조절용
        custom_prompt: 커스텀 번역 지시 (이중언어 등)

    Returns:
        {"translation": 번역 결과, "source_lang": 원본 언어, "target_lang": 대상 언어}
    """
    if source_lang == target_lang:
        return {"translation": text, "source_lang": source_lang, "target_lang": target_lang}

    # 이중언어 커스텀 프롬프트
    if custom_prompt:
        user_content = f"""{custom_prompt}

텍스트:
{text}

결과만 출력하세요."""
    else:
        source_name = SUPPORTED_LANGUAGES.get(source_lang, source_lang)
        target_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)

        if speaker_role == "doctor":
            tone_instruction = "의사가 환자에게 설명하는 것이므로, 쉽고 친절한 어조로 번역하세요."
        else:
            tone_instruction = "환자가 의사에게 말하는 것이므로, 의사가 이해하기 쉽도록 의학 용어를 포함해서 번역하세요."

        user_content = f"""다음 {source_name} 텍스트를 {target_name}로 통역하세요.
{tone_instruction}

번역할 텍스트: {text}

번역 결과만 출력하세요. 추가 설명은 필요 없습니다."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=INTERPRETER_SYSTEM,
        messages=[{"role": "user", "content": user_content}],
    )

    return {
        "translation": response.content[0].text.strip(),
        "source_lang": source_lang,
        "target_lang": target_lang,
    }


def translate_chart(chart_text, target_lang):
    """
    완성된 차트를 다른 언어로 번역
    (외국인 환자에게 차트 사본을 줄 때 사용)
    """
    target_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=INTERPRETER_SYSTEM,
        messages=[{
            "role": "user",
            "content": f"""다음 미용 클리닉 상담 차트를 {target_name}로 번역하세요.
양식 구조(제목, 구분선, 기호 등)는 유지하고 내용만 번역하세요.
시술명은 해당 언어에서 통용되는 이름을 사용하세요.

{chart_text}"""
        }],
    )

    return response.content[0].text
