"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, User, Mail, Shield } from "lucide-react";

export default function PortalSettingsPage() {
  const router = useRouter();
  const [portalUser, setPortalUser] = useState<any>(null);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const token = () => localStorage.getItem("portal_token_designer") || localStorage.getItem("portal_token") || "";

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("portal_user_designer") || localStorage.getItem("portal_user") || "{}");
    setPortalUser(user);
  }, []);

  const savePin = async () => {
    if (pin.length < 4) { setError("PIN must be at least 4 digits"); return; }
    if (pin !== confirm) { setError("PINs do not match"); return; }
    setSaving(true); setError("");
    await fetch("/api/portal/designer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
      body: JSON.stringify({ action: "set_pin", pin }),
    });
    setSaving(false); setSaved(true);
    setPin(""); setConfirm("");
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary p-6 max-w-2xl">
      <button onClick={() => router.push("/portal/dashboard?role=designer")}
        className="flex items-center gap-2 text-text-muted hover:text-text-primary text-xs mb-8 transition">
        <ArrowLeft size={14} />Back
      </button>

      <h1 className="text-xl font-semibold mb-6">Settings</h1>

      {/* Profile card */}
      <div className="border border-bg-border rounded-2xl p-5 bg-bg-surface mb-4 space-y-4">
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Profile</p>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-bg-border flex items-center justify-center flex-shrink-0">
            <User size={20} className="text-text-secondary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">{portalUser?.name || "—"}</p>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Mail size={11} />
              <span>{portalUser?.email || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20 uppercase tracking-wide">
                {portalUser?.role || "Designer"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PIN card */}
      <div className="border border-bg-border rounded-2xl p-5 bg-bg-surface space-y-4">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-text-muted" />
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Security PIN</p>
        </div>
        <p className="text-xs text-text-muted">Required for approvals, stage changes, and sensitive actions.</p>
        <input type="password" value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="New PIN (4–8 digits)"
          className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest focus:outline-none focus:border-white/20" />
        <input type="password" value={confirm}
          onChange={e => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="Confirm PIN"
          className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest focus:outline-none focus:border-white/20" />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button onClick={savePin} disabled={saving || !pin}
          className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition">
          {saved ? <><Check size={12} />Saved</> : saving ? "Saving..." : "Save PIN"}
        </button>
      </div>
    </div>
  );
}
