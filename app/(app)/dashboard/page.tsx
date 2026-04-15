"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Package, Factory, Layers, AlertTriangle, CheckCircle, Clock, RefreshCw, Loader2, ChevronRight, Zap, TrendingUp } from "lucide-react";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STAGE_COLORS: Record<string, string> = {
  artwork_sent: "#8b5cf6", quote_requested: "#ec4899", quote_received: "#3b82f6",
  sample_requested: "#f59e0b", sample_production: "#f59e0b", sample_complete: "#10b981",
  sample_shipped: "#3b82f6", sample_arrived: "#8b5cf6", sample_reviewed: "#10b981"
};

const STAGE_LABELS: Record<string, string> = {
  artwork_sent: "Artwork Sent", quote_requested: "Quote Requested", quote_received: "Quote Received",
  sample_requested: "Sample Requested", sample_production: "In Production", sample_complete: "Sample Complete",
  sample_shipped: "Sample Shipped", sample_arrived: "Sample Arrived", sample_reviewed: "Sample Reviewed"
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [
      { data: products },
      { data: collections },
      { data: factories },
      { data: tracks },
      { data: orders },
    ] = await Promise.all([
      supabase.from("plm_products").select("id, name, sku, images, killed, status, action_status, action_note, collection_id, plm_collections(name, season, year), plm_batches(id, current_stage, factory_id, order_quantity)").eq("user_id", user.id).eq("killed", false),
      supabase.from("plm_collections").select("id, name, season, year").eq("user_id", user.id),
      supabase.from("factory_catalog").select("id, name").eq("user_id", user.id),
      supabase.from("plm_factory_tracks").select("id, product_id, factory_id, status, approved_price, updated_at, factory_catalog(name), plm_track_stages(stage, status, actual_date, expected_date, quoted_price, revision_number)").eq("user_id", user.id),
      supabase.from("plm_batches").select("id, product_id, current_stage, factory_id, order_quantity, updated_at, factory_catalog(name)").eq("user_id", user.id),
    ]);

    setData({ products: products || [], collections: collections || [], factories: factories || [], tracks: tracks || [], orders: orders || [] });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 size={20} className="animate-spin text-white/20" />
    </div>
  );
  if (!data) return null;

  const { products, collections, factories, tracks, orders } = data;
  const ic = "border border-white/[0.06] rounded-2xl bg-white/[0.01]";

  // ── Compute insights
  const approvedTracks = tracks.filter((t: any) => t.status === "approved");
  const activeTracks = tracks.filter((t: any) => t.status === "active");

  // Products with no factory track at all
  const untrackedProducts = products.filter((p: any) =>
    !tracks.some((t: any) => t.product_id === p.id)
  );

  // Products where sample arrived but not yet reviewed/approved
  const awaitingReview = products.filter((p: any) => {
    const productTracks = tracks.filter((t: any) => t.product_id === p.id && t.status === "active");
    return productTracks.some((t: any) => {
      const stages = t.plm_track_stages || [];
      const arrived = stages.some((s: any) => s.stage === "sample_arrived" && s.status === "done");
      const reviewed = stages.some((s: any) => s.stage === "sample_reviewed" && s.status === "done");
      return arrived && !reviewed;
    });
  });

  // Products approved but no order placed
  const approvedNoOrder = products.filter((p: any) => {
    const hasApproval = approvedTracks.some((t: any) => t.product_id === p.id);
    const hasOrder = (p.plm_batches || []).length > 0;
    return hasApproval && !hasOrder;
  });

  // Quotes sent but no response (quote_requested done, quote_received NOT done) — older than 5 days
  const waitingOnQuotes: any[] = [];
  activeTracks.forEach((t: any) => {
    const stages = t.plm_track_stages || [];
    const quoteSent = stages.find((s: any) => s.stage === "quote_requested" && s.status === "done");
    const quoteReceived = stages.some((s: any) => s.stage === "quote_received" && s.status === "done");
    if (quoteSent && !quoteReceived) {
      const daysSince = quoteSent.actual_date
        ? Math.floor((Date.now() - new Date(quoteSent.actual_date).getTime()) / 86400000)
        : null;
      if (daysSince !== null && daysSince >= 3) {
        const product = products.find((p: any) => p.id === t.product_id);
        waitingOnQuotes.push({ track: t, product, daysSince });
      }
    }
  });

  // Action required products
  const actionRequired = products.filter((p: any) => p.action_status === "action_required");

  // Factory leaderboard — approved count + avg price
  const factoryStats = factories.map((f: any) => {
    const ft = tracks.filter((t: any) => t.factory_id === f.id);
    const approved = ft.filter((t: any) => t.status === "approved");
    const prices = approved.filter((t: any) => t.approved_price).map((t: any) => t.approved_price);
    const avgPrice = prices.length > 0 ? (prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2) : null;
    const revisions = ft.reduce((sum: number, t: any) =>
      sum + (t.plm_track_stages || []).filter((s: any) => s.stage === "revision_requested").length, 0);
    return { ...f, approved: approved.length, active: ft.filter((t: any) => t.status === "active").length, avgPrice, revisions, total: ft.length };
  }).filter((f: any) => f.total > 0).sort((a: any, b: any) => b.approved - a.approved);

  // Collection progress
  const collectionStats = collections.map((c: any) => {
    const prods = products.filter((p: any) => p.collection_id === c.id);
    const approved = prods.filter((p: any) => approvedTracks.some((t: any) => t.product_id === p.id)).length;
    const sampled = prods.filter((p: any) =>
      tracks.some((t: any) => t.product_id === p.id &&
        (t.plm_track_stages || []).some((s: any) => s.stage === "sample_arrived" && s.status === "done"))
    ).length;
    return { ...c, total: prods.length, approved, sampled };
  }).filter((c: any) => c.total > 0);

  // Recent activity
  const recentActivity: any[] = [];
  tracks.forEach((t: any) => {
    (t.plm_track_stages || []).forEach((s: any) => {
      if (s.status === "done" && s.actual_date) {
        recentActivity.push({
          factory: (t as any).factory_catalog?.name,
          stage: s.stage,
          date: s.actual_date,
          product_id: t.product_id,
          productName: products.find((p: any) => p.id === t.product_id)?.name,
        });
      }
    });
  });
  recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalUrgent = actionRequired.length + awaitingReview.length + waitingOnQuotes.length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">PLM Dashboard</h1>
            <p className="text-white/30 text-sm mt-0.5">
              {products.length} products · {factories.length} factories · {approvedTracks.length} approved
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalUrgent > 0 && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <Zap size={11} />
                {totalUrgent} {totalUrgent === 1 ? "item" : "items"} need attention
              </div>
            )}
            <button onClick={load} className="p-2 rounded-xl border border-white/[0.06] text-white/30 hover:text-white/60 transition">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">

        {/* ── Top action strip ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Awaiting your review */}
          <div className={`${ic} p-5 ${awaitingReview.length > 0 ? "border-emerald-500/20 bg-emerald-500/[0.02]" : ""}`}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={14} className={awaitingReview.length > 0 ? "text-emerald-400" : "text-white/20"} />
              <p className="text-xs font-semibold text-white/70">Ready to Review</p>
              {awaitingReview.length > 0 && <span className="ml-auto text-xs font-bold text-emerald-400">{awaitingReview.length}</span>}
            </div>
            {awaitingReview.length === 0 ? (
              <p className="text-[11px] text-white/20">No samples waiting for review</p>
            ) : (
              <div className="space-y-2">
                {awaitingReview.slice(0, 3).map((p: any) => (
                  <button key={p.id} onClick={() => router.push(`/plm/${p.id}`)}
                    className="w-full flex items-center gap-2 text-left hover:bg-white/[0.03] -mx-1 px-1 py-1 rounded-lg transition">
                    {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" /> : <div className="w-6 h-6 rounded bg-white/[0.06] flex-shrink-0" />}
                    <span className="text-xs text-white/60 truncate">{p.name}</span>
                    <span className="ml-auto text-[10px] text-emerald-400 flex-shrink-0">Review →</span>
                  </button>
                ))}
                {awaitingReview.length > 3 && <p className="text-[10px] text-white/30">+{awaitingReview.length - 3} more</p>}
              </div>
            )}
          </div>

          {/* Approved, no order */}
          <div className={`${ic} p-5 ${approvedNoOrder.length > 0 ? "border-blue-500/20 bg-blue-500/[0.02]" : ""}`}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className={approvedNoOrder.length > 0 ? "text-blue-400" : "text-white/20"} />
              <p className="text-xs font-semibold text-white/70">Approved, No Order Yet</p>
              {approvedNoOrder.length > 0 && <span className="ml-auto text-xs font-bold text-blue-400">{approvedNoOrder.length}</span>}
            </div>
            {approvedNoOrder.length === 0 ? (
              <p className="text-[11px] text-white/20">All approved products have orders</p>
            ) : (
              <div className="space-y-2">
                {approvedNoOrder.slice(0, 3).map((p: any) => {
                  const at = approvedTracks.find((t: any) => t.product_id === p.id);
                  return (
                    <button key={p.id} onClick={() => router.push(`/plm/${p.id}`)}
                      className="w-full flex items-center gap-2 text-left hover:bg-white/[0.03] -mx-1 px-1 py-1 rounded-lg transition">
                      {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" /> : <div className="w-6 h-6 rounded bg-white/[0.06] flex-shrink-0" />}
                      <span className="text-xs text-white/60 truncate">{p.name}</span>
                      {(at as any)?.approved_price && <span className="ml-auto text-[10px] text-blue-400 flex-shrink-0">${(at as any).approved_price}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Waiting on quotes */}
          <div className={`${ic} p-5 ${waitingOnQuotes.length > 0 ? "border-amber-500/20 bg-amber-500/[0.02]" : ""}`}>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className={waitingOnQuotes.length > 0 ? "text-amber-400" : "text-white/20"} />
              <p className="text-xs font-semibold text-white/70">Waiting on Quotes</p>
              {waitingOnQuotes.length > 0 && <span className="ml-auto text-xs font-bold text-amber-400">{waitingOnQuotes.length}</span>}
            </div>
            {waitingOnQuotes.length === 0 ? (
              <p className="text-[11px] text-white/20">No quotes pending</p>
            ) : (
              <div className="space-y-2">
                {waitingOnQuotes.slice(0, 3).map(({ track, product, daysSince }: any) => (
                  <button key={track.id} onClick={() => product && router.push(`/plm/${product.id}`)}
                    className="w-full flex items-center gap-2 text-left hover:bg-white/[0.03] -mx-1 px-1 py-1 rounded-lg transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/60 truncate">{product?.name}</p>
                      <p className="text-[10px] text-white/30">{(track as any).factory_catalog?.name}</p>
                    </div>
                    <span className="text-[10px] text-amber-400 flex-shrink-0">{daysSince}d</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Action required ── */}
        {actionRequired.length > 0 && (
          <div className={`${ic} p-5 border-red-500/20 bg-red-500/[0.02]`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400" />
                <p className="text-xs font-semibold text-white/70">Action Required</p>
                <span className="text-xs font-bold text-red-400">{actionRequired.length}</span>
              </div>
              <button onClick={() => router.push("/plm")} className="text-[11px] text-white/30 hover:text-white/60 transition">View All →</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {actionRequired.map((p: any) => (
                <button key={p.id} onClick={() => router.push(`/plm/${p.id}`)}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-red-500/10 hover:border-red-500/20 bg-red-500/[0.02] transition text-left">
                  {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" /> : <div className="w-7 h-7 rounded bg-white/[0.04] flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white/70 truncate">{p.name}</p>
                    {p.action_note && <p className="text-[10px] text-red-400/70 truncate">{p.action_note}</p>}
                  </div>
                  <ChevronRight size={12} className="text-white/20 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Factory leaderboard ── */}
          <div className={`${ic} p-6`}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold">Factory Leaderboard</p>
              <button onClick={() => router.push("/plm")} className="text-[11px] text-white/30 hover:text-white/60 transition">View PLM →</button>
            </div>
            {factoryStats.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-6">No factory tracks yet</p>
            ) : (
              <div className="space-y-4">
                {factoryStats.map((f: any, i: number) => (
                  <div key={f.id} className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-white/20 w-4 flex-shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-white">{f.name}</span>
                        <div className="flex items-center gap-3">
                          {f.avgPrice && <span className="text-[10px] text-emerald-400">${f.avgPrice} avg</span>}
                          {f.revisions > 0 && <span className="text-[10px] text-amber-400/70">{f.revisions} rev</span>}
                          <span className="text-[10px] text-white/30">{f.approved}/{f.total}</span>
                        </div>
                      </div>
                      <div className="w-full bg-white/[0.05] rounded-full h-1">
                        <div className="h-1 rounded-full transition-all" style={{ width: `${f.total > 0 ? (f.approved / f.total) * 100 : 0}%`, background: f.approved > 0 ? "#10b981" : "#374151" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Collection progress ── */}
          <div className={`${ic} p-6`}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold">Collection Progress</p>
              <button onClick={() => router.push("/plm?tab=collections")} className="text-[11px] text-white/30 hover:text-white/60 transition">View All →</button>
            </div>
            {collectionStats.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-6">No collections yet</p>
            ) : (
              <div className="space-y-5">
                {collectionStats.map((c: any) => (
                  <div key={c.id} className="cursor-pointer" onClick={() => router.push(`/plm/collection/${c.id}`)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-white">{c.name}</span>
                      <div className="flex items-center gap-2">
                        {c.season && <span className="text-[9px] text-white/25">{c.season} {c.year}</span>}
                        <span className="text-[10px] text-white/30">{c.total} products</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[9px] text-emerald-400/70">Approved</span>
                          <span className="text-[9px] text-white/30">{c.approved}/{c.total}</span>
                        </div>
                        <div className="w-full bg-white/[0.05] rounded-full h-1">
                          <div className="h-1 rounded-full bg-emerald-500" style={{ width: `${c.total > 0 ? (c.approved / c.total) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[9px] text-purple-400/70">Samples Arrived</span>
                          <span className="text-[9px] text-white/30">{c.sampled}/{c.total}</span>
                        </div>
                        <div className="w-full bg-white/[0.05] rounded-full h-1">
                          <div className="h-1 rounded-full bg-purple-500" style={{ width: `${c.total > 0 ? (c.sampled / c.total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Recent activity ── */}
          <div className={`${ic} p-6`}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold">Recent Activity</p>
              <Clock size={13} className="text-white/20" />
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-6">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.slice(0, 8).map((a: any, i: number) => (
                  <button key={i} onClick={() => a.product_id && router.push(`/plm/${a.product_id}`)}
                    className="w-full flex items-center gap-3 hover:bg-white/[0.02] -mx-2 px-2 py-1.5 rounded-xl transition text-left">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STAGE_COLORS[a.stage] || "#6b7280" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/60 truncate">{a.productName}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px]" style={{ color: STAGE_COLORS[a.stage] || "#6b7280" }}>{STAGE_LABELS[a.stage] || a.stage}</span>
                        {a.factory && <span className="text-[10px] text-white/25">· {a.factory}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] text-white/20 flex-shrink-0">
                      {new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Production orders ── */}
          <div className={`${ic} p-6`}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold">Production Orders</p>
              <p className="text-[11px] text-white/30">{orders.length} total</p>
            </div>
            {orders.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-6">No orders yet</p>
            ) : (
              <div className="space-y-2">
                {orders.map((o: any) => {
                  const product = products.find((p: any) => p.id === o.product_id);
                  const stageColors: Record<string, string> = { po_issued: "#f59e0b", production_started: "#f59e0b", production_complete: "#10b981", shipped: "#10b981", qc_inspection: "#f59e0b", ready_to_ship: "#3b82f6" };
                  const stageLabels: Record<string, string> = { po_issued: "PO Issued", production_started: "In Production", production_complete: "Complete", shipped: "Shipped", qc_inspection: "QC", ready_to_ship: "Ready" };
                  const sc = stageColors[o.current_stage] || "#6b7280";
                  return (
                    <button key={o.id} onClick={() => product && router.push(`/plm/${product.id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/[0.04] hover:border-white/10 transition text-left">
                      {product?.images?.[0]
                        ? <img src={product.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                        : <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{product?.name}</p>
                        <p className="text-[10px] text-white/30">{(o as any).factory_catalog?.name} · {o.order_quantity?.toLocaleString()} units</p>
                      </div>
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: sc, background: `${sc}15`, border: `1px solid ${sc}30` }}>
                        {stageLabels[o.current_stage] || o.current_stage}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Untracked products ── */}
        {untrackedProducts.length > 0 && (
          <div className={`${ic} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package size={13} className="text-white/30" />
                <p className="text-xs font-semibold text-white/50">{untrackedProducts.length} products have no factory assigned yet</p>
              </div>
              <button onClick={() => router.push("/plm")} className="text-[11px] text-white/30 hover:text-white/60 transition">Assign →</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {untrackedProducts.slice(0, 8).map((p: any) => (
                <button key={p.id} onClick={() => router.push(`/plm/${p.id}`)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.06] hover:border-white/15 transition">
                  {p.images?.[0] && <img src={p.images[0]} alt="" className="w-4 h-4 rounded object-cover" />}
                  <span className="text-[11px] text-white/40">{p.name}</span>
                </button>
              ))}
              {untrackedProducts.length > 8 && <span className="text-[11px] text-white/25 px-2 py-1.5">+{untrackedProducts.length - 8} more</span>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
