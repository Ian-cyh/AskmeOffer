import uuid
import re

import httpx
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models.profile import UserProfile
from app.services.llm.client import stream_chat, collect_chat
from app.services.interview.context import (
    get_or_create_session,
    reset_session,
    build_profile_summary,
    ASR_NOTICE,
)

from app.services.voice.edge_tts_service import AVAILABLE_VOICES

router = APIRouter()


@router.get("/voices")
async def list_voices():
    """Return available TTS voices."""
    return {"voices": AVAILABLE_VOICES}


class FetchProfessorRequest(BaseModel):
    url: str
    page_text: str = ""   # Browser-scraped page text (avoids server-side CORS/firewall issues)


@router.post("/fetch_professor")
async def fetch_professor(req: FetchProfessorRequest):
    """Extract professor info from page text or URL via LLM."""
    text = req.page_text.strip()

    # If browser provided raw page text, use it directly
    if not text:
        # Server-side fetch as fallback (may fail if server has no internet)
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=15,
                                         headers={"User-Agent": "Mozilla/5.0"}) as client:
                resp = await client.get(req.url)
                html = resp.text
            text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r"<[^>]+>", " ", text)
            text = re.sub(r"\s+", " ", text).strip()
        except Exception:
            text = ""   # Will fall through to URL-only LLM lookup

    text = text[:4000]

    system = (
        "你是一名信息提取助手，专门处理高校教师主页信息。"
        "请从提供的内容中提取导师信息，按以下格式输出（每行一项）：\n"
        "姓名：XXX\n院系/单位：XXX\n职称：XXX\n"
        "研究方向：XXX（逗号分隔，3-5个方向）\n"
        "主要研究内容：XXX（1-2句具体说明）\n"
        "联系邮箱：XXX（若无则留空）\n"
        "个人主页：XXX（若有）\n"
        "一句话简介：XXX（50字以内，适合在面试中作为开场白）\n"
        "如果某项信息确实缺失，请用「未找到」填充，不要捏造信息。"
    )

    if text:
        user_content = f"请从以下导师主页文本中提取信息（主页URL：{req.url}）：\n\n{text}"
    else:
        # No page text available — ask LLM based on URL alone
        user_content = (
            f"请根据以下导师主页 URL，结合你的知识提取该导师的信息。"
            f"注意：只输出你确定知道的信息，不要捏造。\nURL：{req.url}"
        )

    try:
        info = await collect_chat(system, [{"role": "user", "content": user_content}])
        return {"info": info}
    except Exception as e:
        return {"error": f"LLM 提取失败：{e}"}


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
9. 【重要】候选人背景资料中的姓名是候选人的名字，不是你的名字。你绝对不能用候选人的姓名称呼自己。

{greeting_instruction}"""


# --- Session Management ---

class StartRequest(BaseModel):
    profile: UserProfile
    difficulty: str = "standard"
    session_id: str = ""
    past_memory: str = ""
    asr_mode: bool = False
    interviewer_info: str = ""


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
    interviewer_info = getattr(req, "interviewer_info", "") or ""
    if interviewer_info:
        greeting_instruction = f"【你的身份】{interviewer_info}\n面试开始时用你自己的真实姓名和单位简短自我介绍，然后请候选人做自我介绍。"
    else:
        greeting_instruction = "面试开始时说「你好，我是今天的面试官」，然后请候选人做自我介绍。不要报出任何具体姓名。"
    system = INTERVIEW_SYSTEM.format(difficulty_desc=difficulty_desc, greeting_instruction=greeting_instruction)
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
    greeting_instruction = "面试进行中，继续按规则提问或追问。"
    system = INTERVIEW_SYSTEM.format(difficulty_desc=difficulty_desc, greeting_instruction=greeting_instruction)
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

FEEDBACK_SYSTEM = """你是一位资深的保研面试辅导专家，需要从"面试评委听者的视角"给候选人写一份深度反馈。
面试者说话时感觉和听者听到的效果往往不同——你的任务是帮候选人意识到听者的真实感受。

请严格按以下 JSON 格式输出（不要输出其他内容）：
{
  "summary": "整体面试表现总结（120字以内，包含整体印象和核心建议）",
  "questions": [
    {
      "question": "面试官提出的问题",
      "answer": "候选人的回答要点摘要",
      "evaluation": "对该回答的准确性评价",
      "expression_advice": "语言表达优化建议：从听者角度指出表述问题（如太啰嗦、逻辑不清、缺少结论先行、专业术语使用不当等），并给出具体的改进话术示例",
      "suggested_answer": "参考回答或改进方向。规则：(1)基础概念/原理类问题→直接给出准确的标准答案和关键知识点；(2)项目细节/个人经历类问题→不要编造细节，而是指出回答中缺少哪些关键信息，告诉候选人应该去回顾/准备哪些具体内容（如'建议回顾你项目中XX模块的具体实现细节和性能数据'）；(3)开放性/动机类问题→给出回答框架和表达策略建议",
      "score": "A/B/C/D"
    }
  ],
  "strengths": ["优势1", "优势2"],
  "improvements": ["待提升点1（具体可执行的建议）", "待提升点2"],
  "expression_summary": "整体语言表达点评（50-100字）：从听者感受角度总结候选人的表达习惯问题和改进方向，例如是否存在口头禅过多、回答冗长、缺乏结构感、语气不够自信等",
  "overallScore": "A/B/C/D 评级 + 一句话说明"
}

重要原则：
- 对于基础知识和概念性问题（如算法原理、数学推导、CS基础），在 suggested_answer 中直接给出完整准确的标准答案
- 对于项目经历、实习经验等个人细节，不要凭空编造，而是告诉候选人"你的回答缺少了XX信息，建议去查阅/准备XX"
- expression_advice 要从"评委听到你的回答时的真实感受"出发，而非简单说"可以更好"
- 给出的改进话术要具体到可以直接使用的句子模板
- 禁止使用中文引号""，举例口头禅请用反引号包裹如 `其实`、`就是`"""


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


# --- Feedback Follow-up Chat ---

FEEDBACK_CHAT_SYSTEM = """你是一位资深的保研面试辅导教练，候选人刚完成一次模拟面试，你给了他反馈报告，现在他正在就反馈内容向你追问。

你的角色原则：
1. 对于基础概念/原理类追问（如"XXX到底是什么""YY算法怎么推导"）：直接给出清晰、准确、有深度的解答
2. 对于项目细节类追问（如"我应该怎么描述我的XX项目"）：不要编造细节，而是引导候选人回忆和整理自己的信息，告诉他应该准备哪些关键点
3. 对于表达技巧类追问（如"怎么组织语言""怎么回答压力面问题"）：给出具体、可操作的话术模板和策略
4. 回答要简洁实用，像一个有经验的学长在帮忙辅导
5. 使用 Markdown 格式，公式用 LaTeX：$...$ 行内，$$...$$ 独立公式
6. 禁止使用中文引号""，举例请用反引号

以下是本次面试的反馈报告和对话记录，请基于此回答候选人的追问。"""


class FeedbackChatRequest(BaseModel):
    feedback_summary: str
    interview_history: list[dict] = []
    chat_history: list[dict] = []
    user_message: str


@router.post("/feedback_chat")
async def feedback_chat(req: FeedbackChatRequest):
    """Interactive follow-up chat about interview feedback."""
    context = FEEDBACK_CHAT_SYSTEM
    if req.feedback_summary:
        context += f"\n\n=== 面试反馈报告 ===\n{req.feedback_summary}"
    if req.interview_history:
        conversation = "\n".join(
            f"{'面试官' if m['role'] == 'assistant' else '候选人'}：{m['content']}"
            for m in req.interview_history[:30]
        )
        context += f"\n\n=== 面试对话记录 ===\n{conversation}"

    messages = [*req.chat_history, {"role": "user", "content": req.user_message}]

    async def generate():
        async for chunk in stream_chat(context, messages=messages):
            yield chunk

    return StreamingResponse(generate(), media_type="text/event-stream")


# --- Historical Interview Summary ---

SUMMARY_SYSTEM = """你是一位保研面试辅导专家，请根据候选人的多次模拟面试记录，生成一份综合分析报告。

请严格按以下 JSON 格式输出（不要输出其他内容）：
{
  "overall_trend": "整体进步趋势（2-3句话描述候选人从第一次到最近一次的变化）",
  "persistent_strengths": ["持续表现好的方面1", "持续表现好的方面2"],
  "persistent_weaknesses": ["反复出现的薄弱点1", "反复出现的薄弱点2"],
  "improvement_areas": ["已有明显进步的方面1"],
  "priority_actions": ["最需要优先改进的事项1（具体可执行）", "最需要优先改进的事项2"],
  "expression_pattern": "语言表达方面的整体模式和建议（2-3句话）",
  "readiness_assessment": "当前面试准备程度评估（1-3句话，包含是否可以开始真实面试的判断）"
}"""


class SummaryRequest(BaseModel):
    records: list[dict]


@router.post("/history_summary")
async def generate_history_summary(req: SummaryRequest):
    """Generate a comprehensive summary across multiple interview records."""
    import json as json_mod

    if len(req.records) < 2:
        return {"error": "至少需要 2 次面试记录才能生成汇总分析"}

    parts = []
    for i, r in enumerate(req.records[:10]):
        fb = r.get("feedback") or {}
        if not isinstance(fb, dict) or not fb:
            continue
        strengths = fb.get("strengths") or []
        improvements = fb.get("improvements") or []
        parts.append(
            f"[第{i+1}次 — {r.get('date','?')}，难度：{r.get('difficulty','?')}]\n"
            f"评级：{fb.get('overallScore','?')}\n"
            f"总结：{fb.get('summary','')}\n"
            f"优势：{', '.join(str(s) for s in strengths)}\n"
            f"待提升：{', '.join(str(s) for s in improvements)}\n"
            f"表达总评：{fb.get('expression_summary', '无')}"
        )

    if len(parts) < 1:
        return {"error": "没有包含反馈的面试记录，无法生成汇总"}

    combined = "\n\n".join(parts)

    try:
        result = await collect_chat(
            SUMMARY_SYSTEM,
            user_message=f"候选人的 {len(parts)} 次面试记录：\n\n{combined}",
        )

        cleaned = result.strip()
        if cleaned.startswith("```"):
            cleaned = "\n".join(cleaned.split("\n")[1:])
        if cleaned.endswith("```"):
            cleaned = cleaned[: cleaned.rfind("```")]
        try:
            summary = json_mod.loads(cleaned.strip())
            return {"ok": True, "summary": summary}
        except json_mod.JSONDecodeError:
            return {"ok": True, "summary": {"overall_trend": result, "persistent_strengths": [], "persistent_weaknesses": [], "improvement_areas": [], "priority_actions": [], "expression_pattern": "", "readiness_assessment": ""}}
    except Exception as e:
        return {"error": f"汇总生成失败：{e}"}


# --- Code Challenge ---

import json as _json

CODE_CHALLENGE_SYSTEM = """你是一位保研面试官，现在要给候选人出一道手撕代码题。根据候选人的研究背景（计算机/通信/AI方向），选择一道适合保研面试的编程题。

要求：
1. 难度相当于 LeetCode 中等偏易，适合 15-20 分钟内完成
2. 考察基础数据结构或算法（排序、字符串、DP、二叉树、图等）
3. 题目用中文描述，包含输入输出格式和示例
4. starter_code 只提供骨架（输入读取框架 + TODO 注释），不能包含任何解题逻辑

严格按 JSON 格式输出：
{
  "title": "题目标题",
  "description": "题目完整描述（含输入输出格式、数据范围）",
  "examples": [{"input": "示例输入", "output": "示例输出", "explanation": "解释（可选）"}],
  "language": "python",
  "starter_code": "# 骨架代码\\nimport sys\\ninput = sys.stdin.readline\\n\\n# TODO: 实现你的解法\\nn = int(input())\\n"
}"""

CODE_REVIEW_SYSTEM = """你是一位经验丰富的保研面试官，正在评审候选人提交的手撕代码。

请从面试官视角重点评估：
1. **代码正确性** — 逻辑是否正确，能否通过所有测试用例
2. **时间/空间复杂度** — 分析并指出是否有更优解
3. **代码规范性** — 命名、注释、代码结构
4. **边界情况** — 是否处理了空输入、极值等边界
5. **面试评价** — 该代码在面试中能否通过

请用 Markdown 格式给出详细评审，包括：
- 总体评价（能否过面试关）
- 具体问题（每条用 Markdown 列表）
- 改进建议（含示例代码片段）
- 时空复杂度分析（用 $O(...)$ LaTeX 格式）
- 综合评分（0-100分）"""


class CodeChallengeRequest(BaseModel):
    session_id: str


@router.post("/code_challenge")
async def get_code_challenge(req: CodeChallengeRequest):
    """Generate a coding challenge tailored to the candidate's background."""
    ctx = get_or_create_session(req.session_id)
    profile_hint = ctx.profile_summary[:600] if ctx.profile_summary else "理工科学生，计算机/通信方向"

    try:
        result = await collect_chat(
            CODE_CHALLENGE_SYSTEM,
            user_message=f"候选人背景：\n{profile_hint}\n\n请出一道适合该候选人的手撕代码题",
            timeout=60.0,
        )
        cleaned = result.strip()
        if cleaned.startswith("```"):
            cleaned = "\n".join(cleaned.split("\n")[1:])
        if cleaned.endswith("```"):
            cleaned = cleaned[: cleaned.rfind("```")]
        challenge = _json.loads(cleaned.strip())
        return {"ok": True, "challenge": challenge}
    except _json.JSONDecodeError:
        return {"ok": True, "challenge": {"title": "题目生成失败", "description": result, "examples": [], "language": "python", "starter_code": ""}}
    except Exception as e:
        return {"error": f"题目生成失败：{e}"}


class CodeReviewRequest(BaseModel):
    session_id: str
    problem: str
    code: str
    language: str = "python"


@router.post("/code_review")
async def review_code(req: CodeReviewRequest):
    """Stream a code review for the submitted code."""
    messages = [{"role": "user", "content": f"题目描述：\n{req.problem}\n\n候选人提交的代码（{req.language}）：\n```{req.language}\n{req.code}\n```"}]
    return StreamingResponse(
        stream_chat(CODE_REVIEW_SYSTEM, messages=messages),
        media_type="text/event-stream",
    )


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
