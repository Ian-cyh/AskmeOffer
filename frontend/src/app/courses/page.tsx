"use client";

import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/FormField";
import { fetchStream } from "@/lib/api";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import {
  loadCourseRecords, saveCourseRecord, deleteCourseRecord,
  CourseRecord, CourseKnowledgeResult, NotebookEntry,
} from "@/lib/store";
import { FULL_COURSE_TEST_RECORDS } from "@/lib/fullCourseTest";
import {
  Play, Send, RotateCcw, BookOpen, Trash2, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertTriangle, HelpCircle, History, MessageSquare,
  Lightbulb, FileText,
} from "lucide-react";

const API_BASE = () =>
  typeof window === "undefined" ? "http://localhost:8000" : `http://${window.location.hostname}:8000`;

interface Message { role: "user" | "assistant"; content: string; }

const SUBJECTS = [
  "高等数学/微积分", "线性代数", "概率论与数理统计",
  "数据结构", "计算机网络", "操作系统",
  "数字电路", "模拟电路", "信号与系统", "通信原理",
  "综合测试",
];

type SetupTab = "exam" | "notebook" | "ask" | "history";

function buildNotebookFromRecords(records: CourseRecord[]): NotebookEntry[] {
  const map: Record<string, NotebookEntry> = {};
  for (const r of records) {
    if (!r.feedback?.knowledge_results) continue;
    for (const kr of r.feedback.knowledge_results) {
      if (!kr.point) continue;
      if (!map[kr.point]) {
        map[kr.point] = {
          point: kr.point,
          subject: r.subject,
          questions: [],
          wrongAnswers: [],
          correctAnswer: "",
          lastScore: 0,
          dates: [],
        };
      }
      const entry = map[kr.point];
      entry.lastScore = kr.score;
      if (r.date && !entry.dates.includes(r.date)) entry.dates.push(r.date);
      if (kr.detail && !entry.questions.includes(kr.detail)) entry.questions.push(kr.detail);
      if (kr.wrong_answer_summary && kr.wrong_answer_summary.trim() && !entry.wrongAnswers.includes(kr.wrong_answer_summary))
        entry.wrongAnswers.push(kr.wrong_answer_summary);
      if (kr.suggested_answer && kr.suggested_answer.length > (entry.correctAnswer?.length || 0))
        entry.correctAnswer = kr.suggested_answer;
    }
  }
  return Object.values(map).filter(e => e.wrongAnswers.length > 0 || e.lastScore < 70);
}

export default function CoursesPage() {
  const [setupTab, setSetupTab] = useState<SetupTab>("exam");
  const [subject, setSubject] = useState("高等数学/微积分");
  const [phase, setPhase] = useState<"setup" | "exam" | "feedback">("setup");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");

  const [feedback, setFeedback] = useState<CourseRecord["feedback"]>(null);
  const [generatingFeedback, setGeneratingFeedback] = useState(false);

  const [records, setRecords] = useState<CourseRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [notebook, setNotebook] = useState<NotebookEntry[]>([]);
  const [expandedPoint, setExpandedPoint] = useState<string | null>(null);

  const [askMessages, setAskMessages] = useState<Message[]>([]);
  const [askInput, setAskInput] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askContext, setAskContext] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecords(loadCourseRecords());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const refreshNotebook = () => {
    setNotebook(buildNotebookFromRecords(loadCourseRecords()));
  };

  useEffect(() => { refreshNotebook(); }, []);

  const loadFullCourseTest = () => {
    for (const r of FULL_COURSE_TEST_RECORDS) {
      saveCourseRecord(r);
    }
    setRecords(loadCourseRecords());
    refreshNotebook();
    setSetupTab("history");
  };

  // --- Exam ---
  const startExam = async () => {
    const sid = crypto.randomUUID();
    setSessionId(sid);
    setPhase("exam");
    setMessages([]);
    setLoading(true);
    setFeedback(null);

    let content = "";
    try {
      await fetchStream(
        "/api/courses/start-exam",
        { subject, session_id: sid },
        (chunk) => { content += chunk; setMessages([{ role: "assistant", content }]); },
        () => setLoading(false),
      );
    } catch {
      setMessages([{ role: "assistant", content: "考核启动失败，请确认后端服务已启动。" }]);
      setLoading(false);
    }
  };

  const sendExamMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    let content = "";
    try {
      await fetchStream(
        "/api/courses/exam-chat",
        { session_id: sessionId, user_message: userMsg },
        (chunk) => { content += chunk; setMessages([...newMessages, { role: "assistant", content }]); },
        () => setLoading(false),
      );
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "回复失败，请重试。" }]);
      setLoading(false);
    }
  };

  const endExam = async () => {
    setGeneratingFeedback(true);
    try {
      const res = await fetch(`${API_BASE()}/api/courses/end-exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, history: messages.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      if (data.ok && data.feedback) {
        setFeedback(data.feedback);
        const record: CourseRecord = {
          id: sessionId,
          date: new Date().toLocaleString("zh-CN"),
          subject,
          mode: "text",
          messages: [...messages],
          feedback: data.feedback,
        };
        saveCourseRecord(record);
        setRecords(loadCourseRecords());
        refreshNotebook();
        setPhase("feedback");
      }
    } catch {
      alert("反馈生成失败");
    }
    setGeneratingFeedback(false);
  };

  // --- AI Ask ---
  const sendAskMessage = async () => {
    if (!askInput.trim() || askLoading) return;
    const q = askInput.trim();
    setAskInput("");
    const newMsgs: Message[] = [...askMessages, { role: "user", content: q }];
    setAskMessages(newMsgs);
    setAskLoading(true);

    let content = "";
    try {
      await fetchStream(
        "/api/courses/ask",
        {
          question: q,
          context_point: askContext,
          history: newMsgs.slice(-10).map(m => ({ role: m.role, content: m.content })),
        },
        (chunk) => { content += chunk; setAskMessages([...newMsgs, { role: "assistant", content }]); },
        () => setAskLoading(false),
      );
    } catch {
      setAskMessages([...newMsgs, { role: "assistant", content: "回答失败" }]);
      setAskLoading(false);
    }
  };

  const goToAskWithPoint = (point: string) => {
    setAskContext(point);
    setAskInput(`请详细讲解「${point}」这个知识点`);
    setSetupTab("ask");
  };

  // --- Feedback view ---
  if (phase === "feedback" && feedback) {
    return (
      <div className="p-8 max-w-3xl space-y-4">
        <PageHeader title="考核反馈" description={`${subject} · ${new Date().toLocaleDateString("zh-CN")}`} />
        <Card title="整体评价">
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-3xl font-bold ${(feedback.overall_score || 0) >= 80 ? "text-green-600" : (feedback.overall_score || 0) >= 60 ? "text-amber-600" : "text-red-600"}`}>
              {feedback.overall_score}分
            </span>
          </div>
          <p className="text-sm">{feedback.summary}</p>
        </Card>
        {feedback.knowledge_results?.length > 0 && (
          <Card title="知识点评估">
            <div className="space-y-3">
              {feedback.knowledge_results.map((kr, i) => (
                <div key={i} className={`p-3 rounded-lg border ${kr.status === "mastered" ? "border-green-200 bg-green-50" : kr.status === "weak" ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm flex items-center gap-1.5">
                      {kr.status === "mastered" ? <CheckCircle size={14} className="text-green-500" /> : kr.status === "weak" ? <XCircle size={14} className="text-red-500" /> : <HelpCircle size={14} className="text-gray-400" />}
                      {kr.point}
                    </span>
                    <span className="text-xs font-bold">{kr.score}分</span>
                  </div>
                  <p className="text-xs text-muted">{kr.detail}</p>
                  {kr.wrong_answer_summary && (
                    <p className="text-xs text-red-600 mt-1">错误摘要：{kr.wrong_answer_summary}</p>
                  )}
                  {kr.suggested_answer && (
                    <details className="mt-1">
                      <summary className="text-xs text-blue-600 cursor-pointer">查看参考答案</summary>
                      <p className="text-xs mt-1 p-2 bg-white rounded"><MarkdownContent content={kr.suggested_answer} /></p>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
        {feedback.weak_points?.length > 0 && (
          <Card title="薄弱环节">
            <ul className="space-y-1">
              {feedback.weak_points.map((w, i) => (
                <li key={i} className="text-sm flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-500" />{w}
                </li>
              ))}
            </ul>
            {feedback.next_focus && <p className="text-sm text-muted mt-3">{feedback.next_focus}</p>}
          </Card>
        )}
        <Button onClick={() => { setPhase("setup"); setSetupTab("exam"); }}>
          <RotateCcw size={14} /> 继续练习
        </Button>
      </div>
    );
  }

  // --- Exam view ---
  if (phase === "exam") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-6 pb-0 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{subject} 考核中</h1>
            <p className="text-xs text-muted">回答问题，考官会逐步深入</p>
          </div>
          <Button variant="secondary" size="sm" onClick={endExam} disabled={generatingFeedback || messages.length < 2}>
            <FileText size={14} /> {generatingFeedback ? "生成反馈中..." : "结束并反馈"}
          </Button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user" ? "bg-primary text-white rounded-br-md" : "bg-accent text-foreground rounded-bl-md"
              }`}>
                <MarkdownContent content={msg.content} />
                {loading && i === messages.length - 1 && msg.role === "assistant" && <span className="animate-pulse">▌</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border bg-white">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendExamMessage()}
              placeholder="输入你的回答..." disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            <Button onClick={sendExamMessage} disabled={loading || !input.trim()}>
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Setup (tabs) ---
  return (
    <div className="p-8 max-w-4xl space-y-6">
      <PageHeader title="专业课考核" description="AI 考官 · 知识点追问 · 错题本 · AI 答疑" />

      <div className="flex gap-1 border-b border-border">
        {([
          { id: "exam", label: "开始考核", icon: Play },
          { id: "notebook", label: `错题本 (${notebook.length})`, icon: BookOpen },
          { id: "ask", label: "AI 问答", icon: MessageSquare },
          { id: "history", label: `历史记录 (${records.length})`, icon: History },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSetupTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              setupTab === id ? "border-blue-500 text-blue-600" : "border-transparent text-muted hover:text-foreground"
            }`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Exam tab */}
      {setupTab === "exam" && (
        <Card title="考核设置" description="选择科目，AI 考官将逐一考察知识点">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">考核科目</label>
              <Select value={subject} onChange={e => setSubject(e.target.value)}>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
              <p className="text-xs text-muted mt-1">无论选择什么学科，高等数学、线性代数、概率论必考</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={startExam}><Play size={14} /> 开始考核</Button>
              <Button variant="secondary" onClick={loadFullCourseTest}>
                <Lightbulb size={14} /> 加载测试数据
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Notebook tab */}
      {setupTab === "notebook" && (
        <div className="space-y-3">
          {notebook.length === 0 ? (
            <div className="text-center py-16 text-muted">
              <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
              <p>暂无错题记录</p>
            </div>
          ) : notebook.map(entry => (
            <div key={entry.point} className="border border-border rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-4 hover:bg-accent/50 cursor-pointer select-none"
                onClick={() => setExpandedPoint(expandedPoint === entry.point ? null : entry.point)}
              >
                <div>
                  <div className="font-medium text-sm">{entry.point}</div>
                  <div className="text-xs text-muted mt-0.5">{entry.subject} · 最后得分 {entry.lastScore}分 · {entry.dates.length}次考核</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); goToAskWithPoint(entry.point); }} className="text-xs text-blue-600 hover:underline px-2 py-1">
                    AI讲解
                  </button>
                  {expandedPoint === entry.point ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>
              {expandedPoint === entry.point && (
                <div className="border-t border-border p-4 space-y-3 bg-accent/10">
                  {entry.wrongAnswers.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-red-600 mb-1">错误回答</div>
                      {entry.wrongAnswers.map((w, i) => (
                        <p key={i} className="text-sm text-red-700 bg-red-50 p-2 rounded mb-1">{w}</p>
                      ))}
                    </div>
                  )}
                  {entry.correctAnswer && (
                    <div>
                      <div className="text-xs font-medium text-green-600 mb-1">参考答案</div>
                      <div className="text-sm bg-green-50 p-2 rounded"><MarkdownContent content={entry.correctAnswer} /></div>
                    </div>
                  )}
                  {entry.questions.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted mb-1">考察记录</div>
                      {entry.questions.map((q, i) => (
                        <p key={i} className="text-xs text-muted">{q}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* AI Ask tab */}
      {setupTab === "ask" && (
        <Card title="AI 知识点问答" description="向 AI 老师提问任何专业课知识点">
          <div className="space-y-4">
            {askContext && (
              <div className="text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded flex items-center justify-between">
                <span>当前上下文：{askContext}</span>
                <button onClick={() => setAskContext("")} className="text-blue-500 hover:underline">清除</button>
              </div>
            )}
            <div className="space-y-3 max-h-96 overflow-auto">
              {askMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                    msg.role === "user" ? "bg-primary text-white rounded-br-md" : "bg-accent text-foreground rounded-bl-md"
                  }`}>
                    <MarkdownContent content={msg.content} />
                    {askLoading && i === askMessages.length - 1 && msg.role === "assistant" && <span className="animate-pulse">▌</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={askInput} onChange={e => setAskInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendAskMessage()}
                placeholder="问一个知识点..." disabled={askLoading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              <Button onClick={sendAskMessage} disabled={askLoading || !askInput.trim()}>
                <Send size={14} />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* History tab */}
      {setupTab === "history" && (
        <div className="space-y-3">
          {records.length === 0 ? (
            <div className="text-center py-16 text-muted">
              <History size={48} className="mx-auto mb-4 opacity-30" />
              <p>暂无考核记录</p>
            </div>
          ) : records.map(r => (
            <div key={r.id} className="border border-border rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-4 hover:bg-accent/50 cursor-pointer select-none"
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              >
                <div>
                  <div className="font-medium text-sm">{r.subject}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {r.date} · {r.feedback?.overall_score ?? "-"}分
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); deleteCourseRecord(r.id); setRecords(loadCourseRecords()); refreshNotebook(); }}
                    className="p-1 text-muted hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                  {expandedId === r.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>
              {expandedId === r.id && r.feedback && (
                <div className="border-t border-border p-4 space-y-3 bg-accent/10">
                  <p className="text-sm">{r.feedback.summary}</p>
                  {r.feedback.knowledge_results?.map((kr, i) => (
                    <div key={i} className={`text-sm p-2 rounded flex items-center gap-2 ${
                      kr.status === "mastered" ? "bg-green-50" : kr.status === "weak" ? "bg-red-50" : "bg-gray-50"
                    }`}>
                      {kr.status === "mastered" ? <CheckCircle size={13} className="text-green-500" /> : kr.status === "weak" ? <XCircle size={13} className="text-red-500" /> : <HelpCircle size={13} className="text-gray-400" />}
                      {kr.point} — {kr.score}分
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
