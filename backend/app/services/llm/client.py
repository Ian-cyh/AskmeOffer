from __future__ import annotations

import json
from typing import AsyncIterator

import httpx

from app.core.config import LLM_API_KEY, LLM_API_BASE, LLM_MODEL


async def stream_chat(
    system: str,
    user_message: str | None = None,
    messages: list[dict] | None = None,
) -> AsyncIterator[str]:
    """Stream an LLM chat completion as SSE chunks."""
    if messages is None:
        messages = []
    if user_message:
        messages = [{"role": "user", "content": user_message}]

    payload = {
        "model": LLM_MODEL,
        "stream": True,
        "messages": [
            {"role": "system", "content": system},
            *messages,
        ],
    }

    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            f"{LLM_API_BASE.rstrip('/')}/chat/completions",
            json=payload,
            headers=headers,
        ) as resp:
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data.strip() == "[DONE]":
                    yield "data: [DONE]\n\n"
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield f"data: {json.dumps({'content': content})}\n\n"
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
