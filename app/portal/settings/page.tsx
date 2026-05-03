"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";

export default function PortalSettingsPage() {
  const router = useRouter();
  const [portalUser, setPortalUser] = useState<any>(null);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const token = () => localStorage.getItem("portal_token") || "";

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("portal_user") || "{}");
    setPortalUser(user);
  }, []);

  const savePin = async () => {
    if (pin.length < 4) { setError("PIN must be at least 4 digits"); return; }
    if (pin !== confirm) { setError("PINs don't match"); return; }
    setSaving(true); setError("");
    await fetch("/api/portal/designer", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
      body: JSON.stringify({ action: "set_pin", pin }) });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setPin(""); setConfirm("");
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary p-6 max-w-lg">
      <button onClick={() => router.push("/portal/dashboard?role=designer")}
        className="flex items-center gap-2 text-text-muted hover:text-text-primary text-xs mb-6 transition">
        <ArrowLeft size={14} />Back
      </button>
      <h1 className="text-lg font-semibold mb-1">Settings</h1>
      <p className="text-xs text-text-muted mb-8">{portalUser?.name || portalUser?.email}</p>

      <div className="border border-bg-border rounded-2xl p-5 space-y-4">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Change PIN</p>
        <div className="space-y-3">
          <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,"").slice(0,8))}
            placeholder="New PIN (4-8 digits)"
            className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest focus:outline-none" />
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g,"").slice(0,8))}
            placeholder="Confirm PIN"
            className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest focus:outline-none" />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={savePin} disabled={saving || !pin}
            className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
            {saved ? <><Check size={12} />Saved</> : saving ? "Saving..." : "Save PIN"}
          </button>
        </div>
      </div>
    </div>
  );
}
