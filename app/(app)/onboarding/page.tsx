"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [companyBrief, setCompanyBrief] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function saveCompanyBrief() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user && companyBrief.trim()) {
      await supabase.from("company_profiles").upsert({
        user_id: user.id,
        company_name: companyName.trim(),
        company_brief: companyBrief.trim(),
        updated_at: new Date().toISOString(),
      });
    }
    setSaving(false);
    setCurrentStep(2);
  }

  async function finish() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert({ id: user.id, onboarded: true });
    }
    router.push("/dashboard");
  }

  const steps = [
    { id: 1, label: "Welcome" },
    { id: 2, label: "Company Brief" },
    { id: 3, label: "Connect Tools" },
    { id: 4, label: "Get Started" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">

        {/* Progress */}
        <div className="flex items-center gap-3 mb-12 justify-center">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${i <= currentStep ? "bg-white text-black" : "bg-white/10 text-white/30"}`}>
                {i < currentStep ? "✓" : s.id}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-12 h-px ${i < currentStep ? "bg-white/40" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 0: Welcome ── */}
        {currentStep === 0 && (
          <div>
            <div className="text-center mb-10">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Welcome to BizAI</p>
              <h1 className="text-4xl font-bold mb-4 tracking-tight">Your AI COO is ready.</h1>
              <p className="text-white/40 leading-relaxed">BizAI connects every tool your business runs on and gives you a single AI that knows everything — your numbers, your emails, your meetings, your risks — and tells you exactly what to do.</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-8 space-y-3">
              {["Live data from every platform you use", "AI that knows your specific business — not generic advice", "Proactive alerts before problems become crises", "Ask anything about your business in plain English"].map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <p className="text-white/60 text-sm">{b}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setCurrentStep(1)} className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition">
              Get Started →
            </button>
          </div>
        )}

        {/* ── Step 1: Company Brief ── */}
        {currentStep === 1 && (
          <div>
            <div className="text-center mb-8">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Company Brief</p>
              <h1 className="text-3xl font-bold mb-3 tracking-tight">Tell your AI COO about your business.</h1>
              <p className="text-white/40 text-sm leading-relaxed">This is the foundation of your AI's knowledge. Be as detailed as possible — what you sell, who you sell to, what platforms you use for what, key people, how the business operates. The more context you give, the smarter it gets from day one.</p>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Company Brief</label>
                <textarea
                  value={companyBrief}
                  onChange={e => setCompanyBrief(e.target.value)}
                  placeholder={`Example: We are a B2B SaaS company that sells project management software to construction companies. We charge $299/mo per seat. We get our leads from LinkedIn and cold email. Our biggest customers are mid-size contractors doing $5M-$50M in revenue. We use Stripe for billing, QuickBooks for accounting, Gmail for all client communication, and Google Sheets for our sales pipeline. Our sales team is 3 people, our biggest cost is payroll at ~$80k/mo. We're currently at $45k MRR and growing 15% month over month. The CEO should focus on anything related to churn, new deals closing, or cash flow.`}
                  rows={12}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition resize-none leading-relaxed"
                />
                <p className="text-white/20 text-xs mt-2">Write as much as you want. More context = smarter AI.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(0)} className="px-6 py-3 rounded-xl text-white/40 hover:text-white border border-white/10 hover:border-white/20 transition text-sm">
                Back
              </button>
              <button onClick={saveCompanyBrief} disabled={saving || !companyBrief.trim()}
                className="flex-1 bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 disabled:opacity-40 transition">
                {saving ? "Saving..." : "Save & Continue →"}
              </button>
            </div>
            <p className="text-center text-white/20 text-xs mt-4 cursor-pointer hover:text-white/40 transition" onClick={() => setCurrentStep(2)}>
              Skip for now
            </p>
          </div>
        )}

        {/* ── Step 2: Connect Tools ── */}
        {currentStep === 2 && (
          <div>
            <div className="text-center mb-8">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Connect Your Tools</p>
              <h1 className="text-3xl font-bold mb-3 tracking-tight">Give your AI COO full visibility.</h1>
              <p className="text-white/40 text-sm leading-relaxed">Connect the platforms your business runs on. The more you connect, the more your AI knows.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { name: "Gmail", href: "/api/gmail/connect", description: "Emails & client communication", icon: (
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.364l-6.545-4.636v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.273l6.545-4.636 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/></svg>
                )},
                { name: "QuickBooks", href: "/api/quickbooks/connect", description: "Invoices, P&L, cash flow", icon: (
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none"><circle cx="12" cy="12" r="11" fill="#2CA01C" fillOpacity="0.2" stroke="#2CA01C" strokeWidth="1.5"/><path d="M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0zm4-2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="#2CA01C"/></svg>
                )},
                { name: "Microsoft 365", href: "/api/microsoft/connect", description: "Outlook, Excel, OneDrive", icon: (
                  <svg viewBox="0 0 23 23" className="w-6 h-6" fill="none"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="12" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="12" width="10" height="10" fill="#00A4EF"/><rect x="12" y="12" width="10" height="10" fill="#FFB900"/></svg>
                )},
                { name: "Stripe", href: "/api/stripe/connect", description: "Revenue & payments", icon: (
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.91 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" fill="#635BFF"/></svg>
                )},
              ].map((tool) => (
                <a key={tool.name} href={tool.href}
                  className="bg-white/[0.03] border border-white/[0.06] hover:border-white/20 rounded-2xl p-5 transition group">
                  <div className="mb-3">{tool.icon}</div>
                  <p className="text-sm font-semibold mb-1">{tool.name}</p>
                  <p className="text-white/30 text-xs">{tool.description}</p>
                </a>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(1)} className="px-6 py-3 rounded-xl text-white/40 hover:text-white border border-white/10 hover:border-white/20 transition text-sm">
                Back
              </button>
              <button onClick={() => setCurrentStep(3)} className="flex-1 bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition">
                Continue →
              </button>
            </div>
            <p className="text-center text-white/20 text-xs mt-4 cursor-pointer hover:text-white/40 transition" onClick={() => setCurrentStep(3)}>
              Skip for now
            </p>
          </div>
        )}

        {/* ── Step 3: Get Started ── */}
        {currentStep === 3 && (
          <div>
            <div className="text-center mb-8">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">You're ready</p>
              <h1 className="text-3xl font-bold mb-3 tracking-tight">Your AI COO is briefed.</h1>
              <p className="text-white/40 text-sm leading-relaxed">Ask it anything about your business. It has full context on your company and access to all your connected platforms.</p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-8 space-y-2">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-4">Try asking</p>
              {[
                "What's the most important thing I should focus on today?",
                "What does my financial position look like right now?",
                "Are there any urgent emails I need to respond to?",
                "Who are my most valuable customers and are any at risk?",
              ].map((q, i) => (
                <div key={i} onClick={() => router.push(`/chat?q=${encodeURIComponent(q)}`)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition cursor-pointer group">
                  <span className="text-white/20 group-hover:text-white/40 transition text-xs">→</span>
                  <p className="text-white/50 text-sm group-hover:text-white/70 transition">{q}</p>
                </div>
              ))}
            </div>

            <button onClick={finish} className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition">
              Go to Dashboard →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
