"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const INTEGRATIONS = [
  { id: "gmail", name: "Gmail & Google Drive", description: "Emails, Sheets, Docs, Slides", icon: "G", color: "bg-red-500/10 border-red-500/20 text-red-400" },
  { id: "microsoft", name: "Microsoft 365", description: "Outlook, OneDrive, Excel", icon: "M", color: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
  { id: "quickbooks", name: "QuickBooks", description: "Invoices, P&L, cash flow", icon: "Q", color: "bg-green-500/10 border-green-500/20 text-green-400" },
  { id: "stripe", name: "Stripe", description: "Revenue & payments", icon: "S", color: "bg-purple-500/10 border-purple-500/20 text-purple-400" },
];

const BRAIN_SOURCES = [
  { source: "gmail", label: "Gmail", sublabel: "Last 12 months — inbox & sent, smart filtered", integration: "gmail", batched: true },
  { source: "google_drive", label: "Google Drive", sublabel: "Sheets, Docs, Slides with full content", integration: "gmail", batched: false },
  { source: "microsoft", label: "Microsoft 365", sublabel: "Outlook emails + OneDrive files", integration: "microsoft", batched: false },
  { source: "quickbooks", label: "QuickBooks", sublabel: "All invoices and customers", integration: "quickbooks", batched: false },
  { source: "stripe", label: "Stripe", sublabel: "All charges, subscriptions, customers", integration: "stripe", batched: false },
];

type SourceStatus = "pending" | "collecting" | "processing" | "done" | "skipped";

interface SourceProgress {
  source: string;
  label: string;
  sublabel: string;
  status: SourceStatus;
  items?: number;
  pct?: number;
  jobId?: string;
}

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyBrief, setCompanyBrief] = useState("");
  const [saving, setSaving] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminPinConfirm, setAdminPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([]);
  const [buildingBrain, setBuildingBrain] = useState(false);
  const [brainProgress, setBrainProgress] = useState<SourceProgress[]>([]);
  const [brainDone, setBrainDone] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => { checkOnboarded(); }, []);
  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  async function checkOnboarded() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", user.id).single();
    if (profile?.onboarded) { router.push("/dashboard"); return; }

    const [gmail, microsoft, quickbooks, stripe] = await Promise.all([
      supabase.from("gmail_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("microsoft_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("quickbooks_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("stripe_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]);

    const connected = [];
    if (gmail.data) connected.push("gmail");
    if (microsoft.data) connected.push("microsoft");
    if (quickbooks.data) connected.push("quickbooks");
    if (stripe.data) connected.push("stripe");
    setConnectedIntegrations(connected);
    setChecking(false);
  }

  async function saveCompanyBrief() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("company_profiles").upsert({
        user_id: user.id,
        company_name: companyName.trim(),
        company_brief: companyBrief.trim(),
        updated_at: new Date().toISOString(),
      });
      if (companyAddress.trim()) {
        await supabase.from("company_settings").upsert({ user_id: user.id, address: companyAddress.trim() }, { onConflict: "user_id" });
      }
      if (contactName.trim()) {
        await supabase.from("profiles").update({ full_name: contactName.trim() }).eq("id", user.id);
      }
    }
    setSaving(false);
    setCurrentStep(2);
  }

  async function pollJob(jobId: string, sourceIndex: number) {
    const poll = async () => {
      try {
        const res = await fetch(`/api/brain/backfill/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
        const data = await res.json();

        setBrainProgress(prev => prev.map((p, idx) => idx === sourceIndex ? {
          ...p,
          status: data.done ? "done" : "processing",
          pct: data.pct,
          items: data.processed,
        } : p));

        if (data.done) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          processNextSource(sourceIndex + 1);
        }
      } catch {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setBrainProgress(prev => prev.map((p, idx) => idx === sourceIndex ? { ...p, status: "skipped" } : p));
        processNextSource(sourceIndex + 1);
      }
    };

    pollingRef.current = setInterval(poll, 2000);
  }

  async function processNextSource(index: number) {
    const activeSources = BRAIN_SOURCES.filter(s => connectedIntegrations.includes(s.integration));
    if (index >= activeSources.length) {
      setBrainDone(true);
      setBuildingBrain(false);
      return;
    }

    const s = activeSources[index];
    setBrainProgress(prev => prev.map((p, idx) => idx === index ? { ...p, status: s.batched ? "collecting" : "processing" } : p));

    try {
      if (s.batched) {
        // Gmail: start job then poll
        const res = await fetch("/api/brain/backfill/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: s.source }),
        });
        const data = await res.json();

        setBrainProgress(prev => prev.map((p, idx) => idx === index ? {
          ...p,
          status: "processing",
          jobId: data.jobId,
          items: data.totalItems,
        } : p));

        await pollJob(data.jobId, index);
      } else {
        // Direct processing
        const res = await fetch("/api/brain/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: s.source }),
        });
        const data = await res.json();

        setBrainProgress(prev => prev.map((p, idx) => idx === index ? {
          ...p,
          status: "done",
          items: data.itemsProcessed,
        } : p));

        processNextSource(index + 1);
      }
    } catch {
      setBrainProgress(prev => prev.map((p, idx) => idx === index ? { ...p, status: "skipped" } : p));
      processNextSource(index + 1);
    }
  }

  async function buildBrain() {
    setBuildingBrain(true);
    setBrainDone(false);

    const activeSources = BRAIN_SOURCES.filter(s => connectedIntegrations.includes(s.integration));
    if (!activeSources.length) { setBrainDone(true); setBuildingBrain(false); return; }

    setBrainProgress(activeSources.map(s => ({ ...s, status: "pending", pct: 0 })));
    processNextSource(0);
  }

  async function finish() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert({ id: user.id, onboarded: true });
      await supabase.auth.updateUser({ data: { onboarded: true } });
    }
    router.push("/dashboard");
  }

  const steps = [
    { id: 1, label: "Welcome" },
    { id: 2, label: "Your Business" },
    { id: 3, label: "Admin PIN" },
    { id: 4, label: "Connect Tools" },
    { id: 5, label: "Build Brain" },
    { id: 6, label: "Launch" },
  ];

  if (checking) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">

        <div className="flex items-center gap-2 mb-12 justify-center">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${i <= currentStep ? "bg-white text-black" : "bg-white/10 text-white/30"}`}>
                {i < currentStep ? "✓" : s.id}
              </div>
              {i < steps.length - 1 && <div className={`w-10 h-px ${i < currentStep ? "bg-white/40" : "bg-white/10"}`} />}
            </div>
          ))}
        </div>

        {currentStep === 0 && (
          <div>
            <div className="text-center mb-10">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Welcome to Jimmy AI</p>
              <h1 className="text-4xl font-bold mb-4 tracking-tight">Your AI COO is ready.</h1>
              <p className="text-white/40 leading-relaxed">Jimmy connects every tool your business runs on and gives you a single AI that knows everything — your numbers, your emails, your deals, your risks.</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-8 space-y-3">
              {["Knows your full business history from day one", "Live data from every platform you use", "Proactive alerts before problems become crises", "Ask anything about your business in plain English"].map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <p className="text-white/60 text-sm">{b}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setCurrentStep(1)} className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition">Get Started →</button>
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <div className="text-center mb-8">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Your Business</p>
              <h1 className="text-3xl font-bold mb-3 tracking-tight">Tell Jimmy about your business.</h1>
              <p className="text-white/40 text-sm leading-relaxed">This is the foundation of your AI's knowledge. The more detail you give, the smarter it gets from day one.</p>
            </div>
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Company Name</label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Corp"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition" />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Your Name</label>
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Joey Esses"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition" />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Company Address</label>
                <input type="text" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} placeholder="123 Main St, Brooklyn NY 11201"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition" />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Tell Jimmy about your business</label>
                <textarea value={companyBrief} onChange={e => setCompanyBrief(e.target.value)}
                  placeholder="What do you sell, who are your clients, how do you operate, what tools do you use, who are the key people, what are your current goals..."
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
            <p className="text-center text-white/20 text-xs mt-4 cursor-pointer hover:text-white/40 transition" onClick={() => setCurrentStep(2)}>Skip for now</p>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <div className="text-center mb-8">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Admin PIN</p>
              <h1 className="text-3xl font-bold mb-3 tracking-tight">Set your Admin PIN.</h1>
              <p className="text-white/40 text-sm leading-relaxed">Your PIN protects sensitive actions in Jimmy — like killing products, unchecking milestones, and changing product status. It can never be viewed again, but you can reset it via email.</p>
            </div>
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">PIN (4-8 digits)</label>
                <input type="password" value={adminPin} onChange={e => setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="••••" maxLength={8}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest outline-none focus:border-white/30 transition" />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Confirm PIN</label>
                <input type="password" value={adminPinConfirm} onChange={e => setAdminPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="••••" maxLength={8}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest outline-none focus:border-white/30 transition" />
              </div>
              {pinError && <p className="text-red-400 text-xs text-center">{pinError}</p>}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                <p className="text-[11px] text-white/30">🔒 Your PIN is stored securely and can never be viewed. If you forget it, use the "Forgot PIN" option in Settings to reset via email.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(1)} className="px-6 py-3 rounded-xl text-white/40 hover:text-white border border-white/10 hover:border-white/20 transition text-sm">Back</button>
              <button onClick={async () => {
                setPinError("");
                if (adminPin.length < 4) { setPinError("PIN must be at least 4 digits"); return; }
                if (adminPin !== adminPinConfirm) { setPinError("PINs don't match"); return; }
                setSavingPin(true);
                await fetch("/api/admin/pin", { method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "set_pin", pin: adminPin }) });
                setSavingPin(false);
                setCurrentStep(3);
              }} disabled={savingPin || !adminPin || !adminPinConfirm}
                className="flex-1 bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 disabled:opacity-40 transition">
                {savingPin ? "Saving..." : "Set PIN & Continue →"}
              </button>
            </div>

          </div>
        )}

        {currentStep === 3 && (
          <div>
            <div className="text-center mb-8">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Connect Your Tools</p>
              <h1 className="text-3xl font-bold mb-3 tracking-tight">Give Jimmy full visibility.</h1>
              <p className="text-white/40 text-sm leading-relaxed">Connect the platforms your business runs on. Jimmy will read your full history and know your business from day one.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {INTEGRATIONS.map((tool) => {
                const isConnected = connectedIntegrations.includes(tool.id);
                const connectHref = `/api/${tool.id === "gmail" ? "gmail" : tool.id === "microsoft" ? "microsoft" : tool.id === "quickbooks" ? "quickbooks" : "stripe"}/connect`;
                return (
                  <div key={tool.id} className={`relative border rounded-2xl p-5 transition ${isConnected ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/[0.06] bg-white/[0.03]"}`}>
                    {isConnected && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <span className="text-emerald-400 text-xs">✓</span>
                      </div>
                    )}
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold mb-3 ${tool.color}`}>
                      {tool.icon}
                    </div>
                    <p className="text-sm font-semibold mb-1">{tool.name}</p>
                    <p className="text-white/30 text-xs mb-3">{tool.description}</p>
                    {!isConnected && (
                      <a href={connectHref} className="text-xs text-white/50 hover:text-white transition underline underline-offset-2">Connect →</a>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(2)} className="px-6 py-3 rounded-xl text-white/40 hover:text-white border border-white/10 hover:border-white/20 transition text-sm">Back</button>
              <button onClick={() => setCurrentStep(4)} className="flex-1 bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition">
                {connectedIntegrations.length > 0 ? "Continue →" : "Skip for now →"}
              </button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <div className="text-center mb-8">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Company Brain</p>
              <h1 className="text-3xl font-bold mb-3 tracking-tight">
                {brainDone ? "Your brain is built." : "Build your Company Brain."}
              </h1>
              <p className="text-white/40 text-sm leading-relaxed">
                {brainDone ? "Jimmy has read your full history and knows your business. You're ready." :
                 connectedIntegrations.length > 0 ? "Jimmy will read your full history — emails, files, invoices, payments — and build permanent intelligence about your business. One time only." :
                 "No tools connected yet. Connect your tools first, then come back to build your brain."}
              </p>
            </div>

            {connectedIntegrations.length > 0 && !buildingBrain && !brainDone && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6">
                <p className="text-white/30 text-xs uppercase tracking-widest mb-4">What Jimmy will read</p>
                <div className="space-y-4">
                  {BRAIN_SOURCES.filter(s => connectedIntegrations.includes(s.integration)).map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30 mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-white/70 font-medium">{s.label}</p>
                        <p className="text-xs text-white/30">{s.sublabel}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <p className="text-white/20 text-xs">Takes 2-5 minutes depending on your data volume. You can navigate away — it runs in the background.</p>
                </div>
              </div>
            )}

            {(buildingBrain || brainDone) && brainProgress.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6">
                <p className="text-white/30 text-xs uppercase tracking-widest mb-4">Building your brain</p>
                <div className="space-y-4">
                  {brainProgress.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border transition-all ${
                        item.status === "done" ? "bg-emerald-500/20 border-emerald-500/30" :
                        item.status === "processing" || item.status === "collecting" ? "bg-white/10 border-white/30" :
                        "bg-white/5 border-white/10"
                      }`}>
                        {item.status === "done" && <span className="text-emerald-400 text-xs">✓</span>}
                        {(item.status === "processing" || item.status === "collecting") && <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {item.status === "pending" && <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                        {item.status === "skipped" && <span className="text-white/20 text-xs">—</span>}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-sm font-medium transition ${item.status === "done" ? "text-white/70" : item.status === "processing" || item.status === "collecting" ? "text-white" : "text-white/30"}`}>
                            {item.label}
                          </p>
                          {item.status === "processing" && item.pct !== undefined && (
                            <span className="text-xs text-white/30">{item.pct}%</span>
                          )}
                        </div>
                        {item.status === "processing" && item.pct !== undefined && (
                          <div className="w-full bg-white/[0.06] rounded-full h-1 mb-1">
                            <div className="bg-white/40 h-1 rounded-full transition-all duration-500" style={{ width: `${item.pct}%` }} />
                          </div>
                        )}
                        <p className="text-xs text-white/25">
                          {item.status === "done" && item.items !== undefined ? `${item.items} emails scanned` :
                           item.status === "collecting" ? "Collecting emails..." :
                           item.status === "processing" ? `Analyzing ${item.items || "..."} emails...` :
                           item.status === "pending" ? item.sublabel :
                           item.status === "skipped" ? "Skipped" : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {brainDone && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 mb-6 text-center">
                <p className="text-emerald-400 text-sm font-semibold">✓ Company Brain built successfully</p>
                <p className="text-white/30 text-xs mt-1">Jimmy now knows your full business history from day one</p>
              </div>
            )}

            <div className="flex gap-3">
              {!buildingBrain && !brainDone && (
                <button onClick={() => setCurrentStep(3)} className="px-6 py-3 rounded-xl text-white/40 hover:text-white border border-white/10 hover:border-white/20 transition text-sm">Back</button>
              )}
              {!brainDone && connectedIntegrations.length > 0 && (
                <button onClick={buildBrain} disabled={buildingBrain}
                  className="flex-1 bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 disabled:opacity-60 transition flex items-center justify-center gap-2">
                  {buildingBrain ? (<><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />Building...</>) : "Build Company Brain →"}
                </button>
              )}
              {(brainDone || connectedIntegrations.length === 0) && (
                <button onClick={() => setCurrentStep(5)} className="flex-1 bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition">Continue →</button>
              )}
            </div>
            {!buildingBrain && !brainDone && connectedIntegrations.length > 0 && (

            )}
          </div>
        )}

        {currentStep === 5 && (
          <div>
            <div className="text-center mb-8">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-3">You're ready</p>
              <h1 className="text-3xl font-bold mb-3 tracking-tight">Your AI COO is briefed.</h1>
              <p className="text-white/40 text-sm leading-relaxed">
                {brainDone ? "Jimmy has read your full history and is ready to give you real insights from day one." : "Ask anything about your business. Connect tools and build your brain anytime from Settings."}
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-8 space-y-2">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-4">Try asking</p>
              {["What's the most important thing I should focus on today?", "What does my financial position look like right now?", "Who are my most valuable customers and are any at risk?", "What deals or opportunities should I be pursuing?"].map((q, i) => (
                <div key={i} onClick={() => router.push(`/chat?q=${encodeURIComponent(q)}`)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition cursor-pointer group">
                  <span className="text-white/20 group-hover:text-white/40 transition text-xs">→</span>
                  <p className="text-white/50 text-sm group-hover:text-white/70 transition">{q}</p>
                </div>
              ))}
            </div>
            <button onClick={finish} className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition">Go to Dashboard →</button>
          </div>
        )}

      </div>
    </div>
  );
}
