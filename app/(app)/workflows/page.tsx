"use client";

import { useRouter } from "next/navigation";
import { Factory, TrendingDown, CreditCard, Calendar, FileText, Zap, ShoppingCart, ArrowRight } from "lucide-react";

const WORKFLOWS = [
  {
    icon: ShoppingCart,
    name: "PO Generator",
    tagline: "Select products, fill in details, generate and send purchase orders to factories in seconds.",
    color: "#3b82f6",
    href: "/workflows/po-generator",
    live: true,
    steps: ["Select products", "Fill order details", "Send to factory"],
  },
  {
    icon: Factory,
    name: "Factory Quote Request",
    tagline: "Upload your product list, Jimmy emails factories and auto-compares every quote side by side.",
    color: "#a78bfa",
    href: "/workflows/factory-quote",
    live: true,
    steps: ["Upload products", "Jimmy emails factories", "Compare quotes"],
  },
  {
    icon: TrendingDown,
    name: "Invoice Overdue Chaser",
    tagline: "Auto-detect overdue invoices and draft follow-up reminders before they become problems.",
    color: "#f59e0b",
    href: null,
    live: false,
    steps: ["Scan invoices", "Flag overdue", "Draft reminders"],
  },
  {
    icon: CreditCard,
    name: "Payment Failed Recovery",
    tagline: "When a Stripe payment fails, an instant recovery email is drafted and ready to send.",
    color: "#ef4444",
    href: null,
    live: false,
    steps: ["Detect failure", "Draft recovery", "Send follow-up"],
  },
  {
    icon: Calendar,
    name: "Meeting → Action Tracker",
    tagline: "Meeting ends, action items are extracted automatically, and a follow-up email is drafted.",
    color: "#10b981",
    href: null,
    live: false,
    steps: ["Meeting ends", "Extract actions", "Draft follow-up"],
  },
  {
    icon: FileText,
    name: "Month End Financial Summary",
    tagline: "Auto-generate a full monthly business report directly from your connected financial data.",
    color: "#f472b6",
    href: null,
    live: false,
    steps: ["Pull financials", "AI analysis", "Generate report"],
  },
];

export default function WorkflowsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Zap size={14} className="text-white/60" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Workflows</h1>
            </div>
            <p className="text-white/30 text-sm">AI automations that act on your behalf</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/30">{WORKFLOWS.filter(w => w.live).length} live</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Live workflows */}
        <div className="mb-8">
          <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Available Now</p>
          <div className="grid grid-cols-1 gap-4">
            {WORKFLOWS.filter(w => w.live).map((w) => (
              <div key={w.name} onClick={() => w.href && router.push(w.href)}
                className="group relative border border-white/[0.08] bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.03] rounded-2xl p-6 cursor-pointer transition-all overflow-hidden">
                {/* Glow */}
                <div className="absolute top-0 left-0 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none"
                  style={{ background: w.color }} />
                <div className="relative flex items-start gap-5">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${w.color}15`, border: `1px solid ${w.color}30` }}>
                    <w.icon size={20} style={{ color: w.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <p className="text-sm font-bold text-white">{w.name}</p>
                      <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Live</span>
                    </div>
                    <p className="text-xs text-white/40 mb-4 leading-relaxed">{w.tagline}</p>
                    {/* Steps */}
                    <div className="flex items-center gap-2">
                      {w.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[10px] text-white/30 bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 rounded-lg">{step}</span>
                          {i < w.steps.length - 1 && <ArrowRight size={10} className="text-white/15 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-xl border border-white/[0.06] bg-white/[0.03] group-hover:bg-white/[0.08] flex items-center justify-center transition flex-shrink-0">
                    <ArrowRight size={14} className="text-white/30 group-hover:text-white/60 transition" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coming soon */}
        <div>
          <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Coming Soon</p>
          <div className="grid grid-cols-1 gap-3">
            {WORKFLOWS.filter(w => !w.live).map((w) => (
              <div key={w.name}
                className="border border-white/[0.04] rounded-2xl p-5 opacity-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${w.color}10`, border: `1px solid ${w.color}20` }}>
                    <w.icon size={17} style={{ color: w.color, opacity: 0.6 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-white/60">{w.name}</p>
                      <span className="text-[9px] bg-white/[0.03] border border-white/[0.06] text-white/20 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Soon</span>
                    </div>
                    <p className="text-xs text-white/25">{w.tagline}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
