"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, MessageSquare, BookOpen, Code, Home } from "lucide-react";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "首页", icon: Home },
  { href: "/profile", label: "个人信息", icon: User },
  { href: "/interview", label: "模拟面试", icon: MessageSquare },
  { href: "/courses", label: "专业课", icon: BookOpen },
  { href: "/coding", label: "机试训练", icon: Code },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-border flex flex-col z-50">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-primary">AskmeOffer</h1>
        <p className="text-xs text-muted mt-1">保研全流程 AI 助手</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-white"
                  : "text-foreground hover:bg-accent"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted text-center">16h Challenge · 2026-05-24</p>
      </div>
    </aside>
  );
}
