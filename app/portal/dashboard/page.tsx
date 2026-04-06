"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package, Loader2, LogOut, Factory, Check, X, Plus, Pencil, ChevronDown, ChevronUp, Send, Layers } from "lucide-react";

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
const FACTORY_STAGES = PRODUCTION_STAGES.map(s => s.key);
const MILESTONES = [{ key: "design_brief", label: "Design Brief" },{ key: "sampling", label: "Sampling" }];
const SEASONS = ["Spring","Summer","Fall","Winter","Holiday","Resort","Pre-Fall"];

const ic = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white/80 placeholder-white/20 text-xs focus:outline-none focus:border-white/20 transition";
const lc = "text-[10px] text-white/30 mb-1.5 block uppercase tracking-widest";

// ── FACTORY VIEW ──────────────────────────────────────────────
function FactoryView({ portalUser, router }: { portalUser: any; router: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"samples"|"orders">("samples");

  useEffect(() => { loadProducts(); }, []);

  const token = () => localStorage.getItem("portal_token") || "";

  const loadProducts = async () => {
    const res = await fetch("/api/portal/products", { headers: { Authorization: `Bearer ${token()}` } });
    if (res.status === 401) { router.push("/portal"); return; }
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  };

  const logout = () => { localStorage.removeItem("portal_token"); localStorage.removeItem("portal_user"); router.push("/portal"); };

  const sampleProducts = products.filter(p => p._has_sample);
  const orderProducts = products.filter(p => p._has_production);

  const SAMPLE_STAGE_LABELS: Record<string,string> = {
    sample_production: "Sample Production",
    sample_complete: "Sample Complete",
    sample_shipped: "Sample Shipped",
    sample_arrived: "Sample Arrived",
    revision_requested: "Revision Requested",
    killed: "Ended",
  };
  const SAMPLE_STAGE_COLORS: Record<string,string> = {
    sample_production: "#f59e0b",
    sample_complete: "#10b981",
    sample_shipped: "#3b82f6",
    sample_arrived: "#8b5cf6",
    revision_requested: "#f59e0b",
    killed: "#ef4444",
  };

  const PROD_STAGE_LABELS: Record<string,string> = {
    po_issued: "PO Issued",
    production_started: "Production Started",
    production_complete: "Production Complete",
    qc_inspection: "QC Inspection",
    ready_to_ship: "Ready to Ship",
    shipped: "Shipped",
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Factory size={15} className="text-white/60" />
          </div>
          <div>
            <p className="text-sm font-semibold">Factory Portal</p>
            <p className="text-[10px] text-white/30">{portalUser?.name || portalUser?.email}</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition">
          <LogOut size={12} />Sign out
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.06] px-6">
        <div className="flex gap-0 max-w-2xl mx-auto">
          {[["samples","Samples", sampleProducts.length],["orders","Bulk Orders", orderProducts.length]].map(([key, label, count]) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`px-4 py-3.5 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${activeTab === key ? "border-white text-white" : "border-transparent text-white/30 hover:text-white/60"}`}>
              {label}
              {(count as number) > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === key ? "bg-white/10 text-white/60" : "bg-white/[0.04] text-white/20"}`}>{count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-white/20" /></div>
        ) : activeTab === "samples" ? (
          <div className="space-y-4">
            {sampleProducts.length === 0 ? (
              <div className="text-center py-20">
                <Package size={28} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No sample requests yet</p>
                <p className="text-white/15 text-xs mt-1">Sample requests will appear here when admin sends them</p>
              </div>
            ) : sampleProducts.map(product => {
              const allSampleRequests = (product._all_sample_requests || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              const activeSr = product._sample_request;
              const isProductKilled = product.status === "killed";
              const allKilled = allSampleRequests.every((s: any) => s.status === "killed");
              const anyApproved = allSampleRequests.some((s: any) => s.status === "approved");

              return (
                <div key={product.id} className="border border-white/[0.07] rounded-2xl overflow-hidden bg-white/[0.01]">
                  {/* Product header */}
                  <div className="p-4 flex items-center gap-3 border-b border-white/[0.05]">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-white/[0.06]" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <Package size={16} className="text-white/20" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-semibold">{product.name}</p>
                        {product.sku && <span className="text-[10px] font-mono text-white/25 bg-white/[0.04] px-1.5 py-0.5 rounded">{product.sku}</span>}
                      </div>
                      {product.plm_collections && <p className="text-[10px] text-white/25">{product.plm_collections.name}</p>}
                    </div>
                    {anyApproved && <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 flex-shrink-0">Approved ✓</span>}
                  </div>

                  {/* Kill notifications */}
                  {isProductKilled && (
                    <div className="px-4 py-3 bg-red-500/[0.06] border-b border-red-500/10 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-300">This product is no longer moving forward. No further action needed.</p>
                    </div>
                  )}
                  {!isProductKilled && allKilled && !anyApproved && (
                    <div className="px-4 py-3 bg-red-500/[0.06] border-b border-red-500/10 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-300">We have selected another factory for this product. Please disregard any pending samples — thank you for your time.</p>
                    </div>
                  )}

                  {/* Round history */}
                  <div className="divide-y divide-white/[0.04]">
                    {allSampleRequests.map((sr: any, roundIdx: number) => {
                      const stages = (sr.plm_sample_stages || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                      const isKilledRound = sr.status === "killed";
                      const isApprovedRound = sr.status === "approved";
                      const isRevisionRound = sr.status === "revision";
                      const isActive = sr.status === "requested" && roundIdx === allSampleRequests.length - 1;
                      const roundLabel = roundIdx === 0 ? "Round 1" : `Revision Round ${roundIdx}`;

                      return (
                        <div key={sr.id} className={`p-4 space-y-3 ${isKilledRound ? "opacity-50" : ""}`}>
                          {/* Round header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">{roundLabel}</span>
                              {isApprovedRound && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">Approved</span>}
                              {isKilledRound && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">Ended</span>}
                              {isRevisionRound && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">Revision Requested</span>}
                            </div>
                            <span className="text-[10px] text-white/20">{new Date(sr.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </div>

                          {/* Revision note */}
                          {isRevisionRound && sr.notes && (
                            <div className="flex items-start gap-2 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl px-3 py-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1" />
                              <p className="text-[11px] text-amber-300/70">{sr.notes}</p>
                            </div>
                          )}

                          {/* Stage timeline */}
                          <div className="space-y-1.5">
                            {stages.map((stage: any, si: number) => {
                              const stageColor = SAMPLE_STAGE_COLORS[stage.stage] || "#6b7280";
                              const stageLabel = SAMPLE_STAGE_LABELS[stage.stage] || stage.stage;
                              const isLast = si === stages.length - 1 && isActive;
                              return (
                                <div key={stage.id} className="flex items-start gap-2.5">
                                  <div className="flex flex-col items-center flex-shrink-0 mt-1">
                                    <div className="w-2 h-2 rounded-full" style={{ background: isLast ? stageColor : "#10b981" }} />
                                    {si < stages.length - 1 && <div className="w-px h-4 bg-white/10 mt-1" />}
                                  </div>
                                  <div className="flex-1 min-w-0 pb-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-medium" style={{ color: isLast ? stageColor : "rgba(255,255,255,0.5)" }}>{stageLabel}</span>
                                      <span className="text-[10px] text-white/20 flex-shrink-0">{new Date(stage.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                    </div>
                                    {stage.notes && stage.notes !== "Sample requested" && (
                                      <p className="text-[11px] text-white/30 mt-0.5">{stage.notes}</p>
                                    )}
                                    <span className="text-[10px] text-white/20">{stage.updated_by_role === "factory" ? "You" : "Admin"}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Update button for active round */}
                          {isActive && (
                            <button onClick={() => router.push(`/portal/product?id=${product.id}`)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.08] text-xs text-white/50 hover:text-white hover:border-white/20 transition font-medium">
                              Update Sample Status →
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            {orderProducts.length === 0 ? (
              <div className="text-center py-20">
                <Package size={28} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No bulk orders yet</p>
                <p className="text-white/15 text-xs mt-1">Production orders will appear here</p>
              </div>
            ) : (() => {
              const activeOrders = orderProducts.filter(p => {
                const batches = p.plm_batches || [];
                return batches.some((b: any) => b.current_stage !== "shipped" && b.current_stage !== "delivered");
              });
              const pastOrders = orderProducts.filter(p => {
                const batches = p.plm_batches || [];
                return batches.length > 0 && batches.every((b: any) => b.current_stage === "shipped" || b.current_stage === "delivered");
              });

              const renderOrderProduct = (product: any, isPast: boolean) => {
                const batches = product.plm_batches || [];
                return (
                  <div key={product.id} className={`border rounded-2xl overflow-hidden bg-white/[0.01] ${isPast ? "border-white/[0.04] opacity-70" : "border-white/[0.07]"}`}>
                    <div className="p-4 flex items-center gap-3 border-b border-white/[0.05]">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-white/[0.06]" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                          <Package size={16} className="text-white/20" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{product.name}</p>
                        {product.sku && <p className="text-[10px] font-mono text-white/25">{product.sku}</p>}
                        <p className="text-[10px] text-white/25 mt-0.5">{batches.length} order{batches.length !== 1 ? "s" : ""}</p>
                      </div>
                      {!isPast && (
                        <button onClick={() => router.push(`/portal/product?id=${product.id}`)}
                          className="text-xs text-white/40 hover:text-white border border-white/[0.06] hover:border-white/20 px-3 py-2 rounded-xl transition flex-shrink-0">
                          Update →
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {batches.map((batch: any) => {
                        const isComplete = batch.current_stage === "shipped" || batch.current_stage === "delivered";
                        const stageLabel = PROD_STAGE_LABELS[batch.current_stage] || batch.current_stage;
                        const stageColor = isComplete ? "#10b981" : "#f59e0b";
                        return (
                          <div key={batch.id} className="px-4 py-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs text-white/60 font-medium">Order #{batch.batch_number}</p>
                              {batch.order_quantity && <p className="text-[11px] text-white/30">{batch.order_quantity} units</p>}
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: `${stageColor}20`, color: stageColor, border: `1px solid ${stageColor}30` }}>
                              {isComplete ? "Completed" : stageLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              };

              return (
                <>
                  {activeOrders.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] text-white/25 uppercase tracking-widest">Active Orders</p>
                      {activeOrders.map(p => renderOrderProduct(p, false))}
                    </div>
                  )}
                  {pastOrders.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] text-white/25 uppercase tracking-widest">Past Orders</p>
                      {pastOrders.map(p => renderOrderProduct(p, true))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DESIGNER VIEW ─────────────────────────────────────────────
function DesignerView({ portalUser, router }: { portalUser: any; router: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"products"|"collections">("products");

  // New product
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", sku: "", description: "", specs: "", category: "", collection_id: "", notes: "" });

  // Edit product
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // New collection
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);
  const [newCollection, setNewCollection] = useState({ name: "", season: "", year: "", notes: "" });

  // Other
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [deletingImage, setDeletingImage] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const token = () => localStorage.getItem("portal_token") || "";

  const load = async () => {
    const res = await fetch("/api/portal/designer", { headers: { Authorization: `Bearer ${token()}` } });
    if (res.status === 401) { router.push("/portal"); return; }
    const data = await res.json();
    setProducts(data.products || []);
    setCollections(data.collections || []);
    setLoading(false);
  };

  const uploadImage = async (productId: string, file: File) => {
    setUploadingImage(productId);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("product_id", productId);
    await fetch("/api/portal/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}` },
      body: formData,
    });
    setUploadingImage(null);
    load();
  };

  const deleteImage = async (productId: string, url: string) => {
    setDeletingImage(url);
    await fetch("/api/portal/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ product_id: productId, url }),
    });
    setDeletingImage(null);
    load();
  };

  const createProduct = async () => {
    if (!newProduct.name) return;
    setSavingProduct(true);
    await fetch("/api/portal/designer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "create_product", ...newProduct }),
    });
    setSavingProduct(false);
    setShowNewProduct(false);
    setNewProduct({ name: "", sku: "", description: "", specs: "", category: "", collection_id: "", notes: "" });
    setSuccess("Product added");
    setTimeout(() => setSuccess(""), 3000);
    load();
  };

  const saveEdit = async () => {
    if (!editingProduct) return;
    setSavingEdit(true);
    await fetch("/api/portal/designer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "update_product", ...editingProduct }),
    });
    setSavingEdit(false);
    setEditingProduct(null);
    setSuccess("Product updated");
    setTimeout(() => setSuccess(""), 3000);
    load();
  };

  const createCollection = async () => {
    if (!newCollection.name) return;
    setSavingCollection(true);
    await fetch("/api/portal/designer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "create_collection", ...newCollection }),
    });
    setSavingCollection(false);
    setShowNewCollection(false);
    setNewCollection({ name: "", season: "", year: "", notes: "" });
    setSuccess("Collection created");
    setTimeout(() => setSuccess(""), 3000);
    load();
  };

  const checkMilestone = async (product_id: string, milestone: string) => {
    await fetch("/api/portal/designer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "toggle_milestone", product_id, milestone, value: true }),
    });
    load();
  };

  const submitForApproval = async (product_id: string) => {
    setSubmitting(product_id);
    await fetch("/api/portal/designer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "submit_for_approval", product_id }),
    });
    setSubmitting(null);
    setSuccess("Submitted for approval — Admin has been notified");
    setTimeout(() => setSuccess(""), 4000);
    load();
  };

  const logout = () => { localStorage.removeItem("portal_token"); localStorage.removeItem("portal_user"); router.push("/portal"); };

  const ProductForm = ({ form, setForm }: { form: any; setForm: any }) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Product Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Summer Tote" className={ic} /></div>
        <div><label className={lc}>SKU</label><input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} placeholder="ST-001" className={ic} /></div>
      </div>
      <div><label className={lc}>Description</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Brief description" className={ic} /></div>
      <div><label className={lc}>Specs</label><textarea value={form.specs} onChange={e => setForm({...form, specs: e.target.value})} placeholder="Materials, dimensions, colors..." rows={2} className={`${ic} resize-none`} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Category</label><input value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="Bags" className={ic} /></div>
        <div>
          <label className={lc}>Collection</label>
          <select value={form.collection_id} onChange={e => setForm({...form, collection_id: e.target.value})} className={ic}>
            <option value="">No collection</option>
            {collections.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div><label className={lc}>Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any additional notes..." rows={2} className={`${ic} resize-none`} /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Edit product modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4 my-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Edit Product</p>
              <button onClick={() => setEditingProduct(null)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
            <ProductForm form={editingProduct} setForm={setEditingProduct} />
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={savingEdit}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                {savingEdit ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save Changes
              </button>
              <button onClick={() => setEditingProduct(null)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            <Package size={13} className="text-white/60" />
          </div>
          <div>
            <p className="text-sm font-semibold">Designer Portal</p>
            {portalUser && <p className="text-[10px] text-white/30">{portalUser.name || portalUser.email}</p>}
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition"><LogOut size={12} />Sign out</button>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {success && <div className="mb-4 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-xs"><Check size={12} />{success}</div>}

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 mb-6 w-fit">
          <button onClick={() => setActiveTab("products")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "products" ? "bg-white text-black" : "text-white/40"}`}>Products</button>
          <button onClick={() => setActiveTab("collections")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "collections" ? "bg-white text-black" : "text-white/40"}`}>Collections</button>
        </div>

        {/* PRODUCTS TAB */}
        {activeTab === "products" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold mb-0.5">Products</h2>
                <p className="text-xs text-white/30">Add products and submit for approval</p>
              </div>
              <button onClick={() => setShowNewProduct(!showNewProduct)}
                className="flex items-center gap-1.5 text-xs bg-white text-black px-3 py-2 rounded-xl font-semibold hover:bg-white/90 transition">
                <Plus size={12} /> Add Product
              </button>
            </div>

            {showNewProduct && (
              <div className="border border-white/10 rounded-2xl p-5 mb-6 bg-white/[0.01] space-y-4">
                <p className="text-xs font-semibold text-white/60">New Product</p>
                <ProductForm form={newProduct} setForm={setNewProduct} />
                <div className="flex gap-2">
                  <button onClick={createProduct} disabled={savingProduct || !newProduct.name}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                    {savingProduct ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Add Product
                  </button>
                  <button onClick={() => setShowNewProduct(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            )}

            {loading ? <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-white/20" /></div>
              : products.length === 0 ? (
                <div className="text-center py-20">
                  <Package size={32} className="text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No products yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {products.map(product => {
                    const stage = STAGES.find(s => s.key === product.current_stage);
                    const isExpanded = expandedProduct === product.id;
                    const milestones = product.milestones || {};
                    const isPendingReview = product.approval_status === "pending_review";
                    return (
                      <div key={product.id} className="border border-white/[0.06] rounded-xl bg-white/[0.01] overflow-hidden">
                        <div className="p-4 flex items-center gap-4">
                          {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="w-12 h-12 rounded-lg object-cover border border-white/[0.06] flex-shrink-0" />
                            : <div className="w-12 h-12 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0"><Package size={16} className="text-white/20" /></div>}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="text-sm font-semibold">{product.name}</p>
                              {product.sku && <span className="text-[10px] font-mono text-white/30">{product.sku}</span>}
                              {isPendingReview && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Pending Approval</span>}
                              {product.approval_status === "approved" && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">✓ Design Complete</span>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: stage?.color }} />
                              <span className="text-[11px]" style={{ color: stage?.color }}>{stage?.label}</span>
                            </div>
                            {product.plm_collections && <p className="text-[10px] text-white/20 mt-0.5">{product.plm_collections.name}</p>}
                          </div>
                          <button onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                            className="text-white/30 hover:text-white/60 transition p-1">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-white/[0.04] px-4 pb-4 pt-3 space-y-4">
                            {/* Images */}
                            <div>
                              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Images</p>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {(product.images || []).map((url: string) => (
                                  <div key={url} className="relative group">
                                    <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-white/[0.06]" />
                                    <button onClick={() => deleteImage(product.id, url)} disabled={deletingImage === url}
                                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 text-white/60 hover:text-red-400 items-center justify-center hidden group-hover:flex transition">
                                      <X size={8} />
                                    </button>
                                  </div>
                                ))}
                                <label className="w-16 h-16 rounded-lg border border-dashed border-white/[0.12] flex items-center justify-center cursor-pointer hover:border-white/20 transition">
                                  {uploadingImage === product.id ? <Loader2 size={14} className="animate-spin text-white/30" /> : <Plus size={14} className="text-white/20" />}
                                  <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadImage(product.id, e.target.files[0]); }} />
                                </label>
                              </div>
                            </div>

                            {/* Milestones */}
                            <div>
                              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Milestones</p>
                              <div className="space-y-1.5">
                                {MILESTONES.map(m => (
                                  <button key={m.key}
                                    onClick={() => { if (!milestones[m.key] && window.confirm(`Mark "${m.label}" as complete? This cannot be undone.`)) checkMilestone(product.id, m.key); }}
                                    disabled={!!milestones[m.key]}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition text-left ${milestones[m.key] ? "border-emerald-500/20 bg-emerald-500/5 cursor-default" : "border-white/[0.06] hover:bg-white/[0.03]"}`}>
                                    <div className={`w-4 h-4 rounded flex items-center justify-center border transition ${milestones[m.key] ? "bg-emerald-500 border-emerald-500" : "border-white/20"}`}>
                                      {milestones[m.key] && <Check size={10} className="text-white" />}
                                    </div>
                                    <span className={`text-xs ${milestones[m.key] ? "text-emerald-400" : "text-white/60"}`}>{m.label}</span>
                                    {milestones[m.key] && <span className="text-[10px] text-emerald-400/50 ml-auto">Complete</span>}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 flex-wrap">
                              <button onClick={() => setEditingProduct({ id: product.id, name: product.name, sku: product.sku || "", description: product.description || "", specs: product.specs || "", category: product.category || "", collection_id: product.collection_id || "", notes: product.notes || "" })}
                                className="flex items-center gap-1.5 text-xs border border-white/[0.08] text-white/40 hover:text-white/70 px-3 py-2 rounded-xl transition">
                                <Pencil size={11} /> Edit
                              </button>
                              {!isPendingReview && (
                                <button onClick={() => submitForApproval(product.id)} disabled={submitting === product.id}
                                  className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 px-3 py-2 rounded-xl transition disabled:opacity-40">
                                  {submitting === product.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                                  Submit for Approval
                                </button>
                              )}
                              {isPendingReview && <p className="text-xs text-amber-400/60 italic py-2">Waiting for approval...</p>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
          </>
        )}

        {/* COLLECTIONS TAB */}
        {activeTab === "collections" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold mb-0.5">Collections</h2>
                <p className="text-xs text-white/30">Organize products into collections</p>
              </div>
              <button onClick={() => setShowNewCollection(!showNewCollection)}
                className="flex items-center gap-1.5 text-xs bg-white text-black px-3 py-2 rounded-xl font-semibold hover:bg-white/90 transition">
                <Plus size={12} /> New Collection
              </button>
            </div>

            {showNewCollection && (
              <div className="border border-white/10 rounded-2xl p-5 mb-6 bg-white/[0.01] space-y-3">
                <p className="text-xs font-semibold text-white/60">New Collection</p>
                <div><label className={lc}>Collection Name *</label><input value={newCollection.name} onChange={e => setNewCollection({...newCollection, name: e.target.value})} placeholder="Summer 2026" className={ic} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lc}>Season</label>
                    <select value={newCollection.season} onChange={e => setNewCollection({...newCollection, season: e.target.value})} className={ic}>
                      <option value="">No season</option>
                      {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label className={lc}>Year</label><input value={newCollection.year} onChange={e => setNewCollection({...newCollection, year: e.target.value})} placeholder="2026" className={ic} /></div>
                </div>
                <div><label className={lc}>Notes</label><textarea value={newCollection.notes} onChange={e => setNewCollection({...newCollection, notes: e.target.value})} rows={2} className={`${ic} resize-none`} /></div>
                <div className="flex gap-2">
                  <button onClick={createCollection} disabled={savingCollection || !newCollection.name}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                    {savingCollection ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Create Collection
                  </button>
                  <button onClick={() => setShowNewCollection(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            )}

            {loading ? <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-white/20" /></div>
              : collections.length === 0 ? (
                <div className="text-center py-20">
                  <Layers size={32} className="text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No collections yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {collections.map((c: any) => (
                    <div key={c.id} className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.01]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{c.name}</p>
                          {(c.season || c.year) && <p className="text-xs text-white/30 mt-0.5">{c.season} {c.year}</p>}
                        </div>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Active</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function PortalDashboard() {
  const router = useRouter();
  const [portalUser, setPortalUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("portal_token");
    const user = localStorage.getItem("portal_user");
    if (!token || !user) { router.push("/portal"); return; }
    setPortalUser(JSON.parse(user));
    setLoading(false);
  }, []);

  if (loading || !portalUser) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 size={20} className="animate-spin text-white/20" />
    </div>
  );

  if (portalUser.role === "designer") return <DesignerView portalUser={portalUser} router={router} />;
  return <FactoryView portalUser={portalUser} router={router} />;
}
