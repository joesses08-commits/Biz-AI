"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const TOKEN_PACKS = [
  { label: "10,000 tokens", tokens: 10000, price: "$10", priceId: "price_1TGubfLYyxBan4QvzDH75ZHD" },
  { label: "25,000 tokens", tokens: 25000, price: "$25", priceId: "price_1TGudULYyxBan4Qvq49EOsze" },
  { label: "50,000 tokens", tokens: 50000, price: "$50", priceId: "price_1TGue9LYyxBan4QvWAkqZpk6" },
  { label: "100,000 tokens", tokens: 100000, price: "$100", priceId: "price_1TGueeLYyxBan4QvVY3UFTMA", popular: true },
];

interface Quota {
  tokensRemaining: number;
  tokensUsedToday: number;
  monthlyTotalUsed: number;
  dailyLimit: number | null;
  monthlyLimit: number;
  pctUsed: number;
}

function QuotaContent() {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [dailyLimit, setDailyLimit] = useState<string>("");
  const [savingLimit, setSavingLimit] = useState(false);
  const [savedLimit, setSavedLimit] = useState(false);
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  useEffect(() => {
    fetch("/api/quota")
      .then(r => r.json())
      .then(d => {
        setQuota(d);
        setDailyLimit(d.dailyLimit ? d.dailyLimit.toString() : "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const buyTokens = async (priceId: string) => {
    setBuying(priceId);
    try {
      const res = await fetch("/api/quota/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Something went wrong. Please try again.");
        setBuying(null);
      }
    } catch (err) {
      console.error("Buy tokens error:", err);
      alert("Something went wrong. Please try again.");
      setBuying(null);
    }
  };

  const saveDailyLimit = async () => {
    setSavingLimit(true);
    await fetch("/api/quota", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyLimit: dailyLimit ? parseInt(dailyLimit) : null }),
    });
    setSavingLimit(false);
    setSavedLimit(true);
    setTimeout(() => setSavedLimit(false), 3000);
    const res = await fetch("/api/quota");
    const data = await res.json();
    setQuota(data);
  };

  const pctRemaining = quota ? Math.round((quota.tokensRemaining / quota.monthlyLimit) * 100) : 100;
  const isLow = pctRemaining < 20;
  const isEmpty = quota && quota.tokensRemaining === 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">AI Tokens</h1>
          <p className="text-white/30 text-sm mt-1">Manage your AI usage for quote extraction, PLM agent, and document processing.</p>
        </div>

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-6 text-center">
            <p className="text-emerald-400 font-semibold">✓ Tokens added successfully</p>
            <p className="text-white/30 text-xs mt-1">Your balance has been updated.</p>
          </div>
        )}

        {loading ? (
          <div className="text-white/30 text-sm">Loading...</div>
        ) : (
          <>
            <div className={`border rounded-2xl p-6 mb-6 ${isEmpty ? "bg-red-500/5 border-red-500/20" : isLow ? "bg-yellow-500/5 border-yellow-500/20" : "bg-white/[0.02] border-white/[0.06]"}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-white/30 text-xs uppercase tracking-widest mb-1">Monthly Balance</p>
                  <p className={`text-4xl font-bold ${isEmpty ? "text-red-400" : isLow ? "text-yellow-400" : "text-white"}`}>
                    {quota?.tokensRemaining.toLocaleString()}
                  </p>
                  <p className="text-white/30 text-xs mt-1">of {quota?.monthlyLimit.toLocaleString()} tokens remaining</p>
                </div>
                <div className="text-right">
                  <p className="text-white/30 text-xs uppercase tracking-widest mb-1">Used Today</p>
                  <p className="text-xl font-semibold text-white">{quota?.tokensUsedToday.toLocaleString()}</p>
                  {quota?.dailyLimit && (
                    <p className="text-white/30 text-xs mt-1">of {quota.dailyLimit.toLocaleString()} daily limit</p>
                  )}
                </div>
              </div>

              <div className="w-full bg-white/[0.06] rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all ${isEmpty ? "bg-red-500" : isLow ? "bg-yellow-500" : "bg-white/40"}`}
                  style={{ width: `${pctRemaining}%` }}
                />
              </div>
              <p className="text-white/20 text-xs">{pctRemaining}% remaining this month</p>

              {isEmpty && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-400 text-sm font-semibold">You're out of tokens</p>
                  <p className="text-white/40 text-xs mt-1">PLM Agent and quote extraction are paused. Purchase more tokens below to continue.</p>
                </div>
              )}

              {isLow && !isEmpty && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <p className="text-yellow-400 text-sm font-semibold">Running low</p>
                  <p className="text-white/40 text-xs mt-1">Consider purchasing more tokens to avoid interruption.</p>
                </div>
              )}
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 mb-6">
              <h2 className="text-sm font-semibold text-white mb-1">Daily Spending Limit</h2>
              <p className="text-white/30 text-xs mb-4">Set a daily token cap to control how fast you use your monthly balance. Optional — hitting the limit pauses AI features for that day only.</p>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-[10px] text-white/30 uppercase tracking-widest mb-2 block">Daily limit (tokens)</label>
                  <input
                    type="number"
                    value={dailyLimit}
                    onChange={e => setDailyLimit(e.target.value)}
                    placeholder="No limit"
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition text-sm"
                  />
                  <p className="text-white/15 text-xs mt-1">e.g. 2,000 tokens/day ≈ $2/day</p>
                </div>
                <button onClick={saveDailyLimit} disabled={savingLimit}
                  className="bg-white text-black font-semibold px-6 py-3 rounded-xl hover:bg-white/90 disabled:opacity-50 transition text-sm flex-shrink-0">
                  {savingLimit ? "Saving..." : "Save"}
                </button>
              </div>
              {savedLimit && <p className="text-emerald-400 text-xs mt-2">Saved ✓</p>}
              {quota?.dailyLimit && (
                <button onClick={() => { setDailyLimit(""); saveDailyLimit(); }}
                  className="text-white/20 text-xs mt-2 hover:text-white/40 transition">
                  Remove limit
                </button>
              )}
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 mb-4">
              <h2 className="text-sm font-semibold text-white mb-1">Buy More Tokens</h2>
              <p className="text-white/30 text-xs mb-6">Tokens never expire and stack on top of your monthly balance.</p>
              <div className="grid grid-cols-2 gap-3">
                {TOKEN_PACKS.map((pack) => (
                  <button key={pack.priceId} onClick={() => buyTokens(pack.priceId)}
                    disabled={!!buying}
                    className={`relative border rounded-2xl p-5 text-left transition hover:border-white/20 disabled:opacity-60 ${pack.popular ? "border-white/20 bg-white/[0.04]" : "border-white/[0.06] bg-white/[0.02]"}`}>
                    {pack.popular && (
                      <span className="absolute top-3 right-3 text-[10px] bg-white text-black font-bold px-2 py-0.5 rounded-full">POPULAR</span>
                    )}
                    <p className="text-lg font-bold text-white mb-1">{pack.tokens.toLocaleString()}</p>
                    <p className="text-white/40 text-xs mb-3">AI tokens</p>
                    <p className="text-white font-semibold">
                      {buying === pack.priceId ? "Redirecting..." : pack.price}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">What costs tokens</p>
              <div className="space-y-2">
                {[
                  { label: "Factory quote extraction (per file)", cost: "50 tokens" },
                  { label: "PLM Agent question", cost: "30 tokens" },
                  { label: "Document drop processing", cost: "40 tokens" },
                  { label: "Quote comparison build", cost: "100 tokens" },
                  { label: "RFQ email generation", cost: "20 tokens" },
                  { label: "Sample request email", cost: "15 tokens" },
                  { label: "PO generation", cost: "25 tokens" },
                  { label: "Excel bulk import (AI mapping)", cost: "30 tokens" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <p className="text-white/50 text-xs">{item.label}</p>
                    <p className="text-xs font-semibold text-white/50">{item.cost}</p>
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

export default function QuotaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <QuotaContent />
    </Suspense>
  );
}
