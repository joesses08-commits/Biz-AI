"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Email = {
  id: string;
  subject: string;
  from: string;
  date: string;
  isUnread: boolean;
  snippet: string;
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

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gmail/emails");
      const data = await res.json();
      if (data.error === "Gmail not connected") {
        router.push("/integrations");
        return;
      }
      setEmails(data.emails || []);
      setTotal(data.total || 0);
      setConnectedEmail(data.connectedEmail || "");
    } catch {
      setError("Failed to load emails");
    }
    setLoading(false);
  };

  const analyzeEmails = async () => {
    setAnalyzing(true);
    setAnalysis("");
    try {
      const emailSummary = emails.map(e => 
        `From: ${e.from}\nSubject: ${e.subject}\nSnippet: ${e.snippet}`
      ).join("\n\n");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Analyze these emails from my inbox and give me a business intelligence summary. What are the key action items, important conversations, and anything I should prioritize? Here are my recent emails:\n\n${emailSummary}` }]
        }),
      });
      const data = await res.json();
      setAnalysis(data.content || data.message || "No analysis available");
    } catch {
      setAnalysis("Failed to analyze emails");
    }
    setAnalyzing(false);
  };

  const formatFrom = (from: string) => {
    const match = from.match(/^(.*?)\s*</);
    return match ? match[1].trim().replace(/"/g, "") : from.split("@")[0];
  };

  const formatDate = (date: string) => {
    try {
      const d = new Date(date);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString();
    } catch {
      return date;
    }
  };

  return (
    <div className="min-h-screen bg-[#080b12] text-white p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <img src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" className="w-7 h-7" alt="Gmail" />
              <h1 className="text-3xl font-bold tracking-tight">Gmail</h1>
            </div>
            <p className="text-white/40 text-sm">
              {connectedEmail && `Connected as ${connectedEmail} · `}{total > 0 && `${total} emails in inbox`}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchEmails} className="bg-white/5 border border-white/10 text-white/60 hover:text-white px-4 py-2 rounded-xl text-sm transition">
              ↻ Refresh
            </button>
            <button onClick={analyzeEmails} disabled={analyzing || emails.length === 0}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl text-sm transition">
              {analyzing ? "Analyzing..." : "✨ AI Analysis"}
            </button>
          </div>
        </div>

        {/* AI Analysis */}
        {analysis && (
          <div className="bg-blue-600/10 border border-blue-500/30 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-400 font-semibold text-sm">✨ AI COO Email Analysis</span>
            </div>
            <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{analysis}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-white/40 text-sm">Loading your emails...</div>
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm">{error}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Email List */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="text-sm font-semibold text-white/70">Recent Emails</h2>
              </div>
              <div className="divide-y divide-white/5">
                {emails.length === 0 ? (
                  <div className="px-5 py-8 text-center text-white/30 text-sm">No emails found</div>
                ) : (
                  emails.map((email) => (
                    <div key={email.id} onClick={() => setSelected(email)}
                      className={`px-5 py-4 cursor-pointer hover:bg-white/5 transition ${selected?.id === email.id ? "bg-white/10" : ""}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {email.isUnread && <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />}
                          <span className={`text-sm truncate ${email.isUnread ? "font-semibold text-white" : "text-white/70"}`}>
                            {formatFrom(email.from)}
                          </span>
                        </div>
                        <span className="text-[10px] text-white/30 flex-shrink-0">{formatDate(email.date)}</span>
                      </div>
                      <p className={`text-xs truncate mb-1 ${email.isUnread ? "text-white/80" : "text-white/50"}`}>
                        {email.subject}
                      </p>
                      <p className="text-[11px] text-white/30 truncate">{email.snippet}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Email Detail */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {selected ? (
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="font-semibold text-white text-base mb-2">{selected.subject}</h3>
                    <div className="text-xs text-white/40 space-y-1">
                      <p><span className="text-white/60">From:</span> {selected.from}</p>
                      <p><span className="text-white/60">Date:</span> {selected.date}</p>
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <p className="text-sm text-white/60 leading-relaxed">{selected.snippet}</p>
                  </div>
                  {selected.isUnread && (
                    <div className="mt-4">
                      <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-full">Unread</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full py-20">
                  <p className="text-white/20 text-sm">Click an email to preview it</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
