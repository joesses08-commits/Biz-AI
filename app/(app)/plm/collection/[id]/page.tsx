"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Layers, Factory, ChevronDown, Package, FileSpreadsheet, Plus, X, Loader2 } from "lucide-react";

const TRACK_STAGES = [
  { key: "_track_exists",     label: "Track Created",   color: "#6b7280" },
  { key: "artwork_sent",      label: "Artwork Sent",    color: "#8b5cf6" },
  { key: "quote_requested",   label: "Quote Req.",      color: "#ec4899" },
  { key: "quote_received",    label: "Quote Rec.",      color: "#3b82f6" },
  { key: "sample_requested",  label: "Sample Req.",     color: "#f59e0b" },
  { key: "sample_production", label: "In Production",   color: "#f59e0b" },
  { key: "sample_complete",   label: "Complete",        color: "#10b981" },
  { key: "sample_shipped",    label: "Shipped",         color: "#3b82f6" },
  { key: "sample_arrived",    label: "Arrived",         color: "#8b5cf6" },
  { key: "sample_reviewed",   label: "Reviewed",        color: "#10b981" },
];

const OUTCOMES = [
  { key: "approved",  label: "✓ Approved",      color: "#10b981" },
  { key: "active",    label: "↻ In Progress",   color: "#f59e0b" },
  { key: "killed",    label: "✕ Discontinued",  color: "#ef4444" },
];

function getAllFactories(products: any[]) {
  const map: Record<string, any> = {};
  for (const p of products) {
    for (const t of (p.plm_factory_tracks || [])) {
      if (t.factory_catalog && !map[t.factory_id]) {
        map[t.factory_id] = { id: t.factory_id, ...t.factory_catalog };
      }
    }
  }
  return Object.values(map);
}

function getStageInfo(products: any[], factoryId: string, stageKey: string) {
  const done: any[] = [];
  const notDone: any[] = [];
  for (const p of products) {
    const track = (p.plm_factory_tracks || []).find((t: any) => t.factory_id === factoryId);
    if (stageKey === "_track_exists") {
      if (track) done.push(p); else notDone.push({ ...p, _noTrack: true });
      continue;
    }
    if (!track) { notDone.push({ ...p, _noTrack: true }); continue; }
    const stageData = (track.plm_track_stages || []).find((s: any) => s.stage === stageKey && s.status === "done");
    if (stageData) done.push({ ...p, _stageData: stageData });
    else notDone.push(p);
  }
  return { done, notDone, total: products.length };
}

function StageCell({ products, factoryId, stageKey, color }: any) {
  const [expanded, setExpanded] = useState(false);
  const [noteProduct, setNoteProduct] = useState<any>(null);
  const router = useRouter();
  const { done, notDone, total } = getStageInfo(products, factoryId, stageKey);
  const count = done.length;
  const allDone = count === total;
  const noneDone = count === 0;

  return (
    <div>
      {noteProduct && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setNoteProduct(null)}>
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {noteProduct.images?.[0] && <img src={noteProduct.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                <div>
                  <p className="text-sm font-semibold text-white">{noteProduct.name}</p>
                  {noteProduct.sku && <p className="text-[10px] text-white/30 font-mono">{noteProduct.sku}</p>}
                </div>
              </div>
              <button onClick={() => setNoteProduct(null)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
            {noteProduct.notes && <div><p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Notes</p><p className="text-xs text-white/60">{noteProduct.notes}</p></div>}
            {noteProduct.factory_notes && <div><p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Factory Notes</p><p className="text-xs text-white/60">{noteProduct.factory_notes}</p></div>}
            {!noteProduct.notes && !noteProduct.factory_notes && <p className="text-xs text-white/20 italic">No notes</p>}
            <button onClick={() => router.push(`/plm/${noteProduct.id}`)} className="w-full py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60 text-xs hover:text-white/80 transition">Open Product →</button>
          </div>
        </div>
      )}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-white/[0.04] transition">
        <span className="text-xs font-bold" style={{ color: allDone ? color : noneDone ? "rgba(255,255,255,0.15)" : color }}>
          {count}/{total}
        </span>
        <ChevronDown size={9} className="text-white/20 flex-shrink-0" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      <div className="w-full bg-white/[0.04] rounded-full h-0.5 mx-auto mb-1" style={{ maxWidth: "60px" }}>
        <div className="h-0.5 rounded-full transition-all" style={{ width: `${(count/total)*100}%`, background: color, opacity: noneDone ? 0.15 : 1 }} />
      </div>
      {expanded && (
        <div className="mt-1 space-y-px max-h-48 overflow-y-auto">
          {done.map((p: any) => (
            <button key={p.id} onClick={() => setNoteProduct(p)}
              className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/[0.04] transition text-left">
              {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-4 h-4 rounded object-cover flex-shrink-0" /> : <div className="w-4 h-4 rounded bg-white/[0.06] flex-shrink-0" />}
              <span className="text-[9px] truncate font-medium" style={{ color }}>✓ {p.name}</span>
            </button>
          ))}
          {notDone.map((p: any) => (
            <button key={p.id} onClick={() => !p._noTrack && setNoteProduct(p)}
              className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/[0.04] transition text-left">
              {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-4 h-4 rounded object-cover flex-shrink-0 opacity-40" /> : <div className="w-4 h-4 rounded bg-white/[0.04] flex-shrink-0" />}
              <span className="text-[9px] text-white/25 truncate">{p._noTrack ? "— " : ""}{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CollectionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [collection, setCollection] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plm/collection/" + id)
      .then(r => r.json())
      .then(d => { setCollection(d.collection); setLoading(false); });
  }, [id]);

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 size={20} className="animate-spin text-white/20" /></div>;
  if (!collection) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><p className="text-white/30">Collection not found</p></div>;

  const products = (collection.plm_products || []).filter((p: any) => !p.killed);
  const factories = getAllFactories(products);
  const approvedCount = products.filter((p: any) => (p.plm_factory_tracks || []).some((t: any) => t.status === "approved")).length;
  const actionCount = products.filter((p: any) => p.action_status === "action_required").length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="max-w-full mx-auto">
          <button onClick={() => router.push("/plm")} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition mb-4">
            <ArrowLeft size={12} />Back to PLM
          </button>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <Layers size={14} className="text-white/40" />
                </div>
                <h1 className="text-2xl font-bold">{collection.name}</h1>
                {collection.season && <span className="text-xs text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">{collection.season} {collection.year}</span>}
                {approvedCount > 0 && <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">✓ {approvedCount} approved</span>}
                {actionCount > 0 && <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">⚡ {actionCount} need attention</span>}
              </div>
              <p className="text-white/30 text-sm ml-11">{products.length} products · {factories.length} factories</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => router.push(`/plm?collection=${id}&rfq=1`)}
                className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-pink-500 text-white font-semibold hover:bg-pink-400 transition">
                <FileSpreadsheet size={11} />RFQ Collection
              </button>
              <button onClick={() => router.push(`/plm?collection=${id}&samples=1`)}
                className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition">
                <Plus size={11} />Request Samples
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 space-y-8 max-w-full overflow-x-auto">
        {/* Factory grid */}
        {factories.length > 0 && (
          <div>
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Factory Progress</p>
            <table className="w-full text-left" style={{ minWidth: `${220 + factories.length * 140}px` }}>
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                  <th className="px-5 py-3 text-[10px] text-white/25 uppercase tracking-widest font-medium w-48">Stage</th>
                  {factories.map((f: any) => (
                    <th key={f.id} className="px-3 py-3 text-[10px] text-white/50 font-semibold text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Factory size={9} className="text-white/30" />
                        <span className="truncate max-w-[120px]">{f.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TRACK_STAGES.map(stageDef => (
                  <tr key={stageDef.key} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition">
                    <td className="px-5 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: stageDef.color, opacity: 0.7 }} />
                        <span className="text-[11px] text-white/50">{stageDef.label}</span>
                      </div>
                    </td>
                    {factories.map((f: any) => (
                      <td key={f.id} className="px-3 py-2 align-top">
                        <StageCell products={products} factoryId={f.id} stageKey={stageDef.key} color={stageDef.color} />
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Outcomes */}
                <tr className="border-t-2 border-white/[0.06]">
                  <td className="px-5 py-2"><span className="text-[10px] text-white/25 uppercase tracking-widest font-medium">Outcomes</span></td>
                  {factories.map((f: any) => <td key={f.id} />)}
                </tr>
                {OUTCOMES.map(outcome => (
                  <tr key={outcome.key} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition">
                    <td className="px-5 py-2">
                      <span className="text-[11px] font-medium" style={{ color: outcome.color }}>{outcome.label}</span>
                    </td>
                    {factories.map((f: any) => {
                      const count = products.filter((p: any) => {
                        const track = (p.plm_factory_tracks || []).find((t: any) => t.factory_id === f.id);
                        return track && track.status === outcome.key;
                      }).length;
                      const total = products.filter((p: any) => (p.plm_factory_tracks || []).some((t: any) => t.factory_id === f.id)).length;
                      return (
                        <td key={f.id} className="px-3 py-2 text-center">
                          <span className="text-xs font-bold" style={{ color: count > 0 ? outcome.color : "rgba(255,255,255,0.15)" }}>
                            {total > 0 ? `${count}/${total}` : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* All products */}
        <div>
          <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">All Products ({products.length})</p>
          <div className="grid grid-cols-1 gap-2">
            {products.map((p: any) => {
              const approvedTrack = (p.plm_factory_tracks || []).find((t: any) => t.status === "approved");
              const activeFactories = (p.plm_factory_tracks || []).filter((t: any) => t.status === "active").length;
              const killedFactories = (p.plm_factory_tracks || []).filter((t: any) => t.status === "killed").length;
              return (
                <div key={p.id} className="flex items-center gap-4 border border-white/[0.06] rounded-xl px-4 py-3 bg-white/[0.01] hover:border-white/10 transition cursor-pointer"
                  onClick={() => router.push(`/plm/${p.id}`)}>
                  {p.images?.[0]
                    ? <img src={p.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/[0.06]" />
                    : <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/[0.06] flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-white">{p.name}</span>
                      {p.sku && <span className="text-[10px] text-white/30 font-mono">{p.sku}</span>}
                      {approvedTrack && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          ✓ {approvedTrack.factory_catalog?.name}{approvedTrack.approved_price ? ` · $${approvedTrack.approved_price}` : ""}
                        </span>
                      )}
                      {p.action_status === "action_required" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">⚡ Action</span>}
                      {p.action_status === "updates_made" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">● Updates</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {activeFactories > 0 && <span className="text-[10px] text-white/25">{activeFactories} active {activeFactories === 1 ? "factory" : "factories"}</span>}
                      {killedFactories > 0 && <span className="text-[10px] text-red-400/40">{killedFactories} discontinued</span>}
                      {p.notes && <span className="text-[10px] text-white/20 truncate max-w-xs">{p.notes}</span>}
                    </div>
                  </div>
                  <span className="text-white/20 text-xs flex-shrink-0">→</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
