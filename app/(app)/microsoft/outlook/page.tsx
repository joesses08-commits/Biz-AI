"use client";

import { useEffect, useState } from "react";

type Email = {
  id: string;
  subject: string;
  from: string;
  fromName: string;
  to: string;
  date: string;
  isUnread: boolean;
  body: string;
  snippet: string;
};

export default function OutlookPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<Email | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/microsoft/outlook");
      const data = await res.json();
      if (!data.connected) { setConnected(false); setLoading(false); return; }
      setConnected(true);
      setEmail(data.email || "");
      setEmails(data.emails || []);
      if (data.emails?.length > 0) setSelected(data.emails[0]);
    } catch { setError("Failed to load emails"); }
    setLoading(false);
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
    try { return new Date(date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return date; }
  };

  const filtered = emails.filter(e =>
    e.subject?.toLowerCase().includes(search.toLowerCase()) ||
    e.from?.toLowerCase().includes(search.toLowerCase()) ||
    e.fromName?.toLowerCase().includes(search.toLowerCase())
  );

  if (!loading && !connected) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#0078D4]/10 border border-[#0078D4]/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
              <path d="M24 7.387v10.478c0 .23-.08.427-.241.592A.787.787 0 0 1 23.167 18.7H13.5V8.95l2.5 1.713 8-5.276z" fill="#0078D4"/>
              <path d="M13.5 8.95V18.7H.833a.787.787 0 0 1-.592-.243A.821.821 0 0 1 0 17.865V7.387l2.5-1.65z" fill="#0078D4" fillOpacity="0.7"/>
              <path d="M24 7.387L13.5 13.95 0 7.387 13.5 1z" fill="#0078D4" fillOpacity="0.5"/>
            </svg>
          </div>
          <h1 className="text-white text-2xl font-semibold mb-3">Outlook Not Connected</h1>
          <p className="text-text-secondary text-sm mb-8">Connect your Microsoft account to read Outlook emails.</p>
          <a href="/api/microsoft/connect" className="inline-flex items-center gap-2 bg-white text-black font-medium py-2.5 px-6 rounded-xl text-sm hover:bg-white/90 transition">
            Connect Microsoft 365
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-bg-base text-white flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
            <path d="M24 7.387v10.478c0 .23-.08.427-.241.592A.787.787 0 0 1 23.167 18.7H13.5V8.95l2.5 1.713 8-5.276z" fill="#0078D4"/>
            <path d="M13.5 8.95V18.7H.833a.787.787 0 0 1-.592-.243A.821.821 0 0 1 0 17.865V7.387l2.5-1.65z" fill="#0078D4" fillOpacity="0.7"/>
            <path d="M24 7.387L13.5 13.95 0 7.387 13.5 1z" fill="#0078D4" fillOpacity="0.5"/>
          </svg>
          <span className="text-sm font-semibold">Outlook</span>
          {email && <span className="text-text-muted text-xs">{email}</span>}
          <span className="text-text-muted text-xs">{emails.length} messages</span>
        </div>
        <button onClick={load} className="text-text-secondary hover:text-white/80 text-xs px-3 py-1.5 rounded-lg border border-bg-border hover:border-white/20 transition">
          Refresh
        </button>
      </div>

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
          <div className="w-80 flex-shrink-0 border-r border-bg-border flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-bg-border">
              <input type="text" placeholder="Search emails..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-bg-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-white/20" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-text-muted text-xs">No emails found</div>
              ) : filtered.map((email) => (
                <div key={email.id} onClick={() => setSelected(email)}
                  className={`px-4 py-3.5 cursor-pointer border-b border-white/[0.04] hover:bg-bg-elevated transition ${selected?.id === email.id ? "bg-white/[0.06]" : ""}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {email.isUnread && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                      <span className={`text-xs truncate ${email.isUnread ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                        {email.fromName || email.from}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/25 flex-shrink-0">{formatDate(email.date)}</span>
                  </div>
                  <p className={`text-[11px] truncate mb-0.5 ${email.isUnread ? "text-white/80 font-medium" : "text-text-secondary"}`}>{email.subject}</p>
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
                <div className="flex flex-col gap-1 mb-6 pb-6 border-b border-bg-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {(selected.fromName || selected.from).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{selected.fromName || selected.from}</p>
                      <p className="text-[11px] text-text-muted">{selected.from}</p>
                    </div>
                  </div>
                  <div className="ml-10 space-y-0.5">
                    {selected.to && <p className="text-[11px] text-text-muted"><span className="text-text-secondary">To:</span> {selected.to}</p>}
                    <p className="text-[11px] text-text-muted">{formatFullDate(selected.date)}</p>
                  </div>
                </div>
                <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                  {selected.body || selected.snippet}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-text-muted text-sm">Select an email to read it</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
