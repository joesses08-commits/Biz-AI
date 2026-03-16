"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function MicrosoftPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/microsoft/data")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
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

  if (!data || !data.connected) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <svg viewBox="0 0 23 23" className="w-8 h-8" fill="none">
              <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
              <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
              <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
              <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
            </svg>
          </div>
          <h1 className="text-white text-2xl font-semibold mb-3">Connect Microsoft 365</h1>
          <p className="text-white/40 text-sm mb-8 leading-relaxed">Connect your Microsoft account to give BizAI access to Outlook, Calendar, Excel, and OneDrive.</p>
          <a href="/api/microsoft/connect" className="inline-flex items-center gap-2 bg-white text-black font-medium py-2.5 px-6 rounded-xl text-sm hover:bg-white/90 transition">
            Connect Microsoft 365
          </a>
        </div>
      </div>
    );
  }

  const tools = [
    {
      href: "/microsoft/outlook",
      label: "Outlook",
      description: "Inbox, emails, unread messages",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
          <path d="M24 7.387v10.478c0 .23-.08.427-.241.592A.787.787 0 0 1 23.167 18.7H13.5V8.95l2.5 1.713 8-5.276z" fill="#0078D4"/>
          <path d="M13.5 8.95V18.7H.833a.787.787 0 0 1-.592-.243A.821.821 0 0 1 0 17.865V7.387l2.5-1.65z" fill="#0078D4" fillOpacity="0.7"/>
          <path d="M24 7.387L13.5 13.95 0 7.387 13.5 1z" fill="#0078D4" fillOpacity="0.5"/>
          <rect x="1" y="6" width="8" height="12" rx="1" fill="#0078D4" fillOpacity="0.15"/>
          <path d="M2 9h6M2 12h6M2 15h4" stroke="white" strokeWidth="1" strokeLinecap="round"/>
        </svg>
      ),
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      href: "/microsoft/calendar",
      label: "Calendar",
      description: "Meetings, events, schedule",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
          <rect x="2" y="4" width="20" height="18" rx="2" fill="#0078D4" fillOpacity="0.15" stroke="#0078D4" strokeWidth="1.5"/>
          <path d="M2 9h20" stroke="#0078D4" strokeWidth="1.5"/>
          <path d="M7 2v4M17 2v4" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round"/>
          <rect x="6" y="13" width="3" height="3" rx="0.5" fill="#0078D4"/>
          <rect x="10.5" y="13" width="3" height="3" rx="0.5" fill="#0078D4" fillOpacity="0.5"/>
          <rect x="15" y="13" width="3" height="3" rx="0.5" fill="#0078D4" fillOpacity="0.5"/>
        </svg>
      ),
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
    {
      href: "/microsoft/excel",
      label: "Excel",
      description: "Spreadsheets, financial models, live data",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
          <rect x="2" y="2" width="20" height="20" rx="2" fill="#217346" fillOpacity="0.2"/>
          <path d="M14 2v20M2 8h20M2 14h20" stroke="#217346" strokeWidth="1.2" strokeOpacity="0.6"/>
          <path d="M6 5l3 4-3 4M11 13h4" stroke="#217346" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      bg: "bg-green-500/10",
      border: "border-green-500/20",
    },
    {
      href: "/microsoft/drive",
      label: "OneDrive",
      description: "Word docs, PowerPoints, all files",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
          <path d="M10.5 7.5A5.5 5.5 0 0 1 21 10a4 4 0 0 1-.5 8H5a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 6-2.5z" fill="#0078D4" fillOpacity="0.3" stroke="#0078D4" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      ),
      bg: "bg-sky-500/10",
      border: "border-sky-500/20",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <svg viewBox="0 0 23 23" className="w-6 h-6" fill="none">
              <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
              <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
              <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
              <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Microsoft 365</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-white/40 text-xs">{data.email}</span>
            </div>
          </div>
        </div>

        {/* Tool Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
