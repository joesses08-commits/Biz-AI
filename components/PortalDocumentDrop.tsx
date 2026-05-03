"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { X, FileText, Loader2, CheckCircle, AlertCircle, Upload, Pencil, Trash2 } from "lucide-react";

type DropState = "idle" | "identifying" | "confirming" | "executing" | "done" | "error";

const DOC_TYPE_LABELS: Record<string, string> = {
  factory_quote: "Factory Quote",
  purchase_order: "Purchase Order",
  sample_feedback: "Sample Feedback",
  product_import: "Product Import Sheet",
  unknown: "Unknown Document",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  factory_quote: "#3b82f6",
  purchase_order: "#10b981",
  sample_feedback: "#f59e0b",
  product_import: "#8b5cf6",
  unknown: "#6b7280",
};

export default function PortalDocumentDrop({ token }: { token: string }) {
  const [dropState, setDropState] = useState<DropState>("idle");
  const [identified, setIdentified] = useState<any>(null);
  const [resultMessage, setResultMessage] = useState("");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelDragging, setPanelDragging] = useState(false);
  const [userHint, setUserHint] = useState("");
  const [editingProduct, setEditingProduct] = useState<{ index: number; data: any } | null>(null);
  const [factories, setFactories] = useState<any[]>([]);
  const fileDataRef = useRef<{ base64: string; name: string; type: string } | null>(null);
  const dragCounterRef = useRef(0);

  const processFile = useCallback(async (file: File, hint?: string) => {
    setFileName(file.name);
    setDropState("identifying");
    setError("");

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    fileDataRef.current = { base64, name: file.name, type: file.type };

    const res = await fetch("/api/portal/doc-drop", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({
        action: "identify",
        file_base64: base64,
        file_name: file.name,
        file_type: file.type,
        user_hint: hint || userHint || "",
      }),
    });
    const data = await res.json();

    if (!data.success || !data.identified) {
      setError("Could not identify this document. Try again.");
      setDropState("error");
      return;
    }

    setIdentified(data.identified);
    setDropState("confirming");
    try {
      const fr = await fetch("/api/plm?type=factories", { headers: { Authorization: "Bearer " + token } });
      const fd = await fr.json();
      setFactories(fd.factories || []);
    } catch {}
  }, [userHint, token]);

  const execute = async () => {
    if (!identified || !fileDataRef.current) return;
    setDropState("executing");

    const res = await fetch("/api/portal/doc-drop", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({
        action: "execute",
        doc_type: identified.doc_type,
        factory_id: identified.factory_id,
        factory_name: identified.factory_name,
        rfq_job_id: identified.rfq_job_id,
        extracted_data: identified.extracted_data,
        file_name: fileDataRef.current.name,
        file_base64: fileDataRef.current.base64,
      }),
    });
    const data = await res.json();

    if (data.success) {
      setResultMessage(data.message);
      setDropState("done");
    } else {
      setError(data.error || "Something went wrong");
      setDropState("error");
    }
  };

  const reset = () => {
    setDropState("idle");
    setIdentified(null);
    setResultMessage("");
    setError("");
    setFileName("");
    setUserHint("");
    setEditingProduct(null);
    fileDataRef.current = null;
    dragCounterRef.current = 0;
  };

  const deleteProduct = (index: number) => {
    setIdentified((prev: any) => ({
      ...prev,
      extracted_data: {
        ...prev.extracted_data,
        products: prev.extracted_data.products.filter((_: any, i: number) => i !== index),
      },
    }));
  };

  const saveProductEdit = () => {
    if (!editingProduct) return;
    setIdentified((prev: any) => {
      const products = [...prev.extracted_data.products];
      products[editingProduct.index] = editingProduct.data;
      return { ...prev, extracted_data: { ...prev.extracted_data, products } };
    });
    setEditingProduct(null);
  };

  useEffect(() => {
    const prevent = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const color = identified ? (DOC_TYPE_COLORS[identified.doc_type] || "#6b7280") : "#6b7280";

  return (
    <>
      {dropState === "idle" && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-stretch">
          {panelOpen && (
            <div className="bg-bg-surface border border-blue-500/30 border-r-0 rounded-l-2xl w-72 shadow-2xl flex flex-col">
              <div className="p-4 space-y-3 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center">
                      <Upload size={10} className="text-blue-400" />
                    </div>
                    <p className="text-xs font-semibold text-text-secondary">Document Detector</p>
                  </div>
                  <button onClick={() => setPanelOpen(false)} className="text-text-muted hover:text-text-secondary">
                    <X size={12} />
                  </button>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Drop a factory quote, PO, sample feedback, or product sheet — Jimmy reads it and wires it in.
                </p>
                <div>
                  <p className="text-[10px] text-text-muted mb-1">Add a hint (optional)</p>
                  <input
                    value={userHint}
                    onChange={e => setUserHint(e.target.value)}
                    placeholder='e.g. "from Fred Factory"' 
                    className="w-full bg-bg-elevated border border-bg-border rounded-lg px-2.5 py-1.5 text-[11px] text-text-secondary placeholder-text-muted focus:outline-none focus:border-blue-500/30"
                  />
                </div>
                <label
                  onDragOver={e => { e.preventDefault(); setPanelDragging(true); }}
                  onDragLeave={() => setPanelDragging(false)}
                  onDrop={async e => {
                    e.preventDefault(); setPanelDragging(false); setPanelOpen(false);
                    const file = e.dataTransfer?.files?.[0];
                    if (file) await processFile(file, userHint);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition ${panelDragging ? "border-blue-400/60 bg-blue-500/10" : "border-bg-border hover:border-blue-500/30 hover:bg-blue-500/[0.04]"}`}>
                  <Upload size={20} className={panelDragging ? "text-blue-400" : "text-text-muted"} />
                  <span className="text-[11px] text-text-muted text-center leading-relaxed">Drop file here<br />or click to browse</span>
                  <input type="file" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) { setPanelOpen(false); await processFile(file, userHint); }
                    e.target.value = "";
                  }} />
                </label>
                <div className="flex flex-wrap gap-1">
                  {["Factory Quote", "Purchase Order", "Sample Feedback", "Product Sheet"].map(tag => (
                    <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400/70 border border-blue-500/20">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
          <button onClick={() => setPanelOpen(!panelOpen)}
            className="flex flex-col items-center justify-center gap-2 w-7 bg-blue-600 hover:bg-blue-500 transition rounded-l-xl py-6 shadow-lg flex-shrink-0">
            <Upload size={12} className="text-white" />
            <span className="text-white text-[9px] font-bold tracking-wide" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              Doc Detector
            </span>
          </button>
        </div>
      )}

      {dropState !== "idle" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>

          {dropState === "identifying" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 size={32} className="animate-spin text-blue-400" />
              <p className="text-white/60 text-sm">Analyzing {fileName}...</p>
            </div>
          )}

          {dropState === "confirming" && identified && (
            <div className="bg-bg-elevated border border-white/10 rounded-2xl w-full max-w-xl mx-4 flex flex-col" style={{ maxHeight: "85vh" }}>
              
              {/* Header */}
              <div className="p-6 border-b border-white/[0.06] flex items-start justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                    <FileText size={18} style={{ color }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{DOC_TYPE_LABELS[identified.doc_type]}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{fileName}</p>
                  </div>
                </div>
                <button onClick={reset} className="text-white/30 hover:text-white/60"><X size={16} /></button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 p-6 space-y-5">

                {/* Confidence + factory */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${identified.confidence === "high" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : identified.confidence === "medium" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "bg-red-500/15 text-red-400 border border-red-500/20"}`}>
                    {identified.confidence} confidence
                  </span>
                  {identified.factory_name && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60 border border-white/[0.08] font-medium">
                      {identified.factory_name}
                    </span>
                  )}
                </div>

                <p className="text-base leading-relaxed font-medium" style={{ color: "var(--text-secondary)" }}>{identified.confirmation_message}</p>

                {/* Factory dropdown — hide for product import */}
                {identified.doc_type !== "product_import" && <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Factory</p>
                  <select
                    value={identified.factory_name || ""}
                    onChange={e => {
                      const selected = factories.find((f: any) => f.name === e.target.value);
                      setIdentified((prev: any) => ({ ...prev, factory_name: e.target.value, factory_id: selected?.id || prev.factory_id }));
                    }}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}>
                    <option value="">— Select factory —</option>
                    {factories.map((f: any) => (
                      <option key={f.id} value={f.name}>{f.name}</option>
                    ))}
                    {identified.factory_name && !factories.find((f: any) => f.name === identified.factory_name) && (
                      <option value={identified.factory_name}>{identified.factory_name} (detected)</option>
                    )}
                  </select>
                </div>}

                {/* Products list */}
                {identified.extracted_data?.products?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Products being wired in</p>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{identified.extracted_data.products.length} items</span>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
                      {identified.extracted_data.products.map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.04] last:border-0 group">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded-lg object-cover border border-bg-border flex-shrink-0" />
                          ) : identified.doc_type === "product_import" ? (
                            <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 text-center leading-tight" style={{ background: "var(--bg-elevated)", border: "1px dashed var(--bg-border)", color: "var(--text-muted)", fontSize: "9px", padding: "4px" }}>
                              Image will be uploaded in PLM
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: "var(--bg-elevated)", border: "1px solid var(--bg-border)" }} />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{p.name || p.sku || "Unknown product"}</p>
                            <div className="flex items-center gap-2">
                              {p.sku && <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{p.sku}</p>}
                              {p.moq && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>MOQ {p.moq}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {p.price && <span className="text-sm font-bold text-emerald-400">${p.price}</span>}
                            <button
                              onClick={() => setEditingProduct({ index: i, data: { ...p } })}
                              className="p-1 rounded-lg text-white/20 hover:text-blue-400 hover:bg-blue-500/10 transition opacity-0 group-hover:opacity-100">
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => deleteProduct(i)}
                              className="p-1 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer buttons */}
              <div className="p-6 border-t border-white/[0.06] flex gap-2 flex-shrink-0">
                <button onClick={execute}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition"
                  style={{ background: color }}>
                  Confirm & Wire In
                </button>
                <button onClick={reset} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-sm hover:text-white/60 transition">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Per-product edit modal */}
          {editingProduct && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
              <div className="bg-bg-elevated border border-white/10 rounded-2xl w-full max-w-sm mx-4 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">Edit Product</p>
                  <button onClick={() => setEditingProduct(null)} className="text-white/30 hover:text-white/60"><X size={16} /></button>
                </div>

                {editingProduct.data.image_url && (
                  <img src={editingProduct.data.image_url} alt={editingProduct.data.name} className="w-full h-32 object-contain rounded-xl border border-white/[0.06] bg-white/[0.02]" />
                )}

                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Product Name</p>
                    <input value={editingProduct.data.name || ""} onChange={e => setEditingProduct(p => p ? { ...p, data: { ...p.data, name: e.target.value } } : null)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">SKU</p>
                    <input value={editingProduct.data.sku || ""} onChange={e => setEditingProduct(p => p ? { ...p, data: { ...p.data, sku: e.target.value } } : null)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 font-mono focus:outline-none focus:border-white/20" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Price ($)</p>
                    <input value={editingProduct.data.price || ""} onChange={e => setEditingProduct(p => p ? { ...p, data: { ...p.data, price: e.target.value } } : null)}
                      type="number" step="0.01"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-emerald-400 font-bold focus:outline-none focus:border-white/20" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">MOQ</p>
                    <input value={editingProduct.data.moq || ""} onChange={e => setEditingProduct(p => p ? { ...p, data: { ...p.data, moq: e.target.value } } : null)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Description</p>
                    <textarea value={editingProduct.data.description || ""} onChange={e => setEditingProduct(p => p ? { ...p, data: { ...p.data, description: e.target.value } } : null)}
                      rows={2} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/20 resize-none" />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={saveProductEdit} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition">
                    Save Changes
                  </button>
                  <button onClick={() => setEditingProduct(null)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-sm hover:text-white/60 transition">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {dropState === "executing" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 size={32} className="animate-spin text-blue-400" />
              <p className="text-white/60 text-sm">Wiring it into Jimmy...</p>
            </div>
          )}

          {dropState === "done" && (
            <div className="bg-bg-elevated border border-emerald-500/20 rounded-2xl w-full max-w-sm p-6 mx-4 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle size={24} className="text-emerald-400" />
                <p className="text-sm font-semibold text-white">Done!</p>
              </div>
              <p className="text-sm text-white/60">{resultMessage}</p>
              <button onClick={reset} className="w-full py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60 text-sm hover:text-white/80 transition">
                Close
              </button>
            </div>
          )}

          {dropState === "error" && (
            <div className="bg-bg-elevated border border-red-500/20 rounded-2xl w-full max-w-sm p-6 mx-4 space-y-4">
              <div className="flex items-center gap-3">
                <AlertCircle size={24} className="text-red-400" />
                <p className="text-sm font-semibold text-white">Something went wrong</p>
              </div>
              <p className="text-sm text-white/60">{error}</p>
              <button onClick={reset} className="w-full py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60 text-sm hover:text-white/80 transition">
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
