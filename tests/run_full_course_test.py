"""Full integration test for the Professional Courses module.

Usage:
    cd AskmeOffer && python -m tests.run_full_course_test

Requires the backend to be running on localhost:8000.
"""

import asyncio
import json
import httpx

BASE = "http://localhost:8000"

SUBJECTS_TO_TEST = ["高等数学/微积分", "线性代数"]


async def consume_sse(resp: httpx.Response) -> str:
    """Read an SSE stream and return concatenated content."""
    full = ""
    async for line in resp.aiter_lines():
        if not line.startswith("data: "):
            continue
        data = line[6:].strip()
        if data == "[DONE]":
            break
        try:
            chunk = json.loads(data)
            full += chunk.get("content", "")
        except json.JSONDecodeError:
            continue
    return full


async def test_course_exam(subject: str):
    print(f"\n{'='*60}")
    print(f"  Testing: {subject}")
    print(f"{'='*60}")

    async with httpx.AsyncClient(base_url=BASE, timeout=120.0) as client:
        # 1. Start exam
        print("[1] Starting exam...")
        async with client.stream("POST", "/api/courses/start-exam", json={
            "subject": subject,
            "session_id": f"test-{subject}",
        }) as resp:
            opening = await consume_sse(resp)
        print(f"    Examiner: {opening[:100]}...")
        assert len(opening) > 10, "Examiner opening too short"

        # 2. Chat (simulate 2 rounds)
        answers = [
            "这个知识点我了解一些，基本概念是...",
            "这个我不太确定，可能涉及到相关定理的应用。",
        ]
        for i, answer in enumerate(answers, 1):
            print(f"[2.{i}] Student answer: {answer[:40]}...")
            async with client.stream("POST", "/api/courses/exam-chat", json={
                "session_id": f"test-{subject}",
                "user_message": answer,
            }) as resp:
                reply = await consume_sse(resp)
            print(f"      Examiner: {reply[:80]}...")

        # 3. End exam & get feedback
        print("[3] Ending exam, generating feedback...")
        resp = await client.post("/api/courses/end-exam", json={
            "session_id": f"test-{subject}",
        })
        data = resp.json()
        assert data.get("ok"), f"Feedback generation failed: {data}"
        fb = data["feedback"]
        print(f"    Summary: {fb.get('summary', 'N/A')}")
        print(f"    Score: {fb.get('overall_score', 'N/A')}")
        print(f"    Knowledge points: {len(fb.get('knowledge_results', []))}")
        print(f"    Weak points: {fb.get('weak_points', [])}")

        # 4. Notebook
        print("[4] Checking notebook...")
        resp = await client.post("/api/courses/notebook", json={
            "session_id": f"test-{subject}",
        })
        notebook = resp.json()
        total = sum(len(v) for v in notebook.values())
        print(f"    Total entries: {total} (weak={len(notebook.get('weak',{}))}, mastered={len(notebook.get('mastered',{}))})")

        # 5. AI Ask
        print("[5] Testing AI Q&A...")
        async with client.stream("POST", "/api/courses/ask", json={
            "question": f"请简要解释{subject}中最核心的概念",
        }) as resp:
            ask_reply = await consume_sse(resp)
        print(f"    AI answer: {ask_reply[:80]}...")

    print(f"\n  ✓ {subject} test passed!")


async def main():
    print("=" * 60)
    print("  AskmeOffer — Professional Courses Full Test")
    print("=" * 60)

    for subj in SUBJECTS_TO_TEST:
        await test_course_exam(subj)

    print(f"\n{'='*60}")
    print(f"  All tests passed! ({len(SUBJECTS_TO_TEST)} subjects)")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
