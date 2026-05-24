"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { loadInterviewRecords, deleteInterviewRecord, InterviewRecord } from "@/lib/store";
import { fetchStream } from "@/lib/api";
import {
  Trash2, ChevronDown, ChevronUp, CheckCircle, AlertTriangle,
  Mic, MessageSquare, Send, BarChart3, Loader2,
} from "lucide-react";

const API_BASE_FN = () =>
  typeof window === "undefined"
    ? "http://localhost:8000"
    : `http://${window.location.hostname}:8000`;

interface HistorySummary {
  overall_trend: string;
  persistent_strengths: string[];
  persistent_weaknesses: string[];
  improvement_areas: string[];
  priority_actions: string[];
  expression_pattern: string;
  readiness_assessment: string;
}

interface ChatMsg { role: "user" | "assistant"; content: string }

export function InterviewHistory() {
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [chatRecordId, setChatRecordId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecords(loadInterviewRecords());
  }, []);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

  const handleDelete = (id: string) => {
    if (confirm("确定删除这条面试记录？")) {
      deleteInterviewRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      if (chatRecordId === id) { setChatRecordId(null); setChatMessages([]); }
    }
  };

  const generateSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch(`${API_BASE_FN()}/api/interview/history_summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: records.map((r) => ({ date: r.date, difficulty: r.difficulty, feedback: r.feedback })) }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        alert(`汇总请求失败 (${res.status})：${text.slice(0, 200)}`);
        setLoadingSummary(false);
        return;
      }
      const data = await res.json();
      if (data.ok && data.summary) setSummary(data.summary);
      else alert(data.error || "汇总生成失败");
    } catch (err) {
      alert(`汇总生成失败：${err instanceof Error ? err.message : String(err)}`);
    }
    setLoadingSummary(false);
  };

  const openChat = (record: InterviewRecord) => {
    setChatRecordId(record.id);
    setChatMessages([]);
    setChatInput("");
  };

  const sendChatMsg = async () => {
    if (!chatInput.trim() || chatLoading || !chatRecordId) return;
    const record = records.find((r) => r.id === chatRecordId);
    if (!record) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    const newMsgs: ChatMsg[] = [...chatMessages, { role: "user", content: userMsg }];
    setChatMessages([...newMsgs, { role: "assistant", content: "" }]);
    setChatLoading(true);

    const feedbackText = record.feedback ? JSON.stringify(record.feedback, null, 2) : "";

    let assistantContent = "";
    try {
      await fetchStream(
        "/api/interview/feedback_chat",
        {
          feedback_summary: feedbackText,
          interview_history: record.messages.slice(0, 30),
          chat_history: newMsgs.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
          user_message: userMsg,
        },
        (chunk) => {
          assistantContent += chunk;
          setChatMessages([...newMsgs, { role: "assistant", content: assistantContent }]);
        },
        () => setChatLoading(false),
      );
    } catch {
      setChatMessages([...newMsgs, { role: "assistant", content: "回复生成失败，请重试。" }]);
      setChatLoading(false);
    }
  };

  if (records.length === 0) {
    return (
      <Card title="面试记录">
        <p className="text-sm text-muted py-8 text-center">
          暂无面试记录。完成一次模拟面试后，反馈报告会自动保存在这里。
        </p>
      </Card>
    );
  }

  const chatRecord = chatRecordId ? records.find((r) => r.id === chatRecordId) : null;

  return (
    <div className="space-y-4">
      {/* Summary button */}
      {records.length >= 2 && (
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={generateSummary} disabled={loadingSummary}>
            {loadingSummary ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
            {loadingSummary ? "生成中..." : "生成历史汇总分析"}
          </Button>
          <span className="text-xs text-muted">基于 {records.length} 次面试记录</span>
        </div>
      )}

      {/* Historical summary card */}
      {summary && (
        <Card title="历史面试汇总分析">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium text-muted mb-1">整体趋势</div>
              <div className="text-sm"><MarkdownContent content={summary.overall_trend} /></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-medium text-muted mb-1">持续优势</h4>
                <ul className="space-y-1">
                  {(summary.persistent_strengths || []).map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm">
                      <CheckCircle size={12} className="text-green-500 mt-0.5 shrink-0" />
                      <MarkdownContent content={s} />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted mb-1">反复出现的薄弱点</h4>
                <ul className="space-y-1">
                  {(summary.persistent_weaknesses || []).map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm">
                      <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                      <MarkdownContent content={s} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>

                  {summary.improvement_areas && summary.improvement_areas.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted mb-1">已有进步的方面</div>
                <ul className="space-y-1">
                  {summary.improvement_areas.map((s, i) => (
                    <li key={i} className="flex items-start gap-1 text-sm text-green-700">
                      <span className="shrink-0">+</span>
                      <div><MarkdownContent content={s} /></div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.priority_actions && summary.priority_actions.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted mb-1">优先行动项</div>
                <ol className="space-y-1 list-decimal list-inside">
                  {summary.priority_actions.map((s, i) => (
                    <li key={i} className="text-sm font-medium"><MarkdownContent content={s} /></li>
                  ))}
                </ol>
              </div>
            )}

            {summary.expression_pattern && (
              <div className="bg-blue-50 rounded-lg p-3">
                <h4 className="text-xs font-medium text-blue-700 mb-1">表达模式分析</h4>
                <div className="text-sm text-blue-900"><MarkdownContent content={summary.expression_pattern} /></div>
              </div>
            )}

            {summary.readiness_assessment && (
              <div className="bg-accent rounded-lg p-3">
                <h4 className="text-xs font-medium text-muted mb-1">面试准备度评估</h4>
                <div className="text-sm font-medium"><MarkdownContent content={summary.readiness_assessment} /></div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Interactive chat panel */}
      {chatRecord && (
        <Card title={`追问反馈 — ${chatRecord.date}`}>
          <div className="space-y-3">
            <div ref={chatScrollRef} className="max-h-64 overflow-auto space-y-2 border border-border rounded-xl p-3">
              {chatMessages.length === 0 && (
                <p className="text-xs text-muted text-center py-4">发送消息开始交互，可以追问反馈中的任何内容</p>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    m.role === "user" ? "bg-primary text-white" : "bg-accent text-foreground"
                  }`}>
                    {m.role === "assistant" ? <MarkdownContent content={m.content} /> : m.content}
                    {chatLoading && i === chatMessages.length - 1 && m.role === "assistant" && <span className="animate-pulse">▌</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChatMsg()}
                placeholder="追问反馈内容..."
                disabled={chatLoading}
                className="flex-1 px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <Button size="sm" onClick={sendChatMsg} disabled={chatLoading || !chatInput.trim()}>
                <Send size={14} />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setChatRecordId(null); setChatMessages([]); }}>
                关闭
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Record list */}
      <Card title={`面试记录（共 ${records.length} 次）`}>
        <div className="space-y-3">
          {records.map((record) => {
            const expanded = expandedId === record.id;
            const diffLabel = { easy: "简单", standard: "标准", pressure: "压力面" }[record.difficulty] || record.difficulty;
            return (
              <div key={record.id} className="border border-border rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : record.id)}
                >
                  <div className="flex items-center gap-3">
                    {record.mode === "voice" ? <Mic size={16} className="text-primary" /> : <MessageSquare size={16} className="text-primary" />}
                    <div>
                      <p className="text-sm font-medium">
                        {record.date} · {diffLabel} · {record.mode === "voice" ? "语音" : "文字"}
                      </p>
                      <p className="text-xs text-muted">
                        {record.questionsCount} 轮对话
                        {record.feedback?.overallScore && ` · 评级：${record.feedback.overallScore}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.feedback && (
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openChat(record); }}>
                        <MessageSquare size={12} /> 追问
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}>
                      <Trash2 size={14} />
                    </Button>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {expanded && record.feedback && (
                  <div className="px-4 pb-4 border-t border-border bg-accent/20">
                    <div className="mt-3 space-y-4">
                      <div>
                        <h4 className="text-xs font-medium text-muted mb-1">整体评价</h4>
                        <div className="text-sm"><MarkdownContent content={record.feedback.summary} /></div>
                      </div>

                      {record.feedback.expression_summary && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <h4 className="text-xs font-medium text-blue-700 mb-1">语言表达总评</h4>
                          <div className="text-sm text-blue-900"><MarkdownContent content={record.feedback.expression_summary} /></div>
                        </div>
                      )}

                      {record.feedback.questions && record.feedback.questions.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-muted mb-2">逐题反馈</h4>
                          <div className="space-y-3">
                            {record.feedback.questions.map((q, i) => (
                              <div key={i} className="border-l-2 border-primary/30 pl-3 text-sm space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="font-medium">Q{i + 1}: {q.question}</div>
                                  {q.score != null && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                    q.score >= 85 ? "bg-green-100 text-green-700" :
                                    q.score >= 70 ? "bg-blue-100 text-blue-700" :
                                    q.score >= 55 ? "bg-amber-100 text-amber-700" :
                                    "bg-red-100 text-red-700"
                                  }`}>{q.score}分</span>}
                                </div>
                                <div className="text-muted">A: {q.answer}</div>
                                <div><MarkdownContent content={q.evaluation} /></div>
                                {q.expression_advice && (
                                  <div className="bg-blue-50/80 rounded p-2">
                                    <div className="text-xs font-medium text-blue-600 mb-0.5">表达建议</div>
                                    <div className="text-sm text-blue-800"><MarkdownContent content={q.expression_advice} /></div>
                                  </div>
                                )}
                                {q.suggested_answer && (
                                  <div className="bg-green-50/80 rounded p-2">
                                    <div className="text-xs font-medium text-green-600 mb-0.5">参考回答</div>
                                    <div className="text-sm text-green-800"><MarkdownContent content={q.suggested_answer} /></div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-xs font-medium text-muted mb-1">优势</h4>
                          <ul className="space-y-1">
                            {(record.feedback.strengths || []).map((s, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-sm">
                                <CheckCircle size={12} className="text-green-500 mt-0.5 shrink-0" />
                                <MarkdownContent content={s} />
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-muted mb-1">待提升</h4>
                          <ul className="space-y-1">
                            {(record.feedback.improvements || []).map((s, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-sm">
                                <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                                <MarkdownContent content={s} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <Button
                        variant="secondary" size="sm"
                        onClick={() => openChat(record)}
                        className="mt-2"
                      >
                        <MessageSquare size={12} /> 针对本次反馈追问
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
