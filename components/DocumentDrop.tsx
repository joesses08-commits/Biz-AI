"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { X, FileText, Loader2, CheckCircle, AlertCircle, Upload } from "lucide-react";

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

export default function DocumentDrop() {
  const [dropState, setDropState] = useState<DropState>("idle");
  const [identified, setIdentified] = useState<any>(null);
  const [resultMessage, setResultMessage] = useState("");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelDragging, setPanelDragging] = useState(false);
  const [userHint, setUserHint] = useState("");
  const fileDataRef = useRef<{ base64: string; name: string; type: string } | null>(null);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dropState === "idle") setDropState("dragging");
  }, [dropState]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setDropState("idle");
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => { e.preventDefault(); }, []);

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

    const res = await fetch("/api/plm/document-drop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  }, [userHint]);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    const file = e.dataTransfer?.files?.[0];
    if (!file) { setDropState("idle"); return; }
    await processFile(file);
  }, [processFile]);

  useEffect(() => {
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  const execute = async () => {
    if (!identified || !fileDataRef.current) return;
    setDropState("executing");

    const res = await fetch("/api/plm/document-drop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "execute",
        doc_type: identified.doc_type,
        factory_id: identified.factory_id,
        factory_name: identified.factory_name,
        rfq_job_id: identified.rfq_job_id,
        extracted_data: identified.extracted_data,
        file_name: fileDataRef.current.name,
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
    fileDataRef.current = null;
    dragCounterRef.current = 0;
  };

  const color = identified ? (DOC_TYPE_COLORS[identified.doc_type] || "#6b7280") : "#6b7280";

  return (
    <>
      {/* ── Side panel strip (always visible) ── */}
      {dropState === "idle" && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-stretch">
          {panelOpen && (
            <div className="bg-[#0d1117] border border-blue-500/30 border-r-0 rounded-l-2xl w-72 shadow-2xl flex flex-col">
              <div className="p-4 space-y-3 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-blue-500/20 flex items-center justify-center">
                      <Upload size={10} className="text-blue-400" />
                    </div>
                    <p className="text-xs font-semibold text-white/80">Document Detector</p>
                  </div>
                  <button onClick={() => setPanelOpen(false)} className="text-white/30 hover:text-white/60">
                    <X size={12} />
                  </button>
                </div>

                <p className="text-[10px] text-white/30 leading-relaxed">
                  Drop a factory quote, PO, sample feedback, or product sheet — Jimmy reads it and wires it in.
                </p>

                {/* Optional hint input */}
                <div>
                  <p className="text-[10px] text-white/25 mb-1">Add a hint (optional)</p>
                  <input
                    value={userHint}
                    onChange={e => setUserHint(e.target.value)}
                    placeholder='e.g. "from Fred Factory" or "Christmas collection"'
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px] text-white/60 placeholder-white/20 focus:outline-none focus:border-blue-500/30"
                  />
                </div>

                {/* Drop zone */}
                <label
                  onDragOver={e => { e.preventDefault(); setPanelDragging(true); }}
                  onDragLeave={() => setPanelDragging(false)}
                  onDrop={async e => {
                    e.preventDefault();
                    setPanelDragging(false);
                    setPanelOpen(false);
                    const file = e.dataTransfer?.files?.[0];
                    if (file) await processFile(file, userHint);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition ${panelDragging ? "border-blue-400/60 bg-blue-500/10" : "border-white/[0.08] hover:border-blue-500/30 hover:bg-blue-500/[0.04]"}`}>
                  <Upload size={20} className={panelDragging ? "text-blue-400" : "text-white/20"} />
                  <span className="text-[11px] text-white/30 text-center leading-relaxed">Drop file here<br />or click to browse</span>
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

          {/* Blue tab */}
          <button onClick={() => setPanelOpen(!panelOpen)}
            className="flex flex-col items-center justify-center gap-2 w-7 bg-blue-600 hover:bg-blue-500 transition rounded-l-xl py-6 shadow-lg flex-shrink-0">
            <Upload size={12} className="text-white" />
            <span className="text-white text-[9px] font-bold tracking-wide"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              Doc Detector
            </span>
          </button>
        </div>
      )}

      {/* ── Modal overlay ── */}
      {dropState !== "idle" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>

          {dropState === "identifying" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 size={32} className="animate-spin text-blue-400" />
              <p className="text-white/60 text-sm">Analyzing {fileName}...</p>
            </div>
          )}

          {dropState === "confirming" && identified && (
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5 mx-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                    <FileText size={18} style={{ color }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{DOC_TYPE_LABELS[identified.doc_type]}</p>
                    <p className="text-[11px] text-white/40">{fileName}</p>
                  </div>
                </div>
                <button onClick={reset} className="text-white/30 hover:text-white/60"><X size={16} /></button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${identified.confidence === "high" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : identified.confidence === "medium" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "bg-red-500/15 text-red-400 border border-red-500/20"}`}>
                  {identified.confidence} confidence
                </span>
                {identified.factory_name && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 border border-white/[0.08]">
                    {identified.factory_name}
                  </span>
                )}
              </div>

              <p className="text-sm text-white/70 leading-relaxed">{identified.confirmation_message}</p>

              {/* Editable factory override */}
              {!identified.factory_name && (
                <div>
                  <p className="text-[10px] text-white/30 mb-1">Which factory is this from?</p>
                  <input
                    placeholder="Factory name..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/60 placeholder-white/20 focus:outline-none focus:border-white/20"
                    onChange={e => setIdentified((prev: any) => ({ ...prev, factory_name: e.target.value }))}
                  />
                </div>
              )}

              {identified.extracted_data?.products?.length > 0 && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-1.5 max-h-36 overflow-y-auto">
                  {identified.extracted_data.products.slice(0, 6).map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-white/60 truncate flex-1">{p.name || p.sku}</span>
                      {p.price && <span className="text-emerald-400 flex-shrink-0 ml-2">${p.price}</span>}
                    </div>
                  ))}
                  {identified.extracted_data.products.length > 6 && (
                    <p className="text-[10px] text-white/30">+{identified.extracted_data.products.length - 6} more</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
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

          {dropState === "executing" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 size={32} className="animate-spin text-blue-400" />
              <p className="text-white/60 text-sm">Wiring it into Jimmy...</p>
            </div>
          )}

          {dropState === "done" && (
            <div className="bg-[#111] border border-emerald-500/20 rounded-2xl w-full max-w-sm p-6 mx-4 space-y-4">
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
            <div className="bg-[#111] border border-red-500/20 rounded-2xl w-full max-w-sm p-6 mx-4 space-y-4">
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
