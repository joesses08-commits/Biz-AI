"use client";
import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Layers, Factory, ChevronDown, FileSpreadsheet, Plus, X, Loader2 } from "lucide-react";

const TRACK_STAGES = [
  { key: "_track_exists", label: "Track Created", color: "#6b7280" },
  { key: "artwork_sent", label: "Artwork Sent", color: "#8b5cf6" },
  { key: "quote_requested", label: "Quote Req.", color: "#ec4899" },
  { key: "quote_received", label: "Quote Rec.", color: "#3b82f6" },
  { key: "sample_requested", label: "Sample Req.", color: "#f59e0b" },
  { key: "sample_production", label: "In Production", color: "#f59e0b" },
  { key: "sample_complete", label: "Complete", color: "#10b981" },
  { key: "sample_shipped", label: "Shipped", color: "#3b82f6" },
  { key: "sample_arrived", label: "Arrived", color: "#8b5cf6" },
  { key: "sample_reviewed", label: "Reviewed", color: "#10b981" },
];

const OUTCOMES = [
  { key: "approved", label: "✓ Approved", color: "#10b981" },
  { key: "active", label: "↻ In Progress", color: "#f59e0b" },
  { key: "killed", label: "✕ Discontinued", color: "#ef4444" },
];

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("portal_token") || "";
}

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

function StageCell({ products, factoryId, stageKey, color, onNoteProduct }: any) {
  const [expanded, setExpanded] = useState(false);
  const { done, notDone, total } = getStageInfo(products, factoryId, stageKey);
  const count = done.length;
  const allDone = count === total;
  const noneDone = count === 0;

  return (
    <div>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-bg-elevated transition">
        <span className="text-xs font-bold" style={{ color: allDone ? color : noneDone ? "rgba(255,255,255,0.15)" : color }}>{count}/{total}</span>
        <ChevronDown size={9} className="text-text-muted" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      <div className="w-full bg-bg-elevated rounded-full h-0.5 mx-auto mb-1" style={{ maxWidth: "60px" }}>
        <div className="h-0.5 rounded-full transition-all" style={{ width: `${(count/total)*100}%`, background: color, opacity: noneDone ? 0.15 : 1 }} />
      </div>
      {expanded && (
        <div className="mt-1 space-y-px max-h-48 overflow-y-auto">
          {done.map((p: any) => (
            <button key={p.id} onClick={() => onNoteProduct(p)} className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-bg-elevated transition text-left">
              {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-4 h-4 rounded object-cover" /> : <div className="w-4 h-4 rounded bg-white/[0.06]" style={{ background: p.color }} />}
              <span className="text-[9px] truncate font-medium" style={{ color }}>✓ {p.name}</span>
            </button>
          ))}
          {notDone.map((p: any) => (
            <button key={p.id} onClick={() => !p._noTrack && onNoteProduct(p)} className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-bg-elevated transition text-left">
              {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-4 h-4 rounded object-cover opacity-40" /> : <div className="w-4 h-4 rounded bg-bg-elevated" style={{ background: p.color, opacity: 0.4 }} />}
              <span className="text-[9px] text-text-muted truncate">{p._noTrack ? "— " : ""}{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DesignerCollectionContent() {
  const searchParams = useSearchParams();
  const collectionId = searchParams.get("id");
  const router = useRouter();
  const [collection, setCollection] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [allFactories, setAllFactories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteProduct, setNoteProduct] = useState<any>(null);

  const load = async () => {
    const res = await fetch("/api/portal/designer", { headers: { Authorization: `Bearer ${getToken()}` } });
    const data = await res.json();
    if (data.products) {
      const filteredProducts = data.products.filter((p: any) => p.collection_id === collectionId && !p.killed);
      setProducts(filteredProducts);
      const col = data.collections?.find((c: any) => c.id === collectionId);
      setCollection(col || { id: collectionId, name: "Collection" });
    }
    if (data.factories) setAllFactories(data.factories);
    setLoading(false);
  };

  useEffect(() => { if (collectionId) load(); }, [collectionId]);

  const factories = getAllFactories(products);
  const approvedCount = products.filter((p: any) => (p.plm_factory_tracks || []).some((t: any) => t.status === "approved")).length;

  if (loading) return <div className="min-h-screen bg-bg-base flex items-center justify-center"><Loader2 size={20} className="animate-spin text-text-muted" /></div>;
  if (!collection) return <div className="min-h-screen bg-bg-base flex items-center justify-center"><p className="text-text-muted">Collection not found</p></div>;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {noteProduct && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setNoteProduct(null)}>
          <div className="bg-bg-elevated border border-bg-border rounded-2xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {noteProduct.images?.[0] && <img src={noteProduct.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                <div><p className="text-sm font-semibold text-text-primary">{noteProduct.name}</p>{noteProduct.sku && <p className="text-[10px] text-text-muted font-mono">{noteProduct.sku}</p>}</div>
              </div>
              <button onClick={() => setNoteProduct(null)} className="text-text-muted hover:text-text-secondary"><X size={14} /></button>
            </div>
            {noteProduct.notes && <div><p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Notes</p><p className="text-xs text-text-secondary">{noteProduct.notes}</p></div>}
            {!noteProduct.notes && <p className="text-xs text-text-muted italic">No notes</p>}
            <button onClick={() => { setNoteProduct(null); router.push(`/portal/designer-product?id=${noteProduct.id}`); }} className="w-full py-2 rounded-xl bg-white/[0.06] border border-bg-border text-text-secondary text-xs hover:text-text-primary transition">Open Product →</button>
          </div>
        </div>
      )}

      <div className="border-b border-bg-border px-8 py-6">
        <button onClick={() => router.push("/portal")} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition mb-4"><ArrowLeft size={12} />Back to PLM</button>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl bg-bg-elevated border border-bg-border flex items-center justify-center"><Layers size={14} className="text-text-secondary" /></div>
              <h1 className="text-2xl font-bold">{collection.name}</h1>
              {approvedCount > 0 && <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">✓ {approvedCount} approved</span>}
            </div>
            <p className="text-text-muted text-sm ml-11">{products.length} products · {factories.length} factories</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 space-y-8 overflow-x-auto">
        {factories.length > 0 && (
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-widest mb-4">Factory Progress</p>
            <table className="w-full text-left" style={{ minWidth: `${220 + factories.length * 140}px` }}>
              <thead>
                <tr className="border-b border-bg-border bg-bg-surface">
                  <th className="px-5 py-3 text-[10px] text-text-muted uppercase tracking-widest font-medium w-48">Stage</th>
                  {factories.map((f: any) => (
                    <th key={f.id} className="px-3 py-3 text-[10px] text-text-secondary font-semibold text-center">
                      <div className="flex items-center justify-center gap-1"><Factory size={9} className="text-text-muted" /><span className="truncate max-w-[120px]">{f.name}</span></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TRACK_STAGES.map(stageDef => (
                  <tr key={stageDef.key} className="border-b border-white/[0.03] hover:bg-bg-surface transition">
                    <td className="px-5 py-2"><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full" style={{ background: stageDef.color, opacity: 0.7 }} /><span className="text-[11px] text-text-secondary">{stageDef.label}</span></div></td>
                    {factories.map((f: any) => <td key={f.id} className="px-3 py-2 align-top"><StageCell products={products} factoryId={f.id} stageKey={stageDef.key} color={stageDef.color} onNoteProduct={setNoteProduct} /></td>)}
                  </tr>
                ))}
                <tr className="border-t-2 border-bg-border"><td className="px-5 py-2"><span className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Outcomes</span></td>{factories.map((f: any) => <td key={f.id} />)}</tr>
                {OUTCOMES.map(outcome => (
                  <tr key={outcome.key} className="border-b border-white/[0.03] hover:bg-bg-surface transition">
                    <td className="px-5 py-2"><span className="text-[11px] font-medium" style={{ color: outcome.color }}>{outcome.label}</span></td>
                    {factories.map((f: any) => {
                      const count = products.filter((p: any) => { const track = (p.plm_factory_tracks || []).find((t: any) => t.factory_id === f.id); return track && track.status === outcome.key; }).length;
                      const total = products.filter((p: any) => (p.plm_factory_tracks || []).some((t: any) => t.factory_id === f.id)).length;
                      return <td key={f.id} className="px-3 py-2 text-center"><span className="text-xs font-bold" style={{ color: count > 0 ? outcome.color : "rgba(255,255,255,0.15)" }}>{total > 0 ? `${count}/${total}` : "—"}</span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-widest mb-4">Products ({products.length})</p>
          <div className="grid grid-cols-1 gap-2">
            {products.map((p: any) => {
              const approvedTrack = (p.plm_factory_tracks || []).find((t: any) => t.status === "approved");
              return (
                <div key={p.id} className="flex items-center gap-4 border border-bg-border rounded-xl px-4 py-3 bg-bg-surface hover:border-bg-border transition">
                  {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover border border-bg-border" /> : <div className="w-10 h-10 rounded-lg border border-bg-border" style={{ background: p.color || "#1a1a1a" }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-text-primary">{p.name}</span>
                      {p.sku && <span className="text-[10px] text-text-muted font-mono">{p.sku}</span>}
                      {approvedTrack && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">✓ {approvedTrack.factory_catalog?.name}</span>}
                    </div>
                  </div>
                  <button onClick={() => router.push(`/portal/designer-product?id=${p.id}`)} className="text-[9px] px-2 py-1 rounded border border-bg-border text-text-muted hover:text-text-secondary transition">Open →</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DesignerCollectionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-base flex items-center justify-center"><Loader2 size={20} className="animate-spin text-text-muted" /></div>}>
      <DesignerCollectionContent />
    </Suspense>
  );
}
