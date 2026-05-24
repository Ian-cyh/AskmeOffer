"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/FormField";
import { fetchStream } from "@/lib/api";
import { loadProfile, loadInterviewRecords, saveInterviewRecord, InterviewRecord } from "@/lib/store";
import { UserProfile } from "@/types/profile";
import { Send, Play, RotateCcw, Upload, Mic, MicOff, Volume2, FileText, CheckCircle, AlertTriangle } from "lucide-react";

const API_BASE_FN = () =>
  typeof window === "undefined"
    ? "http://localhost:8000"
    : `http://${window.location.hostname}:8000`;

const WS_BASE_FN = () => `ws://${window.location.hostname}:8000`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Browser TTS fallback
function speakFallback(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "zh-CN"; utter.rate = 1.15;
  const voices = window.speechSynthesis.getVoices();
  const zhVoice = voices.find((v) => v.lang.startsWith("zh"));
  if (zhVoice) utter.voice = zhVoice;
  utter.onend = () => onEnd?.();
  utter.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utter);
}

function playAudioBlob(blob: Blob, onEnd?: () => void) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => { URL.revokeObjectURL(url); onEnd?.(); };
  audio.onerror = () => { URL.revokeObjectURL(url); onEnd?.(); };
  audio.play().catch(() => onEnd?.());
}

type AsrMode = "browser" | "server";

/** Summarise past interview records into a memory string for the backend. */
function buildPastMemory(): string {
  const records = loadInterviewRecords().slice(0, 5); // last 5
  if (records.length === 0) return "";

  const lines: string[] = ["以下是候选人过去模拟面试的历史记录，请据此调整提问重点："];
  records.forEach((r, i) => {
    lines.push(`\n[第 ${i + 1} 次面试 — ${r.date}，难度：${r.difficulty}]`);
    if (r.feedback) {
      lines.push(`总体评价：${r.feedback.summary}`);
      lines.push(`评级：${r.feedback.overallScore}`);
      if (r.feedback.strengths?.length) {
        lines.push(`优势：${r.feedback.strengths.join("；")}`);
      }
      if (r.feedback.improvements?.length) {
        lines.push(`待提升：${r.feedback.improvements.join("；")}`);
      }
    }
  });
  return lines.join("\n");
}

export default function InterviewPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [difficulty, setDifficulty] = useState("standard");
  const [asrMode, setAsrMode] = useState<AsrMode>("browser");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [speaking, setSpeaking] = useState(false);
  // Feedback
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState<InterviewRecord["feedback"]>(null);
  const [generatingFeedback, setGeneratingFeedback] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  const getProfile = useCallback((): UserProfile => loadProfile(), []);

  // --- File Upload ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", sessionId || "pending");
    try {
      const res = await fetch(`${API_BASE_FN()}/api/interview/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.ok) setUploadedFiles((prev) => [...prev, file.name]);
    } catch { alert("文件上传失败"); }
    e.target.value = "";
  };

  // --- End Interview & Generate Feedback ---
  const endInterview = async () => {
    setGeneratingFeedback(true);

    if (mode === "voice" && wsRef.current?.readyState === WebSocket.OPEN) {
      // Request feedback via WebSocket
      wsRef.current.send(JSON.stringify({ action: "end_interview" }));
      // Feedback will come via ws.onmessage → "feedback" type
      return;
    }

    // Text mode: call HTTP endpoint
    try {
      const res = await fetch(`${API_BASE_FN()}/api/interview/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, history: messages.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      if (data.ok && data.feedback) {
        setFeedback(data.feedback);
        saveFeedbackRecord(data.feedback);
      }
    } catch {
      alert("反馈生成失败");
    }
    setGeneratingFeedback(false);
    setShowFeedback(true);
  };

  const saveFeedbackRecord = (fb: InterviewRecord["feedback"]) => {
    const record: InterviewRecord = {
      id: sessionId || crypto.randomUUID(),
      date: new Date().toLocaleString("zh-CN"),
      difficulty,
      mode,
      questionsCount: messages.filter((m) => m.role === "assistant").length,
      messages: [...messages],
      feedback: fb,
    };
    saveInterviewRecord(record);
  };

  // --- Text Interview ---
  const startInterview = async () => {
    const profile = getProfile();
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    setStarted(true);
    setLoading(true);
    setMessages([]);
    setShowFeedback(false);
    setFeedback(null);

    const pastMemory = buildPastMemory();
    let assistantContent = "";
    try {
      await fetchStream(
        "/api/interview/start",
        { profile, difficulty, session_id: newSessionId, past_memory: pastMemory, asr_mode: false },
        (chunk) => { assistantContent += chunk; setMessages([{ role: "assistant", content: assistantContent }]); },
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
    try {
      await fetchStream(
        "/api/interview/chat",
        { session_id: sessionId, user_message: userMsg },
        (chunk) => { assistantContent += chunk; setMessages([...newMessages, { role: "assistant", content: assistantContent }]); },
        () => setLoading(false),
      );
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "回复生成失败，请重试。" }]);
      setLoading(false);
    }
  };

  // --- Voice Interview ---
  const startVoiceInterview = async () => {
    const profile = getProfile();
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    setStarted(true);
    setMode("voice");
    setVoiceStatus("正在初始化...");
    setShowFeedback(false);
    setFeedback(null);

    const pastMemory = buildPastMemory();

    try {
      await fetch(`${API_BASE_FN()}/api/interview/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, difficulty, session_id: newSessionId, past_memory: pastMemory, asr_mode: true }),
      });
    } catch { /* non-critical */ }

    const ws = new WebSocket(`${WS_BASE_FN()}/api/voice/ws/${newSessionId}`);
    ws.binaryType = "blob";
    wsRef.current = ws;

    let audioChunks: Blob[] = [];
    const finishSpeaking = () => { setSpeaking(false); setVoiceStatus("点击麦克风按钮开始回答"); };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) { audioChunks.push(event.data); return; }
      const data = JSON.parse(event.data);
      if (data.type === "status") { setVoiceStatus(data.message); }
      else if (data.type === "asr_corrected") {
        // Show correction notice briefly in status
        setVoiceStatus(`已纠错：${data.corrected}`);
      }
      else if (data.type === "user_text") { setMessages((prev) => [...prev, { role: "user", content: data.text }]); }
      else if (data.type === "assistant_text") {
        audioChunks = [];
        setMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
        setSpeaking(true); setVoiceStatus("面试官正在说话...");
      } else if (data.type === "audio_done") {
        if (audioChunks.length > 0) {
          const blob = new Blob(audioChunks, { type: "audio/mpeg" });
          playAudioBlob(blob, finishSpeaking);
          audioChunks = [];
        } else { finishSpeaking(); }
      } else if (data.type === "tts_fallback") { speakFallback(data.text, finishSpeaking); }
      else if (data.type === "feedback") {
        setFeedback(data.feedback);
        saveFeedbackRecord(data.feedback);
        setGeneratingFeedback(false);
        setShowFeedback(true);
      } else if (data.type === "error") { setVoiceStatus(`错误：${data.message}`); setSpeaking(false); setGeneratingFeedback(false); }
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: "start", difficulty, asr_mode: true, past_memory: pastMemory }));
      setVoiceStatus("面试官准备中...");
    };
    ws.onerror = () => setVoiceStatus("WebSocket 连接失败");
    ws.onclose = () => { if (wsRef.current === ws) setVoiceStatus("连接已断开"); };
  };

  // Refs for MediaRecorder (server ASR mode)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  /** Stop any active recording/recognition */
  const stopListening = () => {
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setListening(false);
  };

  /** Browser SpeechRecognition ASR */
  const startBrowserASR = () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const W = window as any;
    const SpeechRecognitionCtor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) { alert("你的浏览器不支持语音识别，请使用 Chrome 或用下方文字输入"); return; }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "zh-CN"; recognition.continuous = true; recognition.interimResults = true;
    recognitionRef.current = recognition;

    let finalTranscript = "";
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    recognition.onresult = (event: any) => {
      let interim = "";
      finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      setVoiceStatus(finalTranscript + interim || "正在听...");
      if (silenceTimer) clearTimeout(silenceTimer);
      if (finalTranscript) { silenceTimer = setTimeout(() => recognition.stop(), 2000); }
    };

    recognition.onend = () => {
      setListening(false);
      if (finalTranscript.trim() && wsRef.current?.readyState === WebSocket.OPEN) {
        setVoiceStatus("发送中...");
        wsRef.current.send(JSON.stringify({ action: "user_text", text: finalTranscript.trim() }));
      } else if (!finalTranscript.trim()) { setVoiceStatus("未识别到语音，请重试"); }
    };

    recognition.onerror = (event: any) => {
      setListening(false);
      if (event.error === "not-allowed") alert("请允许麦克风权限");
      else setVoiceStatus(`识别错误：${event.error}`);
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */

    recognition.start(); setListening(true); setVoiceStatus("正在听...");
  };

  /** Paraformer server-side ASR: record with MediaRecorder → POST to backend → get text */
  const startServerASR = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert("请允许麦克风权限");
      return;
    }

    audioChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
      ? "audio/ogg;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setListening(false);

      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      if (blob.size < 1000) { setVoiceStatus("未检测到音频，请重试"); return; }

      setVoiceStatus("上传音频识别中 (Paraformer)...");
      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        const res = await fetch(`${API_BASE_FN()}/api/voice/asr`, { method: "POST", body: formData });
        if (!res.ok) throw new Error(await res.text());
        const { text } = await res.json();
        if (!text?.trim()) { setVoiceStatus("未识别到内容，请重试"); return; }

        setVoiceStatus(`识别结果：${text}`);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ action: "user_text", text: text.trim() }));
        }
      } catch (err) {
        setVoiceStatus(`Paraformer 识别失败：${err}`);
      }
    };

    recorder.start(200); // collect data every 200ms
    setListening(true);
    setVoiceStatus("Paraformer 录音中... 点击停止");
  };

  const toggleListening = () => {
    if (speaking) return;
    if (listening) { stopListening(); return; }
    if (asrMode === "server") {
      startServerASR();
    } else {
      startBrowserASR();
    }
  };

  const reset = () => {
    setStarted(false); setMessages([]); setInput(""); setMode("text");
    setVoiceStatus(""); setSpeaking(false); setListening(false);
    setShowFeedback(false); setFeedback(null); setGeneratingFeedback(false);
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    window.speechSynthesis?.cancel();
    wsRef.current?.close(); wsRef.current = null;
  };

  // --- Feedback View ---
  if (showFeedback && feedback) {
    return (
      <div className="p-8 max-w-3xl">
        <PageHeader title="面试反馈" description={`${new Date().toLocaleDateString("zh-CN")} · ${difficulty === "easy" ? "简单" : difficulty === "standard" ? "标准" : "压力面"} · ${mode === "voice" ? "语音" : "文字"}`} />

        <Card title="整体评价">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-bold">
              <span>评级：{feedback.overallScore}</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{feedback.summary}</p>
          </div>
        </Card>

        {feedback.questions && feedback.questions.length > 0 && (
          <Card title="问答回顾" className="mt-4">
            <div className="space-y-4">
              {feedback.questions.map((q, i) => (
                <div key={i} className="border-l-2 border-primary pl-4 space-y-1">
                  <p className="text-sm font-medium">Q{i + 1}: {q.question}</p>
                  <p className="text-sm text-muted">回答：{q.answer}</p>
                  <p className="text-sm text-foreground">{q.evaluation}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4">
          <Card title="优势">
            <ul className="space-y-2">
              {(feedback.strengths || []).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="待提升">
            <ul className="space-y-2">
              {(feedback.improvements || []).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={reset}>
            <RotateCcw size={16} /> 再来一次
          </Button>
          <p className="text-xs text-muted self-center">反馈已自动保存到「个人信息 → 面试记录」</p>
        </div>
      </div>
    );
  }

  // --- Setup Page ---
  if (!started) {
    return (
      <div className="p-8 max-w-3xl">
        <PageHeader title="模拟面试" description="基于你的个人信息，进行 AI 模拟保研面试" />

        <Card title="面试设置">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">面试难度</label>
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="easy">简单 — 温和友善，适合初次练习</option>
                <option value="standard">标准 — 正常面试节奏，适度追问</option>
                <option value="pressure">压力面 — 高频追问，模拟真实压力</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">语音识别模式（语音面试用）</label>
              <Select value={asrMode} onChange={(e) => setAsrMode(e.target.value as AsrMode)}>
                <option value="browser">浏览器识别 — 快速便捷，+LLM 纠错（推荐 Chrome）</option>
                <option value="server">Paraformer 云端识别 — 专业术语识别精准（已配置阿里云 Key）</option>
              </Select>
              <p className="text-xs text-muted mt-1">
                {asrMode === "browser"
                  ? "Chrome 内置 Google ASR + DeepSeek 纠错，适合常见词汇"
                  : "阿里云 Paraformer，支持中英混合、专业术语，录完音后上传识别"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">补充材料（可选）</label>
              <p className="text-xs text-muted mb-2">上传简历、项目文档等，面试官会基于这些内容提问</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm cursor-pointer hover:bg-accent transition-colors">
                <Upload size={14} /> 选择文件
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.md,.pdf,.doc,.docx" />
              </label>
              {uploadedFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {uploadedFiles.map((f, i) => (<p key={i} className="text-xs text-green-600">已上传：{f}</p>))}
                </div>
              )}
            </div>

            <p className="text-sm text-muted">
              系统会自动读取你在「个人信息」中填写的所有信息，面试官会基于完整资料提问。
            </p>

            <div className="flex gap-3">
              <Button onClick={startInterview}>
                <Play size={16} /> 文字面试
              </Button>
              <Button variant="secondary" onClick={startVoiceInterview}>
                <Mic size={16} /> 语音面试
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // --- Voice Mode ---
  if (mode === "voice") {
    return (
      <div className="h-full flex flex-col">
        <div className="p-6 pb-0 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Volume2 size={18} className="text-primary" /> 语音面试中
            </h1>
            <p className="text-xs text-muted">
              难度：{difficulty === "easy" ? "简单" : difficulty === "standard" ? "标准" : "压力面"}
              {" · "}{asrMode === "browser" ? "浏览器识别（推荐 Chrome）" : "云端识别"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={endInterview} disabled={generatingFeedback || messages.length < 2}>
              <FileText size={14} /> {generatingFeedback ? "生成反馈中..." : "结束并反馈"}
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user" ? "bg-primary text-white rounded-br-md" : "bg-accent text-foreground rounded-bl-md"
              }`}>{msg.content}</div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border bg-white">
          <div className="flex flex-col items-center gap-3 mb-3">
            <p className="text-sm text-muted">{voiceStatus}</p>
            <button onClick={toggleListening} disabled={speaking}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                speaking ? "bg-gray-300 text-gray-500 cursor-not-allowed" :
                listening ? "bg-red-500 text-white animate-pulse scale-110" : "bg-primary text-white hover:opacity-90"
              }`}>
              {listening ? <MicOff size={28} /> : <Mic size={28} />}
            </button>
            <p className="text-xs text-muted">
              {speaking
                ? "面试官正在说话..."
                : listening
                ? asrMode === "server" ? "Paraformer 录音中... 再次点击停止并识别" : "正在听，停顿2秒自动发送"
                : "点击开始回答"}
            </p>
          </div>
          <div className="flex gap-2 max-w-3xl mx-auto">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && input.trim() && !speaking) {
                  wsRef.current?.send(JSON.stringify({ action: "user_text", text: input.trim() }));
                  setInput("");
                }
              }}
              placeholder="也可以打字回答..." disabled={speaking}
              className="flex-1 px-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            <Button size="sm" disabled={speaking || !input.trim()} onClick={() => {
              if (input.trim()) { wsRef.current?.send(JSON.stringify({ action: "user_text", text: input.trim() })); setInput(""); }
            }}><Send size={14} /></Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Text Mode ---
  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">模拟面试中</h1>
          <p className="text-xs text-muted">
            难度：{difficulty === "easy" ? "简单" : difficulty === "standard" ? "标准" : "压力面"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={endInterview} disabled={generatingFeedback || messages.length < 2}>
            <FileText size={14} /> {generatingFeedback ? "生成反馈中..." : "结束并反馈"}
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user" ? "bg-primary text-white rounded-br-md" : "bg-accent text-foreground rounded-bl-md"
            }`}>
              {msg.content}
              {loading && i === messages.length - 1 && msg.role === "assistant" && <span className="animate-pulse">▌</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border bg-white">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="输入你的回答..." disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
