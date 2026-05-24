"use client";

import { useState } from "react";
import { UserProfile } from "@/types/profile";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Textarea, Select } from "@/components/ui/FormField";
import { fetchStream } from "@/lib/api";
import { FileText, Sparkles, Copy, Check } from "lucide-react";

interface Props {
  profile: UserProfile;
}

export function ResumeGenerator({ profile }: Props) {
  const [type, setType] = useState<"resume" | "personal_statement">("resume");
  const [targetSchool, setTargetSchool] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setResult("");
    try {
      await fetchStream(
        "/api/generate/stream",
        {
          profile,
          type,
          target_school: targetSchool,
          extra_instructions: extraInstructions,
        },
        (chunk) => setResult((prev) => prev + chunk),
        () => setLoading(false),
      );
    } catch (err) {
      setResult(`生成失败：${err instanceof Error ? err.message : "未知错误"}\n\n请确认后端服务已启动并配置了 LLM API Key。`);
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              ) : (
                <Select disabled>
                  <option>请先在「目标院校」中添加</option>
                </Select>
              )}
            </FormField>
          </div>
          <FormField label="额外要求（可选）" hint="如：侧重体现科研能力、字数控制在1页以内等">
            <Textarea
              rows={2}
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              placeholder="对生成内容的额外要求..."
            />
          </FormField>
          <Button onClick={generate} disabled={loading || !hasData}>
            <Sparkles size={16} />
            {loading ? "生成中..." : `生成${type === "resume" ? "简历" : "个人陈述"}`}
          </Button>
          {!hasData && (
            <p className="text-sm text-warning">请先在「基本信息」中填写姓名和院校信息</p>
          )}
        </div>
      </Card>

      {result && (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-primary" />
              <span className="font-medium">{type === "resume" ? "生成的简历" : "生成的个人陈述"}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={copyToClipboard}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "已复制" : "复制"}
            </Button>
          </div>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap bg-accent/30 rounded-lg p-4 text-sm leading-relaxed">
            {result}
            {loading && <span className="animate-pulse">▌</span>}
          </div>
        </Card>
      )}
    </div>
  );
}
