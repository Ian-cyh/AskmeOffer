"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/FormField";
import { fetchStream } from "@/lib/api";
import { loadProfile, loadInterviewRecords, saveInterviewRecord, InterviewRecord } from "@/lib/store";
import { UserProfile } from "@/types/profile";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { Send, Play, RotateCcw, Upload, Mic, MicOff, Volume2, FileText, CheckCircle, AlertTriangle, MessageSquare, Lightbulb, Code2, X } from "lucide-react";
import { CodeEditor } from "@/components/interview/CodeEditor";

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

// Global ref to track current audio for pause/resume on visibility change
let _currentAudio: HTMLAudioElement | null = null;

function playAudioBlob(blob: Blob, onEnd?: () => void): HTMLAudioElement {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  _currentAudio = audio;
  audio.onended = () => { URL.revokeObjectURL(url); _currentAudio = null; onEnd?.(); };
  audio.onerror = () => { URL.revokeObjectURL(url); _currentAudio = null; onEnd?.(); };
  audio.play().catch(() => { _currentAudio = null; onEnd?.(); });
  return audio;
}

const IN_PROGRESS_KEY = "interview-in-progress";
interface InProgressData {
  sessionId: string;
  messages: Message[];
  difficulty: string;
  mode: "text" | "voice";
  ttsVoice: string;
  interviewerInfo: string;
  savedAt: string;
}


/** Build a rich agentic memory from past interview records for the backend.
 *  - Includes per-question weak answers so the interviewer can revisit them
 *  - Highlights persistent weak points to guide follow-up questioning
 */
function buildPastMemory(): string {
  const records = loadInterviewRecords().slice(0, 5);
  if (records.length === 0) return "";

  const lines: string[] = [
    "【候选人历史面试记忆】请严格按以下指示利用历史记录：",
    "1. 对历次面试中回答不佳或被标为「待提升」的问题，本次面试应重新考察，验证是否改进",
    "2. 已表现出色的方向无需重复深挖，聚焦薄弱处",
    "3. 若候选人再次回答错误，给予更具体的追问",
    "",
  ];

  // Collect weak questions across all records
  const weakQuestions: string[] = [];
  const persistentWeaknesses = new Set<string>();

  records.forEach((r, i) => {
    lines.push(`─── 第 ${i + 1} 次面试（${r.date}，${r.difficulty}难度）───`);
    if (r.feedback) {
      lines.push(`整体评价：${r.feedback.summary}`);
      lines.push(`综合评级：${r.feedback.overallScore}`);
      if (r.feedback.strengths?.length) {
        lines.push(`✓ 优势：${r.feedback.strengths.slice(0, 3).join("；")}`);
      }
      if (r.feedback.improvements?.length) {
        r.feedback.improvements.forEach(w => persistentWeaknesses.add(w));
        lines.push(`✗ 待提升：${r.feedback.improvements.join("；")}`);
      }
      if (r.feedback.expression_summary) {
        lines.push(`表达点评：${r.feedback.expression_summary}`);
      }
      // Per-question details — focus on low score / weak answers
      if (r.feedback.questions?.length) {
        const weakQs = r.feedback.questions.filter(q =>
          (q.score != null && q.score < 75) ||
          q.evaluation?.includes("待提升") ||
          q.evaluation?.includes("不足") ||
          q.evaluation?.includes("错误")
        );
        if (weakQs.length > 0) {
          lines.push("  ⚠ 回答薄弱的问题（本次应重新考察）：");
          weakQs.forEach(q => {
            const entry = `    问题：「${q.question}」 | 当时回答：${q.answer?.slice(0, 60)}... | 评价：${q.evaluation}`;
            lines.push(entry);
            weakQuestions.push(q.question);
          });
        }
      }
    }
    lines.push("");
  });

  if (persistentWeaknesses.size > 0) {
    lines.push(`【跨次持续薄弱点——本次务必重点考察】：${[...persistentWeaknesses].join("；")}`);
  }
  if (weakQuestions.length > 0) {
    lines.push(`【历次未答好的问题列表——应在合适时机重新提问】：`);
    weakQuestions.slice(0, 8).forEach((q, i) => lines.push(`  ${i + 1}. ${q}`));
  }

  return lines.join("\n");
}

export default function InterviewPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [difficulty, setDifficulty] = useState("standard");

  const [ttsVoice, setTtsVoice] = useState("zh-CN-YunxiNeural");
  const [interviewerInfo, setInterviewerInfo] = useState("");
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

  // Code challenge state
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [codeChallenge, setCodeChallenge] = useState<{title:string;description:string;examples:{input:string;output:string;explanation?:string}[];language:string;starter_code:string} | null>(null);
  const [userCode, setUserCode] = useState("");
  const [codeReview, setCodeReview] = useState("");
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);

  // Resume modal state
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savedData, setSavedData] = useState<InProgressData | null>(null);

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
    // Check for in-progress interview on mount
    try {
      const raw = localStorage.getItem(IN_PROGRESS_KEY);
      if (raw) {
        const data: InProgressData = JSON.parse(raw);
        if (data.messages && data.messages.length > 1) {
          setSavedData(data);
          setShowResumeModal(true);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Auto-save in-progress interview whenever messages change
  useEffect(() => {
    if (!started || showFeedback || messages.length < 2) return;
    const data: InProgressData = {
      sessionId, messages, difficulty, mode, ttsVoice, interviewerInfo,
      savedAt: new Date().toLocaleString("zh-CN"),
    };
    try { localStorage.setItem(IN_PROGRESS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, [messages, started, showFeedback, sessionId, difficulty, mode, ttsVoice, interviewerInfo]);

  /** Shared cleanup: stop all audio, recording, WebSocket */
  const cleanupAll = useCallback(() => {
    if (_currentAudio) { _currentAudio.pause(); _currentAudio = null; }
    window.speechSynthesis?.cancel();
    if (silenceIntervalRef.current) { clearInterval(silenceIntervalRef.current); silenceIntervalRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    recognitionRef.current?.stop();
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
  }, []);

  // Pause audio & stop recording when user switches away from the page
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (_currentAudio) _currentAudio.pause();
        if (silenceIntervalRef.current) { clearInterval(silenceIntervalRef.current); silenceIntervalRef.current = null; }
        if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        recognitionRef.current?.stop();
        setListening(false);
        setSpeaking(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Cleanup on component unmount (Next.js client-side navigation)
  useEffect(() => {
    return () => { cleanupAll(); };
  }, [cleanupAll]);

  // Warn on page close/navigation if interview is in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (started && !showFeedback && messages.length > 1) {
        e.preventDefault();
        e.returnValue = "面试进行中，数据已自动保存，确定离开？";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [started, showFeedback, messages.length]);

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
    // Clear in-progress save
    try { localStorage.removeItem(IN_PROGRESS_KEY); } catch { /* ignore */ }
  };

  const resumeInterview = () => {
    if (!savedData) return;
    setMessages(savedData.messages);
    setSessionId(savedData.sessionId);
    setDifficulty(savedData.difficulty);
    setMode(savedData.mode as "text" | "voice");
    setTtsVoice(savedData.ttsVoice);
    setInterviewerInfo(savedData.interviewerInfo);
    setStarted(true);
    setShowResumeModal(false);
    setSavedData(null);
  };

  const discardSaved = () => {
    try { localStorage.removeItem(IN_PROGRESS_KEY); } catch { /* ignore */ }
    setShowResumeModal(false);
    setSavedData(null);
  };

  // --- Code Challenge ---
  const requestCodeChallenge = async () => {
    setLoadingChallenge(true);
    setCodeChallenge(null);
    setUserCode("");
    setCodeReview("");
    setShowCodePanel(true);
    try {
      const res = await fetch(`${API_BASE_FN()}/api/interview/code_challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      if (data.ok && data.challenge) {
        setCodeChallenge(data.challenge);
        setUserCode(data.challenge.starter_code || "");
      } else {
        alert(data.error || "题目生成失败");
        setShowCodePanel(false);
      }
    } catch {
      alert("题目生成失败，请检查后端服务");
      setShowCodePanel(false);
    }
    setLoadingChallenge(false);
  };

  const submitCode = async () => {
    if (!codeChallenge || !userCode.trim()) return;
    setLoadingReview(true);
    setCodeReview("");
    let review = "";
    try {
      await fetchStream(
        "/api/interview/code_review",
        { session_id: sessionId, problem: codeChallenge.description, code: userCode, language: codeChallenge.language },
        (chunk) => { review += chunk; setCodeReview(review); },
        () => setLoadingReview(false),
      );
    } catch {
      setCodeReview("代码评审失败，请重试。");
      setLoadingReview(false);
    }
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
        { profile, difficulty, session_id: newSessionId, past_memory: pastMemory, asr_mode: false, interviewer_info: interviewerInfo },
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
    const finishSpeaking = () => {
      setSpeaking(false);
      if (autoListenRef.current && !document.hidden) {
        // Auto-start recording after TTS finishes
        setTimeout(() => startServerASR(true), 300);
      } else {
        setVoiceStatus("点击麦克风按钮开始回答");
      }
    };

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
      ws.send(JSON.stringify({ action: "start", difficulty, asr_mode: true, past_memory: pastMemory, tts_voice: ttsVoice, interviewer_info: interviewerInfo }));
      setVoiceStatus("面试官准备中...");
    };
    ws.onerror = () => setVoiceStatus("WebSocket 连接失败");
    ws.onclose = () => { if (wsRef.current === ws) setVoiceStatus("连接已断开"); };
  };

  // Refs for MediaRecorder (server ASR mode)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Auto-listen: start recording automatically after TTS audio ends
  const autoListenRef = useRef(true);

  /** Stop any active recording/recognition and clean up silence detector */
  const stopListening = () => {
    if (silenceIntervalRef.current) { clearInterval(silenceIntervalRef.current); silenceIntervalRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
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

  /** Paraformer server-side ASR: record with MediaRecorder → POST to backend → get text.
   *  When autoSilence=true, uses Web Audio API to auto-stop after 2s of silence. */
  const startServerASR = async (autoSilence = false) => {
    if (listening) return; // guard against double-start
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
      // cleanup silence detector
      if (silenceIntervalRef.current) { clearInterval(silenceIntervalRef.current); silenceIntervalRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
      stream.getTracks().forEach((t) => t.stop());
      setListening(false);

      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      if (blob.size < 1000) { setVoiceStatus(autoSilence ? "未检测到音频，请再试" : "未检测到音频，请重试"); return; }

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

    recorder.start(200);
    setListening(true);
    setVoiceStatus(autoSilence ? "🎙 自动录音中... 2秒静音后自动提交" : "Paraformer 录音中... 点击停止");

    // --- Silence detection via Web Audio API ---
    if (autoSilence) {
      try {
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.fftSize);

        const SILENCE_THRESHOLD = 8;   // amplitude RMS below this = silence
        const SILENCE_MS = 2000;       // 2 seconds
        let silenceStart: number | null = null;
        let hasSpoken = false;         // wait for at least some speech first

        silenceIntervalRef.current = setInterval(() => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
            if (silenceIntervalRef.current) { clearInterval(silenceIntervalRef.current); silenceIntervalRef.current = null; }
            return;
          }
          analyser.getByteTimeDomainData(dataArray);
          const rms = Math.sqrt(
            dataArray.reduce((acc, v) => acc + (v - 128) * (v - 128), 0) / dataArray.length
          );

          if (rms >= SILENCE_THRESHOLD) {
            hasSpoken = true;
            silenceStart = null;
            setVoiceStatus("🎙 录音中... 检测到声音");
          } else if (hasSpoken) {
            if (silenceStart === null) silenceStart = Date.now();
            const silenced = Date.now() - silenceStart;
            if (silenced >= SILENCE_MS) {
              // Auto stop
              if (silenceIntervalRef.current) { clearInterval(silenceIntervalRef.current); silenceIntervalRef.current = null; }
              const rec = mediaRecorderRef.current;
              if (rec && (rec.state === "recording" || rec.state === "paused")) {
                setVoiceStatus("检测到静音，自动提交中...");
                rec.stop();
              }
            } else {
              const sec = ((SILENCE_MS - silenced) / 1000).toFixed(1);
              setVoiceStatus(`🔇 ${sec}s 后自动提交...`);
            }
          }
          // If !hasSpoken yet, just wait (show initial status)
        }, 100);
      } catch {
        // AudioContext not supported — fall back to manual stop
      }
    }
  };

  const toggleListening = () => {
    if (speaking) return;
    if (listening) { stopListening(); return; }
    // Always use server-side Paraformer ASR in voice mode
    startServerASR(false); // manual trigger — no auto silence detection
  };

  const reset = () => {
    setStarted(false); setMessages([]); setInput(""); setMode("text");
    setVoiceStatus(""); setSpeaking(false); setListening(false);
    setShowFeedback(false); setFeedback(null); setGeneratingFeedback(false);
    setShowCodePanel(false); setCodeChallenge(null); setUserCode(""); setCodeReview("");
    if (silenceIntervalRef.current) { clearInterval(silenceIntervalRef.current); silenceIntervalRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    window.speechSynthesis?.cancel();
    wsRef.current?.close(); wsRef.current = null;
    try { localStorage.removeItem(IN_PROGRESS_KEY); } catch { /* ignore */ }
  };

  // --- Feedback View ---
  if (showFeedback && feedback) {
    const scoreColor = (s?: string) => {
      if (!s) return "text-gray-500";
      if (s.startsWith("A")) return "text-green-600";
      if (s.startsWith("B")) return "text-blue-600";
      if (s.startsWith("C")) return "text-amber-600";
      return "text-red-600";
    };

    return (
      <div className="p-8 max-w-3xl space-y-4">
        <PageHeader title="面试反馈" description={`${new Date().toLocaleDateString("zh-CN")} · ${difficulty === "easy" ? "简单" : difficulty === "standard" ? "标准" : "压力面"} · ${mode === "voice" ? "语音" : "文字"}`} />

        <Card title="整体评价">
          <div className="space-y-3">
            <div className={`text-2xl font-bold ${scoreColor(feedback.overallScore)}`}>
              {feedback.overallScore}
            </div>
            <div className="text-sm text-foreground leading-relaxed"><MarkdownContent content={feedback.summary} /></div>
          </div>
        </Card>

        {feedback.expression_summary && (
          <Card title="语言表达点评">
            <div className="flex items-start gap-2">
              <MessageSquare size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div className="text-sm leading-relaxed"><MarkdownContent content={feedback.expression_summary} /></div>
            </div>
          </Card>
        )}

        {feedback.questions && feedback.questions.length > 0 && (
          <Card title="逐题回顾">
            <div className="space-y-5">
              {feedback.questions.map((q, i) => (
                <div key={i} className="border border-border rounded-lg overflow-hidden">
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Q{i + 1}: {q.question}</p>
                      {q.score != null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          q.score >= 85 ? "text-green-700 bg-green-100" :
                          q.score >= 70 ? "text-blue-700 bg-blue-100" :
                          q.score >= 55 ? "text-amber-700 bg-amber-100" : "text-red-700 bg-red-100"
                        }`}>{q.score}分</span>
                      )}
                    </div>
                    <div className="bg-accent/50 p-3 rounded text-sm">
                      <span className="text-xs text-muted font-medium">你的回答：</span>
                      <p className="mt-1">{q.answer}</p>
                    </div>
                    <div className="text-sm">
                      <span className="text-xs text-muted font-medium">准确性评价：</span>
                      <div className="mt-1"><MarkdownContent content={q.evaluation} /></div>
                    </div>
                  </div>
                  {(q.expression_advice || q.suggested_answer) && (
                    <div className="border-t border-border p-4 bg-accent/10 space-y-3">
                      {q.expression_advice && (
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 mb-1">
                            <MessageSquare size={12} /> 表达优化建议
                          </div>
                          <div className="text-sm text-foreground"><MarkdownContent content={q.expression_advice} /></div>
                        </div>
                      )}
                      {q.suggested_answer && (
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 mb-1">
                            <Lightbulb size={12} /> 参考回答
                          </div>
                          <div className="text-sm bg-green-50 p-3 rounded"><MarkdownContent content={q.suggested_answer} /></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Card title="优势">
            <ul className="space-y-2">
              {(feedback.strengths || []).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                  <MarkdownContent content={s} />
                </li>
              ))}
            </ul>
          </Card>
          <Card title="待提升">
            <ul className="space-y-2">
              {(feedback.improvements || []).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <MarkdownContent content={s} />
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

        {/* Resume modal */}
        {showResumeModal && savedData && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold mb-2">发现未完成的面试</h3>
              <p className="text-sm text-muted mb-1">保存时间：{savedData.savedAt}</p>
              <p className="text-sm text-muted mb-4">已对话 {savedData.messages.length} 条，难度：{savedData.difficulty}</p>
              <div className="flex gap-3">
                <Button onClick={resumeInterview}><Play size={14} /> 继续面试</Button>
                <Button variant="secondary" onClick={discardSaved}><X size={14} /> 放弃，重新开始</Button>
              </div>
            </div>
          </div>
        )}

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

            <div className="bg-blue-50 rounded-lg px-4 py-2.5 text-sm text-blue-700">
              <span className="font-medium">语音面试</span>：使用阿里云 Paraformer 云端识别，支持中英混合、专业术语识别精准。录音后上传自动识别，也可用文字辅助输入。
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">面试官音色（语音面试）</label>
              <Select value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)}>
                <option value="zh-CN-YunxiNeural">云希（温和男声）— 温和亲切，适合常规面试</option>
                <option value="zh-CN-YunjianNeural">云健（严肃男声）— 严肃专业，适合压力面试</option>
                <option value="zh-CN-YunyangNeural">云扬（播报男声）— 沉稳权威，适合正式场合</option>
                <option value="zh-CN-XiaoxiaoNeural">晓晓（活泼女声）— 亲切活泼，适合轻松面试</option>
                <option value="zh-CN-XiaoyiNeural">晓伊（温柔女声）— 温柔细腻，适合学术交流</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">面试官设定（可选）</label>
              <textarea
                value={interviewerInfo}
                onChange={(e) => setInterviewerInfo(e.target.value)}
                placeholder="例如：北京大学计算机学院张伟教授，研究方向为深度学习与计算机视觉"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                rows={2}
              />
              <p className="text-xs text-muted mt-1">填写目标导师信息后，AI 将模拟该导师进行面试</p>
              {/* URL auto-parse */}
              <div className="flex gap-2 mt-2">
                <input
                  id="professor-url-input"
                  type="url"
                  placeholder="粘贴导师主页 URL，自动解析信息..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button
                  onClick={async () => {
                    const inp = (document.getElementById("professor-url-input") as HTMLInputElement);
                    const url = inp?.value?.trim();
                    if (!url) return;
                    setInterviewerInfo("正在解析主页，请稍候...");
                    const API = `http://${window.location.hostname}:8000`;

                    // Step 1: try to fetch the page HTML from the browser
                    let pageText = "";
                    try {
                      const pageRes = await fetch(url, { mode: "cors", signal: AbortSignal.timeout(8000) });
                      const html = await pageRes.text();
                      // Strip HTML tags in JS
                      const tmp = document.createElement("div");
                      tmp.innerHTML = html;
                      // Remove scripts and styles
                      tmp.querySelectorAll("script,style").forEach(el => el.remove());
                      pageText = (tmp.innerText || tmp.textContent || "").replace(/\s+/g, " ").trim().slice(0, 4000);
                    } catch {
                      // CORS or network error — send URL only, backend will use LLM knowledge
                      pageText = "";
                    }

                    // Step 2: send to backend for LLM extraction
                    try {
                      const res = await fetch(`${API}/api/interview/fetch_professor`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url, page_text: pageText }),
                      });
                      const data = await res.json();
                      if (data.error) { setInterviewerInfo(""); alert(`解析失败：${data.error}`); }
                      else setInterviewerInfo(data.info || "");
                    } catch (e) {
                      setInterviewerInfo("");
                      alert(`请求失败：${e}`);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  解析主页
                </button>
              </div>
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
        {/* Header */}
        <div className="p-4 pb-0 flex items-center justify-between border-b border-border/50">
          <div>
            <h1 className="text-base font-bold flex items-center gap-2">
              <Volume2 size={16} className="text-primary" /> 语音面试中
            </h1>
            <p className="text-xs text-muted">
              难度：{difficulty === "easy" ? "简单" : difficulty === "standard" ? "标准" : "压力面"}
              {" · "}Paraformer 云端识别
            </p>
          </div>
          <div className="flex gap-2 pb-1">
            {messages.length >= 4 && !showCodePanel && (
              <Button variant="secondary" size="sm" onClick={requestCodeChallenge} disabled={loadingChallenge}>
                <Code2 size={13} /> {loadingChallenge ? "出题中..." : "手撕代码"}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={endInterview} disabled={generatingFeedback || messages.length < 2}>
              <FileText size={13} /> {generatingFeedback ? "生成反馈中..." : "结束并反馈"}
            </Button>
          </div>
        </div>

        {/* Body: split when code panel open */}
        <div className={`flex flex-1 overflow-hidden`}>
          {/* Chat + mic column */}
          <div className={`flex flex-col ${showCodePanel ? "w-1/2 border-r border-border" : "w-full"}`}>
            <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user" ? "bg-primary text-white rounded-br-md" : "bg-accent text-foreground rounded-bl-md"
                  }`}>{msg.content}</div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border bg-white">
              <div className="flex flex-col items-center gap-2 mb-2">
                <p className="text-xs text-muted text-center">{voiceStatus || (speaking ? "面试官正在说话..." : "等待开始...")}</p>
                <button onClick={toggleListening} disabled={speaking}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    speaking ? "bg-gray-300 text-gray-500 cursor-not-allowed" :
                    listening ? "bg-red-500 text-white animate-pulse scale-110" : "bg-primary text-white hover:opacity-90"
                  }`}>
                  {listening ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted">
                    {speaking ? "面试官正在说话..." : listening ? "录音中... 点击停止" : "点击开始回答"}
                  </p>
                  <button
                    title={autoListenRef.current ? "自动接听已开启（面试官说完自动录音）" : "自动接听已关闭（需手动点击）"}
                    onClick={() => { autoListenRef.current = !autoListenRef.current; setVoiceStatus(autoListenRef.current ? "✅ 自动接听已开启" : "⭕ 自动接听已关闭"); }}
                    className="text-xs px-2 py-0.5 rounded border border-border text-muted hover:border-primary hover:text-primary transition-colors"
                  >
                    {autoListenRef.current ? "自动●" : "手动○"}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && input.trim() && !speaking) {
                      wsRef.current?.send(JSON.stringify({ action: "user_text", text: input.trim() }));
                      setInput("");
                    }
                  }}
                  placeholder="也可以打字回答..." disabled={speaking}
                  className="flex-1 px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                <Button size="sm" disabled={speaking || !input.trim()} onClick={() => {
                  if (input.trim()) { wsRef.current?.send(JSON.stringify({ action: "user_text", text: input.trim() })); setInput(""); }
                }}><Send size={14} /></Button>
              </div>
            </div>
          </div>

          {/* Code panel column */}
          {showCodePanel && (
            <div className="w-1/2 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-accent/30">
                <span className="text-sm font-medium flex items-center gap-1.5"><Code2 size={14} /> 手撕代码</span>
                <button onClick={() => setShowCodePanel(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-4">
                {loadingChallenge ? (
                  <div className="text-center py-12 text-muted text-sm">正在生成题目...</div>
                ) : codeChallenge ? (
                  <>
                    <div className="bg-white rounded-lg border border-border p-4 space-y-2">
                      <div className="font-semibold text-sm">{codeChallenge.title}</div>
                      <div className="text-sm text-muted whitespace-pre-wrap">{codeChallenge.description}</div>
                      {codeChallenge.examples.map((ex, i) => (
                        <div key={i} className="bg-gray-50 rounded p-2 text-xs font-mono space-y-1">
                          <div className="text-gray-500">输入：</div>
                          <div className="whitespace-pre">{ex.input}</div>
                          <div className="text-gray-500 mt-1">输出：</div>
                          <div className="whitespace-pre">{ex.output}</div>
                          {ex.explanation && <div className="text-gray-400 mt-1">说明：{ex.explanation}</div>}
                        </div>
                      ))}
                    </div>
                    <CodeEditor value={userCode} onChange={setUserCode} language={codeChallenge.language} minHeight="200px" />
                    <div className="flex gap-2">
                      <Button onClick={submitCode} disabled={loadingReview || !userCode.trim()}>
                        {loadingReview ? "评审中..." : "提交代码"}
                      </Button>
                      <Button variant="secondary" onClick={requestCodeChallenge} disabled={loadingChallenge}>换一题</Button>
                    </div>
                    {codeReview && (
                      <div className="bg-white rounded-lg border border-border p-4">
                        <div className="text-sm font-medium mb-2">面试官点评：</div>
                        <div className="text-sm"><MarkdownContent content={codeReview} /></div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          )}
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
          {messages.length >= 4 && !showCodePanel && (
            <Button variant="secondary" size="sm" onClick={requestCodeChallenge} disabled={loadingChallenge}>
              <Code2 size={14} /> {loadingChallenge ? "出题中..." : "手撕代码"}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={endInterview} disabled={generatingFeedback || messages.length < 2}>
            <FileText size={14} /> {generatingFeedback ? "生成反馈中..." : "结束并反馈"}
          </Button>
        </div>
      </div>

      <div className={`flex flex-1 overflow-hidden ${showCodePanel ? "gap-0" : ""}`}>
        {/* Chat panel */}
        <div className={`flex flex-col ${showCodePanel ? "w-1/2 border-r border-border" : "w-full"}`}>
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
            <div className="flex gap-2">
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

        {/* Code panel */}
        {showCodePanel && (
          <div className="w-1/2 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-accent/30">
              <span className="text-sm font-medium flex items-center gap-1.5"><Code2 size={14} /> 手撕代码</span>
              <button onClick={() => setShowCodePanel(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {loadingChallenge ? (
                <div className="text-center py-12 text-muted text-sm">正在生成题目...</div>
              ) : codeChallenge ? (
                <>
                  <div className="bg-white rounded-lg border border-border p-4 space-y-2">
                    <div className="font-semibold text-sm">{codeChallenge.title}</div>
                    <div className="text-sm text-muted whitespace-pre-wrap">{codeChallenge.description}</div>
                    {codeChallenge.examples.map((ex, i) => (
                      <div key={i} className="bg-gray-50 rounded p-2 text-xs font-mono space-y-1">
                        <div className="text-gray-500">输入：</div>
                        <div className="whitespace-pre">{ex.input}</div>
                        <div className="text-gray-500 mt-1">输出：</div>
                        <div className="whitespace-pre">{ex.output}</div>
                        {ex.explanation && <div className="text-gray-400 mt-1">说明：{ex.explanation}</div>}
                      </div>
                    ))}
                  </div>
                  <CodeEditor value={userCode} onChange={setUserCode} language={codeChallenge.language} minHeight="200px" />
                  <div className="flex gap-2">
                    <Button onClick={submitCode} disabled={loadingReview || !userCode.trim()}>
                      {loadingReview ? "评审中..." : "提交代码"}
                    </Button>
                    <Button variant="secondary" onClick={requestCodeChallenge} disabled={loadingChallenge}>
                      换一题
                    </Button>
                  </div>
                  {codeReview && (
                    <div className="bg-white rounded-lg border border-border p-4">
                      <div className="text-sm font-medium mb-2">面试官点评：</div>
                      <div className="text-sm"><MarkdownContent content={codeReview} /></div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
