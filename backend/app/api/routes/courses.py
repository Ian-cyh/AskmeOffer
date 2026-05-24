"""Professional course exam module."""

from __future__ import annotations

import json as json_mod
from dataclasses import dataclass, field
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.llm.client import stream_chat, collect_chat

router = APIRouter()

ALL_SUBJECTS: dict[str, list[str]] = {
    "高等数学/微积分": ["极限与连续", "一元函数微分", "一元函数积分", "多元函数微分", "多元函数积分", "级数", "微分方程"],
    "线性代数": ["行列式", "矩阵运算", "向量空间", "线性方程组", "特征值与特征向量", "二次型"],
    "概率论与数理统计": ["概率基础", "随机变量与分布", "数字特征", "大数定律与中心极限定理", "参数估计", "假设检验"],
    "数据结构": ["线性表", "栈与队列", "树与二叉树", "图", "查找算法", "排序算法", "哈希表"],
    "计算机网络": ["OSI与TCP/IP模型", "物理层与数据链路层", "网络层与IP", "传输层TCP/UDP", "应用层HTTP/DNS", "网络安全"],
    "操作系统": ["进程与线程", "处理机调度", "进程同步", "内存管理", "虚拟内存", "文件系统", "I/O管理"],
    "数字电路": ["数制与编码", "逻辑门与布尔代数", "组合逻辑电路", "时序逻辑电路", "存储器", "可编程逻辑器件"],
    "模拟电路": ["半导体基础", "放大电路", "运算放大器", "反馈电路", "信号处理电路", "功率放大电路"],
    "信号与系统": ["信号分类与运算", "LTI系统", "傅里叶变换", "拉普拉斯变换", "Z变换", "采样定理"],
    "通信原理": ["通信系统模型", "模拟调制", "数字基带传输", "数字调制", "信道编码", "扩频通信"],
}

MATH_SUBJECTS = ["高等数学/微积分", "线性代数", "概率论与数理统计"]

@dataclass
class PointRecord:
    questions_asked: list[str] = field(default_factory=list)
    wrong_answers: list[str] = field(default_factory=list)
    correct_answer: str = ""
    last_score: int = 0
    exam_dates: list[str] = field(default_factory=list)

_knowledge_maps: dict[str, dict[str, str]] = {}
_point_records: dict[str, dict[str, PointRecord]] = {}
_exam_contexts: dict[str, dict] = {}

COURSE_EXAM_SYSTEM = """你是一位严谨的大学专业课考官，正在对保研学生进行专业知识考核。

考核规则：
1. 每次只考一个知识点，针对该知识点提问
2. 如果学生回答正确，继续追问更深层的问题（最多追问 2-3 层）
3. 如果学生回答不上来或明显错误，简要指出后换下一个知识点
4. 提问要具体，考察真正的理解而非死记硬背
5. 使用中文，可以穿插必要的英文术语
6. 每次只问一个问题，等学生回答
7. 不要给出答案或过多提示
{comprehensive_note}
已考察知识点与掌握情况：
{points_status}

待考察知识点：{remaining_points}

开始考察时先简单说明考核科目，然后直接开始第一个问题。"""

COURSE_FEEDBACK_SYSTEM = """你是专业课考核评估专家。根据以下考核对话，生成结构化反馈。

严格按 JSON 格式输出（不要输出其他内容）：
{{
  "summary": "整体表现总结（100字以内）",
  "knowledge_results": [
    {{
      "point": "知识点名称",
      "status": "mastered/weak/not_tested",
      "score": 0-100,
      "detail": "具体评价",
      "suggested_answer": "该知识点的标准参考答案（简明扼要）",
      "wrong_answer_summary": "学生的错误/不完整回答摘要（如无错误则为空字符串）"
    }}
  ],
  "overall_score": 0-100,
  "weak_points": ["薄弱知识点1", "薄弱知识点2"],
  "next_focus": "下次复习建议"
}}"""

COURSE_ASK_SYSTEM = """你是一位专业课辅导老师，负责解答学生关于专业知识点的问题。

规则：
1. 回答要准确、简洁，适合考研/保研复习
2. 可以举例说明，但不要过于冗长
3. 如果涉及公式，使用 LaTeX：$...$ 行内，$$...$$ 独立公式
4. 使用 Markdown 格式
5. 如果学生问的是错题相关，帮助分析错误原因并给出正确理解"""


def _get_points_for_subject(subject: str) -> list[str]:
    if subject == "综合测试":
        pts = []
        for s in ALL_SUBJECTS.values():
            pts.extend(s)
        return pts
    return list(ALL_SUBJECTS.get(subject, []))


def _build_points_str(subject: str, session_id: str) -> tuple[str, str]:
    km = _knowledge_maps.get(session_id, {})
    all_pts = _get_points_for_subject(subject)
    tested = []
    remaining = []
    for p in all_pts:
        status = km.get(p, "not_tested")
        if status != "not_tested":
            tested.append(f"  - {p}：{status}")
        else:
            remaining.append(p)
    tested_str = "\n".join(tested) if tested else "（尚未考察）"
    remaining_str = "、".join(remaining) if remaining else "（已全部考察）"
    return tested_str, remaining_str


def _update_map(session_id: str, feedback_data: dict):
    if session_id not in _knowledge_maps:
        _knowledge_maps[session_id] = {}
    if session_id not in _point_records:
        _point_records[session_id] = {}
    km = _knowledge_maps[session_id]
    pr = _point_records[session_id]
    from datetime import date
    today = date.today().isoformat()
    for kr in feedback_data.get("knowledge_results", []):
        pt = kr.get("point", "")
        if not pt:
            continue
        km[pt] = kr.get("status", "not_tested")
        if pt not in pr:
            pr[pt] = PointRecord()
        rec = pr[pt]
        rec.last_score = kr.get("score", 0)
        if today not in rec.exam_dates:
            rec.exam_dates.append(today)
        detail = kr.get("detail", "")
        if detail and detail not in rec.questions_asked:
            rec.questions_asked.append(detail)
        wrong = kr.get("wrong_answer_summary", "")
        if wrong and wrong not in rec.wrong_answers:
            rec.wrong_answers.append(wrong)
        sa = kr.get("suggested_answer", "")
        if sa and len(sa) > len(rec.correct_answer):
            rec.correct_answer = sa


class ExamStartRequest(BaseModel):
    subject: str
    session_id: str = ""
    voice: bool = False

class ExamChatRequest(BaseModel):
    session_id: str
    user_message: str

class ExamEndRequest(BaseModel):
    session_id: str
    history: list[dict] = []

class NotebookRequest(BaseModel):
    session_id: str

class AskRequest(BaseModel):
    question: str
    context_point: str = ""
    history: list[dict] = []


@router.post("/start-exam")
async def start_exam(req: ExamStartRequest):
    import uuid
    session_id = req.session_id or str(uuid.uuid4())
    if session_id not in _knowledge_maps:
        _knowledge_maps[session_id] = {}

    tested_str, remaining_str = _build_points_str(req.subject, session_id)
    comprehensive_note = "\n注意：这是综合测试，需要覆盖所有学科的知识点。\n" if req.subject == "综合测试" else ""

    system = COURSE_EXAM_SYSTEM.format(
        comprehensive_note=comprehensive_note,
        points_status=tested_str,
        remaining_points=remaining_str,
    )

    _exam_contexts[session_id] = {
        "subject": req.subject,
        "system": system,
        "history": [],
    }

    initial_msg = [{"role": "user", "content": f"你好，我准备好了，请开始{req.subject}的考核。"}]

    async def generate():
        full = ""
        async for chunk in stream_chat(system, messages=initial_msg):
            full += chunk.replace("data: ", "").strip()
            yield chunk
        ctx = _exam_contexts.get(session_id, {})
        ctx["history"] = [
            {"role": "user", "content": f"你好，我准备好了，请开始{req.subject}的考核。"},
            {"role": "assistant", "content": full},
        ]

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"X-Session-Id": session_id},
    )


@router.post("/exam-chat")
async def exam_chat(req: ExamChatRequest):
    ctx = _exam_contexts.get(req.session_id, {})
    system = ctx.get("system", "你是专业课考官。")
    history = ctx.get("history", [])
    history.append({"role": "user", "content": req.user_message})

    async def generate():
        full = ""
        async for chunk in stream_chat(system, messages=history):
            full += chunk.replace("data: ", "").strip()
            yield chunk
        history.append({"role": "assistant", "content": full})

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/end-exam")
async def end_exam(req: ExamEndRequest):
    ctx = _exam_contexts.get(req.session_id, {})
    history = req.history if req.history else ctx.get("history", [])
    subject = ctx.get("subject", "未知")

    if len(history) < 2:
        return {"error": "对话太短，无法生成反馈"}

    conversation = "\n".join(
        f"{'考官' if m['role'] == 'assistant' else '学生'}：{m['content']}"
        for m in history
    )

    result = await collect_chat(
        COURSE_FEEDBACK_SYSTEM,
        user_message=f"考核科目：{subject}\n\n对话记录：\n{conversation}",
        timeout=120.0,
    )

    cleaned = result.strip()
    if cleaned.startswith("```"):
        cleaned = "\n".join(cleaned.split("\n")[1:])
    if cleaned.endswith("```"):
        cleaned = cleaned[:cleaned.rfind("```")]
    try:
        feedback = json_mod.loads(cleaned.strip())
    except json_mod.JSONDecodeError:
        feedback = {"summary": result, "knowledge_results": [], "overall_score": 0, "weak_points": [], "next_focus": ""}

    _update_map(req.session_id, feedback)

    return {"ok": True, "feedback": feedback}


@router.post("/notebook")
async def get_notebook(req: NotebookRequest):
    pr = _point_records.get(req.session_id, {})
    result = {"weak": {}, "mastered": {}, "not_tested": {}}
    km = _knowledge_maps.get(req.session_id, {})
    for pt, rec in pr.items():
        status = km.get(pt, "not_tested")
        cat = status if status in result else "not_tested"
        result[cat][pt] = {
            "questions_asked": rec.questions_asked,
            "wrong_answers": rec.wrong_answers,
            "correct_answer": rec.correct_answer,
            "last_score": rec.last_score,
            "exam_dates": rec.exam_dates,
        }
    return result


@router.post("/ask")
async def ask_question(req: AskRequest):
    context = ""
    if req.context_point:
        context = f"\n\n学生正在复习的知识点：{req.context_point}"

    messages = list(req.history) if req.history else []
    messages.append({"role": "user", "content": req.question})

    system = COURSE_ASK_SYSTEM + context

    return StreamingResponse(
        stream_chat(system, messages=messages),
        media_type="text/event-stream",
    )
