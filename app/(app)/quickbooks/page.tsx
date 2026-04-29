"use client";

import { useEffect, useState } from "react";

export default function QuickBooksPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/quickbooks/data")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || !data.connected) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#2CA01C]/10 border border-[#2CA01C]/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
              <circle cx="12" cy="12" r="11" fill="#2CA01C" fillOpacity="0.2" stroke="#2CA01C" strokeWidth="1.5"/>
              <path d="M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0zm4-2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="#2CA01C"/>
            </svg>
          </div>
          <h1 className="text-white text-2xl font-semibold mb-3">Connect QuickBooks</h1>
          <p className="text-text-secondary text-sm mb-8 leading-relaxed">Connect your QuickBooks account to see invoices, P&L, and cash flow.</p>
          <a href="/api/quickbooks/connect" className="inline-flex items-center gap-2 bg-white text-black font-medium py-2.5 px-6 rounded-xl text-sm hover:bg-white/90 transition">
            Connect QuickBooks
          </a>
        </div>
      </div>
    );
  }

  const invoices = data.invoices || [];
  const unpaidInvoices = invoices.filter((inv: any) => inv.Balance > 0);
  const paidInvoices = invoices.filter((inv: any) => inv.Balance === 0);
  const totalUnpaid = unpaidInvoices.reduce((sum: number, inv: any) => sum + inv.Balance, 0);
  const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + inv.TotalAmt, 0);

  const fmt = (n: number) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-bg-base text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-[#2CA01C]/10 border border-[#2CA01C]/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
              <circle cx="12" cy="12" r="11" fill="#2CA01C" fillOpacity="0.15" stroke="#2CA01C" strokeWidth="1.5"/>
              <path d="M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0zm4-2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="#2CA01C"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">QuickBooks</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-text-secondary text-xs">Connected</span>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total Invoiced", value: fmt(totalRevenue), sub: `${invoices.length} invoices` },
            { label: "Outstanding", value: fmt(totalUnpaid), sub: `${unpaidInvoices.length} unpaid`, accent: totalUnpaid > 0 },
            { label: "Collected", value: fmt(totalRevenue - totalUnpaid), sub: `${paidInvoices.length} paid` },
          ].map((m) => (
            <div key={m.label} className="bg-bg-elevated border border-bg-border rounded-2xl p-5">
              <div className="text-[10px] text-text-muted uppercase tracking-widest mb-3">{m.label}</div>
              <div className={`text-2xl font-bold font-mono mb-1 ${m.accent ? "text-amber-400" : "text-text-primary"}`}>{m.value}</div>
              <div className="text-[10px] text-white/25">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Outstanding invoices */}
        {unpaidInvoices.length > 0 && (
          <div className="bg-bg-elevated border border-amber-500/20 rounded-2xl overflow-hidden mb-4">
            <div className="px-6 py-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/70">Outstanding Invoices</h2>
              <span className="text-[10px] text-amber-400">{fmt(totalUnpaid)} due</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {unpaidInvoices.map((inv: any) => (
                <div key={inv.Id} className="px-6 py-4 flex items-center justify-between hover:bg-bg-surface transition">
                  <div>
                    <p className="text-sm text-white/80 font-medium">{inv.CustomerRef?.name || "Unknown Customer"}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">Invoice #{inv.DocNumber} · {inv.TxnDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-semibold text-amber-400">{fmt(inv.Balance)} due</p>
                    <p className="text-[10px] text-white/25 mt-0.5">Total {fmt(inv.TotalAmt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All invoices */}
        <div className="bg-bg-elevated border border-bg-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-bg-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70">All Invoices</h2>
            <span className="text-[10px] text-white/25">{invoices.length} total</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {invoices.length === 0 ? (
              <div className="px-6 py-10 text-center text-text-muted text-sm">No invoices found</div>
            ) : invoices.map((inv: any) => (
              <div key={inv.Id} className="px-6 py-4 flex items-center justify-between hover:bg-bg-surface transition">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${inv.Balance > 0 ? "bg-amber-400" : "bg-emerald-400"}`} />
                  <div>
                    <p className="text-sm text-white/80">{inv.CustomerRef?.name || "Unknown Customer"}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">#{inv.DocNumber} · {inv.TxnDate}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-semibold text-white/80">{fmt(inv.TotalAmt)}</p>
                  <p className={`text-[10px] mt-0.5 ${inv.Balance > 0 ? "text-amber-400/70" : "text-emerald-400/70"}`}>
                    {inv.Balance > 0 ? `${fmt(inv.Balance)} due` : "Paid"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
