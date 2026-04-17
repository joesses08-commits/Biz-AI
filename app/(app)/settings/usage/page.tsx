"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface UsageSummary {
  totalCost: number;
  totalCalls: number;
  byFeature: Record<string, { calls: number; cost: number }>;
  byDay: { date: string; cost: number }[];
  monthCost: number;
  monthCalls: number;
  monthByFeature: Record<string, { calls: number; cost: number }>;
}

const FEATURE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  chat: "PLM Agent",
  event_processor: "Event Processing",
  snapshot: "Data Sync",
  briefing: "Email Notifications",
  actions: "Action Items",
  meetings: "Meetings",
  "brain-backfill": "Initial Setup",
  "factory-quote-extraction": "Quote Extraction",
  "factory-quote-recommendation": "Quote Comparison",
  "factory-quote-rfq": "RFQ Generation",
  "document-drop": "Document Processing",
  "excel-import": "Excel Import",
  "sample-request": "Sample Requests",
  "po-generation": "PO Generation",
};

const now = new Date();
const MONTH_NAME = now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" });

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"month" | "30days">("month");

  useEffect(() => {
    fetch("/api/usage")
      .then(r => r.json())
      .then(d => { setUsage(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const featureRows30 = usage
    ? Object.entries(usage.byFeature)
        .map(([key, val]) => ({ name: FEATURE_LABELS[key] || key, ...val }))
        .sort((a, b) => b.cost - a.cost)
    : [];

  const featureRowsMonth = usage
    ? Object.entries(usage.monthByFeature || {})
        .map(([key, val]) => ({ name: FEATURE_LABELS[key] || key, ...val }))
        .sort((a, b) => b.cost - a.cost)
    : [];

  const activeCost = activeTab === "month" ? (usage?.monthCost || 0) : (usage?.totalCost || 0);
  const activeCalls = activeTab === "month" ? (usage?.monthCalls || 0) : (usage?.totalCalls || 0);
  const activeFeatures = activeTab === "month" ? featureRowsMonth : featureRows30;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-xs shadow-xl">
          <p className="text-white/50 mb-1">{label}</p>
          <p className="text-white font-semibold">{(payload[0].value * 100).toFixed(3)}¢</p>
          <p className="text-white/30">${payload[0].value.toFixed(5)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Settings</p>
        <h1 className="text-3xl font-bold text-white tracking-tight">Usage & Costs</h1>
        <p className="text-white/30 text-sm mt-1">AI usage across quote extraction, PLM agent, and document processing</p>
      </div>

      {loading ? (
        <div className="text-white/30 text-sm">Loading...</div>
      ) : !usage ? (
        <div className="text-white/30 text-sm">No usage data yet.</div>
      ) : (
        <>
          {/* Tab Toggle */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit mb-6">
            <button onClick={() => setActiveTab("month")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${activeTab === "month" ? "bg-white text-black" : "text-white/40 hover:text-white/60"}`}>
              {MONTH_NAME}
            </button>
            <button onClick={() => setActiveTab("30days")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${activeTab === "30days" ? "bg-white text-black" : "text-white/40 hover:text-white/60"}`}>
              Last 30 Days
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Total Cost</p>
              <p className="text-3xl font-bold text-white">${activeCost.toFixed(4)}</p>
              <p className="text-white/30 text-xs mt-1">{activeTab === "month" ? MONTH_NAME : "last 30 days"}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">AI Calls</p>
              <p className="text-3xl font-bold text-white">{activeCalls}</p>
              <p className="text-white/30 text-xs mt-1">{activeTab === "month" ? MONTH_NAME : "last 30 days"}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Avg Per Call</p>
              <p className="text-3xl font-bold text-white">
                {activeCalls > 0 ? ((activeCost / activeCalls) * 100).toFixed(3) : "0"}¢
              </p>
              <p className="text-white/30 text-xs mt-1">cents per call</p>
            </div>
          </div>

          {/* Chart — always shows last 30 days */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-1">Daily AI Cost</p>
            <p className="text-white/20 text-xs mb-6">Cost in USD per day over the last 30 days</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={usage.byDay} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgba(255,255,255,0.15)" stopOpacity={1} />
                    <stop offset="95%" stopColor="rgba(255,255,255,0)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? "0" : `$${v.toFixed(2)}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="cost" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} fill="url(#costGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Feature Breakdown */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-4">Breakdown by Feature</p>
            {activeFeatures.length === 0 ? (
              <p className="text-white/20 text-sm">No usage data for this period.</p>
            ) : (
              <div>
                {activeFeatures.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-0">
                    <div>
                      <p className="text-sm text-white/80 font-medium">{item.name}</p>
                      <p className="text-xs text-white/30 mt-0.5">{item.calls} {item.calls === 1 ? "call" : "calls"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{(item.cost * 100).toFixed(3)}¢</p>
                      <p className="text-xs text-white/30">${item.cost.toFixed(5)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
