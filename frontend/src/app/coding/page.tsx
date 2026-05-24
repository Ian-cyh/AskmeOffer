"use client";

import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/FormField";
import { fetchStream } from "@/lib/api";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import {
  Play, Lightbulb, Send, RotateCcw, ChevronDown, ChevronUp,
  Trash2, Clock, CheckCircle, XCircle, AlertTriangle, BookOpen,
  Code2, History, Trophy,
} from "lucide-react";

const API_BASE = () =>
  typeof window === "undefined" ? "http://localhost:8000" : `http://${window.location.hostname}:8000`;

interface TestCase { input: string; expected: string; }
interface TestResult { input: string; expected: string; actual: string; passed: boolean; }

interface Problem {
  title: string;
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  starter_code: { python: string; cpp: string; c: string };
  test_cases: TestCase[];
}

interface CodeReview {
  correctness: string;
  time_complexity: string;
  space_complexity: string;
  code_quality: string;
  bugs: string[];
  optimizations: string[];
  standard_approach: string;
  standard_code: string;
  score: number;
  grade: string;
  summary: string;
}

interface AttemptRecord {
  id: string;
  date: string;
  problem: Problem;
  language: string;
  code: string;
  testResults: TestResult[];
  review: CodeReview | null;
  timeTakenSeconds: number;
}

const TOPICS = [
  "综合题目", "数组与双指针", "字符串处理", "链表操作",
  "栈与队列", "哈希表", "二叉树与递归", "动态规划",
  "二分查找", "排序算法", "贪心算法", "图与BFS/DFS", "数学与位运算",
];

const DIFFICULTIES = [
  { value: "easy", label: "简单", color: "text-green-600 bg-green-50", time: 20 },
  { value: "medium", label: "中等", color: "text-amber-600 bg-amber-50", time: 35 },
  { value: "hard", label: "困难", color: "text-red-600 bg-red-50", time: 60 },
];

const LANGUAGES = [
  { value: "python", label: "Python 3" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
];

const LS_KEY = "askme_coding_history";

function loadHistory(): AttemptRecord[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveAttempt(a: AttemptRecord) {
  const h = loadHistory();
  h.unshift(a);
  if (h.length > 50) h.length = 50;
  localStorage.setItem(LS_KEY, JSON.stringify(h));
}
function deleteAttempt(id: string) {
  localStorage.setItem(LS_KEY, JSON.stringify(loadHistory().filter(a => a.id !== id)));
}

function CodeEditor({
  value, onChange, language,
}: { value: string; onChange: (v: string) => void; language: string }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const lines = value.split("\n").length;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = value.slice(0, start) + "    " + value.slice(end);
      onChange(newVal);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 4; });
    }
  };

  const syncScroll = () => {
    if (taRef.current && lineRef.current) lineRef.current.scrollTop = taRef.current.scrollTop;
  };

  return (
    <div className="relative flex border border-border rounded-lg overflow-hidden bg-[#1e1e2e] font-mono text-sm">
      <div ref={lineRef} className="select-none text-right pr-3 pl-3 py-3 text-[#4a4a6a] overflow-hidden shrink-0"
        style={{ minWidth: "2.8rem", lineHeight: "1.6rem", userSelect: "none" }}>
        {Array.from({ length: Math.max(lines, 1) }, (_, i) => (
          <div key={i} style={{ lineHeight: "1.6rem" }}>{i + 1}</div>
        ))}
      </div>
      <textarea ref={taRef} value={value} onChange={e => onChange(e.target.value)} onKeyDown={handleKeyDown}
        onScroll={syncScroll} spellCheck={false}
        className="flex-1 bg-transparent text-[#cdd6f4] outline-none resize-none py-3 pr-3 overflow-auto"
        style={{ lineHeight: "1.6rem", caretColor: "#cdd6f4", minHeight: "400px" }}
        placeholder={`// 在此编写你的 ${language} 代码...`} />
    </div>
  );
}

function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (running) { ref.current = setInterval(() => setSeconds(s => s + 1), 1000); }
    else { if (ref.current) clearInterval(ref.current); }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);
  const reset = () => setSeconds(0);
  const fmt = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return { seconds, fmt, reset };
}

type Phase = "setup" | "practice" | "review" | "history";

export default function CodingPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [topic, setTopic] = useState("综合题目");
  const [difficulty, setDifficulty] = useState("medium");
  const [language, setLanguage] = useState("python");

  const [problem, setProblem] = useState<Problem | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genBuffer, setGenBuffer] = useState("");

  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [runOutput, setRunOutput] = useState<{ stdout: string; stderr: string; exit_code: number } | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [customStdin, setCustomStdin] = useState("");
  const [activeTestTab, setActiveTestTab] = useState<"custom" | "cases">("cases");

  const [hints, setHints] = useState<string[]>([]);
  const [hintLoading, setHintLoading] = useState(false);

  const [review, setReview] = useState<CodeReview | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const [history, setHistory] = useState<AttemptRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showStd, setShowStd] = useState<string | null>(null);

  const { seconds: elapsed, fmt: timerFmt, reset: resetTimer } = useTimer(phase === "practice");
  const sessionId = useRef(crypto.randomUUID());

  useEffect(() => { setHistory(loadHistory()); }, []);

  const generateProblem = async () => {
    setGenerating(true);
    setGenBuffer("");
    setProblem(null);
    resetTimer();
    const existingTitles = history.slice(0, 20).map(a => a.problem.title);
    let buffer = "";
    await fetchStream(
      "/api/coding/generate",
      { topic, difficulty, exclude_titles: existingTitles },
      (chunk) => { buffer += chunk; setGenBuffer(buffer); },
      () => {},
    );
    try {
      let json = buffer.trim();
      if (json.startsWith("```")) json = json.split("\n").slice(1).join("\n");
      if (json.endsWith("```")) json = json.slice(0, json.lastIndexOf("```"));
      const parsed: Problem = JSON.parse(json.trim());
      setProblem(parsed);
      setCode(parsed.starter_code?.[language as keyof typeof parsed.starter_code] || "");
      setHints([]); setRunOutput(null); setTestResults([]); setReview(null);
      sessionId.current = crypto.randomUUID();
      setPhase("practice");
    } catch { alert("题目生成失败，请重试"); }
    setGenerating(false);
  };

  useEffect(() => {
    if (problem && phase === "practice") {
      const starter = problem.starter_code?.[language as keyof typeof problem.starter_code];
      if (starter && !code.trim()) setCode(starter);
    }
  }, [language]);

  const runCustom = async () => {
    if (!code.trim()) return;
    setRunning(true); setRunOutput(null);
    try {
      const res = await fetch(`${API_BASE()}/api/code/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, stdin: customStdin }),
      });
      setRunOutput(await res.json());
    } catch (e) { setRunOutput({ stdout: "", stderr: String(e), exit_code: -1 }); }
    setRunning(false);
  };

  const runAllCases = async () => {
    if (!code.trim() || !problem?.test_cases?.length) return;
    setRunning(true); setTestResults([]); setRunOutput(null);
    const results: TestResult[] = [];
    for (const tc of problem.test_cases) {
      try {
        const res = await fetch(`${API_BASE()}/api/code/run`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language, code, stdin: tc.input }),
        });
        const data = await res.json();
        const actual = data.stderr && data.exit_code !== 0 ? `[错误] ${data.stderr.slice(0, 200)}` : (data.stdout ?? "");
        results.push({
          input: tc.input, expected: tc.expected, actual,
          passed: actual.trimEnd() === tc.expected.trimEnd() && data.exit_code === 0,
        });
      } catch (e) { results.push({ input: tc.input, expected: tc.expected, actual: String(e), passed: false }); }
    }
    setTestResults(results);
    setRunning(false);
  };

  const runCode = () => activeTestTab === "custom" ? runCustom() : runAllCases();

  const getHint = async () => {
    if (!problem || hintLoading) return;
    setHintLoading(true);
    let full = "";
    await fetchStream(
      "/api/coding/hint",
      { problem_title: problem.title, problem_description: problem.description, current_code: code, hint_round: hints.length + 1, language },
      (chunk) => { full += chunk; }, () => {},
    );
    setHints(prev => [...prev, full]);
    setHintLoading(false);
  };

  const submitForReview = async () => {
    if (!problem || reviewing) return;
    setReviewing(true);
    try {
      const res = await fetch(`${API_BASE()}/api/coding/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem_title: problem.title, problem_description: problem.description,
          code, language, run_output: runOutput?.stdout || "", test_results: testResults,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setReview(data.review);
        const attempt: AttemptRecord = {
          id: sessionId.current, date: new Date().toLocaleString(),
          problem, language, code, testResults, review: data.review, timeTakenSeconds: elapsed,
        };
        saveAttempt(attempt); setHistory(loadHistory()); setPhase("review");
      }
    } catch (e) { alert(`评审失败：${e}`); }
    setReviewing(false);
  };

  const diffBadge = (d: string) => {
    const cfg = DIFFICULTIES.find(x => x.value === d);
    return cfg ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span> : null;
  };

  // SETUP / HISTORY
  if (phase === "setup" || phase === "history") {
    return (
      <div className="p-8 max-w-5xl space-y-6">
        <PageHeader title="机试训练" description="AI 出题 · 在线编码 · 渐进提示 · 代码评审" />
        <div className="flex gap-1 border-b border-border">
          {[
            { id: "setup", label: "开始练习", icon: Code2 },
            { id: "history", label: `历史记录 (${history.length})`, icon: History },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setPhase(id as Phase)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                phase === id ? "border-blue-500 text-blue-600" : "border-transparent text-muted hover:text-foreground"
              }`}><Icon size={14} />{label}</button>
          ))}
        </div>

        {phase === "setup" && (
          <div className="space-y-6">
            <Card title="题目配置" description="选择知识点方向和难度，AI 随机生成专属题目">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-xs font-medium text-muted mb-1 block">知识点方向</label>
                  <Select value={topic} onChange={e => setTopic(e.target.value)}>
                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted mb-1 block">难度</label>
                  <Select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                    {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}（约{d.time}分钟）</option>)}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted mb-1 block">编程语言</label>
                  <Select value={language} onChange={e => setLanguage(e.target.value)}>
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </Select>
                </div>
              </div>
              <Button onClick={generateProblem} disabled={generating}>
                {generating ? <><span className="animate-spin mr-2">⚙</span>生成中...</> : <><Code2 size={14} />生成题目</>}
              </Button>
              {generating && genBuffer && (
                <div className="mt-3 text-xs text-muted font-mono bg-accent/30 p-2 rounded max-h-20 overflow-hidden">{genBuffer.slice(0, 200)}...</div>
              )}
            </Card>
            {history.length > 0 && (
              <Card title="练习统计" description="各知识点练习情况">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(() => {
                    const stats: Record<string, { total: number; avg: number }> = {};
                    for (const a of history) {
                      const t = a.problem.topic || "其他";
                      if (!stats[t]) stats[t] = { total: 0, avg: 0 };
                      stats[t].total++;
                      stats[t].avg = Math.round((stats[t].avg * (stats[t].total - 1) + (a.review?.score || 0)) / stats[t].total);
                    }
                    return Object.entries(stats).slice(0, 8).map(([t, s]) => (
                      <div key={t} className="p-3 rounded-lg bg-accent/50 border border-border">
                        <div className="text-xs font-medium truncate">{t}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted">{s.total} 题</span>
                          <span className={`text-xs font-bold ${s.avg >= 80 ? "text-green-600" : s.avg >= 60 ? "text-amber-600" : "text-red-600"}`}>{s.avg}分</span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </Card>
            )}
          </div>
        )}

        {phase === "history" && (
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-16 text-muted"><BookOpen size={48} className="mx-auto mb-4 opacity-30" /><p>暂无练习记录</p></div>
            ) : history.map(a => (
              <div key={a.id} className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 hover:bg-accent/50 cursor-pointer select-none" onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                      (a.review?.score || 0) >= 80 ? "bg-green-100 text-green-700" : (a.review?.score || 0) >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                    }`}>{a.review?.grade || "?"}</div>
                    <div>
                      <div className="font-medium text-sm">{a.problem.title}</div>
                      <div className="text-xs text-muted mt-0.5 flex gap-2">
                        <span>{a.date}</span><span>{a.language}</span>{diffBadge(a.problem.difficulty)}
                        <span className="flex items-center gap-0.5"><Clock size={11} />{Math.floor(a.timeTakenSeconds / 60)}分{a.timeTakenSeconds % 60}秒</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-muted">{a.review?.score ?? "-"}</span>
                    <button onClick={e => { e.stopPropagation(); deleteAttempt(a.id); setHistory(loadHistory()); }} className="p-1 text-muted hover:text-red-500"><Trash2 size={14} /></button>
                    {expandedId === a.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {expandedId === a.id && a.review && (
                  <div className="border-t border-border p-4 space-y-4 bg-accent/10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {[
                        { l: "正确性", c: a.review.correctness }, { l: "时间复杂度", c: a.review.time_complexity },
                        { l: "空间复杂度", c: a.review.space_complexity }, { l: "代码质量", c: a.review.code_quality },
                      ].map(({ l, c }) => (
                        <div key={l} className="p-2 rounded bg-white border border-border"><div className="text-xs text-muted">{l}</div><MarkdownContent content={c} /></div>
                      ))}
                    </div>
                    {a.review.bugs.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-red-600 mb-1">Bug / 问题</div>
                        <ul className="space-y-1">{a.review.bugs.map((b, i) => (
                          <li key={i} className="text-sm flex gap-2"><XCircle size={14} className="text-red-500 shrink-0 mt-0.5" /><MarkdownContent content={b} /></li>
                        ))}</ul>
                      </div>
                    )}
                    <details>
                      <summary className="cursor-pointer text-xs text-blue-600 hover:underline">查看标准解法</summary>
                      <div className="mt-2 p-3 rounded bg-white border border-border text-sm">
                        <MarkdownContent content={a.review.standard_approach} />
                        {showStd === a.id ? (
                          <><pre className="mt-2 p-2 bg-[#1e1e2e] text-[#cdd6f4] rounded text-xs overflow-auto">{a.review.standard_code}</pre>
                          <button className="text-xs text-muted mt-1 hover:text-foreground" onClick={() => setShowStd(null)}>收起代码</button></>
                        ) : <button className="text-xs text-blue-600 mt-1 hover:underline" onClick={() => setShowStd(a.id)}>显示标准代码</button>}
                      </div>
                    </details>
                    <details>
                      <summary className="cursor-pointer text-xs text-muted hover:text-foreground">查看提交代码</summary>
                      <pre className="mt-2 p-3 bg-[#1e1e2e] text-[#cdd6f4] rounded text-xs overflow-auto">{a.code}</pre>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // PRACTICE
  if (phase === "practice" && problem) {
    return (
      <div className="p-4 max-w-full">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <button onClick={() => setPhase("setup")} className="text-sm text-muted hover:text-foreground">← 返回</button>
            <h1 className="font-bold text-lg">{problem.title}</h1>
            {diffBadge(problem.difficulty)}
            {problem.tags?.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{t}</span>)}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-mono text-muted"><Clock size={14} />{timerFmt}</div>
            <Select value={language} onChange={e => { setLanguage(e.target.value); const s = problem.starter_code?.[e.target.value as keyof typeof problem.starter_code]; if (s) setCode(s); }} className="text-sm">
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
            <Button size="sm" onClick={getHint} disabled={hintLoading} variant="secondary"><Lightbulb size={13} />{hintLoading ? "..." : `提示 (${hints.length})`}</Button>
            <Button size="sm" onClick={submitForReview} disabled={reviewing} variant="secondary"><Send size={13} />{reviewing ? "评审中..." : "提交评审"}</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3 overflow-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
            <div className="bg-white border border-border rounded-lg p-4 space-y-4">
              <div className="prose prose-sm max-w-none"><MarkdownContent content={problem.description} /></div>
              <div>
                <div className="text-sm font-medium mb-2">示例</div>
                {problem.examples.map((ex, i) => (
                  <div key={i} className="mb-3 p-3 rounded bg-accent/50 text-sm font-mono space-y-1">
                    <div><span className="text-muted">输入：</span><pre className="inline whitespace-pre-wrap">{ex.input}</pre></div>
                    <div><span className="text-muted">输出：</span><pre className="inline whitespace-pre-wrap">{ex.output}</pre></div>
                    {ex.explanation && <div className="text-muted text-xs">{ex.explanation}</div>}
                  </div>
                ))}
              </div>
              <div>
                <div className="text-sm font-medium mb-2">约束条件</div>
                <ul className="space-y-1">{problem.constraints.map((c, i) => <li key={i} className="text-sm font-mono text-muted">{c}</li>)}</ul>
              </div>
            </div>
            {hints.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                <div className="text-sm font-medium text-amber-800 flex items-center gap-1.5"><Lightbulb size={14} />提示（第 {hints.length} 层）</div>
                {hints.map((h, i) => <div key={i} className="text-sm"><div className="text-xs text-amber-600 mb-1">提示 {i + 1}</div><MarkdownContent content={h} /></div>)}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <CodeEditor value={code} onChange={setCode} language={language} />
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex border-b border-border bg-accent/30">
                {([{ id: "cases" as const, label: `测试用例 (${problem?.test_cases?.length ?? 0})` }, { id: "custom" as const, label: "自定义输入" }]).map(({ id, label }) => (
                  <button key={id} onClick={() => setActiveTestTab(id)}
                    className={`px-4 py-2 text-xs font-medium transition ${activeTestTab === id ? "border-b-2 border-blue-500 text-blue-600 bg-white" : "text-muted hover:text-foreground"}`}>{label}</button>
                ))}
                <div className="ml-auto flex items-center pr-2">
                  <button onClick={runCode} disabled={running}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
                    <Play size={11} />{running ? "运行中..." : activeTestTab === "cases" ? "运行全部测试" : "运行"}
                  </button>
                </div>
              </div>
              {activeTestTab === "custom" && (
                <div className="p-3 space-y-2">
                  <div className="text-xs text-muted mb-1">输入数据（stdin）：</div>
                  <textarea value={customStdin} onChange={e => setCustomStdin(e.target.value)}
                    className="w-full p-2 font-mono text-xs bg-[#1e1e2e] text-[#cdd6f4] rounded border border-border resize-none outline-none" rows={4}
                    placeholder={"在此输入测试数据，如：\n5\n1 2 3 4 5"} />
                  {runOutput && (
                    <div className="space-y-1">
                      <div className={`text-xs font-medium flex items-center gap-1 ${runOutput.exit_code === 0 ? "text-green-600" : "text-red-600"}`}>
                        {runOutput.exit_code === 0 ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {runOutput.exit_code === 0 ? "运行成功" : `运行失败 (exit ${runOutput.exit_code})`}
                      </div>
                      {runOutput.stdout && <pre className="p-2 text-xs font-mono bg-[#1e1e2e] text-[#cdd6f4] rounded overflow-auto max-h-36">{runOutput.stdout}</pre>}
                      {runOutput.stderr && <pre className="p-2 text-xs font-mono bg-red-950 text-red-300 rounded overflow-auto max-h-24">{runOutput.stderr}</pre>}
                    </div>
                  )}
                </div>
              )}
              {activeTestTab === "cases" && (
                <div>
                  {testResults.length > 0 ? (
                    <>
                      <div className="px-3 py-2 text-xs bg-accent/20 flex items-center justify-between border-b border-border">
                        <span className="font-medium">测试结果</span>
                        <span className={testResults.every(t => t.passed) ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                          {testResults.filter(t => t.passed).length}/{testResults.length} 通过</span>
                      </div>
                      <div className="divide-y divide-border max-h-72 overflow-auto">
                        {testResults.map((t, i) => (
                          <div key={i} className={`p-3 text-xs ${t.passed ? "bg-green-50" : "bg-red-50"}`}>
                            <div className="flex items-center gap-1.5 mb-2 font-medium">
                              {t.passed ? <CheckCircle size={13} className="text-green-500" /> : <XCircle size={13} className="text-red-500" />}
                              用例 {i + 1} — {t.passed ? "通过" : "失败"}
                            </div>
                            <div className="grid grid-cols-1 gap-1 font-mono">
                              <div><span className="text-muted">输入：</span><pre className="inline whitespace-pre-wrap break-all">{t.input}</pre></div>
                              <div><span className="text-muted">期望：</span><pre className="inline whitespace-pre-wrap break-all text-green-700">{t.expected}</pre></div>
                              {!t.passed && <div><span className="text-red-600">实际：</span><pre className="inline whitespace-pre-wrap break-all text-red-700">{t.actual}</pre></div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <div className="p-6 text-center text-xs text-muted">点击「运行全部测试」自动将每个测试用例输入注入程序并比对输出</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // REVIEW
  if (phase === "review" && review) {
    const scoreColor = review.score >= 80 ? "text-green-600" : review.score >= 60 ? "text-amber-600" : "text-red-600";
    const scoreBg = review.score >= 80 ? "bg-green-50 border-green-200" : review.score >= 60 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
    return (
      <div className="p-8 max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">代码评审 — {problem?.title}</h1>
          <div className="flex gap-2">
            <Button onClick={() => { setProblem(null); setPhase("setup"); }}><RotateCcw size={14} />继续练习</Button>
            <Button variant="secondary" onClick={() => setPhase("history")}><History size={14} />历史记录</Button>
          </div>
        </div>
        <div className={`border rounded-xl p-6 flex items-center gap-6 ${scoreBg}`}>
          <div className="text-center"><div className={`text-5xl font-bold ${scoreColor}`}>{review.score}</div><div className={`text-lg font-semibold ${scoreColor}`}>{review.grade}</div></div>
          <div>
            <div className="font-medium text-lg">{review.summary}</div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted">
              <span className="flex items-center gap-1"><Clock size={13} />{Math.floor(elapsed / 60)}分{elapsed % 60}秒</span>
              <span>{language}</span>{diffBadge(problem?.difficulty || "")}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[{ label: "正确性", content: review.correctness }, { label: "时间复杂度", content: review.time_complexity },
            { label: "空间复杂度", content: review.space_complexity }, { label: "代码质量", content: review.code_quality }].map(({ label, content }) => (
            <Card key={label} title={label}><div className="text-sm"><MarkdownContent content={content} /></div></Card>
          ))}
        </div>
        {review.bugs.length > 0 && (
          <Card title="问题与 Bug"><ul className="space-y-2">{review.bugs.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm"><AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" /><MarkdownContent content={b} /></li>
          ))}</ul></Card>
        )}
        {review.optimizations.length > 0 && (
          <Card title="优化建议"><ul className="space-y-2">{review.optimizations.map((o, i) => (
            <li key={i} className="flex gap-2 text-sm"><Trophy size={14} className="text-blue-500 shrink-0 mt-0.5" /><MarkdownContent content={o} /></li>
          ))}</ul></Card>
        )}
        <Card title="标准解法">
          <div className="text-sm mb-4"><MarkdownContent content={review.standard_approach} /></div>
          <details>
            <summary className="cursor-pointer text-sm text-blue-600 hover:underline font-medium">查看标准代码（Python）</summary>
            <pre className="mt-3 p-4 bg-[#1e1e2e] text-[#cdd6f4] rounded-lg text-sm overflow-auto leading-relaxed">{review.standard_code}</pre>
          </details>
        </Card>
        <Card title="你的提交代码"><pre className="p-4 bg-[#1e1e2e] text-[#cdd6f4] rounded-lg text-sm overflow-auto max-h-64 leading-relaxed">{code}</pre></Card>
      </div>
    );
  }

  return null;
}
