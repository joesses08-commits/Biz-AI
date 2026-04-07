
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Package, Plus, Loader2, LogOut, Check, X, ChevronDown, ChevronUp,
  FileText, Factory, Layers, Settings, Clock, AlertTriangle,
  ArrowLeft, ArrowRight, List, Grid
} from "lucide-react";

const DEV_STAGES = [
  { key: "concept", label: "Concept", color: "#6b7280" },
  { key: "ready_for_quote", label: "Ready for Quote", color: "#ec4899" },
  { key: "artwork_sent", label: "Artwork Sent", color: "#8b5cf6" },
  { key: "quotes_received", label: "Quotes Received", color: "#3b82f6" },
  { key: "samples_requested", label: "Samples Requested", color: "#f59e0b" },
  { key: "sample_approved", label: "Sample Approved", color: "#10b981" },
];

const STAGE_COLORS: Record<string,string> = {
  concept:"#6b7280", ready_for_quote:"#ec4899", artwork_sent:"#8b5cf6",
  quotes_received:"#3b82f6", samples_requested:"#f59e0b", sample_approved:"#10b981",
  po_issued:"#f59e0b", production_started:"#f59e0b", production_complete:"#10b981",
  qc_inspection:"#f59e0b", ready_to_ship:"#3b82f6", shipped:"#10b981",
};

const STAGE_LABELS: Record<string,string> = {
  concept:"Concept", ready_for_quote:"Ready for Quote", artwork_sent:"Artwork Sent",
  quotes_received:"Quotes Received", samples_requested:"Samples Requested", sample_approved:"Sample Approved",
  po_issued:"PO Issued", production_started:"Production Started", production_complete:"Production Complete",
  qc_inspection:"QC Inspection", ready_to_ship:"Ready to Ship", shipped:"Shipped",
};

const SAMPLE_STAGE_LABELS: Record<string,string> = {
  sample_production:"Sample Production", sample_complete:"Sample Complete",
  sample_shipped:"Sample Shipped", sample_arrived:"Sample Arrived", revision_requested:"Revision Requested", killed:"Ended",
};
const SAMPLE_STAGE_COLORS: Record<string,string> = {
  sample_production:"#f59e0b", sample_complete:"#10b981", sample_shipped:"#3b82f6",
  sample_arrived:"#8b5cf6", revision_requested:"#f59e0b", killed:"#ef4444",
};

const ic = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white/80 placeholder-white/20 text-xs focus:outline-none focus:border-white/20 transition";
const lc = "text-[10px] text-white/30 mb-1.5 block uppercase tracking-widest";

function PinModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const token = () => localStorage.getItem("portal_token") || "";

  const verify = async () => {
    setLoading(true);
    const res = await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "verify_pin", pin }) });
    setLoading(false);
    if (res.ok) { onSuccess(); }
    else { setError("Invalid PIN"); setPin(""); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-white">Enter PIN</p>
          <p className="text-xs text-white/30 mt-0.5">This action requires your PIN</p>
        </div>
        <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,"").slice(0,8))}
          onKeyDown={e => e.key === "Enter" && verify()}
          placeholder="••••" maxLength={8}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-white/20" />
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <div className="flex gap-2">
          <button onClick={verify} disabled={loading || !pin}
            className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
            {loading ? "Verifying..." : "Confirm"}
          </button>
          <button onClick={onCancel} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function SetPinModal({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const token = () => localStorage.getItem("portal_token") || "";

  const save = async () => {
    if (pin.length < 4) { setError("PIN must be at least 4 digits"); return; }
    if (pin !== confirm) { setError("PINs don\'t match"); return; }
    setSaving(true);
    await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "set_pin", pin }) });
    setSaving(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-white">Set Your PIN</p>
          <p className="text-xs text-white/30 mt-0.5">You\'ll need this PIN to approve samples, kill products, and change status.</p>
        </div>
        <div>
          <label className={lc}>New PIN (4-8 digits)</label>
          <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,"").slice(0,8))}
            placeholder="••••" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none" />
        </div>
        <div>
          <label className={lc}>Confirm PIN</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g,"").slice(0,8))}
            placeholder="••••" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none" />
        </div>
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <button onClick={save} disabled={saving || !pin || !confirm}
          className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
          {saving ? "Saving..." : "Set PIN"}
        </button>
      </div>
    </div>
  );
}

export default function DesignerView({ portalUser, router }: { portalUser: any; router: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"products"|"samples"|"prioritization">("products");
  const [hasPinSet, setHasPinSet] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [pinCallback, setPinCallback] = useState<null | (() => void)>(null);
  const [expandedProduct, setExpandedProduct] = useState<string|null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newProduct, setNewProduct] = useState({ name:"", sku:"", description:"", specs:"", category:"", collection_id:"", notes:"" });
  const [newCollection, setNewCollection] = useState({ name:"", season:"", year: new Date().getFullYear().toString(), notes:"" });
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Prioritization state
  const [prioFactories, setPrioFactories] = useState<any[]>([]);
  const [prioOrder, setPrioOrder] = useState<Record<string,string[]>>({});
  const [prioActiveFactory, setPrioActiveFactory] = useState<string|null>(null);
  const [prioSaving, setPrioSaving] = useState(false);
  const [prioSaved, setPrioSaved] = useState(false);
  const [dragOver, setDragOver] = useState<string|null>(null);

  const token = () => localStorage.getItem("portal_token") || "";

  useEffect(() => { load(); }, []);

  const load = async () => {
    const res = await fetch("/api/portal/designer", { headers: { Authorization: `Bearer ${token()}` } });
    if (res.status === 401) { router.push("/portal"); return; }
    const data = await res.json();
    setProducts(data.products || []);
    setCollections(data.collections || []);
    setFactories(data.factories || []);
    setSamples(data.samples || []);
    setHasPinSet(data.has_pin || false);

    // Build prio data
    const facs = data.factories || [];
    setPrioFactories(facs);
    const orderMap: Record<string,string[]> = {};
    for (const f of facs) {
      const factorySamples = (data.samples || []).filter((s: any) => s.factory_id === f.id);
      const prioritized = factorySamples.filter((s: any) => s.priority_order != null).sort((a: any, b: any) => a.priority_order - b.priority_order);
      const unprioritized = factorySamples.filter((s: any) => s.priority_order == null);
      orderMap[f.id] = [...prioritized, ...unprioritized].map((s: any) => s.id);
    }
    setPrioOrder(orderMap);
    if (!prioActiveFactory && facs.length > 0) setPrioActiveFactory(facs[0].id);
    setLoading(false);
  };

  const requirePin = (cb: () => void) => {
    if (!hasPinSet) { setShowSetPin(true); return; }
    setPinCallback(() => cb);
  };

  const logout = () => { localStorage.removeItem("portal_token"); localStorage.removeItem("portal_user"); router.push("/portal"); };

  const createProduct = async () => {
    if (!newProduct.name) return;
    setSaving(true);
    await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "create_product", ...newProduct }) });
    setSaving(false);
    setShowNewProduct(false);
    setNewProduct({ name:"", sku:"", description:"", specs:"", category:"", collection_id:"", notes:"" });
    load();
  };

  const createCollection = async () => {
    if (!newCollection.name) return;
    setSaving(true);
    await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "create_collection", ...newCollection }) });
    setSaving(false);
    setShowNewCollection(false);
    setNewCollection({ name:"", season:"", year: new Date().getFullYear().toString(), notes:"" });
    load();
  };

  const setProductStatus = (productId: string, status: string) => {
    requirePin(async () => {
      const pin = prompt("Enter your PIN:");
      if (!pin) return;
      const res = await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "set_status", product_id: productId, status, pin }) });
      if (res.ok) load();
      else alert("Invalid PIN");
    });
  };

  const savePriorities = async (factoryId: string) => {
    setPrioSaving(true);
    await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "save_priorities", factory_id: factoryId, ordered_ids: prioOrder[factoryId] || [] }) });
    setPrioSaving(false);
    setPrioSaved(true);
    setTimeout(() => setPrioSaved(false), 2000);
  };

  const moveSample = (factoryId: string, fromIdx: number, toIdx: number) => {
    const order = [...(prioOrder[factoryId] || [])];
    const [moved] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, moved);
    setPrioOrder(prev => ({ ...prev, [factoryId]: order }));
  };

  const filteredProducts = products.filter(p => !searchQuery ||
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {showSetPin && <SetPinModal onDone={() => { setShowSetPin(false); setHasPinSet(true); load(); }} />}
      {pinCallback && <PinModal onSuccess={() => { const cb = pinCallback; setPinCallback(null); cb(); }} onCancel={() => setPinCallback(null)} />}

      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Layers size={15} className="text-white/60" />
          </div>
          <div>
            <p className="text-sm font-semibold">Designer Portal</p>
            <p className="text-[10px] text-white/30">{portalUser?.name || portalUser?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!hasPinSet && (
            <button onClick={() => setShowSetPin(true)} className="text-xs text-amber-400 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 rounded-lg">
              Set PIN
            </button>
          )}
          <button onClick={logout} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition">
            <LogOut size={12} />Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.06] px-6">
        <div className="flex gap-0 max-w-4xl mx-auto">
          {([["products","Products"],["samples","Samples"],["prioritization","Prioritization"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 py-3.5 text-xs font-semibold border-b-2 transition ${activeTab === key ? "border-white text-white" : "border-transparent text-white/30 hover:text-white/60"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-white/20" /></div>
        ) : activeTab === "products" ? (
          <div className="space-y-4">
            {/* Actions bar */}
            <div className="flex items-center justify-between gap-3">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products..." className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none w-64" />
              <div className="flex items-center gap-2">
                <button onClick={() => setShowNewCollection(!showNewCollection)}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/70 transition">
                  <Plus size={11} />Collection
                </button>
                <button onClick={() => setShowNewProduct(!showNewProduct)}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition">
                  <Plus size={11} />New Product
                </button>
              </div>
            </div>

            {/* New Collection form */}
            {showNewCollection && (
              <div className="border border-white/[0.08] rounded-2xl p-4 space-y-3 bg-white/[0.01]">
                <p className="text-xs font-semibold text-white/70">New Collection</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={lc}>Name</label><input value={newCollection.name} onChange={e => setNewCollection({...newCollection, name: e.target.value})} placeholder="Spring 2026" className={ic} /></div>
                  <div><label className={lc}>Season</label><input value={newCollection.season} onChange={e => setNewCollection({...newCollection, season: e.target.value})} placeholder="Spring" className={ic} /></div>
                  <div><label className={lc}>Year</label><input value={newCollection.year} onChange={e => setNewCollection({...newCollection, year: e.target.value})} className={ic} /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={createCollection} disabled={saving || !newCollection.name} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                    {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}Create
                  </button>
                  <button onClick={() => setShowNewCollection(false)} className="px-3 py-2 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            )}

            {/* New Product form */}
            {showNewProduct && (
              <div className="border border-white/[0.08] rounded-2xl p-4 space-y-3 bg-white/[0.01]">
                <p className="text-xs font-semibold text-white/70">New Product</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lc}>Name *</label><input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="Product name" className={ic} /></div>
                  <div><label className={lc}>SKU</label><input value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} placeholder="SKU-001" className={ic} /></div>
                  <div><label className={lc}>Category</label><input value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} placeholder="Category" className={ic} /></div>
                  <div><label className={lc}>Collection</label>
                    <select value={newProduct.collection_id} onChange={e => setNewProduct({...newProduct, collection_id: e.target.value})} className={ic}>
                      <option value="">No collection</option>
                      {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div><label className={lc}>Specs</label><textarea value={newProduct.specs} onChange={e => setNewProduct({...newProduct, specs: e.target.value})} rows={2} className={`${ic} resize-none`} /></div>
                <div><label className={lc}>Notes</label><textarea value={newProduct.notes} onChange={e => setNewProduct({...newProduct, notes: e.target.value})} rows={2} className={`${ic} resize-none`} /></div>
                <div className="flex gap-2">
                  <button onClick={createProduct} disabled={saving || !newProduct.name} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                    {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}Create Product
                  </button>
                  <button onClick={() => setShowNewProduct(false)} className="px-3 py-2 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            )}

            {/* Product list */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20">
                <Package size={28} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No products yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProducts.map(product => {
                  const isExpanded = expandedProduct === product.id;
                  const status = product.status || "progression";
                  const isKilled = status === "killed";
                  const isHold = status === "hold";
                  const stage = product.current_stage || "concept";
                  const stageColor = STAGE_COLORS[stage] || "#6b7280";
                  const stageLabel = STAGE_LABELS[stage] || stage;
                  const activeSamples = (product.plm_sample_requests || []).filter((s: any) => s.status === "requested");
                  const approvedSample = (product.plm_sample_requests || []).find((s: any) => s.status === "approved");
                  const batches = product.plm_batches || [];
                  const history = [
                    ...(product.plm_stages || []),
                    ...batches.flatMap((b: any) => (b.plm_batch_stages || []).map((s: any) => ({ ...s, _type: "order" }))),
                    ...(product.plm_sample_requests || []).flatMap((sr: any) =>
                      (sr.plm_sample_stages || []).map((s: any) => ({ ...s, _factory: sr.factory_catalog?.name, _type: "sample" }))
                    ),
                  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                  return (
                    <div key={product.id} className={`border rounded-2xl overflow-hidden transition ${isKilled ? "border-red-500/20 bg-red-500/[0.01] opacity-70" : isHold ? "border-amber-500/20" : "border-white/[0.07] bg-white/[0.01]"}`}>
                      <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpandedProduct(isExpanded ? null : product.id)}>
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-white/[0.06]" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                            <Package size={14} className="text-white/20" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{product.name}</p>
                            {product.sku && <span className="text-[10px] font-mono text-white/25 bg-white/[0.04] px-1.5 py-0.5 rounded">{product.sku}</span>}
                            {product.plm_collections && <span className="text-[10px] text-white/25">{product.plm_collections.name}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${stageColor}20`, color: stageColor, border: `1px solid ${stageColor}30` }}>{stageLabel}</span>
                            {isKilled && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20">Killed</span>}
                            {isHold && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/20">On Hold</span>}
                            {approvedSample && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">Sample ✓</span>}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={14} className="text-white/30 flex-shrink-0" /> : <ChevronDown size={14} className="text-white/30 flex-shrink-0" />}
                      </div>

                      {isExpanded && (
                        <div className="border-t border-white/[0.05] p-4 space-y-4">
                          {/* Dev stage */}
                          <div>
                            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Development Stage</p>
                            <div className="flex flex-wrap gap-1.5">
                              {DEV_STAGES.map(s => (
                                <button key={s.key} onClick={() => fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
                                  body: JSON.stringify({ action: "update_stage", product_id: product.id, stage: s.key }) }).then(() => load())}
                                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${stage === s.key ? "text-white font-semibold" : "border-white/[0.06] text-white/30 hover:text-white/60"}`}
                                  style={stage === s.key ? { background: `${s.color}20`, borderColor: `${s.color}40`, color: s.color } : {}}>
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Status */}
                          <div>
                            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Product Status</p>
                            <div className="flex gap-2">
                              {(["progression","hold","killed"] as const).map(s => (
                                <button key={s} onClick={() => setProductStatus(product.id, s)}
                                  disabled={status === s}
                                  className={`text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-30 ${
                                    s === "killed" ? "border-red-500/30 text-red-400 hover:bg-red-500/10" :
                                    s === "hold" ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10" :
                                    "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                  } ${status === s ? "opacity-30" : ""}`}>
                                  {s === "killed" ? "Kill" : s === "hold" ? "Hold" : "Progression"}
                                  {status === s && " (current)"}
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-white/20 mt-1">Requires PIN</p>
                          </div>

                          {/* Active samples */}
                          {activeSamples.length > 0 && (
                            <div>
                              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Active Samples</p>
                              <div className="space-y-2">
                                {activeSamples.map((sr: any) => {
                                  const factory = sr.factory_catalog;
                                  const stages = (sr.plm_sample_stages || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                  const currentStage = sr.current_stage;
                                  const sc = SAMPLE_STAGE_COLORS[currentStage] || "#6b7280";
                                  const sl = SAMPLE_STAGE_LABELS[currentStage] || currentStage;
                                  return (
                                    <div key={sr.id} className="border border-white/[0.06] rounded-xl p-3 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <p className="text-xs font-semibold text-white/70">{factory?.name}</p>
                                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${sc}20`, color: sc, border: `1px solid ${sc}30` }}>{sl}</span>
                                        </div>
                                      </div>
                                      {/* Approve / Revision / Kill buttons */}
                                      <div className="flex gap-1.5">
                                        <button onClick={() => requirePin(async () => {
                                          const pin = prompt("Enter PIN:");
                                          if (!pin) return;
                                          await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
                                            body: JSON.stringify({ action: "update_sample_stage", sample_request_id: sr.id, product_id: product.id, factory_id: sr.factory_id, stage: currentStage, outcome: "approved", pin }) });
                                          load();
                                        })}
                                          className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition">
                                          ✓ Approve Sample
                                        </button>
                                        <button onClick={() => requirePin(async () => {
                                          const pin = prompt("Enter PIN:");
                                          if (!pin) return;
                                          const note = prompt("Revision reason:");
                                          await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
                                            body: JSON.stringify({ action: "update_sample_stage", sample_request_id: sr.id, product_id: product.id, factory_id: sr.factory_id, stage: currentStage, outcome: "revision", notes: note || "", pin }) });
                                          load();
                                        })}
                                          className="text-[10px] px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition">
                                          Revision
                                        </button>
                                        <button onClick={() => requirePin(async () => {
                                          const pin = prompt("Enter PIN:");
                                          if (!pin) return;
                                          const note = prompt("Kill reason:");
                                          await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
                                            body: JSON.stringify({ action: "update_sample_stage", sample_request_id: sr.id, product_id: product.id, factory_id: sr.factory_id, stage: currentStage, outcome: "killed", notes: note || "", pin }) });
                                          load();
                                        })}
                                          className="text-[10px] px-2 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition">
                                          Kill
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Product history */}
                          {history.length > 0 && (
                            <div>
                              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">History</p>
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {history.slice(0, 10).map((h: any, i: number) => {
                                  const sc = STAGE_COLORS[h.stage] || SAMPLE_STAGE_COLORS[h.stage] || "#6b7280";
                                  const sl = STAGE_LABELS[h.stage] || SAMPLE_STAGE_LABELS[h.stage] || h.stage?.replace(/_/g," ");
                                  return (
                                    <div key={h.id || i} className="flex items-start gap-2.5">
                                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: sc }} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-[11px] font-medium" style={{ color: sc }}>{sl}</span>
                                          <span className="text-[10px] text-white/20">{new Date(h.created_at).toLocaleDateString("en-US", { month:"short", day:"numeric" })}</span>
                                        </div>
                                        {h.notes && <p className="text-[10px] text-white/30 truncate">{h.notes}</p>}
                                        {h._factory && <p className="text-[10px] text-white/20">{h._factory}</p>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        ) : activeTab === "samples" ? (
          <div className="space-y-4">
            <p className="text-xs text-white/30">Request samples from factories for products that are ready.</p>
            {products.filter(p => !p.killed && ["ready_for_quote","quotes_received","artwork_sent"].includes(p.current_stage || "")).length === 0 ? (
              <div className="text-center py-16 border border-white/[0.06] rounded-2xl">
                <p className="text-white/20 text-sm">No products ready for sampling</p>
                <p className="text-white/10 text-xs mt-1">Products at Quotes Received stage will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {products.filter(p => !p.killed && ["ready_for_quote","quotes_received","artwork_sent"].includes(p.current_stage || "")).map(product => {
                  const [selectedFactories, setSelectedFactories] = useState<string[]>([]);
                  const [note, setNote] = useState("");
                  const [requesting, setRequesting] = useState(false);
                  return (
                    <div key={product.id} className="border border-white/[0.07] rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        {product.images?.[0] && <img src={product.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                        <div>
                          <p className="text-sm font-semibold">{product.name}</p>
                          {product.sku && <p className="text-[10px] font-mono text-white/30">{product.sku}</p>}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Request from:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {factories.map((f: any) => (
                            <button key={f.id} onClick={() => setSelectedFactories(prev =>
                              prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id])}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition ${selectedFactories.includes(f.id) ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-white/[0.06] text-white/30 hover:text-white/60"}`}>
                              {f.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note to factory (optional)"
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none" />
                      <button onClick={async () => {
                        if (!selectedFactories.length) return;
                        setRequesting(true);
                        await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
                          body: JSON.stringify({ action: "create_sample_requests", product_id: product.id, factory_ids: selectedFactories, note }) });
                        setRequesting(false);
                        load();
                      }} disabled={requesting || selectedFactories.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-semibold disabled:opacity-40">
                        {requesting ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                        Request Samples
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        ) : (
          <div className="space-y-4">
            {prioFactories.length === 0 ? (
              <div className="text-center py-20"><p className="text-white/30 text-sm">No factories found</p></div>
            ) : (
              <>
                <div className="flex gap-2 border-b border-white/[0.06] pb-3">
                  {prioFactories.map(f => {
                    const count = (prioOrder[f.id] || []).length;
                    return (
                      <button key={f.id} onClick={() => setPrioActiveFactory(f.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${prioActiveFactory === f.id ? "bg-white text-black" : "text-white/40 hover:text-white/70 border border-white/[0.06]"}`}>
                        {f.name}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${prioActiveFactory === f.id ? "bg-black/10" : "bg-white/[0.06]"}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>

                {prioActiveFactory && (() => {
                  const orderedIds = prioOrder[prioActiveFactory] || [];
                  const orderedSamples = orderedIds.map(id => samples.find((s: any) => s.id === id)).filter(Boolean);
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-white/30">Drag to reorder. Top = highest priority.</p>
                        <div className="flex items-center gap-2">
                          {prioSaved && <span className="text-emerald-400 text-xs">Saved ✓</span>}
                          <button onClick={() => savePriorities(prioActiveFactory)} disabled={prioSaving}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                            {prioSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Save Order
                          </button>
                        </div>
                      </div>
                      {orderedSamples.length === 0 ? (
                        <div className="text-center py-16 border border-white/[0.06] rounded-2xl">
                          <p className="text-white/20 text-sm">No pending samples for this factory</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {orderedSamples.map((sample: any, idx: number) => {
                            const product = sample.plm_products;
                            return (
                              <div key={sample.id} draggable
                                onDragStart={e => e.dataTransfer.setData("text/plain", String(idx))}
                                onDragOver={e => { e.preventDefault(); setDragOver(sample.id); }}
                                onDragLeave={() => setDragOver(null)}
                                onDrop={e => { e.preventDefault(); setDragOver(null); moveSample(prioActiveFactory, parseInt(e.dataTransfer.getData("text/plain")), idx); }}
                                className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition cursor-grab ${dragOver === sample.id ? "border-blue-500/40 bg-blue-500/5" : "border-white/[0.08] bg-white/[0.02]"}`}>
                                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                                  {idx + 1}
                                </div>
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {product?.images?.[0] && <img src={product.images[0]} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />}
                                  <div className="min-w-0">
                                    <p className="text-sm text-white/80 font-medium truncate">{product?.name}</p>
                                    {product?.sku && <p className="text-[10px] text-white/30 font-mono">{product.sku}</p>}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-0.5 flex-shrink-0 opacity-30">
                                  <div className="w-4 h-0.5 bg-white/40 rounded" />
                                  <div className="w-4 h-0.5 bg-white/40 rounded" />
                                  <div className="w-4 h-0.5 bg-white/40 rounded" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
