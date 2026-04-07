"use client";

import { useState, useEffect } from "react";
import { Package, Plus, Loader2, Check, X, ChevronDown, ChevronUp, LogOut, Layers } from "lucide-react";

const DEV_STAGES = [
  { key: "concept", label: "Concept", color: "#6b7280" },
  { key: "ready_for_quote", label: "Ready for Quote", color: "#ec4899" },
  { key: "artwork_sent", label: "Artwork Sent", color: "#8b5cf6" },
  { key: "quotes_received", label: "Quotes Received", color: "#3b82f6" },
  { key: "samples_requested", label: "Samples Requested", color: "#f59e0b" },
  { key: "sample_approved", label: "Sample Approved", color: "#10b981" },
];

const STAGE_COLORS: Record<string, string> = {
  concept: "#6b7280", ready_for_quote: "#ec4899", artwork_sent: "#8b5cf6",
  quotes_received: "#3b82f6", samples_requested: "#f59e0b", sample_approved: "#10b981",
  po_issued: "#f59e0b", production_started: "#f59e0b", production_complete: "#10b981",
  qc_inspection: "#f59e0b", ready_to_ship: "#3b82f6", shipped: "#10b981",
  status_hold: "#f59e0b", status_killed: "#ef4444", status_progression: "#10b981",
  design_brief: "#6b7280",
};

const STAGE_LABELS: Record<string, string> = {
  concept: "Concept", ready_for_quote: "Ready for Quote", artwork_sent: "Artwork Sent",
  quotes_received: "Quotes Received", samples_requested: "Samples Requested",
  sample_approved: "Sample Approved", po_issued: "PO Issued",
  production_started: "Production Started", production_complete: "Production Complete",
  qc_inspection: "QC Inspection", ready_to_ship: "Ready to Ship", shipped: "Shipped",
  status_hold: "Put on Hold", status_killed: "Killed", status_progression: "Set to Progression",
  sample_production: "Sample Production", sample_complete: "Sample Complete",
  sample_shipped: "Sample Shipped", sample_arrived: "Sample Arrived",
  revision_requested: "Revision Requested", killed: "Killed", design_brief: "Design Brief",
};

const SAMPLE_STAGE_COLORS: Record<string, string> = {
  sample_production: "#f59e0b", sample_complete: "#10b981",
  sample_shipped: "#3b82f6", sample_arrived: "#8b5cf6",
  revision_requested: "#f59e0b", killed: "#ef4444",
};

const ic = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white/80 placeholder-white/20 text-xs focus:outline-none focus:border-white/20 transition";
const lc = "text-[10px] text-white/30 mb-1.5 block uppercase tracking-widest";

function PinPrompt({ onConfirm, onCancel, error }: { onConfirm: (pin: string) => void; onCancel: () => void; error?: string }) {
  const [pin, setPin] = useState("");
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
        <p className="text-sm font-semibold text-white">Enter PIN</p>
        <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          onKeyDown={e => e.key === "Enter" && onConfirm(pin)}
          placeholder="••••" autoFocus
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none" />
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => onConfirm(pin)} disabled={!pin}
            className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">Confirm</button>
          <button onClick={onCancel} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function SetPinModal({ token, onDone }: { token: string; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (pin.length < 4) { setError("PIN must be at least 4 digits"); return; }
    if (pin !== confirm) { setError("PINs don't match"); return; }
    setSaving(true);
    await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "set_pin", pin }) });
    setSaving(false);
    onDone();
  };
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
        <p className="text-sm font-semibold text-white">Set Your PIN</p>
        <p className="text-xs text-white/30">Required for approvals, kills, and status changes.</p>
        <div><label className={lc}>PIN (4-8 digits)</label>
          <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="••••" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none" /></div>
        <div><label className={lc}>Confirm PIN</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="••••" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none" /></div>
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <button onClick={save} disabled={saving || !pin || !confirm}
          className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
          {saving ? "Saving..." : "Set PIN"}
        </button>
      </div>
    </div>
  );
}

function SamplesTab({ products, factories, token, onRefresh }: { products: any[]; factories: any[]; token: string; onRefresh: () => void }) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [requesting, setRequesting] = useState<string | null>(null);
  const eligible = products.filter(p => !p.killed && !(p.plm_sample_requests || []).some((r: any) => r.status === "requested"));
  const requestSample = async (productId: string) => {
    const factoryIds = selections[productId] || [];
    if (!factoryIds.length) return;
    setRequesting(productId);
    await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "create_sample_requests", product_id: productId, factory_ids: factoryIds, note: notes[productId] || "" }) });
    setRequesting(null);
    setSelections(prev => { const n = { ...prev }; delete n[productId]; return n; });
    onRefresh();
  };
  if (!eligible.length) return (
    <div className="text-center py-20 border border-white/[0.06] rounded-2xl">
      <Package size={28} className="text-white/10 mx-auto mb-3" />
      <p className="text-white/20 text-sm">No products available for sampling</p>
    </div>
  );
  return (
    <div className="space-y-3">
      {eligible.map(product => {
        const selected = selections[product.id] || [];
        return (
          <div key={product.id} className="border border-white/[0.07] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              {product.images?.[0] && <img src={product.images[0]} alt="" className="w-9 h-9 rounded-xl object-cover" />}
              <div><p className="text-sm font-semibold">{product.name}</p>
                {product.sku && <p className="text-[10px] font-mono text-white/25">{product.sku}</p>}</div>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Request from:</p>
              <div className="flex flex-wrap gap-1.5">
                {factories.map((f: any) => (
                  <button key={f.id} onClick={() => setSelections(prev => ({
                    ...prev, [product.id]: selected.includes(f.id) ? selected.filter((id: string) => id !== f.id) : [...selected, f.id]
                  }))} className={`text-xs px-2.5 py-1 rounded-lg border transition ${selected.includes(f.id) ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-white/[0.06] text-white/30 hover:text-white/60"}`}>
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
            <input value={notes[product.id] || ""} onChange={e => setNotes(prev => ({ ...prev, [product.id]: e.target.value }))}
              placeholder="Note (optional)" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none" />
            <button onClick={() => requestSample(product.id)} disabled={!selected.length || requesting === product.id}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-semibold disabled:opacity-40">
              {requesting === product.id ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              Request from {selected.length} {selected.length === 1 ? "factory" : "factories"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function DesignerView({ portalUser, router }: { portalUser: any; router: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"products" | "samples" | "prioritization">("products");
  const [hasPinSet, setHasPinSet] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [pinPrompt, setPinPrompt] = useState<null | { resolve: (pin: string) => void }>(null);
  const [pinError, setPinError] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", sku: "", description: "", specs: "", category: "", collection_id: "", notes: "" });
  const [newCollection, setNewCollection] = useState({ name: "", season: "", year: new Date().getFullYear().toString() });
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [prioOrder, setPrioOrder] = useState<Record<string, string[]>>({});
  const [prioActiveFactory, setPrioActiveFactory] = useState<string | null>(null);
  const [prioSaving, setPrioSaving] = useState(false);
  const [prioSaved, setPrioSaved] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const tok = () => localStorage.getItem("portal_token") || "";

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/portal/designer", { headers: { Authorization: `Bearer ${tok()}` } });
    if (res.status === 401) { router.push("/portal"); return; }
    const data = await res.json();
    setProducts(data.products || []);
    setCollections(data.collections || []);
    setFactories(data.factories || []);
    setSamples(data.samples || []);
    setHasPinSet(data.has_pin || false);
    const orderMap: Record<string, string[]> = {};
    for (const f of (data.factories || [])) {
      const fs = (data.samples || []).filter((s: any) => s.factory_id === f.id);
      const pri = fs.filter((s: any) => s.priority_order != null).sort((a: any, b: any) => a.priority_order - b.priority_order);
      const unp = fs.filter((s: any) => s.priority_order == null);
      orderMap[f.id] = [...pri, ...unp].map((s: any) => s.id);
    }
    setPrioOrder(orderMap);
    if (!prioActiveFactory && data.factories?.length > 0) setPrioActiveFactory(data.factories[0].id);
    setLoading(false);
  };

  const getPin = (): Promise<string | null> => {
    if (!hasPinSet) { setShowSetPin(true); return Promise.resolve(null); }
    return new Promise(resolve => { setPinError(""); setPinPrompt({ resolve }); });
  };

  const doWithPin = async (action: (pin: string) => Promise<boolean>) => {
    const pin = await getPin();
    if (!pin) return;
    const ok = await action(pin);
    if (!ok) { setPinError("Invalid PIN"); setPinPrompt(null); }
    else setPinPrompt(null);
  };

  const logout = () => { localStorage.removeItem("portal_token"); localStorage.removeItem("portal_user"); router.push("/portal"); };

  const createProduct = async () => {
    if (!newProduct.name) return;
    setSaving(true);
    await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ action: "create_product", ...newProduct }) });
    setSaving(false); setShowNewProduct(false);
    setNewProduct({ name: "", sku: "", description: "", specs: "", category: "", collection_id: "", notes: "" });
    load();
  };

  const createCollection = async () => {
    if (!newCollection.name) return;
    setSaving(true);
    await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ action: "create_collection", ...newCollection }) });
    setSaving(false); setShowNewCollection(false);
    setNewCollection({ name: "", season: "", year: new Date().getFullYear().toString() });
    load();
  };

  const setProductStatus = async (productId: string, status: string) => {
    await doWithPin(async pin => {
      const res = await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ action: "set_status", product_id: productId, status, pin }) });
      if (res.ok) { load(); return true; }
      return false;
    });
  };

  const updateSampleOutcome = async (srId: string, productId: string, factoryId: string, currentStage: string, outcome: string, notes?: string) => {
    await doWithPin(async pin => {
      const res = await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ action: "update_sample_stage", sample_request_id: srId, product_id: productId, factory_id: factoryId, stage: currentStage, outcome, notes: notes || "", pin }) });
      if (res.ok) { load(); return true; }
      return false;
    });
  };

  const savePriorities = async (factoryId: string) => {
    setPrioSaving(true);
    await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ action: "save_priorities", factory_id: factoryId, ordered_ids: prioOrder[factoryId] || [] }) });
    setPrioSaving(false); setPrioSaved(true); setTimeout(() => setPrioSaved(false), 2000);
  };

  const moveSample = (factoryId: string, fromIdx: number, toIdx: number) => {
    const order = [...(prioOrder[factoryId] || [])];
    const [moved] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, moved);
    setPrioOrder(prev => ({ ...prev, [factoryId]: order }));
  };

  const updateStage = async (productId: string, stage: string) => {
    await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ action: "update_stage", product_id: productId, stage }) });
    load();
  };

  const updateField = async (productId: string, field: string, value: string) => {
    await fetch("/api/portal/designer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ action: "update_product", product_id: productId, [field]: value }) });
    load();
  };

  const filtered = products.filter(p => !searchQuery ||
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {showSetPin && <SetPinModal token={tok()} onDone={() => { setShowSetPin(false); setHasPinSet(true); load(); }} />}
      {pinPrompt && <PinPrompt error={pinError} onConfirm={pin => pinPrompt.resolve(pin)} onCancel={() => { setPinPrompt(null); setPinError(""); }} />}

      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0a0a0a] z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Layers size={15} className="text-white/60" />
          </div>
          <div>
            <p className="text-sm font-semibold">Designer Portal</p>
            <p className="text-[10px] text-white/30">{portalUser?.name || portalUser?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!hasPinSet && (
            <button onClick={() => setShowSetPin(true)} className="text-xs text-amber-400 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 rounded-lg">Set PIN</button>
          )}
          <button onClick={logout} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition">
            <LogOut size={12} />Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.06] px-6 sticky top-[57px] bg-[#0a0a0a] z-10">
        <div className="flex gap-0">
          {([["products", "Products"], ["samples", "Samples"], ["prioritization", "Prioritization"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 py-3.5 text-xs font-semibold border-b-2 transition ${activeTab === key ? "border-white text-white" : "border-transparent text-white/30 hover:text-white/60"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-white/20" /></div>
        ) : activeTab === "products" ? (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products..." className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none w-52" />
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

            {/* New Collection */}
            {showNewCollection && (
              <div className="border border-white/[0.08] rounded-2xl p-4 space-y-3 bg-white/[0.01]">
                <p className="text-xs font-semibold text-white/70">New Collection</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={lc}>Name *</label><input value={newCollection.name} onChange={e => setNewCollection({ ...newCollection, name: e.target.value })} className={ic} /></div>
                  <div><label className={lc}>Season</label><input value={newCollection.season} onChange={e => setNewCollection({ ...newCollection, season: e.target.value })} className={ic} /></div>
                  <div><label className={lc}>Year</label><input value={newCollection.year} onChange={e => setNewCollection({ ...newCollection, year: e.target.value })} className={ic} /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={createCollection} disabled={saving || !newCollection.name} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                    {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}Create
                  </button>
                  <button onClick={() => setShowNewCollection(false)} className="px-3 py-2 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            )}

            {/* New Product */}
            {showNewProduct && (
              <div className="border border-white/[0.08] rounded-2xl p-4 space-y-3 bg-white/[0.01]">
                <p className="text-xs font-semibold text-white/70">New Product</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lc}>Name *</label><input value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Product name" className={ic} /></div>
                  <div><label className={lc}>SKU</label><input value={newProduct.sku} onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })} placeholder="SKU-001" className={ic} /></div>
                  <div><label className={lc}>Category</label><input value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })} className={ic} /></div>
                  <div><label className={lc}>Collection</label>
                    <select value={newProduct.collection_id} onChange={e => setNewProduct({ ...newProduct, collection_id: e.target.value })} className={ic}>
                      <option value="">No collection</option>
                      {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div><label className={lc}>Specs</label><textarea value={newProduct.specs} onChange={e => setNewProduct({ ...newProduct, specs: e.target.value })} rows={2} className={`${ic} resize-none`} /></div>
                <div><label className={lc}>Notes</label><textarea value={newProduct.notes} onChange={e => setNewProduct({ ...newProduct, notes: e.target.value })} rows={2} className={`${ic} resize-none`} /></div>
                <div className="flex gap-2">
                  <button onClick={createProduct} disabled={saving || !newProduct.name} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                    {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}Create
                  </button>
                  <button onClick={() => setShowNewProduct(false)} className="px-3 py-2 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            )}

            {/* Product list */}
            {filtered.length === 0 ? (
              <div className="text-center py-20"><Package size={28} className="text-white/10 mx-auto mb-3" /><p className="text-white/30 text-sm">No products yet</p></div>
            ) : (
              <div className="space-y-2">
                {filtered.map(product => {
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
                      (sr.plm_sample_stages || []).map((s: any) => ({ ...s, _factory: sr.factory_catalog?.name }))
                    ),
                  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                  return (
                    <div key={product.id} className={`border rounded-2xl overflow-hidden transition ${isKilled ? "border-red-500/20 opacity-60" : isHold ? "border-amber-500/20" : "border-white/[0.07]"}`}>
                      <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpandedProduct(isExpanded ? null : product.id)}>
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-white/[0.06]" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                            <Package size={14} className="text-white/20" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-semibold">{product.name}</p>
                            {product.sku && <span className="text-[10px] font-mono text-white/25 bg-white/[0.04] px-1.5 py-0.5 rounded">{product.sku}</span>}
                            {product.plm_collections && <span className="text-[10px] text-white/20">{product.plm_collections.name}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${stageColor}20`, color: stageColor, border: `1px solid ${stageColor}30` }}>{stageLabel}</span>
                            {isKilled && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20">Killed</span>}
                            {isHold && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/20">On Hold</span>}
                            {approvedSample && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">Sample ✓</span>}
                            {batches.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/20">{batches.length} order{batches.length !== 1 ? "s" : ""}</span>}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={14} className="text-white/30 flex-shrink-0" /> : <ChevronDown size={14} className="text-white/30 flex-shrink-0" />}
                      </div>

                      {isExpanded && (
                        <div className="border-t border-white/[0.05] p-4 space-y-5">

                          {/* Product Info — editable */}
                          <div className="space-y-3">
                            <p className="text-[10px] text-white/30 uppercase tracking-widest">Product Details</p>
                            {[
                              { field: "name", label: "Name" },
                              { field: "sku", label: "SKU" },
                              { field: "description", label: "Description" },
                              { field: "specs", label: "Specs" },
                              { field: "category", label: "Category" },
                              { field: "notes", label: "Notes" },
                            ].map(({ field, label }) => (
                              <EditableField key={field} label={label} value={product[field] || ""}
                                onSave={v => updateField(product.id, field, v)} multiline={["description", "specs", "notes"].includes(field)} />
                            ))}
                            <div>
                              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Collection</p>
                              <select value={product.collection_id || ""} onChange={e => updateField(product.id, "collection_id", e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none">
                                <option value="">No collection</option>
                                {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                          </div>

                          {/* Dev stage */}
                          {!isKilled && (
                            <div>
                              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Development Stage</p>
                              <div className="flex flex-wrap gap-1.5">
                                {DEV_STAGES.map(s => (
                                  <button key={s.key} onClick={() => updateStage(product.id, s.key)}
                                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${stage === s.key ? "font-semibold" : "border-white/[0.06] text-white/30 hover:text-white/60"}`}
                                    style={stage === s.key ? { background: `${s.color}20`, borderColor: `${s.color}40`, color: s.color } : {}}>
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Status */}
                          <div>
                            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Product Status <span className="text-white/15 ml-1">— PIN required</span></p>
                            <div className="flex gap-2 flex-wrap">
                              <button onClick={() => setProductStatus(product.id, "progression")} disabled={status === "progression"}
                                className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-30">
                                ▶ Progression{status === "progression" ? " (current)" : ""}
                              </button>
                              <button onClick={() => setProductStatus(product.id, "hold")} disabled={status === "hold"}
                                className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition disabled:opacity-30">
                                ⏸ Hold{status === "hold" ? " (current)" : ""}
                              </button>
                              <button onClick={() => setProductStatus(product.id, "killed")} disabled={status === "killed"}
                                className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition disabled:opacity-30">
                                ● Kill{status === "killed" ? "ed" : ""}
                              </button>
                            </div>
                          </div>

                          {/* Active samples */}
                          {activeSamples.length > 0 && (
                            <div>
                              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Active Samples <span className="text-white/15 ml-1">— PIN required for decisions</span></p>
                              <div className="space-y-2">
                                {activeSamples.map((sr: any) => {
                                  const currentStage = sr.current_stage;
                                  const sc = SAMPLE_STAGE_COLORS[currentStage] || "#6b7280";
                                  const sl = STAGE_LABELS[currentStage] || currentStage?.replace(/_/g, " ");
                                  const rounds = (sr.plm_sample_stages || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                  return (
                                    <div key={sr.id} className="border border-white/[0.06] rounded-xl p-3 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-white/70">{sr.factory_catalog?.name}</p>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${sc}20`, color: sc, border: `1px solid ${sc}30` }}>{sl}</span>
                                      </div>
                                      {/* Stage dots */}
                                      <div className="flex items-center gap-1">
                                        {["sample_production", "sample_complete", "sample_shipped", "sample_arrived"].map((s, i, arr) => {
                                          const stageIdx = arr.indexOf(currentStage);
                                          const isDone = i < stageIdx;
                                          const isCurrent = s === currentStage;
                                          const c = SAMPLE_STAGE_COLORS[s] || "#6b7280";
                                          return (
                                            <div key={s} className="flex items-center gap-1">
                                              <div className="flex flex-col items-center">
                                                <div className={`w-2 h-2 rounded-full ${isCurrent ? "ring-2 ring-offset-1 ring-offset-[#0a0a0a]" : ""}`}
                                                  style={{ background: isCurrent || isDone ? c : "#374151" }} />
                                              </div>
                                              {i < arr.length - 1 && <div className={`h-px w-4 ${isDone ? "bg-white/30" : "bg-white/10"}`} />}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="flex gap-1.5 flex-wrap">
                                        <button onClick={() => updateSampleOutcome(sr.id, product.id, sr.factory_id, currentStage, "approved")}
                                          className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition">✓ Approve</button>
                                        <button onClick={async () => {
                                          const note = window.prompt("Revision reason:");
                                          if (note === null) return;
                                          await updateSampleOutcome(sr.id, product.id, sr.factory_id, currentStage, "revision", note);
                                        }} className="text-[10px] px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition">Revision</button>
                                        <button onClick={async () => {
                                          const note = window.prompt("Kill reason:");
                                          if (note === null) return;
                                          await updateSampleOutcome(sr.id, product.id, sr.factory_id, currentStage, "killed", note);
                                        }} className="text-[10px] px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition">Kill</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Production orders */}
                          {batches.length > 0 && (
                            <div>
                              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Production Orders</p>
                              <div className="space-y-1.5">
                                {batches.map((b: any) => {
                                  const bc = STAGE_COLORS[b.current_stage] || "#6b7280";
                                  const bl = STAGE_LABELS[b.current_stage] || b.current_stage;
                                  return (
                                    <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-xl border border-white/[0.06]">
                                      <div>
                                        <p className="text-xs font-medium text-white/60">Order #{b.batch_number || 1}</p>
                                        {b.linked_po_number && <p className="text-[10px] font-mono text-white/30">{b.linked_po_number}</p>}
                                      </div>
                                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${bc}20`, color: bc, border: `1px solid ${bc}30` }}>{bl}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* History */}
                          {history.length > 0 && (
                            <div>
                              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">History</p>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {history.slice(0, 15).map((h: any, i: number) => {
                                  const sc = STAGE_COLORS[h.stage] || SAMPLE_STAGE_COLORS[h.stage] || "#6b7280";
                                  const sl = STAGE_LABELS[h.stage] || h.stage?.replace(/_/g, " ");
                                  return (
                                    <div key={h.id || i} className="flex items-start gap-2.5">
                                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: sc }} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-[11px] font-medium" style={{ color: sc }}>{sl}</span>
                                          <span className="text-[10px] text-white/20 flex-shrink-0">{new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
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
          <SamplesTab products={products} factories={factories} token={tok()} onRefresh={load} />

        ) : (
          /* Prioritization */
          <div className="space-y-4">
            {factories.length === 0 ? <div className="text-center py-20"><p className="text-white/30 text-sm">No factories</p></div> : (
              <>
                <div className="flex gap-2 border-b border-white/[0.06] pb-3">
                  {factories.map(f => (
                    <button key={f.id} onClick={() => setPrioActiveFactory(f.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${prioActiveFactory === f.id ? "bg-white text-black" : "text-white/40 hover:text-white/70 border border-white/[0.06]"}`}>
                      {f.name} <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${prioActiveFactory === f.id ? "bg-black/10" : "bg-white/[0.06]"}`}>{(prioOrder[f.id] || []).length}</span>
                    </button>
                  ))}
                </div>
                {prioActiveFactory && (() => {
                  const orderedSamples = (prioOrder[prioActiveFactory] || []).map(id => samples.find((s: any) => s.id === id)).filter(Boolean);
                  return (
                    <div className="space-y-3">
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
                        <div className="text-center py-16 border border-white/[0.06] rounded-2xl"><p className="text-white/20 text-sm">No pending samples</p></div>
                      ) : orderedSamples.map((sample: any, idx: number) => {
                        const product = sample.plm_products;
                        return (
                          <div key={sample.id} draggable
                            onDragStart={e => e.dataTransfer.setData("text/plain", String(idx))}
                            onDragOver={e => { e.preventDefault(); setDragOver(sample.id); }}
                            onDragLeave={() => setDragOver(null)}
                            onDrop={e => { e.preventDefault(); setDragOver(null); moveSample(prioActiveFactory, parseInt(e.dataTransfer.getData("text/plain")), idx); }}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition cursor-grab ${dragOver === sample.id ? "border-blue-500/40 bg-blue-500/5" : "border-white/[0.08] bg-white/[0.02]"}`}>
                            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400">{idx + 1}</div>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {product?.images?.[0] && <img src={product.images[0]} alt="" className="w-7 h-7 rounded-lg object-cover" />}
                              <div><p className="text-sm text-white/80 font-medium truncate">{product?.name}</p>
                                {product?.sku && <p className="text-[10px] text-white/30 font-mono">{product.sku}</p>}</div>
                            </div>
                            <div className="flex flex-col gap-0.5 opacity-30">{[0, 1, 2].map(i => <div key={i} className="w-4 h-0.5 bg-white/40 rounded" />)}</div>
                          </div>
                        );
                      })}
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

function EditableField({ label, value, onSave, multiline = false }: { label: string; value: string; onSave: (v: string) => Promise<void>; multiline?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); await onSave(val); setSaving(false); setEditing(false); };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-white/30 uppercase tracking-widest">{label}</p>
        {!editing && <button onClick={() => { setVal(value); setEditing(true); }} className="text-[10px] text-white/20 hover:text-white/50 transition">edit</button>}
      </div>
      {editing ? (
        <div className="space-y-1.5">
          {multiline ? <textarea value={val} onChange={e => setVal(e.target.value)} rows={2} className="w-full bg-white/[0.03] border border-white/[0.15] rounded-xl px-3 py-2 text-white/80 text-xs focus:outline-none resize-none" />
            : <input value={val} onChange={e => setVal(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.15] rounded-xl px-3 py-2 text-white/80 text-xs focus:outline-none" />}
          <div className="flex gap-1.5">
            <button onClick={save} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold disabled:opacity-40">
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}Save
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg border border-white/[0.06] text-white/30 text-xs">Cancel</button>
          </div>
        </div>
      ) : <p className="text-xs text-white/60">{value || <span className="text-white/20 italic">Not set</span>}</p>}
    </div>
  );
}
