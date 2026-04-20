"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, ArrowLeft, Layers, Check, Loader2, Plus, ChevronRight, Factory, X } from "lucide-react";

const PROGRESS_STAGES = [
  { key: "track_created", label: "Track Created" },
  { key: "artwork_sent", label: "Artwork Sent" },
  { key: "quote_requested", label: "Quote Req." },
  { key: "quote_received", label: "Quote Rec." },
  { key: "sample_requested", label: "Sample Req." },
  { key: "in_production", label: "In Production" },
  { key: "complete", label: "Complete" },
  { key: "shipped", label: "Shipped" },
  { key: "arrived", label: "Arrived" },
  { key: "reviewed", label: "Reviewed" },
];

function CollectionPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const [collection, setCollection] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
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
    setFactories(data.factories || []);
    setLoading(false);
  };

  // Build factory progress data
  const getFactoryProgress = () => {
    // Get all unique factories used in this collection's products
    const factoryMap: Record<string, { id: string; name: string; disqualified?: boolean }> = {};
    products.forEach(p => {
      (p.plm_factory_tracks || []).forEach((t: any) => {
        if (t.factory_catalog?.id) {
          factoryMap[t.factory_catalog.id] = {
            id: t.factory_catalog.id,
            name: t.factory_catalog.name,
            disqualified: t.status === "killed",
          };
        }
      });
    });
    const uniqueFactories = Object.values(factoryMap);

    // For each stage, count how many products have that stage done per factory
    const stageData: Record<string, Record<string, { done: number; total: number }>> = {};
    
    PROGRESS_STAGES.forEach(stage => {
      stageData[stage.key] = {};
      uniqueFactories.forEach(f => {
        stageData[stage.key][f.id] = { done: 0, total: 0 };
      });
    });

    products.forEach(p => {
      (p.plm_factory_tracks || []).forEach((t: any) => {
        const fid = t.factory_id;
        if (!fid) return;
        
        const stages = t.plm_track_stages || [];
        
        // Track created = track exists
        if (stageData["track_created"][fid]) {
          stageData["track_created"][fid].total++;
          stageData["track_created"][fid].done++;
        }
        
        // Map our track stages to the progress stages
        const stageMapping: Record<string, string> = {
          "artwork_sent": "artwork_sent",
          "quote_requested": "quote_requested",
          "quote_received": "quote_received",
          "sample_requested": "sample_requested",
          "sample_production": "in_production",
          "sample_complete": "complete",
          "sample_shipped": "shipped",
          "sample_arrived": "arrived",
          "sample_reviewed": "reviewed",
        };
        
        Object.entries(stageMapping).forEach(([trackStage, progressStage]) => {
          if (stageData[progressStage] && stageData[progressStage][fid]) {
            stageData[progressStage][fid].total++;
            const hasDone = stages.some((s: any) => s.stage === trackStage && s.status === "done");
            if (hasDone) stageData[progressStage][fid].done++;
          }
        });
      });
    });

    return { factories: uniqueFactories, stageData };
  };

  // Build outcomes data
  const getOutcomes = () => {
    const outcomes: { factoryId: string; factoryName: string; status: string; count: number }[] = [];
    const factoryOutcomes: Record<string, { approved: number; revision: number; killed: number }> = {};
    
    products.forEach(p => {
      (p.plm_factory_tracks || []).forEach((t: any) => {
        const fid = t.factory_id;
        const fname = t.factory_catalog?.name || "Factory";
        if (!factoryOutcomes[fid]) factoryOutcomes[fid] = { approved: 0, revision: 0, killed: 0 };
        
        if (t.status === "approved") factoryOutcomes[fid].approved++;
        else if (t.status === "killed") factoryOutcomes[fid].killed++;
      });
    });
    
    return factoryOutcomes;
  };

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

  const { factories: progressFactories, stageData } = getFactoryProgress();
  const totalProducts = products.length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4">
        <button onClick={() => router.push("/portal/dashboard?role=designer")} className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 mb-4">
          <ArrowLeft size={12} />Back to PLM
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Layers size={16} className="text-white/40" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{collection.name}</h1>
              <p className="text-xs text-white/40">{products.length} products · {progressFactories.length} factories</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition">
              <Package size={11} />RFQ Collection
            </button>
            <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition">
              <Plus size={11} />Request Samples
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-8">
        {/* Factory Progress Matrix */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-4">Factory Progress</p>
          
          {progressFactories.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-white/[0.06] rounded-2xl">
              <p className="text-xs text-white/20">No factories assigned yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] text-white/30 uppercase tracking-widest py-2 pr-4 w-32">Stage</th>
                    {progressFactories.map(f => (
                      <th key={f.id} className="text-center py-2 px-2 min-w-[100px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <Factory size={10} className="text-white/30" />
                          <span className="text-[11px] text-white/70 font-medium">{f.name}</span>
                        </div>
                        {f.disqualified && (
                          <span className="text-[9px] text-red-400/70">Disqualify</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PROGRESS_STAGES.map((stage, idx) => (
                    <tr key={stage.key} className={idx % 2 === 0 ? "bg-white/[0.01]" : ""}>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                          <span className="text-[11px] text-white/50">{stage.label}</span>
                        </div>
                      </td>
                      {progressFactories.map(f => {
                        const data = stageData[stage.key]?.[f.id] || { done: 0, total: totalProducts };
                        const isDone = data.done === totalProducts && totalProducts > 0;
                        const hasProgress = data.done > 0;
                        return (
                          <td key={f.id} className="py-2.5 px-2 text-center">
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium ${
                              isDone ? "bg-emerald-500/10 text-emerald-400" :
                              hasProgress ? "bg-amber-500/10 text-amber-400" :
                              "text-white/20"
                            }`}>
                              {hasProgress && (
                                <div className="w-full bg-white/10 rounded-full h-1 min-w-[40px] mr-1">
                                  <div className="h-1 rounded-full transition-all" 
                                    style={{ 
                                      width: `${(data.done / totalProducts) * 100}%`,
                                      background: isDone ? "#10b981" : "#f59e0b"
                                    }} />
                                </div>
                              )}
                              <span>{data.done}/{totalProducts}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Outcomes */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-4">Outcomes</p>
          <div className="grid grid-cols-3 gap-4">
            {progressFactories.map(f => {
              const tracks = products.flatMap(p => (p.plm_factory_tracks || []).filter((t: any) => t.factory_id === f.id));
              const approved = tracks.filter((t: any) => t.status === "approved").length;
              const killed = tracks.filter((t: any) => t.status === "killed").length;
              const pending = tracks.length - approved - killed;
              
              return (
                <div key={f.id} className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.01]">
                  <div className="flex items-center gap-2 mb-3">
                    <Factory size={12} className="text-white/30" />
                    <span className="text-xs font-semibold text-white">{f.name}</span>
                  </div>
                  <div className="space-y-1.5">
                    {approved > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-emerald-400">Approved</span>
                        <span className="text-[10px] text-emerald-400 font-semibold">{approved}</span>
                      </div>
                    )}
                    {pending > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/40">In Progress</span>
                        <span className="text-[10px] text-white/40">{pending}</span>
                      </div>
                    )}
                    {killed > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-red-400/70">Disqualified</span>
                        <span className="text-[10px] text-red-400/70">{killed}</span>
                      </div>
                    )}
                    {tracks.length === 0 && (
                      <p className="text-[10px] text-white/20">No tracks</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Products List */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-4">Products in Collection</p>
          <div className="grid grid-cols-1 gap-2">
            {products.map(product => (
              <div key={product.id}
                className="border border-white/[0.06] rounded-xl p-3 bg-white/[0.01] hover:border-white/10 transition cursor-pointer flex items-center gap-3"
                onClick={() => router.push(`/portal/designer-product?id=${product.id}`)}>
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt={product.name} className="w-8 h-8 rounded-lg object-cover border border-white/[0.06] flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{product.name}</p>
                  {product.sku && <p className="text-[10px] text-white/30 font-mono">{product.sku}</p>}
                </div>
                <ChevronRight size={14} className="text-white/20 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
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
