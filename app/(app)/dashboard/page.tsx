"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, Activity, Users, CreditCard, Mail, Zap, RefreshCw, MessageSquare, ArrowUpRight } from "lucide-react";
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

function StatCard({ label, value, sub, icon: Icon, trend, loading }: {
  label: string; value: string; sub?: string; icon: React.ElementType; trend?: "up" | "down" | "neutral"; loading?: boolean;
}) {
  return (
    <div className="bg-bg-surface border border-bg-border rounded-2xl p-5 hover:border-white/10 transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">{label}</span>
        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
          <Icon size={14} className="text-text-muted" />
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-28 bg-white/5 rounded-lg animate-pulse mb-1" />
      ) : (
        <div className="text-2xl font-bold text-text-primary tracking-tight mb-1" style={{ fontFamily: "var(--font-display)" }}>
          {value}
        </div>
      )}
      {sub && !loading && <div className="text-[11px] text-text-muted">{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-elevated border border-bg-border rounded-xl px-3 py-2.5 shadow-2xl">
      <p className="text-[10px] text-text-muted mb-1">{label}</p>
      <p className="text-sm font-bold text-text-primary">${payload[0].value.toLocaleString()}</p>
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
    } catch {}
    finally { setLoading(false); }
  };

  const loadInsight = async () => {
    setLoadingInsight(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "Give me a 2-sentence morning briefing on the most important thing in my business right now." }] }),
      });
      const json = await res.json();
      setAiInsight(json.message || json.response || "");
    } catch {}
    finally { setLoadingInsight(false); }
  };

  useEffect(() => {
    loadDashboard();
    loadInsight();
  }, []);

  const stripe = data?.stripe;
  const gmail = data?.gmail;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-text-muted text-sm mb-1">{greeting}</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Command Center
          </h1>
          <p className="text-text-muted text-sm mt-1">
            {data?.connectedPlatforms?.length ? `Live from ${data.connectedPlatforms.join(", ")}` : "Connect your tools to see live data"}
            {lastUpdated && <span className="ml-2 opacity-50">· {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          </p>
        </div>
        <button onClick={loadDashboard} className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition px-4 py-2.5 rounded-xl border border-bg-border hover:border-white/20 bg-bg-surface">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* AI Briefing */}
      <div className="bg-gradient-to-r from-accent/10 to-purple-500/5 border border-accent/20 rounded-2xl p-5 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
            <Zap size={15} className="text-accent" fill="currentColor" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-accent uppercase tracking-widest mb-2">AI COO Briefing</p>
            {loadingInsight ? (
              <div className="space-y-2">
                <div className="h-3 bg-white/5 rounded animate-pulse w-full" />
                <div className="h-3 bg-white/5 rounded animate-pulse w-3/4" />
              </div>
            ) : (
              <p className="text-sm text-text-secondary leading-relaxed">{aiInsight || "Loading your briefing..."}</p>
            )}
          </div>
          <a href="/chat" className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-white bg-accent/10 hover:bg-accent/20 border border-accent/20 px-3 py-2 rounded-xl transition flex-shrink-0">
            Ask AI <ArrowUpRight size={11} />
          </a>
        </div>
      </div>

      {/* Stripe KPIs */}
      {stripe !== null && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#635BFF" d="M13.976 9.15c-2.172-.806-3.361-1.426-3.361-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Stripe — Revenue</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <StatCard label="Total Revenue" icon={DollarSign} value={`$${(stripe?.totalRevenue || 0).toLocaleString()}`} sub="Last 20 charges" loading={loading} />
            <StatCard label="MRR" icon={TrendingUp} value={`$${(stripe?.mrr || 0).toLocaleString()}`} sub="Monthly recurring" loading={loading} />
            <StatCard label="Subscriptions" icon={Activity} value={`${stripe?.activeSubscriptions || 0}`} sub="Active" loading={loading} />
            <StatCard label="Customers" icon={Users} value={`${stripe?.totalCustomers || 0}`} sub="In Stripe" loading={loading} />
            <StatCard label="Balance" icon={CreditCard} value={`$${(stripe?.availableBalance || 0).toLocaleString()}`} sub="Available" loading={loading} />
          </div>

          {/* Chart + Transactions side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {stripe?.monthlyRevenue && stripe.monthlyRevenue.length > 0 && (
              <div className="bg-bg-surface border border-bg-border rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-text-primary mb-5">Revenue Trend</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={stripe.monthlyRevenue} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" stroke="#4f6ef7" fill="url(#revGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-bg-surface border border-bg-border rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-text-primary mb-4">Recent Transactions</h2>
              {loading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-8 bg-white/3 rounded-lg animate-pulse" />)}</div>
              ) : stripe?.recentCharges?.length ? (
                <div className="space-y-1">
                  {stripe.recentCharges.slice(0, 6).map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-bg-border last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", c.status === "paid" ? "bg-emerald-400" : "bg-red-400")} />
                        <span className="text-xs text-text-secondary truncate max-w-[140px]">{c.description || "Payment"}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[10px] text-text-muted">{c.date}</span>
                        <span className={cn("text-xs font-semibold", c.status === "paid" ? "text-emerald-400" : "text-red-400")}>
                          ${c.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CreditCard size={24} className="text-text-muted mb-3 opacity-40" />
                  <p className="text-sm text-text-muted">No transactions yet</p>
                  <p className="text-xs text-text-muted opacity-60 mt-1">Your first payment will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gmail Section */}
      {gmail?.connected && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Gmail — {gmail.email}</span>
            {gmail.unreadCount > 0 && (
              <span className="text-[10px] bg-accent/15 text-accent px-2 py-0.5 rounded-full font-semibold">{gmail.unreadCount} unread</span>
            )}
          </div>
          <div className="bg-bg-surface border border-bg-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary">Recent Emails</h2>
              <a href="/gmail" className="text-[11px] text-accent hover:text-white transition flex items-center gap-1">
                View all <ArrowUpRight size={10} />
              </a>
            </div>
            <div className="space-y-1">
              {gmail.recentEmails?.slice(0, 6).map((email, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-bg-border last:border-0">
                  <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", email.unread ? "bg-accent" : "bg-transparent")} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs truncate", email.unread ? "text-text-primary font-semibold" : "text-text-secondary")}>{email.subject}</p>
                    <p className="text-[10px] text-text-muted truncate">{email.from}</p>
                  </div>
                  <span className="text-[10px] text-text-muted flex-shrink-0">{email.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Connect More */}
      {(!data?.connectedPlatforms?.length || data.connectedPlatforms.length < 3) && (
        <div className="border border-dashed border-bg-border rounded-2xl p-8 text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Zap size={18} className="text-text-muted" />
          </div>
          <p className="text-sm font-semibold text-text-primary mb-1">Connect more platforms</p>
          <p className="text-xs text-text-muted mb-4 max-w-sm mx-auto">The more you connect, the smarter your AI COO gets.</p>
          <a href="/integrations" className="btn-primary">Browse Integrations →</a>
        </div>
      )}

      {/* Ask AI CTA */}
      <div className="bg-bg-surface border border-bg-border rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
            <MessageSquare size={15} className="text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Ask anything about your business</p>
            <p className="text-xs text-text-muted mt-0.5">Your AI COO has full context from all connected platforms</p>
          </div>
        </div>
        <a href="/chat" className="btn-primary flex-shrink-0">Open AI Analyst →</a>
      </div>
    </div>
  );
}
