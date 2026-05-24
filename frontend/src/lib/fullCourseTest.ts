import { CourseRecord } from "./store";

export const FULL_COURSE_TEST_RECORDS: CourseRecord[] = [
  {
    id: "test-calc-001",
    date: "2026-05-24 10:00",
    subject: "高等数学/微积分",
    mode: "text",
    messages: [
      { role: "assistant", content: "好的，我们开始高等数学的考核。第一个问题：请描述极限的ε-δ定义。" },
      { role: "user", content: "对于函数f(x)，当x趋向于x0时，如果对任意ε>0，存在δ>0，使得当0<|x-x0|<δ时，有|f(x)-L|<ε，则称L为f(x)在x0处的极限。" },
      { role: "assistant", content: "非常好！追问：洛必达法则的使用条件是什么？" },
      { role: "user", content: "洛必达法则要求是0/0或∞/∞型不定式，且分母的导数不为0。" },
      { role: "assistant", content: "好的，下一个知识点。泰勒公式的一般形式是什么？" },
      { role: "user", content: "嗯...泰勒公式就是把函数展开成多项式...具体的我记不太清了。" },
    ],
    feedback: {
      summary: "极限概念掌握扎实，微分知识有遗忘",
      knowledge_results: [
        { point: "极限与连续", status: "mastered", score: 95, detail: "ε-δ定义表述准确", suggested_answer: "极限的ε-δ定义...", wrong_answer_summary: "" },
        { point: "一元函数微分", status: "weak", score: 55, detail: "泰勒公式表述不完整", suggested_answer: "泰勒公式：f(x)=Σf^(n)(x0)/n!*(x-x0)^n+Rn(x)", wrong_answer_summary: "学生只能描述泰勒公式的大概概念，无法给出具体公式" },
      ],
      overall_score: 72,
      weak_points: ["一元函数微分"],
      next_focus: "建议复习泰勒公式及其应用",
    },
  },
  {
    id: "test-la-001",
    date: "2026-05-24 11:00",
    subject: "线性代数",
    mode: "text",
    messages: [
      { role: "assistant", content: "开始线性代数考核。请说明矩阵的秩的定义。" },
      { role: "user", content: "矩阵的秩是矩阵中最高阶非零子式的阶数。" },
      { role: "assistant", content: "正确。那么如何判断一个矩阵是否可逆？" },
      { role: "user", content: "方阵可逆的条件是行列式不为零，或者说秩等于阶数。" },
    ],
    feedback: {
      summary: "线性代数基础概念掌握良好",
      knowledge_results: [
        { point: "矩阵运算", status: "mastered", score: 90, detail: "秩的定义和可逆判定准确", suggested_answer: "矩阵的秩...", wrong_answer_summary: "" },
        { point: "行列式", status: "mastered", score: 85, detail: "能结合行列式和秩来判断可逆性", suggested_answer: "", wrong_answer_summary: "" },
      ],
      overall_score: 87,
      weak_points: [],
      next_focus: "可以进一步学习特征值分解和SVD",
    },
  },
];
