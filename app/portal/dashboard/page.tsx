"use client";
import DesignerViewExternal from "./designer-view";
import DesignerViewExternal from "./designer-view";

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
  const [collapsedSamples, setCollapsedSamples] = useState<Record<string, boolean>>({});
  const [maxSamples, setMaxSamples] = useState(50);
  const [editingMax, setEditingMax] = useState(false);
  const [maxInput, setMaxInput] = useState("50");
  const [savingMax, setSavingMax] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { loadProducts(); }, []);

  const token = () => localStorage.getItem("portal_token") || "";

  const loadProducts = async () => {
    const res = await fetch("/api/portal/products", { headers: { Authorization: `Bearer ${token()}` } });
    if (res.status === 401) { router.push("/portal"); return; }
    const data = await res.json();
    setProducts(data.products || []);
    if (data.max_samples) { setMaxSamples(data.max_samples); setMaxInput(String(data.max_samples)); }
    setLoading(false);
  };

  const logout = () => { localStorage.removeItem("portal_token"); localStorage.removeItem("portal_user"); router.push("/portal"); };

  const saveMax = async () => {
    setSavingMax(true);
    await fetch("/api/plm/prioritize", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_max_samples", factory_id: portalUser?.factory_id, max_samples: parseInt(maxInput) || 50 }) });
    setMaxSamples(parseInt(maxInput) || 50);
    setSavingMax(false);
    setEditingMax(false);
  };

  const allSampleProducts = products.filter(p => p._has_sample);
  const filterBySearch = (p: any) => !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
  // Split pending samples into active/transit/upcoming
  const pendingSamples = allSampleProducts.filter(p => {
    const reqs = (p.plm_sample_requests || []).filter((s: any) => s.factory_id === portalUser?.factory_id);
    return reqs.some((s: any) => s.status === "requested");
  });
  const transitSamples = pendingSamples.filter(p => {
    const reqs = (p.plm_sample_requests || []).filter((s: any) => s.factory_id === portalUser?.factory_id);
    const active = reqs.find((s: any) => s.status === "requested");
    return active?.current_stage === "sample_shipped";
  }).filter(filterBySearch);
  const nonTransitPending = pendingSamples.filter(p => {
    const reqs = (p.plm_sample_requests || []).filter((s: any) => s.factory_id === portalUser?.factory_id);
    const active = reqs.find((s: any) => s.status === "requested");
    return active?.current_stage !== "sample_shipped";
  }).sort((a: any, b: any) => (a._sample_priority ?? 99999) - (b._sample_priority ?? 99999));
  // Active = first maxSamples items (by priority order), Upcoming = rest
  const activeSamples = nonTransitPending.slice(0, maxSamples).filter(filterBySearch);
  const upcomingSamples = nonTransitPending.slice(maxSamples).filter(filterBySearch);
  const historySamples = allSampleProducts.filter(p => {
    const reqs = (p.plm_sample_requests || []).filter((s: any) => s.factory_id === portalUser?.factory_id);
    const hasActive = reqs.some((s: any) => s.status === "requested");
    return !hasActive;
  }).filter(filterBySearch).sort((a: any, b: any) => {
    const aApproved = (a.plm_sample_requests || []).some((s: any) => s.status === "approved") ? 0 : 1;
    const bApproved = (b.plm_sample_requests || []).some((s: any) => s.status === "approved") ? 0 : 1;
    return aApproved - bApproved;
  });
  const sampleProducts = allSampleProducts;
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

  const renderSampleProduct = (product: any, isUpcoming: boolean, collapsed: Record<string,boolean>, setCollapsed: (fn: (prev: Record<string,boolean>) => Record<string,boolean>) => void) => {
    const allSampleRequests = (product.plm_sample_requests || [])
      .filter((s: any) => s.factory_id === portalUser?.factory_id)
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const isProductKilled = product.status === "killed";
    const allKilled = allSampleRequests.every((s: any) => s.status === "killed");
    const anyApproved = allSampleRequests.some((s: any) => s.status === "approved");
    const currentStage = product._sample_request?.current_stage || allSampleRequests[allSampleRequests.length - 1]?.current_stage;
    const stageColorMap: Record<string,string> = { sample_production: "#f59e0b", sample_complete: "#10b981", sample_shipped: "#3b82f6", sample_arrived: "#8b5cf6", revision_requested: "#f59e0b", killed: "#ef4444" };
    const stageLabelMap: Record<string,string> = { sample_production: "Sample Production", sample_complete: "Sample Complete", sample_shipped: "Sample Shipped", sample_arrived: "Sample Arrived", revision_requested: "Revision Requested", killed: "Ended" };
    const stageColor = stageColorMap[currentStage] || "#6b7280";
    const stageLabel = stageLabelMap[currentStage] || (currentStage || "").replace(/_/g, " ");

    return (
      <div key={product.id} className={`border rounded-2xl overflow-hidden ${isUpcoming ? "border-amber-500/10 bg-amber-500/[0.02]" : anyApproved ? "border-emerald-500/10 bg-emerald-500/[0.01]" : allKilled || isProductKilled ? "border-red-500/10 bg-red-500/[0.01]" : "border-white/[0.07] bg-white/[0.01]"}`}>
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
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {isUpcoming && <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">Upcoming</span>}
            {!isUpcoming && !anyApproved && currentStage !== "sample_shipped" && product._sample_priority != null && (
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/20">Priority #{product._sample_priority}</span>
            )}
            {anyApproved && <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">Approved ✓</span>}
            {product._sample_label && (
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
                product._sample_label === "revision" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                product._sample_label === "additional" ? "bg-purple-500/10 border-purple-500/20 text-purple-400" :
                "bg-white/[0.04] border-white/[0.06] text-white/40"
              }`}>
                {product._sample_label === "revision" ? "Revision" : product._sample_label === "additional" ? "Additional" : "First Sample"}
              </span>
            )}
            {currentStage && !anyApproved && !allKilled && !isProductKilled && (
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full border" style={{ background: `${stageColor}15`, borderColor: `${stageColor}40`, color: stageColor }}>
                {stageLabel}
              </span>
            )}
          </div>
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
            const roundLabel = sr.label === "additional" ? `Additional Sample ${roundIdx + 1}` : roundIdx === 0 ? "Round 1" : `Revision Round ${roundIdx}`;
            const collapseKey = `${product.id}-${sr.id}`;
            const isCollapsed = collapsed[collapseKey] ?? !isActive;

            return (
              <div key={sr.id} className={`p-4 space-y-3 ${isKilledRound ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setCollapsed(prev => ({ ...prev, [collapseKey]: !isCollapsed }))}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">{roundLabel}</span>
                    {isApprovedRound && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">Approved</span>}
                    {isKilledRound && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">Ended</span>}
                    {isRevisionRound && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">Revision Requested</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/20">{new Date(sr.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    {isCollapsed ? <ChevronDown size={12} className="text-white/20" /> : <ChevronUp size={12} className="text-white/20" />}
                  </div>
                </div>
                {!isCollapsed && isRevisionRound && sr.notes && (
                  <div className="flex items-start gap-2 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl px-3 py-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1" />
                    <p className="text-[11px] text-amber-300/70">{sr.notes}</p>
                  </div>
                )}
                {!isCollapsed && (
                  <div className="space-y-1.5">
                    {stages.map((stage: any, si: number) => {
                      const scMap: Record<string,string> = { sample_production: "#f59e0b", sample_complete: "#10b981", sample_shipped: "#3b82f6", sample_arrived: "#8b5cf6", revision_requested: "#f59e0b", killed: "#ef4444" };
                      const slMap: Record<string,string> = { sample_production: "Sample Production", sample_complete: "Sample Complete", sample_shipped: "Sample Shipped", sample_arrived: "Sample Arrived", revision_requested: "Revision Requested", killed: "Ended" };
                      const sc = scMap[stage.stage] || "#6b7280";
                      const sl = slMap[stage.stage] || stage.stage;
                      const isLast = si === stages.length - 1 && isActive;
                      return (
                        <div key={stage.id} className="flex items-start gap-2.5">
                          <div className="flex flex-col items-center flex-shrink-0 mt-1">
                            <div className="w-2 h-2 rounded-full" style={{ background: isLast ? sc : "#10b981" }} />
                            {si < stages.length - 1 && <div className="w-px h-4 bg-white/10 mt-1" />}
                          </div>
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium" style={{ color: isLast ? sc : "rgba(255,255,255,0.5)" }}>{sl}</span>
                              <span className="text-[10px] text-white/20 flex-shrink-0">{new Date(stage.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                            </div>
                            {stage.notes && stage.notes !== "Sample requested" && <p className="text-[11px] text-white/30 mt-0.5">{stage.notes}</p>}
                            <span className="text-[10px] text-white/20">{stage.updated_by_role === "factory" ? "You" : "Admin"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {isActive && !isCollapsed && (
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
          <div className="space-y-6">
            {/* Capacity bar */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-white/70">Active Sample Capacity</p>
                  <p className="text-[10px] text-white/30 mt-0.5">Samples you can actively work on at once</p>
                </div>
                {editingMax ? (
                  <div className="flex items-center gap-2">
                    <input type="number" value={maxInput} onChange={e => setMaxInput(e.target.value)}
                      className="w-16 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1 text-white/70 text-xs focus:outline-none text-center" />
                    <button onClick={saveMax} disabled={savingMax} className="text-xs px-3 py-1 rounded-lg bg-white text-black font-semibold disabled:opacity-40">
                      {savingMax ? "..." : "Save"}
                    </button>
                    <button onClick={() => setEditingMax(false)} className="text-xs px-2 py-1 rounded-lg border border-white/[0.06] text-white/30">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingMax(true)} className="text-xs text-white/30 hover:text-white/60 border border-white/[0.06] px-3 py-1 rounded-lg transition">
                    Adjust limit ({maxSamples})
                  </button>
                )}
              </div>
              <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min((activeSamples.length / maxSamples) * 100, 100)}%`, background: activeSamples.length >= maxSamples ? "#ef4444" : "#3b82f6" }} />
              </div>
              <p className="text-[10px] text-white/30 mt-1.5">{activeSamples.length} / {maxSamples} active · {upcomingSamples.length} upcoming</p>
            </div>

            {/* Search bar */}
            <div className="relative">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white/70 placeholder-white/20 text-xs focus:outline-none focus:border-white/20 transition" />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">×</button>
              )}
            </div>

            {allSampleProducts.length === 0 ? (
              <div className="text-center py-20">
                <Package size={28} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No sample requests yet</p>
                <p className="text-white/15 text-xs mt-1">Sample requests will appear here when admin sends them</p>
              </div>
            ) : null}

            {/* Active Priority Section */}
            {activeSamples.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">Active Priority · {activeSamples.length}</p>
                </div>
                <div className="space-y-4">
                {activeSamples.map(product => renderSampleProduct(product, false, collapsedSamples, setCollapsedSamples))}
                </div>
              </div>
            )}

            {/* Upcoming Section */}
            {upcomingSamples.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">Upcoming · {upcomingSamples.length}</p>
                </div>
                <div className="space-y-4">
                {upcomingSamples.map(product => renderSampleProduct(product, true, collapsedSamples, setCollapsedSamples))}
                </div>
              </div>
            )}

            {/* Transit Section */}
            {transitSamples.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">In Transit · {transitSamples.length}</p>
                </div>
                <div className="space-y-4">
                {transitSamples.map(product => renderSampleProduct(product, false, collapsedSamples, setCollapsedSamples))}
                </div>
              </div>
            )}

            {/* History Section */}
            {historySamples.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                  <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">History · {historySamples.length}</p>
                </div>
                <div className="space-y-4">
                {historySamples.map(product => renderSampleProduct(product, false, collapsedSamples, setCollapsedSamples))}
                </div>
              </div>
            )}

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

  if (portalUser.role === "designer") return <DesignerViewExternal portalUser={portalUser} router={router} />;
  return <FactoryView portalUser={portalUser} router={router} />;
}
