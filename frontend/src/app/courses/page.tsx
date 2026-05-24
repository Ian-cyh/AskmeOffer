"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { BookOpen } from "lucide-react";

export default function CoursesPage() {
  return (
    <div className="p-8 max-w-3xl">
      <PageHeader
        title="专业课复习"
        description="针对目标院校设计专业课复习路径和模拟口试"
      />
      <Card className="text-center py-16">
        <BookOpen size={48} className="mx-auto text-muted mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">即将推出</h3>
        <p className="text-muted text-sm max-w-md mx-auto">
          专业课模块将支持针对目标院校的知识点复习、AI 模拟口试和薄弱点分析。
          <br />
          请先在「个人信息」中添加目标院校信息。
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-lg mx-auto">
          <div className="p-3 rounded-lg bg-accent">
            <p className="text-sm font-medium">复习路径</p>
            <p className="text-xs text-muted mt-1">根据院校考核范围生成</p>
          </div>
          <div className="p-3 rounded-lg bg-accent">
            <p className="text-sm font-medium">模拟口试</p>
            <p className="text-xs text-muted mt-1">AI 扮演专业课面试官</p>
          </div>
          <div className="p-3 rounded-lg bg-accent">
            <p className="text-sm font-medium">知识点分析</p>
            <p className="text-xs text-muted mt-1">识别薄弱环节</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
