"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Package, Plus, ChevronRight, Loader2, Layers, Factory,
  CheckCircle, Clock, AlertCircle, X, Check, Trash2, Filter
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

const SEASONS = ["Spring", "Summer", "Fall", "Winter", "Holiday", "Resort", "Pre-Fall"];

function StageChip({ stage }: { stage: string }) {
  const s = STAGES.find(s => s.key === stage);
  if (!s) return null;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}30` }}>
      {s.label}
    </span>
  );
}

function getCollectionProgress(products: any[]) {
  if (!products?.length) return { total: 0, complete: 0, pct: 0 };
  const complete = products.filter(p => ["delivered", "active"].includes(p.current_stage)).length;
  return { total: products.length, complete, pct: Math.round((complete / products.length) * 100) };
}

function getCollectionHealth(products: any[]) {
  if (!products?.length) return "empty";
  const delayed = products.filter(p => {
    if (!p.stage_updated_at) return false;
    const daysSince = (Date.now() - new Date(p.stage_updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 14 && !["delivered", "active"].includes(p.current_stage);
  }).length;
  if (delayed > products.length * 0.3) return "at_risk";
  if (delayed > 0) return "warning";
  return "on_track";
}

export default function PLMPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"collections" | "all_products">("collections");
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStage, setFilterStage] = useState("");
  const [filterCollection, setFilterCollection] = useState("");

  const [newCollection, setNewCollection] = useState({ name: "", season: "", year: new Date().getFullYear().toString(), notes: "" });
  const [newProduct, setNewProduct] = useState({
    name: "", sku: "", description: "", specs: "", category: "",
    collection_id: "", factory_id: "", target_elc: "", target_sell_price: "",
    moq: "", order_quantity: "", notes: "",
  });

  const load = async () => {
    const [plmRes, catRes] = await Promise.all([
      fetch("/api/plm"),
      fetch("/api/catalog?type=factories"),
    ]);
    const plmData = await plmRes.json();
    const catData = await catRes.json();
    setCollections(plmData.collections || []);
    setProducts(plmData.products || []);
    setFactories(catData.factories || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createCollection = async () => {
    if (!newCollection.name) return;
    setSaving(true);
    await fetch("/api/plm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_collection", ...newCollection, year: parseInt(newCollection.year) }),
    });
    setSaving(false);
    setShowNewCollection(false);
    setNewCollection({ name: "", season: "", year: new Date().getFullYear().toString(), notes: "" });
    load();
  };

  const createProduct = async () => {
    if (!newProduct.name) return;
    setSaving(true);
    await fetch("/api/plm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_product",
        ...newProduct,
        target_elc: newProduct.target_elc ? parseFloat(newProduct.target_elc) : null,
        target_sell_price: newProduct.target_sell_price ? parseFloat(newProduct.target_sell_price) : null,
        moq: newProduct.moq ? parseInt(newProduct.moq) : null,
        order_quantity: newProduct.order_quantity ? parseInt(newProduct.order_quantity) : null,
      }),
    });
    setSaving(false);
    setShowNewProduct(false);
    setNewProduct({ name: "", sku: "", description: "", specs: "", category: "", collection_id: "", factory_id: "", target_elc: "", target_sell_price: "", moq: "", order_quantity: "", notes: "" });
    load();
  };

  const filteredProducts = products.filter(p => {
    if (filterStage && p.current_stage !== filterStage) return false;
    if (filterCollection && p.collection_id !== filterCollection) return false;
    return true;
  });

  const inputClass = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20 transition";
  const labelClass = "text-[11px] text-white/30 mb-1 block";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Package size={14} className="text-white/60" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Product Lifecycle</h1>
              <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">
                {products.length} SKUs
              </span>
            </div>
            <p className="text-white/30 text-sm">Track every product from concept to shelf</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewProduct(true)}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition bg-white/[0.02]">
              <Plus size={11} />New Product
            </button>
            <button onClick={() => setShowNewCollection(true)}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition">
              <Layers size={11} />New Collection
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* New Collection Modal */}
        {showNewCollection && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">New Collection</p>
                <button onClick={() => setShowNewCollection(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
              </div>
              <div>
                <label className={labelClass}>Collection Name *</label>
                <input value={newCollection.name} onChange={e => setNewCollection({...newCollection, name: e.target.value})}
                  placeholder="Spring 2026 Glass Collection" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Season</label>
                  <select value={newCollection.season} onChange={e => setNewCollection({...newCollection, season: e.target.value})} className={inputClass}>
                    <option value="">Select season</option>
                    {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Year</label>
                  <input value={newCollection.year} onChange={e => setNewCollection({...newCollection, year: e.target.value})}
                    placeholder="2026" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea value={newCollection.notes} onChange={e => setNewCollection({...newCollection, notes: e.target.value})}
                  placeholder="Any notes about this collection..." rows={2} className={`${inputClass} resize-none`} />
              </div>
              <div className="flex gap-2">
                <button onClick={createCollection} disabled={saving || !newCollection.name}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 transition disabled:opacity-40">
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Create Collection
                </button>
                <button onClick={() => setShowNewCollection(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* New Product Modal */}
        {showNewProduct && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4 my-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">New Product / SKU</p>
                <button onClick={() => setShowNewProduct(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Product Name *</label>
                  <input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    placeholder="16oz Glass Dog Cup" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>SKU</label>
                  <input value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                    placeholder="GL-001" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <input value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                  placeholder="Brief product description" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Specs</label>
                <textarea value={newProduct.specs} onChange={e => setNewProduct({...newProduct, specs: e.target.value})}
                  placeholder="Material, size, color, technique..." rows={2} className={`${inputClass} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Collection</label>
                  <select value={newProduct.collection_id} onChange={e => setNewProduct({...newProduct, collection_id: e.target.value})} className={inputClass}>
                    <option value="">No collection</option>
                    {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Factory</label>
                  <select value={newProduct.factory_id} onChange={e => setNewProduct({...newProduct, factory_id: e.target.value})} className={inputClass}>
                    <option value="">Not assigned</option>
                    {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Target ELC ($)</label>
                  <input value={newProduct.target_elc} onChange={e => setNewProduct({...newProduct, target_elc: e.target.value})}
                    placeholder="2.50" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Target Sell Price ($)</label>
                  <input value={newProduct.target_sell_price} onChange={e => setNewProduct({...newProduct, target_sell_price: e.target.value})}
                    placeholder="12.99" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Order Quantity</label>
                  <input value={newProduct.order_quantity} onChange={e => setNewProduct({...newProduct, order_quantity: e.target.value})}
                    placeholder="500" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Category</label>
                  <input value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                    placeholder="Glassware" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea value={newProduct.notes} onChange={e => setNewProduct({...newProduct, notes: e.target.value})}
                  placeholder="Any notes..." rows={2} className={`${inputClass} resize-none`} />
              </div>
              <div className="flex gap-2">
                <button onClick={createProduct} disabled={saving || !newProduct.name}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 transition disabled:opacity-40">
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Create Product
                </button>
                <button onClick={() => setShowNewProduct(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5 w-fit mb-8">
          <button onClick={() => setActiveTab("collections")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "collections" ? "bg-white text-black" : "text-white/40"}`}>
            Collections
          </button>
          <button onClick={() => setActiveTab("all_products")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "all_products" ? "bg-white text-black" : "text-white/40"}`}>
            All Products
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-white/20" /></div>
        ) : activeTab === "collections" ? (
          <div className="space-y-4">
            {collections.length === 0 ? (
              <div className="text-center py-20">
                <Layers size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No collections yet</p>
                <p className="text-white/15 text-xs mt-1">Create a collection to group your products by season</p>
              </div>
            ) : collections.map(collection => {
              const progress = getCollectionProgress(collection.plm_products || []);
              const health = getCollectionHealth(collection.plm_products || []);
              const healthColors = { on_track: "#10b981", warning: "#f59e0b", at_risk: "#ef4444", empty: "#6b7280" };
              const healthLabels = { on_track: "On Track", warning: "Some Delays", at_risk: "At Risk", empty: "No Products" };

              return (
                <div key={collection.id} className="border border-white/[0.06] rounded-2xl bg-white/[0.01] overflow-hidden hover:border-white/10 transition cursor-pointer"
                  onClick={() => router.push(`/plm?collection=${collection.id}`)}>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-white">{collection.name}</h3>
                          {collection.season && (
                            <span className="text-[10px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">
                              {collection.season} {collection.year}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/30">{progress.total} products · {progress.complete} delivered</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: healthColors[health] }} />
                          <span className="text-[11px] font-medium" style={{ color: healthColors[health] }}>{healthLabels[health]}</span>
                        </div>
                        <ChevronRight size={14} className="text-white/20" />
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${progress.pct}%` }} />
                      </div>
                      <p className="text-[10px] text-white/20 mt-1">{progress.pct}% complete</p>
                    </div>

                    {/* Stage breakdown */}
                    {(collection.plm_products || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(
                          (collection.plm_products || []).reduce((acc: any, p: any) => {
                            acc[p.current_stage] = (acc[p.current_stage] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([stage, count]: any) => (
                          <div key={stage} className="flex items-center gap-1">
                            <StageChip stage={stage} />
                            <span className="text-[10px] text-white/30">×{count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {/* Filters */}
            <div className="flex items-center gap-2 mb-6">
              <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
                className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/50 text-xs focus:outline-none">
                <option value="">All Stages</option>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <select value={filterCollection} onChange={e => setFilterCollection(e.target.value)}
                className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/50 text-xs focus:outline-none">
                <option value="">All Collections</option>
                {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {(filterStage || filterCollection) && (
                <button onClick={() => { setFilterStage(""); setFilterCollection(""); }}
                  className="text-[11px] text-white/30 hover:text-white/60 flex items-center gap-1">
                  <X size={10} />Clear
                </button>
              )}
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-20">
                <Package size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No products yet</p>
                <p className="text-white/15 text-xs mt-1">Add your first product to start tracking</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredProducts.map(product => (
                  <div key={product.id}
                    className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.01] hover:border-white/10 transition cursor-pointer flex items-center gap-4"
                    onClick={() => router.push(`/plm/${product.id}`)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-white">{product.name}</p>
                        {product.sku && <span className="text-[10px] text-white/30 font-mono">{product.sku}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <StageChip stage={product.current_stage} />
                        {product.plm_collections && (
                          <span className="text-[10px] text-white/25">{product.plm_collections.name}</span>
                        )}
                        {product.factory_catalog && (
                          <span className="text-[10px] text-white/25 flex items-center gap-1">
                            <Factory size={9} />{product.factory_catalog.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {product.target_elc && <p className="text-xs text-white/40">ELC ${product.target_elc}</p>}
                      <p className="text-[10px] text-white/20">{new Date(product.stage_updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </div>
                    <ChevronRight size={14} className="text-white/20 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
