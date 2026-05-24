"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Code } from "lucide-react";

export default function CodingPage() {
  return (
    <div className="p-8 max-w-3xl">
      <PageHeader
        title="机试训练"
        description="针对院校风格的代码练习和薄弱点分析"
      />
      <Card className="text-center py-16">
        <Code size={48} className="mx-auto text-muted mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">即将推出</h3>
        <p className="text-muted text-sm max-w-md mx-auto">
          机试模块将支持针对院校的代码实战模拟、知识点薄弱分析和练习推荐。
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-lg mx-auto">
          <div className="p-3 rounded-lg bg-accent">
            <p className="text-sm font-medium">风格匹配</p>
            <p className="text-xs text-muted mt-1">分析院校机试特点</p>
          </div>
          <div className="p-3 rounded-lg bg-accent">
            <p className="text-sm font-medium">代码实战</p>
            <p className="text-xs text-muted mt-1">在线编码环境</p>
          </div>
          <div className="p-3 rounded-lg bg-accent">
            <p className="text-sm font-medium">薄弱分析</p>
            <p className="text-xs text-muted mt-1">知识点维度分析</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
