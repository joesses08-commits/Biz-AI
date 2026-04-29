"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowRight, Factory, Package, Mail, FileSpreadsheet, Check, Truck, BarChart3, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function SettingsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"guide" | "company" | "appearance">("guide");
  const [sendingPinReset, setSendingPinReset] = useState(false);
  const [pinResetSent, setPinResetSent] = useState(false);

  const [userEmail, setUserEmail] = useState("");
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
    setUserEmail(user.email || "");
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
    const { data: existing } = await supabase.from("company_profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (existing) {
      await supabase.from("company_profiles").update({ ...company }).eq("user_id", user.id);
    } else {
      await supabase.from("company_profiles").insert({ user_id: user.id, ...company });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function sendPinReset() {
    setSendingPinReset(true);
    await fetch("/api/admin/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "forgot_pin" }) });
    setSendingPinReset(false);
    setPinResetSent(true);
  }

  const inputClass = "w-full bg-[var(--bg-elevated)] border border-[var(--bg-border)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#4f6ef740] transition text-sm";
  const labelClass = "block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2";

  return (
    <div className="min-h-screen p-8" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Manage your sourcing intelligence and company settings.</p>
          </div>
          <a href="/onboarding" className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition"
            style={{ borderColor: "var(--bg-border)", color: "var(--text-secondary)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            Onboarding Guide
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 rounded-xl p-1 w-fit border" style={{ background: "var(--bg-elevated)", borderColor: "var(--bg-border)" }}>
          {[
            { id: "guide", label: "Quick Start" },
            { id: "company", label: "Company Info" },
            { id: "appearance", label: "Appearance" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition"
              style={activeTab === tab.id
                ? { background: "var(--text-primary)", color: "var(--bg-base)" }
                : { color: "var(--text-muted)" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "guide" && (
          <div className="space-y-6">
            <div className="border rounded-2xl p-6" style={{ borderColor: "var(--bg-border)", background: "var(--bg-surface)" }}>
              <h2 className="text-lg font-bold mb-2">Welcome to Jimmy</h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Your sourcing command center. Here's what you can do:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { href: "/plm?tab=factory_access", icon: <Factory size={16} className="text-blue-400" />, title: "Add Factories", desc: "Add your factory contacts with name, email, and contact person. Create portal access so they can update progress." },
                  { href: "/plm", icon: <Package size={16} className="text-amber-400" />, title: "Create Products", desc: "Add products with SKUs, images, and specs. Group them into collections like "Spring 2026"." },
                  { href: "/workflows/factory-quote", icon: <FileSpreadsheet size={16} className="text-purple-400" />, title: "Request & Compare Quotes", desc: "Send RFQs to multiple factories, upload their Excel quotes, compare landed costs side-by-side." },
                  { href: "/plm", icon: <Truck size={16} className="text-emerald-400" />, title: "Track Samples", desc: "Track samples through production → shipped → arrived. Approve and generate POs with one click." },
                  { href: "/chat", icon: <Mail size={16} className="text-amber-400" />, title: "Drop Documents", desc: "Drop any factory email, quote, or PO into chat. Jimmy extracts data and files it automatically." },
                  { href: "/plm/agent", icon: <BarChart3 size={16} className="text-blue-400" />, title: "PLM Agent", desc: "Ask Jimmy anything about your products, samples, or factories. Get instant answers from your data." },
                ].map(item => (
                  <a key={item.title} href={item.href} className="block p-4 rounded-xl border transition"
                    style={{ borderColor: "var(--bg-border)", background: "var(--bg-elevated)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      {item.icon}
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                  </a>
                ))}
              </div>
            </div>
            
            <div className="border rounded-2xl p-6" style={{ borderColor: "var(--bg-border)", background: "var(--bg-surface)" }}>
              <h3 className="text-sm font-semibold mb-3">Pro Tips</h3>
              <ul className="space-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <li>• <strong style={{ color: "var(--text-secondary)" }}>Bulk import:</strong> Go to any collection → Import from Excel. Jimmy extracts product names, SKUs, specs, and even images.</li>
                <li>• <strong style={{ color: "var(--text-secondary)" }}>AI Document Drop:</strong> Drop any factory email, quote, or PO into chat. Jimmy figures out what it is and files it automatically.</li>
                <li>• <strong style={{ color: "var(--text-secondary)" }}>Collection view:</strong> Open a collection to see all factories as columns and all stages as rows — like your spreadsheet but live.</li>
                <li>• <strong style={{ color: "var(--text-secondary)" }}>Disqualify factories:</strong> When a factory is too slow or expensive, click Disqualify. Jimmy sends them a professional email and removes them from the product.</li>
                <li>• <strong style={{ color: "var(--text-secondary)" }}>PIN protection:</strong> Sensitive actions (kill product, approve sample) require your admin PIN.</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="space-y-6">
            <div className="border rounded-2xl p-6" style={{ borderColor: "var(--bg-border)", background: "var(--bg-surface)" }}>
              <h2 className="text-sm font-semibold mb-1">Theme</h2>
              <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>Choose how Jimmy looks. Your preference is saved automatically.</p>

              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <button
                  onClick={() => setTheme("dark")}
                  className="relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all"
                  style={{
                    borderColor: theme === "dark" ? "#4f6ef7" : "var(--bg-border)",
                    background: theme === "dark" ? "#4f6ef710" : "var(--bg-elevated)",
                  }}>
                  <div className="w-full h-16 rounded-xl bg-[#060608] border border-[#1c1c24] flex items-center justify-center">
                    <div className="w-8 h-1.5 rounded bg-[#1c1c24]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Moon size={14} style={{ color: theme === "dark" ? "#4f6ef7" : "var(--text-muted)" }} />
                    <span className="text-sm font-medium" style={{ color: theme === "dark" ? "#4f6ef7" : "var(--text-secondary)" }}>Dark</span>
                  </div>
                  {theme === "dark" && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#4f6ef7] flex items-center justify-center">
                      <Check size={10} color="white" />
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setTheme("light")}
                  className="relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all"
                  style={{
                    borderColor: theme === "light" ? "#4f6ef7" : "var(--bg-border)",
                    background: theme === "light" ? "#4f6ef710" : "var(--bg-elevated)",
                  }}>
                  <div className="w-full h-16 rounded-xl bg-[#f5f5f7] border border-[#e0e0e8] flex items-center justify-center">
                    <div className="w-8 h-1.5 rounded bg-[#e0e0e8]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Sun size={14} style={{ color: theme === "light" ? "#4f6ef7" : "var(--text-muted)" }} />
                    <span className="text-sm font-medium" style={{ color: theme === "light" ? "#4f6ef7" : "var(--text-secondary)" }}>Light</span>
                  </div>
                  {theme === "light" && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#4f6ef7] flex items-center justify-center">
                      <Check size={10} color="white" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "company" && (
          <div className="space-y-6">
            <div className="border rounded-2xl p-6 space-y-5" style={{ borderColor: "var(--bg-border)", background: "var(--bg-surface)" }}>
              <h2 className="text-sm font-semibold mb-4">Company Information</h2>
              <div>
                <label className={labelClass}>Login Email</label>
                <div className="w-full rounded-xl px-4 py-3 text-sm" style={{ background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", color: "var(--text-muted)" }}>{userEmail || "—"}</div>
              </div>
              <div>
                <label className={labelClass}>Your Name</label>
                <input value={company.full_name} onChange={e => setCompany({...company, full_name: e.target.value})}
                  placeholder="Your full name" className={inputClass} />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Used to sign emails sent from Jimmy on your behalf</p>
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
                  className="font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition text-sm"
                  style={{ background: "var(--text-primary)", color: "var(--bg-base)" }}>
                  {saving ? "Saving..." : "Save"}
                </button>
                {saved && <span className="text-emerald-400 text-sm">Saved ✓</span>}
              </div>
            </div>

            <div className="border rounded-2xl p-6" style={{ borderColor: "var(--bg-border)", background: "var(--bg-surface)" }}>
              <h2 className="text-sm font-semibold mb-1">Admin PIN</h2>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Your PIN protects sensitive actions. It can never be revealed — reset it via email if forgotten.</p>
              <button onClick={sendPinReset} disabled={sendingPinReset || pinResetSent}
                className="text-sm underline underline-offset-2 transition disabled:opacity-50"
                style={{ color: "var(--text-secondary)" }}>
                {pinResetSent ? "Reset email sent ✓" : sendingPinReset ? "Sending..." : "Forgot PIN — Send Reset Email"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
