# 专业课模块完整测试说明

## 运行方式

```bash
cd /root/AskmeOffer
python -m tests.run_full_course_test
```

## 前置条件

1. 后端服务运行在 `localhost:8000`
2. 已配置 `LLM_API_KEY`（DeepSeek）

## 测试覆盖

| 步骤 | 接口 | 验证内容 |
|------|------|---------|
| 1 | POST /api/courses/start-exam | SSE 流式返回考官开场白 |
| 2 | POST /api/courses/exam-chat | 多轮对话正常返回 |
| 3 | POST /api/courses/end-exam | JSON 反馈含 knowledge_results |
| 4 | POST /api/courses/notebook | 返回分类知识点记录 |
| 5 | POST /api/courses/ask | AI 问答 SSE 流式返回 |

## 测试科目

- 高等数学/微积分
- 线性代数
