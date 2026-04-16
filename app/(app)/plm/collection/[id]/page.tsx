"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Layers, Factory, ChevronDown, FileSpreadsheet, Plus, X, Loader2 } from "lucide-react";

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

function StageCell({ products, factoryId, stageKey, color, onNoteProduct }: any) {
  const [expanded, setExpanded] = useState(false);
  const { done, notDone, total } = getStageInfo(products, factoryId, stageKey);
  const count = done.length;
  const allDone = count === total;
  const noneDone = count === 0;

  return (
    <div>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-white/[0.04] transition">
        <span className="text-xs font-bold" style={{ color: allDone ? color : noneDone ? "rgba(255,255,255,0.15)" : color }}>
          {count}/{total}
        </span>
        <ChevronDown size={9} className="text-white/20 flex-shrink-0"
          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      <div className="w-full bg-white/[0.04] rounded-full h-0.5 mx-auto mb-1" style={{ maxWidth: "60px" }}>
        <div className="h-0.5 rounded-full transition-all"
          style={{ width: `${(count/total)*100}%`, background: color, opacity: noneDone ? 0.15 : 1 }} />
      </div>
      {expanded && (
        <div className="mt-1 space-y-px max-h-48 overflow-y-auto">
          {done.map((p: any) => (
            <button key={p.id} onClick={() => onNoteProduct(p)}
              className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/[0.04] transition text-left">
              {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-4 h-4 rounded object-cover flex-shrink-0" />
                : <div className="w-4 h-4 rounded bg-white/[0.06] flex-shrink-0" />}
              <span className="text-[9px] truncate font-medium" style={{ color }}>✓ {p.name}</span>
            </button>
          ))}
          {notDone.map((p: any) => (
            <button key={p.id} onClick={() => !p._noTrack && onNoteProduct(p)}
              className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/[0.04] transition text-left">
              {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-4 h-4 rounded object-cover flex-shrink-0 opacity-40" />
                : <div className="w-4 h-4 rounded bg-white/[0.04] flex-shrink-0" />}
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
  const [allFactories, setAllFactories] = useState<any[]>([]);
  const [noteProduct, setNoteProduct] = useState<any>(null);
  const [bulkDisqualifyModal, setBulkDisqualifyModal] = useState<{ factory: any } | null>(null);
  const [bulkDisqualifyReason, setBulkDisqualifyReason] = useState("price");
  const [bulkDisqualifyNote, setBulkDisqualifyNote] = useState("");
  const [bulkDisqualifying, setBulkDisqualifying] = useState(false);
  const [bulkDisqualifyProducts, setBulkDisqualifyProducts] = useState<string[]>([]);
  const [showRfqModal, setShowRfqModal] = useState(false);
  const [rfqProductIds, setRfqProductIds] = useState<string[]>([]);
  const [rfqInclude, setRfqInclude] = useState<string[]>(["name","sku","description","specs","images"]);
  const [rfqAskFor, setRfqAskFor] = useState<string[]>(["price","moq","lead_time","sample_lead_time","payment_terms"]);
  const [creatingRfq, setCreatingRfq] = useState(false);
  const [rfqDone, setRfqDone] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [sampleProductIds, setSampleProductIds] = useState<string[]>([]);
  const [sampleNote, setSampleNote] = useState("");
  const [requestingSamples, setRequestingSamples] = useState(false);
  const [sampleSelections, setSampleSelections] = useState<Record<string, string[]>>({});
  const [expandedSampleProducts, setExpandedSampleProducts] = useState<string[]>([]);

  const load = () => {
    Promise.all([
      fetch("/api/plm/collection/" + id).then(r => r.json()),
      fetch("/api/catalog?type=factories").then(r => r.json()),
    ]).then(([d, catData]) => {
      setCollection(d.collection);
      setAllFactories(catData.factories || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [id]);

  const handleBulkDisqualify = async () => {
    if (!bulkDisqualifyModal) return;
    setBulkDisqualifying(true);
    const f = bulkDisqualifyModal.factory;
    const prods = collection?.plm_products || [];
    for (const pid of bulkDisqualifyProducts) {
      const product = prods.find((p: any) => p.id === pid);
      const track = (product?.plm_factory_tracks || []).find((t: any) => t.factory_id === f.id);
      if (!track) continue;
      await fetch("/api/plm/tracks", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disqualify_track", track_id: track.id, reason: bulkDisqualifyReason, note: bulkDisqualifyNote, product_name: product.name, factory_name: f.name, factory_email: f.email, contact_name: f.contact_name }) });
    }
    setBulkDisqualifying(false);
    setBulkDisqualifyModal(null);
    load();
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 size={20} className="animate-spin text-white/20" /></div>;
  if (!collection) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><p className="text-white/30">Collection not found</p></div>;

  const products = (collection.plm_products || []).filter((p: any) => !p.killed);
  const factories = getAllFactories(products);
  const approvedCount = products.filter((p: any) => (p.plm_factory_tracks || []).some((t: any) => t.status === "approved")).length;
  const actionCount = products.filter((p: any) => p.action_status === "action_required").length;

  const openRfq = () => { setRfqProductIds(products.map((p: any) => p.id)); setRfqDone(false); setShowRfqModal(true); };
  const openSamples = () => {
    const ids = products.map((p: any) => p.id);
    setSampleProductIds(ids);
    const sel: Record<string, string[]> = {};
    ids.forEach((pid: string) => { sel[pid] = allFactories.map((f: any) => f.id); });
    setSampleSelections(sel);
    setShowSampleModal(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

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
            {noteProduct.notes && <div><p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Notes</p><p className="text-xs text-white/60 leading-relaxed">{noteProduct.notes}</p></div>}
            {noteProduct.factory_notes && <div><p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Factory Notes</p><p className="text-xs text-white/60 leading-relaxed">{noteProduct.factory_notes}</p></div>}
            {!noteProduct.notes && !noteProduct.factory_notes && <p className="text-xs text-white/20 italic">No notes</p>}
            <button onClick={() => { setNoteProduct(null); router.push(`/plm/${noteProduct.id}`); }} className="w-full py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60 text-xs hover:text-white/80 transition">Open Product →</button>
          </div>
        </div>
      )}

      {bulkDisqualifyModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Disqualify {bulkDisqualifyModal.factory.name}</p>
                <p className="text-xs text-white/40 mt-0.5">Select products and send email notifications</p>
              </div>
              <button onClick={() => setBulkDisqualifyModal(null)} className="text-white/30 hover:text-white/60 text-lg">✕</button>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Reason</p>
              <div className="grid grid-cols-3 gap-2">
                {[{ key: "price", label: "Price", icon: "💰" }, { key: "speed", label: "Speed", icon: "⏱" }, { key: "quality", label: "Quality", icon: "⚠️" }].map(r => (
                  <button key={r.key} onClick={() => setBulkDisqualifyReason(r.key)}
                    className={`py-2.5 rounded-xl border text-xs font-semibold transition ${bulkDisqualifyReason === r.key ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-white/[0.06] text-white/40 hover:border-white/20"}`}>
                    {r.icon} {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Select Products</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {products.filter((p: any) => (p.plm_factory_tracks || []).some((t: any) => t.factory_id === bulkDisqualifyModal.factory.id && t.status === "active")).map((p: any) => (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.03] cursor-pointer">
                    <input type="checkbox" checked={bulkDisqualifyProducts.includes(p.id)}
                      onChange={e => setBulkDisqualifyProducts(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))}
                      className="accent-red-500" />
                    <span className="text-xs text-white/60">{p.name}</span>
                    {p.sku && <span className="text-[10px] text-white/25 ml-1">{p.sku}</span>}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Internal Note (optional)</p>
              <textarea value={bulkDisqualifyNote} onChange={e => setBulkDisqualifyNote(e.target.value)} rows={2}
                placeholder="Saved to factory tracks only, not sent in email..."
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-white/60 placeholder-white/20 text-xs focus:outline-none resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleBulkDisqualify} disabled={bulkDisqualifying || bulkDisqualifyProducts.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold disabled:opacity-40">
                {bulkDisqualifying ? <Loader2 size={13} className="animate-spin" /> : null}
                {bulkDisqualifying ? "Sending..." : `Disqualify & Email ${bulkDisqualifyProducts.length} Products`}
              </button>
              <button onClick={() => setBulkDisqualifyModal(null)} className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-white/40 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showRfqModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4 my-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">RFQ — {collection.name}</p>
              <button onClick={() => setShowRfqModal(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
            <p className="text-xs text-white/40">{rfqProductIds.length} products from this collection</p>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Include in sheet</p>
              <div className="grid grid-cols-2 gap-2">
                {[["name","Product Name"],["sku","SKU"],["description","Description"],["specs","Specifications"],["images","Image URLs"],["category","Category"],["notes","Notes"]].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={rfqInclude.includes(key)} onChange={e => setRfqInclude((prev: string[]) => e.target.checked ? [...prev, key] : prev.filter((k: string) => k !== key))} />
                    <span className="text-xs text-white/60">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Ask factories to fill in</p>
              <div className="grid grid-cols-2 gap-2">
                {[["price","Unit Price"],["moq","MOQ"],["lead_time","Lead Time"],["sample_lead_time","Sample Lead Time"],["payment_terms","Payment Terms"],["sample_price","Sample Price"],["packaging","Packaging"],["notes","Notes/Comments"]].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={rfqAskFor.includes(key)} onChange={e => setRfqAskFor((prev: string[]) => e.target.checked ? [...prev, key] : prev.filter((k: string) => k !== key))} />
                    <span className="text-xs text-white/60">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            {rfqDone && <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3"><span className="text-xs text-emerald-300">✓ RFQ created! Check Workflows → Factory Quote.</span></div>}
            <div className="flex gap-2">
              <button onClick={async () => {
                setCreatingRfq(true);
                const res = await fetch("/api/plm/rfq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_ids: rfqProductIds, include: rfqInclude, ask_for: rfqAskFor }) });
                const data = await res.json();
                if (data.file_base64) {
                  const bytes = Uint8Array.from(atob(data.file_base64), c => c.charCodeAt(0));
                  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = data.file_name || "RFQ.xlsx"; a.click();
                  URL.revokeObjectURL(url);
                }
                setCreatingRfq(false); setRfqDone(true);
              }} disabled={creatingRfq} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-pink-500 text-white text-xs font-semibold disabled:opacity-40">
                {creatingRfq ? <Loader2 size={11} className="animate-spin" /> : <FileSpreadsheet size={11} />}
                {creatingRfq ? "Creating..." : `Create RFQ for ${rfqProductIds.length} Products`}
              </button>
              <button onClick={() => setShowRfqModal(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showSampleModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-xl p-6 space-y-4 my-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Request Samples — {collection.name}</p>
              <button onClick={() => setShowSampleModal(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
            </div>
            <p className="text-xs text-white/40">{sampleProductIds.length} products · all factories pre-selected.</p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {sampleProductIds.map(pid => {
                const p = products.find((pr: any) => pr.id === pid);
                if (!p) return null;
                const sel = sampleSelections[pid] || allFactories.map((f: any) => f.id);
                const isExpanded = expandedSampleProducts.includes(pid);
                return (
                  <div key={pid} className="border border-white/[0.06] rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpandedSampleProducts(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid])}>
                      {p.images?.[0] && <img src={p.images[0]} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />}
                      <span className="text-xs font-medium text-white/70 flex-1">{p.name}</span>
                      <span className="text-[9px] text-white/30">{sel.length}/{allFactories.length} factories</span>
                      <button onClick={e => { e.stopPropagation(); setSampleProductIds(prev => prev.filter(id => id !== pid)); }} className="text-white/20 hover:text-red-400 text-xs ml-2">×</button>
                    </div>
                    {isExpanded && (
                      <div className="flex flex-wrap gap-1.5 pl-8">
                        {allFactories.map((f: any) => (
                          <button key={f.id} onClick={() => setSampleSelections(prev => ({ ...prev, [pid]: sel.includes(f.id) ? sel.filter((fid: string) => fid !== f.id) : [...sel, f.id] }))}
                            className={`text-[10px] px-2 py-0.5 rounded border transition ${sel.includes(f.id) ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-white/[0.06] text-white/25"}`}>
                            {f.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Note (optional)</p>
              <textarea value={sampleNote} onChange={e => setSampleNote(e.target.value)} rows={2} placeholder="e.g. Priority samples needed by May 1st"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={async () => {
                setRequestingSamples(true);
                for (const pid of sampleProductIds) {
                  const factoryIds = sampleSelections[pid] || allFactories.map((f: any) => f.id);
                  if (!factoryIds.length) continue;
                  await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_sample_requests", product_id: pid, factory_ids: factoryIds, note: sampleNote, provider: "gmail" }) });
                }
                setRequestingSamples(false); setShowSampleModal(false); setSampleNote("");
              }} disabled={requestingSamples || sampleProductIds.length === 0} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 text-black text-xs font-semibold disabled:opacity-40">
                {requestingSamples ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                {requestingSamples ? "Requesting..." : `Request for ${sampleProductIds.length} Products`}
              </button>
              <button onClick={() => setShowSampleModal(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={openRfq} className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-pink-500 text-white font-semibold hover:bg-pink-400 transition">
                <FileSpreadsheet size={11} />RFQ Collection
              </button>
              <button onClick={openSamples} className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition">
                <Plus size={11} />Request Samples
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 space-y-8 max-w-full overflow-x-auto">
        {factories.length > 0 && (
          <div>
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Factory Progress</p>
            <table className="w-full text-left" style={{ minWidth: `${220 + factories.length * 140}px` }}>
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                  <th className="px-5 py-3 text-[10px] text-white/25 uppercase tracking-widest font-medium w-48">Stage</th>
                  {factories.map((f: any) => {
                    const factoryActiveProducts = products.filter((p: any) => (p.plm_factory_tracks || []).some((t: any) => t.factory_id === f.id && t.status === "active" && (t.plm_track_stages || []).some((s: any) => s.stage === "sample_requested" && s.status === "done")));
                    return (
                      <th key={f.id} className="px-3 py-3 text-[10px] text-white/50 font-semibold text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="flex items-center gap-1">
                            <Factory size={9} className="text-white/30" />
                            <span className="truncate max-w-[120px]">{f.name}</span>
                          </div>
                          {factoryActiveProducts.length > 0 && (
                            <button onClick={() => { setBulkDisqualifyProducts(factoryActiveProducts.map((p: any) => p.id)); setBulkDisqualifyReason("price"); setBulkDisqualifyNote(""); setBulkDisqualifyModal({ factory: f }); }}
                              className="text-[8px] px-1.5 py-0.5 rounded border border-red-500/20 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition">
                              Disqualify
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
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
                        <StageCell products={products} factoryId={f.id} stageKey={stageDef.key} color={stageDef.color} onNoteProduct={setNoteProduct} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t-2 border-white/[0.06]">
                  <td className="px-5 py-2"><span className="text-[10px] text-white/25 uppercase tracking-widest font-medium">Outcomes</span></td>
                  {factories.map((f: any) => <td key={f.id} />)}
                </tr>
                {OUTCOMES.map(outcome => (
                  <tr key={outcome.key} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition">
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
          <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">All Products ({products.length})</p>
          <div className="grid grid-cols-1 gap-2">
            {products.map((p: any) => {
              const approvedTrack = (p.plm_factory_tracks || []).find((t: any) => t.status === "approved");
              const activeFactories = (p.plm_factory_tracks || []).filter((t: any) => t.status === "active").length;
              const killedFactories = (p.plm_factory_tracks || []).filter((t: any) => t.status === "killed").length;
              return (
                <div key={p.id} className="flex items-center gap-4 border border-white/[0.06] rounded-xl px-4 py-3 bg-white/[0.01] hover:border-white/10 transition">
                  {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/[0.06]" /> : <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/[0.06] flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-white">{p.name}</span>
                      {p.sku && <span className="text-[10px] text-white/30 font-mono">{p.sku}</span>}
                      {approvedTrack && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">✓ {approvedTrack.factory_catalog?.name}{approvedTrack.approved_price ? ` · $${approvedTrack.approved_price}` : ""}</span>}
                      {p.action_status === "action_required" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">⚡ Action</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {activeFactories > 0 && <span className="text-[10px] text-white/25">{activeFactories} active {activeFactories === 1 ? "factory" : "factories"}</span>}
                      {killedFactories > 0 && <span className="text-[10px] text-red-400/40">{killedFactories} discontinued</span>}
                      {p.notes && <span className="text-[10px] text-white/20 truncate max-w-xs">{p.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => setNoteProduct(p)} className="text-[9px] px-2 py-1 rounded border border-white/[0.06] text-white/25 hover:text-white/60 transition">Notes</button>
                    <button onClick={() => router.push(`/plm/${p.id}`)} className="text-[9px] px-2 py-1 rounded border border-white/[0.06] text-white/25 hover:text-white/60 transition">Open →</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
