"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, ArrowLeft, Layers, Check, Loader2, Plus, ChevronRight, Factory } from "lucide-react";

const ORDERED_STAGES = [
  { key: "artwork_sent", label: "Artwork Sent", color: "#8b5cf6", bg: "#8b5cf615", border: "#8b5cf630" },
  { key: "quote_requested", label: "Quote Requested", color: "#ec4899", bg: "#ec489915", border: "#ec489930" },
  { key: "quote_received", label: "Quote Received", color: "#3b82f6", bg: "#3b82f615", border: "#3b82f630" },
  { key: "sample_requested", label: "Sample Requested", color: "#f59e0b", bg: "#f59e0b15", border: "#f59e0b30" },
  { key: "sample_reviewed", label: "Sample Reviewed", color: "#10b981", bg: "#10b98115", border: "#10b98130" },
];

const BATCH_STAGE_ORDER = ["po_issued","production_started","production_complete","qc_inspection","ready_to_ship","shipped"];
const BATCH_STAGE_LABELS: Record<string,string> = { po_issued:"PO Issued", production_started:"Production Started", production_complete:"Production Complete", qc_inspection:"QC Inspection", ready_to_ship:"Ready to Ship", shipped:"Shipped" };
const BATCH_STAGE_COLORS: Record<string,string> = { po_issued:"#f59e0b", production_started:"#f59e0b", production_complete:"#10b981", qc_inspection:"#f59e0b", ready_to_ship:"#3b82f6", shipped:"#10b981" };

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

function CollectionPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const [collection, setCollection] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getToken = () => localStorage.getItem("portal_token_designer") || localStorage.getItem("portal_token") || "";

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/portal/designer", { headers: { Authorization: `Bearer ${getToken()}` } });
    if (res.status === 401) { router.push("/portal"); return; }
    const data = await res.json();
    const col = (data.collections || []).find((c: any) => c.id === id);
    setCollection(col);
    const colProducts = (data.products || []).filter((p: any) => p.collection_id === id);
    setProducts(colProducts);
    setLoading(false);
  };

  const buildAwardBadges = (product: any) => {
    const tracks = product.plm_factory_tracks || [];
    const approvedTracks = tracks.filter((t: any) => t.status === "approved");
    const activeTracks = tracks.filter((t: any) => t.status === "active");
    const killedTracks = tracks.filter((t: any) => t.status === "killed");
    const totalTracks = tracks.length;
    const awardBadges: { label: string; color: string; bg: string; border: string }[] = [];

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

    if (approvedTracks.length > 0) {
      const t = approvedTracks[0];
      const price = t.approved_price ? ` · $${t.approved_price}` : "";
      awardBadges.push({
        label: `✓ Approved · ${t.factory_catalog?.name}${price}`,
        color: "#10b981", bg: "#10b98115", border: "#10b98130",
      });
    }

    const orderCount = (product.plm_batches || []).length;
    if (orderCount > 0) {
      awardBadges.push({
        label: `${orderCount} ${orderCount === 1 ? "Order" : "Orders"}`,
        color: "#3b82f6", bg: "#3b82f615", border: "#3b82f630",
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

  const sortedProducts = [...products].sort((a, b) => {
    if (a.killed && !b.killed) return 1;
    if (!a.killed && b.killed) return -1;
    if (a.status === "hold" && b.status !== "hold" && !b.killed) return 1;
    if (a.status !== "hold" && !a.killed && b.status === "hold") return -1;
    const aAction = a.action_status === "action_required" ? 0 : a.action_status === "updates_made" ? 1 : 2;
    const bAction = b.action_status === "action_required" ? 0 : b.action_status === "updates_made" ? 1 : 2;
    if (aAction !== bAction) return aAction - bAction;
    return 0;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-white/20" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <p className="text-white/30">Collection not found</p>
      </div>
    );
  }

  const actionRequired = products.filter(p => p.action_status === "action_required").length;
  const updatesMade = products.filter(p => p.action_status === "updates_made").length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4">
        <button onClick={() => router.push("/portal/dashboard?role=designer")} className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 mb-4">
          <ArrowLeft size={12} />Back to PLM
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Layers size={16} className="text-white/40" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{collection.name}</h1>
              {collection.season && <span className="text-xs text-white/30">{collection.season} {collection.year}</span>}
            </div>
            <p className="text-xs text-white/40">{products.length} products</p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {actionRequired > 0 && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                {actionRequired} action required
              </span>
            )}
            {updatesMade > 0 && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                {updatesMade} updates
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {sortedProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package size={32} className="text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No products in this collection</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {sortedProducts.map(product => {
              const statusKey = getProductStatus(product);
              const productStatusMode = product.status || "progression";
              const awardBadges = buildAwardBadges(product);

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
                    </div>
                    <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>}>
      <CollectionPageInner />
    </Suspense>
  );
}
