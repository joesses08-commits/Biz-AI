"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Activity, Users } from "lucide-react";
import { BusinessMetrics } from "@/types";
import { formatCurrency, formatPct, cn } from "@/lib/utils";

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({
  label, value, change, icon: Icon, prefix = "", suffix = "", loading
}: {
  label: string;
  value: number;
  change?: number | null;
  icon: React.ElementType;
  prefix?: string;
  suffix?: string;
  loading?: boolean;
}) {
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className="card hover:border-bg-hover transition-colors">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Icon size={14} className="text-accent" />
        </div>
      </div>
      {loading ? (
        <div className="skeleton h-8 w-32 mb-2" />
      ) : (
        <div className="text-2xl font-bold text-text-primary mb-1" style={{ fontFamily: "var(--font-display)" }}>
          {prefix}{typeof value === "number" ? (
            suffix === "%" ? value.toFixed(1) : formatCurrency(value, true).replace("$", "")
          ) : value}{suffix}
          {!suffix && prefix === "$" && ""}
        </div>
      )}
      {change !== undefined && change !== null && !loading && (
        <div className={cn("flex items-center gap-1 text-xs font-medium", isPositive ? "text-emerald-400" : "text-red-400")}>
          {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {formatPct(change)} vs last month
        </div>
      )}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value, true)}
        </p>
      ))}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/metrics")
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setMetrics(data);
      })
      .catch(() => setError("Failed to load metrics"))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="p-8">
        <div className="card border-red-500/20 bg-red-500/5 text-center py-12">
          <p className="text-red-400 text-sm">{error}</p>
          <a href="/upload" className="btn-primary mt-4 inline-flex">Upload Data →</a>
        </div>
      </div>
    );
  }

  const COLORS = ["#4f6ef7", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="p-8 animate-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
          Dashboard
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Business performance overview · {metrics?.monthlyTrend?.length || 0} months of data
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Total Revenue" icon={DollarSign}
          value={metrics?.totalRevenue || 0}
          change={metrics?.momRevenueChange}
          prefix="$" loading={loading}
        />
        <MetricCard
          label="Total Costs" icon={BarChart2}
          value={metrics?.totalCosts || 0}
          prefix="$" loading={loading}
        />
        <MetricCard
          label="Gross Profit" icon={TrendingUp}
          value={metrics?.grossProfit || 0}
          prefix="$" loading={loading}
        />
        <MetricCard
          label="Gross Margin" icon={Activity}
          value={metrics?.grossMarginPct || 0}
          change={metrics?.momMarginChange}
          suffix="%" loading={loading}
        />
      </div>

      {/* Revenue vs Costs Chart */}
      <div className="card mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Revenue vs Costs — Monthly Trend</h2>
        {loading ? (
          <div className="skeleton h-48 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={metrics?.monthlyTrend} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2035" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#4f6ef7" fill="url(#revGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="costs" name="Costs" stroke="#ef4444" fill="url(#costGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top Products */}
        <div className="card lg:col-span-1">
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <BarChart2 size={14} className="text-accent" /> Top Products
          </h2>
          {loading ? <div className="skeleton h-32 w-full" /> : (
            <div className="space-y-3">
              {metrics?.topProducts.map((p, i) => (
                <div key={p.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-secondary truncate">{p.name}</span>
                    <span className="text-text-primary font-semibold ml-2">{formatCurrency(p.revenue, true)}</span>
                  </div>
                  <div className="h-1 bg-bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(p.revenue / (metrics.topProducts[0]?.revenue || 1)) * 100}%`,
                        background: COLORS[i % COLORS.length]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Customers */}
        <div className="card lg:col-span-1">
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Users size={14} className="text-accent" /> Top Customers
          </h2>
          {loading ? <div className="skeleton h-32 w-full" /> : (
            <div className="space-y-3">
              {metrics?.topCustomers.map((c, i) => (
                <div key={c.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-secondary truncate">{c.name}</span>
                    <span className="text-text-primary font-semibold ml-2">{formatCurrency(c.revenue, true)}</span>
                  </div>
                  <div className="h-1 bg-bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(c.revenue / (metrics.topCustomers[0]?.revenue || 1)) * 100}%`,
                        background: COLORS[i % COLORS.length]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost Breakdown */}
        <div className="card lg:col-span-1">
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <DollarSign size={14} className="text-accent" /> Cost Breakdown
          </h2>
          {loading ? <div className="skeleton h-32 w-full" /> : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={metrics?.costBreakdown.slice(0, 5)} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 9, fill: "#8892b0" }} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" name="Amount" radius={[0, 3, 3, 0]}>
                  {metrics?.costBreakdown.slice(0, 5).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* CTA to chat */}
      <div className="mt-6 card border-accent/20 bg-accent/5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">Ready to dig deeper?</p>
          <p className="text-xs text-text-muted mt-0.5">Ask the AI analyst why these numbers look the way they do.</p>
        </div>
        <a href="/chat" className="btn-primary flex-shrink-0">Ask AI Analyst →</a>
      </div>
    </div>
  );
}
