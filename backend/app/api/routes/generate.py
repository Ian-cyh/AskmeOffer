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

严格按照以下 Markdown 排版格式输出：

```
# 姓名
电话：xxx | 邮箱：xxx
政治面貌    本科院校

## 教育背景
**院校名称**    专业（本科在读）    时间：xxxx年-至今
GPA：x.xx/4.00    课程均分：xx.x/100    专业排名：x/xx
外语技能：CET-4: xxx    CET-6: xxx
主课成绩：课程名(分数)  课程名(分数) ...
专业技能：xxx

## 论文成果
**论文标题**
（期刊/会议名称 级别）  作者排名
链接（如有）
（每篇论文用上述格式，按重要性排序）

## 科研项目经历
**项目名称**    时间段
项目简介：一段话概述项目背景和目标
个人任务：具体工作内容和职责
项目成果：量化成果（数据指标、论文产出、获奖等）
（每个项目用上述三段式格式）

## 荣誉奖项
年份    奖项名称    级别
（按 国家级 > 省级 > 校级 排序，同级按时间倒序）

## 综合素质
- 学生工作经历
- 个人特质（简洁）
```

要求：
1. 严格遵循上述排版结构，不要遗漏任何板块
2. 突出学术能力和研究潜力
3. 所有成果必须量化（排名、百分比、指标数值等）
4. 项目经历用「项目简介 → 个人任务 → 项目成果」三段式
5. 论文按 CCF-A / SCI 分区等重要性排序
6. 语言简洁专业，避免空话套话
7. 控制在 2 页以内"""

STATEMENT_SYSTEM = """你是一个专业的保研个人陈述撰写助手。根据用户的个人信息，生成一份针对保研申请的个人陈述。

要求：
1. 800-1200 字，使用 Markdown 格式输出
2. 结构清晰，分为以下 4 个部分：
   - **个人背景与学术基础**：院校、专业、成绩亮点，建立学术可信度
   - **学术兴趣与研究探索**：如何形成研究兴趣，重点描述 1-2 个最核心的科研项目，体现技术深度
   - **学术成果与综合能力**：论文发表、竞赛获奖、领导力等，用数据说话
   - **未来规划与研究展望**：读研期间的研究计划，与目标院校/导师方向的契合
3. 真诚、有逻辑、有细节，避免空话套话
4. 体现对目标研究方向的深度理解和热情
5. 如果有目标院校/导师信息，自然融入文中
6. 语气：学术但不生硬，自信但不自大"""


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
