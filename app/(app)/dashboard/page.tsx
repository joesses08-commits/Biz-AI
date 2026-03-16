"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { RefreshCw, ArrowUpRight, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";

type Metric = {
  id: string;
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  category?: string;
};

type TopItem = {
  type: string;
  label: string;
  value: string;
  status?: "good" | "warning" | "urgent" | "neutral";
};

type DashboardAI = {
  business_type?: string;
  briefing?: string;
  alerts?: string[];
  metrics?: Metric[];
  top_items?: TopItem[];
  chart_data?: { label: string; value: number }[];
  chart_label?: string;
  error?: string;
};

function TrendIcon({ trend }: { trend?: string }) {
  if (trend === "up") return <TrendingUp size={11} className="text-emerald-400" />;
  if (trend === "down") return <TrendingDown size={11} className="text-red-400" />;
  return <Minus size={11} className="text-white/20" />;
}

function MetricCard({ metric }: { metric: Metric }) {
  const trendColor = metric.trend === "up" ? "text-emerald-400" : metric.trend === "down" ? "text-red-400" : "text-white/30";
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:border-white/10 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">{metric.label}</span>
        <TrendIcon trend={metric.trend} />
      </div>
      <div className="text-2xl font-bold text-white tracking-tight mb-1">{metric.value}</div>
      {metric.sub && <div className={`text-[11px] ${trendColor}`}>{metric.sub}</div>}
    </div>
  );
}

function StatusDot({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    good: "bg-emerald-400",
    warning: "bg-amber-400",
    urgent: "bg-red-400",
    neutral: "bg-white/20",
  };
  return <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors[status || "neutral"]}`} />;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-white/10 rounded-xl px-3 py-2 shadow-2xl">
      <p className="text-[10px] text-white/40 mb-1">{label}</p>
      <p className="text-sm font-bold text-white">{payload[0].value?.toLocaleString()}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardAI | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/ai-metrics");
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const revenueMetrics = data?.metrics?.filter(m => m.category === "revenue") || [];
  const opsMetrics = data?.metrics?.filter(m => m.category === "operations") || [];
  const customerMetrics = data?.metrics?.filter(m => m.category === "customers") || [];
  const cashMetrics = data?.metrics?.filter(m => m.category === "cash") || [];
  const activityMetrics = data?.metrics?.filter(m => m.category === "activity") || [];
  const otherMetrics = data?.metrics?.filter(m => !m.category || !["revenue","operations","customers","cash","activity"].includes(m.category)) || [];
  const allGrouped = [
    { label: "Revenue", items: revenueMetrics },
    { label: "Operations", items: opsMetrics },
    { label: "Customers", items: customerMetrics },
    { label: "Cash", items: cashMetrics },
    { label: "Activity", items: activityMetrics },
    { label: "Other", items: otherMetrics },
  ].filter(g => g.items.length > 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-white/30 text-sm mb-1">{greeting}</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Command Center</h1>
          {data?.business_type && (
            <p className="text-white/30 text-xs mt-1">{data.business_type}</p>
          )}
          {lastUpdated && (
            <p className="text-white/20 text-xs mt-0.5">Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          )}
        </div>
        <button onClick={load} className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition px-4 py-2.5 rounded-xl border border-white/[0.06] hover:border-white/20 bg-white/[0.02]">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* AI Briefing */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">AI COO Briefing</p>
            {loading ? (
              <div className="space-y-2">
                <div className="h-3 bg-white/5 rounded-lg animate-pulse w-full" />
                <div className="h-3 bg-white/5 rounded-lg animate-pulse w-2/3" />
              </div>
            ) : (
              <p className="text-sm text-white/70 leading-relaxed">{data?.briefing || "Loading your briefing..."}</p>
            )}
          </div>
          <Link href="/chat" className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-2 rounded-xl transition flex-shrink-0">
            Ask AI <ArrowUpRight size={11} />
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {data.alerts.map((alert, i) => (
            <div key={i} className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
              <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/80">{alert}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : data?.metrics?.length ? (
        <>
          {allGrouped.map(group => (
            <div key={group.label} className="mb-6">
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-3">{group.label}</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {group.items.map(metric => (
                  <MetricCard key={metric.id} metric={metric} />
                ))}
              </div>
            </div>
          ))}
        </>
      ) : !loading && (
        <div className="border border-dashed border-white/10 rounded-2xl p-10 text-center mb-6">
          <p className="text-white/30 text-sm mb-2">No data yet</p>
          <p className="text-white/20 text-xs mb-4">Connect your business tools to see live metrics.</p>
          <Link href="/integrations" className="text-xs text-white bg-white/10 hover:bg-white/15 px-4 py-2 rounded-xl transition">
            Connect Integrations →
          </Link>
        </div>
      )}

      {/* Chart + Top Items */}
      {(data?.chart_data?.length || data?.top_items?.length) ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

          {data?.chart_data && data.chart_data.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs font-semibold text-white/50 mb-5">{data.chart_label || "Trend"}</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data.chart_data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#ffffff30" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#ffffff30" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="value" stroke="#ffffff40" fill="url(#grad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {data?.top_items && data.top_items.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs font-semibold text-white/50 mb-4">Top Items</p>
              <div className="space-y-1">
                {data.top_items.slice(0, 8).map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                    <StatusDot status={item.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/70 truncate">{item.label}</p>
                      <p className="text-[10px] text-white/30 capitalize">{item.type}</p>
                    </div>
                    <span className="text-xs font-semibold text-white/60 flex-shrink-0">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      ) : null}

      {/* Ask AI CTA */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white/70">Ask anything about your business</p>
          <p className="text-xs text-white/30 mt-0.5">Your AI COO has full context from all connected platforms</p>
        </div>
        <Link href="/chat" className="text-xs font-semibold text-black bg-white hover:bg-white/90 px-4 py-2.5 rounded-xl transition flex-shrink-0">
          Open AI Analyst →
        </Link>
      </div>

    </div>
  );
}
