"""Paraformer ASR via DashScope WebSocket.

Pipeline:
  Raw audio bytes (any format) → ffmpeg convert to PCM 16kHz mono
  → DashScope Paraformer WebSocket streaming API → recognized text
"""

from __future__ import annotations

import asyncio
import io
import json
import subprocess
import uuid

import websockets

from app.core.config import DASHSCOPE_API_KEY, DASHSCOPE_WS_URL, ASR_MODEL


def convert_to_pcm(audio_bytes: bytes) -> bytes:
    """Convert any audio format to 16kHz 16-bit mono PCM using ffmpeg."""
    result = subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", "pipe:0",
            "-ar", "16000",   # 16 kHz
            "-ac", "1",       # mono
            "-f", "s16le",    # raw 16-bit little-endian PCM
            "pipe:1",
        ],
        input=audio_bytes,
        capture_output=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg conversion failed: {result.stderr.decode(errors='replace')[:300]}")
    return result.stdout


async def recognize_audio(audio_bytes: bytes) -> str:
    """Convert audio and send to Paraformer; return recognized text.

    Args:
        audio_bytes: Raw audio in any format supported by ffmpeg (WebM, OGG, WAV, MP3…)

    Returns:
        Recognized text string, or raises RuntimeError on failure.
    """
    # Step 1: convert to PCM
    pcm_data = await asyncio.get_event_loop().run_in_executor(
        None, convert_to_pcm, audio_bytes
    )

    # Step 2: send PCM to Paraformer streaming API
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
            "task": "asr",
            "function": "recognition",
            "model": ASR_MODEL,
            "parameters": {
                "format": "pcm",
                "sample_rate": 16000,
                "language_hints": ["zh", "en"],  # bilingual mode
            },
            "input": {},
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

    recognized_text = ""

    async with websockets.connect(
        DASHSCOPE_WS_URL,
        additional_headers=headers,
        max_size=None,
    ) as ws:
        await ws.send(json.dumps(run_task))

        msg = await asyncio.wait_for(ws.recv(), timeout=10)
        data = json.loads(msg)
        if data.get("header", {}).get("event") != "task-started":
            raise RuntimeError(f"Paraformer task start failed: {data}")

        # Stream PCM in 100 ms chunks (3200 bytes at 16kHz 16-bit mono)
        chunk_size = 3200
        for i in range(0, len(pcm_data), chunk_size):
            await ws.send(pcm_data[i : i + chunk_size])
            await asyncio.sleep(0.02)  # slight pacing

        await ws.send(json.dumps(finish_task))

        while True:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=15)
            except asyncio.TimeoutError:
                break

            if isinstance(msg, bytes):
                continue

            data = json.loads(msg)
            event = data.get("header", {}).get("event", "")

            if event == "result-generated":
                sentence = data.get("payload", {}).get("output", {}).get("sentence", {})
                if sentence.get("sentence_end"):
                    recognized_text += sentence.get("text", "")
            elif event == "task-finished":
                break
            elif event == "task-failed":
                raise RuntimeError(f"Paraformer recognition failed: {data}")

    return recognized_text.strip()
