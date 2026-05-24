"use client";

import { useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  language: string;
  minHeight?: string;
}

export function CodeEditor({ value, onChange, language, minHeight = "300px" }: Props) {
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
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      });
    }
  };

  const syncScroll = () => {
    if (taRef.current && lineRef.current) {
      lineRef.current.scrollTop = taRef.current.scrollTop;
    }
  };

  return (
    <div className="relative flex border border-border rounded-lg overflow-hidden bg-[#1e1e2e] font-mono text-sm">
      <div
        ref={lineRef}
        className="select-none text-right pr-3 pl-3 py-3 text-[#4a4a6a] overflow-hidden shrink-0"
        style={{ minWidth: "2.8rem", lineHeight: "1.6rem", userSelect: "none" }}
      >
        {Array.from({ length: Math.max(lines, 1) }, (_, i) => (
          <div key={i} style={{ lineHeight: "1.6rem" }}>{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        spellCheck={false}
        className="flex-1 bg-transparent text-[#cdd6f4] outline-none resize-none py-3 pr-3 overflow-auto"
        style={{ lineHeight: "1.6rem", caretColor: "#cdd6f4", minHeight }}
        placeholder={`// 在此编写你的 ${language} 代码...`}
      />
    </div>
  );
}
