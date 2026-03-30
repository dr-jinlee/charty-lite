"""
화자 분리 (Speaker Diarization) 모듈
pyannote.audio를 사용하여 의사/환자 구분
"""
import os
import torch
import numpy as np
import soundfile as sf
import io

class DiarizationEngine:
    def __init__(self, hf_token=None):
        """
        화자 분리 엔진 초기화
        - hf_token: HuggingFace 토큰 (pyannote 모델 접근용)
        """
        self.hf_token = hf_token or os.getenv("HF_AUTH_TOKEN")
        self.pipeline = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._load_model()

    def _load_model(self):
        """pyannote 모델 로드"""
        try:
            from pyannote.audio import Pipeline
            print("[Diarization] 모델 로딩 중...")
            self.pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=self.hf_token,
            )
            self.pipeline.to(self.device)
            print("[Diarization] 모델 로딩 완료")
        except Exception as e:
            print(f"[Diarization] 모델 로딩 실패: {e}")
            print("[Diarization] 화자 분리 없이 진행합니다")
            self.pipeline = None

    def diarize(self, audio_array, sample_rate):
        """
        화자 분리 수행

        반환: [{"speaker": "SPEAKER_00", "start": 0.0, "end": 2.5}, ...]
        """
        if self.pipeline is None:
            return []

        # numpy → WAV 바이트
        audio_buffer = io.BytesIO()
        sf.write(audio_buffer, audio_array, sample_rate, format="WAV")
        audio_buffer.seek(0)

        # pyannote 실행
        diarization = self.pipeline(audio_buffer)

        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "speaker": speaker,
                "start": turn.start,
                "end": turn.end,
            })

        return segments

    def assign_roles(self, diarization_segments):
        """
        화자 ID를 의사/환자로 매핑

        규칙:
        - 첫 번째로 말한 사람 = 의사 (보통 상담 시작은 의사가 함)
        - 더 많이 말한 사람 = 의사 (의사가 설명을 더 많이 함)
        """
        if not diarization_segments:
            return {}

        # 화자별 총 발화 시간 계산
        speaker_durations = {}
        speaker_first_time = {}

        for seg in diarization_segments:
            spk = seg["speaker"]
            duration = seg["end"] - seg["start"]

            if spk not in speaker_durations:
                speaker_durations[spk] = 0
                speaker_first_time[spk] = seg["start"]

            speaker_durations[spk] += duration

        # 화자가 1명이면 의사로 지정
        speakers = list(speaker_durations.keys())
        if len(speakers) <= 1:
            return {speakers[0]: "doctor"} if speakers else {}

        # 화자가 2명: 첫 발화자 = 의사
        first_speaker = min(speaker_first_time, key=speaker_first_time.get)
        role_map = {}
        for spk in speakers:
            if spk == first_speaker:
                role_map[spk] = "doctor"
            else:
                role_map[spk] = "patient"

        return role_map

    def merge_transcript_with_diarization(self, stt_segments, diarization_segments, role_map):
        """
        STT 결과와 화자 분리 결과를 합침

        stt_segments: [{"start": 0.0, "end": 2.5, "text": "..."}, ...]
        diarization_segments: [{"speaker": "SPEAKER_00", "start": 0.0, "end": 2.5}, ...]
        role_map: {"SPEAKER_00": "doctor", "SPEAKER_01": "patient"}

        반환: [{"speaker": "doctor", "text": "...", "start": 0.0, "end": 2.5}, ...]
        """
        result = []

        for stt_seg in stt_segments:
            stt_mid = (stt_seg["start"] + stt_seg["end"]) / 2

            # STT 구간의 중간점이 어떤 화자 구간에 속하는지 찾기
            best_speaker = "unknown"
            best_overlap = 0

            for dia_seg in diarization_segments:
                # 겹치는 구간 계산
                overlap_start = max(stt_seg["start"], dia_seg["start"])
                overlap_end = min(stt_seg["end"], dia_seg["end"])
                overlap = max(0, overlap_end - overlap_start)

                if overlap > best_overlap:
                    best_overlap = overlap
                    best_speaker = role_map.get(dia_seg["speaker"], "unknown")

            result.append({
                "speaker": best_speaker,
                "text": stt_seg["text"],
                "start": stt_seg["start"],
                "end": stt_seg["end"],
            })

        return result

    def process_dual_mic(self, audio_ch0, audio_ch1, sample_rate):
        """
        마이크 2개 모드: 채널별로 화자 자동 지정
        ch0 = 의사, ch1 = 환자 (설정에서 변경 가능)

        반환: [{"speaker": "doctor"/"patient", "audio": numpy_array}, ...]
        """
        return {
            "doctor": audio_ch0,
            "patient": audio_ch1,
            "sample_rate": sample_rate,
        }
