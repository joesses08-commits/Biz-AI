"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, ArrowLeft, Factory, Check, Loader2, X } from "lucide-react";

const SAMPLE_STAGES = [
  { key: "sample_production", label: "Sample Production", color: "#f59e0b" },
  { key: "sample_complete", label: "Sample Complete", color: "#f59e0b" },
  { key: "sample_shipped", label: "Sample Shipped", color: "#3b82f6" },
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
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");

  const [product, setProduct] = useState<any>(null);
  const [portalUser, setPortalUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [updatingSample, setUpdatingSample] = useState(false);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [sampleNote, setSampleNote] = useState("");
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    const token = localStorage.getItem("portal_token");
    const user = localStorage.getItem("portal_user");
    if (!token || !user) { router.push("/portal"); return; }
    const parsed = JSON.parse(user);
    if (parsed.role !== "factory") { router.push("/portal/dashboard"); return; }
    setPortalUser(parsed);
    if (productId) load(token);
  }, [productId]);

  const token = () => localStorage.getItem("portal_token") || "";

  const load = async (t?: string) => {
    const res = await fetch(`/api/portal/product?id=${productId}`, {
      headers: { Authorization: `Bearer ${t || token()}` },
    });
    if (res.status === 401) { router.push("/portal"); return; }
    const data = await res.json();
    setProduct(data.product);
    setLoading(false);
  };

  const updateSampleStage = async (stage: string) => {
    setUpdatingSample(true);
    await fetch("/api/portal/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ product_id: productId, stage, notes: sampleNote }),
    });
    setUpdatingSample(false);
    setSampleNote("");
    setSuccess(`Updated to ${stageInfo(stage).label}`);
    setTimeout(() => setSuccess(""), 3000);
    load();
  };

  const updateOrderStage = async (batchId: string, stage: string) => {
    setUpdatingOrder(batchId);
    await fetch("/api/portal/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ product_id: productId, batch_id: batchId, stage, notes: orderNotes[batchId] || "" }),
    });
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

  const currentSampleStage = SAMPLE_STAGES.find(s => s.key === product.current_stage);
  const orders = (product.plm_batches || []).sort((a: any, b: any) => a.batch_number - b.batch_number);

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
          {product.notes && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Notes from Admin</p>
              <p className="text-sm text-white/60">{product.notes}</p>
            </div>
          )}
        </div>

        {/* Sample Section */}
        {currentSampleStage && (
          <div className="border border-amber-500/20 rounded-2xl overflow-hidden bg-amber-500/[0.02]">
            <div className="px-6 py-4 border-b border-amber-500/10">
              <p className="text-sm font-semibold text-amber-300">Sample in Progress</p>
              <p className="text-xs text-white/30 mt-0.5">Update the sample stage as you work through it</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="space-y-1.5">
                {SAMPLE_STAGES.map(stage => {
                  const currentIdx = SAMPLE_STAGES.findIndex(s => s.key === product.current_stage);
                  const stageIdx = SAMPLE_STAGES.findIndex(s => s.key === stage.key);
                  const isPast = stageIdx < currentIdx;
                  const isCurrent = stage.key === product.current_stage;
                  return (
                    <button key={stage.key} onClick={() => !isPast && updateSampleStage(stage.key)}
                      disabled={updatingSample || isPast}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-left transition border ${isCurrent ? "border-amber-500/30 bg-amber-500/10" : isPast ? "border-white/[0.04] opacity-40 cursor-default" : "border-white/[0.06] hover:bg-white/[0.03]"}`}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isPast ? "#10b981" : stage.color }} />
                      <span style={{ color: isCurrent ? "#fbbf24" : isPast ? "#10b981" : "rgba(255,255,255,0.5)" }}>{stage.label}</span>
                      {isCurrent && <span className="ml-auto text-[10px] text-amber-400/60">Current</span>}
                      {isPast && <Check size={10} className="text-emerald-400 ml-auto" />}
                    </button>
                  );
                })}
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Add a note (optional)</p>
                <textarea value={sampleNote} onChange={e => setSampleNote(e.target.value)}
                  placeholder="e.g. Sample dispatched via DHL, tracking #1234"
                  rows={2} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none resize-none" />
              </div>
            </div>
          </div>
        )}

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

                    {/* Production stage buttons */}
                    <div className="space-y-1.5">
                      {PRODUCTION_STAGES.map(s => {
                        const currentIdx = PRODUCTION_STAGES.findIndex(ps => ps.key === order.current_stage);
                        const sIdx = PRODUCTION_STAGES.findIndex(ps => ps.key === s.key);
                        const isPast = sIdx < currentIdx;
                        const isCurrent = s.key === order.current_stage;
                        return (
                          <button key={s.key} onClick={() => !isPast && updateOrderStage(order.id, s.key)}
                            disabled={updatingOrder === order.id || isPast}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-left transition border ${isCurrent ? "border-white/20 bg-white/[0.06]" : isPast ? "border-white/[0.04] opacity-40 cursor-default" : "border-white/[0.06] hover:bg-white/[0.03]"}`}>
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isPast ? "#10b981" : s.color }} />
                            <span className="text-white/70">{s.label}</span>
                            {isCurrent && <span className="ml-auto text-[10px] text-white/30">Current</span>}
                            {isPast && <Check size={10} className="text-emerald-400 ml-auto" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Note for this order */}
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Add a note (optional)</p>
                      <textarea value={orderNotes[order.id] || ""} onChange={e => setOrderNotes(prev => ({ ...prev, [order.id]: e.target.value }))}
                        placeholder="e.g. Production delayed by 3 days, back on track"
                        rows={2} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none resize-none" />
                    </div>

                    {updatingOrder === order.id && <div className="flex justify-center"><Loader2 size={12} className="animate-spin text-white/30" /></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Nothing to update */}
        {!currentSampleStage && orders.length === 0 && (
          <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
            <Package size={28} className="text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No active sample or orders for this product</p>
          </div>
        )}
      </div>
    </div>
  );
}
