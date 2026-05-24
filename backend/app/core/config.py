import os
from dotenv import load_dotenv

load_dotenv()

LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_API_BASE = os.getenv("LLM_API_BASE", "https://api.deepseek.com")
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-v4-flash")

# 阿里云百炼 DashScope (ASR + TTS)
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
DASHSCOPE_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference"
ASR_MODEL = os.getenv("ASR_MODEL", "paraformer-realtime-v2")
TTS_MODEL = os.getenv("TTS_MODEL", "cosyvoice-v3-flash")
TTS_VOICE = os.getenv("TTS_VOICE", "longshu")
