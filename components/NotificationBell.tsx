"use client";
import { useState, useEffect, useRef } from "react";
import { Bell, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    setNotifications(data.notifications || []);
    setUnread(data.unread || 0);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Register service worker and push subscription
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then(async reg => {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        const existing = await reg.pushManager.getSubscription();
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
        const keyBytes = Uint8Array.from(atob(vapidKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
        const sub = existing || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes,
        });
        await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save_push_subscription", subscription: sub }) });
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id: string) => {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", id }) });
    load();
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", id: "all" }) });
    load();
  };

  const handleClick = async (n: any) => {
    await markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const typeIcon = (type: string) => {
    if (type === "message") return "💬";
    if (type === "stage_update") return "📦";
    if (type === "action_required") return "⚡";
    if (type === "sample_update") return "🧪";
    return "🔔";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => { setOpen(!open); if (!open) load(); }}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.05] transition text-white/40 hover:text-white/70">
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 w-80 bg-[#111] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-white/30 hover:text-white/60 transition">
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-8">No notifications yet</p>
            ) : notifications.map((n: any) => (
              <div key={n.id} onClick={() => handleClick(n)}
                className={`px-4 py-3 border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.03] transition flex items-start gap-3 ${!n.read ? "bg-white/[0.02]" : ""}`}>
                <span className="text-base flex-shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-semibold truncate ${!n.read ? "text-white" : "text-white/60"}`}>{n.title}</p>
                    {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                  </div>
                  <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-[9px] text-white/20 mt-1">{new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
