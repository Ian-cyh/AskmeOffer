"""Coding test module — problem generation, progressive hints, code review."""

from __future__ import annotations

import json as json_mod
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.llm.client import stream_chat, collect_chat

router = APIRouter()

TOPICS = [
    "数组与双指针", "字符串处理", "链表操作", "栈与队列", "哈希表",
    "二叉树与递归", "动态规划", "二分查找", "排序算法", "贪心算法",
    "图与BFS/DFS", "数学与位运算", "综合题目",
]

DIFFICULTY_GUIDE = {
    "easy":   "简单（适合15-20分钟完成，考察基本数据结构和简单算法，如两数之和、反转链表）",
    "medium": "中等（适合25-35分钟完成，需要综合多个知识点，如最长公共子序列、滑动窗口最大值）",
    "hard":   "困难（适合40-60分钟完成，需要复杂算法设计，如最小生成树、复杂DP优化）",
}

GENERATE_SYSTEM = """你是一位算法竞赛出题专家，专门为保研机试设计算法题目。

生成一道算法题，**严格**按以下 JSON 格式输出（不要输出任何其他内容，不要加 ```json 代码块）：
{{
  "title": "题目名称（简洁，如「两数之和」）",
  "description": "题目描述（2-4段。**必须**明确说明输入格式和输出格式，如"第一行一个整数 n，第二行 n 个整数..."。使用 Markdown）",
  "examples": [
    {{"input": "原始 stdin 示例（与 test_cases 格式完全一致，多行用真实换行）", "output": "原始 stdout 示例（精确文本）", "explanation": "简要解释（可选）"}},
    {{"input": "输入示例2", "output": "输出示例2"}}
  ],
  "constraints": ["1 ≤ n ≤ 10^5", "其他约束条件"],
  "topic": "{topic}",
  "difficulty": "{difficulty}",
  "tags": ["具体算法标签"],
  "starter_code": {{
    "python": "# 从标准输入读取，将结果打印到标准输出\\nimport sys\\ninput = sys.stdin.readline\\n\\n# TODO: 在此编写你的解法\\n\\nn = int(input().strip())\\n# ...",
    "cpp": "#include <bits/stdc++.h>\\nusing namespace std;\\n\\nint main() {{\\n    ios::sync_with_stdio(false);\\n    cin.tie(nullptr);\\n\\n    // TODO: 在此编写你的解法\\n\\n    return 0;\\n}}",
    "c": "#include <stdio.h>\\n#include <stdlib.h>\\n\\nint main() {{\\n    // TODO: 在此编写你的解法\\n\\n    return 0;\\n}}"
  }},
  "test_cases": [
    {{"input": "完整 stdin 文本（多行用 \\n 分隔，末尾无多余空行）", "expected": "完整 stdout 文本（精确匹配，注意末尾换行）"}},
    {{"input": "测试输入2", "expected": "期望输出2"}},
    {{"input": "边界情况输入", "expected": "边界期望输出"}}
  ]
}}

规则（严格遵守）：
1. 题目必须是经典算法问题，适合{difficulty_guide}
2. **学生需要编写完整程序**：自己从 stdin 读取输入，将结果 print/printf 到 stdout
3. description 中必须详细说明输入格式（行数、每行内容、数据类型）和输出格式
4. test_cases 的 input 是完整的 stdin 原始字符串，expected 是精确的 stdout 字符串（含换行）
5. 有 3-5 个测试用例（含边界情况），每个都要能正确匹配
6. Constraints 必须包含数据规模（n 的范围、时间限制等）
7. **starter_code 只是输入读取骨架，绝对不能包含任何解法逻辑**——只保留 import/include、读输入的代码骨架和 TODO 注释，核心算法部分由学生自己实现
8. description 用 Markdown，数学公式用 $...$ LaTeX
9. 绝对不要输出 JSON 以外的任何内容"""

HINT_SYSTEM = """你是一位算法辅导老师，正在给学生做渐进式提示。

**绝对禁止**直接给出完整代码或完整算法，保留学生思考空间。

根据提示轮次（hint_round）给出不同深度的提示：
- round 1：只给方向和直觉，如"这道题可以用什么数据结构？"
- round 2：给出核心思路和算法框架，不给代码
- round 3：给出关键步骤的伪代码
- round 4+：可以给出关键片段（非完整代码）

输出使用 Markdown + LaTeX，简洁直接，每次提示 100-200 字为宜。"""

REVIEW_SYSTEM = """你是一位资深算法工程师，正在对候选人的代码进行专业复盘。

请对提交的代码进行全面评审，严格按以下 JSON 格式输出（不要输出其他内容）：
{{
  "correctness": "代码逻辑正确性分析（是否通过所有测试？边界处理？）",
  "time_complexity": "时间复杂度分析（用 $O(...)$ 格式）",
  "space_complexity": "空间复杂度分析",
  "code_quality": "代码质量评价（命名、可读性、边界处理、代码风格）",
  "bugs": ["具体bug描述（如有）"],
  "optimizations": ["具体优化建议1", "优化建议2"],
  "standard_approach": "最优解思路说明（Markdown格式，不直接给完整代码）",
  "standard_code": "标准解法完整代码（Python，含详细注释，适合复习参考）",
  "score": 整数0-100,
  "grade": "A/B/C/D",
  "summary": "一句话总结（20字以内）"
}}

不要输出 JSON 以外的任何内容"""


class GenerateRequest(BaseModel):
    topic: str = "综合题目"
    difficulty: str = "medium"
    exclude_titles: list[str] = []


class HintRequest(BaseModel):
    problem_title: str
    problem_description: str
    current_code: str
    hint_round: int = 1
    language: str = "python"


class ReviewRequest(BaseModel):
    problem_title: str
    problem_description: str
    code: str
    language: str = "python"
    run_output: str = ""
    test_results: list[dict] = []


@router.get("/topics")
async def list_topics():
    return {"topics": TOPICS}


@router.post("/generate")
async def generate_problem(req: GenerateRequest):
    excl = f"\n\n已有题目（不要重复出题）：{', '.join(req.exclude_titles)}" if req.exclude_titles else ""
    system = GENERATE_SYSTEM.format(
        topic=req.topic,
        difficulty=req.difficulty,
        difficulty_guide=DIFFICULTY_GUIDE.get(req.difficulty, req.difficulty),
    )
    user_msg = f"出一道【{req.topic}】方向的【{req.difficulty}】难度算法题。{excl}"
    return StreamingResponse(
        stream_chat(system, user_msg),
        media_type="text/event-stream",
    )


@router.post("/hint")
async def get_hint(req: HintRequest):
    user_msg = f"""题目：{req.problem_title}

题目描述：
{req.problem_description}

当前代码（{req.language}）：
```
{req.current_code or "（学生尚未写代码）"}
```

这是第 {req.hint_round} 次提示请求。请给出第 {req.hint_round} 层次的渐进提示。"""
    return StreamingResponse(
        stream_chat(HINT_SYSTEM, user_msg),
        media_type="text/event-stream",
    )


@router.post("/review")
async def review_code(req: ReviewRequest):
    test_summary = ""
    if req.test_results:
        passed = sum(1 for t in req.test_results if t.get("passed"))
        test_summary = f"\n\n测试结果：{passed}/{len(req.test_results)} 通过\n"
        for t in req.test_results:
            status = "✓" if t.get("passed") else "✗"
            test_summary += f"{status} 输入：{t.get('input','')} | 期望：{t.get('expected','')} | 实际：{t.get('actual','')}\n"

    user_msg = f"""题目：{req.problem_title}

题目描述：
{req.problem_description}

提交代码（{req.language}）：
```{req.language}
{req.code}
```{test_summary}
{'运行输出：' + req.run_output if req.run_output else ''}

请进行全面代码评审。"""

    result = await collect_chat(REVIEW_SYSTEM, user_message=user_msg, timeout=120.0)

    cleaned = result.strip()
    if cleaned.startswith("```"):
        cleaned = "\n".join(cleaned.split("\n")[1:])
    if cleaned.endswith("```"):
        cleaned = cleaned[:cleaned.rfind("```")]
    try:
        return {"ok": True, "review": json_mod.loads(cleaned.strip())}
    except json_mod.JSONDecodeError:
        return {"ok": True, "review": {
            "correctness": result, "time_complexity": "", "space_complexity": "",
            "code_quality": "", "bugs": [], "optimizations": [],
            "standard_approach": "", "standard_code": "",
            "score": 0, "grade": "D", "summary": "解析失败",
        }}
