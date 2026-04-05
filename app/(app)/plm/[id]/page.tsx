"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Package, ArrowLeft, Factory, Layers, Check, Loader2,
  X, ChevronDown, Plus, ImagePlus, Trash2, Pencil, CheckSquare, Square
} from "lucide-react";

const MILESTONES = [
  { key: "design_brief", label: "Design Brief" },
  { key: "sampling", label: "Sampling" },
  { key: "sample_approved", label: "Sample Approved" },
];

const BATCH_STAGES = [
  { key: "rfq_sent", label: "RFQ Sent", color: "#3b82f6" },
  { key: "factory_selected", label: "Factory Selected", color: "#3b82f6" },
  { key: "po_issued", label: "PO Issued", color: "#f59e0b" },
  { key: "production_started", label: "Production Started", color: "#f59e0b" },
  { key: "production_complete", label: "Production Complete", color: "#10b981" },
  { key: "qc_inspection", label: "QC Inspection", color: "#f59e0b" },
  { key: "shipped", label: "Shipped", color: "#3b82f6" },
  { key: "in_transit", label: "In Transit", color: "#3b82f6" },
  { key: "customs", label: "Customs Clearance", color: "#f59e0b" },
  { key: "delivered", label: "Delivered", color: "#10b981" },
  { key: "active", label: "Active / Selling", color: "#10b981" },
];

function getProductStatus(batches: any[]) {
  if (!batches?.length) return null;
  const order = BATCH_STAGES.map(s => s.key);
  let mostAdvanced = batches[0]?.current_stage;
  for (const b of batches) {
    if (order.indexOf(b.current_stage) > order.indexOf(mostAdvanced)) {
      mostAdvanced = b.current_stage;
    }
  }
  return BATCH_STAGES.find(s => s.key === mostAdvanced);
}

export default function ProductPage() {
  const { id } = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [factories, setFactories] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);

  // Edit
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Batch
  const [showNewBatch, setShowNewBatch] = useState(false);
  const [newBatch, setNewBatch] = useState({ quantity: "", notes: "", stage: "rfq_sent" });
  const [savingBatch, setSavingBatch] = useState(false);

  // Batch stage update
  const [editingBatch, setEditingBatch] = useState<any>(null);
  const [batchStageForm, setBatchStageForm] = useState({ stage: "", note: "" });
  const [updatingBatch, setUpdatingBatch] = useState(false);

  // Images
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImage, setDeletingImage] = useState<string | null>(null);

  // Milestones
  const [togglingMilestone, setTogglingMilestone] = useState<string | null>(null);

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

  const toggleMilestone = async (key: string) => {
    setTogglingMilestone(key);
    const current = product?.milestones?.[key] || false;
    await fetch("/api/plm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_milestone", product_id: id, milestone: key, value: !current }),
    });
    setTogglingMilestone(null);
    load();
  };

  const openEdit = () => {
    setEditForm({
      name: product.name || "",
      sku: product.sku || "",
      description: product.description || "",
      specs: product.specs || "",
      category: product.category || "",
      collection_id: product.collection_id || "",
      factory_id: product.factory_id || "",
      target_elc: product.target_elc || "",
      actual_elc: product.actual_elc || "",
      target_sell_price: product.target_sell_price || "",
      moq: product.moq || "",
      order_quantity: product.order_quantity || "",
      linked_po_number: product.linked_po_number || "",
      notes: product.notes || "",
    });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    await fetch("/api/plm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_product", id: product.id, ...editForm,
        target_elc: editForm.target_elc ? parseFloat(editForm.target_elc) : null,
        actual_elc: editForm.actual_elc ? parseFloat(editForm.actual_elc) : null,
        target_sell_price: editForm.target_sell_price ? parseFloat(editForm.target_sell_price) : null,
        moq: editForm.moq ? parseInt(editForm.moq) : null,
        order_quantity: editForm.order_quantity ? parseInt(editForm.order_quantity) : null,
        collection_id: editForm.collection_id || null,
        factory_id: editForm.factory_id || null,
      }),
    });
    setSavingEdit(false);
    setShowEditModal(false);
    load();
  };

  const createBatch = async () => {
    setSavingBatch(true);
    await fetch("/api/plm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_batch", product_id: id, quantity: newBatch.quantity ? parseInt(newBatch.quantity) : null, notes: newBatch.notes, stage: newBatch.stage }),
    });
    setSavingBatch(false);
    setShowNewBatch(false);
    setNewBatch({ quantity: "", notes: "", stage: "rfq_sent" });
    load();
  };

  const openBatchEdit = (batch: any) => {
    setEditingBatch(batch);
    setBatchStageForm({ stage: batch.current_stage, note: "" });
  };

  const saveBatchStage = async () => {
    if (!editingBatch) return;
    setUpdatingBatch(true);
    await fetch("/api/plm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_batch_stage", batch_id: editingBatch.id, product_id: id, stage: batchStageForm.stage, notes: batchStageForm.note }),
    });
    setUpdatingBatch(false);
    setEditingBatch(null);
    load();
  };

  const deleteBatch = async (batchId: string) => {
    await fetch("/api/plm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_batch", id: batchId }),
    });
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
    await fetch("/api/plm/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: id, url }),
    });
    setDeletingImage(null);
    load();
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 size={20} className="animate-spin text-white/20" />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-white/30">Product not found</p>
    </div>
  );

  const batches = (product.plm_batches || []).sort((a: any, b: any) => a.batch_number - b.batch_number);
  const productStatus = getProductStatus(batches);
  const milestones = product.milestones || {};
  const ic = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20 transition";
  const lc = "text-[11px] text-white/30 mb-1 block";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-3 my-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Edit Product</p>
              <button onClick={() => setShowEditModal(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lc}>Product Name</label><input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className={ic} /></div>
              <div><label className={lc}>SKU</label><input value={editForm.sku} onChange={e => setEditForm({...editForm, sku: e.target.value})} className={ic} /></div>
            </div>
            <div><label className={lc}>Description</label><input value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className={ic} /></div>
            <div><label className={lc}>Specs</label><textarea value={editForm.specs} onChange={e => setEditForm({...editForm, specs: e.target.value})} rows={2} className={`${ic} resize-none`} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lc}>Category</label><input value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className={ic} /></div>
              <div><label className={lc}>PO Number</label><input value={editForm.linked_po_number} onChange={e => setEditForm({...editForm, linked_po_number: e.target.value})} className={ic} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lc}>Collection</label>
                <select value={editForm.collection_id} onChange={e => setEditForm({...editForm, collection_id: e.target.value})} className={ic}>
                  <option value="">No collection</option>
                  {collections.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lc}>Factory</label>
                <select value={editForm.factory_id} onChange={e => setEditForm({...editForm, factory_id: e.target.value})} className={ic}>
                  <option value="">Not assigned</option>
                  {factories.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lc}>Target ELC ($)</label><input value={editForm.target_elc} onChange={e => setEditForm({...editForm, target_elc: e.target.value})} placeholder="2.50" className={ic} /></div>
              <div><label className={lc}>Actual ELC ($)</label><input value={editForm.actual_elc} onChange={e => setEditForm({...editForm, actual_elc: e.target.value})} placeholder="2.30" className={ic} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lc}>Target Sell Price ($)</label><input value={editForm.target_sell_price} onChange={e => setEditForm({...editForm, target_sell_price: e.target.value})} placeholder="12.99" className={ic} /></div>
              <div><label className={lc}>Order Quantity</label><input value={editForm.order_quantity} onChange={e => setEditForm({...editForm, order_quantity: e.target.value})} placeholder="500" className={ic} /></div>
            </div>
            <div><label className={lc}>MOQ</label><input value={editForm.moq} onChange={e => setEditForm({...editForm, moq: e.target.value})} placeholder="300" className={ic} /></div>
            <div><label className={lc}>Notes</label><textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} rows={2} className={`${ic} resize-none`} /></div>
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={savingEdit} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                {savingEdit ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Save Changes
              </button>
              <button onClick={() => setShowEditModal(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Stage Modal */}
      {editingBatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Update Batch #{editingBatch.batch_number}</p>
              <button onClick={() => setEditingBatch(null)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {BATCH_STAGES.map(stage => (
                <button key={stage.key} onClick={() => setBatchStageForm({...batchStageForm, stage: stage.key})}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-left transition border ${batchStageForm.stage === stage.key ? "border-white/20 bg-white/[0.06]" : "border-white/[0.06] hover:bg-white/[0.03]"}`}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                  <span className="text-white/70">{stage.label}</span>
                  {batchStageForm.stage === stage.key && <Check size={10} className="text-white/50 ml-auto" />}
                </button>
              ))}
            </div>
            <div>
              <label className={lc}>Notes (optional)</label>
              <textarea value={batchStageForm.note} onChange={e => setBatchStageForm({...batchStageForm, note: e.target.value})}
                placeholder="e.g. DHL tracking #123456, arrived at port" rows={2}
                className={`${ic} resize-none`} />
            </div>
            <div className="flex gap-2">
              <button onClick={saveBatchStage} disabled={updatingBatch}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                {updatingBatch ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Update Stage
              </button>
              <button onClick={() => setEditingBatch(null)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
            </div>
          </div>
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
                <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
                {product.sku && <span className="text-xs text-white/30 font-mono bg-white/[0.04] px-2 py-0.5 rounded-lg">{product.sku}</span>}
                {productStatus && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${productStatus.color}20`, color: productStatus.color, border: `1px solid ${productStatus.color}30` }}>
                    {productStatus.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-white/30">
                {product.plm_collections && <span className="flex items-center gap-1"><Layers size={10} />{product.plm_collections.name}</span>}
                {product.factory_catalog && <span className="flex items-center gap-1"><Factory size={10} />{product.factory_catalog.name}</span>}
                {product.category && <span>{product.category}</span>}
              </div>
            </div>
            <button onClick={openEdit} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition text-sm bg-white/[0.02]">
              <Pencil size={13} />Edit
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-6">

          {/* Pre-production Milestones */}
          <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Pre-Production Milestones</p>
            <div className="space-y-2">
              {MILESTONES.map(m => {
                const done = !!milestones[m.key];
                return (
                  <button key={m.key} onClick={() => toggleMilestone(m.key)} disabled={togglingMilestone === m.key}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition text-left hover:bg-white/[0.02]"
                    style={{ borderColor: done ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.06)", background: done ? "rgba(16,185,129,0.05)" : "" }}>
                    {togglingMilestone === m.key ? (
                      <Loader2 size={14} className="animate-spin text-white/30 flex-shrink-0" />
                    ) : done ? (
                      <CheckSquare size={14} className="text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square size={14} className="text-white/20 flex-shrink-0" />
                    )}
                    <span className={`text-sm font-medium ${done ? "text-emerald-400" : "text-white/40"}`}>{m.label}</span>
                    {done && <span className="text-[10px] text-emerald-400/50 ml-auto">Complete</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Production Batches */}
          <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01]">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest">Production Batches</p>
              <button onClick={() => setShowNewBatch(!showNewBatch)}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 border border-white/[0.06] hover:border-white/20 px-3 py-1.5 rounded-lg transition">
                <Plus size={11} />Add Batch
              </button>
            </div>

            {showNewBatch && (
              <div className="border border-white/[0.08] rounded-xl p-4 mb-4 space-y-3 bg-white/[0.02]">
                <p className="text-xs text-white/40">New Batch</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lc}>Quantity</label>
                    <input value={newBatch.quantity} onChange={e => setNewBatch({...newBatch, quantity: e.target.value})} placeholder="500" className={ic} />
                  </div>
                  <div>
                    <label className={lc}>Starting Stage</label>
                    <select value={newBatch.stage} onChange={e => setNewBatch({...newBatch, stage: e.target.value})} className={ic}>
                      {BATCH_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={lc}>Notes</label>
                  <input value={newBatch.notes} onChange={e => setNewBatch({...newBatch, notes: e.target.value})} placeholder="e.g. Reorder, holiday rush" className={ic} />
                </div>
                <div className="flex gap-2">
                  <button onClick={createBatch} disabled={savingBatch}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                    {savingBatch ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Create Batch
                  </button>
                  <button onClick={() => setShowNewBatch(false)} className="px-3 py-2 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            )}

            {batches.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-white/[0.06] rounded-xl">
                <p className="text-xs text-white/20">No batches yet</p>
                <p className="text-[11px] text-white/15 mt-1">Add a batch once RFQ is sent to start tracking production</p>
              </div>
            ) : (
              <div className="space-y-3">
                {batches.map((batch: any) => {
                  const stage = BATCH_STAGES.find(s => s.key === batch.current_stage);
                  const stageHistory = (batch.plm_batch_stages || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                  return (
                    <div key={batch.id} className="border border-white/[0.06] rounded-xl overflow-hidden">
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-semibold text-white">Batch #{batch.batch_number}</span>
                              {batch.quantity && <span className="text-[11px] text-white/40">{batch.quantity.toLocaleString()} units</span>}
                            </div>
                            {batch.notes && <p className="text-[11px] text-white/30">{batch.notes}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openBatchEdit(batch)}
                            className="text-xs px-3 py-1.5 rounded-lg border font-semibold transition"
                            style={{ borderColor: `${stage?.color}40`, background: `${stage?.color}15`, color: stage?.color }}>
                            {stage?.label} <ChevronDown size={10} className="inline ml-1" />
                          </button>
                          <button onClick={() => deleteBatch(batch.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                      {stageHistory.length > 1 && (
                        <div className="border-t border-white/[0.04] px-4 py-3 space-y-1.5">
                          {stageHistory.slice(0, 3).map((sh: any) => {
                            const s = BATCH_STAGES.find(s => s.key === sh.stage);
                            return (
                              <div key={sh.id} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s?.color || "#6b7280" }} />
                                <span className="text-[11px] text-white/40">{s?.label || sh.stage}</span>
                                {sh.notes && <span className="text-[11px] text-white/25">· {sh.notes}</span>}
                                <span className="text-[10px] text-white/20 ml-auto">
                                  {new Date(sh.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Product Details</p>
            <div className="grid grid-cols-2 gap-4">
              {product.description && <div className="col-span-2"><p className="text-[10px] text-white/30 mb-1">Description</p><p className="text-sm text-white/70">{product.description}</p></div>}
              {product.specs && <div className="col-span-2"><p className="text-[10px] text-white/30 mb-1">Specs</p><p className="text-sm text-white/60 whitespace-pre-wrap">{product.specs}</p></div>}
              {product.target_elc && <div><p className="text-[10px] text-white/30 mb-1">Target ELC</p><p className="text-sm text-white/70 font-semibold">${product.target_elc}</p></div>}
              {product.actual_elc && <div><p className="text-[10px] text-white/30 mb-1">Actual ELC</p><p className="text-sm text-white/70 font-semibold">${product.actual_elc}</p></div>}
              {product.target_sell_price && <div><p className="text-[10px] text-white/30 mb-1">Target Sell Price</p><p className="text-sm text-white/70 font-semibold">${product.target_sell_price}</p></div>}
              {product.target_elc && product.target_sell_price && (
                <div><p className="text-[10px] text-white/30 mb-1">Target Margin</p>
                  <p className="text-sm text-emerald-400 font-semibold">{Math.round(((product.target_sell_price - product.target_elc) / product.target_sell_price) * 100)}%</p>
                </div>
              )}
              {product.order_quantity && <div><p className="text-[10px] text-white/30 mb-1">Order Quantity</p><p className="text-sm text-white/70">{product.order_quantity.toLocaleString()} units</p></div>}
              {product.moq && <div><p className="text-[10px] text-white/30 mb-1">MOQ</p><p className="text-sm text-white/70">{product.moq.toLocaleString()} units</p></div>}
              {product.linked_po_number && <div><p className="text-[10px] text-white/30 mb-1">PO Number</p><p className="text-sm text-white/70 font-mono">{product.linked_po_number}</p></div>}
              {product.notes && <div className="col-span-2"><p className="text-[10px] text-white/30 mb-1">Notes</p><p className="text-sm text-white/60">{product.notes}</p></div>}
            </div>
          </div>

          {/* Images */}
          <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01]">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest">Product Images</p>
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
                <label className="mt-2 text-xs text-white/30 hover:text-white/60 cursor-pointer transition underline underline-offset-2">
                  Upload one
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
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
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <div className="border border-white/[0.06] rounded-2xl p-5 bg-white/[0.01]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Status Summary</p>
            {productStatus ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-white/30 mb-1">Overall Status</p>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${productStatus.color}20`, color: productStatus.color, border: `1px solid ${productStatus.color}30` }}>
                    {productStatus.label}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 mb-2">Batches</p>
                  {batches.map((b: any) => {
                    const s = BATCH_STAGES.find(s => s.key === b.current_stage);
                    return (
                      <div key={b.id} className="flex items-center justify-between py-1.5">
                        <span className="text-[11px] text-white/50">Batch #{b.batch_number}{b.quantity ? ` · ${b.quantity.toLocaleString()} units` : ""}</span>
                        <span className="text-[10px] font-medium" style={{ color: s?.color }}>{s?.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-white/30">No batches yet</p>
                <div className="space-y-1">
                  {MILESTONES.map(m => (
                    <div key={m.key} className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${milestones[m.key] ? "bg-emerald-400" : "bg-white/10"}`} />
                      <span className={`text-[11px] ${milestones[m.key] ? "text-emerald-400" : "text-white/25"}`}>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border border-white/[0.06] rounded-2xl p-5 bg-white/[0.01]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">Info</p>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-[11px] text-white/30">Created</span><span className="text-[11px] text-white/50">{new Date(product.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>
              <div className="flex justify-between"><span className="text-[11px] text-white/30">Batches</span><span className="text-[11px] text-white/50">{batches.length}</span></div>
              <div className="flex justify-between"><span className="text-[11px] text-white/30">Total units</span><span className="text-[11px] text-white/50">{batches.reduce((sum: number, b: any) => sum + (b.quantity || 0), 0).toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
