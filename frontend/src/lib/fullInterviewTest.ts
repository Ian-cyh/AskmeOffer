import { InterviewRecord } from "./store";

export const FULL_INTERVIEW_TEST_RECORDS: InterviewRecord[] = [
  {
    id: "test-interview-001",
    date: "2026-05-24 09:30",
    difficulty: "standard",
    mode: "text",
    questionsCount: 5,
    messages: [
      { role: "assistant", content: "你好！我是今天的面试官。请先做一个简短的自我介绍吧。" },
      { role: "user", content: "老师您好，我是北京交通大学通信工程专业的张三，专业排名1/96，GPA 3.96。我的研究方向主要是深度强化学习和光学器件设计。" },
      { role: "assistant", content: "很好。你提到了深度强化学习，能具体说说你在自动驾驶世界模型项目中的工作吗？" },
      { role: "user", content: "我们提出了一种双策略框架，将模仿学习和强化学习解耦，通过竞争机制共享经验。我主要负责长尾数据集的建立和实验。" },
      { role: "assistant", content: "那你如何定义长尾数据集？用什么指标来筛选？" },
      { role: "user", content: "我们基于LAW的表现来筛选，主要看L2误差和碰撞率，过滤出这两个指标较高的样本子集进行针对性测试。" },
    ],
    feedback: {
      summary: "候选人对项目理解深入，技术表达清晰，能很好地解释核心工作",
      questions: [
        { question: "自我介绍", answer: "简洁明了，突出了核心优势", evaluation: "好——信息密度高，重点突出" },
        { question: "自动驾驶世界模型项目", answer: "清楚解释了双策略框架", evaluation: "好——技术理解深入" },
        { question: "长尾数据集定义", answer: "用L2误差和碰撞率筛选", evaluation: "好——方法论清晰" },
      ],
      strengths: ["技术理解深入", "表达简洁有逻辑"],
      improvements: ["可以多提及量化成果数据"],
      overallScore: "A — 表现优秀",
    },
  },
];
