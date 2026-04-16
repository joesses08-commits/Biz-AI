"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

function SnapshotViewer() {
  const [snapshot, setSnapshot] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("context_cache").select("context, cached_at").eq("user_id", user.id).maybeSingle();
      setSnapshot(data?.context || "No snapshot yet — build your brain first.");
      setLoading(false);
    }
    load();
  }, []);
  if (loading) return <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />;
  return (
    <div className="bg-black/20 rounded-xl p-4 font-mono text-[11px] text-white/50 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
      {snapshot}
    </div>
  );
}

export default function SettingsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [saving, setSaving] = useState(false);
  const [sendingPinReset, setSendingPinReset] = useState(false);
  const [pinResetSent, setPinResetSent] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"guide" | "company">("guide");
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [showBrainModal, setShowBrainModal] = useState(false);
  const [brainBuilt, setBrainBuilt] = useState(false);
  const [buildingBrain, setBuildingBrain] = useState(false);
  const [brainPin, setBrainPin] = useState("");
  const [brainPinError, setBrainPinError] = useState("");
  const [productCount, setProductCount] = useState(0);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [quickbooksConnected, setQuickbooksConnected] = useState(false);
  const [checkNoStripe, setCheckNoStripe] = useState(false);
  const [checkNoQB, setCheckNoQB] = useState(false);
  const [checkPLM, setCheckPLM] = useState(false);
  const [brainProgress, setBrainProgress] = useState("");
  const [brainDone, setBrainDone] = useState(false);

  const [brain, setBrain] = useState({
    company_name: "",
    company_brief: "",
    company_brain: "",
    what_is_real: "",
    what_to_ignore: "",
    what_matters: "",
    where_data_lives: "",
  });

  async function checkBrainStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [gmailRes, msRes, stripeRes, qbRes, profileRes, plmRes] = await Promise.all([
      supabase.from("gmail_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("microsoft_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("stripe_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("quickbooks_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("company_profiles").select("brain_built").eq("user_id", user.id).maybeSingle(),
      supabase.from("plm_products").select("id", { count: "exact" }).eq("user_id", user.id).eq("killed", false),
    ]);
    setGoogleConnected(!!gmailRes.data);
    setMicrosoftConnected(!!msRes.data);
    setStripeConnected(!!stripeRes.data);
    setQuickbooksConnected(!!qbRes.data);
    setBrainBuilt(!!profileRes.data?.brain_built);
    setProductCount(plmRes.count || 0);
  }

  const loadEvents = async () => {
    if (eventsLoaded) return;
    setEventsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("company_events")
      .select("id, source, event_type, analysis, importance, action_required, recommended_action, dollar_amount, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setEvents(data || []);
    setEventsLoading(false);
    setEventsLoaded(true);
  };

  const [company, setCompany] = useState({
    industry: "",
    full_name: "",
    company_name: "",
    address: "",
    website: "",
    currency: "USD",
    fiscal_year_start: "January",
    timezone: "America/New_York",
  });

  useEffect(() => { checkBrainStatus(); }, []);

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
      const { data: profileData } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      if (settings) {
        setCompany({
          industry: settings.industry || "",
          full_name: profileData?.full_name || "",
          company_name: data?.company_name || "",
          address: settings.address || "",
          website: settings.website || "",
          currency: settings.currency || "USD",
          fiscal_year_start: settings.fiscal_year_start || "January",
          timezone: settings.timezone || "America/New_York",
        });
      }
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
    const { full_name, company_name, ...companyRest } = company as any;
    await supabase.from("company_settings").upsert({ user_id: userId, ...companyRest }, { onConflict: "user_id" });
    if (company_name) await supabase.from("company_profiles").update({ company_name }).eq("user_id", userId);
    if (full_name) await supabase.from("profiles").update({ full_name }).eq("id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition text-sm";
  const labelClass = "block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2";
  const textareaClass = `${inputClass} resize-none leading-relaxed`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-white/30 text-sm mt-1">Manage your sourcing intelligence and company settings.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
          {[
            { id: "guide", label: "Quick Start" },
            { id: "company", label: "Company Info" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab.id ? "bg-white text-black" : "text-white/40 hover:text-white"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "guide" && (
          <div className="space-y-6">
            <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01]">
              <h2 className="text-lg font-bold text-white mb-2">Welcome to Jimmy</h2>
              <p className="text-white/40 text-sm mb-6">Your sourcing command center. Here's what you can do:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: "Add Factories",
                    description: "Add your factory contacts with name, email, and contact person. These become your quoting partners.",
                    link: "/plm?tab=factories",
                    color: "blue",
                  },
                  {
                    title: "Create Products & Collections",
                    description: "Add products with SKUs, images, and specs. Group them into collections like 'Spring 2026' or 'Target Holiday'.",
                    link: "/plm",
                    color: "amber",
                  },
                  {
                    title: "Request Quotes (RFQ)",
                    description: "Select products, pick factories, click send. Jimmy emails your RFQ to every factory with your product list attached.",
                    link: "/plm",
                    color: "purple",
                  },
                  {
                    title: "Drop Factory Quotes",
                    description: "When factories reply with Excel quotes, drop the file in chat. Jimmy extracts all pricing and wires it to the right products.",
                    link: "/chat",
                    color: "emerald",
                  },
                  {
                    title: "Request Samples",
                    description: "Select products and factories, click request. Jimmy emails each factory and tracks every sample through production → shipped → arrived.",
                    link: "/plm",
                    color: "amber",
                  },
                  {
                    title: "Factory Portal",
                    description: "Factories log into their own portal to update sample status. You see progress in real-time without chasing emails.",
                    link: "/plm?tab=factories",
                    color: "blue",
                  },
                  {
                    title: "Approve & Generate PO",
                    description: "When samples arrive, approve or request revision. Approved? Generate a PO with one click — Jimmy calculates landed cost and emails the factory.",
                    link: "/plm",
                    color: "emerald",
                  },
                  {
                    title: "Compare Quotes",
                    description: "Go to Workflows → Factory Quote to see all quotes side-by-side with landed cost calculated. Yellow = best price.",
                    link: "/workflows/factory-quote",
                    color: "purple",
                  },
                ].map((feature, i) => (
                  <a key={i} href={feature.link} 
                    className={`block p-4 rounded-xl border transition hover:border-${feature.color}-500/30 border-white/[0.06] bg-white/[0.01] hover:bg-${feature.color}-500/[0.03]`}>
                    <h3 className={`text-sm font-semibold text-${feature.color}-400 mb-1`}>{feature.title}</h3>
                    <p className="text-xs text-white/40 leading-relaxed">{feature.description}</p>
                  </a>
                ))}
              </div>
            </div>
            
            <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01]">
              <h3 className="text-sm font-semibold text-white mb-3">Pro Tips</h3>
              <ul className="space-y-2 text-xs text-white/40">
                <li>• <strong className="text-white/60">Bulk import:</strong> Go to any collection → Import from Excel. Jimmy extracts product names, SKUs, specs, and even images.</li>
                <li>• <strong className="text-white/60">AI Document Drop:</strong> Drop any factory email, quote, or PO into chat. Jimmy figures out what it is and files it automatically.</li>
                <li>• <strong className="text-white/60">Collection view:</strong> Open a collection to see all factories as columns and all stages as rows — like your spreadsheet but live.</li>
                <li>• <strong className="text-white/60">Disqualify factories:</strong> When a factory is too slow or expensive, click Disqualify. Jimmy sends them a professional email and removes them from the product.</li>
                <li>• <strong className="text-white/60">PIN protection:</strong> Sensitive actions (kill product, approve sample, build brain) require your admin PIN.</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "company" && (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-white mb-4">Company Information</h2>
            <div>
              <label className={labelClass}>Your Name</label>
              <input value={company.full_name} onChange={e => setCompany({...company, full_name: e.target.value})}
                placeholder="Joey Esses" className={inputClass} />
              <p className="text-[10px] text-white/20 mt-1">Used to sign emails sent from Jimmy on your behalf</p>
            </div>
            <div>
              <label className={labelClass}>Company Name</label>
              <input value={company.company_name} onChange={e => setCompany({...company, company_name: e.target.value})}
                placeholder="Acme Wholesale Co." className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Company Address</label>
              <input value={company.address} onChange={e => setCompany({...company, address: e.target.value})}
                placeholder="123 Main St, Brooklyn NY 11201" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Industry</label>
              <select value={company.industry} onChange={e => setCompany({...company, industry: e.target.value})} className={inputClass}>
                <option value="">Select industry</option>
                {["E-commerce","SaaS / Software","Retail","Restaurant / Food","Healthcare","Construction","Real Estate","Marketing Agency","Consulting","Manufacturing","Transportation","Wholesale","Education","Finance","Other"].map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Website</label>
              <input value={company.website} onChange={e => setCompany({...company, website: e.target.value})}
                placeholder="https://yourcompany.com" className={inputClass} />
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

            <div className="border-t border-white/[0.06] pt-5">
              <p className="text-sm font-semibold text-white mb-1">Admin PIN</p>
              <p className="text-xs text-white/30 mb-3">Your PIN protects sensitive actions. It can never be revealed — reset it via email if forgotten.</p>
              {pinResetSent ? (
                <p className="text-emerald-400 text-sm">✓ Reset link sent to your email</p>
              ) : (
                <button onClick={async () => {
                  setSendingPinReset(true);
                  await fetch("/api/admin/pin", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "forgot_pin" }) });
                  setSendingPinReset(false);
                  setPinResetSent(true);
                }} disabled={sendingPinReset}
                  className="text-sm text-white/40 hover:text-white/70 border border-white/[0.08] px-4 py-2 rounded-xl transition disabled:opacity-40">
                  {sendingPinReset ? "Sending..." : "Forgot PIN — Send Reset Email"}
                </button>
              )}
            </div>
          </div>
        )}
        {/* Build Brain Modal */}
      {showBrainModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#111] border border-white/[0.08] rounded-2xl p-8 max-w-lg w-full">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>
              </div>
              <h2 className="text-base font-bold text-white">Build Company Brain</h2>
            </div>
            <p className="text-white/40 text-xs mb-6 leading-relaxed">Jimmy will read your last 1,000 emails, 15 files, all invoices and payments, and your entire PLM to build your initial intelligence snapshot. This can only be done once.</p>

            <div className="space-y-3 mb-6">
              {/* Google or Microsoft - auto checked */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border transition ${googleConnected || microsoftConnected ? "border-emerald-500/20 bg-emerald-500/[0.03] cursor-default" : "border-red-500/20 bg-red-500/[0.03] cursor-not-allowed"}`}>
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border ${googleConnected || microsoftConnected ? "bg-emerald-500 border-emerald-500" : "bg-transparent border-white/20"}`}>
                  {(googleConnected || microsoftConnected) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div>
                  <p className={`text-xs font-semibold ${googleConnected || microsoftConnected ? "text-emerald-400" : "text-red-400"}`}>
                    {googleConnected || microsoftConnected ? "✓ Email connected" : "✗ Connect Google Workspace or Microsoft 365 first"}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">{googleConnected ? "Google Workspace" : ""}{googleConnected && microsoftConnected ? " + " : ""}{microsoftConnected ? "Microsoft 365" : ""}{!googleConnected && !microsoftConnected ? "Required — go to Integrations" : ""}</p>
                </div>
              </label>

              {/* PLM - auto checked based on count */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border transition ${productCount > 0 ? (checkPLM ? "border-emerald-500/20 bg-emerald-500/[0.03] cursor-pointer" : "border-white/[0.06] bg-white/[0.01] cursor-pointer") : "border-red-500/20 bg-red-500/[0.03] cursor-not-allowed"}`}
                onClick={() => productCount > 0 && setCheckPLM(!checkPLM)}>
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border ${checkPLM && productCount > 0 ? "bg-emerald-500 border-emerald-500" : "bg-transparent border-white/20"}`}>
                  {checkPLM && productCount > 0 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div>
                  <p className={`text-xs font-semibold ${productCount === 0 ? "text-red-400" : checkPLM ? "text-emerald-400" : "text-white/70"}`}>
                    PLM ({productCount} products) is up to date
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">{productCount === 0 ? "Add products in Product Lifecycle first" : "Check this to confirm all products are at their current stage"}</p>
                </div>
              </label>

              {/* Stripe */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.01] cursor-pointer hover:border-white/10 transition"
                onClick={() => !stripeConnected && setCheckNoStripe(!checkNoStripe)}>
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border ${stripeConnected || checkNoStripe ? "bg-emerald-500 border-emerald-500" : "bg-transparent border-white/20"}`}>
                  {(stripeConnected || checkNoStripe) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div>
                  <p className={`text-xs font-semibold ${stripeConnected || checkNoStripe ? "text-emerald-400" : "text-white/70"}`}>
                    {stripeConnected ? "✓ Stripe connected" : checkNoStripe ? "✓ I don't use Stripe" : "Stripe connected or I don't use it"}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">{stripeConnected ? "Will read last 100 charges" : "Check if you don't use Stripe"}</p>
                </div>
              </label>

              {/* QuickBooks */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.01] cursor-pointer hover:border-white/10 transition"
                onClick={() => !quickbooksConnected && setCheckNoQB(!checkNoQB)}>
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border ${quickbooksConnected || checkNoQB ? "bg-emerald-500 border-emerald-500" : "bg-transparent border-white/20"}`}>
                  {(quickbooksConnected || checkNoQB) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div>
                  <p className={`text-xs font-semibold ${quickbooksConnected || checkNoQB ? "text-emerald-400" : "text-white/70"}`}>
                    {quickbooksConnected ? "✓ QuickBooks connected" : checkNoQB ? "✓ I don't use QuickBooks" : "QuickBooks connected or I don't use it"}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">{quickbooksConnected ? "Will read last 100 invoices and customers" : "Check if you don't use QuickBooks"}</p>
                </div>
              </label>

              {/* Company brief */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border transition ${(brain.company_brief?.length || 0) >= 400 ? "border-emerald-500/20 bg-emerald-500/[0.03] cursor-default" : "border-red-500/20 bg-red-500/[0.03] cursor-not-allowed"}`}>
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border ${(brain.company_brief?.length || 0) >= 400 ? "bg-emerald-500 border-emerald-500" : "bg-transparent border-white/20"}`}>
                  {(brain.company_brief?.length || 0) >= 400 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div>
                  <p className={`text-xs font-semibold ${(brain.company_brief?.length || 0) >= 400 ? "text-emerald-400" : "text-red-400"}`}>
                    Company brief {brain.company_brief?.length || 0}/800 characters {(brain.company_brief?.length || 0) >= 400 ? "✓" : "(minimum 400)"}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">{(brain.company_brief?.length || 0) < 400 ? "Add more detail in Company Brain below first" : "Good — Jimmy knows your business context"}</p>
                </div>
              </label>
            </div>

            {/* PIN entry */}
            <div className="mb-6">
              <label className="text-[10px] text-white/30 uppercase tracking-widest mb-2 block">Enter Admin PIN to confirm</label>
              <input type="password" value={brainPin} onChange={e => setBrainPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="••••" maxLength={8}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-center text-xl tracking-widest outline-none focus:border-white/20 transition" />
              {brainPinError && <p className="text-red-400 text-xs mt-1.5">{brainPinError}</p>}
            </div>

            {brainProgress && (
              <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin flex-shrink-0" />
                  <p className="text-xs text-white/50">{brainProgress}</p>
                </div>
              </div>
            )}

            {brainDone && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                <p className="text-emerald-400 text-sm font-semibold">✓ Company Brain built successfully</p>
                <p className="text-white/30 text-xs mt-1">Jimmy now knows your full business history</p>
              </div>
            )}

            <div className="flex gap-3">
              {!buildingBrain && !brainDone && (
                <button onClick={() => { setShowBrainModal(false); setBrainPin(""); setBrainPinError(""); }}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-white/40 hover:text-white text-xs transition">
                  Cancel
                </button>
              )}
              {brainDone ? (
                <button onClick={() => { setShowBrainModal(false); setBrainDone(false); setBrainProgress(""); }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-400 transition">
                  Done →
                </button>
              ) : (
                <button
                  disabled={
                    buildingBrain ||
                    !(googleConnected || microsoftConnected) ||
                    !checkPLM ||
                    !(stripeConnected || checkNoStripe) ||
                    !(quickbooksConnected || checkNoQB) ||
                    (brain.company_brief?.length || 0) < 400 ||
                    brainPin.length < 4
                  }
                  onClick={async () => {
                    setBrainPinError("");
                    setBuildingBrain(true);
                    // Verify PIN
                    const pinRes = await fetch("/api/admin/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify_pin", pin: brainPin }) });
                    const pinData = await pinRes.json();
                    if (!pinData.success) { setBrainPinError("Incorrect PIN"); setBuildingBrain(false); return; }

                    // Run brain build
                    const sources = [];
                    if (googleConnected) { sources.push("gmail"); sources.push("google_drive"); }
                    if (microsoftConnected) sources.push("microsoft");
                    if (stripeConnected) sources.push("stripe");
                    if (quickbooksConnected) sources.push("quickbooks");
                    sources.push("plm");

                    for (const source of sources) {
                      setBrainProgress(`Reading ${source === "gmail" ? "Gmail" : source === "google_drive" ? "Google Drive" : source === "microsoft" ? "Microsoft 365" : source === "stripe" ? "Stripe" : source === "quickbooks" ? "QuickBooks" : "Product Lifecycle"}...`);
                      try {
                        await fetch("/api/brain/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }) });
                      } catch { continue; }
                    }

                    setBrainProgress("Composing your initial snapshot...");
                    await fetch("/api/brain/backfill/finalize", { method: "POST", headers: { "Content-Type": "application/json" } });

                    // Mark brain as built
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) await supabase.from("company_profiles").update({ brain_built: true }).eq("user_id", user.id);

                    setBrainBuilt(true);
                    setBuildingBrain(false);
                    setBrainProgress("");
                    setBrainDone(true);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
                  {buildingBrain ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Building...</> : "Build Company Brain →"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
