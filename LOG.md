# 实验与迭代记录 · LOG

> 项目：AskmeOffer — 保研全流程 AI 助手  
> 挑战时间：2026-05-24 08:00 → 24:00（共 16 小时）

---

## 记录规范

每条记录格式：

```
### [HH:MM] 标题
- **做了什么**：
- **遇到什么问题**：
- **怎么解决的**：
- **结论 / 下一步**：
```

---

## 第一阶段：产品规划（08:00 – 09:15）

### [08:00] 阅读挑战说明，明确目标

- **做了什么**：通读 PDF，提取关键约束（截止时间、交付物清单、评分维度）
- **结论**：核心评分维度是"真实理解用户"+"可用产品闭环"，功能数量不是重点。做深做窄。

### [08:15] 搭建项目框架

- **做了什么**：使用 Cursor 生成目录结构、README、需求分析模板、LOG 模板
- **AI 工具使用**：Cursor Agent 模式生成初始框架

### [08:45] 目标用户聚焦 & 痛点梳理

- **做了什么**：反复思考挑战说明中"做深做窄"的要求，最终决定聚焦到一个非常具体的群体——**保研的理工科学生**。
- **为什么选保研而不是大厂实习面试**：
  - 大厂面试类产品已经很多（牛客、面试鸭等），很难做出差异化
  - 保研流程复杂且碎片化（专业课、机试、面试、导师联系、材料准备），现有工具覆盖极少
  - 保研学生的痛点更集中、更可被一个产品闭环解决
- **结论**：目标用户 = 正在准备保研的理工科本科生（大三为主）

### [09:00] 核心痛点深度分析

- **做了什么**：基于个人经验和对保研流程的理解，梳理出 5 大核心痛点

**痛点 1：专业课考核准备无方向**
- 不同院校考核科目差异大，不知道该重点复习什么
- 缺乏针对性的模拟测试，真实考核时手忙脚乱

**痛点 2：上机代码考核缺乏针对性训练**
- 各院校机试题风格不同（有的偏算法竞赛，有的偏工程应用）
- LeetCode 刷了很多，但不知道目标院校到底考什么

**痛点 3：面试准备碎片化、缺乏结构**
- 项目经历讲不透：自己做的项目说不清楚技术细节和个人贡献
- 压力面应对差：面试官追问时大脑一片空白，越紧张越答不好
- 面试重点把握不准：不知道面试官最关注什么，准备方向偏了

**痛点 4：导师/院校信息获取困难**
- 需要大量时间调研导师方向、代表作、招生偏好
- 信息散落在各种网站、论坛、学长口中，没有统一管理

**痛点 5：个人材料管理繁琐**
- 保研需要准备简历、个人陈述、推荐信、成绩单等大量材料
- 针对不同院校需要微调，版本管理混乱
- 每次修改个人信息后，所有材料都要手动同步

### [09:15] 第一版 Demo 设计 — 四大模块定义

- **做了什么**：划定产品的四大功能模块和第一版 Demo 的开发优先级

#### 模块 1：个人信息模块 ⭐ 第一优先级

**核心功能**：
- 结构化录入个人信息（基本信息、成绩、成果、经历）
  - 本科院校、专业、排名、GPA、均分
  - 核心课程得分
  - 个人成果：竞赛、论文、个人荣誉
  - 项目经历、学生工作
  - 推荐信信息
- AI 自动生成个人简历和个人陈述
- 信息修改后自动更新简历 & 个人陈述
- 个人反馈中心：汇总模拟面试 / 专业课 / 机考历史结果，生成能力画像
- 目标院校信息管理：院校信息、导师方向、代表作、联系进度

**为什么先做这个**：
- 个人信息是所有其他模块的数据基础（面试需要基于简历提问，专业课需要知道目标院校）
- 材料生成是立刻可见的产品价值，用户感知强
- 技术实现路径清晰，能在有限时间内做出完整闭环

#### 模块 2：面试模块

- 基于个人信息进行模拟面试
- 可调节面试难度（简单 / 标准 / 压力面）
- 根据简历内容生成个性化题目（项目追问、知识点考察）
- 结构化反馈

#### 模块 3：专业课模块

- 针对目标院校设计专业课复习路径
- 知识点模拟问答
- 生成复习反馈

#### 模块 4：机试模块

- 针对院校机试风格推荐练习题
- 代码实战模拟
- 知识点薄弱分析

**开发策略**：个人信息模块做完整实现，面试模块做可交互 Demo，专业课 & 机试模块做前端框架 + 占位页面

- **结论 / 下一步**：立刻开始个人信息模块的详细设计和前后端开发

---

## 第二阶段：核心功能开发（09:15 – 16:00）

### [09:15] 第一版 Demo 全栈开发

- **做了什么**：
  - 前端：Next.js 14 项目初始化，安装 Tailwind CSS + lucide-react
  - 搭建侧边栏导航 + 四模块页面路由（首页/个人信息/面试/专业课/机试）
  - 个人信息模块完整实现：5 个 Tab（基本信息/成绩与成果/经历/目标院校/材料生成）
  - 所有表单支持动态增删条目（课程、成果、项目、推荐人、目标院校）
  - 数据使用 localStorage 持久化
  - AI 材料生成页面：支持选择生成类型（简历/个人陈述）、目标院校、额外要求，SSE streaming 输出
  - 面试模块 Demo：对话式 UI，支持难度选择（简单/标准/压力面），基于简历内容提问
  - 专业课 & 机试模块：占位页面，展示即将推出的功能预览
  - 后端：FastAPI 项目搭建，3 个路由模块（profile/generate/interview）
  - LLM 客户端封装：支持 OpenAI 兼容格式的 SSE streaming
- **结论 / 下一步**：前端 `npx next build` 零错误通过，后端依赖安装完成。下一步配置 DeepSeek API

### [09:35] 切换 LLM 为 DeepSeek API

- **做了什么**：
  - 将默认 LLM 从 OpenAI 切换为 DeepSeek API
  - `LLM_API_BASE` 改为 `https://api.deepseek.com`
  - `LLM_MODEL` 改为 `deepseek-v4-flash`（DeepSeek 最新模型，性价比高）
  - 修复 URL 拼接：DeepSeek 的 endpoint 是 `https://api.deepseek.com/chat/completions`（无 `/v1` 前缀），用 `rstrip('/')` 防止双斜杠
  - 更新 `.env.example`、`config.py`、`README.md`
- **为什么选 DeepSeek**：
  - DeepSeek API 兼容 OpenAI 格式，代码改动量极小
  - `deepseek-v4-flash` 性价比高，适合 Demo 阶段高频调用
  - 中文能力优秀，适合保研场景（简历/个人陈述/面试均为中文）
- **结论 / 下一步**：需要在 `.env` 中配置实际的 DeepSeek API Key，然后测试端到端流程

### [10:00] 端到端联调测试

- **做了什么**：
  - 配置 DeepSeek API Key 到 `backend/.env`
  - 修复前端 API_BASE 动态获取问题（远程服务器通过 `window.location.hostname` 动态推断后端地址）
  - 预填 Demo 数据到 localStorage（从用户 PDF 简历中提取）
  - 优化简历/个人陈述生成 Prompt（仿照用户 PDF 排版格式）
- **遇到什么问题**：前端在远程服务器访问时默认用 localhost:8000 导致请求失败
- **怎么解决的**：修改 `frontend/src/lib/api.ts`，用 `window.location.hostname` 动态推断后端地址
- **结论 / 下一步**：简历和个人陈述 SSE 流式生成功能全部跑通

### [10:30] 面试模块重构 — 四大升级

- **做了什么**：
  1. **自动抓取个人信息**：面试启动时自动从前端 localStorage 读取完整 UserProfile（包括基本信息、课程成绩、项目经历、竞赛论文、学生工作、推荐信、目标院校），通过 `build_profile_summary()` 生成结构化摘要传给 LLM，面试官能基于**所有已填信息**提问
  2. **文件上传支持**：新增 `/api/interview/upload` 端点，支持上传补充材料（简历、项目文档、论文等），文本内容自动解析并注入面试上下文
  3. **语音面试 Pipeline**：
     - 前端：MediaRecorder 录音 → PCM 转换 → WebSocket 发送
     - 后端 WebSocket → 阿里云 Paraformer ASR（语音→文字）→ DeepSeek LLM（理解+生成）→ 阿里云 CosyVoice TTS（文字→语音）→ 音频流回传
     - 前端：AudioContext 实时播放
  4. **全局上下文维护**：新增 `InterviewContext` 模型，后端内存维护每个 session 的完整状态：
     - 完整对话历史 `history`
     - 用户资料摘要 `profile_summary`
     - 上传材料 `uploaded_materials`
     - 面试统计（已问问题数、已覆盖话题、发现的强弱项）
     - 面试官内部笔记 `interviewer_notes`

- **新增/修改文件**：
  - `backend/app/models/interview.py` — InterviewContext 数据模型
  - `backend/app/services/interview/context.py` — Session 存储 + Profile 摘要构建
  - `backend/app/api/routes/interview.py` — 全部重写（/start、/chat、/upload、/session）
  - `backend/app/api/routes/voice.py` — WebSocket 语音面试端点
  - `backend/app/services/voice/asr.py` — Paraformer ASR 客户端
  - `backend/app/services/voice/tts.py` — CosyVoice TTS 客户端
  - `backend/app/services/llm/client.py` — 新增 `collect_chat()` 非流式接口
  - `backend/app/core/config.py` — 新增 DashScope 配置
  - `frontend/src/app/interview/page.tsx` — 全部重写（文字面试 + 语音面试 + 文件上传）

- **技术决策**：
  - **语音 Pipeline 选择 ASR+LLM+TTS 分离架构**：而非端到端语音大模型，因为 DeepSeek 在面试场景的推理、追问、上下文理解能力远强于纯语音模型
  - **ASR 选 Paraformer**：阿里云百炼的中文实时语音识别，延迟低、中文识别率高
  - **TTS 选 CosyVoice**：阿里云百炼的语音合成，音色自然、支持流式输出
  - **上下文维护在后端**：而非前端，确保语音面试和文字面试共享同一份上下文

- **结论 / 下一步**：文字面试已可测试（自动读取完整个人信息）。语音面试需要配置阿里云 DashScope API Key 后测试。

### [11:03] 语音面试问题排查 — 卡死在"发送语音中"

- **做了什么**：用户反馈语音面试发送语音时间很长，一直卡住
- **遇到什么问题**：
  - 后端日志出现 `HTTP 401 Unauthorized`，因为没有配置 `DASHSCOPE_API_KEY`
  - 原 Pipeline（浏览器 webm→PCM + 阿里云 Paraformer ASR + DeepSeek LLM + CosyVoice TTS）三次网络往返，成功也需 5-10 秒
  - 出错后没有 catch 处理，前端永远等待
- **怎么解决的**：完全重构语音 Pipeline
  - **ASR 改为浏览器 SpeechRecognition**：Chrome 内置，底层走 Google 云端识别，中文准确率高，零配置，本地完成无网络往返
  - **TTS 改为 Edge TTS（微软神经网络 TTS）**：服务端调用，免费无 API Key，音色自然（`zh-CN-YunxiNeural`），语速 +15%
  - 后端 voice WebSocket 改为纯文字中转（不再处理音频字节流），职责更清晰
  - 所有异常加 try/catch，TTS 失败时 fallback 到浏览器 SpeechSynthesis
  - 新增文字输入 fallback 框，供不支持 SpeechRecognition 的浏览器使用
- **改动文件**：
  - `backend/app/api/routes/voice.py` — 重写为文字中转 WebSocket
  - `backend/app/services/voice/edge_tts_service.py` — 新增 Edge TTS 封装
  - `frontend/src/app/interview/page.tsx` — 重写语音面试 UI（浏览器 ASR + Edge TTS 音频播放）
- **结论**：总延迟从「卡死」降到 2-3 秒（LLM 约 2s + TTS 约 1s）

### [11:12] 语音质量 & ASR 准确率优化

- **用户反馈**：
  1. 浏览器 ASR 对专业术语识别不准（"高丝瓜""香味调制元件"等明显错误）
  2. 语音太生硬、语速太慢（已在上条通过 Edge TTS 解决语速问题）
- **解决方案**：
  - **ASR 模式可选**：面试设置页新增下拉框，用户可在「浏览器识别（快速便捷）」和「云端识别（更准确，需 DashScope Key）」之间切选
  - **Edge TTS 已在上条解决语速问题**：`zh-CN-YunxiNeural` + 语速 +15%，自然度大幅提升

### [11:22] 面试反馈 & 历史记录

- **做了什么**：
  1. **面试反馈报告**：面试中新增「结束并反馈」按钮，点击后调用 LLM 生成结构化 JSON 反馈，包含：
     - 整体评级（A/B/C/D）+ 总结
     - 逐题问答回顾（问题 → 回答摘要 → 点评）
     - 优势列表 + 待提升列表
     - 专属的反馈展示页面
  2. **面试记录持久化**：不依赖数据库，用 localStorage 存储（与个人信息同方案）
     - 新增 `InterviewRecord` 类型和 `saveInterviewRecord / loadInterviewRecords` 工具函数
     - 每次结束面试自动保存，最多保留 20 条
  3. **个人信息模块新增「面试记录」Tab**：可查看所有历史记录、展开详细反馈、删除单条

- **改动文件**：
  - `frontend/src/lib/store.ts` — 新增 InterviewRecord 类型及读写函数
  - `frontend/src/app/interview/page.tsx` — 新增反馈流程、ASR 模式选择
  - `backend/app/api/routes/interview.py` — 新增 `/feedback` 端点
  - `backend/app/api/routes/voice.py` — 新增 `end_interview` action 生成反馈
  - `frontend/src/components/profile/InterviewHistory.tsx` — 新增面试历史组件
  - `frontend/src/app/profile/page.tsx` — 新增「面试记录」Tab

- **关于数据库**：当前全量使用 localStorage，16 小时挑战范围内完全够用。若后续上线，迁移路径为：localStorage → 后端 SQLite/PostgreSQL（数据模型已在 `InterviewRecord` 类型中定义好）

- **结论**：面试模块形成完整闭环：设置 → 面试 → 反馈 → 历史回顾

---

## 第三阶段：扩展模块 & 打磨（16:00 – 20:00）

> 待填写

### [XX:XX] 专业课模块前端

- **做了什么**：
- **遇到什么问题**：
- **怎么解决的**：
- **结论 / 下一步**：

### [XX:XX] 机试模块前端

- **做了什么**：
- **遇到什么问题**：
- **怎么解决的**：
- **结论 / 下一步**：

### [XX:XX] 个人反馈中心

- **做了什么**：
- **遇到什么问题**：
- **怎么解决的**：
- **结论 / 下一步**：

---

## 第四阶段：部署 & 提交准备（20:00 – 24:00）

> 待填写

### [XX:XX] 云服务器部署

- **做了什么**：
- **遇到什么问题**：
- **怎么解决的**：
- **结论 / 下一步**：

### [XX:XX] Demo 视频录制

- **做了什么**：
- **结论**：

### [XX:XX] 邮件提交

- **做了什么**：汇总所有交付物，发送至 mlic@pku.edu.cn
- **发送时间**：

---

## 关键决策记录

| 时间 | 决策 | 原因 |
|------|------|------|
| 08:45 | 聚焦保研学生而非大厂面试 | 大厂面试工具已饱和，保研流程碎片化、工具空白 |
| 09:00 | 四模块架构（个人信息/面试/专业课/机试） | 覆盖保研全流程，但个人信息是数据基础、优先做 |
| 09:15 | 个人信息模块第一优先级 | 是其他模块的数据依赖，且材料生成的用户感知最强 |
| 09:15 | 面试/专业课/机试模块先做前端框架 | 16小时内无法全部做完整，先搭骨架后续迭代 |
| 09:35 | LLM 选用 DeepSeek API (deepseek-v4-flash) | 兼容 OpenAI 格式改动小、性价比高、中文能力强 |
| 10:30 | 面试 Pipeline: ASR+LLM+TTS 分离 | DeepSeek 推理/追问能力远强于端到端语音模型 |
| 10:30 | ASR 选 Paraformer + TTS 选 CosyVoice | 阿里云百炼中文语音能力强、WebSocket 流式、延迟低 |
| 10:30 | 上下文维护在后端 session | 确保语音/文字面试共享上下文，支持文件上传注入 |
| 11:03 | ASR 改浏览器 SpeechRecognition + TTS 改 Edge TTS | 阿里云无 Key 导致 401，浏览器方案零配置、Edge TTS 免费且自然 |
| 11:12 | ASR 模式设计为可选（浏览器/云端） | 兼顾易用性和准确率，有 DashScope Key 的用户可切换高精度模式 |
| 11:22 | 数据持久化用 localStorage 而非数据库 | 16h 挑战范围内够用，与个人信息方案一致，迁移路径清晰 |

---

## AI 工具使用记录

| 工具 | 用在哪个环节 | 主要用途 |
|------|------------|---------|
| Cursor Agent | 全程 | 代码生成、重构、调试 |
| DeepSeek API (deepseek-v4-flash) | 产品核心 | 简历生成、个人陈述生成、面试官角色、反馈生成 |
| 阿里云百炼 Paraformer | 语音面试（可选高精度模式） | 实时语音识别 (ASR)，需 DashScope Key |
| 微软 Edge TTS (edge-tts) | 语音面试 | 实时语音合成 TTS，免费、自然人声 |
| 浏览器 SpeechRecognition | 语音面试（默认模式） | 零配置 ASR，Chrome 中文效果良好 |

---

## 问题 & 阻塞记录

| 时间 | 问题描述 | 状态 |
|------|---------|------|
| 10:00 | 远程访问前端时 API 请求指向 localhost | 已解决：动态用 window.location.hostname |
| 11:03 | 语音面试卡死，阿里云 ASR/TTS 返回 401 | 已解决：改为浏览器 ASR + Edge TTS，无需 DashScope Key |
| 11:12 | 浏览器 ASR 对专业术语识别不准 | 部分解决：提供云端 ASR 可选项，需用户自备 DashScope Key |

---

## 第三阶段：模块全面上线（15:00 – 17:45）

### [15:00] 专业课考核模块（全新）

- **做了什么**：
  1. **后端 `courses.py`**：完整课程考核 API
     - 10 个学科 + "综合测试"覆盖全科，高等数学/线性代数/概率论必考
     - `PointRecord` 结构追踪每个知识点的提问/错答/正答/评分/考核日期
     - `POST /start-exam`（SSE流式）、`POST /exam-chat`、`POST /end-exam`（JSON 反馈）
     - `POST /notebook`：返回按 weak/mastered/not_tested 分类的知识点记录
     - `POST /ask`（SSE流式）：AI 知识点答疑，支持多轮对话和上下文
  2. **前端 `courses/page.tsx`**：四 Tab 布局
     - 开始考核 Tab：选科目 → AI 逐知识点追问
     - 错题本 Tab：聚合所有历史考核中的薄弱知识点，展示错答/正答/AI 讲解按钮
     - AI 问答 Tab：向 AI 提问知识点，支持从错题本跳转带入上下文
     - 历史记录 Tab：查看/删除历史考核，展开查看反馈详情

### [16:00] 简历生成器增强

- **做了什么**：
  1. **`ResumePreview` 组件**：Markdown → 样式化 HTML 预览，CJK 兼容字体栈，去除 backtick → code 转换
  2. **直接导出 PDF**：html2canvas + jsPDF，`findWhitestRow()` 智能分页避免文字截断
  3. **导出 Word (.docx)**：docx 库解析 Markdown 生成带样式文档
  4. **UI**："美观预览/原始文本"切换，导出按钮含加载状态

### [16:30] 机考训练模块（全新）

- **做了什么**：
  1. **后端 `code.py` 增强**：`stdin` 字段支持，`subprocess.run(input=stdin)` 注入标准输入
  2. **后端 `coding.py`**：AI 出题/提示/评审 API
     - `POST /generate`（SSE流式）：AI 生成完整程序风格算法题（含 stdin/stdout 测试用例）
     - `POST /hint`（SSE流式）：渐进式提示（方向→思路→伪代码→片段）
     - `POST /review`（JSON）：AI 代码评审（正确性/复杂度/Bug/标准解法/评分）
  3. **前端 `coding/page.tsx`**：三阶段流程
     - 设置页：选知识点(13类)/难度/语言 → 生成题目
     - 练习页：左侧题目描述（Markdown+LaTeX），右侧代码编辑器+双Tab I/O面板
       - 测试用例 Tab：逐一注入 stdin 精确比对 stdout
       - 自定义输入 Tab：手动输入 stdin 即时运行
     - 评审页：评分卡 + 四维分析 + Bug 清单 + 优化建议 + 标准解法
  4. **历史记录**：localStorage 持久化(50条)，知识点统计

### [17:00] 共享组件与基础设施

- **做了什么**：
  1. **`MarkdownContent` 组件**：react-markdown + remark-math + rehype-katex，全站 Markdown+LaTeX 渲染
  2. **`store.ts` 增强**：新增 `CourseRecord`/`CourseKnowledgeResult`/`NotebookEntry` 类型和 CRUD
  3. **测试数据**：`fullCourseTest.ts`（微积分+线代模拟记录）、`fullInterviewTest.ts`
  4. **KaTeX CSS**：layout.tsx 中注入 CDN 样式表
  5. **后端 `main.py`**：注册 code/courses/coding 三个新路由
  6. **LLM client**：`collect_chat` 支持可配置 timeout 参数

---

## 第四阶段：危机处理与全面重建（18:00 – 20:30）

### [18:00] git reset --hard 误操作，代码全量回滚

- **遇到什么问题**：执行 `git reset --hard` 后，本地仓库回退到第一次提交状态，**专业课、简历增强、机考三大模块的所有代码全部丢失**。前后端服务随之崩溃，网站无法访问。
- **怎么解决的**：
  1. 通过 `git log --all --oneline` 确认 ORIG_HEAD 已丢失，无法直接 cherry-pick 恢复
  2. 依据 LOG.md 记录 + Cursor 对话历史，**逐文件手动重新实现**全部功能
  3. 恢复顺序：后端路由（courses/coding/code/voice/interview） → 模型 → 服务层 → 前端页面 → 组件 → 测试数据
- **教训**：本地改动必须先 `git stash` 或 `git push` 再操作历史；LOG.md 的详细记录发挥了关键作用

### [18:30] 后端重建

- **做了什么**：
  - 重建 `courses.py`：全知识点图谱、PointRecord 追踪、SSE 流式接口、feedback JSON 结构
  - 重建 `coding.py`：题目生成/渐进提示/代码评审；`code.py` 支持 stdin 注入
  - 修复 `interview.py`：补回 `collect_chat` 导入（历史汇总功能报错的根因）
  - 修复 `voice.py`：TTS 预处理（去中文引号、去 Markdown、LaTeX 替换为"（公式）"）
  - `edge_tts_service.py`：支持可选 `voice` 参数，新增 `AVAILABLE_VOICES` 列表

### [19:00] 前端重建与功能增强

- **做了什么**：
  - 重建 `courses/page.tsx`：五 Tab 布局（考核/知识地图/错题本/AI问答/历史）
  - 重建完整测试数据集：`fullCourseTest.ts`（微积分/线代/概率/数据结构/操作系统/综合，含 LaTeX 参考答案）和 `fullInterviewTest.ts`
  - `store.ts` 修复：`score` 类型从 `string` 改为 `number`；`saveCourseRecord`/`saveInterviewRecord` 增加按 ID 去重
  - `interview/page.tsx`：恢复音频控制、面试中断保存/恢复弹窗、手撕代码面板
  - `InterviewHistory.tsx`：数值评分展示与色彩映射

### [19:30] Bug 修复与体验打磨

- **做了什么**：
  - **面试问候语 Bug**：LLM 将候选人姓名误用为自己的名字 → 强化 `INTERVIEW_SYSTEM` prompt，明确区分面试官与候选人身份
  - **语音面试手撕代码**：手撕代码面板从仅文字模式扩展到语音模式
  - **专业课语音考核**：新增语音/文字切换，Paraformer ASR 上传识别，考核模式写入历史记录
  - **LaTeX 渲染**：`fullCourseTest.ts` 中所有数学公式改用 `$$...$$` 标准格式；修复中文引号导致的 JSON 解析错误
  - **前端 hydration 错误**：`<p>` 嵌套 `MarkdownContent` 改为 `<div>` 包裹

---

## 第五阶段：功能迭代（20:30 – 22:30）

### [20:30] 首页与首屏体验

- **做了什么**：
  - 首页功能模块 Tag 从「即将推出」全部改为「可用」（绿色标签）
  - 各模块描述文字更新，准确反映当前功能集

### [20:45] LLM Agentic Memory 强化

- **做了什么**：`buildPastMemory()` 大幅升级
  - 提取历次面试中分数 < 75 或被标注「不足/错误」的问题，要求本次重新考察
  - 收集**跨次持续薄弱点**，随系统提示一并传入 LLM
  - 附上最多 8 道历次未答好的原题，LLM 在合适时机复问
- **目的**：实现真正意义上的 AI 记忆，避免每次面试重复问已掌握的内容

### [21:00] 语音面试自动录音 / 静音检测

- **做了什么**：
  - TTS 音频播放结束后，**自动启动 Paraformer 录音**，无需用户按键
  - 使用 Web Audio API `AnalyserNode` 实时检测 RMS 音量
  - **2 秒连续静音自动提交**，并显示倒计时
  - 新增「自动●/手动○」切换按钮（默认自动）
  - 切换到其他 Tab 时自动停止录音和播放，`AudioContext` / `silenceInterval` 同步清理

### [21:15] 专业课语音模式全面对齐面试语音

- **做了什么**：
  - 专业课语音考核引入相同的 VAD（Voice Activity Detection）逻辑
  - 考官回答完毕调用新增 `POST /api/voice/tts` HTTP 端点播放语音
  - TTS 播放结束 → 自动录音 → 2s 静音 → 自动提交 → 下一轮
  - 支持 5 种 Edge TTS 音色选择；考官说话时输入框/发送按钮禁用
  - 离开页面自动暂停音频、停止录音

### [21:30] 专业课自定义科目

- **做了什么**：
  - 科目下拉新增「自定义科目...」选项，选择后展示文本输入框
  - 后端 `_get_points_for_custom_subject()`：调用 LLM 为任意科目生成 10-15 个核心考点（结果缓存）
  - `start_exam` 检测到自定义科目时提前异步生成知识点列表
  - 前端 `effectiveSubject` 统一管理实际传给后端的科目名

### [21:45] 导师主页 URL 自动解析

- **做了什么**：
  - 面试官设定区域新增「粘贴主页 URL → 解析主页」功能
  - **后端无公网出口** → 改由浏览器端 fetch 页面 HTML，DOM 解析提取纯文本后发给后端
  - 后端 `POST /api/interview/fetch_professor`：LLM 提取姓名/院系/职称/研究方向/邮箱/一句话简介
  - 若浏览器 CORS 拒绝，降级为只传 URL，LLM 凭训练知识回答
  - 例：输入 `https://cs.pku.edu.cn/info/1012/1106.htm` → 自动填充曹东刚研究员信息

### [22:00] README 全面更新

- **做了什么**：
  - 重写 README.md：完整配置说明（DeepSeek/DashScope Key、前后端 URL）、各模块使用指南、常见问题、远程服务器访问方法
  - 修正所有「即将推出」描述，反映当前实际功能状态

### [22:15] 前端部署问题修复

- **遇到什么问题**：`npm run dev -p 3000` 未指定 host，Next.js 默认绑定 `127.0.0.1`，外部浏览器访问超时
- **怎么解决的**：启动命令改为 `npm run dev -- -p 3000 -H 0.0.0.0`，强制监听所有网络接口
- **结论**：后续所有前端启动均需加 `-H 0.0.0.0`

---

## 最终版本说明（22:30 定稿）

- **已完成模块**：
  - ✅ 个人信息（Profile）— 完整表单 + Demo 数据 + 目标院校管理
  - ✅ 模拟面试（Interview）— 文字/语音双模式 + 手撕代码 + 导师角色扮演 + 历史记忆 + 反馈报告
  - ✅ 专业课考核（Courses）— 文字/语音双模式 + 自定义科目 + 错题本 + AI 问答 + 知识地图
  - ✅ 简历生成器（Resume Generator）— AI 生成 + 美观预览 + PDF/Word 导出
  - ✅ 机考训练（Coding Test）— AI 出题 + 在线编码 + ACM 风格 stdin/stdout + AI 评审

- **核心 AI 能力**：
  - LLM：DeepSeek API（面试对话/反馈生成/知识点考核/代码评审/导师信息提取）
  - ASR：阿里云 DashScope Paraformer（中英混合/专业术语/自动纠错）
  - TTS：Microsoft Edge TTS（5 种音色/自动静音检测/VAD 自动接听）

- **刻意不做**：完整账号体系（用 localStorage 临时存储，16h 内够用）

- **如果再给一周**：
  - 数据库替换（SQLite → PostgreSQL，支持多设备同步）
  - 机考模块接入真实 OJ 题库（爬取历年机试真题）
  - 移动端适配（语音面试更适合手机使用）
  - 跨模块综合分析面板（汇总各模块弱点，生成备考计划）
  - 导师主页爬取改为服务端代理（绕过服务器无公网出口限制）
