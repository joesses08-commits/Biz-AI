"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function SettingsPage() {
  const supabase = createClientComponentClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    company_name: "",
    industry: "",
    website: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    fiscal_year_start: "January",
    currency: "USD",
    timezone: "America/New_York",
  });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from("company_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setForm({
          company_name: data.company_name || "",
          industry: data.industry || "",
          website: data.website || "",
          phone: data.phone || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          zip: data.zip || "",
          country: data.country || "United States",
          fiscal_year_start: data.fiscal_year_start || "January",
          currency: data.currency || "USD",
          timezone: data.timezone || "America/New_York",
        });
      }
    };
    load();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("company_settings")
      .upsert({ user_id: userId, ...form }, { onConflict: "user_id" });
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      alert("Error saving: " + error.message);
    }
  };

  const inputClass = "w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition text-sm";
  const labelClass = "block text-xs font-medium text-white/50 uppercase tracking-widest mb-1.5";

  return (
    <div className="min-h-screen bg-[#080b12] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Company Settings</h1>
          <p className="text-white/40 mt-1 text-sm">Used by your AI COO to personalize analysis and reports.</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-6">Company Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className={labelClass}>Company Name</label>
              <input name="company_name" value={form.company_name} onChange={handleChange} placeholder="Acme Corp" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Industry</label>
              <select name="industry" value={form.industry} onChange={handleChange} className={inputClass}>
                <option value="">Select industry</option>
                {["E-commerce","SaaS / Software","Retail","Restaurant / Food","Healthcare","Construction","Real Estate","Marketing Agency","Consulting","Manufacturing","Transportation","Education","Finance","Other"].map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Website</label>
              <input name="website" value={form.website} onChange={handleChange} placeholder="https://yourcompany.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" className={inputClass} />
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-6">Business Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className={labelClass}>Street Address</label>
              <input name="address" value={form.address} onChange={handleChange} placeholder="123 Main St" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input name="city" value={form.city} onChange={handleChange} placeholder="New York" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input name="state" value={form.state} onChange={handleChange} placeholder="NY" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ZIP Code</label>
              <input name="zip" value={form.zip} onChange={handleChange} placeholder="10001" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <select name="country" value={form.country} onChange={handleChange} className={inputClass}>
                {["United States","Canada","United Kingdom","Australia","Germany","France","Other"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-6">Business Preferences</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>Currency</label>
              <select name="currency" value={form.currency} onChange={handleChange} className={inputClass}>
                {["USD","CAD","EUR","GBP","AUD"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Fiscal Year Start</label>
              <select name="fiscal_year_start" value={form.fiscal_year_start} onChange={handleChange} className={inputClass}>
                {["January","February","March","April","May","June","July","August","September","October","November","December"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Timezone</label>
              <select name="timezone" value={form.timezone} onChange={handleChange} className={inputClass}>
                {["America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Europe/London","Europe/Paris","Asia/Tokyo"].map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-xl transition text-sm">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {saved && <span className="text-green-400 text-sm font-medium">✓ Settings saved</span>}
        </div>
      </div>
    </div>
  );
}
