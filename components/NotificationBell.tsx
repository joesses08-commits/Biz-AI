"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [assignmentRequests, setAssignmentRequests] = useState<any[]>([]);
  const [bellPos, setBellPos] = useState({ top: 0, left: 0 });
  const bellRef = useRef<HTMLButtonElement>(null);

  const load = async () => {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    setNotifications(data.notifications || []);
    setUnread(data.unread || 0);
  };

  const loadAssignments = async () => {
    const res = await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_assignment_requests" }) });
    const data = await res.json();
    setAssignmentRequests(data.requests || []);
  };

  useEffect(() => {
    load();
    loadAssignments();
    const interval = setInterval(() => { load(); loadAssignments(); }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then(async reg => {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        const existing = await reg.pushManager.getSubscription();
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
        const keyBytes = Uint8Array.from(atob(vapidKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
        const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
        await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save_push_subscription", subscription: sub }) });
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-notif-bell]")) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggleOpen = () => {
    if (!open && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setBellPos({ top: rect.bottom + 8, left: rect.left });
    }
    setOpen(!open);
    if (!open) { load(); loadAssignments(); }
  };

  const markRead = async (id: string) => {
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", id }) });
    load();
  };

  const handleClick = (n: any) => {
    markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const handleAssignment = async (requestId: string, approve: boolean) => {
    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "handle_assignment_request", request_id: requestId, approve }) });
    loadAssignments();
    load();
  };

  const typeIcon = (type: string) => {
    if (type === "message") return "💬";
    if (type === "stage_update") return "📦";
    if (type === "action_required") return "⚡";
    return "🔔";
  };

  const dropdown = open && typeof document !== "undefined" ? createPortal(
    <div data-notif-bell style={{ position: "fixed", top: bellPos.top, left: bellPos.left, width: 320, background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, boxShadow: "0 25px 60px rgba(0,0,0,0.95)", zIndex: 999999, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "white" }}>Notifications</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {unread > 0 && <button onClick={() => markRead("all")} style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>Mark all read</button>}
          <button onClick={() => setOpen(false)} style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}><X size={14} /></button>
        </div>
      </div>
      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {assignmentRequests.length > 0 && (
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "12px 16px 8px" }}>Assignment Requests</p>
            {assignmentRequests.map((req: any) => (
              <div key={req.id} style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(245,158,11,0.02)" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "white" }}>{req.factory_portal_users?.name} wants to join</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>{req.plm_products?.name}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={(e) => { e.stopPropagation(); handleAssignment(req.id, true); }}
                    style={{ flex: 1, padding: "4px 0", borderRadius: 8, background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>✓ Approve</button>
                  <button onClick={(e) => { e.stopPropagation(); handleAssignment(req.id, false); }}
                    style={{ flex: 1, padding: "4px 0", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>✕ Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {notifications.length === 0 && assignmentRequests.length === 0 ? (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "32px 0" }}>No notifications yet</p>
        ) : notifications.map((n: any) => (
          <div key={n.id} onClick={() => handleClick(n)}
            style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12, background: n.read ? "transparent" : "rgba(255,255,255,0.02)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            onMouseLeave={e => (e.currentTarget.style.background = n.read ? "transparent" : "rgba(255,255,255,0.02)")}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{typeIcon(n.type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: n.read ? "rgba(255,255,255,0.6)" : "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</p>
                {!n.read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa", flexShrink: 0 }} />}
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{n.body}</p>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div data-notif-bell style={{ position: "relative" }}>
      <button ref={bellRef} onClick={toggleOpen}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.05] transition text-white/40 hover:text-white/70">
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {dropdown}
    </div>
  );
}
