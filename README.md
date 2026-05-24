# AskmeOffer — 保研全流程 AI 助手

> 为正在准备保研（推免）的理工科本科生提供一站式 AI 辅助：个人信息管理、材料自动生成、模拟面试、专业课复习、机试训练。

---

## 项目简介

AskmeOffer 聚焦于**保研学生**在准备夏令营/预推免过程中的核心痛点：材料准备繁琐、面试练习无门、专业课复习缺少方向、导师信息获取困难。产品以个人信息为数据中心，联动简历生成、个人陈述、模拟面试等功能，构建保研准备的完整闭环。

## 核心功能模块

| 模块 | 功能 | 状态 |
|------|------|------|
| 个人信息 | 结构化录入 + AI 简历/个人陈述生成 + 目标院校管理 | 🔨 开发中 |
| 模拟面试 | 基于简历的 AI 面试（可调难度）+ 结构化反馈 | 📋 待开发 |
| 专业课 | 针对目标院校的知识点复习 + 模拟口试 | 📋 待开发 |
| 机试训练 | 针对院校风格的代码练习 + 薄弱点分析 | 📋 待开发 |

## 技术栈

| 层次 | 技术 |
|------|------|
| 前端 | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| 后端 | FastAPI (Python 3.11) |
| AI   | DeepSeek API（deepseek-v4-flash，OpenAI 兼容格式） |
| 数据库 | SQLite（开发） / PostgreSQL（生产） |
| 部署 | Vercel（前端） + 阿里云 ECS（后端） |

## 运行方式

### 环境要求
- Node.js >= 18
- Python >= 3.11
- DeepSeek API Key（[申请地址](https://platform.deepseek.com/api_keys)）

### 前端

```bash
cd frontend
npm install
cp .env.example .env.local   # 填入 API 地址
npm run dev
```

### 后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # 填入 LLM API Key
uvicorn app.main:app --reload
```

## 目录结构

```
AskmeOffer/
├── frontend/          # Next.js 前端
│   └── src/
│       ├── app/           # 页面路由
│       ├── components/    # UI 组件
│       │   ├── interview/ # 面试核心组件
│       │   ├── feedback/  # 反馈展示组件
│       │   └── ui/        # 通用 UI 组件
│       ├── lib/           # 工具函数 & API 客户端
│       └── types/         # TypeScript 类型定义
├── backend/           # FastAPI 后端
│   └── app/
│       ├── api/routes/    # HTTP 路由
│       ├── core/          # 配置、依赖注入
│       ├── models/        # 数据模型（ORM）
│       └── services/
│           ├── llm/       # LLM 调用封装
│           └── interview/ # 面试业务逻辑
├── docs/
│   ├── memo/          # Product Memo
│   └── research/      # 用户调研记录
├── scripts/           # 部署 & 工具脚本
├── REQUIREMENTS.md    # 需求分析
└── LOG.md             # 实验 & 迭代记录
```

## 作者

本项目为 AskmeOffer · 16 小时项目挑战提交作品（2026-05-24）。

- AI 工具使用：Cursor Agent（编码全程辅助）、LLM API（产品核心能力：简历生成、面试模拟、反馈生成）
- 所有代码在 AI 辅助下由本人独立完成，详见 LOG.md。
