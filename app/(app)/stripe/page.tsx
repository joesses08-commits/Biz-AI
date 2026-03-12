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
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load Stripe data"); setLoading(false); });
  }, []);

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-[#080b12] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" className="h-6 brightness-200" alt="Stripe" />
            </div>
            <p className="text-white/40 text-sm">Live revenue data from your Stripe account</p>
          </div>
          <button onClick={() => window.location.reload()} className="bg-white/5 border border-white/10 text-white/60 hover:text-white px-4 py-2 rounded-xl text-sm transition">
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-white/40 text-sm">Loading Stripe data...</div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-400 text-sm">{error}</div>
        ) : data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Revenue", value: fmt(data.totalRevenue), sub: "Last 20 charges" },
                { label: "MRR", value: fmt(data.mrr), sub: "Monthly recurring" },
                { label: "Active Subscriptions", value: data.activeSubscriptions.toString(), sub: "Current subscribers" },
                { label: "Total Customers", value: data.totalCustomers.toString(), sub: "In Stripe" },
              ].map((m) => (
                <div key={m.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest mb-2">{m.label}</div>
                  <div className="text-2xl font-bold font-mono mb-1">{m.value}</div>
                  <div className="text-[10px] text-white/30">{m.sub}</div>
                </div>
              ))}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h2 className="text-sm font-semibold text-white/70">Recent Transactions</h2>
              </div>
              <div className="divide-y divide-white/5">
                {data.recentTransactions.length === 0 ? (
                  <div className="px-6 py-8 text-center text-white/30 text-sm">No transactions yet</div>
                ) : data.recentTransactions.map((t) => (
                  <div key={t.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white mb-1">{t.description}</div>
                      <div className="text-[10px] text-white/30">{new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-mono font-semibold ${t.paid ? "text-green-400" : "text-red-400"}`}>
                        {t.paid ? "+" : "-"}{fmt(t.amount)}
                      </div>
                      <div className={`text-[10px] ${t.status === "succeeded" ? "text-green-400/60" : "text-red-400/60"}`}>{t.status}</div>
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
