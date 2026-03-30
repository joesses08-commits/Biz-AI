"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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
    cost: parseFloat((val.cost * 100).toFixed(4)),
    calls: val.calls,
  })).sort((a, b) => b.cost - a.cost) : [];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Settings</p>
        <h1 className="text-3xl font-bold text-white tracking-tight">Usage & Costs</h1>
        <p className="text-white/30 text-sm mt-1">Last 30 days of AI usage across all features</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1,2,3].map(i => <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 h-24 animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Total Cost</p>
              <p className="text-3xl font-bold text-white">${((usage?.totalCost || 0)).toFixed(4)}</p>
              <p className="text-white/30 text-xs mt-1">last 30 days</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">AI Calls</p>
              <p className="text-3xl font-bold text-white">{usage?.totalCalls || 0}</p>
              <p className="text-white/30 text-xs mt-1">last 30 days</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Avg Per Call</p>
              <p className="text-3xl font-bold text-white">
                {usage?.totalCalls ? ((usage.totalCost / usage.totalCalls) * 100).toFixed(3) : "0.000"}¢
              </p>
              <p className="text-white/30 text-xs mt-1">cents per call</p>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6">
              <p className="text-xs font-semibold text-white/40 mb-5">Cost by Feature (cents)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#ffffff40" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#ffffff40" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                    labelStyle={{ color: "#fff", fontSize: 12 }}
                    itemStyle={{ color: "#ffffff80", fontSize: 11 }}
                    formatter={(val: any) => [`${val}¢`, "Cost"]}
                  />
                  <Bar dataKey="cost" fill="rgba(255,255,255,0.15)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <p className="text-xs font-semibold text-white/40">Breakdown by Feature</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {chartData.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-white/20 text-sm">No usage data yet. Start using Jimmy AI to see costs here.</p>
                </div>
              ) : chartData.map(item => (
                <div key={item.name} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{item.name}</p>
                    <p className="text-xs text-white/30">{item.calls} calls</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{item.cost.toFixed(3)}¢</p>
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
