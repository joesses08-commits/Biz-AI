"use client";

import { useEffect, useState } from "react";

const FEATURE_LABELS: Record<string, string> = {
  plm_agent: "PLM Agent",
  dashboard: "Dashboard",
  chat: "Chat",
  event_processor: "Event Processing",
  snapshot: "Data Sync",
  briefing: "Email Briefing",
  "factory-quote-extraction": "Quote Extraction",
  "factory-quote-recommendation": "Quote Comparison",
  document_drop: "Document Drop",
  "excel-import": "Excel Import",
};

const now = new Date();
const MONTH_NAME = now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" });

export default function UsagePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"month" | "30days">("month");

  useEffect(() => {
    fetch("/api/usage")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const rows: any[] = data?.rows || [];

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const filteredRows = activeTab === "month"
    ? rows.filter(r => new Date(r.created_at) >= thisMonthStart)
    : rows;

  // Group by day
  const byDay: Record<string, any[]> = {};
  for (const row of filteredRows) {
    const day = new Date(row.created_at).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York"
    });
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(row);
  }

  const totalCost = activeTab === "month" ? (data?.monthCost || 0) : (data?.totalCost || 0);
  const totalCalls = activeTab === "month" ? (data?.monthCalls || 0) : (data?.totalCalls || 0);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="text-text-muted text-xs uppercase tracking-widest mb-2">Settings</p>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Usage & Costs</h1>
        <p className="text-text-muted text-sm mt-1">AI usage across PLM agent, quote extraction, and document processing</p>
      </div>

      {loading ? (
        <div className="text-text-muted text-sm">Loading...</div>
      ) : !data ? (
        <div className="text-text-muted text-sm">No usage data yet.</div>
      ) : (
        <>
          {/* Tab Toggle */}
          <div className="flex items-center gap-1 bg-bg-elevated border border-bg-border rounded-xl p-1 w-fit mb-6">
            <button onClick={() => setActiveTab("month")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${activeTab === "month" ? "bg-white text-black" : "text-text-secondary hover:text-text-secondary"}`}>
              {MONTH_NAME}
            </button>
            <button onClick={() => setActiveTab("30days")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${activeTab === "30days" ? "bg-white text-black" : "text-text-secondary hover:text-text-secondary"}`}>
              Last 30 Days
            </button>
          </div>

          {/* Daily Summary Table */}
          <div className="bg-bg-elevated border border-bg-border rounded-2xl overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-bg-border grid grid-cols-4 gap-4">
              <p className="text-text-muted text-xs uppercase tracking-widest">Date</p>
              <p className="text-text-muted text-xs uppercase tracking-widest">Calls</p>
              <p className="text-text-muted text-xs uppercase tracking-widest">Tokens</p>
              <p className="text-text-muted text-xs uppercase tracking-widest text-right">Cost</p>
            </div>
            {Object.entries(byDay).map(([day, dayRows]) => {
              const dayCost = dayRows.reduce((s, r) => s + (r.cost_usd || 0), 0);
              const dayTokens = dayRows.reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0);
              return (
                <div key={day} className="px-6 py-3 border-b border-white/[0.04] last:border-0 grid grid-cols-4 gap-4 hover:bg-bg-surface transition">
                  <p className="text-xs text-text-secondary">{new Date(dayRows[0].created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}</p>
                  <p className="text-xs text-text-secondary">{dayRows.length}</p>
                  <p className="text-xs text-text-secondary">{dayTokens.toLocaleString()}</p>
                  <p className="text-xs text-text-secondary text-right">${dayCost.toFixed(4)}</p>
                </div>
              );
            })}
          </div>

          {/* Daily Log */}
          <div className="bg-bg-elevated border border-bg-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-bg-border">
              <p className="text-text-muted text-xs uppercase tracking-widest">Usage Log</p>
            </div>
            {Object.keys(byDay).length === 0 ? (
              <p className="text-text-muted text-sm p-6">No usage this period.</p>
            ) : (
              <div>
                {Object.entries(byDay).map(([day, dayRows]) => {
                  const dayCost = dayRows.reduce((s, r) => s + (r.cost_usd || 0), 0);
                  return (
                    <div key={day}>
                      {/* Day header */}
                      <div className="px-6 py-3 bg-bg-surface border-b border-white/[0.04] flex items-center justify-between">
                        <p className="text-xs font-semibold text-text-secondary">{day}</p>
                        <p className="text-xs text-text-muted">${dayCost.toFixed(4)} · {dayRows.length} calls</p>
                      </div>
                      {/* Rows for this day */}
                      {dayRows.map((row, i) => {
                        const time = new Date(row.created_at).toLocaleTimeString("en-US", {
                          hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York"
                        });
                        const tokens = (row.input_tokens || 0) + (row.output_tokens || 0);
                        const feature = FEATURE_LABELS[row.feature] || row.feature;
                        return (
                          <div key={i} className="px-6 py-3 border-b border-white/[0.03] last:border-0 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-text-muted w-16 flex-shrink-0">{time}</span>
                              <span className="text-xs text-text-secondary">{feature}</span>
                              <span className="text-[10px] text-text-muted">{tokens.toLocaleString()} tokens</span>
                            </div>
                            <span className="text-xs text-text-secondary">{((row.cost_usd || 0) * 100).toFixed(3)}¢</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
