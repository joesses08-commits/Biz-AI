"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Check, ArrowRight, Lock, Factory, Package, FileSpreadsheet, Zap } from "lucide-react";

export default function OnboardingPage() {
  const [adminPin, setAdminPin] = useState("");
  const [adminPinConfirm, setAdminPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);
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
    const { data: profile } = await supabase.from("profiles").select("onboarded, admin_pin_hash").eq("id", user.id).single();
    if (profile?.onboarded) { router.push("/plm"); return; }
    if (profile?.admin_pin_hash) setPinSaved(true);
    setChecking(false);
  }

  async function savePin() {
    setPinError("");
    if (adminPin.length < 4) { setPinError("PIN must be at least 4 digits"); return; }
    if (adminPin !== adminPinConfirm) { setPinError("PINs do not match"); return; }
    setSavingPin(true);
    await fetch("/api/admin/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set_pin", pin: adminPin }) });
    setSavingPin(false);
    setPinSaved(true);
  }

  async function goToPLM() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert({ id: user.id, onboarded: true });
    }
    router.push("/plm");
  }

  const steps = [
    {
      number: "01",
      icon: Lock,
      title: "Set Your Admin PIN",
      description: "Protects sensitive actions like killing products or approving samples. You'll use this PIN throughout Jimmy.",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
      done: pinSaved,
      action: true,
    },
    {
      number: "02",
      icon: Factory,
      title: "Add Your Factories",
      description: "Go to Product Lifecycle → Factory Access tab. Add every factory you work with — name, email, contact person. These become your quoting and sample partners.",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      done: false,
      action: false,
      link: "/plm?tab=factories",
      linkLabel: "Add Factories →",
    },
    {
      number: "03",
      icon: Package,
      title: "Add Your Products",
      description: "Create a collection (like \"Spring 2026\") and add your products. Include SKU, images, and specs. Or bulk import from Excel — Jimmy extracts everything including images.",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      done: false,
      action: false,
      link: "/plm",
      linkLabel: "Add Products →",
    },
    {
      number: "04",
      icon: FileSpreadsheet,
      title: "Connect Your Email",
      description: "Connect Gmail or Outlook so Jimmy can send RFQs, sample requests, and POs directly to factories — and read their replies automatically.",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      done: false,
      action: false,
      link: "/integrations",
      linkLabel: "Connect Email →",
    },
    {
      number: "05",
      icon: Zap,
      title: "Start Sourcing",
      description: "Select products, click Request Quotes, pick your factories — Jimmy emails them all. When quotes come back, drop the Excel in chat and Jimmy extracts pricing automatically.",
      color: "text-white",
      bg: "bg-white/5",
      border: "border-white/10",
      done: false,
      action: false,
    },
  ];

  if (checking) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <line x1="24" y1="8" x2="24" y2="26" stroke="#0a0a0a" strokeWidth="4" strokeLinecap="round"/>
              <path d="M24 26 Q24 34 18 35 Q11 36 10 30" fill="none" stroke="#0a0a0a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">Welcome to Jimmy</h1>
          <p className="text-white/40 text-lg leading-relaxed max-w-xl mx-auto">Your sourcing command center. Get set up in 5 minutes.</p>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className={`border rounded-2xl p-6 transition ${step.done ? "border-emerald-500/30 bg-emerald-500/[0.03]" : step.border + " bg-white/[0.01]"}`}>
                <div className="flex items-start gap-5">
                  {/* Step number + icon */}
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${step.done ? "bg-emerald-500/20 border-emerald-500/30" : step.bg + " " + step.border}`}>
                      {step.done ? <Check size={20} className="text-emerald-400" /> : <Icon size={20} className={step.color} />}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">{step.number}</span>
                      <h3 className={`text-sm font-bold ${step.done ? "text-emerald-400" : "text-white"}`}>{step.title}</h3>
                      {step.done && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Done</span>}
                    </div>
                    <p className="text-sm text-white/40 leading-relaxed mb-4">{step.description}</p>

                    {/* PIN action */}
                    {step.action && !pinSaved && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5 block">PIN (4-8 digits)</label>
                            <input type="password" value={adminPin} onChange={e => setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                              placeholder="••••" maxLength={8}
                              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-center text-xl tracking-widest outline-none focus:border-white/20 transition" />
                          </div>
                          <div>
                            <label className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5 block">Confirm PIN</label>
                            <input type="password" value={adminPinConfirm} onChange={e => setAdminPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))}
                              placeholder="••••" maxLength={8}
                              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-center text-xl tracking-widest outline-none focus:border-white/20 transition" />
                          </div>
                        </div>
                        {pinError && <p className="text-red-400 text-xs">{pinError}</p>}
                        <button onClick={savePin} disabled={savingPin || !adminPin || !adminPinConfirm}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500 text-white text-xs font-semibold hover:bg-purple-400 transition disabled:opacity-40">
                          {savingPin ? "Saving..." : <><Lock size={12} />Set PIN</>}
                        </button>
                      </div>
                    )}

                    {/* Link */}
                    {step.link && (
                      <a href={step.link} className={`inline-flex items-center gap-1.5 text-xs font-semibold transition ${step.color} hover:opacity-80`}>
                        {step.linkLabel} <ArrowRight size={12} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Continue button */}
        <div className="mt-10 text-center">
          <button onClick={goToPLM}
            className="px-8 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition">
            Go to Product Lifecycle →
          </button>
          <p className="text-white/20 text-xs mt-3">You can always come back to this guide in Settings</p>
        </div>

      </div>
    </div>
  );
}
