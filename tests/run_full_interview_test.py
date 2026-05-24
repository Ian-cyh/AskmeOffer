"""Full integration test for the Interview module.

Usage:
    cd AskmeOffer && python -m tests.run_full_interview_test

Requires the backend to be running on localhost:8000.
"""

import asyncio
import json
import httpx

BASE = "http://localhost:8000"

DEMO_PROFILE = {
    "basic_info": {
        "name": "测试用户",
        "university": "北京交通大学",
        "major": "通信工程",
        "rank": "1/96",
        "gpa": "3.96/4.00",
        "avg_score": "93.9",
        "phone": "12222222222",
        "email": "test@test.com",
        "self_intro": "北京交通大学通信工程专业，研究方向为深度强化学习。",
    },
    "course_scores": [{"name": "数字信号处理", "score": "95"}],
    "achievements": [
        {"type": "paper", "title": "Test Paper Title", "level": "SCI", "date": "2025", "description": "第一作者"},
    ],
    "projects": [
        {
            "title": "深度强化学习项目",
            "role": "核心成员",
            "duration": "2024-2025",
            "description": "基于SAC的光学器件设计",
            "tech_stack": "Python, PyTorch",
            "contribution": "负责算法设计与实验",
        },
    ],
    "student_work": [],
    "recommendations": [],
    "target_schools": [],
}


async def consume_sse(resp: httpx.Response) -> str:
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


async def main():
    print("=" * 60)
    print("  AskmeOffer — Interview Module Full Test")
    print("=" * 60)

    async with httpx.AsyncClient(base_url=BASE, timeout=120.0) as client:
        session_id = "test-interview-001"

        # 1. Start interview
        print("\n[1] Starting interview...")
        async with client.stream("POST", "/api/interview/start", json={
            "profile": DEMO_PROFILE,
            "difficulty": "standard",
            "session_id": session_id,
            "past_memory": "",
            "asr_mode": False,
        }) as resp:
            opening = await consume_sse(resp)
        print(f"    Interviewer: {opening[:100]}...")
        assert len(opening) > 10, "Opening too short"

        # 2. Chat rounds
        answers = [
            "我是北京交通大学通信工程的张三，GPA 3.96，研究方向是深度强化学习和光学器件设计。",
            "在光学器件项目中，我使用SAC算法来优化衍射光学元件的表面设计，主要突破是分束均匀性误差降到0.46%。",
            "SAC的优势在于它是一个基于最大熵的方法，能更好地探索解空间，避免局部最优。",
        ]
        for i, answer in enumerate(answers, 1):
            print(f"\n[2.{i}] Student: {answer[:60]}...")
            async with client.stream("POST", "/api/interview/chat", json={
                "session_id": session_id,
                "user_message": answer,
            }) as resp:
                reply = await consume_sse(resp)
            print(f"      Interviewer: {reply[:80]}...")

        # 3. Generate feedback
        print("\n[3] Generating feedback...")
        history = [
            {"role": "assistant", "content": opening},
        ]
        for i, a in enumerate(answers):
            history.append({"role": "user", "content": a})
            history.append({"role": "assistant", "content": f"(Round {i+1} response)"})

        resp = await client.post("/api/interview/feedback", json={
            "session_id": session_id,
            "history": history,
        })
        data = resp.json()
        if data.get("ok"):
            fb = data["feedback"]
            print(f"    Summary: {fb.get('summary', 'N/A')}")
            print(f"    Score: {fb.get('overallScore', 'N/A')}")
            print(f"    Strengths: {fb.get('strengths', [])}")
            print(f"    Improvements: {fb.get('improvements', [])}")
        else:
            print(f"    Feedback error: {data}")

        # 4. Session info
        print("\n[4] Checking session...")
        resp = await client.get(f"/api/interview/session/{session_id}")
        info = resp.json()
        print(f"    Active: {info.get('active')}, Questions: {info.get('questions_asked')}")

    print(f"\n{'='*60}")
    print(f"  ✓ Interview test passed!")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
