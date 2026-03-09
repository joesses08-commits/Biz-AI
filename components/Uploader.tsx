"use client";

import { useState, useCallback } from "react";
import { UploadCloud, CheckCircle, AlertCircle, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { DatasetType } from "@/types";

interface UploadZoneProps {
  type: DatasetType;
  label: string;
  description: string;
  columns: string[];
  onUpload: (type: DatasetType, file: File, rows: Record<string, unknown>[]) => void;
  status: "idle" | "uploading" | "done" | "error";
  rowCount?: number;
}

function UploadZone({ type, label, description, columns, onUpload, status, rowCount }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      import("papaparse").then(({ default: Papa }) => {
        const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
        onUpload(type, file, result.data as Record<string, unknown>[]);
      });
    };
    reader.readAsText(file);
  }, [type, onUpload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const isDone = status === "done";
  const isUploading = status === "uploading";

  return (
    <div className={cn(
      "relative rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden",
      dragging && "border-accent bg-accent/5 scale-[1.01]",
      isDone && "border-emerald-500/50 bg-emerald-500/5",
      !dragging && !isDone && "border-bg-border hover:border-accent/40 hover:bg-bg-hover/30",
    )}>
      <input
        type="file"
        accept="*"
        onChange={onInputChange}
        className="absolute inset-0 opacity-0 cursor-pointer z-10"
        disabled={isUploading}
      />

      <div className="p-5"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
            isDone ? "bg-emerald-500/15" : "bg-bg-elevated"
          )}>
            {isDone
              ? <CheckCircle size={18} className="text-emerald-400" />
              : <FileText size={18} className="text-text-muted" />
            }
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-text-primary">{label}</span>
              {isDone && (
                <span className="badge badge-green">{rowCount} rows</span>
              )}
            </div>
            <p className="text-xs text-text-muted">{description}</p>
            <p className="text-[10px] text-text-muted mt-1.5 font-mono">
              {columns.join(", ")}
            </p>
          </div>

          {/* Upload indicator */}
          <div className="flex-shrink-0">
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            ) : isDone ? null : (
              <UploadCloud size={16} className="text-text-muted" />
            )}
          </div>
        </div>

        {!isDone && (
          <div className="mt-3 pt-3 border-t border-bg-border">
            <p className="text-[11px] text-text-muted text-center">
              {dragging ? "Drop it!" : "Drag & drop or click to upload"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Upload Page Component ─────────────────────────────────────────────────

const DATASETS = [
  {
    type: "sales" as DatasetType,
    label: "Sales Data",
    description: "Revenue, orders, and customer transactions",
    columns: ["date", "product_id", "product_name", "customer_name", "revenue", "quantity", "discount"],
  },
  {
    type: "costs" as DatasetType,
    label: "Cost Data",
    description: "Operating costs, vendor expenses, overhead",
    columns: ["date", "category", "amount", "vendor", "description"],
  },
  {
    type: "products" as DatasetType,
    label: "Product Catalog",
    description: "Products with unit costs and prices",
    columns: ["product_id", "name", "unit_cost", "unit_price", "category"],
  },
  {
    type: "customers" as DatasetType,
    label: "Customer List",
    description: "Customer segments and regions (optional)",
    columns: ["customer_id", "name", "segment", "region"],
  },
];

type UploadStatus = { status: "idle" | "uploading" | "done" | "error"; rowCount?: number };

export default function Uploader() {
  const [statuses, setStatuses] = useState<Record<DatasetType, UploadStatus>>({
    sales: { status: "idle" },
    costs: { status: "idle" },
    products: { status: "idle" },
    customers: { status: "idle" },
  });
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (type: DatasetType, file: File, rows: Record<string, unknown>[]) => {
    setStatuses(s => ({ ...s, [type]: { status: "uploading" } }));
    setError(null);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, filename: file.name, rows }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      setStatuses(s => ({ ...s, [type]: { status: "done", rowCount: rows.length } }));
    } catch (err) {
      setStatuses(s => ({ ...s, [type]: { status: "error" } }));
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const doneCount = Object.values(statuses).filter(s => s.status === "done").length;
  const hasAnything = doneCount > 0;

  return (
    <div className="p-8 max-w-2xl animate-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
          Data Upload
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Import your company CSV files. Sales data is required — everything else is optional but improves analysis.
        </p>
      </div>

      {/* Progress bar */}
      {hasAnything && (
        <div className="mb-6 card animate-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-secondary">Datasets uploaded</span>
            <span className="text-xs text-text-muted">{doneCount} of 4</span>
          </div>
          <div className="h-1.5 bg-bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${(doneCount / 4) * 100}%` }}
            />
          </div>
          {doneCount >= 1 && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-emerald-400">✓ Ready to analyze</span>
              <a href="/dashboard" className="text-xs text-accent hover:text-accent-hover font-semibold transition-colors">
                View Dashboard →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400 flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={14} className="text-red-400" /></button>
        </div>
      )}

      {/* Upload zones */}
      <div className="space-y-3">
        {DATASETS.map((ds) => (
          <UploadZone
            key={ds.type}
            {...ds}
            status={statuses[ds.type].status}
            rowCount={statuses[ds.type].rowCount}
            onUpload={handleUpload}
          />
        ))}
      </div>

      {/* Tip */}
      <div className="mt-6 px-4 py-3 bg-accent/5 border border-accent/10 rounded-lg">
        <p className="text-xs text-text-muted">
          <span className="text-accent font-semibold">Tip:</span> Don't have CSVs ready? Export them from QuickBooks, Shopify, Excel, or any accounting tool. Column names don't need to match exactly — the AI will adapt.
        </p>
      </div>
    </div>
  );
}
