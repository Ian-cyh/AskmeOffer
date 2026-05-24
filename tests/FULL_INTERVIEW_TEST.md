# 面试模块完整测试说明

## 运行方式

```bash
cd /root/AskmeOffer
python -m tests.run_full_interview_test
```

## 前置条件

1. 后端服务运行在 `localhost:8000`
2. 已配置 `LLM_API_KEY`（DeepSeek）

## 测试覆盖

| 步骤 | 接口 | 验证内容 |
|------|------|---------|
| 1 | POST /api/interview/start | SSE 流式返回面试官开场白 |
| 2 | POST /api/interview/chat | 3 轮对话正常返回 |
| 3 | POST /api/interview/feedback | JSON 反馈含评分和建议 |
| 4 | GET /api/interview/session/{id} | 会话状态正确 |
