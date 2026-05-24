from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.llm.client import stream_chat

router = APIRouter()


class InterviewRequest(BaseModel):
    resume_summary: str
    difficulty: str = "standard"  # easy / standard / pressure
    history: list[dict] = []
    user_message: str = ""


DIFFICULTY_MAP = {
    "easy": "温和友善，以鼓励为主，提问难度适中，不做过多追问",
    "standard": "专业严谨，会就回答中的细节追问 1-2 层，评估深度理解",
    "pressure": "严格高压，频繁追问细节和边界情况，模拟真实压力面试，会质疑回答中的不严谨之处",
}

INTERVIEW_SYSTEM = """你是一位经验丰富的保研面试官，正在对一位申请研究生的本科生进行模拟面试。

面试规则：
1. 基于候选人的简历内容提问，重点考察项目经历的技术深度和个人贡献
2. 每次只问一个问题，等候选人回答后再继续
3. 根据回答质量决定是追问还是换下一题
4. 追问要具体，针对回答中的薄弱点或模糊之处
5. 面试风格：{difficulty_desc}
6. 使用中文交流
7. 保持面试官的角色，不要给出答案或提示

面试开始时先简单问候，然后从自我介绍开始。"""


@router.post("/chat")
async def interview_chat(req: InterviewRequest):
    difficulty_desc = DIFFICULTY_MAP.get(req.difficulty, DIFFICULTY_MAP["standard"])
    system = INTERVIEW_SYSTEM.format(difficulty_desc=difficulty_desc)
    system += f"\n\n候选人简历摘要：\n{req.resume_summary}"

    messages = []
    for msg in req.history:
        messages.append(msg)

    if req.user_message:
        messages.append({"role": "user", "content": req.user_message})
    elif not messages:
        messages.append({"role": "user", "content": "你好，我准备好了，请开始面试。"})

    return StreamingResponse(
        stream_chat(system, messages=messages),
        media_type="text/event-stream",
    )
