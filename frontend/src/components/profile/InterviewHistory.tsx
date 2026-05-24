"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { loadInterviewRecords, deleteInterviewRecord, InterviewRecord } from "@/lib/store";
import { Trash2, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Mic, MessageSquare } from "lucide-react";

export function InterviewHistory() {
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setRecords(loadInterviewRecords());
  }, []);

  const handleDelete = (id: string) => {
    if (confirm("确定删除这条面试记录？")) {
      deleteInterviewRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
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

  return (
    <div className="space-y-4">
      <Card title={`面试记录（共 ${records.length} 次）`}>
        <div className="space-y-3">
          {records.map((record) => {
            const expanded = expandedId === record.id;
            const diffLabel = { easy: "简单", standard: "标准", pressure: "压力面" }[record.difficulty] || record.difficulty;
            return (
              <div key={record.id} className="border border-border rounded-xl overflow-hidden">
                {/* Summary Row */}
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
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}>
                      <Trash2 size={14} />
                    </Button>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Expanded Detail */}
                {expanded && record.feedback && (
                  <div className="px-4 pb-4 border-t border-border bg-accent/20">
                    <div className="mt-3 space-y-4">
                      {/* Summary */}
                      <div>
                        <h4 className="text-xs font-medium text-muted mb-1">整体评价</h4>
                        <p className="text-sm">{record.feedback.summary}</p>
                      </div>

                      {/* Q&A */}
                      {record.feedback.questions && record.feedback.questions.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-muted mb-2">问答回顾</h4>
                          <div className="space-y-2">
                            {record.feedback.questions.map((q, i) => (
                              <div key={i} className="border-l-2 border-primary/30 pl-3 text-sm space-y-0.5">
                                <p className="font-medium">Q{i + 1}: {q.question}</p>
                                <p className="text-muted">A: {q.answer}</p>
                                <p>{q.evaluation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Strengths & Improvements */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-xs font-medium text-muted mb-1">优势</h4>
                          <ul className="space-y-1">
                            {(record.feedback.strengths || []).map((s, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-sm">
                                <CheckCircle size={12} className="text-green-500 mt-0.5 shrink-0" /> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-muted mb-1">待提升</h4>
                          <ul className="space-y-1">
                            {(record.feedback.improvements || []).map((s, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-sm">
                                <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" /> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
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
