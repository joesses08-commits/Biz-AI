"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface UsageSummary {
  totalCost: number;
  totalCalls: number;
  byFeature: Record<string, { calls: number; cost: number }>;
}

const FEATURE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  chat: "AI Chat",
  event_processor: "Event Processing",
  snapshot: "Brain Snapshot",
  briefing: "Daily Briefing",
  actions: "Action Items",
  meetings: "Meetings",
};

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/usage")
      .then(r => r.json())
      .then(d => { setUsage(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const chartData = usage ? Object.entries(usage.byFeature).map(([key, val]) => ({
    name: FEATURE_LABELS[key] || key,
    cost: parseFloat((val.cost * 100).toFixed(3)),
    calls: val.calls,
  })).sort((a, b) => b.cost - a.cost) : [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3 text-xs">
          <p className="text-white font-semibold mb-1">{label}</p>
          <p className="text-white/60">{payload[0].value.toFixed(3)}¢</p>
          <p className="text-white/40">{payload[0].payload.calls} calls</p>
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
        <p className="text-white/30 text-sm mt-1">Last 30 days of AI usage across all features</p>
      </div>

      {loading ? (
        <div className="text-white/30 text-sm">Loading...</div>
      ) : !usage ? (
        <div className="text-white/30 text-sm">No usage data yet.</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Total Cost</p>
              <p className="text-3xl font-bold text-white">${usage.totalCost.toFixed(4)}</p>
              <p className="text-white/30 text-xs mt-1">last 30 days</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">AI Calls</p>
              <p className="text-3xl font-bold text-white">{usage.totalCalls}</p>
              <p className="text-white/30 text-xs mt-1">last 30 days</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Avg Per Call</p>
              <p className="text-3xl font-bold text-white">
                {usage.totalCalls > 0 ? ((usage.totalCost / usage.totalCalls) * 100).toFixed(3) : "0"}¢
              </p>
              <p className="text-white/30 text-xs mt-1">cents per call</p>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-6">Cost by Feature (cents)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill="rgba(255,255,255,0.15)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Breakdown */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-4">Breakdown by Feature</p>
            <div className="space-y-0">
              {chartData.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="text-sm text-white/80 font-medium">{item.name}</p>
                    <p className="text-xs text-white/30 mt-0.5">{item.calls} {item.calls === 1 ? "call" : "calls"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{item.cost.toFixed(3)}¢</p>
                    <p className="text-xs text-white/30">${(item.cost / 100).toFixed(5)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
