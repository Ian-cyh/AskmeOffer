"""CosyVoice TTS via DashScope WebSocket."""

from __future__ import annotations

import json
import uuid
import asyncio
from typing import AsyncIterator

import websockets

from app.core.config import DASHSCOPE_API_KEY, DASHSCOPE_WS_URL, TTS_MODEL, TTS_VOICE


async def synthesize_speech(text: str) -> AsyncIterator[bytes]:
    """Stream audio bytes from CosyVoice TTS."""
    task_id = str(uuid.uuid4())

    headers = {"Authorization": f"Bearer {DASHSCOPE_API_KEY}"}

    run_task = {
        "header": {
            "action": "run-task",
            "task_id": task_id,
            "streaming": "duplex",
        },
        "payload": {
            "task_group": "audio",
            "task": "tts",
            "function": "SpeechSynthesizer",
            "model": TTS_MODEL,
            "parameters": {
                "text_type": "PlainText",
                "voice": TTS_VOICE,
                "format": "mp3",
                "sample_rate": 22050,
                "volume": 50,
                "rate": 1.0,
                "pitch": 1.0,
            },
            "input": {},
        },
    }

    continue_task = {
        "header": {
            "action": "continue-task",
            "task_id": task_id,
            "streaming": "duplex",
        },
        "payload": {
            "input": {"text": text},
        },
    }

    finish_task = {
        "header": {
            "action": "finish-task",
            "task_id": task_id,
            "streaming": "duplex",
        },
        "payload": {"input": {}},
    }

    async with websockets.connect(
        DASHSCOPE_WS_URL,
        additional_headers=headers,
        max_size=None,
    ) as ws:
        # 1. Send run-task
        await ws.send(json.dumps(run_task))

        # Wait for task-started
        msg = await ws.recv()
        data = json.loads(msg)
        if data.get("header", {}).get("event") != "task-started":
            return

        # 2. Send text
        await ws.send(json.dumps(continue_task))

        # 3. Send finish-task
        await ws.send(json.dumps(finish_task))

        # 4. Receive audio stream
        while True:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=30)
            except asyncio.TimeoutError:
                break

            if isinstance(msg, bytes):
                yield msg
                continue

            data = json.loads(msg)
            event = data.get("header", {}).get("event", "")
            if event in ("task-finished", "task-failed"):
                break
