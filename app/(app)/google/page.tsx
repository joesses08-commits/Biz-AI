"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function GooglePage() {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gmail/status")
      .then((r) => r.json())
      .then((d) => {
        setConnected(d.connected);
        setEmail(d.email || "");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <h1 className="text-white text-2xl font-semibold mb-3">Connect Google Workspace</h1>
          <p className="text-white/40 text-sm mb-8 leading-relaxed">Connect your Google account to give BizAI access to Gmail, Sheets, and Drive.</p>
          <a href="/api/gmail/connect" className="inline-flex items-center gap-2 bg-white text-black font-medium py-2.5 px-6 rounded-xl text-sm hover:bg-white/90 transition">
            Connect Google
          </a>
        </div>
      </div>
    );
  }

  const tools = [
    {
      href: "/gmail",
      label: "Gmail",
      description: "Inbox, emails, unread messages",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.364l-6.545-4.636v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.273l6.545-4.636 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
        </svg>
      ),
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    },
    {
      href: "/google/sheets",
      label: "Google Sheets",
      description: "Spreadsheets, live data, financial models",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
          <path d="M14.727 0H4.364A1.636 1.636 0 0 0 2.727 1.636v20.728A1.636 1.636 0 0 0 4.364 24h15.272A1.636 1.636 0 0 0 21.273 22.364V6.545L14.727 0z" fill="#34A853"/>
          <path d="M14.727 0v6.545h6.546L14.727 0z" fill="#1E8E3E" fillOpacity="0.8"/>
          <path d="M7.636 12h8.728v1.091H7.636V12zm0 2.182h8.728v1.091H7.636v-1.091zm0 2.182h5.455v1.091H7.636v-1.091z" fill="white"/>
        </svg>
      ),
      bg: "bg-green-500/10",
      border: "border-green-500/20",
    },
    {
      href: "/google/drive",
      label: "Google Drive",
      description: "Docs, Slides, and all files",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
          <path d="M7.71 3.5L1.15 15l3.43 6 6.56-11.5L7.71 3.5z" fill="#FBBC05"/>
          <path d="M16.29 3.5h-8.58l3.43 6h8.58l-3.43-6z" fill="#4285F4"/>
          <path d="M19.72 15H12l-3.43 6h8.58l2.57-6z" fill="#34A853"/>
        </svg>
      ),
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Google Workspace</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-white/40 text-xs">{email}</span>
            </div>
          </div>
        </div>

        {/* Tool Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href}>
              <div className={`group rounded-2xl border ${tool.border} ${tool.bg} p-6 hover:border-white/20 hover:bg-white/5 transition-all duration-200 cursor-pointer`}>
                <div className={`w-11 h-11 rounded-xl ${tool.bg} border ${tool.border} flex items-center justify-center mb-4`}>
                  {tool.icon}
                </div>
                <h3 className="text-sm font-semibold mb-1">{tool.label}</h3>
                <p className="text-white/40 text-xs leading-relaxed mb-4">{tool.description}</p>
                <span className="text-white/50 text-xs group-hover:text-white/80 transition">Open {tool.label} →</span>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
