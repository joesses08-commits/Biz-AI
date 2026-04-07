"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function ResetPinPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleReset() {
    if (pin.length < 4) { setError("PIN must be at least 4 digits"); return; }
    if (pin !== confirmPin) { setError("PINs don't match"); return; }
    setSaving(true);
    const res = await fetch("/api/admin/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_pin", pin, reset_token: token }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) { setDone(true); setTimeout(() => router.push("/dashboard"), 2000); }
    else setError(data.error || "Failed to reset PIN");
  }

  if (!token) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-white/30 text-sm">Invalid reset link.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-8">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Reset Admin PIN</h1>
          <p className="text-white/40 text-sm">Enter a new PIN for your Jimmy AI account</p>
        </div>
        {done ? (
          <div className="text-center py-8">
            <p className="text-emerald-400 font-semibold">✓ PIN reset successfully</p>
            <p className="text-white/30 text-xs mt-2">Redirecting to dashboard...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-widest mb-2 block">New PIN</label>
              <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Enter new PIN" maxLength={8}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-widest mb-2 block">Confirm PIN</label>
              <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Confirm PIN" maxLength={8}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-white/20" />
            </div>
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <button onClick={handleReset} disabled={saving || !pin || !confirmPin}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 disabled:opacity-40 transition">
              {saving ? "Saving..." : "Set New PIN"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
