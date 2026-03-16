"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function SettingsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"brain" | "company">("brain");

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

            {/* What it is */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <div className="flex items-start gap-3 mb-6">
                <div>
                  <h2 className="text-sm font-semibold text-white">Company Brain</h2>
                  <p className="text-white/30 text-xs mt-1">This is the foundation of your AI COO's intelligence. The more detail you provide, the more accurate and specific its insights become. Update this anytime — or tell the AI directly and it will update this automatically.</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Company Name</label>
                  <input value={brain.company_name} onChange={e => setBrain({...brain, company_name: e.target.value})}
                    placeholder="e.g. Acme Wholesale" className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Who you are & what you do</label>
                  <textarea value={brain.company_brief} onChange={e => setBrain({...brain, company_brief: e.target.value})}
                    rows={4} placeholder="e.g. I'm a sophomore at NYU Stern studying finance. I manage a personal investment portfolio through Schwab and Robinhood. I'm applying to scholarships and coordinating a basketball team. I'm also building BizAI, a B2B SaaS product."
                    className={textareaClass} />
                </div>

                <div>
                  <label className={labelClass}>Living context — what's happening now, new projects, recent changes</label>
                  <textarea value={brain.company_brain} onChange={e => setBrain({...brain, company_brain: e.target.value})}
                    rows={5} placeholder="e.g. Currently focused on closing 3 enterprise deals by end of Q1. Just hired a new sales rep starting April 1. Running a 20% discount promotion through March 31. Cash is tight — waiting on $45K in outstanding invoices."
                    className={textareaClass} />
                  <p className="text-white/15 text-xs mt-2">The AI also updates this automatically when it learns something new from your emails, meetings, or conversations.</p>
                </div>
              </div>
            </div>

            {/* Data standards */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-white mb-1">Data Standards</h2>
              <p className="text-white/30 text-xs mb-5">Tell the AI what's real, what to ignore, and what to focus on. This prevents it from treating old models or test data as real business activity.</p>

              <div className="space-y-5">
                <div>
                  <label className={labelClass}>What is real vs hypothetical</label>
                  <textarea value={brain.what_is_real} onChange={e => setBrain({...brain, what_is_real: e.target.value})}
                    rows={3} placeholder="e.g. Any Stripe transaction is real revenue. Google Sheets files named 'model', 'template', or 'class project' are hypothetical — do not treat as real business data. My basketball team apparel sheet was a class project from Fall 2024, not a real business."
                    className={textareaClass} />
                </div>

                <div>
                  <label className={labelClass}>What to ignore / treat as noise</label>
                  <textarea value={brain.what_to_ignore} onChange={e => setBrain({...brain, what_to_ignore: e.target.value})}
                    rows={3} placeholder="e.g. Ignore any emails from no-reply addresses. Ignore promotional emails and newsletters. Ignore any spreadsheets not modified in the last 6 months unless I specifically ask about them."
                    className={textareaClass} />
                </div>

                <div>
                  <label className={labelClass}>What matters most to this business</label>
                  <textarea value={brain.what_matters} onChange={e => setBrain({...brain, what_matters: e.target.value})}
                    rows={3} placeholder="e.g. Cash position is the most important metric. Scholarship deadlines are high priority. Any email from a client about payment or project status needs immediate attention. Portfolio performance matters but is long-term — don't flag daily swings."
                    className={textareaClass} />
                </div>

                <div>
                  <label className={labelClass}>Where data lives — what each platform is used for</label>
                  <textarea value={brain.where_data_lives} onChange={e => setBrain({...brain, where_data_lives: e.target.value})}
                    rows={3} placeholder="e.g. Gmail = all client communication and scholarship correspondence. Schwab spreadsheet = real portfolio holdings updated weekly. QuickBooks = real invoices and P&L. The 'business model v2' sheet is a class project, not real."
                    className={textareaClass} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={saveBrain} disabled={saving}
                className="bg-white text-black font-semibold px-6 py-2.5 rounded-xl hover:bg-white/90 disabled:opacity-50 transition text-sm">
                {saving ? "Saving..." : "Save Brain"}
              </button>
              {saved && <span className="text-emerald-400 text-sm">Saved</span>}
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
                {["E-commerce","SaaS / Software","Retail","Restaurant / Food","Healthcare","Construction","Real Estate","Marketing Agency","Consulting","Manufacturing","Transportation","Education","Finance","Other"].map(i => <option key={i} value={i}>{i}</option>)}
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
              {saved && <span className="text-emerald-400 text-sm">Saved</span>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
