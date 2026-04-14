"use client";
import { useState } from "react";
import { Layers, ChevronRight, ChevronDown, Package, FileSpreadsheet, Plus, Factory } from "lucide-react";

const TRACK_STAGES = [
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

function getFactoryStageCount(products: any[], factoryId: string, stageKey: string) {
  let count = 0;
  const missing: any[] = [];
  for (const p of products) {
    const track = (p.plm_factory_tracks || []).find((t: any) => t.factory_id === factoryId);
    if (!track) continue;
    const stageData = (track.plm_track_stages || []).find((s: any) => s.stage === stageKey && s.status === "done");
    if (stageData) count++;
    else missing.push(p);
  }
  return { count, missing };
}

function getAllFactories(products: any[]) {
  const factoryMap: Record<string, any> = {};
  for (const p of products) {
    for (const t of (p.plm_factory_tracks || [])) {
      if (t.factory_catalog && !factoryMap[t.factory_id]) {
        factoryMap[t.factory_id] = t.factory_catalog;
      }
    }
  }
  return Object.entries(factoryMap).map(([id, f]: any) => ({ id, ...f }));
}

function FactoryStageCell({ products, factoryId, stageKey, color }: any) {
  const [expanded, setExpanded] = useState(false);
  const { count, missing } = getFactoryStageCount(products, factoryId, stageKey);
  const total = products.filter((p: any) => (p.plm_factory_tracks || []).some((t: any) => t.factory_id === factoryId)).length;
  if (total === 0) return <div className="text-center text-[10px] text-white/10">—</div>;
  const pct = Math.round((count / total) * 100);
  const allDone = count === total;
  const noneDone = count === 0;

  return (
    <div>
      <button onClick={() => missing.length > 0 && setExpanded(!expanded)}
        className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition ${missing.length > 0 ? "hover:bg-white/[0.04] cursor-pointer" : "cursor-default"}`}>
        <span className="text-xs font-bold" style={{ color: allDone ? color : noneDone ? "rgba(255,255,255,0.2)" : color }}>
          {count}/{total}
        </span>
        {missing.length > 0 && <ChevronDown size={10} className="text-white/20" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />}
      </button>
      {/* Mini progress bar */}
      <div className="w-full bg-white/[0.04] rounded-full h-0.5 mx-auto" style={{ maxWidth: "60px" }}>
        <div className="h-0.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color, opacity: noneDone ? 0.2 : 1 }} />
      </div>
      {/* Expandable missing list */}
      {expanded && missing.length > 0 && (
        <div className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto">
          {missing.map((p: any) => (
            <div key={p.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-white/[0.02]">
              {p.images?.[0] && <img src={p.images[0]} alt="" className="w-4 h-4 rounded object-cover flex-shrink-0" />}
              <span className="text-[9px] text-white/40 truncate">{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionCard({ collection, onRFQ, onSampleRequest, onNavigate }: any) {
  const [open, setOpen] = useState(false);
  const products = (collection.plm_products || []).filter((p: any) => !p.killed);
  const factories = getAllFactories(products);
  const approvedCount = products.filter((p: any) =>
    (p.plm_factory_tracks || []).some((t: any) => t.status === "approved")
  ).length;

  return (
    <div className="border border-white/[0.06] rounded-2xl bg-white/[0.01] overflow-hidden">
      {/* Collection header */}
      <div className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
            <Layers size={13} className="text-white/40" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">{collection.name}</h3>
              {collection.season && <span className="text-[10px] text-white/25 bg-white/[0.04] px-2 py-0.5 rounded-full">{collection.season} {collection.year}</span>}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[11px] text-white/30">{products.length} products</span>
              {factories.length > 0 && <span className="text-[11px] text-white/25">{factories.length} factories</span>}
              {approvedCount > 0 && <span className="text-[11px] text-emerald-400">✓ {approvedCount} approved</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onRFQ(products.map((p: any) => p.id)); }}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:bg-pink-500/20 transition">
            RFQ
          </button>
          <button onClick={e => { e.stopPropagation(); onSampleRequest(products.map((p: any) => p.id)); }}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition">
            Samples
          </button>
          <button onClick={e => { e.stopPropagation(); onNavigate(collection.id); }}
            className="text-[10px] px-2.5 py-1 rounded-lg border border-white/[0.06] text-white/30 hover:text-white/60 transition">
            View All
          </button>
          <ChevronDown size={14} className="text-white/20 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
        </div>
      </div>

      {/* Expanded macro view */}
      {open && (
        <div className="border-t border-white/[0.04]">
          {products.length === 0 ? (
            <div className="px-6 py-8 text-center"><p className="text-xs text-white/20">No products in this collection</p></div>
          ) : factories.length === 0 ? (
            <div className="px-6 py-8 text-center"><p className="text-xs text-white/20">No factory tracks added yet</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ minWidth: `${200 + factories.length * 140}px` }}>
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="px-4 py-2.5 text-[10px] text-white/25 uppercase tracking-widest font-medium w-48">Stage</th>
                    {factories.map(f => (
                      <th key={f.id} className="px-3 py-2.5 text-[10px] text-white/50 font-semibold text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Factory size={9} className="text-white/30" />
                          {f.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TRACK_STAGES.map(stageDef => (
                    <tr key={stageDef.key} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: stageDef.color, opacity: 0.6 }} />
                          <span className="text-[11px] text-white/50">{stageDef.label}</span>
                        </div>
                      </td>
                      {factories.map(f => (
                        <td key={f.id} className="px-3 py-2">
                          <FactoryStageCell
                            products={products}
                            factoryId={f.id}
                            stageKey={stageDef.key}
                            color={stageDef.color}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
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
        <CollectionCard
          key={collection.id}
          collection={collection}
          factories={factories}
          onRFQ={onRFQ}
          onSampleRequest={onSampleRequest}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}
