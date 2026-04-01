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
  const [activeTab, setActiveTab] = useState<"brain" | "company" | "feed">("brain");
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  const [brain, setBrain] = useState({
    company_name: "",
    full_name: "",
    company_brief: "",
    company_brain: "",
    what_is_real: "",
    what_to_ignore: "",
    what_matters: "",
    where_data_lives: "",
  });

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
      const { data: profileData } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      const { data: profileData } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      if (settings) {
        setCompany({
          industry: settings.industry || "",
          full_name: profileData?.full_name || "",
          full_name: profileData?.full_name || "",
          full_name: settings.full_name || "",
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
    const { full_name, ...companyWithoutName } = company as any;
    await supabase.from("company_settings").upsert({ user_id: userId, ...companyWithoutName }, { onConflict: "user_id" });
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
          <p className="text-white/30 text-sm mt-1">Manage your AI COO's knowledge and preferences.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
          {[
            { id: "brain", label: "Company Brain" },
            { id: "company", label: "Company Info" },
            { id: "feed", label: "Live Feed" },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); if (tab.id === "feed") loadEvents(); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab.id ? "bg-white text-black" : "text-white/40 hover:text-white"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "brain" && (
          <div className="space-y-4">
            {/* Foundation */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-white mb-1">Foundation</h2>
              <p className="text-white/30 text-xs mb-5">The core identity of your business. Jimmy reads this on every analysis.</p>
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Company Name</label>
                  <input value={brain.company_name} onChange={e => setBrain({...brain, company_name: e.target.value})}
                    placeholder="Acme Corp" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Who you are & what you do</label>
                  <textarea value={brain.company_brief} onChange={e => setBrain({...brain, company_brief: e.target.value})}
                    rows={5} placeholder="Describe your business — what you sell, who you sell to, how you operate, key people, tools you use..."
                    className={textareaClass} />
                </div>
              </div>
            </div>

            {/* Living Context */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-sm font-semibold text-white">Living Context</h2>
                <span className="text-[10px] text-white/20 bg-white/5 border border-white/10 rounded-lg px-2 py-1">Auto-updated by Jimmy</span>
              </div>
              <p className="text-white/30 text-xs mb-5">What's happening right now — current projects, deals, priorities, recent changes. Jimmy also writes here automatically when it learns something new from your emails, files, and conversations.</p>
              <textarea value={brain.company_brain} onChange={e => setBrain({...brain, company_brain: e.target.value})}
                rows={10}
                placeholder="Current projects, deals, priorities, recent changes... Jimmy will also write here as it learns from your integrations."
                className={textareaClass} />
            </div>

            {/* Data Standards */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-white mb-1">Data Standards</h2>
              <p className="text-white/30 text-xs mb-5">Tell Jimmy what's real, what to ignore, and what to focus on. This prevents it from treating test data or old files as real business activity.</p>
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>What is real vs hypothetical</label>
                  <textarea value={brain.what_is_real} onChange={e => setBrain({...brain, what_is_real: e.target.value})}
                    rows={3} placeholder="e.g. Any Stripe transaction is real revenue. Sheets named 'model' or 'template' are hypothetical — not real business data."
                    className={textareaClass} />
                </div>
                <div>
                  <label className={labelClass}>What to ignore</label>
                  <textarea value={brain.what_to_ignore} onChange={e => setBrain({...brain, what_to_ignore: e.target.value})}
                    rows={3} placeholder="e.g. Ignore newsletters, noreply emails, promotional emails. Ignore spreadsheets not modified in 6 months."
                    className={textareaClass} />
                </div>
                <div>
                  <label className={labelClass}>What matters most</label>
                  <textarea value={brain.what_matters} onChange={e => setBrain({...brain, what_matters: e.target.value})}
                    rows={3} placeholder="e.g. Cash position is most important. Any client email about payment needs immediate attention."
                    className={textareaClass} />
                </div>
                <div>
                  <label className={labelClass}>Where data lives</label>
                  <textarea value={brain.where_data_lives} onChange={e => setBrain({...brain, where_data_lives: e.target.value})}
                    rows={3} placeholder="e.g. Gmail = client communication. QuickBooks = real invoices. Schwab spreadsheet = portfolio updated weekly."
                    className={textareaClass} />
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
          </div>
        )}
        {activeTab === "feed" && (
          <div>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-semibold text-white mb-1">Intelligence Feed</h2>
                  <p className="text-white/30 text-xs">Everything Jimmy has seen and processed since day one.</p>
                </div>
                <button onClick={() => { setEventsLoaded(false); loadEvents(); }}
                  className="text-[11px] text-white/30 hover:text-white/60 transition px-3 py-1.5 rounded-lg border border-white/[0.06] hover:border-white/10">
                  Refresh
                </button>
              </div>

              {eventsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/20 text-sm">No events yet</p>
                  <p className="text-white/10 text-xs mt-1">Events will appear here as Jimmy processes your integrations</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((event, i) => {
                    const sourceColors: Record<string, string> = {
                      Gmail: "text-red-400/70 bg-red-500/5 border-red-500/10",
                      Stripe: "text-purple-400/70 bg-purple-500/5 border-purple-500/10",
                      QuickBooks: "text-green-400/70 bg-green-500/5 border-green-500/10",
                      "Google Drive": "text-blue-400/70 bg-blue-500/5 border-blue-500/10",
                      "Google Sheets": "text-emerald-400/70 bg-emerald-500/5 border-emerald-500/10",
                      Microsoft: "text-blue-400/70 bg-blue-500/5 border-blue-500/10",
                      Outlook: "text-blue-400/70 bg-blue-500/5 border-blue-500/10",
                    };
                    const importanceColors: Record<string, string> = {
                      critical: "text-red-400 bg-red-500/10 border-red-500/20",
                      high: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                      medium: "text-white/40 bg-white/5 border-white/10",
                      low: "text-white/20 bg-white/[0.02] border-white/[0.05]",
                    };
                    const srcColor = sourceColors[event.source] || "text-white/30 bg-white/[0.02] border-white/[0.06]";
                    const impColor = importanceColors[event.importance] || importanceColors.medium;
                    const date = new Date(event.created_at);
                    const timeStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={event.id} className="border border-white/[0.05] rounded-xl p-4 hover:border-white/10 transition bg-white/[0.01]">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${srcColor}`}>{event.source}</span>
                            <span className="text-[11px] text-white/40 font-medium">{event.event_type}</span>
                            {event.action_required && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">Action Required</span>
                            )}
                            {event.dollar_amount && (
                              <span className="text-[10px] font-bold text-emerald-400">\${Number(event.dollar_amount).toLocaleString()}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${impColor}`}>{event.importance}</span>
                            <span className="text-[10px] text-white/15 whitespace-nowrap">{timeStr}</span>
                          </div>
                        </div>
                        {event.analysis && <p className="text-xs text-white/40 leading-relaxed mb-1">{event.analysis}</p>}
                        {event.recommended_action && <p className="text-[11px] text-white/25">→ {event.recommended_action}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
