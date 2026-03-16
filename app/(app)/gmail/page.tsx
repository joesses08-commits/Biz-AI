"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Email = {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  isUnread: boolean;
  snippet: string;
  body: string;
};

export default function GmailPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connectedEmail, setConnectedEmail] = useState("");
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Email | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => { fetchEmails(); }, []);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gmail/emails");
      const data = await res.json();
      if (data.error === "Gmail not connected") { router.push("/integrations"); return; }
      setEmails(data.emails || []);
      setTotal(data.total || 0);
      setConnectedEmail(data.connectedEmail || "");
      if (data.emails?.length > 0) setSelected(data.emails[0]);
    } catch { setError("Failed to load emails"); }
    setLoading(false);
  };

  const analyzeEmails = async () => {
    setAnalyzing(true);
    setAnalysis("");
    try {
      const res = await fetch("/api/gmail/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json();
      setAnalysis(data.analysis || "No analysis available");
    } catch { setAnalysis("Failed to analyze emails."); }
    setAnalyzing(false);
  };

  const formatFrom = (from: string) => {
    const match = from.match(/^(.*?)\s*</);
    return match ? match[1].trim().replace(/"/g, "") : from.split("@")[0];
  };

  const formatFromEmail = (from: string) => {
    const match = from.match(/<(.+?)>/);
    return match ? match[1] : from;
  };

  const formatDate = (date: string) => {
    try {
      const d = new Date(date);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours < 1) return "Just now";
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch { return date; }
  };

  const formatFullDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return date; }
  };

  const filtered = emails.filter(e =>
    e.subject.toLowerCase().includes(search.toLowerCase()) ||
    e.from.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
            <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.364l-6.545-4.636v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.273l6.545-4.636 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
          </svg>
          <span className="text-sm font-semibold">Gmail</span>
          {connectedEmail && <span className="text-white/30 text-xs">{connectedEmail}</span>}
          {total > 0 && <span className="text-white/20 text-xs">{total} messages</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchEmails} className="text-white/40 hover:text-white/80 text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition">
            Refresh
          </button>
          <button onClick={analyzeEmails} disabled={analyzing || emails.length === 0}
            className="bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white/90 disabled:opacity-40 transition">
            {analyzing ? "Analyzing..." : "AI Briefing"}
          </button>
        </div>
      </div>

      {analysis && (
        <div className="mx-6 mt-4 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex-shrink-0">
          <p className="text-xs font-semibold text-blue-400 mb-2">AI Email Briefing</p>
          <p className="text-white/60 text-xs leading-relaxed whitespace-pre-wrap">{analysis}</p>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* Email list */}
          <div className="w-80 flex-shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <input
                type="text"
                placeholder="Search emails..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-white/20"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-white/20 text-xs">No emails found</div>
              ) : filtered.map((email) => (
                <div key={email.id} onClick={() => setSelected(email)}
                  className={`px-4 py-3.5 cursor-pointer border-b border-white/[0.04] hover:bg-white/[0.03] transition ${selected?.id === email.id ? "bg-white/[0.06]" : ""}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {email.isUnread && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                      <span className={`text-xs truncate ${email.isUnread ? "font-semibold text-white" : "text-white/60"}`}>
                        {formatFrom(email.from)}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/25 flex-shrink-0">{formatDate(email.date)}</span>
                  </div>
                  <p className={`text-[11px] truncate mb-0.5 ${email.isUnread ? "text-white/80 font-medium" : "text-white/40"}`}>
                    {email.subject}
                  </p>
                  <p className="text-[10px] text-white/25 truncate">{email.snippet}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Email body */}
          <div className="flex-1 overflow-y-auto">
            {selected ? (
              <div className="p-8 max-w-3xl">
                <h2 className="text-lg font-semibold text-white mb-4 leading-snug">{selected.subject}</h2>
                <div className="flex flex-col gap-1 mb-6 pb-6 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {formatFrom(selected.from).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{formatFrom(selected.from)}</p>
                      <p className="text-[11px] text-white/30">{formatFromEmail(selected.from)}</p>
                    </div>
                  </div>
                  <div className="ml-10 space-y-0.5">
                    {selected.to && <p className="text-[11px] text-white/30"><span className="text-white/40">To:</span> {selected.to}</p>}
                    <p className="text-[11px] text-white/30">{formatFullDate(selected.date)}</p>
                  </div>
                </div>
                <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                  {selected.body || selected.snippet}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-white/20 text-sm">Select an email to read it</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
