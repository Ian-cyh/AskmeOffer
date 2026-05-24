"use client";

import Link from "next/link";
import { User, MessageSquare, BookOpen, Code, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";

const MODULES = [
  {
    href: "/profile",
    icon: User,
    title: "个人信息",
    desc: "录入基本信息、成绩、成果、经历，AI 自动生成简历和个人陈述",
    status: "可用",
    color: "text-blue-600 bg-blue-50",
  },
  {
    href: "/interview",
    icon: MessageSquare,
    title: "模拟面试",
    desc: "文字/语音双模式 AI 面试，支持音色选择、手撕代码、历史汇总与追问",
    status: "可用",
    color: "text-green-600 bg-green-50",
  },
  {
    href: "/courses",
    icon: BookOpen,
    title: "专业课",
    desc: "文字/语音双模式知识点考核，错题本、AI 答疑、知识地图全覆盖",
    status: "可用",
    color: "text-purple-600 bg-purple-50",
  },
  {
    href: "/coding",
    icon: Code,
    title: "机试训练",
    desc: "AI 出题 + 在线编译运行，代码评审与薄弱点分析",
    status: "可用",
    color: "text-orange-600 bg-orange-50",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-full">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white px-8 py-16">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold mb-4">AskmeOffer</h1>
          <p className="text-xl text-blue-100 mb-2">保研全流程 AI 助手</p>
          <p className="text-blue-200 leading-relaxed">
            从个人信息管理到材料生成，从模拟面试到专业课复习——
            <br />
            一站式解决保研准备过程中的所有痛点。
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-white text-blue-700 font-medium rounded-lg hover:bg-blue-50 transition-colors"
          >
            开始使用 <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Modules */}
      <div className="p-8">
        <h2 className="text-lg font-semibold mb-6">功能模块</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.href} href={m.href} className="block group">
                <Card className="h-full hover:border-primary/30 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${m.color}`}>
                      <Icon size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold group-hover:text-primary transition-colors">
                          {m.title}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          m.status === "可用" ? "bg-green-100 text-green-700" : "bg-accent text-muted"
                        }`}>
                          {m.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted">{m.desc}</p>
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-muted group-hover:text-primary transition-colors mt-1"
                    />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Quick stats */}
        <div className="mt-8 p-6 rounded-xl bg-accent/50 border border-border">
          <h3 className="text-sm font-medium text-muted mb-3">核心痛点</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">01</span>
              <p className="text-muted">材料繁琐：简历、个人陈述、推荐信，每校都要微调</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">02</span>
              <p className="text-muted">面试无门：找不到练习对象，项目经历讲不透</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">03</span>
              <p className="text-muted">信息碎片：导师方向、招生偏好散落各处</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
