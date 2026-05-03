"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Loader2, Check, X, ArrowLeft, Package } from "lucide-react";

export default function PortalDocDropperPage() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [portalUser, setPortalUser] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const token = () => localStorage.getItem("portal_token") || localStorage.getItem("portal_token_designer") || "";

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("portal_user") || localStorage.getItem("portal_user_designer") || "{}");
    setPortalUser(user);
  }, []);

  const handleFile = async (f: File) => {
    setFile(f); setResult(null); setError(""); setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      const res = await fetch("/api/portal/doc-drop", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
        body: JSON.stringify({ file_name: f.name, file_type: f.type, file_base64: base64 }),
      });
      const data = await res.json();
      setUploading(false);
      if (data.error) setError(data.error);
      else setResult(data);
    };
    reader.readAsDataURL(f);
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary p-6">
      <button onClick={() => router.push("/portal/dashboard?role=designer")}
        className="flex items-center gap-2 text-text-muted hover:text-text-primary text-xs mb-6 transition">
        <ArrowLeft size={14} />Back
      </button>
      <h1 className="text-lg font-semibold mb-1">Doc Dropper</h1>
      <p className="text-xs text-text-muted mb-6">Drop a factory quote or product sheet — Jimmy auto-extracts the data</p>

      <div onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => fileRef.current?.click()}
        className={"border-2 border-dashed rounded-2xl p-16 flex flex-col items-center gap-3 cursor-pointer transition " + (dragging ? "border-white/40 bg-white/5" : "border-bg-border hover:border-white/20")}>
        <Upload size={28} className="text-text-muted" />
        <p className="text-sm font-semibold">Drop file here or click to upload</p>
        <p className="text-xs text-text-muted">PDF, Excel (.xlsx), Word (.docx)</p>
        <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.docx" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {file && (
        <div className="mt-4 flex items-center gap-3 p-3 border border-bg-border rounded-xl bg-bg-surface">
          <FileText size={16} className="text-text-muted flex-shrink-0" />
          <span className="text-xs text-text-secondary flex-1 truncate">{file.name}</span>
          {uploading && <Loader2 size={14} className="animate-spin text-text-muted" />}
          {result && <Check size={14} className="text-emerald-400" />}
          {error && <X size={14} className="text-red-400" />}
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      {result && (
        <div className="mt-6 space-y-4">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Extracted — {result.doc_type || "Document"}</p>
          {(result.extracted_data?.products || []).map((p: any, i: number) => (
            <div key={i} className="border border-bg-border rounded-xl p-4 bg-bg-surface space-y-1">
              <p className="text-sm font-semibold">{p.name || "Product " + (i+1)}</p>
              {p.sku && <p className="text-xs text-text-muted font-mono">{p.sku}</p>}
              {p.unit_price && <p className="text-xs text-text-secondary">Unit Price: {p.unit_price}</p>}
              {p.moq && <p className="text-xs text-text-secondary">MOQ: {p.moq}</p>}
              {p.lead_time && <p className="text-xs text-text-secondary">Lead Time: {p.lead_time}</p>}
              {p.notes && <p className="text-xs text-text-muted">{p.notes}</p>}
            </div>
          ))}
          {result.summary && <p className="text-xs text-text-muted">{result.summary}</p>}
        </div>
      )}
    </div>
  );
}
