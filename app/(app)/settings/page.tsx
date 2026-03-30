"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

const BRAIN_SOURCES = [
  { source: "gmail", label: "Gmail", sublabel: "Last 12 months — inbox & sent", integration: "gmail" },
  { source: "google_drive", label: "Google Drive", sublabel: "Sheets, Docs, Slides", integration: "gmail" },
  { source: "microsoft", label: "Microsoft 365", sublabel: "Outlook + OneDrive", integration: "microsoft" },
  { source: "quickbooks", label: "QuickBooks", sublabel: "Invoices & customers", integration: "quickbooks" },
  { source: "stripe", label: "Stripe", sublabel: "Charges & subscriptions", integration: "stripe" },
];

export default function SettingsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"brain" | "company" | "rebuild">("brain");
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([]);
  const [rebuildProgress, setRebuildProgress] = useState<{source: string; label: string; sublabel: string; status: "pending" | "processing" | "done" | "skipped"; items?: number}[]>([]);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildDone, setRebuildDone] = useState(false);

  const [brain, setBrain] = useState({
    company_name: "",
    company_brief: "",
    company_brain: "",
    what_is_real: "",
    what_to_ignore: "",
    what_matters: "",
    where_data_lives: "",
  });

  const [company, setCompany] = useState({
    industry: "",
    website: "",
    currency: "USD",
    fiscal_year_start: "January",
    timezone: "America/New_York",
  });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase.from("company_profiles").select("*").eq("user_id", user.id).single();
      if (data) {
        setBrain({
          company_name: data.company_name || "",
          company_brief: data.company_brief || "",
          company_brain: data.company_brain || "",
          what_is_real: data.what_is_real || "",
          what_to_ignore: data.what_to_ignore || "",
          what_matters: data.what_matters || "",
          where_data_lives: data.where_data_lives || "",
        });
      }

      const { data: settings } = await supabase.from("company_settings").select("*").eq("user_id", user.id).single();
      if (settings) {
        setCompany({
          industry: settings.industry || "",
          website: settings.website || "",
          currency: settings.currency || "USD",
          fiscal_year_start: settings.fiscal_year_start || "January",
          timezone: settings.timezone || "America/New_York",
        });
      }

      // Check connected integrations
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
    };
    load();
  }, []);

  const saveBrain = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from("company_profiles").upsert({ user_id: userId, ...brain, updated_at: new Date().toISOString() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const saveCompany = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from("company_settings").upsert({ user_id: userId, ...company }, { onConflict: "user_id" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const rebuildBrain = async () => {
    setRebuilding(true);
    setRebuildDone(false);

    const activeSources = BRAIN_SOURCES.filter(s => connectedIntegrations.includes(s.integration));
    if (!activeSources.length) { setRebuilding(false); return; }

    setRebuildProgress(activeSources.map(s => ({ ...s, status: "pending" })));

    for (let i = 0; i < activeSources.length; i++) {
      setRebuildProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: "processing" } : p));
      try {
        const res = await fetch("/api/brain/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: activeSources[i].source }),
        });
        const data = await res.json();
        setRebuildProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: "done", items: data.itemsProcessed } : p));
      } catch {
        setRebuildProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: "skipped" } : p));
      }
    }

    // Reload brain from DB
    const { data } = await supabase.from("company_profiles").select("company_brain").eq("user_id", userId!).single();
    if (data) setBrain(prev => ({ ...prev, company_brain: data.company_brain || "" }));

    setRebuildDone(true);
    setRebuilding(false);
  };

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition text-sm";
  const labelClass = "block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2";
  const textareaClass = `${inputClass} resize-none leading-relaxed`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-white/30 text-sm mt-1">Manage your AI COO's knowledge and preferences.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
          {[
            { id: "brain", label: "Company Brain" },
            { id: "rebuild", label: "Rebuild Brain" },
            { id: "company", label: "Company Info" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab.id ? "bg-white text-black" : "text-white/40 hover:text-white"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "brain" && (
          <div className="space-y-4">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-white mb-1">Company Brain</h2>
              <p className="text-white/30 text-xs mb-5">This is the foundation of your AI COO's intelligence. Update anytime — or tell the AI directly and it will update automatically.</p>
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Company Name</label>
                  <input value={brain.company_name} onChange={e => setBrain({...brain, company_name: e.target.value})} placeholder="Acme Wholesale" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Who you are & what you do</label>
                  <textarea value={brain.company_brief} onChange={e => setBrain({...brain, company_brief: e.target.value})} rows={4} placeholder="Describe your business..." className={textareaClass} />
                </div>
                <div>
                  <label className={labelClass}>Living context — what's happening now</label>
                  <textarea value={brain.company_brain} onChange={e => setBrain({...brain, company_brain: e.target.value})} rows={8}
                    placeholder="Current projects, deals, priorities, recent changes... This is also where Jimmy writes what it learns from your integrations."
                    className={textareaClass} />
                  <p className="text-white/15 text-xs mt-2">Jimmy also updates this automatically when it learns something new from your data.</p>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-white mb-1">Data Standards</h2>
              <p className="text-white/30 text-xs mb-5">Tell Jimmy what's real, what to ignore, and what to focus on.</p>
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>What is real vs hypothetical</label>
                  <textarea value={brain.what_is_real} onChange={e => setBrain({...brain, what_is_real: e.target.value})} rows={3} placeholder="e.g. Any Stripe transaction is real revenue. Sheets named 'model' or 'template' are hypothetical." className={textareaClass} />
                </div>
                <div>
                  <label className={labelClass}>What to ignore</label>
                  <textarea value={brain.what_to_ignore} onChange={e => setBrain({...brain, what_to_ignore: e.target.value})} rows={3} placeholder="e.g. Ignore newsletters, noreply emails, promotional emails." className={textareaClass} />
                </div>
                <div>
                  <label className={labelClass}>What matters most</label>
                  <textarea value={brain.what_matters} onChange={e => setBrain({...brain, what_matters: e.target.value})} rows={3} placeholder="e.g. Cash position is most important. Any client email about payment needs immediate attention." className={textareaClass} />
                </div>
                <div>
                  <label className={labelClass}>Where data lives</label>
                  <textarea value={brain.where_data_lives} onChange={e => setBrain({...brain, where_data_lives: e.target.value})} rows={3} placeholder="e.g. Gmail = client communication. QuickBooks = real invoices. Schwab spreadsheet = portfolio updated weekly." className={textareaClass} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={saveBrain} disabled={saving}
                className="bg-white text-black font-semibold px-6 py-2.5 rounded-xl hover:bg-white/90 disabled:opacity-50 transition text-sm">
                {saving ? "Saving..." : "Save Brain"}
              </button>
              {saved && <span className="text-emerald-400 text-sm">Saved ✓</span>}
            </div>
          </div>
        )}

        {activeTab === "rebuild" && (
          <div className="space-y-4">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-white mb-1">Rebuild Company Brain</h2>
              <p className="text-white/30 text-xs mb-5">Re-read your full history from all connected integrations and rebuild the brain from scratch. Use this if you connected new tools or feel the brain is missing context.</p>

              {connectedIntegrations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/30 text-sm">No integrations connected yet.</p>
                  <a href="/integrations" className="text-white/50 text-xs underline mt-2 block">Connect tools →</a>
                </div>
              ) : (
                <>
                  {!rebuilding && !rebuildDone && (
                    <div className="space-y-3 mb-6">
                      {BRAIN_SOURCES.filter(s => connectedIntegrations.includes(s.integration)).map((s, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/30 mt-2 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-white/70 font-medium">{s.label}</p>
                            <p className="text-xs text-white/30">{s.sublabel}</p>
                          </div>
                        </div>
                      ))}
                      <div className="pt-3 border-t border-white/[0.06]">
                        <p className="text-white/20 text-xs">Takes 1-3 minutes. New brain sections will be appended to your existing brain.</p>
                      </div>
                    </div>
                  )}

                  {(rebuilding || rebuildDone) && rebuildProgress.length > 0 && (
                    <div className="space-y-3 mb-6">
                      {rebuildProgress.map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border transition-all ${
                            item.status === "done" ? "bg-emerald-500/20 border-emerald-500/30" :
                            item.status === "processing" ? "bg-white/10 border-white/30" :
                            "bg-white/5 border-white/10"
                          }`}>
                            {item.status === "done" && <span className="text-emerald-400 text-xs">✓</span>}
                            {item.status === "processing" && <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {item.status === "pending" && <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                            {item.status === "skipped" && <span className="text-white/20 text-xs">—</span>}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium transition ${item.status === "done" ? "text-white/70" : item.status === "processing" ? "text-white" : "text-white/30"}`}>
                              {item.label}
                            </p>
                            <p className="text-xs text-white/25">
                              {item.status === "done" && item.items !== undefined ? `${item.items} items analyzed` :
                               item.status === "processing" ? "Analyzing your history..." :
                               item.sublabel}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {rebuildDone && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 mb-4 text-center">
                      <p className="text-emerald-400 text-sm font-semibold">✓ Brain rebuilt successfully</p>
                      <p className="text-white/30 text-xs mt-0.5">Switch to the Company Brain tab to see what was added</p>
                    </div>
                  )}

                  {!rebuildDone && (
                    <button onClick={rebuildBrain} disabled={rebuilding}
                      className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 disabled:opacity-60 transition flex items-center justify-center gap-2">
                      {rebuilding ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                          Rebuilding...
                        </>
                      ) : "Rebuild Company Brain"}
                    </button>
                  )}

                  {rebuildDone && (
                    <button onClick={() => { setRebuildDone(false); setRebuildProgress([]); }}
                      className="w-full border border-white/10 text-white/40 hover:text-white font-medium py-3 rounded-xl hover:border-white/20 transition text-sm">
                      Run Again
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === "company" && (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-white mb-4">Company Information</h2>
            <div>
              <label className={labelClass}>Industry</label>
              <select value={company.industry} onChange={e => setCompany({...company, industry: e.target.value})} className={inputClass}>
                <option value="">Select industry</option>
                {["E-commerce","SaaS / Software","Retail","Restaurant / Food","Healthcare","Construction","Real Estate","Marketing Agency","Consulting","Manufacturing","Transportation","Wholesale","Education","Finance","Other"].map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Website</label>
              <input value={company.website} onChange={e => setCompany({...company, website: e.target.value})} placeholder="https://yourcompany.com" className={inputClass} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Currency</label>
                <select value={company.currency} onChange={e => setCompany({...company, currency: e.target.value})} className={inputClass}>
                  {["USD","CAD","EUR","GBP","AUD"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Fiscal Year Start</label>
                <select value={company.fiscal_year_start} onChange={e => setCompany({...company, fiscal_year_start: e.target.value})} className={inputClass}>
                  {["January","February","March","April","May","June","July","August","September","October","November","December"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Timezone</label>
                <select value={company.timezone} onChange={e => setCompany({...company, timezone: e.target.value})} className={inputClass}>
                  {["America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Europe/London","Europe/Paris","Asia/Tokyo"].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4 pt-2">
              <button onClick={saveCompany} disabled={saving}
                className="bg-white text-black font-semibold px-6 py-2.5 rounded-xl hover:bg-white/90 disabled:opacity-50 transition text-sm">
                {saving ? "Saving..." : "Save"}
              </button>
              {saved && <span className="text-emerald-400 text-sm">Saved ✓</span>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
