"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Check, Shield } from "lucide-react";

function ResetPinContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [state, setState] = useState<"loading" | "form" | "done" | "error">("loading");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) { setState("error"); setError("Missing reset link. Request a new one from Settings."); return; }
    fetch("/api/portal/reset-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify_token", token }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) { setEmail(d.email); setState("form"); }
        else { setError(d.error || "Invalid or expired link"); setState("error"); }
      })
      .catch(() => { setError("Could not verify link"); setState("error"); });
  }, [token]);

  const submit = async () => {
    if (pin.length < 4) { setError("PIN must be at least 4 digits"); return; }
    if (pin !== confirm) { setError("PINs do not match"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/portal/reset-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_pin", token, pin }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) setState("done");
    else { setError(data.error || "Something went wrong"); }
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-xl bg-white/5 border border-bg-border flex items-center justify-center">
            <Shield size={15} className="text-text-secondary" />
          </div>
          <p className="text-sm font-semibold text-text-primary">Jimmy AI</p>
        </div>

        {state === "loading" && (
          <div className="flex justify-center py-16">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        )}

        {state === "error" && (
          <div className="bg-bg-surface border border-bg-border rounded-2xl p-6 space-y-4">
            <p className="text-sm font-semibold text-text-primary">Link Invalid</p>
            <p className="text-xs text-text-muted">{error}</p>
            <button onClick={() => router.push("/portal")}
              className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-semibold">
              Back to Portal
            </button>
          </div>
        )}

        {state === "form" && (
          <div className="bg-bg-surface border border-bg-border rounded-2xl p-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-text-primary mb-1">Set New PIN</p>
              <p className="text-xs text-text-muted">{email}</p>
            </div>
            <input type="password" value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="New PIN (4–8 digits)"
              className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest focus:outline-none focus:border-white/20 transition" />
            <input type="password" value={confirm}
              onChange={e => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="Confirm PIN"
              className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest focus:outline-none focus:border-white/20 transition" />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button onClick={submit} disabled={saving || !pin || !confirm}
              className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={11} className="animate-spin" /> : null}
              {saving ? "Saving..." : "Set PIN"}
            </button>
          </div>
        )}

        {state === "done" && (
          <div className="bg-bg-surface border border-bg-border rounded-2xl p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <Check size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary mb-1">PIN Updated</p>
              <p className="text-xs text-text-muted">Your new PIN has been saved. You can now use it for approvals and sensitive actions.</p>
            </div>
            <button onClick={() => router.push("/portal/dashboard?role=designer")}
              className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-semibold">
              Go to Portal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-text-muted" />
      </div>
    }>
      <ResetPinContent />
    </Suspense>
  );
}
