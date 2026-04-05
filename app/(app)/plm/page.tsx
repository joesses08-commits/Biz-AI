"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, ChevronRight, Loader2, Layers, Factory, X, Check, Trash2, Users, Upload, Download, FileSpreadsheet } from "lucide-react";

const BATCH_STAGE_ORDER = ["rfq_sent","factory_selected","po_issued","production_started","production_complete","qc_inspection","shipped","in_transit","customs","delivered","active"];
const BATCH_STAGE_LABELS: Record<string,string> = { rfq_sent:"RFQ Sent", factory_selected:"Factory Selected", po_issued:"PO Issued", production_started:"Production Started", production_complete:"Production Complete", qc_inspection:"QC Inspection", shipped:"Shipped", in_transit:"In Transit", customs:"Customs", delivered:"Delivered", active:"Active" };
const BATCH_STAGE_COLORS: Record<string,string> = { rfq_sent:"#3b82f6", factory_selected:"#3b82f6", po_issued:"#f59e0b", production_started:"#f59e0b", production_complete:"#10b981", qc_inspection:"#f59e0b", shipped:"#3b82f6", in_transit:"#3b82f6", customs:"#f59e0b", delivered:"#10b981", active:"#10b981" };
const SEASONS = ["Spring", "Summer", "Fall", "Winter", "Holiday", "Resort", "Pre-Fall"];
const EXPORT_COLUMNS = ["name","sku","description","specs","category","collection","factory","target_elc","target_sell_price","margin","order_quantity","moq","current_stage","notes","images"];
const COLUMN_LABELS: Record<string,string> = { name:"Product Name", sku:"SKU", description:"Description", specs:"Specifications", category:"Category", collection:"Collection", factory:"Factory", target_elc:"ELC ($)", target_sell_price:"Sell Price ($)", margin:"Margin (%)", order_quantity:"Order Qty", moq:"MOQ", current_stage:"Stage", notes:"Notes", images:"Image URL" };

function getProductStatus(product: any) {
  const batches = product.plm_batches || [];
  let statusKey: string | null = null;
  let statusIdx = -1;
  for (const b of batches) {
    const idx = BATCH_STAGE_ORDER.indexOf(b.current_stage);
    if (idx > statusIdx) { statusIdx = idx; statusKey = b.current_stage; }
  }
  return statusKey;
}

function getCollectionProgress(products: any[]) {
  if (!products?.length) return { total: 0, complete: 0, pct: 0 };
  const complete = products.filter(p => {
    const status = getProductStatus(p);
    return status === "delivered" || status === "active";
  }).length;
  return { total: products.length, complete, pct: Math.round((complete / products.length) * 100) };
}

function getCollectionHealth(products: any[]) {
  if (!products?.length) return "empty";
  const delayed = products.filter(p => {
    const batches = p.plm_batches || [];
    if (!batches.length) return false;
    return batches.some((b: any) => {
      const daysSince = (Date.now() - new Date(b.stage_updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 14 && b.current_stage !== "delivered" && b.current_stage !== "active";
    });
  }).length;
  if (delayed > products.length * 0.3) return "at_risk";
  if (delayed > 0) return "warning";
  return "on_track";
}

export default function PLMPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [portalUsers, setPortalUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"collections"|"all_products"|"factory_access"|"designer_access">("collections");
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showNewPortalUser, setShowNewPortalUser] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPortalUser, setSavingPortalUser] = useState(false);
  const [deletingPortalUser, setDeletingPortalUser] = useState<string|null>(null);
  const [filterStage, setFilterStage] = useState("");
  const [filterCollection, setFilterCollection] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportColumns, setExportColumns] = useState(["name","sku","description","specs","category","collection","current_stage"]);
  const [exportPreset, setExportPreset] = useState("custom");
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState<"upload"|"map"|"done">("upload");
  const [importData, setImportData] = useState<any>(null);
  const [importMappings, setImportMappings] = useState<any>({});
  const [importCollection, setImportCollection] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const [newCollection, setNewCollection] = useState({ name:"", season:"", year: new Date().getFullYear().toString(), notes:"" });
  const [newProduct, setNewProduct] = useState({ name:"", sku:"", description:"", specs:"", category:"", collection_id:"", factory_id:"", target_elc:"", target_sell_price:"", moq:"", order_quantity:"", notes:"" });
  const [newPortalUser, setNewPortalUser] = useState({ name:"", email:"", password:"", factory_id:"", role:"factory" });

  const load = async () => {
    const [plmRes, catRes, portalRes] = await Promise.all([
      fetch("/api/plm"),
      fetch("/api/catalog?type=factories"),
      fetch("/api/plm/portal-users"),
    ]);
    const plmData = await plmRes.json();
    const catData = await catRes.json();
    const portalData = await portalRes.json();
    setCollections(plmData.collections || []);
    setProducts(plmData.products || []);
    setFactories(catData.factories || []);
    setPortalUsers(portalData.users || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createCollection = async () => {
    if (!newCollection.name) return;
    setSaving(true);
    await fetch("/api/plm", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"create_collection", ...newCollection, year: parseInt(newCollection.year) }) });
    setSaving(false); setShowNewCollection(false);
    setNewCollection({ name:"", season:"", year: new Date().getFullYear().toString(), notes:"" });
    load();
  };

  const createProduct = async () => {
    if (!newProduct.name) return;
    setSaving(true);
    await fetch("/api/plm", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"create_product", ...newProduct, target_elc: newProduct.target_elc ? parseFloat(newProduct.target_elc) : null, target_sell_price: newProduct.target_sell_price ? parseFloat(newProduct.target_sell_price) : null, moq: newProduct.moq ? parseInt(newProduct.moq) : null, order_quantity: newProduct.order_quantity ? parseInt(newProduct.order_quantity) : null }) });
    setSaving(false); setShowNewProduct(false);
    setNewProduct({ name:"", sku:"", description:"", specs:"", category:"", collection_id:"", factory_id:"", target_elc:"", target_sell_price:"", moq:"", order_quantity:"", notes:"" });
    load();
  };

  const createPortalUser = async () => {
    if (!newPortalUser.email || !newPortalUser.password) return;
    if (newPortalUser.role === "factory" && !newPortalUser.factory_id) return;
    setSavingPortalUser(true);
    await fetch("/api/plm/portal-users", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"create", ...newPortalUser }) });
    setSavingPortalUser(false); setShowNewPortalUser(false);
    setNewPortalUser({ name:"", email:"", password:"", factory_id:"", role:"factory" });
    load();
  };

  const deletePortalUser = async (id: string) => {
    setDeletingPortalUser(id);
    await fetch("/api/plm/portal-users", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"delete", id }) });
    setDeletingPortalUser(null); load();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await fetch("/api/plm", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"delete_product", id }) });
    load();
  };

  const toggleProduct = (id: string) => setSelectedProducts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelectedProducts(selectedProducts.length === filteredProducts.length ? [] : filteredProducts.map(p => p.id));

  const applyPreset = (preset: string) => {
    setExportPreset(preset);
    if (preset === "buyer") setExportColumns(["name","sku","description","specs","category","collection","target_sell_price","current_stage","images"]);
    else if (preset === "internal") setExportColumns([...EXPORT_COLUMNS]);
    else if (preset === "factory") setExportColumns(["name","sku","specs","order_quantity","moq","current_stage"]);
  };

  const handleExport = async () => {
    setExporting(true);
    const res = await fetch("/api/plm/export", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ product_ids: selectedProducts, columns: exportColumns, include_images: exportColumns.includes("images") }) });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `product-catalog-${Date.now()}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    setExporting(false); setShowExportModal(false);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);
      const wb = XLSX.read(buffer, { type:"array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(10, raw.length); i++) {
        if (raw[i].filter((c: any) => c !== null && c !== undefined && c !== "").length >= 3) { headerRowIdx = i; break; }
      }
      const headers = raw[headerRowIdx].map((h: any) => String(h || "").trim()).filter((h: string) => h);
      const dataRows = raw.slice(headerRowIdx + 1).filter((row: any[]) => row.some((c: any) => c !== null && c !== undefined && c !== ""));
      const allRows = dataRows.map((row: any[], rowIdx: number) => {
        const obj: Record<string,any> = {};
        headers.forEach((h: string, i: number) => { obj[h] = row[i] !== undefined ? row[i] : ""; });
        obj["__rowIndex"] = headerRowIdx + 1 + rowIdx;
        return obj;
      });
      const sampleRows = allRows.slice(0, 3);
      setImportData({ headers, sample_rows: sampleRows, all_rows: allRows, file_base64: base64, header_row_idx: headerRowIdx });
      const mapRes = await fetch("/api/plm/import", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"map", headers, sample_rows: sampleRows }) });
      const mapData = await mapRes.json();
      setImportMappings(mapData.mappings || {});
    } catch (err) { console.error("Import error:", err); }
    setImporting(false); setImportStep("map");
  };

  const handleImport = async () => {
    setImporting(true);
    const res = await fetch("/api/plm/import", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"import", rows: importData.all_rows, mappings: importMappings, collection_id: importCollection, file_base64: importData.file_base64, header_row_idx: importData.header_row_idx }) });
    const data = await res.json();
    setImportResult(data); setImporting(false); setImportStep("done"); load();
  };

  const filteredProducts = products.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name?.toLowerCase().includes(q);
      const matchSku = p.sku?.toLowerCase().includes(q);
      const matchCollection = p.plm_collections?.name?.toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchCollection) return false;
    }
    if (filterCollection && p.collection_id !== filterCollection) return false;
    if (filterStage) {
      const status = getProductStatus(p);
      if (filterStage === "no_batches" && (p.plm_batches || []).length > 0) return false;
      if (filterStage !== "no_batches" && status !== filterStage) return false;
    }
    return true;
  });

  const ic = "w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20 transition";
  const lc = "text-[11px] text-white/30 mb-1 block";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Package size={14} className="text-white/60" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Product Lifecycle</h1>
              <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">{products.length} SKUs</span>
            </div>
            <p className="text-white/30 text-sm">Track every product from concept to shelf</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowImportModal(true); setImportStep("upload"); setImportData(null); setImportResult(null); }}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition bg-white/[0.02]">
              <Upload size={11} />Import
            </button>
            <button onClick={() => setShowNewProduct(true)}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition bg-white/[0.02]">
              <Plus size={11} />New Product
            </button>
            <button onClick={() => setShowNewCollection(true)}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition">
              <Layers size={11} />New Collection
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl p-6 space-y-4 my-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Import Products from Spreadsheet</p>
                  <p className="text-xs text-white/30 mt-0.5">Upload a CSV or Excel file — Jimmy will map the columns automatically</p>
                </div>
                <button onClick={() => setShowImportModal(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
              </div>
              {importStep === "upload" && (
                <label className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/[0.08] rounded-xl cursor-pointer hover:border-white/20 transition">
                  {importing ? <Loader2 size={24} className="animate-spin text-white/30 mb-3" /> : <FileSpreadsheet size={24} className="text-white/20 mb-3" />}
                  <p className="text-sm text-white/40">{importing ? "Reading file & mapping columns..." : "Click to upload CSV or Excel"}</p>
                  <p className="text-xs text-white/20 mt-1">Supports .csv, .xlsx, .xls</p>
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} disabled={importing} />
                </label>
              )}
              {importStep === "map" && importData && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                    <Check size={11} />Jimmy mapped {Object.values(importMappings).filter(v => v !== "ignore").length} of {importData.headers.length} columns
                  </div>
                  <div>
                    <label className={lc}>Assign to Collection (optional)</label>
                    <select value={importCollection} onChange={e => setImportCollection(e.target.value)} className={ic}>
                      <option value="">No collection</option>
                      {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {importData.headers.map((header: string) => (
                      <div key={header} className="flex items-center gap-3">
                        <span className="text-xs text-white/50 w-40 truncate flex-shrink-0">{header}</span>
                        <span className="text-white/20 text-xs">→</span>
                        <select value={importMappings[header] || "ignore"} onChange={e => setImportMappings((prev: any) => ({...prev, [header]: e.target.value}))} className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-white/60 text-xs focus:outline-none">
                          <option value="ignore">Ignore</option>
                          <option value="name">Product Name</option>
                          <option value="sku">SKU</option>
                          <option value="description">Description</option>
                          <option value="specs">Specs</option>
                          <option value="category">Category</option>
                          <option value="collection">Collection</option>
                          <option value="factory">Factory</option>
                          <option value="target_elc">ELC ($)</option>
                          <option value="target_sell_price">Sell Price ($)</option>
                          <option value="moq">MOQ</option>
                          <option value="order_quantity">Order Qty</option>
                          <option value="notes">Notes</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-white/30">{importData.all_rows.length} products will be imported</p>
                  <div className="flex gap-2">
                    <button onClick={handleImport} disabled={importing} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                      {importing ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                      {importing ? "Importing..." : `Import ${importData.all_rows.length} Products`}
                    </button>
                    <button onClick={() => setShowImportModal(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                  </div>
                </div>
              )}
              {importStep === "done" && importResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                    <Check size={11} />Successfully imported {importResult.created} products
                  </div>
                  {importResult.errors?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-white/30">{importResult.errors.length} errors:</p>
                      {importResult.errors.map((e: string, i: number) => <p key={i} className="text-xs text-red-400">{e}</p>)}
                    </div>
                  )}
                  <button onClick={() => setShowImportModal(false)} className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-semibold">Done</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Export Product Catalog</p>
                  <p className="text-xs text-white/30 mt-0.5">{selectedProducts.length} products selected</p>
                </div>
                <button onClick={() => setShowExportModal(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
              </div>
              <div>
                <p className="text-[11px] text-white/30 mb-2">Presets</p>
                <div className="flex gap-2 flex-wrap">
                  {[["buyer","Buyer Catalog"],["internal","Internal"],["factory","Factory Sheet"],["custom","Custom"]].map(([key, label]) => (
                    <button key={key} onClick={() => applyPreset(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${exportPreset === key ? "bg-white text-black border-white" : "border-white/[0.08] text-white/40 hover:text-white/70"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-white/30 mb-2">Columns to include</p>
                <div className="grid grid-cols-2 gap-2">
                  {EXPORT_COLUMNS.map(col => (
                    <label key={col} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={exportColumns.includes(col)} onChange={e => setExportColumns(prev => e.target.checked ? [...prev, col] : prev.filter(c => c !== col))} className="rounded" />
                      <span className="text-xs text-white/60">{COLUMN_LABELS[col]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleExport} disabled={exporting || exportColumns.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                  {exporting ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                  {exporting ? "Exporting..." : "Export Excel"}
                </button>
                <button onClick={() => setShowExportModal(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* New Collection Modal */}
        {showNewCollection && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">New Collection</p>
                <button onClick={() => setShowNewCollection(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
              </div>
              <div><label className={lc}>Collection Name *</label><input value={newCollection.name} onChange={e => setNewCollection({...newCollection, name: e.target.value})} placeholder="Spring 2026 Glass Collection" className={ic} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lc}>Season</label>
                  <select value={newCollection.season} onChange={e => setNewCollection({...newCollection, season: e.target.value})} className={ic}>
                    <option value="">Select season</option>
                    {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className={lc}>Year</label><input value={newCollection.year} onChange={e => setNewCollection({...newCollection, year: e.target.value})} placeholder="2026" className={ic} /></div>
              </div>
              <div><label className={lc}>Notes</label><textarea value={newCollection.notes} onChange={e => setNewCollection({...newCollection, notes: e.target.value})} rows={2} className={`${ic} resize-none`} /></div>
              <div className="flex gap-2">
                <button onClick={createCollection} disabled={saving || !newCollection.name} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Create Collection
                </button>
                <button onClick={() => setShowNewCollection(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* New Product Modal */}
        {showNewProduct && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4 my-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">New Product / SKU</p>
                <button onClick={() => setShowNewProduct(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lc}>Product Name *</label><input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="16oz Glass Dog Cup" className={ic} /></div>
                <div><label className={lc}>SKU</label><input value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} placeholder="GL-001" className={ic} /></div>
              </div>
              <div><label className={lc}>Description</label><input value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} placeholder="Brief product description" className={ic} /></div>
              <div><label className={lc}>Specs</label><textarea value={newProduct.specs} onChange={e => setNewProduct({...newProduct, specs: e.target.value})} placeholder="Material, size, color..." rows={2} className={`${ic} resize-none`} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lc}>Collection</label>
                  <select value={newProduct.collection_id} onChange={e => setNewProduct({...newProduct, collection_id: e.target.value})} className={ic}>
                    <option value="">No collection</option>
                    {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lc}>Factory</label>
                  <select value={newProduct.factory_id} onChange={e => setNewProduct({...newProduct, factory_id: e.target.value})} className={ic}>
                    <option value="">Not assigned</option>
                    {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lc}>Category</label><input value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} placeholder="Glassware" className={ic} /></div>
                <div><label className={lc}>Order Quantity</label><input value={newProduct.order_quantity} onChange={e => setNewProduct({...newProduct, order_quantity: e.target.value})} placeholder="500" className={ic} /></div>
              </div>
              <div><label className={lc}>Notes</label><textarea value={newProduct.notes} onChange={e => setNewProduct({...newProduct, notes: e.target.value})} rows={2} className={`${ic} resize-none`} /></div>
              <div className="flex gap-2">
                <button onClick={createProduct} disabled={saving || !newProduct.name} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Create Product
                </button>
                <button onClick={() => setShowNewProduct(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5 w-fit mb-8">
          <button onClick={() => setActiveTab("collections")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "collections" ? "bg-white text-black" : "text-white/40"}`}>Collections</button>
          <button onClick={() => setActiveTab("all_products")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "all_products" ? "bg-white text-black" : "text-white/40"}`}>All Products</button>
          <button onClick={() => setActiveTab("factory_access")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "factory_access" ? "bg-white text-black" : "text-white/40"}`}>Factory Access</button>
          <button onClick={() => setActiveTab("designer_access")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "designer_access" ? "bg-white text-black" : "text-white/40"}`}>Designer Access</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-white/20" /></div>
        ) : activeTab === "collections" ? (
          <div className="space-y-4">
            {collections.length === 0 ? (
              <div className="text-center py-20"><Layers size={32} className="text-white/10 mx-auto mb-3" /><p className="text-white/30 text-sm">No collections yet</p></div>
            ) : collections.map(collection => {
              const prods = collection.plm_products || [];
              const progress = getCollectionProgress(prods);
              const health = getCollectionHealth(prods);
              const healthColors: Record<string,string> = { on_track:"#10b981", warning:"#f59e0b", at_risk:"#ef4444", empty:"#6b7280" };
              const healthLabels: Record<string,string> = { on_track:"On Track", warning:"Some Delays", at_risk:"At Risk", empty:"No Products" };
              return (
                <div key={collection.id} className="border border-white/[0.06] rounded-2xl bg-white/[0.01] overflow-hidden hover:border-white/10 transition cursor-pointer" onClick={() => setActiveTab("all_products")}>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-white">{collection.name}</h3>
                          {collection.season && <span className="text-[10px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-full">{collection.season} {collection.year}</span>}
                        </div>
                        <p className="text-xs text-white/30">{progress.total} products · {progress.complete} delivered</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: healthColors[health] }} />
                          <span className="text-[11px] font-medium" style={{ color: healthColors[health] }}>{healthLabels[health]}</span>
                        </div>
                        <ChevronRight size={14} className="text-white/20" />
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${progress.pct}%` }} />
                      </div>
                      <p className="text-[10px] text-white/20 mt-1">{progress.pct}% complete</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeTab === "all_products" ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search products..." className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none focus:border-white/20 transition w-44" />
                <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/50 text-xs focus:outline-none">
                  <option value="">All Stages</option>
                  <option value="no_batches">Pre-production</option>
                  {BATCH_STAGE_ORDER.map(s => <option key={s} value={s}>{BATCH_STAGE_LABELS[s]}</option>)}
                </select>
                <select value={filterCollection} onChange={e => setFilterCollection(e.target.value)} className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/50 text-xs focus:outline-none">
                  <option value="">All Collections</option>
                  {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {(filterStage || filterCollection) && (
                  <button onClick={() => { setFilterStage(""); setFilterCollection(""); setSearchQuery(""); }} className="text-[11px] text-white/30 hover:text-white/60 flex items-center gap-1">
                    <X size={10} />Clear
                  </button>
                )}
              </div>
              {selectedProducts.length > 0 && (
                <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition">
                  <Download size={11} />Export {selectedProducts.length} Selected
                </button>
              )}
            </div>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20"><Package size={32} className="text-white/10 mx-auto mb-3" /><p className="text-white/30 text-sm">No products yet</p></div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3 px-4 py-2">
                  <input type="checkbox" checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0} onChange={toggleAll} className="rounded" />
                  <span className="text-[11px] text-white/30">{selectedProducts.length > 0 ? `${selectedProducts.length} selected` : "Select all"}</span>
                </div>
                {filteredProducts.map(product => {
                  const statusKey = getProductStatus(product);
                  const milestones = product.milestones || {};
                  const lastMilestone = milestones.sample_approved ? "Sample Approved" : milestones.sampling ? "Sampling" : milestones.design_brief ? "Design Brief" : null;
                  return (
                    <div key={product.id} className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.01] hover:border-white/10 transition flex items-center gap-4"
                      style={{ borderColor: selectedProducts.includes(product.id) ? "rgba(255,255,255,0.15)" : "" }}>
                      <input type="checkbox" checked={selectedProducts.includes(product.id)} onChange={() => toggleProduct(product.id)} className="rounded flex-shrink-0" onClick={e => e.stopPropagation()} />
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-10 h-10 rounded-lg object-cover border border-white/[0.06] flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/[0.06] flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/plm/${product.id}`)}>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-white">{product.name}</p>
                          {product.sku && <span className="text-[10px] text-white/30 font-mono">{product.sku}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          {statusKey ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${BATCH_STAGE_COLORS[statusKey]}20`, color: BATCH_STAGE_COLORS[statusKey], border: `1px solid ${BATCH_STAGE_COLORS[statusKey]}30` }}>
                              {BATCH_STAGE_LABELS[statusKey]}
                            </span>
                          ) : lastMilestone ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.04] text-white/30 border border-white/[0.06]">{lastMilestone}</span>
                          ) : (
                            <span className="text-[10px] text-white/20">Pre-production</span>
                          )}
                          {product.plm_collections && <span className="text-[10px] text-white/25">{product.plm_collections.name}</span>}
                          {product.factory_catalog && <span className="text-[10px] text-white/25 flex items-center gap-1"><Factory size={9} />{product.factory_catalog.name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => deleteProduct(product.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition">
                          <Trash2 size={12} />
                        </button>
                        <ChevronRight size={14} className="text-white/20 cursor-pointer" onClick={() => router.push(`/plm/${product.id}`)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === "factory_access" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Factory Portal Users</p>
                <p className="text-xs text-white/30 mt-0.5">Factories log into portal.myjimmy.ai to update production stages</p>
              </div>
              <button onClick={() => { setNewPortalUser({name:"", email:"", password:"", factory_id:"", role:"factory"}); setShowNewPortalUser(true); }} className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition">
                <Plus size={11} />Add Factory User
              </button>
            </div>
            {showNewPortalUser && newPortalUser.role === "factory" && (
              <div className="border border-white/[0.08] rounded-2xl p-5 bg-white/[0.02] space-y-3">
                <p className="text-xs font-semibold text-white/70">New Factory Portal User</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lc}>Name</label><input value={newPortalUser.name} onChange={e => setNewPortalUser({...newPortalUser, name: e.target.value})} placeholder="Factory contact name" className={ic} /></div>
                  <div><label className={lc}>Email</label><input value={newPortalUser.email} onChange={e => setNewPortalUser({...newPortalUser, email: e.target.value})} placeholder="factory@example.com" className={ic} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lc}>Password</label><input value={newPortalUser.password} onChange={e => setNewPortalUser({...newPortalUser, password: e.target.value})} placeholder="Password" className={ic} /></div>
                  <div>
                    <label className={lc}>Factory</label>
                    <select value={newPortalUser.factory_id} onChange={e => setNewPortalUser({...newPortalUser, factory_id: e.target.value})} className={ic}>
                      <option value="">Select factory</option>
                      {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={createPortalUser} disabled={savingPortalUser || !newPortalUser.email || !newPortalUser.password || !newPortalUser.factory_id} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                    {savingPortalUser ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Create Factory User
                  </button>
                  <button onClick={() => setShowNewPortalUser(false)} className="px-4 py-2 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            )}
            {portalUsers.filter(u => u.role !== "designer").length === 0 && !showNewPortalUser ? (
              <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
                <Users size={28} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No factory portal users yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {portalUsers.filter(u => u.role !== "designer").map(u => (
                  <div key={u.id} className="flex items-center gap-4 border border-white/[0.06] rounded-xl px-5 py-4 bg-white/[0.01]">
                    <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <Users size={13} className="text-white/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{u.name || u.email}</p>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-white/30">{u.email}</p>
                        {u.factory_catalog && <p className="text-xs text-white/20">{u.factory_catalog.name}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Factory</span>
                      <button onClick={() => deletePortalUser(u.id)} disabled={deletingPortalUser === u.id} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition">
                        {deletingPortalUser === u.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Designer Portal Users</p>
                <p className="text-xs text-white/30 mt-0.5">Designers log into portal.myjimmy.ai to add products and submit for approval</p>
              </div>
              <button onClick={() => { setNewPortalUser({name:"", email:"", password:"", factory_id:"", role:"designer"}); setShowNewPortalUser(true); }} className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition">
                <Plus size={11} />Add Designer
              </button>
            </div>
            {showNewPortalUser && newPortalUser.role === "designer" && (
              <div className="border border-white/[0.08] rounded-2xl p-5 bg-white/[0.02] space-y-3">
                <p className="text-xs font-semibold text-white/70">New Designer</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lc}>Name</label><input value={newPortalUser.name} onChange={e => setNewPortalUser({...newPortalUser, name: e.target.value})} placeholder="Designer name" className={ic} /></div>
                  <div><label className={lc}>Email</label><input value={newPortalUser.email} onChange={e => setNewPortalUser({...newPortalUser, email: e.target.value})} placeholder="designer@example.com" className={ic} /></div>
                </div>
                <div><label className={lc}>Password</label><input value={newPortalUser.password} onChange={e => setNewPortalUser({...newPortalUser, password: e.target.value})} placeholder="Password" className={ic} /></div>
                <div className="flex gap-2">
                  <button onClick={createPortalUser} disabled={savingPortalUser || !newPortalUser.email || !newPortalUser.password} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                    {savingPortalUser ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Create Designer
                  </button>
                  <button onClick={() => setShowNewPortalUser(false)} className="px-4 py-2 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
                </div>
              </div>
            )}
            {portalUsers.filter(u => u.role === "designer").length === 0 && !showNewPortalUser ? (
              <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-2xl">
                <Users size={28} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No designers yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {portalUsers.filter(u => u.role === "designer").map(u => (
                  <div key={u.id} className="flex items-center gap-4 border border-white/[0.06] rounded-xl px-5 py-4 bg-white/[0.01]">
                    <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <Users size={13} className="text-white/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{u.name || u.email}</p>
                      <p className="text-xs text-white/30">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">Designer</span>
                      <button onClick={() => deletePortalUser(u.id)} disabled={deletingPortalUser === u.id} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition">
                        {deletingPortalUser === u.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
