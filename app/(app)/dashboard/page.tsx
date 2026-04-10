"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { RefreshCw, ArrowUpRight, TrendingUp, TrendingDown, Minus, Shield, Zap, Settings, ExternalLink } from "lucide-react";
import Link from "next/link";

type Metric = {
  id: string;
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  category?: string;
};

type RiskItem = {
  title: string;
  detail: string;
  dollar_impact: string;
  action: string;
  urgency: "critical" | "high" | "medium";
  source?: string;
  source_detail?: string;
};

type OpportunityItem = {
  title: string;
  detail: string;
  dollar_impact: string;
  action: string;
  timeframe: string;
  source?: string;
  source_detail?: string;
};

type OperationItem = {
  title: string;
  detail: string;
  action: string;
  due: string;
  source?: string;
  source_detail?: string;
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
  risks?: RiskItem[];
  opportunities?: OpportunityItem[];
  operations?: OperationItem[];
  metrics?: Metric[];
  top_items?: TopItem[];
  chart_data?: { label: string; value: number }[];
  chart_label?: string;
  error?: string;
  message?: string;
  reason?: string;
};

const SOURCE_LINKS: Record<string, string> = {
  "Gmail": "/gmail",
  "Stripe": "/stripe",
  "QuickBooks": "/quickbooks",
  "Google Sheets": "/google/sheets",
  "Microsoft 365": "/microsoft",
  "Manual": "/settings",
};

const SOURCE_COLORS: Record<string, string> = {
  "Gmail": "text-red-400/70",
  "Stripe": "text-purple-400/70",
  "QuickBooks": "text-green-400/70",
  "Google Sheets": "text-emerald-400/70",
  "Microsoft 365": "text-blue-400/70",
};

function SourceTag({ source, source_detail }: { source?: string; source_detail?: string }) {
  if (!source) return null;
  const href = SOURCE_LINKS[source] || "#";
  const color = SOURCE_COLORS[source] || "text-white/25";
  return (
    <Link href={href} className={`flex items-center gap-1 mt-3 pt-3 border-t border-white/[0.05] group ${color} hover:opacity-100 transition`}>
      <span className="text-[10px] font-medium">{source}</span>
      {source_detail && <span className="text-[10px] text-white/20 truncate">· {source_detail}</span>}
      <ExternalLink size={9} className="flex-shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition" />
    </Link>
  );
}

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

function RiskCard({ item }: { item: RiskItem }) {
  const colors = {
    critical: { bg: "bg-red-500/5", border: "border-red-500/20", badge: "bg-red-500/10 text-red-400", dot: "bg-red-400" },
    high: { bg: "bg-amber-500/5", border: "border-amber-500/20", badge: "bg-amber-500/10 text-amber-400", dot: "bg-amber-400" },
    medium: { bg: "bg-white/[0.02]", border: "border-white/[0.06]", badge: "bg-white/5 text-white/40", dot: "bg-white/30" },
  };
  const c = colors[item.urgency] || colors.medium;
  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
          <p className="text-sm font-semibold text-white">{item.title}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${c.badge}`}>{item.urgency}</span>
      </div>
      <p className="text-xs text-white/50 leading-relaxed mb-3">{item.detail}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-red-400">{item.dollar_impact} at risk</span>
        <span className="text-[11px] text-white/30">{item.action}</span>
      </div>
      <SourceTag source={item.source} source_detail={item.source_detail} />
    </div>
  );
}

function OpportunityCard({ item }: { item: OpportunityItem }) {
  const timeColors: Record<string, string> = {
    today: "bg-emerald-500/10 text-emerald-400",
    "this week": "bg-blue-500/10 text-blue-400",
    "this month": "bg-purple-500/10 text-purple-400",
  };
  const badgeColor = timeColors[item.timeframe] || "bg-white/5 text-white/40";
  return (
    <div className="bg-emerald-500/[0.03] border border-emerald-500/10 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-400" />
          <p className="text-sm font-semibold text-white">{item.title}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeColor}`}>{item.timeframe}</span>
      </div>
      <p className="text-xs text-white/50 leading-relaxed mb-3">{item.detail}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-emerald-400">{item.dollar_impact}</span>
        <span className="text-[11px] text-white/30">{item.action}</span>
      </div>
      <SourceTag source={item.source} source_detail={item.source_detail} />
    </div>
  );
}

function OperationCard({ item }: { item: OperationItem }) {
  const dueColors: Record<string, string> = {
    today: "bg-red-500/10 text-red-400",
    "this week": "bg-amber-500/10 text-amber-400",
    "this month": "bg-blue-500/10 text-blue-400",
  };
  const badgeColor = dueColors[item.due] || "bg-white/5 text-white/40";
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-white">{item.title}</p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeColor}`}>{item.due}</span>
      </div>
      <p className="text-xs text-white/50 leading-relaxed mb-3">{item.detail}</p>
      <p className="text-[11px] text-white/40">→ {item.action}</p>
      <SourceTag source={item.source} source_detail={item.source_detail} />
    </div>
  );
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

function StatusDot({ status }: { status?: string }) {
  const colors: Record<string, string> = { good: "bg-emerald-400", warning: "bg-amber-400", urgent: "bg-red-400", neutral: "bg-white/20" };
  return <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors[status || "neutral"]}`} />;
}

let _cachedData: DashboardAI | null = null;
let _cachedAt: Date | null = null;

function loadFromStorage(): { data: DashboardAI | null; cachedAt: Date | null } {
  try {
    const raw = localStorage.getItem("jimmy_dashboard");
    if (!raw) return { data: null, cachedAt: null };
    const parsed = JSON.parse(raw);
    return { data: parsed.data, cachedAt: parsed.cachedAt ? new Date(parsed.cachedAt) : null };
  } catch { return { data: null, cachedAt: null }; }
}

function saveToStorage(data: DashboardAI, cachedAt: Date) {
  try { localStorage.setItem("jimmy_dashboard", JSON.stringify({ data, cachedAt: cachedAt.toISOString() })); } catch {}
}

export default function DashboardPage() {
  const stored = typeof window !== "undefined" ? loadFromStorage() : { data: null, cachedAt: null };
  const initialData = _cachedData || stored.data;
  const initialCachedAt = _cachedAt || stored.cachedAt;

  const [data, setData] = useState<DashboardAI | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [syncing, setSyncing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(() => {
    try { const s = localStorage.getItem("jimmy_last_refresh"); return s ? new Date(s) : null; } catch { return null; }
  });
  const [syncMessage, setSyncMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(initialCachedAt);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/ai-metrics");
      const json = await res.json();
      if (res.status === 402) {
        setData({ error: "quota_exceeded", message: json.message, reason: json.reason });
        setLoading(false);
        return;
      }
      _cachedData = json;
      _cachedAt = new Date();
      setData(json);
      setLastUpdated(_cachedAt);
      saveToStorage(json, _cachedAt);
    } catch {}
    finally { setLoading(false); }
  };

  const SYNC_STEPS = [
    { message: "Connecting to integrations...", icon: "⚡", pct: 8 },
    { message: "Reading Gmail & Outlook...", icon: "📧", pct: 18 },
    { message: "Pulling Stripe payments...", icon: "💳", pct: 28 },
    { message: "Syncing QuickBooks invoices...", icon: "📒", pct: 38 },
    { message: "Scanning Google Drive...", icon: "📁", pct: 48 },
    { message: "Processing new events...", icon: "⚙️", pct: 58 },
    { message: "Updating Company Brain...", icon: "🧠", pct: 68 },
    { message: "Analyzing business context...", icon: "🔍", pct: 78 },
    { message: "Writing your briefing...", icon: "✍️", pct: 88 },
    { message: "Finalizing dashboard...", icon: "✅", pct: 95 },
  ];
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStep, setSyncStep] = useState(0);

  const cooldownMinutes = 60;
  const minutesSinceRefresh = lastRefreshTime ? (Date.now() - lastRefreshTime.getTime()) / 60000 : 999;
  const onCooldown = minutesSinceRefresh < cooldownMinutes;
  const cooldownRemaining = Math.ceil(cooldownMinutes - minutesSinceRefresh);

  const refresh = async () => {
    if (onCooldown) return;
    const now = new Date();
    setLastRefreshTime(now);
    try { localStorage.setItem("jimmy_last_refresh", now.toISOString()); } catch {}
    setSyncing(true);
    setSyncProgress(0);
    setSyncStep(0);
    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      if (stepIndex < SYNC_STEPS.length - 1) {
        stepIndex++;
        setSyncStep(stepIndex);
        setSyncProgress(SYNC_STEPS[stepIndex].pct);
      }
    }, 1800);
    try {
      await fetch("/api/sync", { method: "POST" });
      await fetch("/api/cache", { method: "DELETE" });
      _cachedData = null;
      try { localStorage.removeItem("jimmy_dashboard"); } catch {}
      clearInterval(stepInterval);
      setSyncProgress(100);
      await load();
      setSyncProgress(0);
      setSyncStep(0);
    } catch {
      clearInterval(stepInterval);
      setSyncMessage("Refresh failed — try again");
      setSyncProgress(0);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    // Only auto-load if nothing in memory AND nothing in localStorage
    const stored = loadFromStorage();
    if (!_cachedData && !stored.data) load();
  }, []);

  const groupedMetrics = [
    { label: "Revenue", items: data?.metrics?.filter(m => m.category === "revenue") || [] },
    { label: "Cash", items: data?.metrics?.filter(m => m.category === "cash") || [] },
    { label: "Customers", items: data?.metrics?.filter(m => m.category === "customers") || [] },
    { label: "Operations", items: data?.metrics?.filter(m => m.category === "operations") || [] },
    { label: "Activity", items: data?.metrics?.filter(m => m.category === "activity") || [] },
    { label: "Other", items: data?.metrics?.filter(m => !["revenue","cash","customers","operations","activity"].includes(m.category || "")) || [] },
  ].filter(g => g.items.length > 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-white/30 text-sm mb-1">{greeting}</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Command Center</h1>
          {data?.business_type && <p className="text-white/25 text-xs mt-1">{data.business_type}</p>}
          {lastUpdated && <p className="text-white/15 text-xs mt-0.5">Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>}
          {syncMessage && <p className="text-emerald-400/70 text-xs mt-1">{syncMessage}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={syncing || loading || onCooldown}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition px-4 py-2.5 rounded-xl border border-white/[0.06] hover:border-white/20 bg-white/[0.02] disabled:opacity-40">
            <RefreshCw size={12} className={syncing || loading ? "animate-spin" : ""} />
            {syncing || loading ? syncMessage || "Refreshing..." : onCooldown ? `Refresh in ${cooldownRemaining}m` : "Refresh"}
          </button>
        </div>
      </div>

      {/* Sync Progress Bar */}
      {syncing && (
        <div className="mb-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <p className="text-xs text-white/50 font-medium">
              {SYNC_STEPS[syncStep]?.icon} {SYNC_STEPS[syncStep]?.message}
            </p>
            <p className="text-[10px] text-white/20 ml-auto">{syncProgress}%</p>
          </div>
          <div className="w-full bg-white/[0.05] rounded-full h-1">
            <div
              className="h-1 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-3 overflow-hidden">
            {SYNC_STEPS.map((step, i) => (
              <div key={i} className={`flex items-center gap-1 text-[10px] whitespace-nowrap transition-all ${i <= syncStep ? "text-white/40" : "text-white/15"}`}>
                <span>{step.icon}</span>
                <span className={i === syncStep ? "text-blue-400 font-medium" : ""}>{step.message.replace("...", "")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Briefing */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2">AI COO — Today's Briefing</p>
            {loading ? (
              <div className="space-y-2">
                <div className="h-3 bg-white/5 rounded-lg animate-pulse w-full" />
                <div className="h-3 bg-white/5 rounded-lg animate-pulse w-2/3" />
              </div>
            ) : data?.error === "quota_exceeded" ? (
              <div>
                <p className="text-sm text-red-400 font-semibold mb-1">You're out of AI tokens</p>
                <p className="text-xs text-white/40 mb-2">{data.message}</p>
                <a href="/quota" className="text-xs bg-white text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-white/90 transition">Buy More Tokens →</a>
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

      {/* Three Pillars */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={12} className="text-red-400" />
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Risk Protector</p>
              {data?.risks?.length ? <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full">{data.risks.length}</span> : null}
            </div>
            <div className="space-y-3">
              {data?.risks?.length ? data.risks.map((r, i) => <RiskCard key={i} item={r} />) : (
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 text-center">
                  <p className="text-white/20 text-xs">No risks detected</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={12} className="text-emerald-400" />
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Growth Engine</p>
              {data?.opportunities?.length ? <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full">{data.opportunities.length}</span> : null}
            </div>
            <div className="space-y-3">
              {data?.opportunities?.length ? data.opportunities.map((o, i) => <OpportunityCard key={i} item={o} />) : (
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 text-center">
                  <p className="text-white/20 text-xs">No opportunities detected</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Settings size={12} className="text-blue-400" />
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Operations</p>
              {data?.operations?.length ? <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full">{data.operations.length}</span> : null}
            </div>
            <div className="space-y-3">
              {data?.operations?.length ? data.operations.map((o, i) => <OperationCard key={i} item={o} />) : (
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 text-center">
                  <p className="text-white/20 text-xs">No actions needed</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 h-24 animate-pulse" />)}
        </div>
      ) : groupedMetrics.length > 0 && (
        <div className="mb-6">
          {groupedMetrics.map(group => (
            <div key={group.label} className="mb-5">
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-3">{group.label}</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {group.items.map(metric => <MetricCard key={metric.id} metric={metric} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart + Top Items */}
      {(data?.chart_data?.length || data?.top_items?.length) ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {data?.chart_data && data.chart_data.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs font-semibold text-white/40 mb-5">{data.chart_label || "Trend"}</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data.chart_data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.08} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#ffffff25" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#ffffff25" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="value" stroke="#ffffff30" fill="url(#grad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {data?.top_items && data.top_items.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs font-semibold text-white/40 mb-4">Key Items</p>
              <div className="space-y-1">
                {data.top_items.slice(0, 8).map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                    <StatusDot status={item.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/70 truncate">{item.label}</p>
                      <p className="text-[10px] text-white/25 capitalize">{item.type}</p>
                    </div>
                    <span className="text-xs font-semibold text-white/50 flex-shrink-0">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Ask AI */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white/70">Dig deeper with your AI COO</p>
          <p className="text-xs text-white/25 mt-0.5">Ask about any risk, opportunity, or operation in detail</p>
        </div>
        <Link href="/chat" className="text-xs font-semibold text-black bg-white hover:bg-white/90 px-4 py-2.5 rounded-xl transition flex-shrink-0">
          Open AI Analyst →
        </Link>
      </div>

    </div>
  );
}
