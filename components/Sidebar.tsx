"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UploadCloud,
  LayoutDashboard,
  MessageSquare,
  Zap,
  Settings,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/upload",
    icon: UploadCloud,
    label: "Data Upload",
    description: "Import CSV files",
  },
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    description: "Business metrics",
  },
  {
    href: "/chat",
    icon: MessageSquare,
    label: "AI Analyst",
    description: "Ask questions",
  },
];

const bottomItems = [
  { href: "/settings", icon: Settings, label: "Settings" },
  { href: "/help", icon: HelpCircle, label: "Help" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col h-screen bg-bg-surface border-r border-bg-border">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-bg-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center glow-accent">
            <Zap size={14} className="text-white" fill="white" />
          </div>
          <div>
            <div
              className="text-sm font-bold text-text-primary leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              BizAI
            </div>
            <div className="text-[10px] text-text-muted mt-0.5 leading-none">
              Intelligence Platform
            </div>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-widest px-3 mb-3">
          Workspace
        </div>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "nav-item group",
                  isActive && "active"
                )}
              >
                <Icon
                  size={16}
                  className={cn(
                    "flex-shrink-0 transition-colors",
                    isActive ? "text-accent" : "text-text-muted group-hover:text-text-secondary"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium leading-none">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5 leading-none truncate">
                    {item.description}
                  </div>
                </div>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-accent flex-shrink-0" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-bg-border pt-3 space-y-1">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div className="nav-item">
                <Icon size={15} className="text-text-muted flex-shrink-0" />
                <span className="text-[13px]">{item.label}</span>
              </div>
            </Link>
          );
        })}

        {/* Version badge */}
        <div className="px-3 pt-2">
          <div className="text-[10px] text-text-muted">
            Prototype v0.1 · Claude Sonnet
          </div>
        </div>
      </div>
    </aside>
  );
}
