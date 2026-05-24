from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models.profile import UserProfile
from app.services.llm.client import stream_chat

router = APIRouter()


class GenerateRequest(BaseModel):
    profile: UserProfile
    type: str  # "resume" | "personal_statement"
    target_school: str = ""
    extra_instructions: str = ""


def _build_resume_prompt(profile: UserProfile, target_school: str) -> str:
    info = profile.basic_info
    sections = [
        f"# 个人简历生成请求",
        f"## 基本信息",
        f"姓名：{info.name}",
        f"本科院校：{info.university}",
        f"专业：{info.major}",
        f"排名：{info.rank}",
        f"GPA：{info.gpa}",
        f"均分：{info.avg_score}",
    ]

    if profile.course_scores:
        sections.append("\n## 核心课程成绩")
        for c in profile.course_scores:
            sections.append(f"- {c.name}：{c.score}")

    if profile.achievements:
        sections.append("\n## 个人成果")
        for a in profile.achievements:
            sections.append(f"- [{a.type}] {a.title}（{a.level}，{a.date}）{a.description}")

    if profile.projects:
        sections.append("\n## 项目经历")
        for p in profile.projects:
            sections.append(f"- {p.title}（{p.role}，{p.duration}）")
            sections.append(f"  技术栈：{p.tech_stack}")
            sections.append(f"  描述：{p.description}")
            sections.append(f"  个人贡献：{p.contribution}")

    if profile.student_work:
        sections.append("\n## 学生工作")
        for s in profile.student_work:
            sections.append(f"- {s.title} @ {s.organization}（{s.duration}）：{s.description}")

    if target_school:
        sections.append(f"\n## 目标院校：{target_school}")

    return "\n".join(sections)


def _build_statement_prompt(profile: UserProfile, target_school: str) -> str:
    base = _build_resume_prompt(profile, target_school)
    return base + "\n\n## 推荐信情况\n" + "\n".join(
        f"- {r.recommender_name}（{r.recommender_title}，{r.recommender_institution}）：{r.content_summary}"
        for r in profile.recommendations
    ) if profile.recommendations else base


RESUME_SYSTEM = """你是一个专业的保研简历撰写助手。根据用户提供的个人信息，生成一份针对保研申请的中文学术简历。
要求：
1. 格式清晰，使用 Markdown
2. 突出学术能力和研究潜力
3. 量化成果（排名、获奖等级、论文影响因子等）
4. 项目经历要体现技术深度和个人贡献
5. 语言简洁专业，适合学术场景"""

STATEMENT_SYSTEM = """你是一个专业的保研个人陈述撰写助手。根据用户的个人信息，生成一份针对保研申请的个人陈述。
要求：
1. 800-1200 字
2. 结构：个人背景 → 学术兴趣形成 → 研究/项目经历 → 未来规划
3. 真诚、有逻辑，避免空话套话
4. 体现对目标方向的理解和热情
5. 如果有目标院校信息，适当结合"""


@router.post("/stream")
async def generate_stream(req: GenerateRequest):
    if req.type == "resume":
        system = RESUME_SYSTEM
        user_msg = _build_resume_prompt(req.profile, req.target_school)
    else:
        system = STATEMENT_SYSTEM
        user_msg = _build_statement_prompt(req.profile, req.target_school)

    if req.extra_instructions:
        user_msg += f"\n\n## 额外要求\n{req.extra_instructions}"

    return StreamingResponse(
        stream_chat(system, user_msg),
        media_type="text/event-stream",
    )
