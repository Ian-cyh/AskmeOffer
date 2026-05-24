"use client";

import { useState, useRef } from "react";
import { UserProfile } from "@/types/profile";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Textarea, Select } from "@/components/ui/FormField";
import { fetchStream } from "@/lib/api";
import { ResumePreview } from "./ResumePreview";
import { FileText, Sparkles, Copy, Check, Download, Eye, Code2 } from "lucide-react";

interface Props { profile: UserProfile; }

export function ResumeGenerator({ profile }: Props) {
  const [type, setType] = useState<"resume" | "personal_statement">("resume");
  const [targetSchool, setTargetSchool] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "raw">("preview");
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const generate = async () => {
    setLoading(true); setResult("");
    try {
      await fetchStream(
        "/api/generate/stream",
        { profile, type, target_school: targetSchool, extra_instructions: extraInstructions },
        (chunk) => setResult((prev) => prev + chunk),
        () => setLoading(false),
      );
    } catch (err) {
      setResult(`生成失败：${err instanceof Error ? err.message : "未知错误"}`);
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const findWhitestRow = (ctx: CanvasRenderingContext2D, w: number, baseY: number, range: number): number => {
    let bestY = baseY;
    let bestWhite = -1;
    const startY = Math.max(0, baseY - range);
    const endY = Math.min(ctx.canvas.height, baseY + range);
    for (let y = startY; y < endY; y++) {
      const row = ctx.getImageData(0, y, w, 1).data;
      let white = 0;
      for (let i = 0; i < row.length; i += 4) {
        if (row[i] > 240 && row[i + 1] > 240 && row[i + 2] > 240) white++;
      }
      if (white > bestWhite) { bestWhite = white; bestY = y; }
    }
    return bestY;
  };

  const exportPDFDirect = async () => {
    if (!containerRef.current) return;
    setExportingPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(containerRef.current, { scale: 2, useCORS: true, backgroundColor: "#fff" });
      const ctx = canvas.getContext("2d")!;
      const imgW = 210;
      const pageH = 297;
      const margin = 10;
      const contentW = imgW - margin * 2;
      const contentH = pageH - margin * 2;
      const scale = contentW / canvas.width;
      const totalH = canvas.height;
      const pageContentH = contentH / scale;
      const pdf = new jsPDF("p", "mm", "a4");
      let srcY = 0;
      let page = 0;
      while (srcY < totalH) {
        if (page > 0) pdf.addPage();
        let sliceH = Math.min(pageContentH, totalH - srcY);
        if (srcY + sliceH < totalH) {
          sliceH = findWhitestRow(ctx, canvas.width, Math.round(srcY + sliceH), 40) - srcY;
          if (sliceH < 100) sliceH = pageContentH;
        }
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.round(sliceH);
        sliceCanvas.getContext("2d")!.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const imgData = sliceCanvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", margin, margin, contentW, sliceH * scale);
        srcY += sliceH;
        page++;
      }
      pdf.save(`${type === "resume" ? "简历" : "个人陈述"}_${new Date().toLocaleDateString()}.pdf`);
    } catch (e) { alert(`PDF 导出失败：${e}`); }
    setExportingPDF(false);
  };

  const exportDOCX = async () => {
    setExportingWord(true);
    try {
      const docx = await import("docx");
      const { saveAs } = await import("file-saver");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const children: any[] = [];
      const lines = result.split("\n");
      for (const line of lines) {
        if (line.startsWith("# ")) {
          children.push(new docx.Paragraph({ text: line.slice(2), heading: docx.HeadingLevel.HEADING_1, spacing: { after: 100 } }));
        } else if (line.startsWith("## ")) {
          children.push(new docx.Paragraph({ text: line.slice(3), heading: docx.HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
        } else if (line.startsWith("### ")) {
          children.push(new docx.Paragraph({ text: line.slice(4), heading: docx.HeadingLevel.HEADING_3, spacing: { before: 100, after: 50 } }));
        } else if (/^[-*]\s/.test(line)) {
          const text = line.replace(/^[-*]\s/, "");
          const runs: any[] = [];
          const parts = text.split(/(\*\*.*?\*\*)/g);
          for (const p of parts) {
            if (p.startsWith("**") && p.endsWith("**")) {
              runs.push(new docx.TextRun({ text: p.slice(2, -2), bold: true, size: 21 }));
            } else { runs.push(new docx.TextRun({ text: p, size: 21 })); }
          }
          children.push(new docx.Paragraph({ children: runs, bullet: { level: 0 }, spacing: { after: 40 } }));
        } else if (line.trim()) {
          const runs: any[] = [];
          const parts = line.split(/(\*\*.*?\*\*)/g);
          for (const p of parts) {
            if (p.startsWith("**") && p.endsWith("**")) {
              runs.push(new docx.TextRun({ text: p.slice(2, -2), bold: true, size: 21 }));
            } else { runs.push(new docx.TextRun({ text: p, size: 21 })); }
          }
          children.push(new docx.Paragraph({ children: runs, spacing: { after: 60 } }));
        }
      }
      const doc = new docx.Document({ sections: [{ children }] });
      const blob = await docx.Packer.toBlob(doc);
      saveAs(blob, `${type === "resume" ? "简历" : "个人陈述"}_${new Date().toLocaleDateString()}.docx`);
    } catch (e) { alert(`Word 导出失败：${e}`); }
    setExportingWord(false);
  };

  const hasData = profile.basic_info.name && profile.basic_info.university;

  return (
    <div className="space-y-6">
      <Card title="AI 材料生成" description="基于你的个人信息，一键生成简历或个人陈述">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="生成类型">
              <Select value={type} onChange={(e) => setType(e.target.value as "resume" | "personal_statement")}>
                <option value="resume">个人简历</option>
                <option value="personal_statement">个人陈述</option>
              </Select>
            </FormField>
            <FormField label="目标院校（可选）">
              {profile.target_schools.length > 0 ? (
                <Select value={targetSchool} onChange={(e) => setTargetSchool(e.target.value)}>
                  <option value="">不指定</option>
                  {profile.target_schools.map((s) => (
                    <option key={s.id} value={`${s.school_name} ${s.department} ${s.program}`}>
                      {s.school_name} - {s.department}
                    </option>
                  ))}
                </Select>
              ) : <Select disabled><option>请先在「目标院校」中添加</option></Select>}
            </FormField>
          </div>
          <FormField label="额外要求（可选）" hint="如：侧重体现科研能力、字数控制在1页以内等">
            <Textarea rows={2} value={extraInstructions} onChange={(e) => setExtraInstructions(e.target.value)} placeholder="对生成内容的额外要求..." />
          </FormField>
          <Button onClick={generate} disabled={loading || !hasData}>
            <Sparkles size={16} />{loading ? "生成中..." : `生成${type === "resume" ? "简历" : "个人陈述"}`}
          </Button>
          {!hasData && <p className="text-sm text-warning">请先在「基本信息」中填写姓名和院校信息</p>}
        </div>
      </Card>

      {result && (
        <Card>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-primary" />
              <span className="font-medium">{type === "resume" ? "生成的简历" : "生成的个人陈述"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setViewMode(viewMode === "preview" ? "raw" : "preview")}>
                {viewMode === "preview" ? <><Code2 size={13} />原始文本</> : <><Eye size={13} />美观预览</>}
              </Button>
              <Button variant="secondary" size="sm" onClick={copyToClipboard}>
                {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "已复制" : "复制"}
              </Button>
              <Button variant="secondary" size="sm" onClick={exportPDFDirect} disabled={exportingPDF || loading}>
                <Download size={13} />{exportingPDF ? "导出中..." : "导出 PDF"}
              </Button>
              <Button variant="secondary" size="sm" onClick={exportDOCX} disabled={exportingWord || loading}>
                <Download size={13} />{exportingWord ? "导出中..." : "导出 Word"}
              </Button>
            </div>
          </div>
          {viewMode === "preview" ? (
            <div ref={containerRef} className="border border-border rounded-lg overflow-hidden">
              <ResumePreview markdown={result} />
              {loading && <div className="p-4 text-center"><span className="animate-pulse text-muted">生成中...</span></div>}
            </div>
          ) : (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap bg-accent/30 rounded-lg p-4 text-sm leading-relaxed">
              {result}{loading && <span className="animate-pulse">▌</span>}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
