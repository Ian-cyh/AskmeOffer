"use client";

import React, { useMemo } from "react";

const RESUME_CSS = `
  .resume-body {
    font-family: "Microsoft YaHei", "Noto Sans SC", "PingFang SC", Arial, sans-serif;
    font-size: 13px;
    line-height: 1.85;
    color: #1a1a1a;
    max-width: 740px;
    margin: 0 auto;
    padding: 32px 40px;
  }
  .resume-body h1 {
    font-size: 22px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 4px;
    letter-spacing: 2px;
  }
  .resume-body h2 {
    font-size: 14px;
    font-weight: 700;
    border-bottom: 1.5px solid #1a1a1a;
    padding-bottom: 3px;
    margin: 16px 0 8px;
    letter-spacing: 1px;
  }
  .resume-body p {
    margin: 3px 0;
  }
  .resume-body strong {
    font-weight: 700;
  }
  .resume-body ul {
    padding-left: 18px;
    margin: 2px 0;
  }
  .resume-body li {
    margin: 1px 0;
  }
  .resume-body a {
    color: #0066cc;
    text-decoration: none;
  }
`;

function processInline(text: string): string {
  let s = text;
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/`(.+?)`/g, "$1");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  return s;
}

function markdownToResumeBody(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("# ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h1>${processInline(line.slice(2))}</h1>`;
    } else if (line.startsWith("## ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h2>${processInline(line.slice(3))}</h2>`;
    } else if (line.startsWith("### ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3 style="font-size:13px;font-weight:700;margin:8px 0 4px;">${processInline(line.slice(4))}</h3>`;
    } else if (/^[-*]\s/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${processInline(line.replace(/^[-*]\s/, ""))}</li>`;
    } else if (line.trim() === "") {
      if (inList) { html += "</ul>"; inList = false; }
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${processInline(line)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

const RESUME_STYLE_TAG = `<style>
  @page { margin: 20mm 15mm; }
  body {
    font-family: "Microsoft YaHei", "Noto Sans SC", "PingFang SC", Arial, sans-serif;
    font-size: 13px; line-height: 1.85; color: #1a1a1a;
    max-width: 740px; margin: 0 auto; padding: 20px 30px;
  }
  h1 { font-size: 22px; font-weight: 700; text-align: center; margin-bottom: 4px; letter-spacing: 2px; }
  h2 { font-size: 14px; font-weight: 700; border-bottom: 1.5px solid #1a1a1a; padding-bottom: 3px; margin: 16px 0 8px; }
  p { margin: 3px 0; }
  strong { font-weight: 700; }
  ul { padding-left: 18px; margin: 2px 0; }
  li { margin: 1px 0; }
  a { color: #0066cc; text-decoration: none; }
</style>`;

export function markdownToResumeHTML(md: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${RESUME_STYLE_TAG}</head><body>${markdownToResumeBody(md)}</body></html>`;
}

interface Props {
  markdown: string;
  className?: string;
}

export function ResumePreview({ markdown, className }: Props) {
  const bodyHTML = useMemo(() => markdownToResumeBody(markdown), [markdown]);
  return (
    <>
      <style>{RESUME_CSS}</style>
      <div className={`resume-body bg-white ${className || ""}`} dangerouslySetInnerHTML={{ __html: bodyHTML }} />
    </>
  );
}
