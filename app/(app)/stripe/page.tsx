"use client";

import { useState, useEffect } from "react";

type Transaction = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  date: string;
  paid: boolean;
};

type StripeData = {
  totalRevenue: number;
  mrr: number;
  activeSubscriptions: number;
  totalCustomers: number;
  recentTransactions: Transaction[];
};

export default function StripePage() {
  const [data, setData] = useState<StripeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/stripe/data")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load Stripe data"); setLoading(false); });
  }, []);

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-bg-base text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#635BFF]/10 border border-[#635BFF]/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.91 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" fill="#635BFF"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Stripe</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-text-secondary text-xs">Live data</span>
              </div>
            </div>
          </div>
          <button onClick={() => window.location.reload()}
            className="text-text-secondary hover:text-white/80 text-xs px-3 py-1.5 rounded-lg border border-bg-border hover:border-white/20 transition">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-400 text-sm">{error}</div>
        ) : data && (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Total Revenue", value: fmt(data.totalRevenue), sub: "All time" },
                { label: "MRR", value: fmt(data.mrr), sub: "Monthly recurring" },
                { label: "Subscriptions", value: data.activeSubscriptions.toString(), sub: "Active" },
                { label: "Customers", value: data.totalCustomers.toString(), sub: "Total in Stripe" },
              ].map((m) => (
                <div key={m.label} className="bg-bg-elevated border border-bg-border rounded-2xl p-5">
                  <div className="text-[10px] text-text-muted uppercase tracking-widest mb-3">{m.label}</div>
                  <div className="text-2xl font-bold font-mono text-white mb-1">{m.value}</div>
                  <div className="text-[10px] text-white/25">{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Transactions */}
            <div className="bg-bg-elevated border border-bg-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-bg-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white/70">Transactions</h2>
                <span className="text-[10px] text-white/25">{data.recentTransactions.length} recent</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {data.recentTransactions.length === 0 ? (
                  <div className="px-6 py-10 text-center text-text-muted text-sm">No transactions yet</div>
                ) : data.recentTransactions.map((t) => (
                  <div key={t.id} className="px-6 py-4 flex items-center justify-between hover:bg-bg-surface transition">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.paid ? "bg-emerald-400" : "bg-red-400"}`} />
                      <div>
                        <div className="text-sm text-white/80">{t.description || "Payment"}</div>
                        <div className="text-[10px] text-white/25 mt-0.5">
                          {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-mono font-semibold ${t.paid ? "text-emerald-400" : "text-red-400"}`}>
                        {t.paid ? "+" : "-"}{fmt(t.amount)}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${t.status === "succeeded" ? "text-emerald-400/50" : "text-red-400/50"}`}>
                        {t.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
