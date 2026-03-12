"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Activity,
  Users, CreditCard, Mail, Zap, RefreshCw, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardData = {
  stripe: {
    totalRevenue: number;
    mrr: number;
    activeSubscriptions: number;
    totalCustomers: number;
    availableBalance: number;
    recentCharges: { amount: number; date: string; description: string; status: string }[];
    monthlyRevenue: { month: string; revenue: number }[];
  } | null;
  gmail: {
    connected: boolean;
    email: string;
    unreadCount: number;
    recentEmails: { from: string; subject: string; date: string; unread: boolean }[];
  } | null;
  connectedPlatforms: string[];
};

function MetricCard({
  label, value, sub, icon: Icon, color = "accent", loading
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color?: string;
  loading?: boolean;
}) {
  const colorMap: Record<string, string> = {
    accent: "bg-accent/10 text-accent",
    green: "bg-emerald-500/10 text-emerald-400",
    yellow: "bg-yellow-500/10 text-yellow-400",
    purple: "bg-purple-500/10 text-purple-400",
  };
  return (
    <div className="card hover:border-bg-hover transition-colors">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colorMap[color])}>
          <Icon size={14} />
        </div>
      </div>
      {loading ? (
        <div className="skeleton h-8 w-32 mb-2" />
      ) : (
        <div className="text-2xl font-bold text-text-primary mb-1" style={{ fontFamily: "var(--font-display)" }}>
          {value}
        </div>
      )}
      {sub && !loading && <div className="text-xs text-text-muted">{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          ${p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState("");
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const getAiInsight = async () => {
    setLoadingInsight(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Give me a 3-sentence executive summary of my business right now. Be direct and specific about what the numbers mean and what I should focus on today." }]
        })
      });
      const json = await res.json();
      setAiInsight(json.response || "");
    } catch {
      setAiInsight("Unable to load AI insight right now.");
    } finally {
      setLoadingInsight(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    getAiInsight();
  }, []);

  const stripe = data?.stripe;
  const gmail = data?.gmail;

  return (
    <div className="p-8 animate-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
            Command Center
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Live data from {data?.connectedPlatforms?.join(", ") || "your connected platforms"}
            {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <button onClick={loadDashboard} className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition px-3 py-2 rounded-lg border border-bg-border hover:border-bg-hover">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* AI Morning Briefing */}
      <div className="card border-accent/20 bg-accent/5 mb-8">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap size={14} className="text-accent" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-accent mb-1 uppercase tracking-wider">AI COO Briefing</p>
            {loadingInsight ? (
              <div className="space-y-2">
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-4/5" />
                <div className="skeleton h-3 w-3/5" />
              </div>
            ) : (
              <p className="text-sm text-text-secondary leading-relaxed">{aiInsight}</p>
            )}
          </div>
          <a href="/chat" className="btn-primary flex-shrink-0 text-xs">
            Ask AI →
          </a>
        </div>
      </div>

      {/* Stripe KPIs */}
      {stripe !== null && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 rounded bg-white flex items-center justify-center">
              <span style={{ fontSize: 8, fontWeight: 900, color: "#635bff" }}>S</span>
            </div>
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Stripe — Revenue</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <MetricCard
              label="Total Revenue" icon={DollarSign}
              value={`$${(stripe?.totalRevenue || 0).toLocaleString()}`}
              sub="Last 20 charges" loading={loading}
            />
            <MetricCard
              label="MRR" icon={TrendingUp}
              value={`$${(stripe?.mrr || 0).toLocaleString()}`}
              sub="Monthly recurring" loading={loading} color="green"
            />
            <MetricCard
              label="Subscriptions" icon={Activity}
              value={`${stripe?.activeSubscriptions || 0}`}
              sub="Active" loading={loading} color="purple"
            />
            <MetricCard
              label="Customers" icon={Users}
              value={`${stripe?.totalCustomers || 0}`}
              sub="In Stripe" loading={loading} color="yellow"
            />
            <MetricCard
              label="Balance" icon={CreditCard}
              value={`$${(stripe?.availableBalance || 0).toLocaleString()}`}
              sub="Available" loading={loading}
            />
          </div>

          {/* Revenue Chart */}
          {stripe?.monthlyRevenue && stripe.monthlyRevenue.length > 0 && (
            <div className="card mb-8">
              <h2 className="text-sm font-semibold text-text-primary mb-4">Revenue Trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stripe.monthlyRevenue} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2035" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#4f6ef7" fill="url(#revGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent Transactions */}
          <div className="card mb-8">
            <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <CreditCard size={14} className="text-accent" /> Recent Transactions
            </h2>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="skeleton h-8 w-full" />)}
              </div>
            ) : stripe?.recentCharges?.length ? (
              <div className="space-y-2">
                {stripe.recentCharges.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-bg-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full", c.status === "paid" ? "bg-emerald-400" : "bg-red-400")} />
                      <span className="text-xs text-text-secondary">{c.description || "Payment"}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-text-muted">{c.date}</span>
                      <span className={cn("text-xs font-semibold", c.status === "paid" ? "text-emerald-400" : "text-red-400")}>
                        ${c.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-text-muted text-sm">No transactions yet</p>
                <p className="text-text-muted text-xs mt-1">Your first payment will appear here</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Gmail Section */}
      {gmail?.connected && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Mail size={14} className="text-text-muted" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Gmail — {gmail.email}</span>
            {gmail.unreadCount > 0 && (
              <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">{gmail.unreadCount} unread</span>
            )}
          </div>
          <div className="card mb-8">
            <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Mail size={14} className="text-accent" /> Recent Emails
            </h2>
            <div className="space-y-2">
              {gmail.recentEmails?.slice(0, 5).map((email, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-bg-border last:border-0">
                  {email.unread && <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                  {!email.unread && <div className="w-1.5 h-1.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs truncate", email.unread ? "text-text-primary font-semibold" : "text-text-secondary")}>{email.subject}</p>
                    <p className="text-[10px] text-text-muted truncate">{email.from}</p>
                  </div>
                  <span className="text-[10px] text-text-muted flex-shrink-0">{email.date}</span>
                </div>
              ))}
            </div>
            <a href="/gmail" className="block text-center text-xs text-accent hover:underline mt-3">View all emails →</a>
          </div>
        </>
      )}

      {/* Connect More */}
      {(!data?.connectedPlatforms?.length || data.connectedPlatforms.length < 3) && (
        <div className="card border-dashed border-bg-hover">
          <div className="text-center py-4">
            <p className="text-sm font-semibold text-text-primary mb-1">Connect more platforms</p>
            <p className="text-xs text-text-muted mb-4">The more you connect, the smarter your AI COO gets. Add QuickBooks, your bank, or Microsoft 365.</p>
            <a href="/integrations" className="btn-primary">Browse Integrations →</a>
          </div>
        </div>
      )}

      {/* Ask AI */}
      <div className="mt-6 card border-accent/20 bg-accent/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare size={16} className="text-accent" />
          <div>
            <p className="text-sm font-semibold text-text-primary">Ask anything about your business</p>
            <p className="text-xs text-text-muted mt-0.5">Your AI COO knows everything connected above</p>
          </div>
        </div>
        <a href="/chat" className="btn-primary flex-shrink-0">Open AI Analyst →</a>
      </div>
    </div>
  );
}
