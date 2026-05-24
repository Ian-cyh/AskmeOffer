# AskmeOffer — 保研全流程 AI 助手

> 为正在准备保研（推免）的理工科本科生提供一站式 AI 辅助：个人信息管理、材料自动生成、AI 模拟面试（文字 & 语音）、专业课知识点考核、机试训练。

---

## 核心功能模块

| 模块 | 功能 | 状态 |
|------|------|------|
| 个人信息 | 结构化录入 + AI 简历/个人陈述一键生成 + 目标院校管理 | ✅ 可用 |
| 模拟面试 | 文字/语音双模式 AI 面试 · 难度调节 · 手撕代码 · 结构化反馈 · 历史汇总 | ✅ 可用 |
| 专业课 | 文字/语音双模式知识点考核 · 错题本 · AI 答疑 · 知识地图 | ✅ 可用 |
| 机试训练 | AI 出题 · 在线编译运行 · 代码评审与薄弱点分析 | ✅ 可用 |

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 前端 | Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui |
| 后端 | FastAPI (Python 3.11) · WebSocket · SSE |
| AI 服务 | DeepSeek API（LLM）· 阿里云 DashScope Paraformer（语音识别）· Microsoft Edge TTS（语音合成） |
| 持久化 | 浏览器 localStorage（无需数据库） |

---

## 快速开始

### 前置要求

- **Node.js** >= 18
- **Python** >= 3.11
- **DeepSeek API Key**（[申请地址](https://platform.deepseek.com/api_keys)）
- **阿里云 DashScope API Key**（Paraformer 语音识别，可选；[申请地址](https://dashscope.aliyun.com/)）

---

### 1. 克隆仓库

```bash
git clone https://github.com/Ian-cyh/AskmeOffer.git
cd AskmeOffer
```

---

### 2. 后端配置 & 启动

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入以下内容：
#   LLM_API_KEY=sk-xxxxxxxxxxxxxxxx          # DeepSeek API Key
#   DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx    # 阿里云 API Key（Paraformer ASR）
#   LLM_BASE_URL=https://api.deepseek.com
#   LLM_MODEL=deepseek-chat

# 启动后端（默认监听 0.0.0.0:8000）
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

> 后端启动后可访问 `http://localhost:8000/docs` 查看 API 文档。

---

### 3. 前端配置 & 启动

```bash
cd frontend

# 安装依赖
npm install

# 配置后端地址（本地开发可跳过，默认读取 localhost:8000）
cp .env.example .env.local
# 若后端运行在其他地址，编辑 .env.local：
#   NEXT_PUBLIC_API_URL=http://<服务器IP>:8000

# 开发模式启动（默认监听 3000 端口）
npm run dev

# 或生产构建
npm run build && npm start
```

前端启动后访问 `http://localhost:3000`。

---

### 4. 远程服务器访问（可选）

若后端部署在远程服务器（如 `172.27.36.198`），前端本地访问时需在 `.env.local` 中指定：

```
NEXT_PUBLIC_API_URL=http://172.27.36.198:8000
NEXT_PUBLIC_WS_URL=ws://172.27.36.198:8000
```

也可通过 SSH 端口转发在本地访问：

```bash
ssh -L 3000:localhost:3000 -L 8000:localhost:8000 user@172.27.36.198
```

---

## 使用指南

### 个人信息模块
1. 点击「个人信息」→ 填写基本信息、成绩、成果、项目经历、目标院校及导师信息
2. 点击「生成简历」→ AI 自动生成 LaTeX 风格排版的简历预览，可导出 PDF/Word

### 模拟面试模块
1. 选择难度（轻松 / 标准 / 挑战）
2. 可选填写导师信息（AI 将扮演该导师进行提问），选择 TTS 音色
3. 点击「开始面试」
   - **文字模式**：在输入框打字回答
   - **语音模式**：面试官说完后自动开始录音（2 秒静音自动提交），也可点击麦克风手动控制
4. 消息达到 4 条后出现「手撕代码」按钮，可进行实时编程考核
5. 面试结束后点击「结束并获取反馈」生成结构化评分报告
6. 支持面试中断后下次继续（页面加载时弹窗询问）

### 专业课模块
1. 选择科目（微积分 / 线性代数 / 概率论 / 数据结构 / 操作系统 / 综合测试）
2. 选择考核模式（文字 / 语音）
3. AI 对每个知识点逐一提问，直到无法回答为止
4. 考核结束自动生成反馈、更新知识地图与错题本
5. 「AI 答疑」标签可向 AI 提问任意知识点
6. 「错题本」显示所有历史错误，「知识地图」展示全局掌握进度

### 机试训练模块
1. 选择难度后点击「生成题目」
2. 在编辑器中编写完整程序（需自行处理 stdin/stdout）
3. 点击「运行」执行代码，支持自定义输入
4. 点击「提交评测」获取 AI 代码评审（正确性 / 复杂度 / 风格 / 边界情况）

---

## 目录结构

```
AskmeOffer/
├── frontend/                  # Next.js 前端
│   └── src/
│       ├── app/               # 页面路由
│       │   ├── page.tsx       # 首页
│       │   ├── profile/       # 个人信息页
│       │   ├── interview/     # 模拟面试页
│       │   ├── courses/       # 专业课页
│       │   └── coding/        # 机试训练页
│       ├── components/
│       │   ├── interview/     # CodeEditor 等面试组件
│       │   ├── profile/       # 简历生成、历史记录等
│       │   └── ui/            # 通用 UI 组件
│       └── lib/
│           ├── store.ts       # localStorage 持久化
│           ├── demoData.ts    # 演示用户数据
│           └── testData.ts    # 测试数据加载入口
├── backend/
│   └── app/
│       ├── api/routes/
│       │   ├── interview.py   # 文字面试 API
│       │   ├── voice.py       # 语音面试 WebSocket
│       │   ├── courses.py     # 专业课考核 API
│       │   ├── coding.py      # 机试训练 API
│       │   └── profile.py     # 简历生成 API
│       ├── services/
│       │   ├── llm/           # DeepSeek LLM 封装
│       │   └── voice/         # Edge TTS & Paraformer ASR
│       └── models/            # Pydantic 数据模型
├── LOG.md                     # 开发迭代记录
└── REQUIREMENTS.md            # 需求文档
```

---

## 常见问题

**Q: 语音面试没有声音？**  
A: 确保后端 `.env` 中填写了有效的 `LLM_API_KEY`，Edge TTS 需要联网。浏览器首次使用需允许麦克风权限。

**Q: Paraformer 语音识别失败？**  
A: 确认 `.env` 中 `DASHSCOPE_API_KEY` 已填写，且阿里云账户有余额。语音识别为可选功能，文字模式不需要此 Key。

**Q: 前端显示 API 连接失败？**  
A: 确认后端已启动（`uvicorn app.main:app --host 0.0.0.0 --port 8000`），并检查 `NEXT_PUBLIC_API_URL` 配置是否正确。

**Q: 如何重置所有数据？**  
A: 所有数据存储在浏览器 localStorage 中，打开浏览器开发者工具 → Application → Local Storage → 清除对应域名的数据即可。

---

## 作者

本项目为 AskmeOffer · 16 小时项目挑战提交作品（2026-05-24）。

- AI 工具使用：Cursor Agent（编码全程辅助）、DeepSeek / Edge TTS / Paraformer（产品核心 AI 能力）
- 所有代码在 AI 辅助下由本人独立完成，详见 [LOG.md](./LOG.md)
