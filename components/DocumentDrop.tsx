"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { X, FileText, Loader2, CheckCircle, AlertCircle, Upload } from "lucide-react";

type DropState = "idle" | "dragging" | "identifying" | "confirming" | "executing" | "done" | "error";

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

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  const processFile = useCallback(async (file: File) => {
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
      body: JSON.stringify({ action: "identify", file_base64: base64, file_name: file.name, file_type: file.type }),
    });
    const data = await res.json();

    if (!data.success || !data.identified) {
      setError("Could not identify this document. Try again.");
      setDropState("error");
      return;
    }

    setIdentified(data.identified);
    setDropState("confirming");
  }, []);

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
    fileDataRef.current = null;
    dragCounterRef.current = 0;
  };

  if (dropState === "idle") return null;

  const color = identified ? (DOC_TYPE_COLORS[identified.doc_type] || "#6b7280") : "#6b7280";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>

      {/* Dismiss on background click (only in dragging state) */}
      {dropState === "dragging" && (
        <div className="absolute inset-0" onClick={reset} />
      )}

      {/* Drop zone overlay */}
      {dropState === "dragging" && (
        <div className="flex flex-col items-center gap-4 pointer-events-none">
          <div className="w-24 h-24 rounded-3xl bg-white/[0.06] border-2 border-dashed border-white/20 flex items-center justify-center">
            <Upload size={32} className="text-white/40" />
          </div>
          <p className="text-white/60 text-lg font-semibold">Drop to analyze</p>
          <p className="text-white/30 text-sm">Jimmy will identify and wire it in automatically</p>
        </div>
      )}

      {/* Identifying */}
      {dropState === "identifying" && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-white/40" />
          <p className="text-white/60 text-sm">Analyzing {fileName}...</p>
        </div>
      )}

      {/* Confirming */}
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

          {/* Confidence badge */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${identified.confidence === "high" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : identified.confidence === "medium" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "bg-red-500/15 text-red-400 border border-red-500/20"}`}>
              {identified.confidence} confidence
            </span>
            {identified.factory_name && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 border border-white/[0.08]">
                {identified.factory_name}
              </span>
            )}
          </div>

          {/* Confirmation message */}
          <p className="text-sm text-white/70 leading-relaxed">{identified.confirmation_message}</p>

          {/* Extracted products preview */}
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

      {/* Executing */}
      {dropState === "executing" && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-white/40" />
          <p className="text-white/60 text-sm">Wiring it into Jimmy...</p>
        </div>
      )}

      {/* Done */}
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

      {/* Error */}
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
  );
}
