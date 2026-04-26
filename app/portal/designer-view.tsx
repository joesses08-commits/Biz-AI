"use client";
import PortalNotificationBell from "../../components/PortalNotificationBell";

import { useState, useEffect } from "react";
import { Package, Plus, Loader2, Check, X, ChevronDown, ChevronRight, LogOut, Layers, Users, Factory, Search } from "lucide-react";

const BATCH_STAGE_ORDER = ["po_issued","production_started","production_complete","qc_inspection","ready_to_ship","shipped"];
const BATCH_STAGE_LABELS: Record<string,string> = { po_issued:"PO Issued", production_started:"Production Started", production_complete:"Production Complete", qc_inspection:"QC Inspection", ready_to_ship:"Ready to Ship", shipped:"Shipped" };
const BATCH_STAGE_COLORS: Record<string,string> = { po_issued:"#f59e0b", production_started:"#f59e0b", production_complete:"#10b981", qc_inspection:"#f59e0b", ready_to_ship:"#3b82f6", shipped:"#10b981" };

const ORDERED_STAGES = [
  { key: "artwork_sent",     label: "Artwork Sent",     color: "#8b5cf6", bg: "#8b5cf615", border: "#8b5cf630" },
  { key: "quote_requested",  label: "Quote Requested",  color: "#ec4899", bg: "#ec489915", border: "#ec489930" },
  { key: "quote_received",   label: "Quote Received",   color: "#3b82f6", bg: "#3b82f615", border: "#3b82f630" },
  { key: "sample_requested", label: "Sample Requested", color: "#f59e0b", bg: "#f59e0b15", border: "#f59e0b30" },
  { key: "sample_reviewed",  label: "Sample Reviewed",  color: "#10b981", bg: "#10b98115", border: "#10b98130" },
];

const ic = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white/80 placeholder-white/20 text-xs focus:outline-none focus:border-white/20 transition";
const lc = "text-[10px] text-white/30 mb-1.5 block uppercase tracking-widest";

function getProductStatus(product: any) {
  const batches = product.plm_batches || [];
  let statusKey: string | null = null;
  let statusIdx = -1;
  for (const b of batches) {
    const idx = BATCH_STAGE_ORDER.indexOf(b.current_stage);
    if (idx > statusIdx) { statusIdx = idx; statusKey = b.current_stage; }
  }
  return statusKey;
}

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

export default function DesignerView({ portalUser, router }: { portalUser: any; router: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [productTracks, setProductTracks] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"products" | "collections" | "prioritization">("products");
  const [requestAssignmentProduct, setRequestAssignmentProduct] = useState<any>(null);
  const [requestingAssignment, setRequestingAssignment] = useState(false);
  const [assignmentRequested, setAssignmentRequested] = useState<Set<string>>(new Set());
  const [prioFactories, setPrioFactories] = useState<any[]>([]);
  const [prioSamples, setPrioSamples] = useState<any[]>([]);
  const [prioOrder, setPrioOrder] = useState<Record<string, string[]>>({});
  const [prioActiveFactory, setPrioActiveFactory] = useState<string | null>(null);
  const [prioLoading, setPrioLoading] = useState(false);
  const [prioSaving, setPrioSaving] = useState(false);
  const [prioSaved, setPrioSaved] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [hasPinSet, setHasPinSet] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [pinPrompt, setPinPrompt] = useState<null | { resolve: (pin: string) => void }>(null);
  const [pinError, setPinError] = useState("");
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", sku: "", description: "", specs: "", category: "", collection_id: "", notes: "" });
  const [newCollection, setNewCollection] = useState({ name: "", season: "", year: new Date().getFullYear().toString() });
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterCollection, setFilterCollection] = useState("");

  const tok = () => localStorage.getItem("portal_token_designer") || localStorage.getItem("portal_token") || "";

  const loadPrioritization = async () => {
    setPrioLoading(true);
    const res = await fetch("/api/plm/prioritize", { headers: { Authorization: `Bearer ${tok()}` } });
    const data = await res.json();
    const facs = data.factories || [];
    const samps = data.samples || [];
    setPrioFactories(facs);
    setPrioSamples(samps);
    const order: Record<string, string[]> = {};
    facs.forEach((f: any) => {
      const fs = samps.filter((s: any) => s.factory_id === f.id);
      const pri = fs.filter((s: any) => s.priority_order != null).sort((a: any, b: any) => a.priority_order - b.priority_order);
      const unpri = fs.filter((s: any) => s.priority_order == null);
      order[f.id] = [...pri, ...unpri].map((s: any) => s.id);
    });
    setPrioOrder(order);
    if (facs.length > 0) setPrioActiveFactory(facs[0].id);
    setPrioLoading(false);
  };

  const savePriorities = async (factoryId: string) => {
    setPrioSaving(true);
    const ids = prioOrder[factoryId] || [];
    await fetch("/api/plm/prioritize", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ action: "save_priorities", factory_id: factoryId, ordered_ids: ids, changer_name: portalUser?.name || portalUser?.email || "Team" }) });
    setPrioSaving(false);
    setPrioSaved(true);
    setTimeout(() => setPrioSaved(false), 2000);
  };

  const moveSample = (factoryId: string, fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setPrioOrder(prev => {
      const ids = [...(prev[factoryId] || [])];
      const [moved] = ids.splice(fromIdx, 1);
      ids.splice(toIdx, 0, moved);
      return { ...prev, [factoryId]: ids };
    });
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/portal/designer", { headers: { Authorization: `Bearer ${tok()}` } });
    if (res.status === 401) { router.push("/portal"); return; }
    const data = await res.json();
    setProducts(data.products || []);
    setCollections(data.collections || []);
    setFactories(data.factories || []);
    setHasPinSet(data.has_pin || false);
    
    // Build product tracks map
    const trackMap: Record<string, any[]> = {};
    for (const p of (data.products || [])) {
      trackMap[p.id] = p.plm_factory_tracks || [];
    }
    setProductTracks(trackMap);
    setLoading(false);
  };

  const getPin = (): Promise<string | null> => {
    if (!hasPinSet) { setShowSetPin(true); return Promise.resolve(null); }
    return new Promise(resolve => { setPinError(""); setPinPrompt({ resolve }); });
  };

  const logout = () => { 
    localStorage.removeItem("portal_token_designer"); 
    localStorage.removeItem("portal_user_designer"); 
    localStorage.removeItem("portal_token"); 
    localStorage.removeItem("portal_user"); 
    router.push("/portal"); 
  };

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

  // Filter and sort products exactly like main PLM
  const filteredProducts = products.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.name?.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q)) return false;
    }
    if (filterCollection && p.collection_id !== filterCollection) return false;
    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    // Killed to bottom
    if (a.killed && !b.killed) return 1;
    if (!a.killed && b.killed) return -1;
    // Hold above killed but below active
    if (a.status === "hold" && b.status !== "hold" && !b.killed) return 1;
    if (a.status !== "hold" && !a.killed && b.status === "hold") return -1;
    // Action Required to top
    const aAction = a.action_status === "action_required" ? 0 : a.action_status === "updates_made" ? 1 : 2;
    const bAction = b.action_status === "action_required" ? 0 : b.action_status === "updates_made" ? 1 : 2;
    if (aAction !== bAction) return aAction - bAction;
    return 0;
  });

  // Build badges for a product (matching main PLM logic)
  const buildAwardBadges = (product: any) => {
    const tracks = productTracks[product.id] || [];
    const approvedTracks = tracks.filter((t: any) => t.status === "approved");
    const activeTracks = tracks.filter((t: any) => t.status === "active");
    const killedTracks = tracks.filter((t: any) => t.status === "killed");
    const totalTracks = tracks.length;
    const awardBadges: { label: string; color: string; bg: string; border: string }[] = [];

    // Count done per stage across all tracks
    ORDERED_STAGES.forEach(stageDef => {
      const count = tracks.filter((t: any) =>
        (t.plm_track_stages || []).some((s: any) => s.stage === stageDef.key && s.status === "done")
      ).length;
      if (count === 0) return;
      const label = totalTracks > 1
        ? `${stageDef.label} · ${count}/${totalTracks} factories`
        : stageDef.label;
      awardBadges.push({ label, color: stageDef.color, bg: stageDef.bg, border: stageDef.border });
    });

    // Approved factory (only 1)
    if (approvedTracks.length > 0) {
      const t = approvedTracks[0];
      const price = t.approved_price ? ` · $${t.approved_price}` : "";
      awardBadges.push({
        label: `✓ Approved · ${t.factory_catalog?.name}${price}`,
        color: "#10b981", bg: "#10b98115", border: "#10b98130",
      });
    }

    // Orders
    const orderCount = (product.plm_batches || []).length;
    if (orderCount > 0) {
      const orderFactories = Array.from(new Set((product.plm_batches || []).map((b: any) => {
        const f = factories.find((f: any) => f.id === b.factory_id);
        return f?.name || "Factory";
      }))).join(", ");
      awardBadges.push({
        label: `${orderCount} ${orderCount === 1 ? "Order" : "Orders"} · ${orderFactories}`,
        color: "#3b82f6", bg: "#3b82f615", border: "#3b82f630",
      });
    } else if (approvedTracks.length > 0) {
      awardBadges.push({
        label: "No orders yet",
        color: "#6b7280", bg: "#6b728015", border: "#6b728030",
      });
    }

    if (killedTracks.length > 0 && activeTracks.length === 0 && approvedTracks.length === 0) {
      awardBadges.push({ label: "All Factories Discontinued", color: "#ef4444", bg: "#ef444415", border: "#ef444430" });
    }

    if (tracks.length === 0) {
      awardBadges.push({ label: "Concept", color: "#6b7280", bg: "#6b728015", border: "#6b728030" });
    }

    return awardBadges;
  };

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
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/20 bg-white/[0.03] px-2 py-1 rounded-lg">{products.length} SKUs</span>
          {!hasPinSet && (
            <button onClick={() => setShowSetPin(true)} className="text-xs text-amber-400 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 rounded-lg">Set PIN</button>
          )}
          <div className="flex items-center gap-3">
            <PortalNotificationBell token={tok()} onNavigate={(link) => router.push(link)} />
            <button onClick={() => router.push("/portal/designer-messages")}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 border border-white/[0.06] hover:border-white/20 px-3 py-1.5 rounded-xl transition">
              💬 Messages
            </button>
            <button onClick={logout} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition">
              <LogOut size={12} />Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.06] px-6 sticky top-[57px] bg-[#0a0a0a] z-10">
        <div className="flex gap-0">
          {([["products", "Products"], ["collections", "Collections"], ["prioritization", "Prioritization"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => { setActiveTab(key); if (key === "prioritization" && prioFactories.length === 0) loadPrioritization(); }}
              className={`px-4 py-3.5 text-xs font-semibold border-b-2 transition ${activeTab === key ? "border-white text-white" : "border-transparent text-white/30 hover:text-white/60"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-white/20" /></div>
        ) : activeTab === "products" ? (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search products..." 
                    className="bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none w-52" />
                </div>
                <select value={filterCollection} onChange={e => setFilterCollection(e.target.value)}
                  className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 text-xs focus:outline-none">
                  <option value="">All Collections</option>
                  {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
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

            {/* Product list - split by assignment */}
            {(() => {
              const assignedProducts = sortedProducts.filter(p => (p.plm_assignments || []).some((a: any) => a.designer_id === portalUser?.id));
              const unassignedProducts = sortedProducts.filter(p => !(p.plm_assignments || []).some((a: any) => a.designer_id === portalUser?.id));
              return (
                <>
                  {assignedProducts.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Assigned to Me · {assignedProducts.length}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {assignedProducts.map(product => {
                  const statusKey = getProductStatus(product);
                  const productStatusMode = product.status || "progression";
                  const awardBadges = buildAwardBadges(product);
                  const addedBy = product.created_by_name || product.created_by_email || null;
                  
                  // Killed products
                  if (product.killed || productStatusMode === "killed") return (
                    <div key={product.id} onClick={() => router.push(`/portal/designer-product?id=${product.id}`)} 
                      className="flex items-center gap-3 p-4 border border-red-500/10 rounded-xl bg-red-500/[0.01] opacity-50 cursor-pointer hover:opacity-70 transition">
                      {product.images?.[0] && <img src={product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 grayscale" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/40 truncate line-through">{product.name}</p>
                        {product.sku && <p className="text-[10px] text-white/20 font-mono">{product.sku}</p>}
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400/70 border border-red-500/15 flex-shrink-0">Product Discontinued</span>
                    </div>
                  );

                  return (
                    <div key={product.id} 
                      className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.01] hover:border-white/10 transition cursor-pointer"
                      onClick={() => router.push(`/portal/designer-product?id=${product.id}`)}>
                      <div className="flex items-center gap-4">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-10 h-10 rounded-lg object-cover border border-white/[0.06] flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/[0.06] flex-shrink-0 flex items-center justify-center">
                            <Package size={14} className="text-white/20" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-white">{product.name}</p>
                            {product.sku && <span className="text-[10px] text-white/30 font-mono">{product.sku}</span>}
                            {product.plm_collections && <span className="text-[10px] text-white/25">{product.plm_collections.name}</span>}
                            {product.action_status === "action_required" && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 uppercase tracking-wide">⚡ Action Required</span>
                            )}
                            {product.action_status === "updates_made" && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25 uppercase tracking-wide">● Updates Made</span>
                            )}
                            {productStatusMode === "hold" && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">⏸ Hold</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {awardBadges.map((badge, i) => (
                              <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                                {badge.label}
                              </span>
                            ))}
                            {statusKey && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${BATCH_STAGE_COLORS[statusKey]}20`, color: BATCH_STAGE_COLORS[statusKey], border: `1px solid ${BATCH_STAGE_COLORS[statusKey]}30` }}>
                                {BATCH_STAGE_LABELS[statusKey]}
                              </span>
                            )}
                          </div>
                          {/* Added by attribution */}
                          {addedBy && (
                            <p className="text-[10px] text-white/20 mt-1.5">Added by {addedBy}</p>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
                      </div>
                    </div>
                  );
                })}
                      </div>
                    </div>
                  )}
                  {unassignedProducts.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3 mt-6">
                        <div className="w-2 h-2 rounded-full bg-white/20" />
                        <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Not Assigned · {unassignedProducts.length}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {unassignedProducts.map(product => (
                          <div key={product.id} className="border border-white/[0.04] rounded-xl p-4 bg-white/[0.005] flex items-center gap-4 cursor-pointer hover:border-white/[0.08] transition"
                            onClick={() => router.push("/portal/designer-product?id=" + product.id)}>
                            {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="w-10 h-10 rounded-lg object-cover border border-white/[0.06] flex-shrink-0 opacity-60" /> :
                              <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/[0.06] flex-shrink-0 opacity-60" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white/50 truncate">{product.name}</p>
                              {product.sku && <p className="text-[10px] text-white/25 font-mono">{product.sku}</p>}
                              {product.plm_collections && <p className="text-[10px] text-white/20">{product.plm_collections.name}</p>}
                            </div>
                            <button onClick={e => { e.stopPropagation(); setRequestAssignmentProduct(product); }}
                              className="text-[10px] px-3 py-1.5 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20 transition flex-shrink-0">
                              Request Assignment
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {sortedProducts.length === 0 && (
                    <div className="text-center py-20">
                      <Package size={32} className="text-white/10 mx-auto mb-3" />
                      <p className="text-white/30 text-sm">No products yet</p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : activeTab === "collections" ? (
          /* Collections Tab */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40">{collections.length} collections</p>
              <button onClick={() => setShowNewCollection(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition">
                <Plus size={11} />New Collection
              </button>
            </div>
            {collections.length === 0 ? (
              <div className="text-center py-20">
                <Layers size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No collections yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {collections.map((col: any) => {
                  const colProducts = products.filter(p => p.collection_id === col.id);
                  const actionRequired = colProducts.filter(p => p.action_status === "action_required").length;
                  const updatesMade = colProducts.filter(p => p.action_status === "updates_made").length;
                  return (
                    <div key={col.id} className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.01] hover:border-white/10 transition cursor-pointer"
                      onClick={() => router.push(`/portal/designer-collection?id=${col.id}`)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-white">{col.name}</p>
                            {col.season && <span className="text-[10px] text-white/30">{col.season} {col.year}</span>}
                          </div>
                          <p className="text-[11px] text-white/40">{colProducts.length} products</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {actionRequired > 0 && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                              {actionRequired} action required
                            </span>
                          )}
                          {updatesMade > 0 && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                              {updatesMade} updates
                            </span>
                          )}
                          <ChevronRight size={16} className="text-white/20" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Prioritization Tab */
          <div className="space-y-6">
            {prioFactories.length === 0 && !prioLoading ? (
              <div className="text-center py-20"><p className="text-white/30 text-sm">No factories found.</p></div>
            ) : prioLoading ? (
              <div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" /></div>
            ) : (
              <>
                <div className="flex gap-2 border-b border-white/[0.06] pb-3 flex-wrap">
                  {prioFactories.map((f: any) => {
                    const factorySamples = prioSamples.filter((s: any) => s.factory_id === f.id);
                    return (
                      <button key={f.id} onClick={() => setPrioActiveFactory(f.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${prioActiveFactory === f.id ? "bg-white text-black" : "text-white/40 hover:text-white/70 border border-white/[0.06]"}`}>
                        {f.name}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${prioActiveFactory === f.id ? "bg-black/10" : "bg-white/[0.06]"}`}>
                          {factorySamples.length} pending
                        </span>
                      </button>
                    );
                  })}
                </div>
                {prioActiveFactory && (() => {
                  const factory = prioFactories.find((f: any) => f.id === prioActiveFactory);
                  const max = factory?.max_samples || 50;
                  const orderedIds = prioOrder[prioActiveFactory] || [];
                  const orderedSamples = orderedIds.map((id: string) => prioSamples.find((s: any) => s.id === id)).filter(Boolean);
                  const prioritizedCount = orderedSamples.length;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${prioritizedCount >= max ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-white/[0.03] border-white/[0.08] text-white/60"}`}>
                            {prioritizedCount} / {max} samples
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {prioSaved && <span className="text-emerald-400 text-xs">Saved ✓</span>}
                          <button onClick={() => savePriorities(prioActiveFactory)} disabled={prioSaving}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 disabled:opacity-40 transition">
                            {prioSaving ? "Saving..." : "✓ Save Order"}
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-white/25">Drag samples to reorder priority. Top = highest priority.</p>
                      {orderedSamples.length === 0 ? (
                        <div className="text-center py-16 border border-white/[0.06] rounded-2xl">
                          <p className="text-white/20 text-sm">No pending samples for this factory</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {orderedSamples.map((sample: any, idx: number) => {
                            const product = sample.plm_products;
                            const isPrioritized = idx < max;
                            return (
                              <div key={sample.id} draggable
                                onDragStart={e => e.dataTransfer.setData("text/plain", String(idx))}
                                onDragOver={e => { e.preventDefault(); setDragOver(sample.id); }}
                                onDragLeave={() => setDragOver(null)}
                                onDrop={e => { e.preventDefault(); setDragOver(null); const fromIdx = parseInt(e.dataTransfer.getData("text/plain")); moveSample(prioActiveFactory, fromIdx, idx); }}
                                className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition cursor-grab active:cursor-grabbing ${dragOver === sample.id ? "border-blue-500/40 bg-blue-500/5" : isPrioritized ? "border-white/[0.08] bg-white/[0.02]" : "border-white/[0.04] opacity-50"}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${isPrioritized ? "bg-blue-500/20 border border-blue-500/30 text-blue-400" : "bg-white/[0.04] border border-white/[0.06] text-white/20"}`}>
                                  {isPrioritized ? idx + 1 : "—"}
                                </div>
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {product?.images?.[0] && <img src={product.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />}
                                  <div className="min-w-0">
                                    <p className="text-sm text-white/80 font-medium truncate">{product?.name}</p>
                                    {product?.sku && <p className="text-[10px] text-white/30 font-mono">{product.sku}</p>}
                                  </div>
                                </div>
                                <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${sample.label === "revision" ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-blue-500/20 border-blue-500/40 text-blue-300"}`}>
                                  {sample.label === "revision" ? "Revision" : "First Sample"}
                                </span>
                                {sample.current_stage && (() => {
                                  const stageColorMap: Record<string,string> = { sample_production: "#f59e0b", sample_complete: "#10b981", sample_shipped: "#3b82f6", sample_arrived: "#8b5cf6", revision_requested: "#f59e0b", sample_requested: "#6b7280" };
                                  const sc = stageColorMap[sample.current_stage] || "#6b7280";
                                  const sl = sample.current_stage.replace(/_/g, " ").replace(/\w/g, (ch: string) => ch.toUpperCase());
                                  return <span className="text-xs px-3 py-1 rounded-full border font-medium" style={{ background: `${sc}15`, borderColor: `${sc}40`, color: sc }}>{sl}</span>;
                                })()}
                                <div className="flex flex-col gap-0.5 ml-2 flex-shrink-0">
                                  <div className="w-4 h-0.5 bg-white/20 rounded" />
                                  <div className="w-4 h-0.5 bg-white/20 rounded" />
                                  <div className="w-4 h-0.5 bg-white/20 rounded" />
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
      {/* Request Assignment Modal */}
      {requestAssignmentProduct && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              {requestAssignmentProduct.images?.[0] ? (
                <img src={requestAssignmentProduct.images[0]} className="w-12 h-12 rounded-xl object-cover border border-white/[0.06]" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06]" />
              )}
              <div>
                <p className="text-sm font-semibold">{requestAssignmentProduct.name}</p>
                {requestAssignmentProduct.sku && <p className="text-[10px] text-white/30 font-mono">{requestAssignmentProduct.sku}</p>}
              </div>
            </div>
            {assignmentRequested.has(requestAssignmentProduct.id) ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                <span className="text-emerald-400 text-sm">✓</span>
                <p className="text-xs text-emerald-400">Assignment requested! Admin will be notified.</p>
              </div>
            ) : (
              <p className="text-xs text-white/50">Request to be assigned to this product. Admin will review and assign you.</p>
            )}
            <div className="flex gap-2">
              {!assignmentRequested.has(requestAssignmentProduct.id) && (
                <button onClick={async () => {
                  setRequestingAssignment(true);
                  await fetch("/api/portal/designer", { method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("portal_token") || "") },
                    body: JSON.stringify({ action: "request_assignment", product_id: requestAssignmentProduct.id }) });
                  setAssignmentRequested(prev => { const next = new Set(prev); next.add(requestAssignmentProduct.id); return next; });
                  setRequestingAssignment(false);
                }} disabled={requestingAssignment}
                  className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                  {requestingAssignment ? "Sending..." : "Send Request"}
                </button>
              )}
              <button onClick={() => setRequestAssignmentProduct(null)}
                className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">
                {assignmentRequested.has(requestAssignmentProduct.id) ? "Close" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
