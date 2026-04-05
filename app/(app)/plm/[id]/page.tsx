"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Package, ArrowLeft, Factory, Layers, Check, Loader2,
  X, ChevronDown, ChevronUp, Plus, Clock, User, FileText, ImagePlus, Trash2
} from "lucide-react";

const STAGES = [
  { key: "design_brief", label: "Design Brief", color: "#6b7280" },
  { key: "sampling", label: "Sampling", color: "#8b5cf6" },
  { key: "sample_approved", label: "Sample Approved", color: "#10b981" },
  { key: "sample_rejected", label: "Sample Rejected", color: "#ef4444" },
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

export default function ProductPage() {
  const { id } = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [showStageMenu, setShowStageMenu] = useState(false);
  const [stageNote, setStageNote] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [showStageModal, setShowStageModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImage, setDeletingImage] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch(`/api/plm?type=product&id=${id}`);
    const data = await res.json();
    setProduct(data.product);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const currentStage = STAGES.find(s => s.key === product?.current_stage);
  const currentStageIndex = STAGES.findIndex(s => s.key === product?.current_stage);

  const openStageUpdate = (stage: string) => {
    setSelectedStage(stage);
    setStageNote("");
    setShowStageModal(true);
    setShowStageMenu(false);
  };

  const updateStage = async () => {
    setUpdatingStage(true);
    await fetch("/api/plm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_stage",
        product_id: id,
        stage: selectedStage,
        notes: stageNote,
      }),
    });
    setUpdatingStage(false);
    setShowStageModal(false);
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Stage update modal */}
      {showStageModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Update Stage</p>
              <button onClick={() => setShowStageModal(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
            <div className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.02]">
              <p className="text-[10px] text-white/30 mb-1">Moving to</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: STAGES.find(s => s.key === selectedStage)?.color }} />
                <p className="text-sm font-semibold text-white">{STAGES.find(s => s.key === selectedStage)?.label}</p>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-white/30 mb-1 block">Notes (optional)</label>
              <textarea value={stageNote} onChange={e => setStageNote(e.target.value)}
                placeholder="Any notes about this stage update..."
                rows={3} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={updateStage} disabled={updatingStage}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 transition disabled:opacity-40">
                {updatingStage ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                Update Stage
              </button>
              <button onClick={() => setShowStageModal(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => router.push("/plm")}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition mb-4">
            <ArrowLeft size={12} />Back to PLM
          </button>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
                {product.sku && <span className="text-xs text-white/30 font-mono bg-white/[0.04] px-2 py-0.5 rounded-lg">{product.sku}</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-white/30">
                {product.plm_collections && (
                  <span className="flex items-center gap-1"><Layers size={10} />{product.plm_collections.name}</span>
                )}
                {product.factory_catalog && (
                  <span className="flex items-center gap-1"><Factory size={10} />{product.factory_catalog.name}</span>
                )}
                {product.category && <span>{product.category}</span>}
              </div>
            </div>

            {/* Stage selector */}
            <div className="relative">
              <button onClick={() => setShowStageMenu(!showStageMenu)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition"
                style={{ borderColor: `${currentStage?.color}40`, background: `${currentStage?.color}15`, color: currentStage?.color }}>
                <div className="w-2 h-2 rounded-full" style={{ background: currentStage?.color }} />
                {currentStage?.label}
                <ChevronDown size={12} />
              </button>

              {showStageMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-[#111] border border-white/10 rounded-xl overflow-hidden z-10 shadow-2xl">
                  {STAGES.map((stage, i) => (
                    <button key={stage.key} onClick={() => openStageUpdate(stage.key)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/[0.04] transition text-left ${stage.key === product.current_stage ? "bg-white/[0.04]" : ""}`}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                      <span className="text-white/70">{stage.label}</span>
                      {stage.key === product.current_stage && <Check size={10} className="text-white/30 ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 grid grid-cols-3 gap-8">
        {/* Left — details */}
        <div className="col-span-2 space-y-6">

          {/* Product details */}
          <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Product Details</p>
            <div className="grid grid-cols-2 gap-4">
              {product.description && (
                <div className="col-span-2">
                  <p className="text-[10px] text-white/30 mb-1">Description</p>
                  <p className="text-sm text-white/70">{product.description}</p>
                </div>
              )}
              {product.specs && (
                <div className="col-span-2">
                  <p className="text-[10px] text-white/30 mb-1">Specs</p>
                  <p className="text-sm text-white/60 whitespace-pre-wrap">{product.specs}</p>
                </div>
              )}
              {product.target_elc && (
                <div>
                  <p className="text-[10px] text-white/30 mb-1">Target ELC</p>
                  <p className="text-sm text-white/70 font-semibold">${product.target_elc}</p>
                </div>
              )}
              {product.actual_elc && (
                <div>
                  <p className="text-[10px] text-white/30 mb-1">Actual ELC</p>
                  <p className="text-sm text-white/70 font-semibold">${product.actual_elc}</p>
                </div>
              )}
              {product.target_sell_price && (
                <div>
                  <p className="text-[10px] text-white/30 mb-1">Target Sell Price</p>
                  <p className="text-sm text-white/70 font-semibold">${product.target_sell_price}</p>
                </div>
              )}
              {product.target_elc && product.target_sell_price && (
                <div>
                  <p className="text-[10px] text-white/30 mb-1">Target Margin</p>
                  <p className="text-sm text-emerald-400 font-semibold">
                    {Math.round(((product.target_sell_price - product.target_elc) / product.target_sell_price) * 100)}%
                  </p>
                </div>
              )}
              {product.order_quantity && (
                <div>
                  <p className="text-[10px] text-white/30 mb-1">Order Quantity</p>
                  <p className="text-sm text-white/70">{product.order_quantity.toLocaleString()} units</p>
                </div>
              )}
              {product.moq && (
                <div>
                  <p className="text-[10px] text-white/30 mb-1">MOQ</p>
                  <p className="text-sm text-white/70">{product.moq.toLocaleString()} units</p>
                </div>
              )}
              {product.linked_po_number && (
                <div>
                  <p className="text-[10px] text-white/30 mb-1">PO Number</p>
                  <p className="text-sm text-white/70 font-mono">{product.linked_po_number}</p>
                </div>
              )}
              {product.notes && (
                <div className="col-span-2">
                  <p className="text-[10px] text-white/30 mb-1">Notes</p>
                  <p className="text-sm text-white/60">{product.notes}</p>
                </div>
              )}
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

          {/* Stage Timeline */}
          <div className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-6">Stage History</p>
            <div className="space-y-4">
              {(product.plm_stages || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((stage: any, i: number) => {
                const stageInfo = STAGES.find(s => s.key === stage.stage);
                return (
                  <div key={stage.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{ borderColor: stageInfo?.color, background: `${stageInfo?.color}20` }}>
                        {i === 0 && <div className="w-2 h-2 rounded-full" style={{ background: stageInfo?.color }} />}
                      </div>
                      {i < (product.plm_stages?.length || 0) - 1 && (
                        <div className="w-px h-full mt-1 bg-white/[0.06]" />
                      )}
                    </div>
                    <div className="pb-4 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-semibold text-white/80">{stageInfo?.label || stage.stage}</p>
                        <p className="text-[10px] text-white/25">
                          {new Date(stage.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}
                        </p>
                      </div>
                      {stage.updated_by && <p className="text-[10px] text-white/25 mb-1">{stage.updated_by_role === "factory" ? "🏭" : "👤"} {stage.updated_by}</p>}
                      {stage.notes && <p className="text-xs text-white/40 bg-white/[0.02] rounded-lg px-3 py-2 mt-1">{stage.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right — progress + quick info */}
        <div className="space-y-4">
          {/* Overall progress */}
          <div className="border border-white/[0.06] rounded-2xl p-5 bg-white/[0.01]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Overall Progress</p>
            <div className="mb-3">
              <div className="flex justify-between mb-1.5">
                <span className="text-[10px] text-white/30">Stage {currentStageIndex + 1} of {STAGES.length}</span>
                <span className="text-[10px] text-white/40">{Math.round(((currentStageIndex + 1) / STAGES.length) * 100)}%</span>
              </div>
              <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${((currentStageIndex + 1) / STAGES.length) * 100}%`, background: currentStage?.color }} />
              </div>
            </div>
            <p className="text-xs text-white/50 font-medium" style={{ color: currentStage?.color }}>{currentStage?.label}</p>
          </div>

          {/* All stages mini list */}
          <div className="border border-white/[0.06] rounded-2xl p-5 bg-white/[0.01]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">All Stages</p>
            <div className="space-y-1.5">
              {STAGES.map((stage, i) => {
                const isPast = i < currentStageIndex;
                const isCurrent = i === currentStageIndex;
                const isFuture = i > currentStageIndex;
                return (
                  <div key={stage.key} className={`flex items-center gap-2 py-1 px-2 rounded-lg ${isCurrent ? "bg-white/[0.04]" : ""}`}>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0`}
                      style={{ background: isPast || isCurrent ? stage.color : "#374151" }} />
                    <span className={`text-[11px] ${isCurrent ? "text-white font-semibold" : isPast ? "text-white/40 line-through" : "text-white/20"}`}>
                      {stage.label}
                    </span>
                    {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse ml-auto" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Created info */}
          <div className="border border-white/[0.06] rounded-2xl p-5 bg-white/[0.01]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">Info</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[11px] text-white/30">Created</span>
                <span className="text-[11px] text-white/50">
                  {new Date(product.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[11px] text-white/30">Last updated</span>
                <span className="text-[11px] text-white/50">
                  {new Date(product.stage_updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[11px] text-white/30">Stage changes</span>
                <span className="text-[11px] text-white/50">{product.plm_stages?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
