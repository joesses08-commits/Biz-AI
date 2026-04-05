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
  { key: "artwork_sent", label: "Artwork Sent", color: "#8b5cf6" },
  { key: "quotes_received", label: "Quotes Received", color: "#3b82f6" },
  { key: "samples_requested", label: "Samples Requested", color: "#f59e0b" },
  { key: "sample_production", label: "Sample Production", color: "#f59e0b" },
  { key: "sample_complete", label: "Sample Complete", color: "#f59e0b" },
  { key: "sample_shipped", label: "Sample Shipped", color: "#3b82f6" },
  { key: "sample_arrived", label: "Sample Arrived", color: "#10b981" },
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

function InlineField({ label, value, onSave, multiline = false, type = "text" }: {
  label: string; value: string; onSave: (v: string) => Promise<void>; multiline?: boolean; type?: string;
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
        {!editing && (
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

  // Orders
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({ factory_id: "", order_quantity: "", moq: "", target_elc: "", actual_elc: "", target_sell_price: "", linked_po_number: "", batch_notes: "" });
  const [savingOrder, setSavingOrder] = useState(false);
  const [updatingOrderStage, setUpdatingOrderStage] = useState<string | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);

  // Images
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImage, setDeletingImage] = useState<string | null>(null);

  const load = async () => {
    const [prodRes, catRes, colRes] = await Promise.all([
      fetch(`/api/plm?type=product&id=${id}`),
      fetch("/api/catalog?type=factories"),
      fetch("/api/plm?type=collections"),
    ]);
    const prodData = await prodRes.json();
    const catData = await catRes.json();
    const colData = await colRes.json();
    setProduct(prodData.product);
    setFactories(catData.factories || []);
    setCollections(colData.collections || []);
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

  const updateDevStage = async (stage: string) => {
    setUpdatingDevStage(true);
    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_product", id: product.id, current_stage: stage }) });
    setUpdatingDevStage(false);
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
    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_batch_stage", batch_id: orderId, product_id: id, stage }) });
    setUpdatingOrderStage(null);
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

  const currentDevStage = stageInfo(product.current_stage || "concept");
  const ic = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20 transition";
  const lc = "text-[10px] text-white/30 uppercase tracking-widest mb-1 block";

  // Build full history from plm_stages + all order stages
  const productHistory = [
    ...(product.plm_stages || []),
    ...(product.plm_batches || []).flatMap((b: any) =>
      (b.plm_batch_stages || []).map((s: any) => ({ ...s, _order_num: b.batch_number }))
    ),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">


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
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{product.name}</h1>
                {product.sku && <span className="text-xs text-white/30 font-mono bg-white/[0.04] px-2 py-0.5 rounded-lg">{product.sku}</span>}
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${currentDevStage.color}20`, color: currentDevStage.color, border: `1px solid ${currentDevStage.color}30` }}>
                  {currentDevStage.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-white/30">
                {product.plm_collections && <span className="flex items-center gap-1"><Layers size={10} />{product.plm_collections.name}</span>}
                {product.category && <span>{product.category}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-6">

          {/* ── DEVELOPMENT SECTION ── */}
          <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-white/[0.01]">
            <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Development</p>
                <p className="text-xs text-white/30 mt-0.5">Concept through sample approved</p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: `${currentDevStage.color}20`, color: currentDevStage.color }}>
                {currentDevStage.label}
              </span>
            </div>

            {/* Dev stage — prev/next navigation */}
            <div className="px-6 py-5">
              {(() => {
                const currentIdx = DEV_STAGES.findIndex(s => s.key === (product.current_stage || "concept"));
                const prev = currentIdx > 0 ? DEV_STAGES[currentIdx - 1] : null;
                const next = currentIdx < DEV_STAGES.length - 1 ? DEV_STAGES[currentIdx + 1] : null;
                const current = DEV_STAGES[currentIdx] || DEV_STAGES[0];
                return (
                  <div className="space-y-4">
                    {/* Progress bar */}
                    <div className="w-full bg-white/[0.05] rounded-full h-1">
                      <div className="h-1 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / DEV_STAGES.length) * 100}%`, background: current.color }} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <button onClick={() => prev && updateDevStage(prev.key)} disabled={!prev || updatingDevStage}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20 transition text-xs font-medium disabled:opacity-20 disabled:cursor-not-allowed">
                        ← {prev ? prev.label : "Start"}
                      </button>
                      <div className="text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-2 h-2 rounded-full" style={{ background: current.color }} />
                          <span className="text-sm font-semibold text-white">{current.label}</span>
                        </div>
                        <p className="text-[10px] text-white/25 mt-0.5">{currentIdx + 1} of {DEV_STAGES.length}</p>
                      </div>
                      <button onClick={() => next && updateDevStage(next.key)} disabled={!next || updatingDevStage}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium transition disabled:opacity-20 disabled:cursor-not-allowed"
                        style={next ? { borderColor: `${next.color}40`, color: next.color, background: `${next.color}10` } : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                        {next ? next.label : "Complete"} →
                      </button>
                    </div>
                    {updatingDevStage && <div className="flex justify-center"><Loader2 size={12} className="animate-spin text-white/30" /></div>}

                    {/* Full stage timeline */}
                    <div className="border-t border-white/[0.04] pt-4 space-y-1">
                      {DEV_STAGES.map((s, i) => {
                        const isPast = i < currentIdx;
                        const isCurrent = i === currentIdx;
                        return (
                          <button key={s.key} onClick={() => updateDevStage(s.key)} disabled={updatingDevStage}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.03] transition text-left">
                            <div className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition"
                              style={isCurrent ? { borderColor: s.color, background: `${s.color}20` } : isPast ? { borderColor: "#10b981", background: "#10b98120" } : { borderColor: "rgba(255,255,255,0.1)" }}>
                              {isPast ? <Check size={10} className="text-emerald-400" /> :
                               isCurrent ? <div className="w-2 h-2 rounded-full" style={{ background: s.color }} /> :
                               <div className="w-1.5 h-1.5 rounded-full bg-white/10" />}
                            </div>
                            <span className="text-xs font-medium transition"
                              style={isCurrent ? { color: s.color } : isPast ? { color: "rgba(255,255,255,0.4)" } : { color: "rgba(255,255,255,0.2)" }}>
                              {s.label}
                            </span>
                            {isCurrent && <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${s.color}20`, color: s.color }}>Current</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── PRODUCTION ORDERS SECTION ── */}
          <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-white/[0.01]">
            <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Production Orders</p>
                <p className="text-xs text-white/30 mt-0.5">PO issued through shipped — factory updates these</p>
              </div>
              <button onClick={() => setShowNewOrder(!showNewOrder)}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 border border-white/[0.06] hover:border-white/20 px-3 py-1.5 rounded-lg transition">
                <Plus size={11} />New Order
              </button>
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">Order #{order.batch_number}</span>
                        {orderFactory && <span className="text-xs text-white/30 flex items-center gap-1"><Factory size={9} />{orderFactory.name}</span>}
                        {order.linked_po_number && <span className="text-[10px] text-white/25 font-mono">PO: {order.linked_po_number}</span>}
                      </div>
                      <button onClick={() => deleteOrder(order.id)} disabled={deletingOrder === order.id}
                        className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition">
                        {deletingOrder === order.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      </button>
                    </div>

                    {/* Production stage buttons */}
                    <div>
                      <p className={lc}>Production Stage</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {ORDER_STAGES.map(s => (
                          <button key={s.key} onClick={() => updateOrderStage(order.id, s.key)}
                            disabled={updatingOrderStage === order.id}
                            className={`text-xs px-2.5 py-1 rounded-full border transition font-medium ${order.current_stage === s.key ? "border-current" : "border-white/[0.06] text-white/30 hover:text-white/60"}`}
                            style={order.current_stage === s.key ? { borderColor: s.color, color: s.color, background: `${s.color}15` } : {}}>
                            {s.label}
                          </button>
                        ))}
                        {updatingOrderStage === order.id && <Loader2 size={12} className="animate-spin text-white/30 self-center" />}
                      </div>
                    </div>

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
            <InlineField label="Product Name" value={product.name || ""} onSave={v => saveField("name", v)} />
            <InlineField label="SKU" value={product.sku || ""} onSave={v => saveField("sku", v)} />
            <InlineField label="Description" value={product.description || ""} onSave={v => saveField("description", v)} multiline />
            <InlineField label="Specs" value={product.specs || ""} onSave={v => saveField("specs", v)} multiline />
            <InlineField label="Category" value={product.category || ""} onSave={v => saveField("category", v)} />
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
            <InlineField label="Notes" value={product.notes || ""} onSave={v => saveField("notes", v)} multiline />
          </div>

          {/* ── IMAGES ── */}
          <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01]">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest">Images</p>
              <label className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 cursor-pointer transition px-3 py-1.5 rounded-lg border border-white/[0.06] hover:border-white/10">
                {uploadingImage ? <Loader2 size={11} className="animate-spin" /> : <ImagePlus size={11} />}
                {uploadingImage ? "Uploading..." : "Add Image"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
            </div>
            {(product.images || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 border border-dashed border-white/[0.06] rounded-xl">
                <ImagePlus size={20} className="text-white/10 mb-2" />
                <p className="text-xs text-white/20">No images yet</p>
                <label className="mt-2 text-xs text-white/30 hover:text-white/60 cursor-pointer underline underline-offset-2">
                  Upload one
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {(product.images || []).map((url: string) => (
                  <div key={url} className="relative group rounded-xl overflow-hidden border border-white/[0.06] aspect-square">
                    <img src={url} alt="Product" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <button onClick={() => handleImageDelete(url)} disabled={deletingImage === url}
                        className="p-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition">
                        {deletingImage === url ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── PRODUCT HISTORY ── */}
          <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Product History</p>
            {productHistory.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-4">No history yet</p>
            ) : (
              <div className="space-y-3">
                {productHistory.map((h: any, i: number) => {
                  const s = stageInfo(h.stage);
                  return (
                    <div key={h.id || i} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: s.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-white/60 font-medium">{s.label}</span>
                          {h._order_num && <span className="text-[10px] text-white/25">Order #{h._order_num}</span>}
                          {h.updated_by && <span className="text-[10px] text-white/20">{h.updated_by}</span>}
                        </div>
                        {h.notes && <p className="text-[11px] text-white/35 mt-0.5">{h.notes}</p>}
                      </div>
                      <span className="text-[10px] text-white/20 flex-shrink-0">{new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="space-y-4">
          <div className="border border-white/[0.06] rounded-2xl p-5 bg-white/[0.01]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Status</p>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-white/30 mb-1.5">Development</p>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${currentDevStage.color}20`, color: currentDevStage.color, border: `1px solid ${currentDevStage.color}30` }}>
                  {currentDevStage.label}
                </span>
              </div>
              {orders.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/30 mb-2">Orders</p>
                  {orders.map((o: any) => {
                    const s = stageInfo(o.current_stage);
                    return (
                      <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                        <span className="text-[11px] text-white/50">Order #{o.batch_number}</span>
                        <span className="text-[10px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="border border-white/[0.06] rounded-2xl p-5 bg-white/[0.01]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">Info</p>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-[11px] text-white/30">Created</span><span className="text-[11px] text-white/50">{new Date(product.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>
              <div className="flex justify-between"><span className="text-[11px] text-white/30">Orders</span><span className="text-[11px] text-white/50">{orders.length}</span></div>
              <div className="flex justify-between"><span className="text-[11px] text-white/30">Total units</span><span className="text-[11px] text-white/50">{orders.reduce((sum: number, o: any) => sum + (o.order_quantity || 0), 0).toLocaleString()}</span></div>
              {product.designer_name && <div className="flex justify-between"><span className="text-[11px] text-white/30">Designer</span><span className="text-[11px] text-white/50">{product.designer_name}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
