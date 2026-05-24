"""Interview session store — in-memory for now."""

from app.models.interview import InterviewContext
from app.models.profile import UserProfile

_sessions: dict[str, InterviewContext] = {}

# ASR 纠错系统提示 — 注入到 interviewer 的 system 中
ASR_NOTICE = """
【重要提示】候选人的回答来自语音识别（ASR），可能存在以下识别错误：
- 专业术语被识别为相似读音的普通词（如"衍射"→"演社"，"高斯"→"高丝瓜"）
- 英文缩写被错误识别（如"DOE"→"doe"，"Gaussian"→"高斯演"）
- 句子结构因停顿被打乱

请根据候选人的研究背景和面试上下文，推断其真实意图后再评价或追问。不要因识别错误而错误评价候选人。
"""


def get_or_create_session(session_id: str) -> InterviewContext:
    if session_id not in _sessions:
        _sessions[session_id] = InterviewContext(session_id=session_id)
    return _sessions[session_id]


def reset_session(session_id: str) -> InterviewContext:
    _sessions[session_id] = InterviewContext(session_id=session_id)
    return _sessions[session_id]


def build_profile_summary(profile: UserProfile) -> str:
    """Build a comprehensive profile summary for the interviewer."""
    info = profile.basic_info
    parts = []

    # Basic info
    parts.append("=== 候选人基本信息 ===")
    parts.append(f"姓名：{info.name}")
    parts.append(f"院校：{info.university}")
    parts.append(f"专业：{info.major}")
    parts.append(f"排名：{info.rank}")
    parts.append(f"GPA：{info.gpa}")
    parts.append(f"均分：{info.avg_score}")
    if info.self_intro:
        parts.append(f"自我介绍：{info.self_intro}")

    # Courses
    if profile.course_scores:
        parts.append("\n=== 核心课程成绩 ===")
        for c in profile.course_scores:
            parts.append(f"- {c.name}：{c.score}")

    # Achievements
    if profile.achievements:
        parts.append("\n=== 学术成果 ===")
        for a in profile.achievements:
            type_label = {"competition": "竞赛", "paper": "论文", "honor": "荣誉"}.get(a.type, a.type)
            parts.append(f"- [{type_label}] {a.title}")
            if a.level:
                parts.append(f"  级别：{a.level}")
            if a.date:
                parts.append(f"  时间：{a.date}")
            if a.description:
                parts.append(f"  描述：{a.description}")

    # Projects (critical for interview)
    if profile.projects:
        parts.append("\n=== 项目经历（面试重点考察） ===")
        for p in profile.projects:
            parts.append(f"\n项目：{p.title}")
            parts.append(f"角色：{p.role}")
            parts.append(f"时间：{p.duration}")
            parts.append(f"技术栈：{p.tech_stack}")
            parts.append(f"项目描述：{p.description}")
            parts.append(f"个人贡献：{p.contribution}")

    # Student work
    if profile.student_work:
        parts.append("\n=== 学生工作 ===")
        for s in profile.student_work:
            parts.append(f"- {s.title} @ {s.organization}（{s.duration}）：{s.description}")

    # Recommendations
    if profile.recommendations:
        parts.append("\n=== 推荐信 ===")
        for r in profile.recommendations:
            parts.append(f"- {r.recommender_name}（{r.recommender_title}，{r.recommender_institution}）")
            parts.append(f"  关系：{r.relationship}")

    # Target schools
    if profile.target_schools:
        parts.append("\n=== 目标院校 ===")
        for s in profile.target_schools:
            parts.append(f"- {s.school_name} {s.department}（导师：{s.advisor_name}，方向：{s.advisor_direction}）")

    return "\n".join(parts)
