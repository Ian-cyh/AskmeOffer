"use client";

import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/FormField";
import { fetchStream } from "@/lib/api";
import { loadProfile } from "@/lib/store";
import { Send, Play, RotateCcw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function InterviewPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [difficulty, setDifficulty] = useState("standard");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const getResumeSummary = () => {
    const profile = loadProfile();
    const info = profile.basic_info;
    const parts = [`姓名：${info.name}`, `院校：${info.university}`, `专业：${info.major}`, `排名：${info.rank}`, `GPA：${info.gpa}`];
    if (profile.projects.length > 0) {
      parts.push("\n项目经历：");
      profile.projects.forEach((p) => parts.push(`- ${p.title}（${p.role}）：${p.description}`));
    }
    if (profile.achievements.length > 0) {
      parts.push("\n成果：");
      profile.achievements.forEach((a) => parts.push(`- ${a.title}（${a.level}）`));
    }
    return parts.join("\n");
  };

  const startInterview = async () => {
    setStarted(true);
    setLoading(true);
    setMessages([]);

    let assistantContent = "";
    try {
      await fetchStream(
        "/api/interview/chat",
        {
          resume_summary: getResumeSummary(),
          difficulty,
          history: [],
          user_message: "",
        },
        (chunk) => {
          assistantContent += chunk;
          setMessages([{ role: "assistant", content: assistantContent }]);
        },
        () => setLoading(false),
      );
    } catch {
      assistantContent = "面试启动失败，请确认后端服务已启动并配置了 LLM API Key。";
      setMessages([{ role: "assistant", content: assistantContent }]);
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    let assistantContent = "";
    const updatedMessages = [...newMessages];

    try {
      await fetchStream(
        "/api/interview/chat",
        {
          resume_summary: getResumeSummary(),
          difficulty,
          history: newMessages.map((m) => ({ role: m.role, content: m.content })),
          user_message: "",
        },
        (chunk) => {
          assistantContent += chunk;
          setMessages([...updatedMessages, { role: "assistant", content: assistantContent }]);
        },
        () => setLoading(false),
      );
    } catch {
      setMessages([...updatedMessages, { role: "assistant", content: "回复生成失败，请重试。" }]);
      setLoading(false);
    }
  };

  const reset = () => {
    setStarted(false);
    setMessages([]);
    setInput("");
  };

  if (!started) {
    return (
      <div className="p-8 max-w-3xl">
        <PageHeader title="模拟面试" description="基于你的个人信息，进行 AI 模拟保研面试" />
        <Card title="面试设置" description="选择面试难度后开始">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">面试难度</label>
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="easy">简单 — 温和友善，适合初次练习</option>
                <option value="standard">标准 — 正常面试节奏，适度追问</option>
                <option value="pressure">压力面 — 高频追问，模拟真实压力</option>
              </Select>
            </div>
            <p className="text-sm text-muted">
              提示：请先在「个人信息」模块中填写基本信息和项目经历，面试官会基于你的简历提问。
            </p>
            <Button onClick={startInterview}>
              <Play size={16} /> 开始面试
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">模拟面试中</h1>
          <p className="text-xs text-muted">
            难度：{difficulty === "easy" ? "简单" : difficulty === "standard" ? "标准" : "压力面"}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={reset}>
          <RotateCcw size={14} /> 重新开始
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-white rounded-br-md"
                  : "bg-accent text-foreground rounded-bl-md"
              }`}
            >
              {msg.content}
              {loading && i === messages.length - 1 && msg.role === "assistant" && (
                <span className="animate-pulse">▌</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border bg-white">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="输入你的回答..."
            className="flex-1 px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
