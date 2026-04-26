"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";

export default function PortalNotificationBell({ token, onNavigate }: { token: string; onNavigate?: (link: string) => void }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!token) return;
    const res = await fetch("/api/portal/notifications", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setNotifications(data.notifications || []);
    setUnread(data.unread || 0);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id: string) => {
    await fetch("/api/portal/notifications", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "mark_read", id }) });
    load();
  };

  const handleClick = async (n: any) => {
    await markRead(n.id);
    setOpen(false);
    if (n.link && onNavigate) onNavigate(n.link);
  };

  const typeIcon = (type: string) => {
    if (type === "message") return "💬";
    if (type === "order") return "📦";
    if (type === "sample") return "🧪";
    if (type === "assignment") return "✅";
    return "🔔";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => { setOpen(!open); if (!open) load(); }}
        className="relative flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 border border-white/[0.06] hover:border-white/20 px-3 py-1.5 rounded-xl transition">
        <Bell size={12} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div style={{position:"fixed", top:"60px", right:"16px", width:"320px", zIndex:999999}} className="bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={async () => { await markRead("all"); }} className="text-[10px] text-white/30 hover:text-white/60">Mark all read</button>
              )}
              <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
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
                  <p className="text-[11px] text-white/40 mt-0.5">{n.body}</p>
                  <p className="text-[9px] text-white/20 mt-1">{new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      , document.body)}
    </div>
  );
}
