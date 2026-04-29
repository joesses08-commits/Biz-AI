"use client";
import { useState } from "react";
import { Layers, Factory, X, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

const TRACK_STAGES = [
  { key: "_track_exists",     label: "Track Created",  color: "#6b7280" },
  { key: "artwork_sent",      label: "Artwork Sent",   color: "#8b5cf6" },
  { key: "quote_requested",   label: "Quote Req.",     color: "#ec4899" },
  { key: "quote_received",    label: "Quote Rec.",     color: "#3b82f6" },
  { key: "sample_requested",  label: "Sample Req.",    color: "#f59e0b" },
  { key: "sample_production", label: "In Production",  color: "#f59e0b" },
  { key: "sample_complete",   label: "Complete",       color: "#10b981" },
  { key: "sample_shipped",    label: "Shipped",        color: "#3b82f6" },
  { key: "sample_arrived",    label: "Arrived",        color: "#8b5cf6" },
  { key: "sample_reviewed",   label: "Reviewed",       color: "#10b981" },
];

function getAllFactories(products: any[]) {
  const factoryMap: Record<string, any> = {};
  for (const p of products) {
    for (const t of (p.plm_factory_tracks || [])) {
      if (t.factory_catalog && !factoryMap[t.factory_id]) {
        factoryMap[t.factory_id] = { id: t.factory_id, ...t.factory_catalog };
      }
    }
  }
  return Object.values(factoryMap);
}

function getFactoryStageInfo(products: any[], factoryId: string, stageKey: string) {
  const done: any[] = [];
  const notDone: any[] = [];
  for (const p of products) {
    const track = (p.plm_factory_tracks || []).find((t: any) => t.factory_id === factoryId);
    if (stageKey === "_track_exists") {
      if (track) done.push(p);
      else notDone.push({ ...p, _noTrack: true });
      continue;
    }
    if (!track) {
      notDone.push({ ...p, _noTrack: true });
      continue;
    }
    const stageData = (track.plm_track_stages || []).find((s: any) => s.stage === stageKey && s.status === "done");
    if (stageData) done.push({ ...p, _stageData: stageData });
    else notDone.push(p);
  }
  return { done, notDone, total: products.length };
}

function ProductNoteModal({ product, onClose }: { product: any; onClose: () => void }) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-elevated border border-bg-border rounded-2xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {product.images?.[0] && <img src={product.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover" />}
            <div>
              <p className="text-sm font-semibold text-white">{product.name}</p>
              {product.sku && <p className="text-[10px] text-white/30 font-mono">{product.sku}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X size={14} /></button>
        </div>
        {product.notes && (
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Notes</p>
            <p className="text-xs text-white/60 leading-relaxed">{product.notes}</p>
          </div>
        )}
        {product.factory_notes && (
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Factory Notes</p>
            <p className="text-xs text-white/60 leading-relaxed">{product.factory_notes}</p>
          </div>
        )}
        {product.action_note && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
            <p className="text-[10px] text-red-400 uppercase tracking-widest mb-1">Action Required</p>
            <p className="text-xs text-white/60">{product.action_note}</p>
          </div>
        )}
        {!product.notes && !product.factory_notes && !product.action_note && (
          <p className="text-xs text-white/20 italic">No notes on this product</p>
        )}
        <button onClick={() => router.push(`/plm/${product.id}`)}
          className="w-full py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60 text-xs hover:text-white/80 transition">
          Open Product →
        </button>
      </div>
    </div>
  );
}

function FactoryStageCell({ products, factoryId, stageKey, color }: any) {
  const [expanded, setExpanded] = useState(false);
  const [noteProduct, setNoteProduct] = useState<any>(null);
  const { done, notDone, total } = getFactoryStageInfo(products, factoryId, stageKey);
  const count = done.length;
  const allDone = count === total;
  const noneDone = count === 0;

  return (
    <div>
      {noteProduct && <ProductNoteModal product={noteProduct} onClose={() => setNoteProduct(null)} />}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-white/[0.04] transition cursor-pointer">
        <span className="text-xs font-bold" style={{ color: allDone ? color : noneDone ? "var(--text-muted)" : color }}>
          {count}/{total}
        </span>
        <ChevronDown size={9} className="text-white/20 flex-shrink-0" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      <div className="w-full bg-white/[0.04] rounded-full h-0.5 mx-auto mb-1" style={{ maxWidth: "60px" }}>
        <div className="h-0.5 rounded-full transition-all" style={{ width: `${(count/total)*100}%`, background: color, opacity: noneDone ? 0.2 : 1 }} />
      </div>

      {expanded && (
        <div className="mt-1 space-y-px">
          {done.map((p: any) => (
            <button key={p.id} onClick={() => setNoteProduct(p)}
              className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/[0.04] transition text-left">
              {p.images?.[0]
                ? <img src={p.images[0]} alt="" className="w-4 h-4 rounded object-cover flex-shrink-0" />
                : <div className="w-4 h-4 rounded bg-white/[0.06] flex-shrink-0" />}
              <span className="text-[9px] truncate" style={{ color }}>✓ {p.name}</span>
            </button>
          ))}
          {notDone.map((p: any) => (
            <button key={p.id} onClick={() => !p._noTrack && setNoteProduct(p)}
              className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/[0.04] transition text-left">
              {p.images?.[0]
                ? <img src={p.images[0]} alt="" className="w-4 h-4 rounded object-cover flex-shrink-0 opacity-40" />
                : <div className="w-4 h-4 rounded bg-white/[0.04] flex-shrink-0" />}
              <span className="text-[9px] text-white/25 truncate">{p._noTrack ? "— " : ""}{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionCard({ collection, onRFQ, onSampleRequest, onNavigate }: any) {
  const router = useRouter();
  const products = (collection.plm_products || []).filter((p: any) => !p.killed);
  const factories = getAllFactories(products);
  const approvedCount = products.filter((p: any) =>
    (p.plm_factory_tracks || []).some((t: any) => t.status === "approved")
  ).length;
  const actionCount = products.filter((p: any) => p.action_status === "action_required").length;

  // Mini factory summary — top 3 stages with most progress
  const topStages = factories.slice(0, 3).map((f: any) => {
    const doneCount = TRACK_STAGES.filter(s => s.key !== "_track_exists").reduce((acc, stageDef) => {
      const { done } = getFactoryStageInfo(products, f.id, stageDef.key);
      return acc + done.length;
    }, 0);
    return { name: f.name, done: doneCount, total: products.length * (TRACK_STAGES.length - 1) };
  });

  return (
    <div className="border border-white/[0.06] rounded-2xl bg-white/[0.01] overflow-hidden hover:border-white/10 transition cursor-pointer group"
      onClick={() => router.push(`/plm/collection/${collection.id}`)}>
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
            <Layers size={16} className="text-white/40" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-base font-bold text-white">{collection.name}</h3>
              {collection.season && <span className="text-[10px] text-white/25 bg-white/[0.04] px-2 py-0.5 rounded-full">{collection.season} {collection.year}</span>}
              {approvedCount > 0 && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">✓ {approvedCount} approved</span>}
              {actionCount > 0 && <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">⚡ {actionCount} need attention</span>}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[11px] text-white/30">{products.length} products</span>
              <span className="text-[11px] text-white/25">{factories.length} {factories.length === 1 ? "factory" : "factories"}</span>
              {topStages.map(f => (
                <span key={f.name} className="text-[11px] text-white/25 flex items-center gap-1">
                  <Factory size={9} className="text-white/20" />{f.name}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onRFQ(products.map((p: any) => p.id)); }}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:bg-pink-500/20 transition font-semibold">
            RFQ
          </button>
          <button onClick={e => { e.stopPropagation(); onSampleRequest(products.map((p: any) => p.id)); }}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition font-semibold">
            Samples
          </button>
          <span className="text-white/20 group-hover:text-white/50 transition text-sm">→</span>
        </div>
      </div>
    </div>
  );
}

export default function CollectionsView({ collections, factories, onRFQ, onSampleRequest, onNavigate }: any) {
  if (collections.length === 0) {
    return (
      <div className="text-center py-20">
        <Layers size={32} className="text-white/10 mx-auto mb-3" />
        <p className="text-white/30 text-sm">No collections yet</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {collections.map((collection: any) => (
        <CollectionCard key={collection.id} collection={collection} factories={factories}
          onRFQ={onRFQ} onSampleRequest={onSampleRequest} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
