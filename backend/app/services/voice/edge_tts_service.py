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
    """Clean text for TTS: strip markdown artifacts and expand abbreviations.

    1. Remove Chinese curly quotes and other non-speech symbols
    2. Convert ALL-CAPS abbreviations to space-separated letters for natural reading
       e.g. "DOE" → "D O E"，"GPA" → "G P A"
    """
    # 去除中文引号（朗读时会念出"左引号""右引号"）
    text = text.replace('\u201c', '').replace('\u201d', '')  # "" 
    text = text.replace('\u2018', '').replace('\u2019', '')  # ''
    # 去除常见 Markdown 符号（**加粗**、`代码`、#标题 等）
    text = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', text)   # *bold*/**bold**
    text = re.sub(r'`{1,3}[^`]*`{1,3}', '', text)           # `code` / ```block```
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)  # ## heading
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)              # images
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)   # links → text
    # 去除 LaTeX 公式（不适合朗读）
    text = re.sub(r'\$\$[^$]+\$\$', '（公式）', text, flags=re.DOTALL)
    text = re.sub(r'\$[^$\n]+\$', '（公式）', text)
    # 去除多余空行
    text = re.sub(r'\n{3,}', '\n\n', text)

    def expand_abbr(m: re.Match) -> str:
        word = m.group(0)
        core = re.match(r"^([A-Z]{2,})", word)
        if not core:
            return word
        letters = core.group(1)
        suffix = word[len(letters):]
        spelled = " ".join(letters)
        return spelled + (suffix if suffix else "")

    return re.sub(r"(?<![A-Za-z])[A-Z]{2,}[\w-]*", expand_abbr, text)


# 可选音色列表（供前端展示）
AVAILABLE_VOICES = [
    {"id": "zh-CN-YunxiNeural",   "name": "云希（温和男声）", "desc": "温和亲切，适合常规面试"},
    {"id": "zh-CN-YunjianNeural", "name": "云健（严肃男声）", "desc": "严肃专业，适合压力面试"},
    {"id": "zh-CN-YunyangNeural", "name": "云扬（播报男声）", "desc": "沉稳权威，适合正式场合"},
    {"id": "zh-CN-XiaoxiaoNeural","name": "晓晓（活泼女声）", "desc": "亲切活泼，适合轻松面试"},
    {"id": "zh-CN-XiaoyiNeural",  "name": "晓伊（温柔女声）", "desc": "温柔细腻，适合学术交流"},
]


async def synthesize_edge(text: str, voice: str = VOICE) -> AsyncIterator[bytes]:
    """Stream MP3 audio chunks from Edge TTS."""
    processed = preprocess_tts(text)
    communicate = edge_tts.Communicate(processed, voice=voice, rate=RATE, pitch=PITCH)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            yield chunk["data"]


async def synthesize_edge_full(text: str, voice: str = VOICE) -> bytes:
    """Get complete MP3 audio from Edge TTS."""
    processed = preprocess_tts(text)
    buf = io.BytesIO()
    communicate = edge_tts.Communicate(processed, voice=voice, rate=RATE, pitch=PITCH)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    return buf.getvalue()
