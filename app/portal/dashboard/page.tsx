"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package, Loader2, ChevronRight, LogOut, Factory, Check, X } from "lucide-react";

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

// Stages factories are allowed to update
const FACTORY_STAGES = [
  "production_started", "production_complete", "qc_inspection",
  "shipped", "in_transit", "customs", "delivered"
];

export default function PortalDashboard() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [portalUser, setPortalUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [selectedStage, setSelectedStage] = useState("");
  const [stageNote, setStageNote] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("portal_token");
    const user = localStorage.getItem("portal_user");
    if (!token || !user) { router.push("/portal"); return; }
    setPortalUser(JSON.parse(user));
    loadProducts(token);
  }, []);

  const loadProducts = async (token: string) => {
    const res = await fetch("/api/portal/products", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { router.push("/portal"); return; }
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  };

  const openUpdate = (product: any) => {
    setSelectedProduct(product);
    setSelectedStage(product.current_stage);
    setStageNote("");
    setShowModal(true);
  };

  const updateStage = async () => {
    if (!selectedStage || !selectedProduct) return;
    setUpdatingStage(true);
    const token = localStorage.getItem("portal_token");
    await fetch("/api/portal/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ product_id: selectedProduct.id, stage: selectedStage, notes: stageNote }),
    });
    setUpdatingStage(false);
    setShowModal(false);
    setSuccess(`Updated ${selectedProduct.name} to ${STAGES.find(s => s.key === selectedStage)?.label}`);
    setTimeout(() => setSuccess(""), 3000);
    loadProducts(token!);
  };

  const logout = () => {
    localStorage.removeItem("portal_token");
    localStorage.removeItem("portal_user");
    router.push("/portal");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Stage update modal */}
      {showModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Update: {selectedProduct.name}</p>
              <button onClick={() => setShowModal(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
            <div>
              <label className="text-[11px] text-white/30 mb-2 block">Select new stage</label>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {STAGES.filter(s => FACTORY_STAGES.includes(s.key)).map(stage => (
                  <button key={stage.key} onClick={() => setSelectedStage(stage.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-left transition border ${selectedStage === stage.key ? "border-white/20 bg-white/[0.06]" : "border-white/[0.06] hover:bg-white/[0.03]"}`}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                    <span className="text-white/70">{stage.label}</span>
                    {selectedStage === stage.key && <Check size={10} className="text-white/50 ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-white/30 mb-1.5 block">Notes (optional)</label>
              <textarea value={stageNote} onChange={e => setStageNote(e.target.value)}
                placeholder="e.g. Shipped via DHL, tracking #1234567"
                rows={3} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={updateStage} disabled={updatingStage || !selectedStage}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                {updatingStage ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                Update Stage
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            <Factory size={13} className="text-white/60" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Factory Portal</p>
            {portalUser && <p className="text-[10px] text-white/30">{portalUser.name || portalUser.email}</p>}
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition">
          <LogOut size={12} />Sign out
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {success && (
          <div className="mb-4 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-xs">
            <Check size={12} />{success}
          </div>
        )}

        <h2 className="text-lg font-bold mb-1">Your Products</h2>
        <p className="text-xs text-white/30 mb-6">Update production status for your assigned products</p>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-white/20" /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Package size={32} className="text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No products assigned yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map(product => {
              const stage = STAGES.find(s => s.key === product.current_stage);
              return (
                <div key={product.id} className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.01] flex items-center gap-4">
                  {/* Image */}
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt={product.name} className="w-12 h-12 rounded-lg object-cover border border-white/[0.06] flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <Package size={16} className="text-white/20" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white">{product.name}</p>
                      {product.sku && <span className="text-[10px] font-mono text-white/30">{product.sku}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: stage?.color }} />
                      <span className="text-[11px] font-medium" style={{ color: stage?.color }}>{stage?.label}</span>
                    </div>
                    {product.plm_collections && (
                      <p className="text-[10px] text-white/20 mt-0.5">{product.plm_collections.name}</p>
                    )}
                  </div>
                  <button onClick={() => openUpdate(product)}
                    className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 border border-white/[0.06] hover:border-white/20 px-3 py-2 rounded-lg transition flex-shrink-0">
                    Update <ChevronRight size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
