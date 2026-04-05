"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package, Loader2, LogOut, Factory, Check, X, Plus, Pencil, ChevronDown, ChevronUp, Send, ImagePlus } from "lucide-react";

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

const FACTORY_STAGES = ["production_started","production_complete","qc_inspection","shipped","in_transit","customs","delivered"];
const MILESTONES = [{ key: "design_brief", label: "Design Brief" },{ key: "sampling", label: "Sampling" }];

const ic = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white/80 placeholder-white/20 text-xs focus:outline-none focus:border-white/20 transition";
const lc = "text-[10px] text-white/30 mb-1.5 block uppercase tracking-widest";

// ── FACTORY VIEW ──────────────────────────────────────────────
function FactoryView({ portalUser, router }: { portalUser: any; router: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [selectedStage, setSelectedStage] = useState("");
  const [stageNote, setStageNote] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    const token = localStorage.getItem("portal_token");
    const res = await fetch("/api/portal/products", { headers: { Authorization: `Bearer ${token}` } });
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
    loadProducts();
  };

  const logout = () => { localStorage.removeItem("portal_token"); localStorage.removeItem("portal_user"); router.push("/portal"); };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {showModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Update: {selectedProduct.name}</p>
              <button onClick={() => setShowModal(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
            <div>
              <label className={lc}>Select new stage</label>
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
              <label className={lc}>Notes (optional)</label>
              <textarea value={stageNote} onChange={e => setStageNote(e.target.value)} placeholder="e.g. Shipped via DHL" rows={3} className={`${ic} resize-none`} />
            </div>
            <div className="flex gap-2">
              <button onClick={updateStage} disabled={updatingStage || !selectedStage}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                {updatingStage ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Update Stage
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            <Factory size={13} className="text-white/60" />
          </div>
          <div>
            <p className="text-sm font-semibold">Factory Portal</p>
            {portalUser && <p className="text-[10px] text-white/30">{portalUser.name || portalUser.email}</p>}
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition"><LogOut size={12} />Sign out</button>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-8">
        {success && <div className="mb-4 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-xs"><Check size={12} />{success}</div>}
        <h2 className="text-lg font-bold mb-1">Your Products</h2>
        <p className="text-xs text-white/30 mb-6">Update production status for your assigned products</p>
        {loading ? <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-white/20" /></div>
          : products.length === 0 ? <div className="text-center py-20"><Package size={32} className="text-white/10 mx-auto mb-3" /><p className="text-white/30 text-sm">No products assigned yet</p></div>
          : <div className="space-y-3">{products.map(product => {
              const stage = STAGES.find(s => s.key === product.current_stage);
              return (
                <div key={product.id} className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.01] flex items-center gap-4">
                  {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="w-12 h-12 rounded-lg object-cover border border-white/[0.06] flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0"><Package size={16} className="text-white/20" /></div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold">{product.name}</p>
                      {product.sku && <span className="text-[10px] font-mono text-white/30">{product.sku}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: stage?.color }} />
                      <span className="text-[11px] font-medium" style={{ color: stage?.color }}>{stage?.label}</span>
                    </div>
                    {product.plm_collections && <p className="text-[10px] text-white/20 mt-0.5">{product.plm_collections.name}</p>}
                  </div>
                  <button onClick={() => openUpdate(product)} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 border border-white/[0.06] hover:border-white/20 px-3 py-2 rounded-lg transition flex-shrink-0">Update</button>
                </div>
              );
            })}</div>}
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
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState({ name: "", sku: "", description: "", specs: "", category: "", collection_id: "", notes: "" });

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
    setSavingProduct(true);
    await fetch("/api/portal/designer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "update_product", ...editingProduct }),
    });
    setSavingProduct(false);
    setEditingProduct(null);
    setSuccess("Product updated");
    setTimeout(() => setSuccess(""), 3000);
    load();
  };

  const toggleMilestone = async (product_id: string, milestone: string, value: boolean) => {
    await fetch("/api/portal/designer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "toggle_milestone", product_id, milestone, value }),
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
    setSuccess("Submitted for approval — Uncle David has been notified");
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
      {/* Edit modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4 my-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Edit Product</p>
              <button onClick={() => setEditingProduct(null)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
            <ProductForm form={editingProduct} setForm={setEditingProduct} />
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={savingProduct}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                {savingProduct ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save Changes
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

        {/* Add product */}
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

        {/* New product form */}
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

        {/* Product list */}
        {loading ? <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-white/20" /></div>
          : products.length === 0 ? (
            <div className="text-center py-20">
              <Package size={32} className="text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">No products yet</p>
              <p className="text-white/20 text-xs mt-1">Click Add Product to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map(product => {
                const stage = STAGES.find(s => s.key === product.current_stage);
                const isExpanded = expandedProduct === product.id;
                const milestones = product.milestones || {};
                const isPendingReview = product.approval_status === "pending_review";
                const isDesignerProduct = product.submitted_by_designer;
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
                        {/* Milestones */}
                        <div>
                          <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Milestones</p>
                          <div className="space-y-1.5">
                            {MILESTONES.map(m => (
                              <button key={m.key} onClick={() => toggleMilestone(product.id, m.key, !milestones[m.key])}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/[0.06] hover:bg-white/[0.03] transition text-left">
                                <div className={`w-4 h-4 rounded flex items-center justify-center border transition ${milestones[m.key] ? "bg-emerald-500 border-emerald-500" : "border-white/20"}`}>
                                  {milestones[m.key] && <Check size={10} className="text-white" />}
                                </div>
                                <span className="text-xs text-white/60">{m.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {isDesignerProduct && (
                            <button onClick={() => setEditingProduct({ id: product.id, name: product.name, sku: product.sku || "", description: product.description || "", specs: product.specs || "", category: product.category || "", collection_id: product.collection_id || "", notes: product.notes || "" })}
                              className="flex items-center gap-1.5 text-xs border border-white/[0.08] text-white/40 hover:text-white/70 px-3 py-2 rounded-xl transition">
                              <Pencil size={11} /> Edit
                            </button>
                          )}
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
