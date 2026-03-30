"""
TTS (Text-to-Speech) 모듈
통역 결과를 음성으로 변환
"""
import io
import base64

class TTSEngine:
    """
    TTS 엔진 (추후 확장용 인터페이스)

    현재: 브라우저 Web Speech API 사용 (서버 TTS 불필요)
    추후: 로컬 TTS 모델 (Coqui TTS, Piper 등) 추가 가능
    """

    def __init__(self, engine="browser"):
        """
        engine:
        - "browser": 프론트엔드 Web Speech API 사용 (기본값)
        - "local": 로컬 TTS 모델 사용 (추후)
        """
        self.engine = engine
        self.local_model = None

        if engine == "local":
            self._load_local_model()

    def _load_local_model(self):
        """로컬 TTS 모델 로드 (추후 구현)"""
        try:
            # Piper TTS 등 로컬 모델 로드
            print("[TTS] 로컬 TTS 모델은 추후 지원 예정입니다")
            print("[TTS] 브라우저 Web Speech API를 사용합니다")
            self.engine = "browser"
        except Exception as e:
            print(f"[TTS] 로컬 모델 로드 실패: {e}")
            self.engine = "browser"

    def synthesize(self, text, lang="ko"):
        """
        텍스트를 음성으로 변환

        브라우저 모드: 텍스트와 언어 정보만 반환 (프론트에서 처리)
        로컬 모드: base64 인코딩된 오디오 반환
        """
        if self.engine == "browser":
            return {
                "mode": "browser",
                "text": text,
                "lang": lang,
            }

        # 로컬 TTS (추후 구현)
        return {
            "mode": "browser",
            "text": text,
            "lang": lang,
        }
