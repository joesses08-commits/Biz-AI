"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Check, ArrowRight, ArrowLeft, Lock, Factory, Package, Mail, Zap, FileSpreadsheet, Users, Truck, BarChart3 } from "lucide-react";

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to Jimmy",
    subtitle: "Your sourcing command center",
    description: "Jimmy replaces the spreadsheets, email chains, and scattered notes you use to manage factories, samples, and production. Everything in one place.",
    visual: "welcome",
    color: "white",
  },
  {
    id: "factories",
    title: "Add Your Factories",
    subtitle: "Step 1 of 5",
    description: "Start by adding the factories you work with. Each factory gets their own portal where they can update sample and production status — no more chasing emails.",
    visual: "factories",
    color: "blue",
    link: "/plm?tab=factories",
    linkLabel: "Add Factories",
  },
  {
    id: "products",
    title: "Add Your Products",
    subtitle: "Step 2 of 5",
    description: "Create collections (like \"Target Spring 2026\") and add your products. Include SKUs, images, specs. Or bulk import from Excel — Jimmy extracts everything including images.",
    visual: "products",
    color: "amber",
    link: "/plm",
    linkLabel: "Add Products",
  },
  {
    id: "email",
    title: "Connect Your Email",
    subtitle: "Step 3 of 5",
    description: "Connect Gmail or Outlook so Jimmy can send RFQs, sample requests, and POs directly to factories from your email address — and read their replies automatically.",
    visual: "email",
    color: "emerald",
    link: "/integrations",
    linkLabel: "Connect Email",
  },
  {
    id: "workflow",
    title: "The Sourcing Workflow",
    subtitle: "Step 4 of 5",
    description: "Here's how Jimmy manages your entire sourcing cycle — from first quote to shipped goods.",
    visual: "workflow",
    color: "purple",
    bullets: [
      { icon: FileSpreadsheet, text: "Request quotes from multiple factories at once" },
      { icon: Package, text: "Track samples through production → shipped → arrived" },
      { icon: Check, text: "Approve samples and generate POs with one click" },
      { icon: Truck, text: "Factories update their own progress in their portal" },
      { icon: BarChart3, text: "Compare landed costs and pick the best factory" },
    ],
  },
  {
    id: "ready",
    title: "You're Ready",
    subtitle: "Step 5 of 5",
    description: "That's it. Start by adding a few factories and products, then request your first quote. Jimmy handles the rest.",
    visual: "ready",
    color: "emerald",
    link: "/plm",
    linkLabel: "Go to Product Lifecycle",
    final: true,
  },
];

function WelcomeVisual() {
  return (
    <div className="relative w-full h-64 flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-amber-500/10 rounded-3xl" />
      <div className="relative flex items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-2xl">
          <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <line x1="24" y1="8" x2="24" y2="26" stroke="#0a0a0a" strokeWidth="4" strokeLinecap="round"/>
            <path d="M24 26 Q24 34 18 35 Q11 36 10 30" fill="none" stroke="#0a0a0a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="text-left">
          <p className="text-2xl font-bold text-white">Jimmy AI</p>
          <p className="text-white/40 text-sm">Sourcing OS for Wholesale</p>
        </div>
      </div>
    </div>
  );
}

function FactoriesVisual() {
  return (
    <div className="relative w-full h-64 flex items-center justify-center p-6">
      <div className="grid grid-cols-3 gap-3 w-full max-w-md">
        {["Shenzhen Glass Co.", "Ningbo Ceramics", "Yiwu Trading"].map((name, i) => (
          <div key={i} className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
              <Factory size={18} className="text-blue-400" />
            </div>
            <p className="text-xs font-semibold text-white truncate">{name}</p>
            <p className="text-[10px] text-white/30 mt-0.5">Factory</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductsVisual() {
  return (
    <div className="relative w-full h-64 flex items-center justify-center p-6">
      <div className="space-y-3 w-full max-w-sm">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Package size={20} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">16oz Glass Deer Cup</p>
            <p className="text-[10px] text-white/30">GL-009 · Christmas Glass</p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Sample Requested</span>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Package size={20} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">10oz Rabbit Mug</p>
            <p className="text-[10px] text-white/30">GL-008 · Easter Collection</p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Approved ✓</span>
        </div>
      </div>
    </div>
  );
}

function EmailVisual() {
  return (
    <div className="relative w-full h-64 flex items-center justify-center p-6">
      <div className="flex items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24"><path fill="#EA4335" d="M22 6v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path fill="#FBBC04" d="M22 6l-10 7L2 6"/><path fill="#34A853" d="M2 6l10 7 10-7v12H2z" opacity=".5"/></svg>
          </div>
          <p className="text-[10px] text-white/40">Gmail</p>
        </div>
        <div className="text-white/20">or</div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24"><path fill="#0078D4" d="M21 4H3a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z"/><path fill="#fff" d="M12 13.5L3 8v10h18V8l-9 5.5z" opacity=".8"/><path fill="#fff" d="M21 5l-9 6-9-6h18z"/></svg>
          </div>
          <p className="text-[10px] text-white/40">Outlook</p>
        </div>
      </div>
    </div>
  );
}

function WorkflowVisual({ bullets }: { bullets: any[] }) {
  return (
    <div className="relative w-full h-64 flex items-center justify-center p-6">
      <div className="space-y-2 w-full max-w-md">
        {bullets.map((b, i) => {
          const Icon = b.icon;
          return (
            <div key={i} className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Icon size={14} className="text-purple-400" />
              </div>
              <p className="text-xs text-white/70">{b.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadyVisual() {
  return (
    <div className="relative w-full h-64 flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
          <Check size={40} className="text-emerald-400" />
        </div>
        <p className="text-lg font-semibold text-white">You're all set</p>
        <p className="text-sm text-white/40 mt-1">Let's start sourcing</p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setChecking(false);
    }
    check();
  }, []);

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  const next = () => {
    if (!isLast) setCurrentStep(currentStep + 1);
  };

  const prev = () => {
    if (!isFirst) setCurrentStep(currentStep - 1);
  };

  const finish = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert({ id: user.id, onboarded: true });
    }
    router.push("/plm");
  };

  if (checking) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  const colorMap: Record<string, string> = {
    white: "from-white/5 to-white/0",
    blue: "from-blue-500/10 to-blue-500/0",
    amber: "from-amber-500/10 to-amber-500/0",
    emerald: "from-emerald-500/10 to-emerald-500/0",
    purple: "from-purple-500/10 to-purple-500/0",
  };

  const btnColorMap: Record<string, string> = {
    white: "bg-white text-black hover:bg-white/90",
    blue: "bg-blue-500 text-white hover:bg-blue-400",
    amber: "bg-amber-500 text-black hover:bg-amber-400",
    emerald: "bg-emerald-500 text-white hover:bg-emerald-400",
    purple: "bg-purple-500 text-white hover:bg-purple-400",
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/5 z-50">
        <div 
          className="h-full bg-white transition-all duration-500 ease-out"
          style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Skip button */}
      <div className="fixed top-6 right-6 z-50">
        <button onClick={finish} className="text-xs text-white/30 hover:text-white/60 transition">
          Skip setup →
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Visual */}
          <div className={`rounded-3xl bg-gradient-to-b ${colorMap[step.color]} border border-white/[0.06] mb-8 overflow-hidden`}>
            {step.visual === "welcome" && <WelcomeVisual />}
            {step.visual === "factories" && <FactoriesVisual />}
            {step.visual === "products" && <ProductsVisual />}
            {step.visual === "email" && <EmailVisual />}
            {step.visual === "workflow" && <WorkflowVisual bullets={step.bullets || []} />}
            {step.visual === "ready" && <ReadyVisual />}
          </div>

          {/* Text */}
          <div className="text-center mb-8">
            {step.subtitle && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">{step.subtitle}</p>
            )}
            <h1 className="text-3xl font-bold tracking-tight mb-3">{step.title}</h1>
            <p className="text-white/40 text-sm leading-relaxed max-w-md mx-auto">{step.description}</p>
          </div>

          {/* Action button */}
          {step.link && (
            <div className="flex justify-center mb-8">
              <a href={step.link} className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition ${btnColorMap[step.color]}`}>
                {step.linkLabel} <ArrowRight size={14} />
              </a>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4">
            {!isFirst && (
              <button onClick={prev} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 text-sm transition">
                <ArrowLeft size={14} /> Back
              </button>
            )}
            
            {!isLast ? (
              <button onClick={next} className="flex items-center gap-2 px-6 py-2 rounded-xl bg-white/10 border border-white/[0.08] text-white hover:bg-white/20 text-sm font-semibold transition">
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={finish} className="flex items-center gap-2 px-6 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 text-sm font-semibold transition">
                Get Started <ArrowRight size={14} />
              </button>
            )}
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2 mt-8">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-2 h-2 rounded-full transition ${i === currentStep ? "bg-white" : "bg-white/20 hover:bg-white/40"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
