"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Package, ArrowLeft, Factory, Layers, Check, Loader2,
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
  const [newOrder, setNewOrder] = useState({ factory_id: "", order_quantity: "", moq: "", target_elc: "", actual_elc: "", target_sell_price: "", linked_po_number: "", batch_notes: "" });
  const [savingOrder, setSavingOrder] = useState(false);
  const [updatingOrderStage, setUpdatingOrderStage] = useState<string | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);

  // Factory tracks
  const [tracks, setTracks] = useState<any[]>([]);
  const [addingFactory, setAddingFactory] = useState(false);
  const [newTrackFactoryId, setNewTrackFactoryId] = useState("");
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

  // Images
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImage, setDeletingImage] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [dragOverImage, setDragOverImage] = useState(false);

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
    setTracks(tracksData.tracks || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

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
    if (data.needs_provider) {
      setSampleProviderModal({ factory_ids: sampleFactoryIds, note: sampleNote });
      setShowSampleModal(false);
      return;
    }
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
    setSampleFactoryIds([]);
    setSampleNote("");
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
    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_batch", product_id: id, stage: "po_issued",
        factory_id: newOrder.factory_id || null,
        order_quantity: newOrder.order_quantity ? parseInt(newOrder.order_quantity) : null,
        moq: newOrder.moq ? parseInt(newOrder.moq) : null,
        target_elc: newOrder.target_elc ? parseFloat(newOrder.target_elc) : null,
        actual_elc: newOrder.actual_elc ? parseFloat(newOrder.actual_elc) : null,
        target_sell_price: newOrder.target_sell_price ? parseFloat(newOrder.target_sell_price) : null,
        linked_po_number: newOrder.linked_po_number || null,
        batch_notes: newOrder.batch_notes || null,
      }) });
    setSavingOrder(false);
    setShowNewOrder(false);
    setNewOrder({ factory_id: "", order_quantity: "", moq: "", target_elc: "", actual_elc: "", target_sell_price: "", linked_po_number: "", batch_notes: "" });
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
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white"
      onDragOver={e => e.preventDefault()}
      onDrop={e => e.preventDefault()}>

      {/* Locked banner */}
      {isKilled && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-8 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400 font-medium">This product has been killed — the page is read-only. Revive it from the status menu to make changes.</p>
        </div>
      )}
      {isHold && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-8 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400 font-medium">This product is on hold — stages, samples and orders are locked. Product info can still be edited.</p>
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
                <input type="date" id="sampleArrivalDate"
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
              {pendingStatus === "killed" && <p className="text-[11px] text-red-400/60 mt-1.5">Product will be read-only. Can be revived with PIN.</p>}
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
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${currentDevStage.color}20`, color: currentDevStage.color, border: `1px solid ${currentDevStage.color}30` }}>
                  {currentDevStage.label}
                </span>
                {product.action_status === "action_required" && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">⚡ Action Required</span>
                )}
                {product.action_status === "updates_made" && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">● Updates Made</span>
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
                        {(["progression","hold","killed"] as const).map(s => (
                          <button key={s} onClick={() => { setShowStatusDropdown(false); setPendingStatus(s); setShowStatusModal(true); }}
                            disabled={productStatus === s}
                            className={`w-full text-left px-3 py-2.5 text-xs transition flex items-center gap-2 ${productStatus === s ? "text-white/20 cursor-default bg-white/[0.03]" : "text-white/60 hover:bg-white/[0.05] hover:text-white"}`}>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s === "killed" ? "bg-red-400" : s === "hold" ? "bg-amber-400" : "bg-emerald-400"}`} />
                            {s === "killed" ? "Kill Product" : s === "hold" ? "Put on Hold" : "Set to Progression"}
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
                        <button onClick={() => { setExpanded(false); setApproveModal({ track }); setApprovePrice(""); }}
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
              const [cycleCollapsed, setCycleCollapsed] = useState<Record<number, boolean>>({});
              const [factoryNote, setFactoryNote] = useState(track.notes || "");
              const [savingNote, setSavingNote] = useState(false);
              const [editingNote, setEditingNote] = useState(false);

              const toggleCycle = (r: number) => setCycleCollapsed(prev => ({ ...prev, [r]: !prev[r] }));

              const renderCycle = (revNum: number, isLatest: boolean) => {
                const sampleArrived = hasSampleArrived(track, revNum);
                const revisionStage = (track.plm_track_stages || []).find((s: any) => s.stage === "revision_requested" && s.revision_number === revNum);
                const stagesToShow = revNum === 0 ? [...FIRST_CYCLE_STAGES, ...SAMPLE_CYCLE_STAGES] : SAMPLE_CYCLE_STAGES;
                const isCollapsed = revNum === 0
                  ? cycleCollapsed[0] === true
                  : cycleCollapsed[revNum] === true || (cycleCollapsed[revNum] === undefined && revNum < revision);

                return (
                  <div key={revNum}>
                    {revNum > 0 && (
                      <div className="flex items-center gap-2 py-1.5 mb-0.5 cursor-pointer" onClick={() => toggleCycle(revNum)}>
                        <div className="h-px flex-1 bg-amber-500/20" />
                        <span className="text-[9px] text-amber-400/70 font-semibold flex items-center gap-1">↻ Revision {revNum} {isCollapsed ? "▸" : "▾"}</span>
                        <div className="h-px flex-1 bg-amber-500/20" />
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {stagesToShow.map(stageDef => {
                        const isCollapsibleStage = COLLAPSIBLE_KEYS.includes(stageDef.key);
                        const collapsed = isCollapsed && isCollapsibleStage;
                        return <StageRow key={`${stageDef.key}-${revNum}`} track={track} stageDef={stageDef} revNum={revNum} isLatest={isLatest} collapsed={collapsed} />;
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

              return (
                <div className={`flex-1 min-w-0 border border-white/[0.06] rounded-2xl overflow-hidden ${isApproved ? "border-emerald-500/20 bg-emerald-500/[0.02]" : isKilledTrack ? "border-red-500/10 opacity-60" : "bg-white/[0.01]"}`}>
                  {/* Factory header */}
                  <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
                    <Factory size={11} className="text-white/30 flex-shrink-0" />
                    <span className="text-xs font-bold text-white truncate flex-1">{track.factory_catalog?.name}</span>
                    {isApproved && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">✓{track.approved_price ? ` $${track.approved_price}` : ""}</span>}
                    {isKilledTrack && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0">Discontinued</span>}
                    {revision > 0 && !isApproved && !isKilledTrack && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 flex-shrink-0">Rev {revision}</span>}
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
                            setSavingNote(true);
                            const noteWithDate = factoryNote ? `${factoryNote} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "";
                            await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "update_track_notes", track_id: track.id, notes: noteWithDate }) });
                            setSavingNote(false); setEditingNote(false); setFactoryNote(noteWithDate); load();
                          }} disabled={savingNote} className="text-[9px] px-2 py-1 rounded bg-white text-black font-bold disabled:opacity-40">Save</button>
                          <button onClick={() => setEditingNote(false)} className="text-[9px] px-2 py-1 rounded border border-white/[0.06] text-white/30">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setEditingNote(true)} className="w-full text-left group">
                        {factoryNote ? (
                          <p className="text-[10px] text-white/35 group-hover:text-white/60 transition leading-relaxed">{factoryNote}</p>
                        ) : (
                          <p className="text-[10px] text-white/15 group-hover:text-white/30 transition italic">+ Add factory note</p>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            };

            // Group tracks into rows of 4
            const trackRows: any[][] = [];
            for (let i = 0; i < tracks.length; i += 4) trackRows.push(tracks.slice(i, i + 4));

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
                  </div>
                </div>

                {/* Add factory row */}
                {addingFactory && (
                  <div className="flex items-center gap-2 p-3 border border-white/[0.08] rounded-xl bg-white/[0.02]">
                    <select value={newTrackFactoryId} onChange={e => setNewTrackFactoryId(e.target.value)}
                      className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none">
                      <option value="">Select factory...</option>
                      {availableFactories.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <button onClick={async () => {
                      if (!newTrackFactoryId) return;
                      await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "create_track", product_id: product.id, factory_id: newTrackFactoryId }) });
                      setAddingFactory(false); setNewTrackFactoryId(""); load();
                    }} disabled={!newTrackFactoryId} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                      <Check size={11} />Add
                    </button>
                    <button onClick={() => { setAddingFactory(false); setNewTrackFactoryId(""); }}
                      className="px-3 py-2 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                  </div>
                )}

                {tracks.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-white/[0.06] rounded-2xl">
                    <p className="text-xs text-white/20">No factories added yet</p>
                    <p className="text-[11px] text-white/15 mt-1">Click "Add Factory" to start tracking</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {trackRows.map((row, rowIdx) => (
                      <div key={rowIdx} className="flex gap-3 items-start">
                        {row.map((track: any) => <FactoryColumn key={track.id} track={track} />)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Approve track modal */}
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
                    setRequestingRevision(false); setRevisionModal(null); load();
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

          {/* ── SAMPLE REQUESTS SECTION ── */}
          {(() => {
            const sampleRequests = product.plm_sample_requests || [];
            const devIdx = DEV_STAGES.findIndex(s => s.key === (product.current_stage || "concept"));
            const quotesReceivedIdx = DEV_STAGES.findIndex(s => s.key === "quotes_received");
            const showRequestButton = devIdx >= quotesReceivedIdx;
            const SAMPLE_STAGES = [
              { key: "sample_production", label: "Sample Production", color: "#f59e0b" },
              { key: "sample_complete", label: "Sample Complete", color: "#f59e0b" },
              { key: "sample_shipped", label: "Sample Shipped", color: "#3b82f6" },
              { key: "sample_arrived", label: "Sample Arrived", color: "#10b981" },
            ];
            return (
              <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-white/[0.01]">
                <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Samples</p>
                    <p className="text-xs text-white/30 mt-0.5">Track sample progress per factory</p>
                  </div>
                  {showRequestButton && !isKilled && !isHold && !sampleRequests.some((sr: any) => sr.status === "approved") && (
                    <button onClick={() => setShowSampleModal(true)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition">
                      <Plus size={11} />Request Samples
                    </button>
                  )}
                </div>

                {sampleSuccess && (
                  <div className="px-6 py-3 border-b border-white/[0.04] flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/5">
                    <Check size={12} />{sampleSuccess}
                  </div>
                )}

                {sampleRequests.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-xs text-white/20">No samples requested yet</p>
                    {showRequestButton && <p className="text-[11px] text-white/15 mt-1">Click "Request Samples" to start</p>}
                    {!showRequestButton && <p className="text-[11px] text-white/15 mt-1">Available after quotes are received</p>}
                  </div>
                ) : (() => {
                  const STAGE_KEYS = ["sample_production","sample_complete","sample_shipped","sample_arrived"];
                  const STAGE_LABELS: Record<string,string> = { sample_production:"Production", sample_complete:"Complete", sample_shipped:"Shipped", sample_arrived:"Arrived" };
                  const STAGE_COLORS: Record<string,string> = { sample_production:"#f59e0b", sample_complete:"#10b981", sample_shipped:"#3b82f6", sample_arrived:"#8b5cf6" };

                  // Group by factory
                  const byFactory: Record<string, any[]> = {};
                  sampleRequests.forEach((sr: any) => {
                    const fid = sr.factory_id;
                    if (!byFactory[fid]) byFactory[fid] = [];
                    byFactory[fid].push(sr);
                  });

                  return (
                    <div className="divide-y divide-white/[0.04]">
                      {Object.entries(byFactory).map(([factoryId, rounds]) => {
                        const sortedRounds = [...rounds].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                        const factory = sortedRounds[0]?.factory_catalog;
                        const allKilled = sortedRounds.every((r: any) => r.status === "killed");
                        const anyApproved = sortedRounds.some((r: any) => r.status === "approved");
                        const latestRound = sortedRounds[sortedRounds.length - 1];

                        return (
                          <div key={factoryId} className="px-6 py-4 space-y-3">
                            {/* Factory name */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Factory size={12} className="text-white/30" />
                                <span className="text-sm font-semibold text-white">{factory?.name}</span>
                                {anyApproved && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">✓ Approved</span>
                                  <button onClick={() => {
                                    // Check if latest round is at least shipped
                                    const latestActive = sortedRounds.filter((r: any) => r.status === "requested");
                                    const lastRound = sortedRounds[sortedRounds.length - 1];
                                    const shippedStages = ["sample_shipped","sample_arrived","sample_approved"];
                                    if (latestActive.length > 0 && !shippedStages.includes(lastRound?.current_stage)) {
                                      setSampleSuccess("Previous sample must be shipped before requesting another");
                                      setTimeout(() => setSampleSuccess(""), 4000);
                                      return;
                                    }
                                    setAdditionalSampleModal({ factoryId, factoryName: factory?.name });
                                    setAdditionalSampleQty("1");
                                    setAdditionalSampleNote("");
                                  }} className="text-[10px] text-white/30 hover:text-white/60 underline transition">
                                    + Request Another
                                  </button>
                                </div>
                              )}
                                {allKilled && !anyApproved && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">Killed</span>
                                    <button onClick={() => triggerSampleOutcome(latestRound.id, factoryId, latestRound.current_stage, "", "unkill")}
                                      className="text-[10px] text-white/30 hover:text-white/60 underline">Revive</button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Rounds as horizontal boxes */}
                            <div className="space-y-2">
                              {sortedRounds.map((sr: any, roundIdx: number) => {
                                const isActive = sr.status === "requested";
                                const isKilled = sr.status === "killed";
                                const isApproved = sr.status === "approved";
                                const isRevision = sr.status === "revision";
                                const isAdditional = sr.label === "additional";
                                const roundLabel = roundIdx === 0 ? "Round 1" : isAdditional ? `Additional Sample ${roundIdx}` : `Round ${roundIdx + 1} — Revision`;
                                const roundSubtitle = isAdditional && (sr.qty || sr.notes) ? `${sr.qty ? sr.qty + " units" : ""}${sr.qty && sr.notes ? " · " : ""}${sr.notes || ""}` : null;
                                const stages = (sr.plm_sample_stages || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                const completedStageKeys = stages.map((s: any) => s.stage).filter((k: string) => STAGE_KEYS.includes(k));
                                const lastCompletedIdx = Math.max(...completedStageKeys.map((k: string) => STAGE_KEYS.indexOf(k)));
                                const revisionNote_text = stages.find((s: any) => s.stage === "revision_requested")?.notes;

                                return (
                                  <div key={sr.id} className={`border rounded-2xl p-4 space-y-3 ${isKilled ? "border-red-500/15 bg-red-500/[0.02] opacity-60" : isApproved ? "border-emerald-500/20 bg-emerald-500/[0.02]" : isRevision ? "border-amber-500/15 bg-amber-500/[0.02]" : "border-white/[0.08] bg-white/[0.01]"}`}>
                                    {/* Round label + delete */}
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">{roundLabel}</p>
                                        {roundSubtitle && <p className="text-[10px] text-amber-300/60 mt-0.5">{roundSubtitle}</p>}
                                      </div>
                                      <button onClick={async () => {
                                        if (!confirm("Delete this round?")) return;
                                        setDeletingRound(sr.id);
                                        await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ action: "delete_sample_request", sample_request_id: sr.id }) });
                                        setDeletingRound(null);
                                        load();
                                      }} disabled={deletingRound === sr.id}
                                        className="text-white/15 hover:text-red-400 transition p-1">
                                        <Trash2 size={10} />
                                      </button>
                                    </div>

                                    {/* Horizontal stage pills + result inline */}
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
                                      {/* Result inline at end */}
                                      {(isApproved || isRevision || isKilled) && <span className="text-white/10 text-[10px]">→</span>}
                                      {isApproved && (
                                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                                          <Check size={8} />Approved
                                        </span>
                                      )}
                                      {isRevision && (
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border border-amber-500/30 bg-amber-500/10 text-amber-400">
                                          ↩ Revision{revisionNote_text ? `: ${revisionNote_text}` : ""}
                                        </span>
                                      )}
                                      {isKilled && (() => {
                                        const isLastRound = roundIdx === sortedRounds.length - 1;
                                        const killedNote = stages.find((s: any) => s.stage === "killed")?.notes || "";
                                        if (!isLastRound) {
                                          return (
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border border-amber-500/30 bg-amber-500/10 text-amber-400">
                                              ↩ Revision Requested
                                            </span>
                                          );
                                        }
                                        return (
                                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border border-red-500/20 bg-red-500/10 text-red-400">
                                            <X size={8} />{killedNote || "Killed"}
                                          </span>
                                        );
                                      })()}
                                    </div>

                                    {/* Active round actions */}
                                    {isActive && (
                                      <div className="space-y-2 pt-1 border-t border-white/[0.05]">
                                        {sr.current_stage === "sample_shipped" && (
                                          <button onClick={() => updateSampleStage(sr.id, factoryId, "sample_arrived", "Sample marked as arrived by admin")}
                                            disabled={updatingSampleStage === sr.id}
                                            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition disabled:opacity-40">
                                            {updatingSampleStage === sr.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                                            Mark Sample Arrived
                                          </button>
                                        )}
                                        {sr.current_stage === "sample_arrived" && sr.label !== "additional" && (
                                          <div className="space-y-2">
                                            <p className="text-[10px] text-white/25 uppercase tracking-widest">Review</p>
                                            <div className="flex gap-1.5 flex-wrap">
                                              <button onClick={() => triggerSampleOutcome(sr.id, factoryId, "sample_arrived", "Sample approved — moving to production", "approved")}
                                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition">
                                                <Check size={11} />Approve
                                              </button>
                                              <button onClick={() => setShowRevisionInput(showRevisionInput === sr.id ? null : sr.id)}
                                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition">
                                                ↩ Request Revision
                                              </button>
                                              <button onClick={() => triggerSampleOutcome(sr.id, factoryId, sr.current_stage, "Sample killed for this factory", "killed")}
                                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition">
                                                <X size={11} />Kill Factory
                                              </button>
                                              <button onClick={() => triggerSampleOutcome(sr.id, factoryId, sr.current_stage, "Product killed", "killed")}
                                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-red-900/20 border border-red-900/30 text-red-600 hover:bg-red-900/30 transition">
                                                <X size={11} />Kill Product
                                              </button>
                                            </div>
                                            {showRevisionInput === sr.id && (
                                              <div className="space-y-1.5">
                                                <textarea value={revisionNote[sr.id] || ""} onChange={e => setRevisionNote(prev => ({ ...prev, [sr.id]: e.target.value }))}
                                                  placeholder="Describe the revision needed..."
                                                  rows={2} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none resize-none" />
                                                <button onClick={() => {
                                                  triggerSampleOutcome(sr.id, factoryId, "sample_production", revisionNote[sr.id] || "Revision requested", "revision");
                                                  setShowRevisionInput(null);
                                                  setRevisionNote(prev => ({ ...prev, [sr.id]: "" }));
                                                }} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition">
                                                  Send Revision Request
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

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

            {showNewOrder && (
              <div className="px-6 py-4 border-b border-white/[0.04] space-y-3">
                <p className="text-xs font-semibold text-white/60">New Production Order</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lc}>Factory</label>
                    <select value={newOrder.factory_id} onChange={e => setNewOrder({...newOrder, factory_id: e.target.value})} className={ic}>
                      <option value="">Select factory</option>
                      {factories.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div><label className={lc}>PO Number</label><input value={newOrder.linked_po_number} onChange={e => setNewOrder({...newOrder, linked_po_number: e.target.value})} placeholder="PO-2026-001" className={ic} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={lc}>Order Qty</label><input value={newOrder.order_quantity} onChange={e => setNewOrder({...newOrder, order_quantity: e.target.value})} placeholder="500" className={ic} /></div>
                  <div><label className={lc}>Target ELC ($)</label><input value={newOrder.target_elc} onChange={e => setNewOrder({...newOrder, target_elc: e.target.value})} placeholder="2.50" className={ic} /></div>
                  <div><label className={lc}>Sell Price ($)</label><input value={newOrder.target_sell_price} onChange={e => setNewOrder({...newOrder, target_sell_price: e.target.value})} placeholder="12.99" className={ic} /></div>
                </div>
                <div><label className={lc}>Notes</label><textarea value={newOrder.batch_notes} onChange={e => setNewOrder({...newOrder, batch_notes: e.target.value})} rows={2} className={`${ic} resize-none`} /></div>
                <div className="flex gap-2">
                  <button onClick={createOrder} disabled={savingOrder} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                    {savingOrder ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Create Order
                  </button>
                  <button onClick={() => setShowNewOrder(false)} className="px-3 py-2 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            )}

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
                      const devComplete = product.current_stage === "sample_approved";
                      if (!devComplete) return (
                        <div className="border border-white/[0.06] rounded-xl px-4 py-3 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-white/20" />
                          <p className="text-xs text-white/30">Production unlocks once development reaches Sample Approved</p>
                        </div>
                      );
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

                    {/* Order financials — inline editable */}
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "ELC", field: "target_elc", value: order.target_elc ? `$${order.target_elc}` : "—" },
                        { label: "Sell Price", field: "target_sell_price", value: order.target_sell_price ? `$${order.target_sell_price}` : "—" },
                        { label: "Margin", field: null, value: margin !== null ? `${margin}%` : "—" },
                        { label: "Qty", field: "order_quantity", value: order.order_quantity ? order.order_quantity.toLocaleString() : "—" },
                      ].map(item => (
                        <div key={item.label} className="group">
                          <p className="text-[10px] text-white/25 mb-0.5">{item.label}</p>
                          <p className="text-xs text-white/60 font-semibold">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Stage history */}
                    {history.length > 0 && (
                      <div className="space-y-1 border-t border-white/[0.04] pt-2">
                        {history.slice(0, 3).map((h: any) => {
                          const s = stageInfo(h.stage);
                          return (
                            <div key={h.id} className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                              <span className="text-[11px] text-white/40">{s.label}</span>
                              {h.notes && <span className="text-[11px] text-white/25">· {h.notes}</span>}
                              <span className="text-[10px] text-white/20 ml-auto">{new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── PRODUCT DETAILS — INLINE EDITING ── */}
          <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01] space-y-5">
            <p className="text-[10px] text-white/25 uppercase tracking-widest">Product Details</p>
            <InlineField label="Product Name" value={product.name || ""} onSave={v => saveField("name", v)} disabled={isKilled} />
            <InlineField label="SKU" value={product.sku || ""} onSave={v => saveField("sku", v)} disabled={isKilled} />
            <InlineField label="Description" value={product.description || ""} onSave={v => saveField("description", v)} multiline disabled={isKilled} />
            <InlineField label="Specs" value={product.specs || ""} onSave={v => saveField("specs", v)} multiline disabled={isKilled} />
            <InlineField label="Category" value={product.category || ""} onSave={v => saveField("category", v)} disabled={isKilled} />
            <div className="group">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-white/30 uppercase tracking-widest">Collection</p>
              </div>
              <select value={product.collection_id || ""} onChange={e => saveCollectionField(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-sm focus:outline-none focus:border-white/20 transition">
                <option value="">No collection</option>
                {collections.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <InlineField label="Reference / Dropbox Link" value={product.reference_url || ""} onSave={v => saveField("reference_url", v)} disabled={isKilled} />
            {product.reference_url && (
              <a href={product.reference_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition underline underline-offset-2">
                ↗ Open link
              </a>
            )}
            <InlineField label="Admin Notes (private)" value={product.notes || ""} onSave={v => saveField("notes", v)} multiline disabled={isKilled} />
            <InlineField label="Factory Notes (visible to factory)" value={product.factory_notes || ""} onSave={v => saveField("factory_notes", v)} multiline disabled={isKilled} />
          </div>

          {/* ── IMAGES ── */}
          {enlargedImage && (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center cursor-pointer"
              onClick={() => setEnlargedImage(null)}>
              <img
                src={enlargedImage}
                alt=""
                style={{ maxWidth: "92vw", maxHeight: "92vh", width: "auto", height: "auto", borderRadius: "16px", objectFit: "contain", boxShadow: "0 0 80px rgba(0,0,0,0.8)" }}
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
                          {h.updated_by_role === "factory" ? "Factory" : h.updated_by_role === "designer" ? "Designer" : "Admin"} · {new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
            <div className="flex-1 min-w-[200px] border border-white/[0.06] rounded-2xl p-5 bg-white/[0.01]">
              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">Assigned Team</p>
              <div className="space-y-2">
                {(product.plm_assignments || []).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[9px] text-white/50 font-bold">
                        {(a.factory_portal_users?.name || a.factory_portal_users?.email || "?")[0].toUpperCase()}
                      </div>
                      <span className="text-[11px] text-white/50 truncate">{a.factory_portal_users?.name || a.factory_portal_users?.email}</span>
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
            {product.action_status && product.action_status !== "up_to_date" && (
              <div className={`flex-1 min-w-[200px] border rounded-2xl p-4 ${product.action_status === "action_required" ? "border-red-500/20 bg-red-500/[0.03]" : "border-blue-500/20 bg-blue-500/[0.03]"}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${product.action_status === "action_required" ? "text-red-400" : "text-blue-400"}`}>
                    {product.action_status === "action_required" ? "⚡ Action Required" : "● Updates Made"}
                  </p>
                  <button onClick={async () => {
                    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "dismiss_action", product_id: product.id }) });
                    load();
                  }} className="text-[10px] text-white/20 hover:text-white/50 transition">Dismiss</button>
                </div>
                <p className="text-[11px] text-white/40">
                  {product.action_status === "action_required" ? "This product needs your attention." : "Factory has made progress on this product."}
                </p>
              </div>
            )}
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
