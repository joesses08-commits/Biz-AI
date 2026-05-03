"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Package, Layers, MessageSquare, ListOrdered, FileSpreadsheet, Settings, LogOut,
  User, Mail, Shield, Check, Loader2, FileUp, Truck,
} from "lucide-react";
import PortalNotificationBell from "../../../components/PortalNotificationBell";
import PortalThemeToggle from "@/components/PortalThemeToggle";

const NAV_ITEMS: [string, string, any][] = [
  ["products", "Products", Package],
  ["collections", "Collections", Layers],
  ["messages", "Messages", MessageSquare],
  ["prioritization", "Prioritization", ListOrdered],
  ["divider", "", null],
  ["rfq", "RFQ Workflow", FileSpreadsheet],
  ["settings", "Settings", Settings],
];

export default function PortalSettingsPage() {
  const router = useRouter();
  const [portalUser, setPortalUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"guide" | "profile" | "security">("guide");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [tok, setTok] = useState("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("portal_user_designer") || localStorage.getItem("portal_user") || "{}");
    setPortalUser(user);
    setTok(localStorage.getItem("portal_token_designer") || localStorage.getItem("portal_token") || "");
  }, []);

  const token = () => localStorage.getItem("portal_token_designer") || localStorage.getItem("portal_token") || "";

  const logout = () => {
    localStorage.removeItem("portal_token_designer");
    localStorage.removeItem("portal_user_designer");
    localStorage.removeItem("portal_token");
    localStorage.removeItem("portal_user");
    router.push("/portal");
  };

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

  const sendPinReset = async () => {
    setSendingReset(true);
    await fetch("/api/portal/designer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
      body: JSON.stringify({ action: "reset_pin_email" }),
    });
    setSendingReset(false);
    setResetSent(true);
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex">
      {/* Sidebar */}
      <div className="w-60 flex-shrink-0 border-r border-bg-border bg-bg-surface flex flex-col h-screen sticky top-0 overflow-y-auto">
        <div className="px-4 py-5 border-b border-bg-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-bg-border flex items-center justify-center flex-shrink-0">
              <Layers size={15} className="text-text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Jimmy AI</p>
              <p className="text-[10px] text-text-muted truncate">{portalUser?.name || portalUser?.email}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(([key, label, Icon]) => {
            if (key === "divider") return <div key="divider" className="my-2 border-t border-bg-border" />;
            return (
              <button key={key}
                onClick={() => {
                  if (key === "settings") return;
                  if (key === "messages") { router.push("/portal/designer-messages"); return; }
                  if (key === "rfq") { router.push("/portal/rfq"); return; }
                  router.push("/portal/dashboard?role=designer");
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition text-left ${key === "settings" ? "bg-white/10 text-text-primary" : "text-text-muted hover:text-text-secondary hover:bg-white/5"}`}>
                <Icon size={14} className="flex-shrink-0" />
                <span className="flex-1">{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-bg-border space-y-1">
          <div className="flex items-center gap-2 px-3 py-2">
            <PortalNotificationBell token={tok} onNavigate={(link: string) => router.push(link)} />
            <PortalThemeToggle />
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-text-muted hover:text-text-secondary hover:bg-white/5 transition">
            <LogOut size={14} />Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm mt-1 text-text-muted">Manage your portal preferences and security.</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-8 rounded-xl p-1 w-fit border border-bg-border bg-bg-elevated">
            {[
              { id: "guide", label: "Quick Start" },
              { id: "profile", label: "Profile" },
              { id: "security", label: "Security" },
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

          {/* Quick Start */}
          {activeTab === "guide" && (
            <div className="space-y-6">
              <div className="border border-bg-border rounded-2xl p-6 bg-bg-surface">
                <h2 className="text-lg font-bold mb-2">Welcome to Jimmy</h2>
                <p className="text-sm mb-6 text-text-muted">Your designer portal for tracking products and collaborating on sourcing.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      icon: <Package size={16} className="text-amber-400" />,
                      title: "View Products",
                      desc: "Browse all your assigned products, track their stage from concept through approved sample.",
                    },
                    {
                      icon: <FileSpreadsheet size={16} className="text-pink-400" />,
                      title: "Request Quotes",
                      desc: "Create RFQ jobs to send to factories. Select products, choose what to include, and download the Excel sheet.",
                    },
                    {
                      icon: <Truck size={16} className="text-emerald-400" />,
                      title: "Track Samples",
                      desc: "See where each product's sample is: requested, in production, shipped, or arrived and reviewed.",
                    },
                    {
                      icon: <FileUp size={16} className="text-blue-400" />,
                      title: "Drop Documents",
                      desc: "Drag factory quotes, POs, or sample feedback docs into the floating Doc Dropper tab. Jimmy reads and files them automatically.",
                    },
                    {
                      icon: <ListOrdered size={16} className="text-purple-400" />,
                      title: "Prioritize Samples",
                      desc: "Drag and drop to reorder sample priority per factory so factories know what to work on first.",
                    },
                    {
                      icon: <MessageSquare size={16} className="text-blue-400" />,
                      title: "Messages",
                      desc: "View updates from your admin about product changes, sample approvals, and next steps.",
                    },
                  ].map(item => (
                    <div key={item.title} className="p-4 rounded-xl border border-bg-border bg-bg-elevated">
                      <div className="flex items-center gap-2 mb-2">
                        {item.icon}
                        <h3 className="text-sm font-semibold">{item.title}</h3>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-bg-border rounded-2xl p-6 bg-bg-surface">
                <h3 className="text-sm font-semibold mb-3">Tips</h3>
                <ul className="space-y-2 text-xs text-text-muted">
                  <li>• <strong className="text-text-secondary">Doc Dropper:</strong> The floating tab on the right side of every page — drag any factory document onto it and Jimmy identifies and files it.</li>
                  <li>• <strong className="text-text-secondary">PIN protection:</strong> Sensitive actions like approvals and stage changes require your security PIN. Set it in the Security tab.</li>
                  <li>• <strong className="text-text-secondary">Prioritization:</strong> Use the Prioritization tab to drag samples into priority order for each factory.</li>
                  <li>• <strong className="text-text-secondary">Collection filter:</strong> Use the collection dropdown in the products toolbar to filter by collection.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Profile */}
          {activeTab === "profile" && (
            <div className="space-y-4">
              <div className="border border-bg-border rounded-2xl p-6 bg-bg-surface space-y-5">
                <h2 className="text-sm font-semibold">Profile</h2>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-bg-border flex items-center justify-center flex-shrink-0">
                    <User size={22} className="text-text-secondary" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-base font-semibold">{portalUser?.name || "—"}</p>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Mail size={11} />
                      <span>{portalUser?.email || "—"}</span>
                    </div>
                    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20 uppercase tracking-wide">
                      {portalUser?.role || "Designer"}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-text-muted border-t border-bg-border pt-4">
                  Your profile is managed by your admin. Contact them to update your name or email.
                </p>
              </div>
            </div>
          )}

          {/* Security */}
          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="border border-bg-border rounded-2xl p-6 bg-bg-surface space-y-4">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-text-muted" />
                  <h2 className="text-sm font-semibold">Security PIN</h2>
                </div>
                <p className="text-xs text-text-muted">Your PIN is required for approvals, stage changes, and other sensitive actions. Minimum 4 digits, maximum 8.</p>
                <div className="space-y-3">
                  <input type="password" value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="New PIN (4–8 digits)"
                    className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest focus:outline-none focus:border-white/20 transition" />
                  <input type="password" value={confirm}
                    onChange={e => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="Confirm PIN"
                    className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest focus:outline-none focus:border-white/20 transition" />
                  {error && <p className="text-red-400 text-xs">{error}</p>}
                  <button onClick={savePin} disabled={saving || !pin}
                    className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-2 transition">
                    {saved ? <><Check size={12} />Saved</> : saving ? <><Loader2 size={11} className="animate-spin" />Saving...</> : "Save PIN"}
                  </button>
                </div>
              </div>

              <div className="border border-bg-border rounded-2xl p-6 bg-bg-surface">
                <h2 className="text-sm font-semibold mb-1">Forgot PIN?</h2>
                <p className="text-xs text-text-muted mb-4">We'll send a reset link to your registered email address. Your PIN can never be revealed — only reset.</p>
                <button onClick={sendPinReset} disabled={sendingReset || resetSent}
                  className="text-sm underline underline-offset-2 text-text-secondary transition disabled:opacity-50">
                  {resetSent ? "Reset email sent ✓" : sendingReset ? "Sending..." : "Send PIN Reset Email"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
