"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowRight, Factory, Package, Mail, FileSpreadsheet, Check, Truck, BarChart3 } from "lucide-react";

export default function SettingsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"guide" | "company">("guide");
  const [sendingPinReset, setSendingPinReset] = useState(false);
  const [pinResetSent, setPinResetSent] = useState(false);

  const [company, setCompany] = useState({
    full_name: "",
    company_name: "",
    address: "",
    industry: "Wholesale",
    website: "",
    currency: "USD",
    fiscal_year_start: "January",
    timezone: "America/New_York",
  });

  useEffect(() => {
    loadCompany();
  }, []);

  async function loadCompany() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("company_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (data) {
      setCompany({
        full_name: data.full_name || "",
        company_name: data.company_name || "",
        address: data.address || "",
        industry: data.industry || "Wholesale",
        website: data.website || "",
        currency: data.currency || "USD",
        fiscal_year_start: data.fiscal_year_start || "January",
        timezone: data.timezone || "America/New_York",
      });
    }
  }

  async function saveCompany() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("company_profiles").upsert({ user_id: user.id, ...company });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function sendPinReset() {
    setSendingPinReset(true);
    await fetch("/api/admin/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_reset_email" }) });
    setSendingPinReset(false);
    setPinResetSent(true);
  }

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition text-sm";
  const labelClass = "block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-white/30 text-sm mt-1">Manage your sourcing intelligence and company settings.</p>
          </div>
          <a href="/onboarding" className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 text-sm transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            Onboarding Guide
          </a>
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
                <a href="/plm?tab=factory_access" className="block p-4 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:border-blue-500/30 hover:bg-blue-500/[0.03] transition">
                  <div className="flex items-center gap-2 mb-2">
                    <Factory size={16} className="text-blue-400" />
                    <h3 className="text-sm font-semibold text-white">Add Factories</h3>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">Add your factory contacts with name, email, and contact person. Create portal access so they can update progress.</p>
                </a>
                
                <a href="/plm" className="block p-4 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:border-amber-500/30 hover:bg-amber-500/[0.03] transition">
                  <div className="flex items-center gap-2 mb-2">
                    <Package size={16} className="text-amber-400" />
                    <h3 className="text-sm font-semibold text-white">Create Products</h3>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">Add products with SKUs, images, and specs. Group them into collections like "Spring 2026".</p>
                </a>
                
                <a href="/workflows/factory-quote" className="block p-4 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:border-purple-500/30 hover:bg-purple-500/[0.03] transition">
                  <div className="flex items-center gap-2 mb-2">
                    <FileSpreadsheet size={16} className="text-purple-400" />
                    <h3 className="text-sm font-semibold text-white">Request & Compare Quotes</h3>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">Send RFQs to multiple factories, upload their Excel quotes, compare landed costs side-by-side.</p>
                </a>
                
                <a href="/plm" className="block p-4 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] transition">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck size={16} className="text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">Track Samples</h3>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">Track samples through production → shipped → arrived. Approve and generate POs with one click.</p>
                </a>
                
                <a href="/chat" className="block p-4 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:border-amber-500/30 hover:bg-amber-500/[0.03] transition">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail size={16} className="text-amber-400" />
                    <h3 className="text-sm font-semibold text-white">Drop Documents</h3>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">Drop any factory email, quote, or PO into chat. Jimmy extracts data and files it automatically.</p>
                </a>
                
                <a href="/plm/agent" className="block p-4 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:border-blue-500/30 hover:bg-blue-500/[0.03] transition">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 size={16} className="text-blue-400" />
                    <h3 className="text-sm font-semibold text-white">PLM Agent</h3>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">Ask Jimmy anything about your products, samples, or factories. Get instant answers from your data.</p>
                </a>
              </div>
            </div>
            
            <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01]">
              <h3 className="text-sm font-semibold text-white mb-3">Pro Tips</h3>
              <ul className="space-y-2 text-xs text-white/40">
                <li>• <strong className="text-white/60">Bulk import:</strong> Go to any collection → Import from Excel. Jimmy extracts product names, SKUs, specs, and even images.</li>
                <li>• <strong className="text-white/60">AI Document Drop:</strong> Drop any factory email, quote, or PO into chat. Jimmy figures out what it is and files it automatically.</li>
                <li>• <strong className="text-white/60">Collection view:</strong> Open a collection to see all factories as columns and all stages as rows — like your spreadsheet but live.</li>
                <li>• <strong className="text-white/60">Disqualify factories:</strong> When a factory is too slow or expensive, click Disqualify. Jimmy sends them a professional email and removes them from the product.</li>
                <li>• <strong className="text-white/60">PIN protection:</strong> Sensitive actions (kill product, approve sample) require your admin PIN.</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "company" && (
          <div className="space-y-6">
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
                  {["Wholesale","E-commerce","Retail","Manufacturing","Import/Export","Home Goods","Kitchenware","Apparel","Gifts & Decor","Other"].map(i => <option key={i} value={i}>{i}</option>)}
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
                    {["USD","CAD","EUR","GBP","AUD","CNY"].map(c => <option key={c} value={c}>{c}</option>)}
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
                    {["America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Europe/London","Asia/Shanghai","Asia/Tokyo"].map(tz => <option key={tz} value={tz}>{tz}</option>)}
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

            {/* Admin PIN */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-white mb-1">Admin PIN</h2>
              <p className="text-white/30 text-xs mb-4">Your PIN protects sensitive actions. It can never be revealed — reset it via email if forgotten.</p>
              <button onClick={sendPinReset} disabled={sendingPinReset || pinResetSent}
                className="text-sm text-white/50 hover:text-white underline underline-offset-2 transition disabled:opacity-50">
                {pinResetSent ? "Reset email sent ✓" : sendingPinReset ? "Sending..." : "Forgot PIN — Send Reset Email"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
