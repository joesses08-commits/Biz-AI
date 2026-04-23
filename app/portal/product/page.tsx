"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Package, ArrowLeft, Factory, Check, Loader2, X } from "lucide-react";

const SAMPLE_STAGES = [
  { key: "sample_production", label: "Sample Production", color: "#f59e0b" },
  { key: "sample_complete", label: "Sample Complete", color: "#10b981" },
  { key: "sample_shipped", label: "Sample Shipped", color: "#3b82f6" },
  // sample_arrived is admin-only
];

const PRODUCTION_STAGES = [
  { key: "production_started", label: "Production Started", color: "#f59e0b" },
  { key: "production_complete", label: "Production Complete", color: "#10b981" },
  { key: "qc_inspection", label: "QC Inspection", color: "#f59e0b" },
  { key: "ready_to_ship", label: "Ready to Ship", color: "#3b82f6" },
  { key: "shipped", label: "Shipped", color: "#10b981" },
];

const ALL_STAGES = [...SAMPLE_STAGES, ...PRODUCTION_STAGES];

function stageInfo(key: string) {
  return ALL_STAGES.find(s => s.key === key) || { key, label: key, color: "#6b7280" };
}

export default function PortalProductPage() {
  const router = useRouter();
  const productId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;

  const [product, setProduct] = useState<any>(null);
  const [factories, setFactories] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [portalUser, setPortalUser] = useState<any>(null);
  const [factoryTrackId, setFactoryTrackId] = useState<string | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [trackMessages, setTrackMessages] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [firstUnreadIdx, setFirstUnreadIdx] = useState<number>(-1);
  const msgPollRef = useRef<NodeJS.Timeout | null>(null);
  const msgContainerRef = useRef<HTMLDivElement | null>(null);
  const [totalMessages, setTotalMessages] = useState(0);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [updatingSample, setUpdatingSample] = useState(false);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [sampleNote, setSampleNote] = useState("");
  const [pendingSampleStage, setPendingSampleStage] = useState<{stage: string, srId: string} | null>(null);
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});
  const [orderPending, setOrderPending] = useState<{batchId: string; stage: string; label: string} | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("portal_token");
    const user = localStorage.getItem("portal_user");
    if (!token || !user) { router.push("/portal"); return; }
    const parsed = JSON.parse(user);
    if (parsed.role !== "factory" && parsed.role !== "designer") { router.push("/portal/dashboard"); return; }
    setPortalUser(parsed);
    if (productId) load(token);
  }, [productId]);

  const token = () => localStorage.getItem("portal_token") || "";

  const load = async (t?: string) => {
    const tok_ = t || token();
    const headers = { Authorization: `Bearer ${tok_}` };
    const portalUser = JSON.parse(localStorage.getItem("portal_user") || "{}");
    const isDesigner = portalUser?.role === "designer";
    if (isDesigner) {
      const [prodRes, mainRes] = await Promise.all([
        fetch(`/api/portal/designer?type=product&id=${productId}`, { headers }),
        fetch("/api/portal/designer", { headers }),
      ]);
      if (prodRes.status === 401) { router.push("/portal"); return; }
      const prodData = await prodRes.json();
      const mainData = await mainRes.json();
      setProduct(prodData.product);
      setFactories(mainData.factories || []);
      setCollections(mainData.collections || []);
    } else {
      const res = await fetch(`/api/portal/product?id=${productId}`, { headers });
      if (res.status === 401) { router.push("/portal"); return; }
      const data = await res.json();
      setProduct(data.product);
      // Load message counts for factory
      if (data.product?.track_id) {
        const msgRes = await fetch("/api/portal/product", { method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok_ },
          body: JSON.stringify({ action: "get_messages", track_id: data.product.track_id }) });
        const msgData = await msgRes.json();
        const msgs = msgData.messages || [];
        setTotalMessages(msgs.length);
        setUnreadCount(msgs.filter((m: any) => m.sender_role === "admin" && !m.read_by_factory).length);
      }
    }
    setLoading(false);
  };

  const updateSampleStage = async (stage: string, sampleRequestId?: string) => {
    setUpdatingSample(true);
    await fetch("/api/portal/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ product_id: productId, sample_request_id: sampleRequestId, stage, notes: sampleNote }),
    });
    // Send message to admin with stage update + note
    if (product?.track_id) {
      const stageLabel = stageInfo(stage).label;
      const msg = sampleNote ? `${stageLabel}: ${sampleNote}` : stageLabel;
      await fetch("/api/portal/product", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "send_message", track_id: product.track_id, message: msg }),
      });
    }
    setUpdatingSample(false);
    setSampleNote("");
    setSuccess(`Updated to ${stageInfo(stage).label}`);
    setTimeout(() => setSuccess(""), 3000);
    load();
  };

  const updateOrderStage = async (batchId: string, stage: string) => {
    setUpdatingOrder(batchId);
    const stageLabel = PRODUCTION_STAGES.find(s => s.key === stage)?.label || stage;
    const rawNote = orderNotes[batchId] || "";
    const formattedNote = rawNote ? `${stageLabel}: ${rawNote}` : stageLabel;
    await fetch("/api/portal/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ product_id: productId, batch_id: batchId, stage, notes: formattedNote }),
    });
    // Send message to admin with stage update + note
    if (product?.track_id) {
      await fetch("/api/portal/product", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "send_message", track_id: product.track_id, message: formattedNote }),
      });
    }
    setUpdatingOrder(null);
    setOrderNotes(prev => ({ ...prev, [batchId]: "" }));
    setSuccess(`Order updated to ${stageInfo(stage).label}`);
    setTimeout(() => setSuccess(""), 3000);
    load();
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 size={20} className="animate-spin text-white/20" />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-white/30 text-sm">Product not found</p>
    </div>
  );

  // Only show the latest active sample request for updating
  const allSampleRequests = (product.plm_sample_requests || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  // Show all rounds — factory sees same history as admin
  const sampleRequests = allSampleRequests;
  const orders = (product.plm_batches || []).sort((a: any, b: any) => a.batch_number - b.batch_number);
  const isOnHold = product?.status === "hold";
  const isDisqualified = product?.is_disqualified;
  const disqualifyReason = product?.disqualify_reason;

  if (isDisqualified) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <span className="text-2xl">✕</span>
          </div>
          <p className="text-white font-semibold">Sample Disqualified</p>
          <p className="text-white/40 text-sm">
            {disqualifyReason === "price" ? "This factory was not selected due to pricing for this order."
              : disqualifyReason === "speed" ? "This factory was not selected due to lead time requirements."
              : disqualifyReason === "quality" ? "This factory was not selected due to quality requirements."
              : "This factory was not selected for this product."}
          </p>
          <p className="text-white/25 text-xs">Please disregard any further sample production for this item. You will be considered for future opportunities.</p>
          <button onClick={() => router.back()} className="px-4 py-2 rounded-xl border border-white/10 text-white/40 text-sm">← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/portal/dashboard")}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition">
            <ArrowLeft size={12} /> Back
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Factory size={13} className="text-white/60" />
            </div>
            <div>
              <p className="text-sm font-semibold">Factory Portal</p>
              {portalUser && <p className="text-[10px] text-white/30">{portalUser.factory_name || portalUser.name}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {success && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-xs">
            <Check size={12} />{success}
          </div>
        )}

        {/* Product Info */}
        <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01] space-y-4">
          <div className="flex items-start gap-4">
            {product.images?.[0] ? (
              <img src={product.images[0]} alt={product.name} className="w-20 h-20 rounded-xl object-cover border border-white/[0.06] flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                <Package size={24} className="text-white/20" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg font-bold">{product.name}</h1>
                {product.sku && <span className="text-xs font-mono text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-lg">{product.sku}</span>}
              </div>
              {product.plm_collections && <p className="text-xs text-white/30 mb-2">{product.plm_collections.name}</p>}
              {product.description && <p className="text-sm text-white/50">{product.description}</p>}
            </div>
          </div>

          {/* All images */}
          {(product.images || []).length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {(product.images || []).map((url: string) => (
                <img key={url} src={url} alt="" className="w-full aspect-square rounded-lg object-cover border border-white/[0.06]" />
              ))}
            </div>
          )}

          {/* Specs + Notes */}
          {product.specs && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Specs</p>
              <p className="text-sm text-white/60 whitespace-pre-wrap">{product.specs}</p>
            </div>
          )}


          {product.reference_url && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Reference / Dropbox</p>
              <a href={product.reference_url} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 underline break-all">{product.reference_url}</a>
            </div>
          )}
          {(() => {
            const allBatchNotes = (product.plm_batches || []).flatMap((b: any) =>
              (b.plm_batch_stages || []).filter((s: any) => s.notes && s.updated_by_role === "factory")
                .map((s: any) => ({ note: s.notes, date: s.created_at }))
            ).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return allBatchNotes.length > 0 ? (
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Notes from Factory</p>
                <div className="space-y-1.5">
                  {allBatchNotes.map((n: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-white/20 flex-shrink-0 mt-1.5" />
                      <p className="text-xs text-white/60">{n.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </div>

        {/* Messages Section */}
        {product.track_id && (
          <div className="border border-white/[0.06] rounded-2xl overflow-hidden">
            <button onClick={async () => {
              const fetchMsgs = async (isFirst?: boolean) => {
                const res = await fetch("/api/portal/product", { method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("portal_token") || "") },
                  body: JSON.stringify({ action: "get_messages", track_id: product.track_id }) });
                const data = await res.json();
                const msgs = data.messages || [];
                setTrackMessages(msgs);
                setUnreadCount(0);
                if (isFirst) {
                  const firstUnread = msgs.findIndex((m: any) => m.sender_role === "admin" && !m.read_by_factory);
                  setFirstUnreadIdx(firstUnread);
                }
                setTimeout(() => {
                  if (msgContainerRef.current) msgContainerRef.current.scrollTop = msgContainerRef.current.scrollHeight;
                }, 100);
              };
              if (!showMessages) {
                await fetchMsgs(true);
                if (msgPollRef.current) clearInterval(msgPollRef.current);
                msgPollRef.current = setInterval(() => fetchMsgs(false), 3000);
              } else {
                if (msgPollRef.current) { clearInterval(msgPollRef.current); msgPollRef.current = null; }
                // Refresh unread count after closing
                setUnreadCount(0);
                setTotalMessages(trackMessages.length);
              }
              setShowMessages(!showMessages);
            }} className="w-full px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-white/60">Messages</p>
                {totalMessages > 0 && <span className="text-[10px] text-white/30">{totalMessages}</span>}
                {unreadCount > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">{unreadCount} new</span>}
              </div>
              <span className="text-white/30 text-xs">{showMessages ? "▲" : "▼"}</span>
            </button>
            {showMessages && (
              <div className="border-t border-white/[0.06]">
                <div ref={msgContainerRef} className="p-4 space-y-3 max-h-64 overflow-y-auto">
                  {trackMessages.length === 0 ? (
                    <p className="text-xs text-white/20 text-center py-4">No messages yet.</p>
                  ) : trackMessages.map((msg: any, idx: number) => (
                    <div key={msg.id}>
                      {idx === firstUnreadIdx && firstUnreadIdx > 0 && (
                        <div className="flex items-center gap-2 my-3">
                          <div className="flex-1 h-px bg-blue-500/30" />
                          <span className="text-[10px] text-blue-400 font-semibold whitespace-nowrap">
                            {trackMessages.length - firstUnreadIdx} new message{trackMessages.length - firstUnreadIdx !== 1 ? "s" : ""}
                          </span>
                          <div className="flex-1 h-px bg-blue-500/30" />
                        </div>
                      )}
                      <div className={msg.sender_role === "factory" ? "flex justify-end" : "flex justify-start"}>
                        <div className={msg.sender_role === "factory"
                          ? "bg-white/10 rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%]"
                          : "bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-tl-sm px-3 py-2 max-w-[80%]"}>
                          <p className="text-[10px] font-semibold text-white/50 mb-0.5">{msg.sender_name}</p>
                          <p className="text-xs text-white/80">{msg.message}</p>
                          <p className="text-[9px] text-white/20 mt-1">{new Date(msg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-white/[0.06] flex gap-2">
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key !== "Enter" || !newMessage.trim()) return;
                      e.preventDefault();
                      setSendingMsg(true);
                      await fetch("/api/portal/product", { method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("portal_token") || "") },
                        body: JSON.stringify({ action: "send_message", track_id: product.track_id, message: newMessage.trim() }) });
                      const res = await fetch("/api/portal/product", { method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("portal_token") || "") },
                        body: JSON.stringify({ action: "get_messages", track_id: product.track_id }) });
                      const data = await res.json();
                      setTrackMessages(data.messages || []);
                      setNewMessage("");
                      setSendingMsg(false);
                    }}
                    placeholder="Reply... (Enter to send)"
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs focus:outline-none" />
                  <button onClick={async () => {
                    if (!newMessage.trim()) return;
                    setSendingMsg(true);
                    await fetch("/api/portal/product", { method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("portal_token") || "") },
                      body: JSON.stringify({ action: "send_message", track_id: product.track_id, message: newMessage.trim() }) });
                    const res = await fetch("/api/portal/product", { method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("portal_token") || "") },
                      body: JSON.stringify({ action: "get_messages", track_id: product.track_id }) });
                    const data = await res.json();
                    setTrackMessages(data.messages || []);
                    setNewMessage("");
                    setSendingMsg(false);
                  }} disabled={!newMessage.trim() || sendingMsg}
                    className="px-3 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">Send</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sample Section — grouped by round, same as admin */}
        {sampleRequests.length > 0 && (() => {
          const STAGE_KEYS = ["sample_production","sample_complete","sample_shipped","sample_arrived"];
          const STAGE_LABELS: Record<string,string> = { sample_production:"Production", sample_complete:"Complete", sample_shipped:"Shipped", sample_arrived:"Arrived" };
          const STAGE_COLORS: Record<string,string> = { sample_production:"#f59e0b", sample_complete:"#10b981", sample_shipped:"#3b82f6", sample_arrived:"#8b5cf6" };

          // Sort rounds oldest first
          const sortedRounds = [...sampleRequests].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const activeRound = sortedRounds.find((r: any) => r.status === "requested");

          return (
            <div className="border border-white/[0.07] rounded-2xl overflow-hidden bg-white/[0.01]">
              <div className="px-5 py-4 border-b border-white/[0.05]">
                <p className="text-sm font-semibold text-white">Sample Requests</p>
                <p className="text-xs text-white/30 mt-0.5">{sortedRounds.length} round{sortedRounds.length > 1 ? "s" : ""}</p>
              </div>

              <div className="px-5 py-4 space-y-3">
                {sortedRounds.map((sr: any, roundIdx: number) => {
                  const isActive = sr.status === "requested";
                  const isKilled = sr.status === "killed";
                  const isApproved = sr.status === "approved";
                  const isRevision = sr.status === "revision";
                  const isAdditional = sr.label === "additional";
                  const roundLabel = roundIdx === 0 ? "Round 1" : isAdditional ? `Additional Sample ${roundIdx}` : `Round ${roundIdx + 1} — Revision`;
                  const roundSubtitle = isAdditional && (sr.qty || sr.notes) ? `${sr.qty ? sr.qty + " units requested" : ""}${sr.qty && sr.notes ? " · " : ""}${sr.notes || ""}` : null;
                  const stages = (sr.plm_sample_stages || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                  const completedStageKeys = stages.map((s: any) => s.stage).filter((k: string) => STAGE_KEYS.includes(k));
                  const lastCompletedIdx = Math.max(...completedStageKeys.map((k: string) => STAGE_KEYS.indexOf(k)), -1);
                  const revisionNoteText = stages.find((s: any) => s.stage === "revision_requested")?.notes;

                  // For active round: arrow nav
                  const currentIdx = SAMPLE_STAGES.findIndex(s => s.key === sr.current_stage);
                  const prev = currentIdx > 0 ? SAMPLE_STAGES[currentIdx - 1] : null;
                  const next = currentIdx < SAMPLE_STAGES.length - 1 ? SAMPLE_STAGES[currentIdx + 1] : null;
                  const current = SAMPLE_STAGES[currentIdx] || SAMPLE_STAGES[0];

                  return (
                    <div key={sr.id} className={`border rounded-2xl overflow-hidden ${isKilled ? "border-red-500/15 bg-red-500/[0.02] opacity-60" : isApproved ? "border-emerald-500/20 bg-emerald-500/[0.02]" : isRevision ? "border-amber-500/15 bg-amber-500/[0.02]" : "border-white/[0.08] bg-white/[0.01]"}`}>
                      <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">{roundLabel}</p>
                          {roundSubtitle && <p className="text-[10px] text-amber-300/60 mt-0.5">{roundSubtitle}</p>}
                        </div>
                        {isApproved && <span className="text-[10px] text-emerald-400">✓ Approved</span>}
                        {isKilled && <span className="text-[10px] text-red-400">Ended</span>}
                        {isRevision && <span className="text-[10px] text-amber-400">Revision Requested</span>}
                      </div>

                      <div className="px-4 py-3 space-y-3">
                        {/* Horizontal stage pills + result */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {STAGE_KEYS.map((key, i) => {
                            const idx = STAGE_KEYS.indexOf(key);
                            const isCompleted = idx <= lastCompletedIdx;
                            const isCurrent = isActive && idx === lastCompletedIdx;
                            const color = STAGE_COLORS[key];
                            return (
                              <div key={key} className="flex items-center gap-1">
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${
                                  isCompleted && !isCurrent ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                                  isCurrent ? "border-amber-500/30 bg-amber-500/10 text-amber-300" :
                                  "border-white/[0.05] text-white/15"
                                }`}>
                                  {isCompleted && !isCurrent && <Check size={8} />}
                                  {isCurrent && <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />}
                                  {STAGE_LABELS[key]}
                                </div>
                                {i < STAGE_KEYS.length - 1 && <span className="text-white/10 text-[10px]">→</span>}
                              </div>
                            );
                          })}
                          {/* Result pill */}
                          {(isApproved || isRevision || isKilled) && <span className="text-white/10 text-[10px]">→</span>}
                          {isApproved && <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"><Check size={8} />Approved</span>}
                          {isRevision && <span className="px-2.5 py-1 rounded-full text-[10px] font-medium border border-amber-500/30 bg-amber-500/10 text-amber-400">↩ Revision{revisionNoteText ? `: ${revisionNoteText}` : ""}</span>}
                          {isKilled && (() => {
                            // Check if there's a newer round after this one for the same product
                            const hasNewerRound = sortedRounds.slice(roundIdx + 1).some((r: any) => r.status !== "killed");
                            const killedNote = stages.find((s: any) => s.stage === "killed")?.notes || "";
                            return hasNewerRound
                              ? <span className="px-2.5 py-1 rounded-full text-[10px] font-medium border border-amber-500/30 bg-amber-500/10 text-amber-400">↩ Revision Requested</span>
                              : <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border border-red-500/20 bg-red-500/10 text-red-400"><X size={8} />{killedNote || "Killed"}</span>;
                          })()}
                        </div>

                        {/* Arrow nav for active round only */}
                        {isActive && (
                          <div className="border-t border-white/[0.05] pt-3 space-y-3">
                            {isOnHold && <p className="text-[10px] text-amber-400/60 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">Product is on hold — stage updates paused</p>}
                            {/* Progress bar */}
                            <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                              <div className="h-1 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / SAMPLE_STAGES.length) * 100}%`, background: current.color }} />
                            </div>
                            {/* Arrows */}
                            <div className="flex items-center justify-between gap-4">
                              <button onClick={() => prev && setPendingSampleStage({ stage: prev.key, srId: sr.id })} disabled={!prev || updatingSample || isOnHold}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/70 transition text-xs font-medium disabled:opacity-20 disabled:cursor-not-allowed">
                                ← {prev ? prev.label : "Start"}
                              </button>
                              <div className="text-center">
                                <div className="flex items-center gap-2 justify-center">
                                  <div className="w-2 h-2 rounded-full" style={{ background: current.color }} />
                                  <span className="text-sm font-semibold text-white">{current.label}</span>
                                </div>
                                <p className="text-[10px] text-white/25 mt-0.5">{currentIdx + 1} of {SAMPLE_STAGES.length}</p>
                              </div>
                              <button onClick={() => next && setPendingSampleStage({ stage: next.key, srId: sr.id })} disabled={!next || updatingSample || isOnHold}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium transition disabled:opacity-20 disabled:cursor-not-allowed"
                                style={next ? { borderColor: `${next.color}40`, color: next.color, background: `${next.color}10` } : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                                {next ? next.label : "Complete"} →
                              </button>
                            </div>
                            {/* All stages */}
                            <div className="space-y-1">
                              {SAMPLE_STAGES.map((stage, i) => {
                                const isPast = i < currentIdx;
                                const isCur = i === currentIdx;
                                return (
                                  <div key={stage.key} className="flex items-center gap-2.5 py-0.5">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border"
                                      style={{ background: isPast ? "#10b98120" : isCur ? `${stage.color}20` : "transparent", borderColor: isPast ? "#10b98140" : isCur ? `${stage.color}40` : "rgba(255,255,255,0.06)" }}>
                                      {isPast ? <Check size={9} className="text-emerald-400" /> : isCur ? <div className="w-1.5 h-1.5 rounded-full" style={{ background: stage.color }} /> : null}
                                    </div>
                                    <span className="text-xs" style={{ color: isPast ? "#10b981" : isCur ? stage.color : "rgba(255,255,255,0.2)" }}>{stage.label}</span>
                                    {isCur && <span className="text-[10px] text-white/20 ml-auto">Current</span>}
                                  </div>
                                );
                              })}
                            </div>
                            {/* Confirm pending */}
                            {pendingSampleStage && pendingSampleStage.srId === sr.id && (
                              <div className="border border-white/10 rounded-xl p-4 space-y-3 bg-white/[0.02]">
                                <p className="text-xs text-white/60 font-medium">Moving to: <span className="text-white">{SAMPLE_STAGES.find(s => s.key === pendingSampleStage.stage)?.label}</span></p>
                                <textarea value={sampleNote} onChange={e => setSampleNote(e.target.value)}
                                  placeholder="Add a note (optional)"
                                  rows={2} autoFocus
                                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none resize-none" />
                                <div className="flex gap-2">
                                  <button onClick={async () => {
                                    setUpdatingSample(true);
                                    await updateSampleStage(pendingSampleStage.stage, pendingSampleStage.srId);
                                    setPendingSampleStage(null);
                                    setSampleNote("");
                                    setUpdatingSample(false);
                                  }} disabled={updatingSample}
                                    className="flex-1 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 transition disabled:opacity-40">
                                    {updatingSample ? "Saving..." : "Confirm"}
                                  </button>
                                  <button onClick={() => { setPendingSampleStage(null); setSampleNote(""); }}
                                    className="px-4 rounded-xl border border-white/[0.08] text-white/30 text-xs">Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

                {/* Production Orders Section */}
        {orders.length > 0 && (
          <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-white/[0.01]">
            <div className="px-6 py-4 border-b border-white/[0.04]">
              <p className="text-sm font-semibold">Production Orders</p>
              <p className="text-xs text-white/30 mt-0.5">Update production progress for each order</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {orders.map((order: any) => {
                const stage = stageInfo(order.current_stage);
                const margin = order.target_elc && order.target_sell_price
                  ? Math.round(((order.target_sell_price - order.target_elc) / order.target_sell_price) * 100) : null;
                return (
                  <div key={order.id} className="px-6 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold">Order #{order.batch_number}</p>
                        {order.linked_po_number && <p className="text-[10px] text-white/25 font-mono">PO: {order.linked_po_number}</p>}
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${stage.color}20`, color: stage.color, border: `1px solid ${stage.color}30` }}>
                        {stage.label}
                      </span>
                    </div>

                    {/* Order financials */}
                    {(order.order_quantity || order.target_elc) && (
                      <div className="flex gap-4">
                        {order.order_quantity && <div><p className="text-[10px] text-white/25">Quantity</p><p className="text-xs text-white/60 font-semibold">{order.order_quantity.toLocaleString()} units</p></div>}
                        {order.target_elc && <div><p className="text-[10px] text-white/25">ELC</p><p className="text-xs text-white/60 font-semibold">${order.target_elc}</p></div>}
                        {margin !== null && <div><p className="text-[10px] text-white/25">Margin</p><p className="text-xs text-emerald-400 font-semibold">{margin}%</p></div>}
                      </div>
                    )}

                    {/* Production stage arrow nav */}
                    {(() => {
                      const currentIdx = PRODUCTION_STAGES.findIndex(ps => ps.key === order.current_stage);
                      const current = PRODUCTION_STAGES[currentIdx] || PRODUCTION_STAGES[0];
                      const prev = currentIdx > 0 ? PRODUCTION_STAGES[currentIdx - 1] : null;
                      const next = currentIdx < PRODUCTION_STAGES.length - 1 ? PRODUCTION_STAGES[currentIdx + 1] : null;
                      return (
                        <div className="space-y-3">
                          {/* Progress bar */}
                          <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                            <div className="h-1 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / PRODUCTION_STAGES.length) * 100}%`, background: current.color }} />
                          </div>

                          {/* Arrow nav */}
                          <div className="flex items-center justify-between gap-4">
                            <button onClick={() => prev && updateOrderStage(order.id, prev.key)} disabled={!prev || updatingOrder === order.id}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20 transition text-xs font-medium disabled:opacity-20 disabled:cursor-not-allowed">
                              ← {prev ? prev.label : "Start"}
                            </button>
                            <div className="text-center">
                              <div className="flex items-center gap-2 justify-center">
                                <div className="w-2 h-2 rounded-full" style={{ background: current.color }} />
                                <span className="text-sm font-semibold text-white">{current.label}</span>
                              </div>
                              <p className="text-[10px] text-white/25 mt-0.5">{currentIdx + 1} of {PRODUCTION_STAGES.length}</p>
                            </div>
                            <button onClick={() => next && setOrderPending({ batchId: order.id, stage: next.key, label: next.label })} disabled={!next || updatingOrder === order.id}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium transition disabled:opacity-20 disabled:cursor-not-allowed"
                              style={next ? { borderColor: `${next.color}40`, color: next.color, background: `${next.color}10` } : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                              {next ? next.label : "Complete"} →
                            </button>
                          </div>

                          {/* All stages timeline */}
                          <div className="border-t border-white/[0.05] pt-3">
                            <div className="space-y-1">
                              {PRODUCTION_STAGES.map((stage, i) => {
                                const isPast = i < currentIdx;
                                const isCurrent = i === currentIdx;
                                return (
                                  <div key={stage.key} className="flex items-center gap-2.5 py-0.5">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border"
                                      style={{ background: isPast ? "#10b98120" : isCurrent ? `${stage.color}20` : "transparent", borderColor: isPast ? "#10b98140" : isCurrent ? `${stage.color}40` : "rgba(255,255,255,0.06)" }}>
                                      {isPast ? <Check size={9} className="text-emerald-400" /> : isCurrent ? <div className="w-1.5 h-1.5 rounded-full" style={{ background: stage.color }} /> : null}
                                    </div>
                                    <span className="text-xs" style={{ color: isPast ? "#10b981" : isCurrent ? stage.color : "rgba(255,255,255,0.2)" }}>{stage.label}</span>
                                    {isCurrent && <span className="text-[10px] text-white/20 ml-auto">Current</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Confirm pending */}
                          {orderPending?.batchId === order.id && (
                            <div className="border border-white/[0.08] rounded-xl p-3 space-y-2 bg-white/[0.02]">
                              <p className="text-[10px] text-white/40">Moving to: <span className="text-white/70 font-semibold">{orderPending?.label}</span></p>
                              <textarea value={orderNotes[order.id] || ""} onChange={e => setOrderNotes(prev => ({ ...prev, [order.id]: e.target.value }))}
                                placeholder="Add a note (optional)"
                                rows={2} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none resize-none" />
                              <div className="flex gap-2">
                                <button onClick={async () => { if (orderPending) { await updateOrderStage(order.id, orderPending.stage); setOrderPending(null); } }}
                                  disabled={updatingOrder === order.id}
                                  className="flex-1 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                                  {updatingOrder === order.id ? "Saving..." : "Confirm"}
                                </button>
                                <button onClick={() => { setOrderPending(null); setOrderNotes(prev => ({ ...prev, [order.id]: "" })); }}
                                  className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {updatingOrder === order.id && <div className="flex justify-center"><Loader2 size={12} className="animate-spin text-white/30" /></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Nothing to update */}
        {sampleRequests.length === 0 && orders.length === 0 && (
          <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
            <Package size={28} className="text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No active sample or orders for this product</p>
          </div>
        )}
      </div>
    </div>
  );
}
