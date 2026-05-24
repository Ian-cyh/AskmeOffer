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
  Lightbulb, FileText, Map,
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

type SetupTab = "exam" | "progress" | "notebook" | "ask" | "history";

interface SubjectProgress {
  total: number;
  mastered: string[];
  weak: string[];
  not_tested: string[];
}

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

  const [knowledgeMap, setKnowledgeMap] = useState<Record<string, SubjectProgress>>({});

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

  const fetchKnowledgeMap = async () => {
    try {
      const r = await fetch(`${API_BASE()}/api/courses/knowledge_map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "default" }),
      });
      const d = await r.json();
      if (d.ok && d.map) setKnowledgeMap(d.map);
    } catch { /* silent */ }
  };

  useEffect(() => { refreshNotebook(); fetchKnowledgeMap(); }, []);

  const loadFullCourseTest = () => {
    const existing = loadCourseRecords();
    const existingIds = new Set(existing.map(r => r.id));
    for (const r of FULL_COURSE_TEST_RECORDS) {
      if (!existingIds.has(r.id)) {
        saveCourseRecord(r);
      }
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
        fetchKnowledgeMap();
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
          <div className="text-sm"><MarkdownContent content={feedback.summary} /></div>
        </Card>

        {feedback.expression_summary && (
          <Card title="答题表达点评">
            <div className="flex items-start gap-2">
              <MessageSquare size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div className="text-sm leading-relaxed"><MarkdownContent content={feedback.expression_summary} /></div>
            </div>
          </Card>
        )}

        {feedback.knowledge_results?.length > 0 && (
          <Card title="知识点逐项评估">
            <div className="space-y-4">
              {feedback.knowledge_results.map((kr, i) => (
                <div key={i} className={`rounded-lg border overflow-hidden ${kr.status === "mastered" ? "border-green-200" : kr.status === "weak" ? "border-red-200" : "border-gray-200"}`}>
                  <div className={`p-3 ${kr.status === "mastered" ? "bg-green-50" : kr.status === "weak" ? "bg-red-50" : "bg-gray-50"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm flex items-center gap-1.5">
                        {kr.status === "mastered" ? <CheckCircle size={14} className="text-green-500" /> : kr.status === "weak" ? <XCircle size={14} className="text-red-500" /> : <HelpCircle size={14} className="text-gray-400" />}
                        {kr.point}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${kr.score >= 80 ? "bg-green-100 text-green-700" : kr.score >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                        {kr.score}分
                      </span>
                    </div>
                    <div className="text-xs text-muted mt-1"><MarkdownContent content={kr.detail} /></div>
                  </div>
                  <div className="p-3 space-y-2 bg-white">
                    {kr.wrong_answer_summary && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 mb-1">
                          <XCircle size={12} /> 错误摘要
                        </div>
                        <p className="text-xs text-red-700 bg-red-50 p-2 rounded">{kr.wrong_answer_summary}</p>
                      </div>
                    )}
                    {kr.expression_advice && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 mb-1">
                          <MessageSquare size={12} /> 表达优化建议
                        </div>
                        <div className="text-xs bg-blue-50 p-2 rounded"><MarkdownContent content={kr.expression_advice} /></div>
                      </div>
                    )}
                    {kr.suggested_answer && (
                      <details className="mt-1">
                        <summary className="text-xs text-green-600 cursor-pointer flex items-center gap-1.5 font-medium">
                          <Lightbulb size={12} /> 查看标准参考答案
                        </summary>
                        <div className="text-xs mt-2 p-2 bg-green-50 rounded"><MarkdownContent content={kr.suggested_answer} /></div>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {feedback.weak_points?.length > 0 && (
          <Card title="薄弱环节">
            <ul className="space-y-2">
              {feedback.weak_points.map((w, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                  <MarkdownContent content={w} />
                </li>
              ))}
            </ul>
            {feedback.next_focus && (
              <div className="mt-3 p-3 bg-accent rounded text-sm">
                <span className="text-xs font-medium text-muted">下次复习建议：</span>
                <div className="mt-1"><MarkdownContent content={feedback.next_focus} /></div>
              </div>
            )}
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={() => { setPhase("setup"); setSetupTab("exam"); }}>
            <RotateCcw size={14} /> 继续练习
          </Button>
          <p className="text-xs text-muted self-center">反馈已自动保存到历史记录和错题本</p>
        </div>
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

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {([
          { id: "exam", label: "开始考核", icon: Play },
          { id: "progress", label: "知识地图", icon: Map },
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

      {/* Progress / Knowledge Map tab */}
      {setupTab === "progress" && (
        <div className="space-y-4">
          {Object.keys(knowledgeMap).length === 0 ? (
            <Card title="知识点掌握进度">
              <div className="text-center py-12 text-muted space-y-3">
                <Map size={48} className="mx-auto opacity-30" />
                <p>尚未获取知识地图</p>
                <Button variant="secondary" onClick={fetchKnowledgeMap}>
                  <RotateCcw size={14} /> 刷新知识地图
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> 已掌握</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> 薄弱</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-300 inline-block" /> 未考察</span>
                </div>
                <Button variant="secondary" size="sm" onClick={fetchKnowledgeMap}>
                  <RotateCcw size={14} /> 刷新
                </Button>
              </div>
              {Object.entries(knowledgeMap).map(([subj, info]) => {
                const pct = info.total > 0 ? Math.round((info.mastered.length / info.total) * 100) : 0;
                return (
                  <Card key={subj} title={subj} description={`${info.mastered.length}/${info.total} 已掌握 · ${info.weak.length} 薄弱 · ${info.not_tested.length} 未考察`}>
                    <div className="space-y-3">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-green-500 h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[...info.mastered.map(p => ({ name: p, status: "mastered" as const })),
                          ...info.weak.map(p => ({ name: p, status: "weak" as const })),
                          ...info.not_tested.map(p => ({ name: p, status: "not_tested" as const })),
                        ].map(({ name, status }) => (
                          <span key={name} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                            status === "mastered" ? "bg-green-100 text-green-700" :
                            status === "weak" ? "bg-red-100 text-red-700" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {status === "mastered" ? <CheckCircle size={10} /> : status === "weak" ? <XCircle size={10} /> : <HelpCircle size={10} />}
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </div>
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
                  {entry.questions.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-blue-600 mb-1.5">考察过的问题（{entry.questions.length} 题）</div>
                      <ol className="space-y-1">
                        {entry.questions.map((q, i) => (
                          <li key={i} className="text-sm text-foreground bg-blue-50 px-3 py-1.5 rounded flex gap-2">
                            <span className="text-xs text-blue-400 shrink-0 mt-0.5">{i + 1}.</span>
                            <MarkdownContent content={q} />
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {entry.wrongAnswers.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-red-600 mb-1.5">错误回答（{entry.wrongAnswers.length} 次）</div>
                      <ol className="space-y-1">
                        {entry.wrongAnswers.map((w, i) => (
                          <li key={i} className="text-sm text-red-800 bg-red-50 px-3 py-1.5 rounded flex gap-2">
                            <span className="text-xs text-red-300 shrink-0 mt-0.5">{i + 1}.</span>
                            <MarkdownContent content={w} />
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {entry.correctAnswer && (
                    <div>
                      <div className="text-xs font-semibold text-green-600 mb-1.5">参考答案</div>
                      <div className="text-sm bg-green-50 p-3 rounded border border-green-100">
                        <MarkdownContent content={entry.correctAnswer} />
                      </div>
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
                    {r.date} · {r.feedback?.overall_score ?? "-"}分 ·{" "}
                    {r.feedback?.knowledge_results?.length ?? 0} 个知识点
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
                <div className="border-t border-border p-4 space-y-4 bg-accent/10">
                  {/* Overall summary */}
                  <div className="bg-white rounded-lg p-3 border border-border">
                    <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">总体评价</div>
                    <div className="text-sm"><MarkdownContent content={r.feedback.summary} /></div>
                    {r.feedback.expression_summary && (
                      <div className="mt-2 text-sm text-blue-700 bg-blue-50 p-2 rounded">
                        <div className="text-xs font-medium mb-1">表达综合建议</div>
                        <MarkdownContent content={r.feedback.expression_summary} />
                      </div>
                    )}
                    {r.feedback.next_focus && (
                      <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                        下次重点：{r.feedback.next_focus}
                      </div>
                    )}
                  </div>

                  {/* Knowledge point details */}
                  {r.feedback.knowledge_results?.map((kr, i) => (
                    <div key={i} className={`rounded-lg border overflow-hidden ${
                      kr.status === "mastered" ? "border-green-200" : kr.status === "weak" ? "border-red-200" : "border-gray-200"
                    }`}>
                      <div className={`flex items-center gap-2 px-3 py-2 text-sm font-medium ${
                        kr.status === "mastered" ? "bg-green-50 text-green-800" : kr.status === "weak" ? "bg-red-50 text-red-800" : "bg-gray-50 text-gray-700"
                      }`}>
                        {kr.status === "mastered" ? <CheckCircle size={13} /> : kr.status === "weak" ? <XCircle size={13} /> : <HelpCircle size={13} />}
                        {kr.point}
                        <span className="ml-auto text-xs font-normal">{kr.score} 分</span>
                      </div>
                      <div className="bg-white p-3 space-y-2">
                        {kr.detail && (
                          <div className="text-sm text-foreground">
                            <MarkdownContent content={kr.detail} />
                          </div>
                        )}
                        {kr.wrong_answer_summary && (
                          <div className="bg-red-50 rounded p-2">
                            <div className="text-xs font-medium text-red-600 mb-1">错误回答摘要</div>
                            <div className="text-sm text-red-700"><MarkdownContent content={kr.wrong_answer_summary} /></div>
                          </div>
                        )}
                        {kr.expression_advice && (
                          <div className="bg-amber-50 rounded p-2">
                            <div className="text-xs font-medium text-amber-600 mb-1">表达建议</div>
                            <div className="text-sm text-amber-800"><MarkdownContent content={kr.expression_advice} /></div>
                          </div>
                        )}
                        {kr.suggested_answer && (
                          <div className="bg-green-50 rounded p-2">
                            <div className="text-xs font-medium text-green-600 mb-1">参考答案</div>
                            <div className="text-sm text-green-900"><MarkdownContent content={kr.suggested_answer} /></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Conversation transcript toggle */}
                  {r.messages?.length > 0 && (
                    <details className="border border-border rounded-lg">
                      <summary className="px-3 py-2 text-xs text-muted cursor-pointer hover:text-foreground select-none">
                        查看完整对话记录（{r.messages.length} 条）
                      </summary>
                      <div className="p-3 space-y-2 max-h-80 overflow-auto">
                        {r.messages.map((msg, mi) => (
                          <div key={mi} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${
                              msg.role === "user" ? "bg-primary text-white rounded-br-sm" : "bg-accent text-foreground rounded-bl-sm"
                            }`}>
                              <MarkdownContent content={msg.content} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
