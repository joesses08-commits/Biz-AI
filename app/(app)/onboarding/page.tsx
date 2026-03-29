"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [companyBrief, setCompanyBrief] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    checkOnboarded();
  }, []);

  async function checkOnboarded() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    // Check profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", user.id)
      .single();

    if (profile?.onboarded) {
      router.push("/dashboard");
      return;
    }
    setChecking(false);
  }

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
      // Save to profiles table
      await supabase.from("profiles").upsert({ id: user.id, onboarded: true });
      // Save to user metadata
      await supabase.auth.updateUser({ data: { onboarded: true } });
    }
    router.push("/dashboard");
  }

  const steps = [
    { id: 1, label: "Welcome" },
    { id: 2, label: "Company Brief" },
    { id: 3, label: "Connect Tools" },
    { id: 4, label: "Get Started" },
  ];

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

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

        {/* Step 0: Welcome */}
        {currentStep === 0 && (
          <div>
            <div className="text-center mb-10">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Welcome to Jimmy AI</p>
              <h1 className="text-4xl font-bold mb-4 tracking-tight">Your AI COO is ready.</h1>
              <p className="text-white/40 leading-relaxed">Jimmy AI connects every tool your business runs on and gives you a single AI that knows everything — your numbers, your emails, your meetings, your risks — and tells you exactly what to do.</p>
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

        {/* Step 1: Company Brief */}
        {currentStep === 1 && (
          <div>
            <div className="text-center mb-8">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Company Brief</p>
              <h1 className="text-3xl font-bold mb-3 tracking-tight">Tell your AI COO about your business.</h1>
              <p className="text-white/40 text-sm leading-relaxed">This is the foundation of your AI's knowledge. Be as detailed as possible — what you sell, who you sell to, what platforms you use, key people, how the business operates.</p>
            </div>
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Company Name</label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Corp"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition" />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Company Brief</label>
                <textarea value={companyBrief} onChange={e => setCompanyBrief(e.target.value)}
                  placeholder="Describe your business — what you sell, who you sell to, how you operate, key people, tools you use..."
                  rows={10}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition resize-none leading-relaxed" />
                <p className="text-white/20 text-xs mt-2">More context = smarter AI. You can always update this in Settings.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(0)} className="px-6 py-3 rounded-xl text-white/40 hover:text-white border border-white/10 hover:border-white/20 transition text-sm">Back</button>
              <button onClick={saveCompanyBrief} disabled={saving || !companyBrief.trim()}
                className="flex-1 bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 disabled:opacity-40 transition">
                {saving ? "Saving..." : "Save & Continue →"}
              </button>
            </div>
            <p className="text-center text-white/20 text-xs mt-4 cursor-pointer hover:text-white/40 transition" onClick={() => setCurrentStep(2)}>
              Skip for now — I'll add this in Settings
            </p>
          </div>
        )}

        {/* Step 2: Connect Tools */}
        {currentStep === 2 && (
          <div>
            <div className="text-center mb-8">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Connect Your Tools</p>
              <h1 className="text-3xl font-bold mb-3 tracking-tight">Give your AI COO full visibility.</h1>
              <p className="text-white/40 text-sm leading-relaxed">Connect the platforms your business runs on. The more you connect, the more your AI knows.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { name: "Gmail", href: "/api/gmail/connect", description: "Emails & client communication", icon: "📧" },
                { name: "QuickBooks", href: "/api/quickbooks/connect", description: "Invoices, P&L, cash flow", icon: "📊" },
                { name: "Microsoft 365", href: "/api/microsoft/connect", description: "Outlook, Excel, OneDrive", icon: "💼" },
                { name: "Stripe", href: "/api/stripe/connect", description: "Revenue & payments", icon: "💳" },
              ].map((tool) => (
                <a key={tool.name} href={tool.href}
                  className="bg-white/[0.03] border border-white/[0.06] hover:border-white/20 rounded-2xl p-5 transition">
                  <div className="text-2xl mb-3">{tool.icon}</div>
                  <p className="text-sm font-semibold mb-1">{tool.name}</p>
                  <p className="text-white/30 text-xs">{tool.description}</p>
                </a>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(1)} className="px-6 py-3 rounded-xl text-white/40 hover:text-white border border-white/10 hover:border-white/20 transition text-sm">Back</button>
              <button onClick={() => setCurrentStep(3)} className="flex-1 bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition">Continue →</button>
            </div>
            <p className="text-center text-white/20 text-xs mt-4 cursor-pointer hover:text-white/40 transition" onClick={() => setCurrentStep(3)}>
              Skip for now — I'll connect in Settings
            </p>
          </div>
        )}

        {/* Step 3: Get Started */}
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
