"""Edge TTS — free, high-quality neural Chinese voices from Microsoft."""

from __future__ import annotations

import io
import re
from typing import AsyncIterator

import edge_tts

# 面试官用成熟男声
VOICE = "zh-CN-YunxiNeural"
# 语速稍快，更自然
RATE = "+15%"
PITCH = "+0Hz"

# 常见专业缩写白名单，确保正确逐字读出
_COMMON_ABBRS = {
    "GPA", "SAC", "DOE", "SCI", "EI", "CCF", "GPU", "CPU", "API",
    "LLM", "AI", "ML", "DL", "RL", "NLP", "CV", "CNN", "RNN",
    "LSTM", "GAN", "VAE", "MLP", "SVM", "KNN", "PCA", "SGD",
    "DDPM", "VQ", "CLIP", "GPT", "RAG", "FFT", "SNR", "PSNR",
    "ACM", "IEEE", "AAAI", "CVPR", "ICCV", "ECCV", "ICML", "NIPS",
    "GRE", "TOEFL", "IELTS", "CET", "CST", "UTC",
}


def preprocess_tts(text: str) -> str:
    """Convert ALL-CAPS abbreviations to space-separated letters for natural reading.
    
    e.g. "DOE" → "D O E"，"GPA" → "G P A"
    保留小写单词不变，只处理 2+ 个连续大写字母的词（含数字后缀如 GPT-4）。
    """
    def expand_abbr(m: re.Match) -> str:
        word = m.group(0)
        # 只处理全大写（允许末尾有数字/连字符，如 GPT-4、V100）
        core = re.match(r"^([A-Z]{2,})", word)
        if not core:
            return word
        letters = core.group(1)
        suffix = word[len(letters):]
        # 逐字母加空格，末尾数字原样拼接
        spelled = " ".join(letters)
        return spelled + (suffix if suffix else "")

    # 匹配 2 个以上连续大写字母（不被小写字母前缀修饰，可后跟 -数字 等）
    # 用 (?<![A-Za-z]) 代替 \b，避免中文字符被视为 \w 导致边界失效
    return re.sub(r"(?<![A-Za-z])[A-Z]{2,}[\w-]*", expand_abbr, text)


async def synthesize_edge(text: str) -> AsyncIterator[bytes]:
    """Stream MP3 audio chunks from Edge TTS."""
    processed = preprocess_tts(text)
    communicate = edge_tts.Communicate(processed, voice=VOICE, rate=RATE, pitch=PITCH)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            yield chunk["data"]


async def synthesize_edge_full(text: str) -> bytes:
    """Get complete MP3 audio from Edge TTS."""
    processed = preprocess_tts(text)
    buf = io.BytesIO()
    communicate = edge_tts.Communicate(processed, voice=VOICE, rate=RATE, pitch=PITCH)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    return buf.getvalue()
