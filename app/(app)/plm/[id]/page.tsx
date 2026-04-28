"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Package, ArrowLeft, Factory, Layers, Check, Loader2, Users,
  X, Plus, ImagePlus, Trash2, Pencil
} from "lucide-react";

// ── DEVELOPMENT STAGES (product level) ───────────────────────
const DEV_STAGES = [
  { key: "concept", label: "Concept", color: "#6b7280" },
  { key: "ready_for_quote", label: "Ready for Quote", color: "#ec4899" },
  { key: "artwork_sent", label: "Artwork Sent", color: "#8b5cf6" },
  { key: "quotes_received", label: "Quotes Received", color: "#3b82f6" },
  { key: "samples_requested", label: "Samples Requested", color: "#f59e0b" },
  { key: "sample_approved", label: "Sample Approved", color: "#10b981" },
];

// ── ORDER STAGES (order level, factory updates) ───────────────
const ORDER_STAGES = [
  { key: "po_issued", label: "PO Issued", color: "#f59e0b" },
  { key: "production_started", label: "Production Started", color: "#f59e0b" },
  { key: "production_complete", label: "Production Complete", color: "#10b981" },
  { key: "qc_inspection", label: "QC Inspection", color: "#f59e0b" },
  { key: "ready_to_ship", label: "Ready to Ship", color: "#3b82f6" },
  { key: "shipped", label: "Shipped", color: "#10b981" },
];

const ALL_STAGES = [...DEV_STAGES, ...ORDER_STAGES];

function stageInfo(key: string) {
  return ALL_STAGES.find(s => s.key === key) || { key, label: key, color: "#6b7280" };
}

function InlineField({ label, value, onSave, multiline = false, type = "text", disabled = false }: {
  label: string; value: string; onSave: (v: string) => Promise<void>; multiline?: boolean; type?: string; disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(val);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-white/30 uppercase tracking-widest">{label}</p>
        {!editing && !disabled && (
          <button onClick={() => { setVal(value || ""); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 transition p-1 rounded text-white/30 hover:text-white/60">
            <Pencil size={10} />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-1.5">
          {multiline ? (
            <textarea value={val} onChange={e => setVal(e.target.value)} rows={3}
              className="w-full bg-white/[0.04] border border-white/20 rounded-xl px-3 py-2 text-white/80 text-sm focus:outline-none resize-none" autoFocus />
          ) : (
            <input type={type} value={val} onChange={e => setVal(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/20 rounded-xl px-3 py-2 text-white/80 text-sm focus:outline-none" autoFocus
              onKeyDown={e => e.key === "Enter" && save()} />
          )}
          <div className="flex gap-1.5">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold disabled:opacity-40">
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Save
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/30 text-xs">Cancel</button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-white/70 whitespace-pre-wrap min-h-[20px]">{value || <span className="text-white/20 italic">Not set</span>}</p>
      )}
    </div>
  );
}

export default function ProductPage() {
  const { id } = useParams();
  const router = useRouter();
  const showApproveBanner = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("approve") === "1";
  const [approvingProduct, setApprovingProduct] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [factories, setFactories] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);



  // Dev stage
  const [updatingDevStage, setUpdatingDevStage] = useState(false);
  const [devStageNote, setDevStageNote] = useState("");
  const [pendingDevStage, setPendingDevStage] = useState<string | null>(null);

  // Sample requests
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [sampleFactoryIds, setSampleFactoryIds] = useState<string[]>([]);
  const [sampleNote, setSampleNote] = useState("");
  const [sampleArrivalDate, setSampleArrivalDate] = useState("");
  const [requestingSamples, setRequestingSamples] = useState(false);
  const [sampleSuccess, setSampleSuccess] = useState("");
  const [updatingSampleStage, setUpdatingSampleStage] = useState<string | null>(null);
  const [additionalSampleModal, setAdditionalSampleModal] = useState<{factoryId: string, factoryName: string} | null>(null);
  const [additionalSampleQty, setAdditionalSampleQty] = useState("1");
  const [additionalSampleNote, setAdditionalSampleNote] = useState("");
  const [deletingRound, setDeletingRound] = useState<string | null>(null);
  const [revisionNote, setRevisionNote] = useState<Record<string, string>>({});
  const [showRevisionInput, setShowRevisionInput] = useState<string | null>(null);
  const [sampleOutcomePending, setSampleOutcomePending] = useState<{id: string, factoryId: string, stage: string, notes: string, outcome: string} | null>(null);
  const [samplePin, setSamplePin] = useState("");
  const [samplePinError, setSamplePinError] = useState("");
  const [submittingSamplePin, setSubmittingSamplePin] = useState(false);

  // Order factory edit
  const [editingOrderFactory, setEditingOrderFactory] = useState<string | null>(null);
  const [orderFactoryVal, setOrderFactoryVal] = useState("");
  const [savingOrderFactory, setSavingOrderFactory] = useState(false);

  // Order stage note
  const [orderStageNote, setOrderStageNote] = useState<Record<string, string>>({});

  // Orders
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({ factory_id: "", order_quantity: "", unit_price: "", tariff: "", freight: "", duty: "", margin_pct: "0", linked_po_number: "", payment_terms: "", batch_notes: "" });
  const [orderFinancials, setOrderFinancials] = useState<Record<string, any>>({});
  const [savingFinancials, setSavingFinancials] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  // Disqualify
  const [disqualifyModal, setDisqualifyModal] = useState<{ track: any } | null>(null);
  const [disqualifyReason, setDisqualifyReason] = useState("price");
  const [disqualifyNote, setDisqualifyNote] = useState("");
  const [disqualifying, setDisqualifying] = useState(false);

  useEffect(() => {
    const handler = (e: any) => { setDisqualifyReason("price"); setDisqualifyNote(""); setDisqualifyModal({ track: e.detail }); };
    window.addEventListener("disqualify-track", handler);
    return () => window.removeEventListener("disqualify-track", handler);
  }, []);
  const [updatingOrderStage, setUpdatingOrderStage] = useState<string | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);

  // Factory tracks
  const [tracks, setTracks] = useState<any[]>([]);
  const [addingFactory, setAddingFactory] = useState(false);
  const [expandedNoteTrackId, setExpandedNoteTrackId] = useState<string|null>(null);
  const [newTrackFactoryId, setNewTrackFactoryId] = useState<string[]>([]);
  const [updatingStage, setUpdatingStage] = useState<string | null>(null);
  const [skipModal, setSkipModal] = useState<{trackId: string, productId: string, factoryId: string, stage: string} | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [expectedDateModal, setExpectedDateModal] = useState<{trackId: string, productId: string, factoryId: string, stage: string} | null>(null);
  const [expectedDate, setExpectedDate] = useState("");
  const [approveModal, setApproveModal] = useState<{track: any} | null>(null);
  const [approvePrice, setApprovePrice] = useState("");
  const [approvingTrack, setApprovingTrack] = useState(false);
  const [killModal, setKillModal] = useState<{track: any} | null>(null);
  const [killNotes, setKillNotes] = useState("");
  const [killingTrack, setKillingTrack] = useState(false);
  const [revisionModal, setRevisionModal] = useState<{track: any} | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [requestingRevision, setRequestingRevision] = useState(false);
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);
  const [assignMessagesModal, setAssignMessagesModal] = useState(false);
  const [assignMsgTeamMembers, setAssignMsgTeamMembers] = useState<any[]>([]);
  const [assignMsgSelectedMembers, setAssignMsgSelectedMembers] = useState<string[]>([]);
  const [assignMsgSelectedTracks, setAssignMsgSelectedTracks] = useState<string[]>([]);
  const [assignMsgLoading, setAssignMsgLoading] = useState(false);
  const [assignMsgExistingMembers, setAssignMsgExistingMembers] = useState<Record<string, string[]>>({});

  // Images
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImage, setDeletingImage] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [dragOverImage, setDragOverImage] = useState(false);

  const [assignmentRequests, setAssignmentRequests] = useState<any[]>([]);

  const loadAssignmentRequests = async () => {
    const res = await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_assignment_requests" }) });
    const data = await res.json();
    setAssignmentRequests((data.requests || []).filter((r: any) => r.product_id === id));
  };

  const load = async () => {
    const [prodRes, catRes, colRes, tracksRes] = await Promise.all([
      fetch(`/api/plm?type=product&id=${id}`),
      fetch("/api/catalog?type=factories"),
      fetch("/api/plm?type=collections"),
      fetch(`/api/plm/tracks?product_id=${id}`),
    ]);
    const prodData = await prodRes.json();
    const catData = await catRes.json();
    const colData = await colRes.json();
    const tracksData = await tracksRes.json();
    setProduct(prodData.product);
    setFactories(catData.factories || []);
    setCollections(colData.collections || []);

    const allTracks = tracksData.tracks || [];
    setTracks(allTracks);

    // Load message counts for all tracks
    if (allTracks.length > 0) {
      const msgCounts = await Promise.all(allTracks.map(async (t: any) => {
        const res = await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_message_counts", track_id: t.id }) });
        const data = await res.json();
        return { track_id: t.id, total: data.total || 0, unread: data.unread || 0 };
      }));
      setTrackMessageCounts(msgCounts);
    }
    setLoading(false);
  };

  useEffect(() => { load(); loadAssignmentRequests(); }, [id]);

  const approveProduct = async () => {
    setApprovingProduct(true);
    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_product", id }) });
    setApprovingProduct(false);
    setApproveSuccess(true);
    load();
  };

  const saveField = async (field: string, value: string) => {
    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_product", id: product.id, [field]: value || null }) });
    load();
  };

  const saveCollectionField = async (value: string) => {
    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_product", id: product.id, collection_id: value || null }) });
    load();
  };

  const updateDevStage = async (stage: string, note?: string) => {
    setUpdatingDevStage(true);
    const noteText = note || devStageNote;
    // Build new notes: append "Stage: [note]" to existing notes
    let updatedNotes = product.notes || "";
    if (noteText) {
      const stageLabel = DEV_STAGES.find(s => s.key === stage)?.label || stage;
      const entry = `${stageLabel}: ${noteText}`;
      updatedNotes = updatedNotes ? `${updatedNotes}
${entry}` : entry;
    }
    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_product", id: product.id, current_stage: stage, ...(noteText ? { notes: updatedNotes, _stage_note: noteText } : {}) }) });
    setUpdatingDevStage(false);
    setPendingDevStage(null);
    setDevStageNote("");
    load();
  };

  const [sampleProviderModal, setSampleProviderModal] = useState<{factory_ids: string[], note: string} | null>(null);
  const [messagesModal, setMessagesModal] = useState<{track: any} | null>(null);
  const [trackMessageCounts, setTrackMessageCounts] = useState<{track_id: string, total: number, unread: number}[]>([]);
  const [trackMessages, setTrackMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagePollingRef = useRef<NodeJS.Timeout | null>(null);
  const messagesBottomRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [firstUnreadIndex, setFirstUnreadIndex] = useState<number>(-1);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"progression"|"hold"|"killed"|null>(null);
  const [statusPin, setStatusPin] = useState("");
  const [statusPinError, setStatusPinError] = useState("");
  const [settingStatus, setSettingStatus] = useState(false);

  const requestSamples = async (provider?: string, forceFlag?: boolean) => {
    if (!sampleFactoryIds.length) return;
    setRequestingSamples(true);
    const res = await fetch("/api/plm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_sample_requests", product_id: id, factory_ids: sampleFactoryIds, note: sampleNote, provider, force: forceFlag || false }),
    });
    const data = await res.json();
    setRequestingSamples(false);

    setShowSampleModal(false);
    // Also mark sample_requested on factory tracks for each factory
    const tracksData = await fetch(`/api/plm/tracks?product_id=${id}`).then(r => r.json());
    const allTracks = tracksData.tracks || [];
    for (const fid of sampleFactoryIds) {
      const track = allTracks.find((t: any) => t.factory_id === fid);
      if (track) {
        const revNum = (track.plm_track_stages || []).filter((s: any) => s.stage === "revision_requested").length;
        await fetch("/api/plm/tracks", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update_stage", track_id: track.id, product_id: id, factory_id: fid, stage: "sample_requested", status: "done", revision_number: revNum, actual_date: new Date().toISOString().split("T")[0], notes: sampleNote || null }),
        });
      }
    }
    // Auto-send message to each factory with sample request details
    const arrivalDate = sampleArrivalDate;
    for (const fid of sampleFactoryIds) {
      const track = allTracks.find((t: any) => t.factory_id === fid);
      if (track) {
        let msg = "Sample requested.";
        if (sampleNote) msg += " Note: " + sampleNote;
        if (arrivalDate) msg += " Est. arrival by: " + new Date(arrivalDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        await fetch("/api/plm/tracks", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send_message", track_id: track.id, product_id: id, message: msg }),
        });
      }
    }

    setSampleFactoryIds([]);
    setSampleNote("");
    setSampleArrivalDate("");
    const requested = (data.factories || []).map((f: any) => f.name);
    const skipped = data.skipped || [];
    let msg = requested.length > 0 ? `Sample requested from ${requested.join(", ")}` : "";
    if (skipped.length > 0) msg += (msg ? " — " : "") + `Already active for: ${skipped.join(", ")}`;
    setSampleSuccess(msg || "No new samples created");
    setTimeout(() => setSampleSuccess(""), 4000);
    load();
  };

  const updateSampleStage = async (sampleRequestId: string, factoryId: string, stage: string, notes?: string, outcome?: string, pin?: string) => {
    setUpdatingSampleStage(sampleRequestId);
    const res = await fetch("/api/plm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_sample_stage", sample_request_id: sampleRequestId, product_id: id, factory_id: factoryId, stage, notes: notes || "", outcome, pin: pin || "" }),
    });
    const data = await res.json();
    setUpdatingSampleStage(null);
    if (data.error === "pin_required") return false;
    load();
    return true;
  };

  const setProductStatus = async (status: string, pin: string) => {
    setSettingStatus(true);
    setStatusPinError("");
    const res = await fetch("/api/plm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_product_status", product_id: id, status, pin }),
    });
    const data = await res.json();
    setSettingStatus(false);
    if (data.error === "pin_required") {
      setStatusPinError("Incorrect PIN. Try again.");
      return false;
    }
    setShowStatusModal(false);
    setPendingStatus(null);
    setStatusPin("");
    setStatusPinError("");
    load();
    return true;
  };

  const triggerSampleOutcome = (id: string, factoryId: string, stage: string, notes: string, outcome: string) => {
    setSampleOutcomePending({ id, factoryId, stage, notes, outcome });
    setSamplePin("");
    setSamplePinError("");
  };

  const confirmSampleOutcome = async () => {
    if (!sampleOutcomePending) return;
    setSubmittingSamplePin(true);
    setSamplePinError("");
    const success = await updateSampleStage(
      sampleOutcomePending.id, sampleOutcomePending.factoryId,
      sampleOutcomePending.stage, sampleOutcomePending.notes,
      sampleOutcomePending.outcome, samplePin
    );
    setSubmittingSamplePin(false);
    if (success === false) {
      setSamplePinError("Incorrect PIN. Try again.");
    } else {
      setSampleOutcomePending(null);
      setSamplePin("");
    }
  };

  const saveOrderFactory = async (orderId: string) => {
    setSavingOrderFactory(true);
    await fetch("/api/plm/batch", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_batch", id: orderId, factory_id: orderFactoryVal || null }) });
    setSavingOrderFactory(false);
    setEditingOrderFactory(null);
    load();
  };



  const createOrder = async () => {
    setSavingOrder(true);
    const unitPrice = parseFloat((newOrder as any).unit_price) || 0;
    const tariffPct = parseFloat((newOrder as any).tariff) || 0;
    const freightPct = parseFloat((newOrder as any).freight) || 0;
    const dutyPct = parseFloat((newOrder as any).duty) || 0;
    const tariff = unitPrice * tariffPct / 100;
    const freight = unitPrice * freightPct / 100;
    const duty = unitPrice * dutyPct / 100;
    const calcElc = unitPrice + tariff + freight + duty;
    const marginPct = parseFloat((newOrder as any).margin_pct) || 0;
    const calcSellPrice = calcElc > 0 && marginPct > 0 ? calcElc / (1 - marginPct / 100) : null;
    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_batch", product_id: id, stage: "po_issued",
        factory_id: newOrder.factory_id || null,
        order_quantity: newOrder.order_quantity ? parseInt(newOrder.order_quantity) : null,
        unit_price: unitPrice || null,
        tariff: tariff || null,
        freight: freight || null,
        duty: duty || null,
        elc: calcElc || null,
        sell_price: calcSellPrice || null,
        margin: marginPct || null,
        linked_po_number: newOrder.linked_po_number || null,
        payment_terms: (newOrder as any).payment_terms || null,
        batch_notes: newOrder.batch_notes || null,
      }) });
    setSavingOrder(false);
    setShowNewOrder(false);
    setNewOrder({ factory_id: "", order_quantity: "", unit_price: "", tariff: "", freight: "", duty: "", margin_pct: "0", linked_po_number: "", payment_terms: "", batch_notes: "" } as any);
    load();
  };

  const updateOrderStage = async (orderId: string, stage: string) => {
    setUpdatingOrderStage(orderId);
    const note = orderStageNote[orderId] || "";
    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_batch_stage", batch_id: orderId, product_id: id, stage, notes: note }) });
    setUpdatingOrderStage(null);
    setOrderStageNote(prev => ({ ...prev, [orderId]: "" }));
    load();
  };

  const saveOrderField = async (orderId: string, field: string, value: any) => {
    await fetch("/api/plm/batch", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_batch", id: orderId, [field]: value || null }) });
    load();
  };

  const deleteOrder = async (orderId: string) => {
    setDeletingOrder(orderId);
    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_batch", id: orderId }) });
    setDeletingOrder(null);
    load();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("product_id", id as string);
    await fetch("/api/plm/upload", { method: "POST", body: formData });
    setUploadingImage(false);
    load();
  };

  const setCoverImage = async (url: string) => {
    const images = product.images || [];
    const reordered = [url, ...images.filter((img: string) => img !== url)];
    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_product", id: product.id, images: reordered }) });
    load();
  };

  const handleImageDelete = async (url: string) => {
    setDeletingImage(url);
    await fetch("/api/plm/upload", { method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: id, url }) });
    setDeletingImage(null);
    load();
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 size={20} className="animate-spin text-white/20" /></div>;
  if (!product) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><p className="text-white/30">Product not found</p></div>;

  const orders = (product.plm_batches || []).sort((a: any, b: any) => a.batch_number - b.batch_number);
  const productStatus = product.status || "progression";
  const isKilled = productStatus === "killed";
  const isHold = productStatus === "hold";
  const isLocked = isKilled || isHold;

  const currentDevStage = stageInfo(product.current_stage || "concept");
  const ic = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20 transition";
  const lc = "text-[10px] text-white/30 uppercase tracking-widest mb-1 block";

  // Build full history from all sources
  const productHistory = [
    ...(product.plm_stages || []),
    ...(product.plm_batches || []).flatMap((b: any) =>
      (b.plm_batch_stages || []).map((s: any) => ({ ...s, _order_num: b.batch_number, _type: "order" }))
    ),
    ...(product.plm_sample_requests || []).flatMap((sr: any) => {
      const factory = sr.factory_catalog;
      return (sr.plm_sample_stages || []).map((s: any) => ({
        ...s,
        _factory_name: factory?.name,
        _type: "sample",
        stage: s.stage,
      }));
    }),
    ...(product.plm_factory_tracks || []).flatMap((track: any) => {
      const factory = track.factory_catalog;
      return (track.plm_track_stages || [])
        .filter((s: any) => s.status === "done" || s.status === "skipped")
        .map((s: any) => ({
          ...s,
          _factory_name: factory?.name,
          _type: "track",
          stage: s.stage,
        }));
    }),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const HISTORY_LABELS: Record<string, { label: string; color: string }> = {
    concept: { label: "Concept", color: "#6b7280" },
    ready_for_quote: { label: "Ready for Quote", color: "#ec4899" },
    artwork_sent: { label: "Artwork Sent", color: "#8b5cf6" },
    quotes_received: { label: "Quotes Received", color: "#3b82f6" },
    samples_requested: { label: "Samples Requested", color: "#f59e0b" },
    sample_approved: { label: "Sample Approved", color: "#10b981" },
    status_progression: { label: "▶ Set to Progression", color: "#10b981" },
    status_hold: { label: "⏸ Put on Hold", color: "#f59e0b" },
    status_killed: { label: "● Killed", color: "#ef4444" },
    unkilled: { label: "● Revived", color: "#10b981" },
    sample_production: { label: "Sample Production", color: "#f59e0b" },
    sample_complete: { label: "Sample Complete", color: "#10b981" },
    sample_shipped: { label: "Sample Shipped", color: "#3b82f6" },
    sample_arrived: { label: "Sample Arrived", color: "#8b5cf6" },
    revision_requested: { label: "Revision Requested", color: "#f59e0b" },
    killed: { label: "Killed", color: "#ef4444" },
    po_issued: { label: "PO Issued", color: "#f59e0b" },
    production_started: { label: "Production Started", color: "#f59e0b" },
    production_complete: { label: "Production Complete", color: "#10b981" },
    qc_inspection: { label: "QC Inspection", color: "#f59e0b" },
    ready_to_ship: { label: "Ready to Ship", color: "#3b82f6" },
    shipped: { label: "Shipped", color: "#10b981" },
    // Track stages
    quote_requested: { label: "Quote Requested", color: "#ec4899" },
    quote_received: { label: "Quote Received", color: "#3b82f6" },
    sample_reviewed: { label: "Sample Reviewed", color: "#10b981" },
    skipped: { label: "Skipped", color: "#6b7280" },
    priority_updated: { label: "🔢 Priority Updated", color: "#60a5fa" },
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white"
      onDragOver={e => e.preventDefault()}
      onDrop={e => e.preventDefault()}>

      {/* Notes expand modal */}
      {expandedNoteTrackId && (() => {
        const t = tracks.find((tr: any) => tr.id === expandedNoteTrackId);
        if (!t) return null;
        const notes = (t.notes || "").split("\n").filter(Boolean);
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setExpandedNoteTrackId(null)}>
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">{t.factory_catalog?.name} — Notes</p>
                <button onClick={() => setExpandedNoteTrackId(null)} className="text-white/30 hover:text-white/60 text-xs">✕</button>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {notes.length === 0 ? <p className="text-xs text-white/30">No notes yet</p> : notes.map((note: string, i: number) => (
                  <p key={i} className="text-xs text-white/60 leading-relaxed border-b border-white/[0.04] pb-2 last:border-0">{note}</p>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Locked banner */}
      {isKilled && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-8 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400 font-medium">This product has been killed. Revive it from the status menu to make changes.</p>
        </div>
      )}
      {isHold && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-8 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400 font-medium">This product is on hold — stages, samples and orders are locked. Product info can still be edited.</p>
        </div>
      )}

      {/* Assignment Request Banner */}
      {assignmentRequests.length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-8 py-3">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold text-amber-400 mb-2">⚡ Pending Assignment Requests</p>
            <div className="flex flex-wrap gap-3">
              {assignmentRequests.map((req: any) => (
                <div key={req.id} className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                  <p className="text-xs text-white/70"><span className="font-semibold">{req.factory_portal_users?.name}</span> wants to be assigned</p>
                  <button onClick={async () => {
                    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "handle_assignment_request", request_id: req.id, approve: true }) });
                    loadAssignmentRequests(); load();
                  }} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition">✓ Approve</button>
                  <button onClick={async () => {
                    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "handle_assignment_request", request_id: req.id, approve: false }) });
                    loadAssignmentRequests();
                  }} className="text-[10px] px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition">✕ Reject</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sample Request Modal */}
      {showSampleModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Request Samples</p>
              <button onClick={() => setShowSampleModal(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Select Factories</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {factories.map((f: any) => (
                  <button key={f.id} onClick={() => setSampleFactoryIds(prev => prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id])}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-left transition border ${sampleFactoryIds.includes(f.id) ? "border-amber-500/30 bg-amber-500/10" : "border-white/[0.06] hover:bg-white/[0.03]"}`}>
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${sampleFactoryIds.includes(f.id) ? "border-amber-400 bg-amber-500" : "border-white/20"}`}>
                      {sampleFactoryIds.includes(f.id) && <Check size={9} className="text-black" />}
                    </div>
                    <div>
                      <p className="text-white/70 font-medium">{f.name}</p>
                      {f.email && <p className="text-white/25 text-[10px]">{f.email}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Note (optional)</p>
              <textarea value={sampleNote} onChange={e => setSampleNote(e.target.value)}
                placeholder="e.g. Priority samples needed by May 1st"
                rows={2} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Request date</p>
                <input type="date" id="sampleRequestDate" defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none" />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Est. arrival date</p>
                <input type="date" value={sampleArrivalDate} onChange={e => setSampleArrivalDate(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => requestSamples()} disabled={requestingSamples || sampleFactoryIds.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400 transition disabled:opacity-40">
                {requestingSamples ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                Request from {sampleFactoryIds.length} {sampleFactoryIds.length === 1 ? "Factory" : "Factories"}
              </button>
              <button onClick={() => setShowSampleModal(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Additional Sample Modal */}
      {additionalSampleModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Request Additional Sample</p>
              <button onClick={() => setAdditionalSampleModal(null)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
            <p className="text-xs text-white/40">From <span className="text-white/70">{additionalSampleModal.factoryName}</span></p>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">How many samples?</p>
              <input type="number" min="1" max="9999" value={additionalSampleQty}
                onChange={e => setAdditionalSampleQty(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none text-center" />
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Reason / Note</p>
              <textarea value={additionalSampleNote} onChange={e => setAdditionalSampleNote(e.target.value)}
                placeholder="e.g. Need samples for Target meeting on May 1st"
                rows={3} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={async () => {
                setRequestingSamples(true);
                await fetch("/api/plm", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "create_sample_requests",
                    product_id: id,
                    factory_ids: [additionalSampleModal.factoryId],
                    note: additionalSampleNote || `Additional sample request`,
                    qty: parseInt(additionalSampleQty),
                    force: true,
                    label: "additional",
                    provider: "gmail",
                  }),
                });
                setRequestingSamples(false);
                setAdditionalSampleModal(null);
                setAdditionalSampleNote("");
                load();
              }} disabled={requestingSamples}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400 transition disabled:opacity-40">
                {requestingSamples ? "Requesting..." : `Request ${additionalSampleQty} Sample(s)`}
              </button>
              <button onClick={() => setAdditionalSampleModal(null)}
                className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Sample Email Provider Modal */}
      {sampleProviderModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <p className="text-sm font-semibold">Send via which email?</p>
            <p className="text-xs text-white/40">Both Gmail and Outlook are connected. Choose which to send from.</p>
            <div className="flex gap-2">
              <button onClick={async () => {
                const isForce = sampleProviderModal?.note?.includes("Additional") || false;
                setSampleProviderModal(null);
                await requestSamples("gmail", isForce);
              }} className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold">Gmail</button>
              <button onClick={async () => {
                const isForce = sampleProviderModal?.note?.includes("Additional") || false;
                setSampleProviderModal(null);
                await requestSamples("outlook", isForce);
              }} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-xs font-semibold">Outlook</button>
            </div>
            <button onClick={() => setSampleProviderModal(null)} className="w-full text-center text-xs text-white/20 hover:text-white/40">Cancel</button>
          </div>
        </div>
      )}

      {/* Sample Outcome PIN Modal */}
      {sampleOutcomePending && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <p className="text-sm font-semibold">Admin PIN Required</p>
            <p className="text-xs text-white/40">
              Enter your PIN to confirm: <strong className="text-white/60">
                {sampleOutcomePending.outcome === "approved" ? "Approve Sample" :
                 sampleOutcomePending.outcome === "revision" ? "Request Revision" :
                 sampleOutcomePending.outcome === "unkill" ? "Revive Factory" :
                 sampleOutcomePending.notes?.includes("Product killed") ? "Kill Product" : "Kill Factory"}
              </strong>
            </p>
            {sampleOutcomePending.outcome === "revision" && sampleOutcomePending.notes && (
              <p className="text-xs text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">Note: {sampleOutcomePending.notes}</p>
            )}
            <input type="password" value={samplePin} onChange={e => setSamplePin(e.target.value)}
              placeholder="Enter PIN" autoFocus
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none text-center tracking-widest"
              onKeyDown={e => e.key === "Enter" && confirmSampleOutcome()} />
            {samplePinError && <p className="text-xs text-red-400">{samplePinError}</p>}
            <div className="flex gap-2">
              <button onClick={confirmSampleOutcome} disabled={!samplePin || submittingSamplePin}
                className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                {submittingSamplePin ? "Confirming..." : "Confirm"}
              </button>
              <button onClick={() => { setSampleOutcomePending(null); setSamplePin(""); setSamplePinError(""); }}
                className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change PIN Modal */}
      {showStatusModal && pendingStatus && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-white">Confirm Status Change</p>
              <p className="text-xs text-white/40 mt-1">
                Switch to{" "}
                <span className={`font-semibold ${pendingStatus === "killed" ? "text-red-400" : pendingStatus === "hold" ? "text-amber-400" : "text-emerald-400"}`}>
                  {pendingStatus === "killed" ? "Killed" : pendingStatus === "hold" ? "Hold" : "Progression"}
                </span>
                {" "}— enter Admin PIN to confirm
              </p>

              {pendingStatus === "hold" && <p className="text-[11px] text-amber-400/60 mt-1.5">Product info editable but no progression allowed.</p>}
            </div>
            <input type="password" value={statusPin} onChange={e => setStatusPin(e.target.value)}
              placeholder="Enter PIN" autoFocus
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none text-center tracking-widest"
              onKeyDown={e => e.key === "Enter" && setProductStatus(pendingStatus, statusPin)} />
            {statusPinError && <p className="text-xs text-red-400">{statusPinError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setProductStatus(pendingStatus, statusPin)} disabled={!statusPin || settingStatus}
                className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                {settingStatus ? "Confirming..." : "Confirm"}
              </button>
              <button onClick={() => { setShowStatusModal(false); setPendingStatus(null); setStatusPin(""); setStatusPinError(""); }}
                className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Approve banner */}
      {showApproveBanner && product?.approval_status === "pending_review" && !approveSuccess && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-amber-500/30 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <div className="w-3 h-3 rounded-full bg-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Pending Approval</p>
                <p className="text-xs text-white/40">A designer submitted this product for review</p>
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold">{product?.name}</p>
              {product?.sku && <p className="text-xs text-white/30 font-mono">{product.sku}</p>}
              {product?.description && <p className="text-xs text-white/40 mt-1">{product.description}</p>}
              {product?.specs && <p className="text-xs text-white/30 mt-1">{product.specs}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={approveProduct} disabled={approvingProduct}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 transition disabled:opacity-50">
                {approvingProduct ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve Product
              </button>
              <button onClick={() => window.history.replaceState({}, "", window.location.pathname)}
                className="px-4 rounded-xl border border-white/[0.08] text-white/30 text-sm hover:text-white/60 transition">Review First</button>
            </div>
          </div>
        </div>
      )}
      {approveSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-6 py-3 flex items-center gap-2 shadow-xl">
          <Check size={14} className="text-emerald-400" />
          <p className="text-sm text-emerald-300 font-medium">Product approved — all milestones marked complete</p>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => router.push("/plm")} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition mb-4">
            <ArrowLeft size={12} />Back to PLM
          </button>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold">{product.name}</h1>
                {product.sku && <span className="text-xs text-white/30 font-mono bg-white/[0.04] px-2 py-0.5 rounded-lg">{product.sku}</span>}

                {/* Action Status inline */}
                {product.action_status && product.action_status !== "up_to_date" && (
                  <div className={`flex items-start gap-2 px-3 py-1.5 rounded-xl border max-w-[200px] ${product.action_status === "action_required" ? "bg-red-500/10 border-red-500/25" : "bg-blue-500/10 border-blue-500/25"}`}>
                    <span className={`text-[10px] font-bold leading-snug ${product.action_status === "action_required" ? "text-red-400" : "text-blue-400"}`}>
                      {product.action_status === "action_required" ? "⚡ Action Required — needs your attention" : "● Updates Made — factory has progressed"}
                    </span>
                    <button onClick={async () => {
                      await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "dismiss_action", product_id: product.id }) });
                      load();
                    }} className="text-white/20 hover:text-white/50 transition text-xs leading-none flex-shrink-0 mt-0.5">×</button>
                  </div>
                )}
                {/* Product Status Dropdown */}
                <div className="relative">
                  <button onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
                    isKilled ? "bg-red-500/15 border-red-500/30 text-red-400" :
                    isHold ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
                    "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  }`}>
                    {isKilled ? "● Killed" : isHold ? "⏸ Hold" : "▶ Progression"}
                    ▾
                  </button>
                  {showStatusDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowStatusDropdown(false)} />
                      <div className="absolute top-full left-0 mt-2 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20 min-w-[180px]">
                        <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pt-3 pb-1">Product Status</p>
                        {(["progression","killed"] as const).map(s => (
                          <button key={s} onClick={() => { setShowStatusDropdown(false); setPendingStatus(s); setShowStatusModal(true); }}
                            disabled={productStatus === s}
                            className={`w-full text-left px-3 py-2.5 text-xs transition flex items-center gap-2 ${productStatus === s ? "text-white/20 cursor-default bg-white/[0.03]" : "text-white/60 hover:bg-white/[0.05] hover:text-white"}`}>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s === "killed" ? "bg-red-400" : "bg-emerald-400"}`} />
                            {s === "killed" ? "Kill Product" : "Set to Progression"}
                            {productStatus === s && <span className="ml-auto text-[10px] text-white/20">Current</span>}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-white/30">
                {product.plm_collections && <span className="flex items-center gap-1"><Layers size={10} />{product.plm_collections.name}</span>}
                {product.category && <span>{product.category}</span>}
              </div>
            </div>
            {/* Assigned Team - top right */}
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              <p className="text-[10px] text-white/25 uppercase tracking-widest">Assigned Team</p>
              <div className="flex flex-col items-end gap-1.5">
                {(product.plm_assignments || []).map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <span className="text-[11px] text-white/50">{a.factory_portal_users?.name || a.factory_portal_users?.email}</span>
                    <div className="w-6 h-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[9px] text-white/50 font-bold">
                      {(a.factory_portal_users?.name || a.factory_portal_users?.email || "?")[0].toUpperCase()}
                    </div>
                    <button onClick={async () => {
                      const currentIds = (product.plm_assignments || []).map((x: any) => x.designer_id).filter((x: string) => x !== a.designer_id);
                      await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign_product", product_id: product.id, designer_ids: currentIds }) });
                      load();
                    }} className="text-white/20 hover:text-red-400 transition text-xs">×</button>
                  </div>
                ))}
                {(product.plm_assignments || []).length === 0 && <p className="text-[11px] text-white/20">No one assigned</p>}
                <AssignTeamMember productId={product.id} currentAssignments={product.plm_assignments || []} onAssign={() => load()} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6">

          {/* ── FACTORY TRACKS SECTION ── */}
          {(() => {
            const FIRST_CYCLE_STAGES = [
              { key: "artwork_sent",      label: "Artwork Sent",      color: "#8b5cf6", type: "completion" },
              { key: "quote_requested",   label: "Quote Requested",   color: "#ec4899", type: "completion", askEstimate: true, estimateLabel: "Estimated date to receive quote", estimateTarget: "quote_received" },
              { key: "quote_received",    label: "Quote Received",    color: "#3b82f6", type: "completion", hasPrice: true },
            ];
            const SAMPLE_CYCLE_STAGES = [
              { key: "sample_requested",  label: "Sample Requested",  color: "#f59e0b", type: "completion", askEstimate: true, estimateLabel: "Estimated sample arrival date", estimateTarget: "sample_arrived" },
              { key: "sample_production", label: "In Production",     color: "#f59e0b", type: "completion" },
              { key: "sample_complete",   label: "Sample Complete",   color: "#10b981", type: "completion" },
              { key: "sample_shipped",    label: "Sample Shipped",    color: "#3b82f6", type: "completion" },
              { key: "sample_arrived",    label: "Sample Arrived",    color: "#8b5cf6", type: "completion" },
              { key: "sample_reviewed",   label: "Sample Reviewed",   color: "#10b981", type: "review" },
            ];
            const COLLAPSIBLE_KEYS = ["sample_production","sample_complete","sample_shipped","sample_arrived"];

            const getStageStatus = (track: any, stageKey: string, revNum: number) => {
              return (track.plm_track_stages || []).find((s: any) => s.stage === stageKey && s.revision_number === revNum);
            };
            const getCurrentRevision = (track: any) => {
              return (track.plm_track_stages || []).filter((s: any) => s.stage === "revision_requested").length;
            };
            const hasSampleArrived = (track: any, revNum: number) => {
              return (track.plm_track_stages || []).some((s: any) => s.stage === "sample_arrived" && s.status === "done" && s.revision_number === revNum);
            };
            const markStage = async (track: any, stageKey: string, status: string, revNum: number, extra?: any) => {
              setUpdatingStage(`${track.id}-${stageKey}-${revNum}`);
              await fetch("/api/plm/tracks", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "update_stage", track_id: track.id, product_id: product.id, factory_id: track.factory_id, stage: stageKey, status, revision_number: revNum, ...extra }),
              });
              setUpdatingStage(null);
              load();
            };
            const availableFactories = factories.filter((f: any) => !tracks.some(t => t.factory_id === f.id));

            const StageRow = ({ track, stageDef, revNum, isLatest, collapsed }: any) => {
              const isApproved = track.status === "approved";
              const isKilledTrack = track.status === "killed";
              const stageData = getStageStatus(track, stageDef.key, revNum);
              const isDone = stageData?.status === "done";
              const isSkipped = stageData?.status === "skipped";
              const isUpdating = updatingStage === `${track.id}-${stageDef.key}-${revNum}`;
              const canEdit = !isLocked && !isKilledTrack && !isApproved && isLatest;
              const [expanded, setExpanded] = useState(false);
              const [dateVal, setDateVal] = useState(new Date().toISOString().split("T")[0]);
              const [noteVal, setNoteVal] = useState("");
              const [priceVal, setPriceVal] = useState("");
              const [saving, setSaving] = useState(false);

              if (collapsed) return null;

              const isReviewStage = stageDef.key === "sample_reviewed";

              // sample_reviewed should show check if: track approved AND this is the last revision cycle
              const totalRevisions = getCurrentRevision(track);
              const isApprovedReview = isReviewStage && isApproved && revNum === totalRevisions;
              // sample_reviewed shows revision badge if revision was requested AFTER this review
              const revisionAfterThis = isReviewStage && (track.plm_track_stages || []).some((s: any) => s.stage === "revision_requested" && s.revision_number === revNum);

              return (
                <div className={`${isDone ? "bg-white/[0.02] rounded-xl" : ""}`}>
                  <div className={`flex items-start gap-2.5 px-2 py-1.5 rounded-xl group transition ${canEdit && !expanded ? "hover:bg-white/[0.02]" : ""} ${expanded ? "bg-white/[0.03] rounded-b-none" : ""}`}>
                    <button
                      onClick={() => {
                        if (!canEdit || isUpdating || isDone) {
                          if (isDone && canEdit) markStage(track, stageDef.key, "pending", revNum);
                          return;
                        }
                        setExpanded(!expanded);
                        setDateVal(new Date().toISOString().split("T")[0]);
                        setNoteVal(stageData?.notes || "");
                        setPriceVal(stageData?.quoted_price ? String(stageData.quoted_price) : "");
                      }}
                      disabled={isUpdating}
                      className="w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 transition hover:scale-110"
                      style={(isDone || isApprovedReview) ? { borderColor: stageDef.color, background: `${stageDef.color}25` } :
                        isSkipped ? { borderColor: "#6b7280", background: "#6b728015" } :
                        expanded ? { borderColor: stageDef.color, background: `${stageDef.color}10` } :
                        { borderColor: "rgba(255,255,255,0.15)" }}>
                      {isUpdating ? <Loader2 size={8} className="animate-spin text-white/40" /> :
                       (isDone || isApprovedReview) ? <Check size={8} style={{ color: stageDef.color }} /> :
                       isSkipped ? <span className="text-[7px] text-white/30">—</span> : null}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px]" style={isDone ? { color: "rgba(255,255,255,0.8)", fontWeight: 600 } : isSkipped ? { color: "rgba(255,255,255,0.2)" } : expanded ? { color: stageDef.color, fontWeight: 500 } : { color: "rgba(255,255,255,0.45)" }}>
                          {stageDef.label}
                        </span>
                        {isApprovedReview && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✓ Approved</span>}
                        {revisionAfterThis && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">↻ Revision requested</span>}
                        {stageData?.expected_date && !isDone && (
                          <span className="text-[9px] text-white/30 bg-white/[0.04] px-1.5 py-0.5 rounded-full">
                            Est {new Date(stageData.expected_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                        {isDone && stageData?.actual_date && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ color: stageDef.color, background: `${stageDef.color}15` }}>
                            {new Date(stageData.actual_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                        {stageData?.quoted_price && <span className="text-[9px] text-emerald-400 font-bold">${stageData.quoted_price}</span>}
                      </div>
                      {stageData?.notes && <p className="text-[10px] text-white/30 mt-0.5 leading-tight">{stageData.notes}</p>}
                      {isSkipped && stageData?.skip_reason && <p className="text-[10px] text-white/20 mt-0.5 italic">{stageData.skip_reason}</p>}
                    </div>
                    {canEdit && !expanded && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                        {!isSkipped && !isDone && (
                          <button onClick={() => { setSkipModal({ trackId: track.id, productId: product.id, factoryId: track.factory_id, stage: stageDef.key }); setSkipReason(""); }}
                            className="text-[8px] px-1.5 py-0.5 rounded border border-white/[0.06] text-white/25 hover:text-white/50 transition">skip</button>
                        )}
                        {isSkipped && (
                          <button onClick={() => markStage(track, stageDef.key, "pending", revNum)}
                            className="text-[8px] px-1.5 py-0.5 rounded border border-white/[0.06] text-white/25 hover:text-white/50 transition">unskip</button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Magnified inline expansion */}
                  {expanded && canEdit && stageDef.type !== "review" && (
                    <div className="mx-2 mb-2 p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl rounded-tl-none space-y-2.5">
                      <div>
                        <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1">Date completed</p>
                        <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white/70 text-xs focus:outline-none" />
                      </div>
                      {stageDef.askEstimate && (
                        <div>
                          <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1">{stageDef.estimateLabel}</p>
                          <input type="date" value={noteVal} onChange={e => setNoteVal(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white/70 text-xs focus:outline-none" />
                        </div>
                      )}
                      {stageDef.hasPrice && (
                        <div>
                          <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1">Price (ELC)</p>
                          <input type="number" step="0.01" value={priceVal} onChange={e => setPriceVal(e.target.value)}
                            placeholder="e.g. 2.45"
                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white/70 text-xs focus:outline-none" />
                        </div>
                      )}
                      {!stageDef.askEstimate && (
                        <div>
                          <p className="text-[9px] text-white/30 uppercase tracking-widest mb-1">Note (optional)</p>
                          <input type="text" value={noteVal} onChange={e => setNoteVal(e.target.value)}
                            placeholder="Add a note..."
                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white/70 text-xs focus:outline-none" />
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <button onClick={async () => {
                          setSaving(true);
                          const extra: any = { actual_date: dateVal };
                          if (stageDef.askEstimate && noteVal) {
                            // Save estimate to the target stage
                            await markStage(track, stageDef.estimateTarget, "pending", revNum, { expected_date: noteVal });
                          }
                          if (!stageDef.askEstimate && noteVal) extra.notes = noteVal;
                          if (stageDef.hasPrice && priceVal) extra.quoted_price = parseFloat(priceVal);
                          await markStage(track, stageDef.key, "done", revNum, extra);
                          setSaving(false);
                          setExpanded(false);
                        }} disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-black text-[10px] font-bold disabled:opacity-40">
                          {saving ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
                          Mark complete
                        </button>
                        <button onClick={() => setExpanded(false)} className="px-3 py-1.5 rounded-lg border border-white/[0.06] text-white/30 text-[10px]">Cancel</button>
                      </div>
                    </div>
                  )}
                  {/* Review stage expansion — shows approve/revision/kill inline */}
                  {expanded && canEdit && stageDef.type === "review" && hasSampleArrived(track, revNum) && (
                    <div className="mx-2 mb-2 p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl rounded-tl-none space-y-2">
                      <p className="text-[9px] text-white/40 uppercase tracking-widest">Review outcome</p>
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => { 
                            setExpanded(false); 
                            setApproveModal({ track }); 
                            const qpStage = (track.plm_track_stages || []).find((s: any) => s.stage === "quote_received" && s.status === "done" && s.quoted_price);
                            const qp = qpStage?.quoted_price || track.quoted_price || "";
                            setApprovePrice(qp ? String(qp) : ""); 
                          }}
                          className="text-[10px] px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition">✓ Approve</button>
                        <button onClick={() => { setExpanded(false); setRevisionModal({ track }); setRevisionNotes(""); }}
                          className="text-[10px] px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition">↻ Revision</button>
                        <button onClick={() => { setExpanded(false); setKillModal({ track }); setKillNotes(""); }}
                          className="text-[10px] px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition">✕ Kill</button>
                      </div>
                      <button onClick={() => setExpanded(false)} className="text-[9px] text-white/20 hover:text-white/40">Cancel</button>
                    </div>
                  )}
                </div>
              );
            };

            const FactoryColumn = ({ track }: { track: any }) => {
              const isApproved = track.status === "approved";
              const isKilledTrack = track.status === "killed";
              const revision = getCurrentRevision(track);
              const [cycleCollapsed, setCycleCollapsed] = useState<Record<number, boolean>>({ 0: true });
              const [factoryNote, setFactoryNote] = useState(track.notes || "");
              const [savingNote, setSavingNote] = useState(false);
              const [editingNote, setEditingNote] = useState(false);

              const toggleCycle = (r: number) => setCycleCollapsed(prev => ({ ...prev, [r]: !prev[r] }));

              const renderCycle = (revNum: number, isLatest: boolean) => {
                const sampleArrived = hasSampleArrived(track, revNum);
                const revisionStage = (track.plm_track_stages || []).find((s: any) => s.stage === "revision_requested" && s.revision_number === revNum);
                const stagesToShow = revNum === 0 ? [...FIRST_CYCLE_STAGES, ...SAMPLE_CYCLE_STAGES] : SAMPLE_CYCLE_STAGES;
                const isCollapsed = cycleCollapsed[revNum] === true;

                return (
                  <div key={revNum}>
                    {revNum > 0 && (
                      <div className="flex items-center gap-2 mt-2 mb-1">
                        <div className="h-px flex-1 bg-amber-500/20" />
                        <span className="text-[10px] text-amber-400/70 font-semibold">↻ Revision {revNum}</span>
                        <div className="h-px flex-1 bg-amber-500/20" />
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {stagesToShow.map((stageDef: any) => {
                        const isCollapsibleStage = COLLAPSIBLE_KEYS.includes(stageDef.key);
                        const collapsed = isCollapsed && isCollapsibleStage;
                        const isSampleRequested = stageDef.key === "sample_requested";
                        return (
                          <div key={`${stageDef.key}-${revNum}`}>
                            {isSampleRequested && (
                              <div className="flex justify-end pr-1 mt-1 mb-0.5">
                                <button onClick={() => toggleCycle(revNum)}
                                  className="text-[9px] px-2 py-0.5 rounded border border-white/[0.06] text-white/25 hover:text-white/50 hover:border-white/20 transition">
                                  {isCollapsed ? "▸ expand" : "▾ collapse"}
                                </button>
                              </div>
                            )}
                            <StageRow track={track} stageDef={stageDef} revNum={revNum} isLatest={isLatest} collapsed={collapsed} />
                          </div>
                        );
                      })}
                    </div>
                    {/* Review buttons */}
                    {sampleArrived && isLatest && !isApproved && !isKilledTrack && !isLocked && !revisionStage && (
                      <div className="flex items-center gap-1.5 pt-2 mt-1 border-t border-white/[0.04] flex-wrap">
                        <p className="text-[9px] text-white/25">Review:</p>
                        <button onClick={() => { setApproveModal({ track }); setApprovePrice(""); }}
                          className="text-[9px] px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition">✓ Approve</button>
                        <button onClick={() => { setRevisionModal({ track }); setRevisionNotes(""); }}
                          className="text-[9px] px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition">↻ Revision</button>
                        <button onClick={() => { setKillModal({ track }); setKillNotes(""); }}
                          className="text-[9px] px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition">✕ Kill</button>
                      </div>
                    )}
                    {revisionStage && (
                      <div className="flex items-center gap-2 px-2 py-1.5 mt-1 bg-amber-500/[0.04] rounded-lg border border-amber-500/10">
                        <span className="text-[9px] text-amber-400/80 font-medium">↻ Revision requested</span>
                        {revisionStage.notes && <span className="text-[9px] text-white/30">· {revisionStage.notes}</span>}
                      </div>
                    )}
                  </div>
                );
              };

              // Get the latest quoted price from quote_received stage
              const quotedPriceStage = (track.plm_track_stages || []).find((s: any) => s.stage === "quote_received" && s.status === "done" && s.quoted_price);
              const quotedPrice = quotedPriceStage?.quoted_price || track.quoted_price || null;
              const [editingQuotedPrice, setEditingQuotedPrice] = useState(false);
              const [quotedPriceInput, setQuotedPriceInput] = useState(quotedPrice ? String(quotedPrice) : "");

              const saveQuotedPrice = async () => {
                const price = parseFloat(quotedPriceInput);
                if (isNaN(price)) { setEditingQuotedPrice(false); return; }
                // Find or create quote_received stage
                const existing = (track.plm_track_stages || []).find((s: any) => s.stage === "quote_received");
                if (existing) {
                  await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "update_stage", track_id: track.id, product_id: product.id, factory_id: track.factory_id, stage: "quote_received", status: "done", quoted_price: price, actual_date: new Date().toISOString().split("T")[0], revision_number: 0 }) });
                } else {
                  await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "update_stage", track_id: track.id, product_id: product.id, factory_id: track.factory_id, stage: "quote_received", status: "done", quoted_price: price, actual_date: new Date().toISOString().split("T")[0], revision_number: 0, notes: "Manually entered" }) });
                }
                setEditingQuotedPrice(false);
                load();
              };

              return (
                <div className={`flex-1 min-w-0 border border-white/[0.06] rounded-2xl overflow-hidden ${isApproved ? "border-emerald-500/20 bg-emerald-500/[0.02]" : isKilledTrack ? "border-red-500/10 opacity-60" : "bg-white/[0.01]"}`}>
                  {/* Factory header */}
                  <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
                    <Factory size={11} className="text-white/30 flex-shrink-0" />
                    <span className="text-xs font-bold text-white truncate flex-1">{track.factory_catalog?.name}</span>
                    {isApproved && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">✓{track.approved_price ? ` $${track.approved_price}` : ""}</span>}
                    {isKilledTrack && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0">Disqualified</span>}
                    {revision > 0 && !isApproved && !isKilledTrack && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 flex-shrink-0">Rev {revision}</span>}
                    {!isApproved && !isKilledTrack && !isLocked && (track.plm_track_stages || []).some((s: any) => s.stage === "sample_requested" && s.status === "done") && (
                      <button onClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("disqualify-track", { detail: track })); }}
                        className="text-[9px] px-1.5 py-0.5 rounded border border-red-500/20 text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition flex-shrink-0 ml-auto">
                        Disqualify
                      </button>
                    )}
                  </div>

                  {/* Quoted price strip */}
                  <div className="px-4 py-2 border-b border-white/[0.04] flex items-center gap-2 bg-white/[0.01]">
                    <span className="text-[10px] text-white/30 flex-shrink-0">Quoted price:</span>
                    {editingQuotedPrice ? (
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-[10px] text-white/40">$</span>
                        <input autoFocus value={quotedPriceInput} onChange={e => setQuotedPriceInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveQuotedPrice(); if (e.key === "Escape") setEditingQuotedPrice(false); }}
                          className="flex-1 bg-transparent text-[11px] text-white/70 focus:outline-none w-16"
                          placeholder="0.00" />
                        <button onClick={saveQuotedPrice} className="text-[9px] text-emerald-400 hover:text-emerald-300">Save</button>
                        <button onClick={() => setEditingQuotedPrice(false)} className="text-[9px] text-white/25 hover:text-white/50">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingQuotedPrice(true)}
                        className="flex items-center gap-1 hover:bg-white/[0.04] px-1.5 py-0.5 rounded transition">
                        {quotedPrice
                          ? <span className="text-[11px] font-semibold text-blue-400">${quotedPrice}</span>
                          : <span className="text-[10px] text-white/20 italic">+ add price</span>}
                        <span className="text-[9px] text-white/15">✏</span>
                      </button>
                    )}
                  </div>

                  {/* Stages */}
                  <div className="px-3 py-3 space-y-0.5">
                    {Array.from({ length: revision + 1 }, (_, i) => i).map(revNum => renderCycle(revNum, revNum === revision))}
                  </div>
                  {/* Factory notes */}
                  <div className="px-3 pb-3 border-t border-white/[0.04] pt-2 mt-1">
                    {editingNote ? (
                      <div className="space-y-1.5">
                        <textarea value={factoryNote} onChange={e => setFactoryNote(e.target.value)} rows={2}
                          placeholder="Notes for this factory..."
                          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white/60 placeholder-white/15 text-[10px] focus:outline-none resize-none" autoFocus />
                        <div className="flex gap-1">
                          <button onClick={async () => {
                            if (!factoryNote || !factoryNote.trim()) { setEditingNote(false); return; }
                            setSavingNote(true);
                            const noteWithDate = factoryNote.trim();
                            await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "update_track_notes", track_id: track.id, notes: noteWithDate }) });
                            setSavingNote(false); setEditingNote(false); setFactoryNote(""); load();
                          }} disabled={savingNote} className="text-[9px] px-2 py-1 rounded bg-white text-black font-bold disabled:opacity-40">Save</button>
                          <button onClick={() => setEditingNote(false)} className="text-[9px] px-2 py-1 rounded border border-white/[0.06] text-white/30">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {track.notes ? (
                          <>
                            {track.notes.split("\n").slice(0, 3).map((line: string, i: number) => (
                              <p key={i} className="text-[10px] text-white/35 leading-relaxed">{line}</p>
                            ))}
                            {track.notes.split("\n").length > 3 && (
                              <button onClick={() => setExpandedNoteTrackId(track.id)} className="text-[10px] text-white/30 hover:text-white/60 italic transition">+{track.notes.split("\n").length - 3} more — view all</button>
                            )}
                          </>
                        ) : null}
                        <button onClick={() => { setFactoryNote(track.notes || ""); setEditingNote(true); }} className="text-[10px] text-white/15 hover:text-white/40 transition italic text-left">{track.notes ? "✏ Edit notes" : "+ Add note"}</button>
                      </div>
                    )}
                  </div>
                  {/* Messages button - only show if sample was requested */}
                  {(track.plm_track_stages || []).some((s: any) => s.stage === "sample_requested" && s.status === "done") && (
                  <div className="px-3 pb-3 pt-1">
                    <button onClick={async () => {
                      setMessagesModal({ track });
                      setLoadingMessages(true);
                      const fetchMsgs = async (tid: string, isFirst?: boolean) => {
                        const res = await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "get_messages", track_id: tid }) });
                        const data = await res.json();
                        const msgs = data.messages || [];
                        setTrackMessages(msgs);
                        if (isFirst) {
                          const firstUnread = msgs.findIndex((m: any) => m.sender_role === "factory" && !m.read_by_admin);
                          setFirstUnreadIndex(firstUnread);
                        }
                        setTimeout(() => {
                          if (messagesContainerRef.current) {
                            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                          }
                        }, 100);
                      };
                      await fetchMsgs(track.id, true);
                      setLoadingMessages(false);
                      if (messagePollingRef.current) clearInterval(messagePollingRef.current);
                      messagePollingRef.current = setInterval(() => fetchMsgs(track.id, false), 3000);
                    }} className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-white/[0.06] hover:border-white/20 transition group">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">💬</span>
                        <span className="text-[11px] font-medium text-white/50 group-hover:text-white/70 transition">Messages</span>
                        {(() => {
                          const counts = trackMessageCounts.find(m => m.track_id === track.id);
                          const total = counts?.total || 0;
                          const unread = counts?.unread || 0;
                          return total > 0 ? (
                            <span className="flex items-center gap-1">
                              <span className="text-[9px] text-white/30">{total}</span>
                              {unread > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/30 text-blue-400 border border-blue-500/30">{unread} new</span>}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <span className="text-white/20 text-[10px]">→</span>
                    </button>
                  </div>
                  )}
                </div>
              );
            };

            // Group tracks into rows of 4
            const trackRows: any[][] = [];
            for (let i = 0; i < tracks.length; i += 4) trackRows.push(tracks.slice(i, i + 4));
            const maxCols = Math.min(tracks.length, 4);

            return (
              <div className="space-y-4">
                {/* Request Samples + Add Factory buttons */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white">Factory Tracks</h2>
                    <p className="text-[11px] text-white/30 mt-0.5">Per-factory development pipeline</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isLocked && (
                      <button onClick={() => setShowSampleModal(true)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition">
                        <Plus size={11} />Request Samples
                      </button>
                    )}
                    {!isLocked && (
                      <button onClick={() => setAddingFactory(true)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20 transition">
                        <Plus size={11} />Add Factory
                      </button>
                    )}
                    {tracks.length > 0 && (
                      <button onClick={async () => {
                        const res = await fetch("/api/messages/team");
                        const data = await res.json();
                        setAssignMsgTeamMembers(data.members || []);
                        const assignedIds = (product.plm_assignments || []).map((a: any) => a.designer_id);
                        setAssignMsgSelectedMembers(assignedIds);
                        // Only show tracks that have messages (active chats) or have sample_requested
                        const activeTracks = tracks.filter((t: any) => {
                          const count = trackMessageCounts.find((m: any) => m.track_id === t.id);
                          const hasMessages = count && count.total > 0;
                          const hasSample = (t.plm_track_stages || []).some((s: any) => s.stage === "sample_requested" && s.status === "done");
                          return hasMessages || hasSample;
                        });
                        const activeTrackIds = activeTracks.map((t: any) => t.id);
                        setAssignMsgSelectedTracks(activeTrackIds);
                        // Fetch existing members for each active track
                        const existingMap: Record<string, string[]> = {};
                        for (const tid of activeTrackIds) {
                          const r = await fetch("/api/messages/members?track_id=" + tid);
                          const d = await r.json();
                          existingMap[tid] = (d.members || []).map((m: any) => m.user_id);
                        }
                        setAssignMsgExistingMembers(existingMap);
                        setAssignMessagesModal(true);
                      }} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20 transition">
                        <Users size={11} />Assign Messages
                      </button>
                    )}
                  </div>
                </div>

                {/* Add factory multi-select */}
                {addingFactory && (
                  <div className="p-3 border border-white/[0.08] rounded-xl bg-white/[0.02] space-y-3">
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">Select Factories</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {availableFactories.map((f: any) => (
                        <label key={f.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.03] cursor-pointer">
                          <input type="checkbox" checked={(newTrackFactoryId as any[]).includes(f.id)}
                            onChange={e => {
                              const ids = (newTrackFactoryId as any[]);
                              if (e.target.checked) setNewTrackFactoryId([...ids, f.id] as any);
                              else setNewTrackFactoryId(ids.filter((x: string) => x !== f.id) as any);
                            }}
                            className="accent-white w-3.5 h-3.5" />
                          <span className="text-xs text-white/60">{f.name}</span>
                        </label>
                      ))}
                      {availableFactories.length === 0 && <p className="text-xs text-white/20 px-2">All factories already added</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        const ids = (newTrackFactoryId as any[]);
                        if (!ids.length) return;
                        await Promise.all(ids.map((fid: string) =>
                          fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "create_track", product_id: product.id, factory_id: fid }) })
                        ));
                        setAddingFactory(false); setNewTrackFactoryId([] as any); load();
                      }} disabled={!(newTrackFactoryId as any[]).length}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                        <Check size={11} />Add {(newTrackFactoryId as any[]).length > 0 ? `(${(newTrackFactoryId as any[]).length})` : ""}
                      </button>
                      <button onClick={() => { setAddingFactory(false); setNewTrackFactoryId([] as any); }}
                        className="px-3 py-2 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                    </div>
                  </div>
                )}

                {tracks.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-white/[0.06] rounded-2xl">
                    <p className="text-xs text-white/20">No factories added yet</p>
                    <p className="text-[11px] text-white/15 mt-1">Click "Add Factory" to start tracking</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div style={{ columns: `${maxCols}`, columnGap: "12px" }}>
                      {tracks.map((track: any) => (
                        <div key={track.id} style={{ breakInside: "avoid", marginBottom: "12px" }}>
                          <FactoryColumn track={track} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Skip stage modal */}
          {skipModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
                <p className="text-sm font-semibold">Skip this stage?</p>
                <p className="text-xs text-white/40">Enter a reason so you remember why this was skipped.</p>
                <input value={skipReason} onChange={e => setSkipReason(e.target.value)}
                  placeholder="e.g. Not needed for this product"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white/70 placeholder-white/20 text-xs focus:outline-none"
                  autoFocus />
                <div className="flex gap-2">
                  <button onClick={async () => {
                    // Find current revision number for this track
                    const track = tracks.find((t: any) => t.id === skipModal.trackId);
                    const revNum = track ? (track.plm_track_stages || []).filter((s: any) => s.stage === "revision_requested").length : 0;
                    await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "update_stage", track_id: skipModal.trackId, product_id: skipModal.productId, factory_id: skipModal.factoryId, stage: skipModal.stage, status: "skipped", skip_reason: skipReason || "Skipped", revision_number: revNum }) });
                    setSkipModal(null); load();
                  }} className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold">Skip Stage</button>
                  <button onClick={() => setSkipModal(null)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Expected date modal */}
          {expectedDateModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
                <p className="text-sm font-semibold">Set expected date</p>
                <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white/70 text-xs focus:outline-none" autoFocus />
                <div className="flex gap-2">
                  <button onClick={async () => {
                    await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "update_stage", track_id: expectedDateModal.trackId, product_id: expectedDateModal.productId, factory_id: expectedDateModal.factoryId, stage: expectedDateModal.stage, status: "pending", expected_date: expectedDate, revision_number: 0 }) });
                    setExpectedDateModal(null); load();
                  }} className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold">Save</button>
                  <button onClick={() => setExpectedDateModal(null)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Approve track modal */}
          {/* Messages Modal */}
          {messagesModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-[#141414] border border-white/[0.12] rounded-2xl w-full max-w-lg flex flex-col shadow-2xl" style={{maxHeight: "85vh"}}>
                <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
                  <div>
                    <p className="text-base font-semibold">Messages</p>
                    <p className="text-xs text-white/40 mt-0.5">{messagesModal.track.factory_catalog?.name} · {trackMessages.length} message{trackMessages.length !== 1 ? "s" : ""}</p>
                  </div>
                  <button onClick={async () => { setMessagesModal(null); setTrackMessages([]); setNewMessage(""); if (messagePollingRef.current) { clearInterval(messagePollingRef.current); messagePollingRef.current = null; } const allTracks2 = tracks; if (allTracks2.length > 0) { const counts = await Promise.all(allTracks2.map(async (t: any) => { const r = await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_message_counts", track_id: t.id }) }); const d = await r.json(); return { track_id: t.id, total: d.total || 0, unread: d.unread || 0 }; })); setTrackMessageCounts(counts); } }}
                    className="text-white/30 hover:text-white/60 text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.05] transition">×</button>
                </div>

                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                  {loadingMessages ? (
                    <p className="text-xs text-white/30 text-center py-8">Loading...</p>
                  ) : trackMessages.length === 0 ? (
                    <p className="text-xs text-white/20 text-center py-8">No messages yet.</p>
                  ) : (<>
                    {trackMessages.map((msg: any, idx: number) => (
                      <div key={msg.id}>
                        {idx === firstUnreadIndex && firstUnreadIndex > 0 && (
                          <div className="flex items-center gap-2 my-3">
                            <div className="flex-1 h-px bg-blue-500/30" />
                            <span className="text-[10px] text-blue-400 font-semibold whitespace-nowrap">
                              {trackMessages.length - firstUnreadIndex} new message{trackMessages.length - firstUnreadIndex !== 1 ? "s" : ""}
                            </span>
                            <div className="flex-1 h-px bg-blue-500/30" />
                          </div>
                        )}
                        <div className={msg.sender_role === "admin" ? "flex flex-col items-end gap-0.5" : "flex flex-col items-start gap-0.5"}>
                          <div className={msg.sender_role === "admin"
                            ? "bg-white/10 rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%]"
                            : msg.sender_role === "designer"
                            ? "bg-blue-500/10 border border-blue-500/20 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[80%]"
                            : "bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-tl-sm px-3 py-2 max-w-[80%]"}>
                            <p className={`text-[10px] font-semibold mb-0.5 ${msg.sender_role === "designer" ? "text-blue-400/70" : "text-white/50"}`}>{msg.sender_name}</p>
                            <p className="text-xs text-white/80">{msg.message}</p>
                            <p className="text-[9px] text-white/20 mt-1">{new Date(msg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                          </div>
                          {msg.sender_role === "admin" && (
                            <p className="text-[9px] text-white/20 px-1">
                              {msg.read_by_factory ? "✓✓ Seen by factory" : "✓ Sent"}
                            </p>
                          )}
                          {msg.sender_role === "factory" && msg.read_by_admin && (
                            <p className="text-[9px] text-white/20 px-1">✓ Read</p>
                          )}
                          {msg.sender_role === "designer" && msg.read_by_admin && (
                            <p className="text-[9px] text-blue-400/30 px-1">✓ Read by admin</p>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesBottomRef} />
                  </>)}
                </div>
                <div className="px-4 py-3 border-t border-white/[0.06] flex gap-2 flex-shrink-0">
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key !== "Enter" || !newMessage.trim()) return;
                      e.preventDefault();
                      setSendingMessage(true);
                      await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "send_message", track_id: messagesModal.track.id, product_id: id, message: newMessage.trim() }) });
                      const res = await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "get_messages", track_id: messagesModal.track.id }) });
                      const data = await res.json();
                      setTrackMessages(data.messages || []);
                      setNewMessage("");
                      setSendingMessage(false);
                    }}
                    placeholder="Type a message... (Enter to send)"
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-xs focus:outline-none" />
                  <button onClick={async () => {
                    if (!newMessage.trim()) return;
                    setSendingMessage(true);
                    await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "send_message", track_id: messagesModal.track.id, product_id: id, message: newMessage.trim() }) });
                    const res = await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "get_messages", track_id: messagesModal.track.id }) });
                    const data = await res.json();
                    setTrackMessages(data.messages || []);
                    setNewMessage("");
                    setSendingMessage(false);
                  }} disabled={!newMessage.trim() || sendingMessage}
                    className="px-3 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">Send</button>
                </div>
              </div>
            </div>
          )}

          {approveModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
                <p className="text-sm font-semibold">Approve — {approveModal.track.factory_catalog?.name}</p>
                <p className="text-xs text-white/40">Lock in this factory. Enter the agreed price.</p>
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Agreed Price (ELC)</p>
                  <input type="number" step="0.01" value={approvePrice} onChange={e => setApprovePrice(e.target.value)}
                    placeholder="e.g. 2.45"
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none text-center"
                    autoFocus />
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    setApprovingTrack(true);
                    const revNum = (approveModal.track.plm_track_stages || []).filter((s: any) => s.stage === "revision_requested").length;
                    await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "update_stage", track_id: approveModal.track.id, product_id: product.id, factory_id: approveModal.track.factory_id, stage: "sample_reviewed", status: "done", revision_number: revNum, actual_date: new Date().toISOString().split("T")[0], notes: `Approved${approvePrice ? ` at $${approvePrice}` : ""}` }) });
                    await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "approve_track", track_id: approveModal.track.id, product_id: product.id, factory_id: approveModal.track.factory_id, approved_price: approvePrice ? parseFloat(approvePrice) : null }) });
                    setApprovingTrack(false); setApproveModal(null); load();
                  }} disabled={approvingTrack}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40">
                    {approvingTrack ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    Approve Factory
                  </button>
                  <button onClick={() => setApproveModal(null)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Revision modal */}
          {revisionModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
                <p className="text-sm font-semibold">Request Revision — {revisionModal.track.factory_catalog?.name}</p>
                <p className="text-xs text-white/40">Describe what needs to change. The factory will be notified.</p>
                <textarea value={revisionNotes} onChange={e => setRevisionNotes(e.target.value)}
                  placeholder="e.g. Color needs to be darker, handle needs reinforcing..."
                  rows={3} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none resize-none" autoFocus />
                <div className="flex gap-2">
                  <button onClick={async () => {
                    setRequestingRevision(true);
                    const revNum = (revisionModal.track.plm_track_stages || []).filter((s: any) => s.stage === "revision_requested").length;
                    await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "update_stage", track_id: revisionModal.track.id, product_id: product.id, factory_id: revisionModal.track.factory_id, stage: "sample_reviewed", status: "done", revision_number: revNum, actual_date: new Date().toISOString().split("T")[0], notes: "Revision requested" }) });
                    await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "request_revision", track_id: revisionModal.track.id, product_id: product.id, factory_id: revisionModal.track.factory_id, notes: revisionNotes }) });
                    // Auto-mark sample_requested on new revision cycle
                    await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "update_stage", track_id: revisionModal.track.id, product_id: product.id, factory_id: revisionModal.track.factory_id, stage: "sample_requested", status: "done", revision_number: revNum + 1, actual_date: new Date().toISOString().split("T")[0], notes: revisionNotes || "Revision requested" }) });
                    // Auto-send revision notes as a message to the factory
                    if (revisionNotes) {
                      await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "send_message", track_id: revisionModal.track.id, product_id: product.id, message: "Revision requested: " + revisionNotes }) });
                    }
                    setRequestingRevision(false); setRevisionModal(null); setRevisionNotes(""); load();
                  }} disabled={requestingRevision || !revisionNotes}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 text-black text-xs font-semibold disabled:opacity-40">
                    {requestingRevision ? <Loader2 size={11} className="animate-spin" /> : null}
                    Send Revision Request
                  </button>
                  <button onClick={() => setRevisionModal(null)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Kill track modal */}
          {killModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
                <p className="text-sm font-semibold">Discontinue — {killModal.track.factory_catalog?.name}</p>
                <p className="text-xs text-white/40">This factory will be marked as discontinued for this product.</p>
                <textarea value={killNotes} onChange={e => setKillNotes(e.target.value)}
                  placeholder="e.g. Price too high, lead time too slow..."
                  rows={2} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none resize-none" autoFocus />
                <div className="flex gap-2 flex-col">
                  <button onClick={async () => {
                    setKillingTrack(true);
                    const revNum = (killModal.track.plm_track_stages || []).filter((s: any) => s.stage === "revision_requested").length;
                    await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "update_stage", track_id: killModal.track.id, product_id: product.id, factory_id: killModal.track.factory_id, stage: "sample_reviewed", status: "done", revision_number: revNum, actual_date: new Date().toISOString().split("T")[0], notes: killNotes || "Factory discontinued" }) });
                    await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "kill_track", track_id: killModal.track.id, product_id: product.id, factory_id: killModal.track.factory_id, notes: killNotes, kill_product: false }) });
                    setKillingTrack(false); setKillModal(null); load();
                  }} disabled={killingTrack}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold disabled:opacity-40">
                    Discontinue Factory Only
                  </button>
                  <button onClick={async () => {
                    setKillingTrack(true);
                    await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "kill_track", track_id: killModal.track.id, product_id: product.id, factory_id: killModal.track.factory_id, notes: killNotes, kill_product: true }) });
                    setKillingTrack(false); setKillModal(null); load();
                  }} disabled={killingTrack}
                    className="flex-1 py-2.5 rounded-xl bg-red-900/30 border border-red-900/40 text-red-600 text-xs font-semibold disabled:opacity-40">
                    Kill Entire Product
                  </button>
                  <button onClick={() => setKillModal(null)} className="px-4 py-2 rounded-xl border border-white/[0.06] text-white/30 text-xs text-center">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Disqualify Modal */}
          {assignMessagesModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Assign Messages</p>
                    <p className="text-[11px] text-white/30 mt-0.5">Add team members to factory chats for this product</p>
                  </div>
                  <button onClick={() => setAssignMessagesModal(false)} className="text-white/30 hover:text-white/60"><X size={16} /></button>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">Factory Chats</p>
                  {tracks.map((track: any) => {
                    const hasSample = (track.plm_track_stages || []).some((s: any) => s.stage === "sample_requested" && s.status === "done");
                    const isSelected = assignMsgSelectedTracks.includes(track.id);
                    return (
                    <div key={track.id} onClick={() => { if (!hasSample) return; setAssignMsgSelectedTracks(prev => prev.includes(track.id) ? prev.filter(id => id !== track.id) : [...prev, track.id]); }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition ${!hasSample ? "opacity-30 cursor-default border-white/[0.04] bg-white/[0.01]" : isSelected ? "cursor-pointer border-white/20 bg-white/[0.06]" : "cursor-pointer border-white/[0.06] bg-white/[0.02]"}`}>
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-white border-white" : "border-white/20"}`}>
                        {isSelected && <Check size={10} className="text-black" />}
                      </div>
                      <p className={`text-xs ${hasSample ? "text-white/70" : "text-white/30"}`}>{track.factory_catalog?.name}</p>
                      {!hasSample && <span className="text-[9px] text-white/20 ml-auto">No sample</span>}
                    </div>
                  );})}
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">Team Members</p>
                  {assignMsgTeamMembers.length === 0 && <p className="text-[11px] text-white/20">No team members found</p>}
                  {assignMsgTeamMembers.map((m: any) => {
                    const isSelected = assignMsgSelectedMembers.includes(m.id);
                    // Which selected tracks already have this member
                    const alreadyInTracks = assignMsgSelectedTracks.filter(tid => (assignMsgExistingMembers[tid] || []).includes(m.id));
                    // Which selected tracks still need this member
                    const newTracks = assignMsgSelectedTracks.filter(tid => !(assignMsgExistingMembers[tid] || []).includes(m.id));
                    const alreadyInAll = assignMsgSelectedTracks.length > 0 && newTracks.length === 0;
                    const alreadyInSome = alreadyInTracks.length > 0 && newTracks.length > 0;
                    // Get factory names for tracks they are already in
                    const alreadyInNames = alreadyInTracks.map(tid => tracks.find((t: any) => t.id === tid)?.factory_catalog?.name).filter(Boolean);
                    return (
                    <div key={m.id} onClick={() => { if (alreadyInAll) return; setAssignMsgSelectedMembers(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]); }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition ${alreadyInAll ? "opacity-40 cursor-default border-white/[0.04] bg-white/[0.01]" : isSelected ? "cursor-pointer border-white/20 bg-white/[0.06]" : "cursor-pointer border-white/[0.06] bg-white/[0.02]"}`}>
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${alreadyInAll ? "border-emerald-500/30 bg-emerald-500/10" : isSelected ? "bg-white border-white" : "border-white/20"}`}>
                        {alreadyInAll ? <Check size={10} className="text-emerald-400" /> : isSelected ? <Check size={10} className="text-black" /> : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs ${alreadyInAll ? "text-white/30" : "text-white/70"}`}>{m.full_name || m.email}</p>
                        {alreadyInAll && <p className="text-[9px] text-emerald-400/50">Already in all selected chats</p>}
                        {alreadyInSome && <p className="text-[9px] text-white/30">Already in: {alreadyInNames.join(", ")}</p>}
                        {isSelected && newTracks.length > 0 && <p className="text-[9px] text-white/30">Will be added to {newTracks.length} chat{newTracks.length !== 1 ? "s" : ""}</p>}
                        {(product.plm_assignments || []).some((a: any) => a.designer_id === m.id) && !alreadyInAll && !alreadyInSome && (
                          <p className="text-[9px] text-amber-400/60">Assigned to product</p>
                        )}
                      </div>
                    </div>
                  );
                  })}
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setAssignMessagesModal(false)}
                    className="flex-1 px-4 py-2 rounded-xl border border-white/[0.08] text-white/40 text-xs">Cancel</button>
                  <button disabled={assignMsgLoading || assignMsgSelectedTracks.length === 0 || assignMsgSelectedMembers.length === 0}
                    onClick={async () => {
                      setAssignMsgLoading(true);
                      await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "add_members_bulk", track_ids: assignMsgSelectedTracks, member_user_ids: assignMsgSelectedMembers }) });
                      setAssignMsgLoading(false);
                      setAssignMessagesModal(false);
                    }}
                    className="flex-1 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                    {assignMsgLoading ? "Adding..." : `Add to ${assignMsgSelectedTracks.length} chat${assignMsgSelectedTracks.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {disqualifyModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-[#111] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Disqualify {disqualifyModal.track.factory_catalog?.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">They will be notified by email and their track will be greyed out</p>
                  </div>
                  <button onClick={() => setDisqualifyModal(null)} className="text-white/30 hover:text-white/60 text-lg">✕</button>
                </div>

                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Reason</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ key: "price", label: "Price", icon: "💰" }, { key: "speed", label: "Speed", icon: "⏱" }, { key: "quality", label: "Quality", icon: "⚠️" }].map(r => (
                      <button key={r.key} onClick={() => setDisqualifyReason(r.key)}
                        className={`py-2.5 rounded-xl border text-xs font-semibold transition ${disqualifyReason === r.key ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-white/[0.06] text-white/40 hover:border-white/20"}`}>
                        {r.icon} {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Internal Note (saved to factory track, not sent in email)</p>
                  <textarea value={disqualifyNote} onChange={e => setDisqualifyNote(e.target.value)} rows={2}
                    placeholder="e.g. Lead time was 60 days vs our requirement of 45..."
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-white/60 placeholder-white/20 text-xs focus:outline-none resize-none" />
                </div>

                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Email Preview</p>
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-xs text-white/40 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                    {`Hi ${disqualifyModal.track.factory_catalog?.contact_name || disqualifyModal.track.factory_catalog?.name},

Thank you for your time and effort on the ${product.name} sample. We truly appreciate the work you put in.

After careful consideration, we have decided to move forward with another supplier for this product. Unfortunately, your ${disqualifyReason === "price" ? "pricing was not competitive enough for this order" : disqualifyReason === "speed" ? "lead times were not able to meet our timeline requirements" : "sample quality did not meet our specifications"}.

Please disregard any further sample production for this item. We hope to work together on future opportunities.

Best regards,
[Your Name]
[Company Name]`}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={async () => {
                    setDisqualifying(true);
                    await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "disqualify_track", track_id: disqualifyModal.track.id, reason: disqualifyReason, note: disqualifyNote, product_name: product.name, factory_name: disqualifyModal.track.factory_catalog?.name, factory_email: disqualifyModal.track.factory_catalog?.email, contact_name: disqualifyModal.track.factory_catalog?.contact_name }) });
                    setDisqualifying(false); setDisqualifyModal(null); load();
                  }} disabled={disqualifying}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold disabled:opacity-40">
                    {disqualifying ? <Loader2 size={13} className="animate-spin" /> : null}
                    Disqualify & Send Email
                  </button>
                  <button onClick={() => setDisqualifyModal(null)} className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-white/40 text-sm">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* ── PRODUCTION ORDERS SECTION ── */}
          <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-white/[0.01]">
            <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Production Orders</p>
                <p className="text-xs text-white/30 mt-0.5">PO issued through shipped — factory updates these</p>
              </div>
              {!isLocked && (
                <button onClick={() => setShowNewOrder(!showNewOrder)}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 border border-white/[0.06] hover:border-white/20 px-3 py-1.5 rounded-lg transition">
                  <Plus size={11} />New Order
                </button>
              )}
            </div>

            {showNewOrder && (() => {
              const unitPrice = parseFloat(newOrder.unit_price) || 0;
              const tariff = parseFloat(newOrder.tariff) || 0;
              const freight = parseFloat(newOrder.freight) || 0;
              const duty = parseFloat(newOrder.duty) || 0;
              const tariffAmt = unitPrice * tariff / 100;
              const freightAmt = unitPrice * freight / 100;
              const dutyAmt = unitPrice * duty / 100;
              const calcElc = unitPrice + tariffAmt + freightAmt + dutyAmt;
              const marginPct = parseFloat(newOrder.margin_pct) || 0;
              const calcSellPrice = calcElc > 0 && marginPct > 0 ? calcElc / (1 - marginPct / 100) : 0;

              return (
                <div className="px-6 py-5 border-b border-white/[0.04] space-y-4 bg-white/[0.01]">
                  <p className="text-xs font-semibold text-white/60">New Production Order</p>

                  {/* Row 1: Factory + PO + Qty */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={lc}>Factory</label>
                      <select value={newOrder.factory_id} onChange={e => setNewOrder({...newOrder, factory_id: e.target.value})} className={ic}>
                        <option value="">Select factory</option>
                        {factories.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                    <div><label className={lc}>PO Number</label><input value={newOrder.linked_po_number} onChange={e => setNewOrder({...newOrder, linked_po_number: e.target.value})} placeholder="PO-2026-001" className={ic} /></div>
                    <div><label className={lc}>Order Qty</label><input type="number" value={newOrder.order_quantity} onChange={e => setNewOrder({...newOrder, order_quantity: e.target.value})} placeholder="500" className={ic} /></div>
                  </div>

                  {/* Row 2: Cost breakdown */}
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Cost Breakdown</p>
                    <div className="grid grid-cols-4 gap-3">
                      <div><label className={lc}>First Cost ($)</label><input type="number" step="0.01" value={newOrder.unit_price} onChange={e => setNewOrder({...newOrder, unit_price: e.target.value})} placeholder="2.00" className={ic} /></div>
                      <div><label className={lc}>Tariff (%)</label><input type="number" step="0.1" value={newOrder.tariff} onChange={e => setNewOrder({...newOrder, tariff: e.target.value})} placeholder="10" className={ic} /></div>
                      <div><label className={lc}>Freight (%)</label><input type="number" step="0.01" value={newOrder.freight} onChange={e => setNewOrder({...newOrder, freight: e.target.value})} placeholder="0.15" className={ic} /></div>
                      <div><label className={lc}>Duty (%)</label><input type="number" step="0.1" value={newOrder.duty} onChange={e => setNewOrder({...newOrder, duty: e.target.value})} placeholder="5" className={ic} /></div>
                    </div>
                  </div>

                  {/* ELC display */}
                  {calcElc > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                      <div className="flex-1">
                        <p className="text-[10px] text-white/30 mb-0.5">Calculated ELC</p>
                        <p className="text-lg font-bold text-white">${calcElc.toFixed(2)}</p>
                        <p className="text-[10px] text-white/25">{unitPrice > 0 ? `$${unitPrice.toFixed(2)} first cost` : ""}
                          {tariff > 0 ? ` + ${tariff}% tariff ($${tariffAmt.toFixed(2)})` : ""}
                          {freight > 0 ? ` + ${freight}% freight ($${freightAmt.toFixed(2)})` : ""}
                          {duty > 0 ? ` + ${duty}% duty ($${dutyAmt.toFixed(2)})` : ""}</p>
                      </div>
                      {calcSellPrice > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] text-white/30 mb-0.5">Sell Price</p>
                          <p className="text-lg font-bold text-emerald-400">${calcSellPrice.toFixed(2)}</p>
                          <p className="text-[10px] text-white/25">{marginPct}% margin</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Margin slider */}
                  {calcElc > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className={lc}>Target Markup</label>
                        <span className="text-xs font-bold text-emerald-400">{marginPct}%</span>
                      </div>
                      <input type="range" min="0" max="200" step="1"
                        value={marginPct}
                        onChange={e => setNewOrder({...newOrder, margin_pct: e.target.value})}
                        className="w-full accent-emerald-500 cursor-pointer" />
                      <div className="flex justify-between text-[9px] text-white/20 mt-1">
                        <span>0%</span><span>50%</span><span>100%</span><span>150%</span><span>200%</span>
                      </div>
                    </div>
                  )}

                  <div><label className={lc}>Payment Terms</label><input value={newOrder.payment_terms} onChange={e => setNewOrder({...newOrder, payment_terms: e.target.value})} placeholder="30% deposit, 70% before shipment" className={ic} /></div>
                  <div><label className={lc}>Notes</label><textarea value={newOrder.batch_notes} onChange={e => setNewOrder({...newOrder, batch_notes: e.target.value})} rows={2} className={`${ic} resize-none`} /></div>

                  <div className="flex gap-2">
                    <button onClick={createOrder} disabled={savingOrder} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                      {savingOrder ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Create Order
                    </button>
                    <button onClick={() => setShowNewOrder(false)} className="px-3 py-2 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                  </div>
                </div>
              );
            })()}

            <div className="divide-y divide-white/[0.04]">
              {orders.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-xs text-white/20">No orders yet</p>
                  <p className="text-[11px] text-white/15 mt-1">Create an order once sample is approved and PO is issued</p>
                </div>
              ) : orders.map((order: any) => {
                const stage = stageInfo(order.current_stage);
                const orderFactory = factories.find((f: any) => f.id === order.factory_id);
                const margin = order.target_elc && order.target_sell_price
                  ? Math.round(((order.target_sell_price - order.target_elc) / order.target_sell_price) * 100) : null;
                const history = (order.plm_batch_stages || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                return (
                  <div key={order.id} className="px-6 py-4 space-y-3">
                    {/* Order header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold">Order #{order.batch_number}</span>
                        {editingOrderFactory === order.id ? (
                          <div className="flex items-center gap-1.5">
                            <select value={orderFactoryVal} onChange={e => setOrderFactoryVal(e.target.value)}
                              className="bg-white/[0.04] border border-white/20 rounded-lg px-2 py-1 text-white/70 text-xs focus:outline-none">
                              <option value="">No factory</option>
                              {factories.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            <button onClick={() => saveOrderFactory(order.id)} disabled={savingOrderFactory}
                              className="px-2 py-1 rounded-lg bg-white text-black text-xs font-semibold disabled:opacity-40">
                              {savingOrderFactory ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                            </button>
                            <button onClick={() => setEditingOrderFactory(null)} className="px-2 py-1 rounded-lg border border-white/[0.06] text-white/30 text-xs">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingOrderFactory(order.id); setOrderFactoryVal(order.factory_id || ""); }}
                            className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition">
                            <Factory size={9} />{orderFactory ? orderFactory.name : "Assign factory"}<Pencil size={8} className="ml-0.5" />
                          </button>
                        )}
                        {order.linked_po_number && <span className="text-[10px] text-white/25 font-mono">PO: {order.linked_po_number}</span>}
                      </div>
                      <button onClick={() => deleteOrder(order.id)} disabled={deletingOrder === order.id}
                        className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition">
                        {deletingOrder === order.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      </button>
                    </div>

                    {/* Production stage — prev/next + timeline */}
                    {(() => {
                      const orderCurrentIdx = ORDER_STAGES.findIndex(s => s.key === order.current_stage);
                      const orderPrev = orderCurrentIdx > 0 ? ORDER_STAGES[orderCurrentIdx - 1] : null;
                      const orderNext = orderCurrentIdx < ORDER_STAGES.length - 1 ? ORDER_STAGES[orderCurrentIdx + 1] : null;
                      const orderCurrent = ORDER_STAGES[orderCurrentIdx] || ORDER_STAGES[0];
                      return (
                        <div className="space-y-3">
                          <div className="w-full bg-white/[0.05] rounded-full h-1">
                            <div className="h-1 rounded-full transition-all" style={{ width: `${((orderCurrentIdx + 1) / ORDER_STAGES.length) * 100}%`, background: orderCurrent.color }} />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <button onClick={() => orderPrev && updateOrderStage(order.id, orderPrev.key)} disabled={!orderPrev || updatingOrderStage === order.id || isLocked}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/70 transition text-xs disabled:opacity-20 disabled:cursor-not-allowed">
                              ← {orderPrev ? orderPrev.label : "Start"}
                            </button>
                            <div className="text-center">
                              <div className="flex items-center gap-1.5 justify-center">
                                <div className="w-2 h-2 rounded-full" style={{ background: orderCurrent.color }} />
                                <span className="text-xs font-semibold text-white">{orderCurrent.label}</span>
                              </div>
                              <p className="text-[10px] text-white/25 mt-0.5">{orderCurrentIdx + 1} of {ORDER_STAGES.length}</p>
                            </div>
                            <button onClick={() => orderNext && updateOrderStage(order.id, orderNext.key)} disabled={!orderNext || updatingOrderStage === order.id || isLocked}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition disabled:opacity-20 disabled:cursor-not-allowed"
                              style={orderNext ? { borderColor: `${orderNext.color}40`, color: orderNext.color, background: `${orderNext.color}10` } : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                              {orderNext ? orderNext.label : "Complete"} →
                            </button>
                          </div>
                          {/* Note input */}
                          <input value={orderStageNote[order.id] || ""} onChange={e => setOrderStageNote(prev => ({ ...prev, [order.id]: e.target.value }))}
                            placeholder="Add a note to this stage update..."
                            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-white/60 placeholder-white/20 text-xs focus:outline-none focus:border-white/20 transition" />
                          {/* Timeline */}
                          <div className="border-t border-white/[0.04] pt-3 space-y-1">
                            {ORDER_STAGES.map((s, i) => {
                              const isPast = i < orderCurrentIdx;
                              const isCurrent = i === orderCurrentIdx;
                              return (
                                <div key={s.key} className="flex items-center gap-2.5 px-2 py-1">
                                  <div className="w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0"
                                    style={isCurrent ? { borderColor: s.color, background: `${s.color}20` } : isPast ? { borderColor: "#10b981", background: "#10b98120" } : { borderColor: "rgba(255,255,255,0.08)" }}>
                                    {isPast ? <Check size={8} className="text-emerald-400" /> :
                                     isCurrent ? <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} /> :
                                     <div className="w-1 h-1 rounded-full bg-white/10" />}
                                  </div>
                                  <span className="text-xs" style={isCurrent ? { color: s.color, fontWeight: 600 } : isPast ? { color: "rgba(255,255,255,0.4)" } : { color: "rgba(255,255,255,0.15)" }}>{s.label}</span>
                                </div>
                              );
                            })}
                          </div>
                          {updatingOrderStage === order.id && <div className="flex justify-center"><Loader2 size={12} className="animate-spin text-white/30" /></div>}
                        </div>
                      );
                    })()}

                    {/* Order financials — editable with margin slider */}
                    {(() => {
                      const oid = order.id;
                      const fin = orderFinancials[oid] || {};
                      const getV = (key: string, fallback: any) => fin[key] !== undefined ? fin[key] : String(order[key] || fallback);
                      const setV = (key: string, val: string) => setOrderFinancials((prev: any) => ({ ...prev, [oid]: { ...(prev[oid] || {}), [key]: val } }));

                      const fc = parseFloat(getV("unit_price", "")) || 0;
                      const trPct = parseFloat(getV("tariff_pct", "")) || 0;
                      const fr = parseFloat(getV("freight", "")) || 0;
                      const duPct = parseFloat(getV("duty_pct", "")) || 0;
                      const tr = fc * trPct / 100;
                      const du = fc * duPct / 100;
                      const liveElc = fc + tr + du + fr; // ELC = first cost + tariff% + duty% + freight$
                      const liveMpct = parseFloat(getV("margin", "0")) || 0;
                      const rawSell = liveElc > 0 && liveMpct > 0 ? liveElc * (1 + liveMpct / 100) : 0;
                      const liveSell = isFinite(rawSell) ? rawSell : 0;
                      const qty = parseInt(order.order_quantity || order.quantity || "0") || 0;
                      const totalCost = liveElc > 0 && qty > 0 ? liveElc * qty : 0;
                      const totalRevenue = liveSell > 0 && qty > 0 ? liveSell * qty : 0;

                      const saveFinancials = async () => {
                        setSavingFinancials(oid);
                        await fetch("/api/plm/batch", { method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "update_batch", id: oid,
                            unit_price: fc || null, tariff_pct: trPct || null, freight: fr || null, duty_pct: duPct || null,
                            elc: liveElc || null, sell_price: liveSell || null, margin: liveMpct || null,
                          }) });
                        setSavingFinancials(null);
                        load();
                      };

                      return (
                        <div className="space-y-3 border border-white/[0.04] rounded-xl p-4 bg-white/[0.01]">
                          <p className="text-[10px] text-white/25 uppercase tracking-widest">Pricing</p>

                          {/* Cost inputs */}
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { label: "First Cost", key: "unit_price", val: getV("unit_price",""), prefix: "$", step: "0.01", ph: "0.00" },
                              { label: "Tariff %", key: "tariff_pct", val: getV("tariff_pct",""), prefix: "%", step: "0.1", ph: "0" },
                              { label: "Freight $", key: "freight", val: getV("freight",""), prefix: "$", step: "0.01", ph: "0.00" },
                              { label: "Duty %", key: "duty_pct", val: getV("duty_pct",""), prefix: "%", step: "0.1", ph: "0" },
                            ].map((f: any) => (
                              <div key={f.label}>
                                <p className="text-[9px] text-white/25 mb-1">{f.label}</p>
                                <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5">
                                  <span className="text-[10px] text-white/30">{f.prefix}</span>
                                  <input type="number" step={f.step} value={f.val}
                                    onChange={e => setV(f.key, e.target.value)}
                                    className="flex-1 bg-transparent text-xs text-white/70 focus:outline-none w-full"
                                    placeholder={f.ph} />
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* ELC result — per unit */}
                          {liveElc > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 flex-1">
                                  <div>
                                    <p className="text-[9px] text-blue-400/60">ELC / unit</p>
                                    <p className="text-base font-bold text-blue-400">${liveElc.toFixed(2)}</p>
                                  </div>
                                </div>
                                {liveSell > 0 && (
                                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex-1">
                                    <div>
                                      <p className="text-[9px] text-emerald-400/60">Sell / unit</p>
                                      <p className="text-base font-bold text-emerald-400">${liveSell.toFixed(2)}</p>
                                    </div>
                                  </div>
                                )}
                                {qty > 0 && (
                                  <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                    <p className="text-[9px] text-white/25">Qty</p>
                                    <p className="text-base font-bold text-white/60">{qty.toLocaleString()}</p>
                                  </div>
                                )}
                              </div>
                              {qty > 0 && liveElc > 0 && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                  <span className="text-[10px] text-white/25">Total cost:</span>
                                  <span className="text-[11px] font-semibold text-white/50">${totalCost.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                  {liveSell > 0 && <>
                                    <span className="text-white/15 mx-1">·</span>
                                    <span className="text-[10px] text-white/25">Total revenue:</span>
                                    <span className="text-[11px] font-semibold text-emerald-400/60">${totalRevenue.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                    <span className="text-[10px] text-white/25 ml-auto">Gross profit: ${(totalRevenue - totalCost).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                  </>}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Markup slider + manual input */}
                          {liveElc > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[9px] text-white/25">Markup</p>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={liveMpct}
                                    onChange={e => setV("margin", e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                                    className="w-16 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-0.5 text-xs text-emerald-400 font-bold text-right focus:outline-none focus:border-emerald-500/40"
                                  />
                                  <span className="text-xs text-emerald-400 font-bold">%</span>
                                </div>
                              </div>
                              <input type="range" min="0" max="200" step="0.1" value={getV("margin","0")}
                                onChange={e => setV("margin", e.target.value)}
                                className="w-full accent-emerald-500 cursor-pointer" />
                              <div className="flex justify-between text-[9px] text-white/15 mt-0.5">
                                <span>0%</span><span>50%</span><span>100%</span><span>150%</span><span>200%</span>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {order.linked_po_number && <div>
                                <p className="text-[9px] text-white/25">PO</p>
                                <p className="text-xs font-mono text-white/50">{order.linked_po_number}</p>
                              </div>}
                              {order.payment_terms && <p className="text-[10px] text-white/25">{order.payment_terms}</p>}
                            </div>
                            <button onClick={saveFinancials} disabled={savingFinancials === oid}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50 text-xs hover:text-white/80 transition disabled:opacity-40">
                              {savingFinancials === oid ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Factory updates / stage history */}
                    <div className="border-t border-white/[0.04] pt-3 space-y-2">
                      <p className="text-[10px] text-white/25 uppercase tracking-widest">Factory Updates</p>
                      {history.length === 0 ? (
                        <p className="text-[11px] text-white/20 italic">No updates yet</p>
                      ) : (
                        <div className="space-y-2">
                          {history.map((h: any) => {
                            const s = stageInfo(h.stage);
                            return (
                              <div key={h.id} className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: s.color }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</span>
                                    <span className="text-[10px] text-white/20">{new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                  </div>
                                  {h.notes && <p className="text-[11px] text-white/40 mt-0.5">{h.notes}</p>}
                                  {h.updated_by && <p className="text-[10px] text-white/20">{h.updated_by_role === "factory" ? "Factory" : "Admin"}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Order notes */}
                      {(() => {
                        const noteKey = `note_${order.id}`;
                        const noteVal = orderFinancials[noteKey]?.note !== undefined ? orderFinancials[noteKey].note : (order.batch_notes || order.notes || "");
                        const noteDirty = orderFinancials[noteKey]?.dirty || false;
                        return (
                          <div className="pt-1">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] text-white/25 uppercase tracking-widest">Order Notes</p>
                              {noteDirty && (
                                <button onClick={async () => {
                                  await fetch("/api/plm/batch", { method: "POST", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "update_batch", id: order.id, batch_notes: noteVal }) });
                                  setOrderFinancials((prev: any) => ({ ...prev, [noteKey]: { note: noteVal, dirty: false } }));
                                  load();
                                }} className="text-[10px] px-2 py-0.5 rounded-lg bg-white text-black font-semibold">
                                  Save
                                </button>
                              )}
                            </div>
                            <textarea
                              value={noteVal}
                              onChange={e => setOrderFinancials((prev: any) => ({ ...prev, [noteKey]: { note: e.target.value, dirty: true } }))}
                              rows={2}
                              placeholder="Add notes about this order..."
                              className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-2 text-white/50 placeholder-white/15 text-xs focus:outline-none focus:border-white/15 resize-none transition"
                            />
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── PRODUCT DETAILS — INLINE EDITING ── */}
          <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-white/[0.01]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-medium">Product Details</p>
              {isKilled && <span className="text-[9px] text-red-400/60 uppercase tracking-widest">Read only</span>}
            </div>

            {/* Core fields — 2 column grid */}
            <div className="p-6 grid grid-cols-2 gap-x-6 gap-y-5">
              <div className="col-span-2">
                <InlineField label="Product Name" value={product.name || ""} onSave={v => saveField("name", v)} disabled={isKilled} />
              </div>
              <InlineField label="SKU" value={product.sku || ""} onSave={v => saveField("sku", v)} disabled={isKilled} />
              <InlineField label="Category" value={product.category || ""} onSave={v => saveField("category", v)} disabled={isKilled} />
              <div className="col-span-2">
                <InlineField label="Description" value={product.description || ""} onSave={v => saveField("description", v)} multiline disabled={isKilled} />
              </div>
              <div className="col-span-2">
                <InlineField label="Specs" value={product.specs || ""} onSave={v => saveField("specs", v)} multiline disabled={isKilled} />
              </div>
              <InlineField label="Weight (e.g. 0.5 kg)" value={product.weight || ""} onSave={v => saveField("weight", v)} disabled={isKilled} />
              <InlineField label="Dimensions (e.g. 10x5x3 cm)" value={product.dimensions || ""} onSave={v => saveField("dimensions", v)} disabled={isKilled} />
              <div className="col-span-2 group">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">Collection</p>
                </div>
                <select value={product.collection_id || ""} onChange={e => saveCollectionField(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-sm focus:outline-none focus:border-white/20 transition">
                  <option value="">No collection</option>
                  {collections.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <InlineField label="Reference / Dropbox Link" value={product.reference_url || ""} onSave={v => saveField("reference_url", v)} disabled={isKilled} />
                {product.reference_url && (
                  <a href={product.reference_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition mt-1.5">
                    ↗ Open link
                  </a>
                )}
              </div>
            </div>

            {/* Notes — distinct section */}
            <div className="border-t border-white/[0.04]">
              <div className="p-6 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-1 h-full rounded-full bg-white/10 self-stretch flex-shrink-0" />
                  <div className="flex-1">
                    <InlineField label="Admin Notes (private)" value={product.notes || ""} onSave={v => saveField("notes", v)} multiline disabled={isKilled} />
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ── IMAGES ── */}
          {enlargedImage && (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center cursor-pointer"
              onClick={() => setEnlargedImage(null)}>
              <img
                src={enlargedImage}
                alt=""
                style={{ width: "92vw", height: "92vh", borderRadius: "16px", objectFit: "contain", boxShadow: "0 0 80px rgba(0,0,0,0.8)", imageRendering: "auto" }}
              />
              <button onClick={() => setEnlargedImage(null)}
                style={{ position: "fixed", top: "16px", right: "16px" }}
                className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white transition">
                <X size={18} />
              </button>
            </div>
          )}
          <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01]">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest">Images</p>
              <label className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 cursor-pointer transition px-3 py-1.5 rounded-lg border border-white/[0.06] hover:border-white/10">
                {uploadingImage ? <Loader2 size={11} className="animate-spin" /> : <ImagePlus size={11} />}
                {uploadingImage ? "Uploading..." : "Add Image"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
            </div>
            {/* Drag and drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOverImage(true); }}
              onDragLeave={() => setDragOverImage(false)}
              onDrop={async e => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverImage(false);
                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
                if (!files.length) return;
                setUploadingImage(true);
                for (const file of files) {
                  const formData = new FormData();
                  formData.append("file", file);
                  formData.append("product_id", id as string);
                  await fetch("/api/plm/upload", { method: "POST", body: formData });
                }
                setUploadingImage(false);
                load();
              }}
              className={`transition rounded-xl ${dragOverImage ? "ring-2 ring-blue-500/40 bg-blue-500/5" : ""}`}>
              {(product.images || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 border border-dashed border-white/[0.06] rounded-xl">
                  <ImagePlus size={20} className="text-white/10 mb-2" />
                  <p className="text-xs text-white/20">No images yet</p>
                  <p className="text-[11px] text-white/15 mt-1">Drag & drop or click to upload</p>
                  <label className="mt-2 text-xs text-white/30 hover:text-white/60 cursor-pointer underline underline-offset-2">
                    Upload one
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {(product.images || []).map((url: string, idx: number) => (
                    <div key={url} className={`relative group rounded-xl overflow-hidden border aspect-square ${idx === 0 ? "border-blue-500/40" : "border-white/[0.06]"}`}>
                      <img src={url} alt="Product" className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => setEnlargedImage(url)} />
                      {idx === 0 && (
                        <div className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full pointer-events-none">Cover</div>
                      )}
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1.5">
                        <button onClick={() => setEnlargedImage(url)}
                          className="text-[10px] px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white/70 hover:bg-white/20 transition">
                          View Full
                        </button>
                        {idx !== 0 && (
                          <button onClick={() => setCoverImage(url)}
                            className="text-[10px] px-2 py-1 rounded-lg bg-blue-500/30 border border-blue-500/40 text-blue-300 hover:bg-blue-500/50 transition">
                            Set as Cover
                          </button>
                        )}
                        <button onClick={() => handleImageDelete(url)} disabled={deletingImage === url}
                          className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition">
                          {deletingImage === url ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                        </button>
                      </div>
                    </div>
                  ))}
                  {/* Drag to add more */}
                  <label className={`flex flex-col items-center justify-center aspect-square rounded-xl border border-dashed cursor-pointer transition ${dragOverImage ? "border-blue-500/40 bg-blue-500/5" : "border-white/[0.06] hover:border-white/15"}`}>
                    {uploadingImage ? <Loader2 size={16} className="animate-spin text-white/20" /> : <ImagePlus size={16} className="text-white/15" />}
                    <p className="text-[10px] text-white/15 mt-1">{uploadingImage ? "Uploading..." : "Add more"}</p>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* ── PRODUCT HISTORY ── */}
          <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Product History</p>
            {productHistory.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-4">No history yet</p>
            ) : (
              <div className="space-y-3">
                {productHistory.map((h: any, i: number) => {
                  const info = HISTORY_LABELS[h.stage] || stageInfo(h.stage);
                  const isSample = h._type === "sample";
                  const isOrder = h._type === "order";
                  const isStatus = h.stage?.startsWith("status_") || h.stage === "unkilled";
                  return (
                    <div key={h.id || i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full mt-1" style={{ background: info.color }} />
                        {i < productHistory.length - 1 && <div className="w-px flex-1 bg-white/[0.06] mt-1 min-h-[12px]" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold" style={{ color: info.color }}>{info.label}</span>
                          {h._factory_name && <span className="text-[10px] text-white/30 bg-white/[0.04] px-1.5 py-0.5 rounded-full">{h._factory_name}</span>}
                          {h._order_num && <span className="text-[10px] text-white/25">Order #{h._order_num}</span>}
                          {isSample && !h._factory_name && <span className="text-[10px] text-white/20">Sample</span>}
                        </div>
                        {h.notes && !["Sample requested", "Revision round started", "Sample requested"].includes(h.notes) && (
                          <p className="text-[11px] text-white/35 mt-0.5">{h.notes}</p>
                        )}
                        <p className="text-[10px] text-white/20 mt-0.5">
                          {h.updated_by && h.updated_by !== "admin" ? h.updated_by : h.updated_by_role === "factory" ? "Factory" : h.updated_by_role === "designer" ? "Designer" : "Admin"} · {new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── INFO + TEAM STRIP ── */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px] border border-white/[0.06] rounded-2xl p-5 bg-white/[0.01]">
              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">Info</p>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-[11px] text-white/30">Created</span><span className="text-[11px] text-white/50">{new Date(product.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>
                <div className="flex justify-between"><span className="text-[11px] text-white/30">Orders</span><span className="text-[11px] text-white/50">{orders.length}</span></div>
                <div className="flex justify-between"><span className="text-[11px] text-white/30">Total units</span><span className="text-[11px] text-white/50">{orders.reduce((sum: number, o: any) => sum + (o.order_quantity || 0), 0).toLocaleString()}</span></div>
                {product.designer_name && <div className="flex justify-between"><span className="text-[11px] text-white/30">Designer</span><span className="text-[11px] text-white/50">{product.designer_name}</span></div>}
                {orders.length > 0 && orders.map((o: any) => {
                  const s = stageInfo(o.current_stage);
                  return (
                    <div key={o.id} className="flex items-center justify-between">
                      <span className="text-[11px] text-white/30">Order #{o.batch_number}</span>
                      <span className="text-[10px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

      </div>
    </div>
  );
}
function AssignTeamMember({ productId, currentAssignments, onAssign }: { productId: string; currentAssignments: any[]; onAssign: () => void }) {
  const [designers, setDesigners] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/plm?type=designers").then(r => r.json()).then(d => setDesigners(d.designers || []));
  }, []);

  const assignedIds = currentAssignments.map((a: any) => a.designer_id);
  const unassigned = designers.filter(d => !assignedIds.includes(d.id));

  if (!open) return (
    <button onClick={() => setOpen(true)} className="text-[11px] text-white/30 hover:text-white/60 transition mt-1">+ Assign member</button>
  );

  return (
    <div className="space-y-1 mt-1">
      {unassigned.length === 0 && <p className="text-[11px] text-white/20">All members assigned</p>}
      {unassigned.map(d => (
        <button key={d.id} onClick={async () => {
          const newIds = [...assignedIds, d.id];
          await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign_product", product_id: productId, designer_ids: newIds }) });
          setOpen(false);
          onAssign();
        }} className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition">
          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-white/50 font-bold">
            {(d.name || d.email || "?")[0].toUpperCase()}
          </div>
          <span className="text-[11px] text-white/50">{d.name || d.email}</span>
        </button>
      ))}
      <button onClick={() => setOpen(false)} className="text-[10px] text-white/20 hover:text-white/40">Cancel</button>
    </div>
  );
}
