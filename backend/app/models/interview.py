"""Interview session context model — maintains full state across turns."""

from __future__ import annotations

from pydantic import BaseModel


class InterviewContext(BaseModel):
    """Global context maintained by the main agent across the interview."""
    session_id: str = ""
    difficulty: str = "standard"
    # Full profile summary auto-extracted from user profile
    profile_summary: str = ""
    # Extra materials uploaded by user (parsed text)
    uploaded_materials: list[str] = []
    # Complete conversation history
    history: list[dict] = []
    # Interviewer internal notes (hidden from user)
    interviewer_notes: str = ""
    # Sub-task states
    questions_asked: int = 0
    topics_covered: list[str] = []
    weak_points: list[str] = []
    strong_points: list[str] = []
    # Whether interview is active
    active: bool = False
    # Memory from past interview sessions (injected at start)
    past_memory: str = ""
    # Whether input came from ASR (affects error tolerance)
    asr_mode: bool = False
    # Edge TTS voice ID selected by user
    tts_voice: str = "zh-CN-YunxiNeural"
    # Optional interviewer persona (e.g., professor info)
    interviewer_info: str = ""
