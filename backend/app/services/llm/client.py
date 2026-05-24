from __future__ import annotations

import json
from typing import AsyncIterator

import httpx

from app.core.config import LLM_API_KEY, LLM_API_BASE, LLM_MODEL


def _build_payload(system: str, messages: list[dict], stream: bool = True) -> dict:
    return {
        "model": LLM_MODEL,
        "stream": stream,
        "messages": [
            {"role": "system", "content": system},
            *messages,
        ],
    }


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }


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

    payload = _build_payload(system, messages, stream=True)

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            f"{LLM_API_BASE.rstrip('/')}/chat/completions",
            json=payload,
            headers=_headers(),
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


async def collect_chat(
    system: str,
    user_message: str | None = None,
    messages: list[dict] | None = None,
    timeout: float = 60.0,
) -> str:
    """Non-streaming LLM call, returns full response text. Used by voice pipeline."""
    if messages is None:
        messages = []
    if user_message:
        messages = [{"role": "user", "content": user_message}]

    payload = _build_payload(system, messages, stream=False)

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{LLM_API_BASE.rstrip('/')}/chat/completions",
            json=payload,
            headers=_headers(),
        )
        data = resp.json()
        return data["choices"][0]["message"]["content"]
