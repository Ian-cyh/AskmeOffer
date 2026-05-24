import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AskmeOffer — 保研全流程 AI 助手",
  description: "为保研学生提供一站式 AI 辅助：个人信息管理、材料生成、模拟面试、专业课复习、机试训练",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
      </head>
      <body className="h-full flex" suppressHydrationWarning>
        <Sidebar />
        <main className="flex-1 ml-64 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
