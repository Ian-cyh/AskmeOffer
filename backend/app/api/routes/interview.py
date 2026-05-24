import uuid

from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models.profile import UserProfile
from app.services.llm.client import stream_chat
from app.services.interview.context import (
    get_or_create_session,
    reset_session,
    build_profile_summary,
    ASR_NOTICE,
)

router = APIRouter()


DIFFICULTY_MAP = {
    "easy": "温和友善，以鼓励为主，提问难度适中，不做过多追问",
    "standard": "专业严谨，会就回答中的细节追问 1-2 层，评估深度理解",
    "pressure": "严格高压，频繁追问细节和边界情况，模拟真实压力面试，会质疑回答中的不严谨之处",
}

INTERVIEW_SYSTEM = """你是一位经验丰富的保研面试官，正在对一位申请研究生的本科生进行模拟面试。

面试规则：
1. 基于候选人的完整背景资料提问，重点考察项目经历的技术深度和个人贡献
2. 每次只问一个问题，等候选人回答后再继续
3. 根据回答质量决定是追问还是换下一题
4. 追问要具体，针对回答中的薄弱点或模糊之处
5. 面试风格：{difficulty_desc}
6. 使用中文交流
7. 保持面试官的角色，不要给出答案或提示
8. 如果有补充材料，也要基于补充材料中的内容提问

面试开始时先简单问候，然后从自我介绍开始。"""


# --- Session Management ---

class StartRequest(BaseModel):
    profile: UserProfile
    difficulty: str = "standard"
    session_id: str = ""
    past_memory: str = ""
    asr_mode: bool = False


@router.post("/start")
async def start_interview(req: StartRequest):
    """Start a new interview session with full profile context."""
    session_id = req.session_id or str(uuid.uuid4())
    ctx = reset_session(session_id)
    ctx.difficulty = req.difficulty
    ctx.profile_summary = build_profile_summary(req.profile)
    ctx.past_memory = req.past_memory
    ctx.asr_mode = req.asr_mode
    ctx.active = True

    difficulty_desc = DIFFICULTY_MAP.get(req.difficulty, DIFFICULTY_MAP["standard"])
    system = INTERVIEW_SYSTEM.format(difficulty_desc=difficulty_desc)
    system += f"\n\n{ctx.profile_summary}"

    if ctx.past_memory:
        system += f"\n\n=== 候选人历史面试记录（作为参考）===\n{ctx.past_memory}"
    if ctx.asr_mode:
        system += ASR_NOTICE

    if ctx.uploaded_materials:
        system += "\n\n=== 候选人补充材料 ===\n"
        system += "\n---\n".join(ctx.uploaded_materials)

    initial_msg = [{"role": "user", "content": "你好，我准备好了，请开始面试。"}]

    async def generate():
        full_response = ""
        async for chunk in stream_chat(system, messages=initial_msg):
            full_response += chunk.replace("data: ", "").strip()
            yield chunk
        ctx.history = [
            {"role": "user", "content": "你好，我准备好了，请开始面试。"},
            {"role": "assistant", "content": full_response},
        ]
        ctx.questions_asked = 1

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"X-Session-Id": session_id},
    )


class ChatRequest(BaseModel):
    session_id: str
    user_message: str
    profile: UserProfile | None = None


@router.post("/chat")
async def interview_chat(req: ChatRequest):
    """Continue an interview conversation with full context."""
    ctx = get_or_create_session(req.session_id)

    # If profile provided and no summary yet, build it
    if req.profile and not ctx.profile_summary:
        ctx.profile_summary = build_profile_summary(req.profile)

    difficulty_desc = DIFFICULTY_MAP.get(ctx.difficulty, DIFFICULTY_MAP["standard"])
    system = INTERVIEW_SYSTEM.format(difficulty_desc=difficulty_desc)
    system += f"\n\n{ctx.profile_summary}"

    if ctx.uploaded_materials:
        system += "\n\n=== 候选人补充材料 ===\n"
        system += "\n---\n".join(ctx.uploaded_materials)
    if ctx.past_memory:
        system += f"\n\n=== 候选人历史面试记录（作为参考）===\n{ctx.past_memory}"
    if ctx.asr_mode:
        system += ASR_NOTICE

    # Add user message to history
    ctx.history.append({"role": "user", "content": req.user_message})

    async def generate():
        full_response = ""
        async for chunk in stream_chat(system, messages=ctx.history):
            full_response += chunk.replace("data: ", "").strip()
            yield chunk
        ctx.history.append({"role": "assistant", "content": full_response})
        ctx.questions_asked += 1

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
    )


# --- File Upload ---

@router.post("/upload")
async def upload_material(
    session_id: str = Form(""),
    file: UploadFile = File(...),
):
    """Upload supplementary material for the interview."""
    ctx = get_or_create_session(session_id)
    content = await file.read()

    # Try to decode as text
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("gbk", errors="ignore")

    material = f"[文件：{file.filename}]\n{text[:10000]}"
    ctx.uploaded_materials.append(material)

    return {
        "ok": True,
        "session_id": session_id,
        "filename": file.filename,
        "char_count": len(text),
    }


# --- Feedback Generation ---

FEEDBACK_SYSTEM = """你是一位专业的面试评估专家。请根据以下面试对话记录，生成一份结构化的面试反馈报告。

请严格按以下 JSON 格式输出（不要输出其他内容）：
{
  "summary": "整体面试表现的一段话总结（100字以内）",
  "questions": [
    {
      "question": "面试官提出的问题",
      "answer": "候选人的回答要点摘要",
      "evaluation": "对该回答的评价（好/一般/需改进 + 具体点评）"
    }
  ],
  "strengths": ["优势1", "优势2"],
  "improvements": ["待提升点1", "待提升点2"],
  "overallScore": "A/B/C/D 评级 + 一句话说明"
}"""


class FeedbackRequest(BaseModel):
    session_id: str
    history: list[dict] = []


@router.post("/feedback")
async def generate_feedback(req: FeedbackRequest):
    """Generate structured interview feedback."""
    ctx = get_or_create_session(req.session_id)
    history = req.history if req.history else ctx.history

    if len(history) < 2:
        return {"error": "面试对话太短，无法生成反馈"}

    conversation = "\n".join(
        f"{'面试官' if m['role'] == 'assistant' else '候选人'}：{m['content']}"
        for m in history
    )

    from app.services.llm.client import collect_chat
    result = await collect_chat(
        FEEDBACK_SYSTEM,
        user_message=f"面试对话记录：\n\n{conversation}",
    )

    # Try to parse JSON
    import json as json_mod
    try:
        # Strip markdown code fences if present
        cleaned = result.strip()
        if cleaned.startswith("```"):
            cleaned = "\n".join(cleaned.split("\n")[1:])
        if cleaned.endswith("```"):
            cleaned = cleaned[: cleaned.rfind("```")]
        feedback = json_mod.loads(cleaned.strip())
        return {"ok": True, "feedback": feedback}
    except json_mod.JSONDecodeError:
        return {"ok": True, "feedback": {"summary": result, "questions": [], "strengths": [], "improvements": [], "overallScore": "未评级"}}


# --- Session Info ---

@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get current session state."""
    ctx = get_or_create_session(session_id)
    return {
        "session_id": ctx.session_id,
        "active": ctx.active,
        "difficulty": ctx.difficulty,
        "questions_asked": ctx.questions_asked,
        "history_length": len(ctx.history),
        "materials_count": len(ctx.uploaded_materials),
    }
