"""
STT (Speech-to-Text) 모듈
faster-whisper를 사용한 로컬 음성 인식
"""
import os
import json
import struct
import threading
import numpy as np
import soundfile as sf
import io
import base64
from faster_whisper import WhisperModel

TERMINOLOGY_PATH = os.path.join(os.path.dirname(__file__), "terminology", "dermatology_ko.json")


def load_whisper_hints():
    try:
        with open(TERMINOLOGY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("whisper_hints", "")
    except FileNotFoundError:
        return ""


class STTEngine:
    def __init__(self, model_size="medium", device="cpu", compute_type="int8"):
        if device == "cuda":
            compute_type = "float16"

        print(f"[STT] Whisper 모델 로딩: {model_size} ({device}/{compute_type})")
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)
        self.hints = load_whisper_hints()
        print(f"[STT] 모델 로딩 완료")
        print(f"[STT] 힌트 용어 길이: {len(self.hints)} chars")

        # 세션별 데이터
        self.sessions = {}
        # 세션별 락 (동시 처리 방지)
        self.locks = {}

    def init_session(self, session_id):
        self.sessions[session_id] = {
            "audio_chunks": [],     # float32 numpy 배열 목록
            "total_samples": 0,
            "last_processed_end": 0,  # 마지막으로 처리 완료된 샘플 위치
            "all_results": [],        # 지금까지의 모든 확정 텍스트
            "sample_rate": 16000,
            "is_processing": False,   # 현재 STT 처리 중인지
        }
        self.locks[session_id] = threading.Lock()
        print(f"[STT] 세션 초기화: {session_id}")

    def add_chunk(self, session_id, audio_base64):
        """
        오디오 청크 추가.
        이미 처리 중이면 버퍼에만 쌓고 스킵.
        처리 중이 아니면 미처리 구간 전체를 한번에 STT.
        """
        if session_id not in self.sessions:
            self.init_session(session_id)

        sess = self.sessions[session_id]
        sr = sess["sample_rate"]

        # base64 → float32 numpy
        raw_bytes = base64.b64decode(audio_base64)
        num_floats = len(raw_bytes) // 4
        if num_floats == 0:
            return {"partial": None, "final": None, "lang": "ko"}

        audio_array = np.frombuffer(raw_bytes[:num_floats * 4], dtype=np.float32).copy()
        sess["audio_chunks"].append(audio_array)
        sess["total_samples"] += len(audio_array)

        unprocessed = sess["total_samples"] - sess["last_processed_end"]
        unprocessed_sec = unprocessed / sr

        # 3초 미만이면 아직 모음
        if unprocessed_sec < 3.0:
            return {"partial": None, "final": None, "lang": "ko"}

        # 이미 처리 중이면 스킵 (중복 방지)
        lock = self.locks[session_id]
        if not lock.acquire(blocking=False):
            return {"partial": None, "final": None, "lang": "ko"}

        try:
            if sess["is_processing"]:
                return {"partial": None, "final": None, "lang": "ko"}
            sess["is_processing"] = True
        finally:
            lock.release()

        try:
            # 미처리 구간만 잘라서 STT
            all_audio = np.concatenate(sess["audio_chunks"])
            segment = all_audio[sess["last_processed_end"]:]

            seg_sec = len(segment) / sr
            print(f"[STT] 처리 시작: {seg_sec:.1f}초 분량")

            result = self._transcribe(segment, sr)
            text = result["text"].strip()

            # 처리 완료 위치 업데이트
            sess["last_processed_end"] = sess["total_samples"]

            print(f"[STT] 결과: '{text}'")

            if text:
                sess["all_results"].append(text)
                return {"partial": None, "final": text, "lang": result["lang"]}

            return {"partial": None, "final": None, "lang": "ko"}
        finally:
            sess["is_processing"] = False

    def transcribe_full(self, session_id):
        """세션 전체 오디오를 한번에 변환 (상담 종료 시)"""
        if session_id not in self.sessions:
            return {"text": "", "lang": "ko", "segments": []}

        sess = self.sessions[session_id]
        if not sess["audio_chunks"]:
            return {"text": "", "lang": "ko", "segments": []}

        all_audio = np.concatenate(sess["audio_chunks"])
        total_sec = len(all_audio) / sess["sample_rate"]
        print(f"[STT] 전체 변환: {total_sec:.1f}초")
        return self._transcribe(all_audio, sess["sample_rate"])

    def _transcribe(self, audio_array, sample_rate):
        """Whisper 변환 수행"""
        # 무음 체크
        if np.max(np.abs(audio_array)) < 0.01:
            print("[STT] 무음 감지, 스킵")
            return {"text": "", "lang": "ko", "segments": []}

        audio_buffer = io.BytesIO()
        sf.write(audio_buffer, audio_array, sample_rate, format="WAV")
        audio_buffer.seek(0)

        segments, info = self.model.transcribe(
            audio_buffer,
            language="ko",
            initial_prompt=self.hints,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=600,
                speech_pad_ms=300,
            ),
            beam_size=5,
            best_of=3,
        )

        segments_list = []
        full_text = ""
        for seg in segments:
            segments_list.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip(),
            })
            full_text += seg.text

        detected_lang = info.language if info.language else "ko"

        return {
            "text": full_text.strip(),
            "lang": detected_lang,
            "segments": segments_list,
        }

    def cleanup_session(self, session_id):
        if session_id in self.sessions:
            del self.sessions[session_id]
        if session_id in self.locks:
            del self.locks[session_id]

    def get_audio_for_diarization(self, session_id):
        if session_id not in self.sessions:
            return None, None
        sess = self.sessions[session_id]
        if not sess["audio_chunks"]:
            return None, None
        return np.concatenate(sess["audio_chunks"]), sess["sample_rate"]
