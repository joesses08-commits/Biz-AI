"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  Package, Factory, Layers, TrendingUp, Clock, CheckCircle,
  AlertTriangle, ChevronRight, BarChart3, Loader2, RefreshCw
} from "lucide-react";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STAGE_ORDER = [
  "artwork_sent", "quote_requested", "quote_received",
  "sample_requested", "sample_production", "sample_complete",
  "sample_shipped", "sample_arrived", "sample_reviewed"
];

const STAGE_LABELS: Record<string, string> = {
  artwork_sent: "Artwork Sent", quote_requested: "Quote Req.", quote_received: "Quote Rec.",
  sample_requested: "Sample Req.", sample_production: "In Production", sample_complete: "Complete",
  sample_shipped: "Shipped", sample_arrived: "Arrived", sample_reviewed: "Reviewed"
};

const STAGE_COLORS: Record<string, string> = {
  artwork_sent: "#8b5cf6", quote_requested: "#ec4899", quote_received: "#3b82f6",
  sample_requested: "#f59e0b", sample_production: "#f59e0b", sample_complete: "#10b981",
  sample_shipped: "#3b82f6", sample_arrived: "#8b5cf6", sample_reviewed: "#10b981"
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
      supabase.from("plm_products").select("id, name, sku, images, killed, status, action_status, collection_id, plm_collections(name), plm_batches(id, current_stage, factory_id, order_quantity)").eq("user_id", user.id).eq("killed", false),
      supabase.from("plm_collections").select("id, name, season, year").eq("user_id", user.id),
      supabase.from("factory_catalog").select("id, name").eq("user_id", user.id),
      supabase.from("plm_factory_tracks").select("id, product_id, factory_id, status, approved_price, factory_catalog(name), plm_track_stages(stage, status, actual_date, revision_number)").eq("user_id", user.id),
      supabase.from("plm_batches").select("id, product_id, current_stage, factory_id, order_quantity, factory_catalog(name)").eq("user_id", user.id),
    ]);

    setData({ products: products || [], collections: collections || [], factories: factories || [], tracks: tracks || [], orders: orders || [], userId: user.id });
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

  // ── Key metrics
  const totalProducts = products.length;
  const approvedProducts = products.filter((p: any) =>
    tracks.some((t: any) => t.product_id === p.id && t.status === "approved")
  ).length;
  const actionRequired = products.filter((p: any) => p.action_status === "action_required").length;
  const activeOrders = orders.filter((o: any) => !["shipped","delivered"].includes(o.current_stage)).length;
  const totalFactories = factories.length;
  const approvedTracks = tracks.filter((t: any) => t.status === "approved");
  const avgApprovedPrice = approvedTracks.length > 0
    ? (approvedTracks.reduce((sum: number, t: any) => sum + (t.approved_price || 0), 0) / approvedTracks.filter((t: any) => t.approved_price).length).toFixed(2)
    : null;

  // ── Stage pipeline counts (across all active tracks)
  const stageCounts: Record<string, number> = {};
  tracks.filter((t: any) => t.status === "active").forEach((t: any) => {
    const done = (t.plm_track_stages || []).filter((s: any) => s.status === "done").map((s: any) => s.stage);
    const lastDone = STAGE_ORDER.slice().reverse().find(s => done.includes(s));
    if (lastDone) stageCounts[lastDone] = (stageCounts[lastDone] || 0) + 1;
  });

  // ── Products needing attention
  const needsAttention = products.filter((p: any) =>
    p.action_status === "action_required" || p.action_status === "updates_made"
  ).slice(0, 5);

  // ── Factory performance
  const factoryStats = factories.map((f: any) => {
    const factoryTracks = tracks.filter((t: any) => t.factory_id === f.id);
    const approved = factoryTracks.filter((t: any) => t.status === "approved").length;
    const active = factoryTracks.filter((t: any) => t.status === "active").length;
    const killed = factoryTracks.filter((t: any) => t.status === "killed").length;
    const prices = factoryTracks.filter((t: any) => t.approved_price).map((t: any) => t.approved_price);
    const avgPrice = prices.length > 0 ? (prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2) : null;
    return { ...f, approved, active, killed, total: factoryTracks.length, avgPrice };
  }).filter((f: any) => f.total > 0).sort((a: any, b: any) => b.approved - a.approved);

  // ── Collection progress
  const collectionStats = collections.map((c: any) => {
    const prods = products.filter((p: any) => p.collection_id === c.id);
    const approvedProds = prods.filter((p: any) =>
      tracks.some((t: any) => t.product_id === p.id && t.status === "approved")
    ).length;
    const sampleProds = prods.filter((p: any) =>
      tracks.some((t: any) => t.product_id === p.id &&
        (t.plm_track_stages || []).some((s: any) => s.stage === "sample_arrived" && s.status === "done"))
    ).length;
    return { ...c, total: prods.length, approved: approvedProds, sampled: sampleProds };
  }).filter((c: any) => c.total > 0);

  // ── Recent track activity
  const recentActivity: any[] = [];
  tracks.forEach((t: any) => {
    (t.plm_track_stages || []).forEach((s: any) => {
      if (s.status === "done" && s.actual_date) {
        recentActivity.push({
          factory: t.factory_catalog?.name,
          stage: s.stage,
          date: s.actual_date,
          product_id: t.product_id,
          productName: products.find((p: any) => p.id === t.product_id)?.name,
        });
      }
    });
  });
  recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestActivity = recentActivity.slice(0, 8);

  const ic = "border border-white/[0.06] rounded-2xl bg-white/[0.01]";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">PLM Dashboard</h1>
            <p className="text-white/30 text-sm mt-0.5">Product lifecycle overview</p>
          </div>
          <div className="flex items-center gap-3">
            {actionRequired > 0 && (
              <button onClick={() => router.push("/plm")}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition">
                <AlertTriangle size={11} />⚡ {actionRequired} need attention
              </button>
            )}
            <button onClick={load} className="p-2 rounded-xl border border-white/[0.06] text-white/30 hover:text-white/60 transition">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">

        {/* ── KPI row ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total Products", value: totalProducts, icon: Package, color: "#8b5cf6", sub: `${approvedProducts} approved` },
            { label: "Factories", value: totalFactories, icon: Factory, color: "#3b82f6", sub: `${approvedTracks.length} approved tracks` },
            { label: "Collections", value: collections.length, icon: Layers, color: "#ec4899", sub: `${collectionStats.length} active` },
            { label: "Active Orders", value: activeOrders, icon: TrendingUp, color: "#f59e0b", sub: orders.length > 0 ? `${orders.length} total` : "No orders" },
            { label: "Avg Approved ELC", value: avgApprovedPrice ? `$${avgApprovedPrice}` : "—", icon: BarChart3, color: "#10b981", sub: `${approvedTracks.filter((t: any) => t.approved_price).length} with price` },
          ].map(item => (
            <div key={item.label} className={`${ic} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-white/30 uppercase tracking-widest">{item.label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${item.color}15` }}>
                  <item.icon size={13} style={{ color: item.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{item.value}</p>
              <p className="text-[11px] text-white/30 mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Stage pipeline ── */}
        <div className={`${ic} p-6`}>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-semibold">Pipeline Overview</p>
            <p className="text-[11px] text-white/30">Active factory tracks by furthest stage</p>
          </div>
          <div className="flex items-end gap-2 h-24">
            {STAGE_ORDER.map(stage => {
              const count = stageCounts[stage] || 0;
              const max = Math.max(...Object.values(stageCounts), 1);
              const pct = (count / max) * 100;
              return (
                <div key={stage} className="flex-1 flex flex-col items-center gap-1.5">
                  <p className="text-[10px] font-semibold text-white/50">{count > 0 ? count : ""}</p>
                  <div className="w-full rounded-t-lg transition-all" style={{
                    height: `${Math.max(pct * 0.7, count > 0 ? 8 : 2)}px`,
                    background: count > 0 ? STAGE_COLORS[stage] : "rgba(255,255,255,0.05)",
                    opacity: count > 0 ? 0.8 : 1,
                  }} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-2">
            {STAGE_ORDER.map(stage => (
              <div key={stage} className="flex-1 text-center">
                <p className="text-[8px] text-white/25 leading-tight">{STAGE_LABELS[stage]}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Factory performance ── */}
          <div className={`${ic} p-6`}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold">Factory Performance</p>
              <button onClick={() => router.push("/plm")} className="text-[11px] text-white/30 hover:text-white/60 transition">View PLM →</button>
            </div>
            {factoryStats.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-6">No factory tracks yet</p>
            ) : (
              <div className="space-y-3">
                {factoryStats.map((f: any) => {
                  const successRate = f.total > 0 ? Math.round((f.approved / f.total) * 100) : 0;
                  return (
                    <div key={f.id} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <Factory size={11} className="text-white/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white truncate">{f.name}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {f.avgPrice && <span className="text-[10px] text-emerald-400">${f.avgPrice} avg</span>}
                            <span className="text-[10px] text-white/30">{f.approved}/{f.total}</span>
                          </div>
                        </div>
                        <div className="w-full bg-white/[0.05] rounded-full h-1">
                          <div className="h-1 rounded-full transition-all" style={{ width: `${successRate}%`, background: successRate > 50 ? "#10b981" : successRate > 20 ? "#f59e0b" : "#ef4444" }} />
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {f.approved > 0 && <span className="text-[9px] text-emerald-400">✓ {f.approved} approved</span>}
                          {f.active > 0 && <span className="text-[9px] text-amber-400">↻ {f.active} active</span>}
                          {f.killed > 0 && <span className="text-[9px] text-red-400/60">✕ {f.killed} discontinued</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Collection progress ── */}
          <div className={`${ic} p-6`}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold">Collection Progress</p>
              <button onClick={() => router.push("/plm?tab=collections")} className="text-[11px] text-white/30 hover:text-white/60 transition">View Collections →</button>
            </div>
            {collectionStats.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-6">No collections yet</p>
            ) : (
              <div className="space-y-4">
                {collectionStats.map((c: any) => {
                  const approvedPct = c.total > 0 ? Math.round((c.approved / c.total) * 100) : 0;
                  const sampledPct = c.total > 0 ? Math.round((c.sampled / c.total) * 100) : 0;
                  return (
                    <div key={c.id} className="cursor-pointer hover:bg-white/[0.02] -mx-2 px-2 py-1.5 rounded-xl transition"
                      onClick={() => router.push(`/plm/collection/${c.id}`)}>
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
                            <div className="h-1 rounded-full bg-emerald-500 transition-all" style={{ width: `${approvedPct}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-0.5">
                            <span className="text-[9px] text-purple-400/70">Samples Arrived</span>
                            <span className="text-[9px] text-white/30">{c.sampled}/{c.total}</span>
                          </div>
                          <div className="w-full bg-white/[0.05] rounded-full h-1">
                            <div className="h-1 rounded-full bg-purple-500 transition-all" style={{ width: `${sampledPct}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Needs attention ── */}
          <div className={`${ic} p-6`}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold">Needs Attention</p>
              <button onClick={() => router.push("/plm")} className="text-[11px] text-white/30 hover:text-white/60 transition">View All →</button>
            </div>
            {needsAttention.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle size={24} className="text-emerald-500/40 mx-auto mb-2" />
                <p className="text-xs text-white/20">All caught up</p>
              </div>
            ) : (
              <div className="space-y-2">
                {needsAttention.map((p: any) => (
                  <div key={p.id} onClick={() => router.push(`/plm/${p.id}`)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.04] hover:border-white/10 cursor-pointer transition">
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      : <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-white/30">{p.plm_collections?.name}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${p.action_status === "action_required" ? "bg-red-500/15 text-red-400 border border-red-500/20" : "bg-blue-500/15 text-blue-400 border border-blue-500/20"}`}>
                      {p.action_status === "action_required" ? "⚡ Action" : "● Updates"}
                    </span>
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
            {latestActivity.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-6">No activity yet</p>
            ) : (
              <div className="space-y-2.5">
                {latestActivity.map((a: any, i: number) => (
                  <div key={i} onClick={() => a.product_id && router.push(`/plm/${a.product_id}`)}
                    className="flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] -mx-2 px-2 py-1.5 rounded-xl transition">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STAGE_COLORS[a.stage] || "#6b7280" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-medium text-white/70 truncate">{a.productName}</span>
                        <span className="text-[10px] text-white/30">·</span>
                        <span className="text-[10px]" style={{ color: STAGE_COLORS[a.stage] || "#6b7280" }}>{STAGE_LABELS[a.stage] || a.stage}</span>
                      </div>
                      {a.factory && <p className="text-[10px] text-white/25">{a.factory}</p>}
                    </div>
                    <span className="text-[9px] text-white/20 flex-shrink-0">
                      {new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Active orders ── */}
        {orders.length > 0 && (
          <div className={`${ic} p-6`}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold">Production Orders</p>
              <p className="text-[11px] text-white/30">{activeOrders} active · {orders.length} total</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {orders.slice(0, 6).map((o: any) => {
                const product = products.find((p: any) => p.id === o.product_id);
                const stageColors: Record<string, string> = {
                  po_issued: "#f59e0b", production_started: "#f59e0b", production_complete: "#10b981",
                  qc_inspection: "#f59e0b", ready_to_ship: "#3b82f6", shipped: "#10b981"
                };
                const stageLabels: Record<string, string> = {
                  po_issued: "PO Issued", production_started: "In Production", production_complete: "Complete",
                  qc_inspection: "QC Inspection", ready_to_ship: "Ready to Ship", shipped: "Shipped"
                };
                const sc = stageColors[o.current_stage] || "#6b7280";
                return (
                  <div key={o.id} onClick={() => product && router.push(`/plm/${product.id}`)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.04] hover:border-white/10 cursor-pointer transition">
                    {product?.images?.[0]
                      ? <img src={product.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      : <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{product?.name || "Unknown"}</p>
                      <p className="text-[10px] text-white/30">{o.factory_catalog?.name} · {o.order_quantity?.toLocaleString()} units</p>
                    </div>
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ color: sc, background: `${sc}15`, border: `1px solid ${sc}30` }}>
                      {stageLabels[o.current_stage] || o.current_stage}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
