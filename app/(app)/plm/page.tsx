"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, ChevronRight, Loader2, Layers, Factory, X, Check, Trash2, Users, Upload, Download, FileSpreadsheet, FileText } from "lucide-react";

const BATCH_STAGE_ORDER = ["po_issued","production_started","production_complete","qc_inspection","ready_to_ship","shipped"];
const BATCH_STAGE_LABELS: Record<string,string> = { po_issued:"PO Issued", production_started:"Production Started", production_complete:"Production Complete", qc_inspection:"QC Inspection", ready_to_ship:"Ready to Ship", shipped:"Shipped" };
const BATCH_STAGE_COLORS: Record<string,string> = { po_issued:"#f59e0b", production_started:"#f59e0b", production_complete:"#10b981", qc_inspection:"#f59e0b", ready_to_ship:"#3b82f6", shipped:"#10b981" };
const DEV_STAGE_LABELS: Record<string,string> = { concept:"Concept", ready_for_quote:"Ready for Quote", artwork_sent:"Artwork Sent", quotes_received:"Quotes Received", samples_requested:"Samples Requested", sample_production:"Sample Production", sample_complete:"Sample Complete", sample_shipped:"Sample Shipped", sample_arrived:"Sample Arrived", sample_approved:"Sample Approved" };
const DEV_STAGE_COLORS: Record<string,string> = { concept:"#6b7280", ready_for_quote:"#ec4899", artwork_sent:"#8b5cf6", quotes_received:"#3b82f6", samples_requested:"#f59e0b", sample_production:"#f59e0b", sample_complete:"#f59e0b", sample_shipped:"#3b82f6", sample_arrived:"#10b981", sample_approved:"#10b981" };
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
  const [activeTab, setActiveTab] = useState<"collections"|"all_products"|"factory_access"|"designer_access"|"prioritization">("all_products");
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



  // Bulk sample request
  const [showSampleRequestModal, setShowSampleRequestModal] = useState(false);
  const [bulkSampleSelections, setBulkSampleSelections] = useState<Record<string, any>>({});
  const [bulkSampleNote, setBulkSampleNote] = useState("");
  const [submittingBulkSample, setSubmittingBulkSample] = useState(false);
  const [bulkSampleProductIds, setBulkSampleProductIds] = useState<string[]>([]);

  // RFQ from PLM
  const [showRfqModal, setShowRfqModal] = useState(false);

  // Prioritization
  const [prioFactories, setPrioFactories] = useState<any[]>([]);
  const [prioSamples, setPrioSamples] = useState<any[]>([]);
  const [prioActiveFactory, setPrioActiveFactory] = useState<string | null>(null);
  const [prioLoading, setPrioLoading] = useState(false);
  const [prioSaving, setPrioSaving] = useState(false);
  const [prioSaved, setPrioSaved] = useState(false);
  const [prioOrder, setPrioOrder] = useState<Record<string, string[]>>({});
  const [prioMaxEditing, setPrioMaxEditing] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [rfqSelectedProducts, setRfqSelectedProducts] = useState<string[]>([]);
  const [rfqInclude, setRfqInclude] = useState<string[]>(["name","sku","description","specs","images"]);
  const [rfqAskFor, setRfqAskFor] = useState<string[]>(["price","sample_lead_time","moq","lead_time"]);
  const [creatingRfq, setCreatingRfq] = useState(false);
  const [rfqJobId, setRfqJobId] = useState<string|null>(null);

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
  useEffect(() => { if (activeTab === "prioritization" && prioFactories.length === 0 && !prioLoading) loadPrioritization(); }, [activeTab]);

  const loadPrioritization = async () => {
    setPrioLoading(true);
    const res = await fetch("/api/plm/prioritize");
    const data = await res.json();
    setPrioFactories(data.factories || []);
    setPrioSamples(data.samples || []);
    // Build order map per factory
    const orderMap: Record<string, string[]> = {};
    for (const f of (data.factories || [])) {
      const factorySamples = (data.samples || []).filter((s: any) => s.factory_id === f.id);
      const prioritized = factorySamples.filter((s: any) => s.priority_order != null).sort((a: any, b: any) => a.priority_order - b.priority_order);
      const unprioritized = factorySamples.filter((s: any) => s.priority_order == null);
      orderMap[f.id] = [...prioritized, ...unprioritized].map((s: any) => s.id);
    }
    setPrioOrder(orderMap);
    if (!prioActiveFactory && data.factories?.length > 0) setPrioActiveFactory(data.factories[0].id);
    setPrioLoading(false);
  };

  const savePriorities = async (factoryId: string) => {
    setPrioSaving(true);
    await fetch("/api/plm/prioritize", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_priorities", factory_id: factoryId, ordered_ids: prioOrder[factoryId] || [] }) });
    setPrioSaving(false);
    setPrioSaved(true);
    setTimeout(() => setPrioSaved(false), 2000);
  };

  const saveMaxSamples = async (factoryId: string, max: string) => {
    await fetch("/api/plm/prioritize", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_max_samples", factory_id: factoryId, max_samples: parseInt(max) || 50 }) });
    setPrioFactories(prev => prev.map(f => f.id === factoryId ? { ...f, max_samples: parseInt(max) || 50 } : f));
    setPrioMaxEditing(prev => { const n = { ...prev }; delete n[factoryId]; return n; });
  };

  const moveSample = (factoryId: string, fromIdx: number, toIdx: number) => {
    const order = [...(prioOrder[factoryId] || [])];
    const [moved] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, moved);
    setPrioOrder(prev => ({ ...prev, [factoryId]: order }));
  };

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
      if (DEV_STAGE_LABELS[filterStage]) {
        // Dev stage filter — match current_stage and no production batches
        return p.current_stage === filterStage && !status;
      }
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

        {/* RFQ Modal */}
        {showRfqModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl p-6 space-y-5 my-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Create RFQ</p>
                  <p className="text-xs text-white/30 mt-0.5">Select products, choose what to include and ask for, then export to Workflows</p>
                </div>
                <button onClick={() => setShowRfqModal(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
              </div>

              {/* Product selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-white/30 uppercase tracking-widest">Products to Include</p>
                  <div className="flex gap-2">
                    <button onClick={() => setRfqSelectedProducts(products.filter(p => p.current_stage === "ready_for_quote").map(p => p.id))}
                      className="text-[11px] text-pink-400 hover:text-pink-300 transition">Select RFQ Ready</button>
                    <button onClick={() => setRfqSelectedProducts(products.map(p => p.id))}
                      className="text-[11px] text-white/30 hover:text-white/60 transition">Select All</button>
                    <button onClick={() => setRfqSelectedProducts([])}
                      className="text-[11px] text-white/30 hover:text-white/60 transition">Clear</button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-white/[0.06] rounded-xl p-3">
                  {products.map(p => (
                    <label key={p.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-white/[0.02] px-2 py-1.5 rounded-lg transition">
                      <input type="checkbox" checked={rfqSelectedProducts.includes(p.id)}
                        onChange={e => setRfqSelectedProducts(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))}
                        className="rounded" />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {p.images?.[0] && <img src={p.images[0]} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />}
                        <span className="text-xs text-white/70 truncate">{p.name}</span>
                        {p.sku && <span className="text-[10px] text-white/30 font-mono flex-shrink-0">{p.sku}</span>}
                        {p.current_stage === "ready_for_quote" && <span className="text-[10px] text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0">RFQ Ready</span>}
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-white/25 mt-1.5">{rfqSelectedProducts.length} products selected</p>
              </div>

              {/* What to include */}
              <div>
                <p className="text-[11px] text-white/30 uppercase tracking-widest mb-2">Include in Sheet</p>
                <div className="grid grid-cols-3 gap-2">
                  {[["name","Product Name"],["sku","SKU"],["description","Description"],["specs","Specifications"],["images","Image URLs"],["category","Category"],["collection","Collection"],["notes","Notes"]].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={rfqInclude.includes(key)}
                        onChange={e => setRfqInclude(prev => e.target.checked ? [...prev, key] : prev.filter(k => k !== key))}
                        className="rounded" />
                      <span className="text-xs text-white/60">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* What to ask factories */}
              <div>
                <p className="text-[11px] text-white/30 uppercase tracking-widest mb-2">Ask Factories to Fill In</p>
                <div className="grid grid-cols-3 gap-2">
                  {[["price","Unit Price"],["sample_lead_time","Sample Lead Time"],["moq","MOQ"],["lead_time","Production Lead Time"],["sample_price","Sample Price"],["payment_terms","Payment Terms"],["packaging","Packaging Details"],["notes","Notes/Comments"]].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={rfqAskFor.includes(key)}
                        onChange={e => setRfqAskFor(prev => e.target.checked ? [...prev, key] : prev.filter(k => k !== key))}
                        className="rounded" />
                      <span className="text-xs text-white/60">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {rfqJobId && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                  <Check size={14} className="text-emerald-400" />
                  <p className="text-xs text-emerald-300">RFQ job created! <button onClick={() => { setShowRfqModal(false); router.push(`/workflows/factory-quote`); }} className="underline ml-1">Open in Workflows →</button></p>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={async () => {
                  if (rfqSelectedProducts.length === 0) return;
                  setCreatingRfq(true);
                  try {
                    const res = await fetch("/api/plm/rfq", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        product_ids: rfqSelectedProducts,
                        include: rfqInclude,
                        ask_for: rfqAskFor,
                      }),
                    });
                    const data = await res.json();
                    if (data.job_id) {
                      setRfqJobId(data.job_id);
                      // Auto-download the Excel file
                      if (data.file_base64) {
                        const bytes = Uint8Array.from(atob(data.file_base64), c => c.charCodeAt(0));
                        const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = data.file_name || "RFQ.xlsx";
                        a.click();
                        URL.revokeObjectURL(url);
                      }
                      load();
                    }
                  } finally {
                    setCreatingRfq(false);
                  }
                }} disabled={creatingRfq || rfqSelectedProducts.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-pink-500 text-white text-xs font-semibold hover:bg-pink-400 transition disabled:opacity-40">
                  {creatingRfq ? <Loader2 size={11} className="animate-spin" /> : <FileSpreadsheet size={11} />}
                  {creatingRfq ? "Creating RFQ..." : `Create RFQ for ${rfqSelectedProducts.length} Products`}
                </button>
                <button onClick={() => { setShowRfqModal(false); setRfqJobId(null); }} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Sample Request Modal */}
        {showSampleRequestModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl p-6 space-y-5 my-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Request Samples</p>
                  <p className="text-xs text-white/30 mt-0.5">Select products and pick which factories to request from</p>
                </div>
                <button onClick={() => setShowSampleRequestModal(false)} className="text-white/30 hover:text-white/60"><X size={14} /></button>
              </div>

              {/* Product list with factory picker per product */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {products.filter(p => ["quotes_received","samples_requested","artwork_sent","ready_for_quote"].includes(p.current_stage || "") || (p.plm_sample_requests || []).some((r: any) => r.status === "approved")).filter(p => !p.killed).map((p: any) => {
                  const isSelected = bulkSampleProductIds.includes(p.id);
                  const selectedFactories = bulkSampleSelections[p.id] || [];
                  const approvedReq = (p.plm_sample_requests || []).find((r: any) => r.status === "approved");
                  const isAdditional = !!approvedReq;
                  const approvedFactory = isAdditional ? factories.find((f: any) => f.id === approvedReq.factory_id) : null;
                  return (
                    <div key={p.id} className={`border rounded-xl p-3 space-y-2 transition ${isSelected ? "border-amber-500/30 bg-amber-500/[0.03]" : "border-white/[0.06]"}`}>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={isSelected}
                          onChange={e => {
                            setBulkSampleProductIds(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id));
                            if (e.target.checked && isAdditional && approvedFactory) {
                              setBulkSampleSelections(prev => ({ ...prev, [p.id]: [approvedFactory.id] }));
                            }
                          }}
                          className="rounded" />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {p.images?.[0] && <img src={p.images[0]} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />}
                          <span className="text-xs text-white/70 font-medium truncate">{p.name}</span>
                          {p.sku && <span className="text-[10px] text-white/30 font-mono flex-shrink-0">{p.sku}</span>}
                          {isAdditional && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/20 flex-shrink-0">Additional</span>}
                        </div>
                      </label>
                      {isSelected && (
                        <div className="pl-6 space-y-2">
                          {isAdditional ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs text-white/50">
                                <span className="text-[10px] text-white/30 uppercase tracking-widest">Factory:</span>
                                <span className="px-2 py-0.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300">{approvedFactory?.name || "Approved factory"}</span>
                                <span className="text-[10px] text-white/20">(locked — approved factory only)</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Quantity *</p>
                                  <input type="number" placeholder="e.g. 3"
                                    value={bulkSampleSelections[`${p.id}_qty`] || ""}
                                    onChange={e => setBulkSampleSelections(prev => ({ ...prev, [`${p.id}_qty`]: e.target.value }))}
                                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white/70 text-xs focus:outline-none" />
                                </div>
                                <div>
                                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Reason *</p>
                                  <input type="text" placeholder="e.g. Color change"
                                    value={bulkSampleSelections[`${p.id}_reason`] || ""}
                                    onChange={e => setBulkSampleSelections(prev => ({ ...prev, [`${p.id}_reason`]: e.target.value }))}
                                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white/70 text-xs focus:outline-none" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Request from:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {factories.map((f: any) => (
                                  <button key={f.id} onClick={() => setBulkSampleSelections(prev => ({
                                    ...prev,
                                    [p.id]: selectedFactories.includes(f.id) ? selectedFactories.filter((id: string) => id !== f.id) : [...selectedFactories, f.id]
                                  }))}
                                    className={`text-xs px-2.5 py-1 rounded-lg border transition ${selectedFactories.includes(f.id) ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-white/[0.06] text-white/30 hover:text-white/60"}`}>
                                    {f.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Note to factories (optional)</p>
                <textarea value={bulkSampleNote} onChange={e => setBulkSampleNote(e.target.value)}
                  placeholder="e.g. Priority samples needed by May 1st"
                  rows={2} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none resize-none" />
              </div>

              <div className="flex gap-2">
                <button onClick={async () => {
                  const toRequest = bulkSampleProductIds.filter(id => (bulkSampleSelections[id] || []).length > 0);
                  if (!toRequest.length) return;
                  setSubmittingBulkSample(true);
                  for (const productId of toRequest) {
                    const p = products.find((pr: any) => pr.id === productId);
                    const approvedReq = (p?.plm_sample_requests || []).find((r: any) => r.status === "approved");
                    const isAdditional = !!approvedReq;
                    const qty = bulkSampleSelections[`${productId}_qty`];
                    const reason = bulkSampleSelections[`${productId}_reason`];
                    await fetch("/api/plm", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "create_sample_requests",
                        product_id: productId,
                        factory_ids: bulkSampleSelections[productId],
                        note: isAdditional ? reason : bulkSampleNote,
                        force: isAdditional,
                        label: isAdditional ? "additional" : undefined,
                        qty: isAdditional ? parseInt(qty) || undefined : undefined,
                        provider: "gmail",
                      }),
                    });
                  }
                  setSubmittingBulkSample(false);
                  setShowSampleRequestModal(false);
                  setBulkSampleSelections({});
                  setBulkSampleNote("");
                  load();
                }} disabled={submittingBulkSample || bulkSampleProductIds.filter(id => {
                  const p = products.find((pr: any) => pr.id === id);
                  const isAdditional = (p?.plm_sample_requests || []).some((r: any) => r.status === "approved");
                  if (isAdditional) return (bulkSampleSelections[id] || []).length > 0 && bulkSampleSelections[`${id}_qty`] && bulkSampleSelections[`${id}_reason`];
                  return (bulkSampleSelections[id] || []).length > 0;
                }).length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400 transition disabled:opacity-40">
                  {submittingBulkSample ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Request Samples for {bulkSampleProductIds.filter(id => (bulkSampleSelections[id] || []).length > 0).length} Products
                </button>
                <button onClick={() => setShowSampleRequestModal(false)} className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs">Cancel</button>
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
          <button onClick={() => setActiveTab("all_products")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "all_products" ? "bg-white text-black" : "text-white/40"}`}>All Products</button>
          <button onClick={() => setActiveTab("collections")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "collections" ? "bg-white text-black" : "text-white/40"}`}>Collections</button>
          <button onClick={() => setActiveTab("factory_access")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "factory_access" ? "bg-white text-black" : "text-white/40"}`}>Factory Access</button>
          <button onClick={() => setActiveTab("designer_access")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "designer_access" ? "bg-white text-black" : "text-white/40"}`}>Designer Access</button>
          <button onClick={() => setActiveTab("prioritization")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "prioritization" ? "bg-white text-black" : "text-white/40"}`}>Prioritization</button>
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
                  <optgroup label="Development">
                    {Object.entries(DEV_STAGE_LABELS).filter(([key]) => !["sample_production","sample_complete","sample_shipped","sample_arrived"].includes(key)).map(([key, label]) => <option key={key} value={key}>{label as string}</option>)}
                  </optgroup>
                  <optgroup label="Production">
                    {BATCH_STAGE_ORDER.map(s => <option key={s} value={s}>{BATCH_STAGE_LABELS[s]}</option>)}
                  </optgroup>
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
              <div className="flex items-center gap-2">
                {selectedProducts.length > 0 && (
                  <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl border border-white/10 text-white/60 font-semibold hover:bg-white/5 transition">
                    <Download size={11} />Export {selectedProducts.length}
                  </button>
                )}
                <button onClick={() => {
                  const rfqReady = products.filter(p => p.current_stage === "ready_for_quote").map(p => p.id);
                  setRfqSelectedProducts(rfqReady);
                  setShowRfqModal(true);
                }} className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-pink-500 text-white font-semibold hover:bg-pink-400 transition">
                  <FileSpreadsheet size={11} />RFQ
                </button>
                <button onClick={() => {
                  const quoteReceived = products.filter(p => p.current_stage === "quotes_received" && !p.killed).map(p => p.id);
                  setBulkSampleProductIds(quoteReceived);
                  setBulkSampleSelections({});
                  setShowSampleRequestModal(true);
                }} className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition">
                  <Plus size={11} />Request Samples
                </button>
                <button onClick={() => router.push("/workflows/po-generator")} className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-400 transition">
                  <FileText size={11} />Generate PO
                </button>
              </div>
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
                  const productStatusMode = product.status || "progression";
                  if (product.killed || productStatusMode === "killed") return (
                    <div key={product.id} onClick={() => router.push(`/plm/${product.id}`)} className="flex items-center gap-3 p-4 border border-red-500/20 rounded-2xl bg-red-500/[0.02] opacity-60 cursor-pointer hover:opacity-80 transition">
                      {product.images?.[0] && <img src={product.images[0]} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/50 truncate line-through">{product.name}</p>
                        {product.sku && <p className="text-[11px] text-white/20 font-mono">{product.sku}</p>}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20 flex-shrink-0">Killed — Click to Revive</span>
                    </div>
                  );
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
                          {productStatusMode === "hold" && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">⏸ Hold</span>
                          )}
                          {statusKey ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${BATCH_STAGE_COLORS[statusKey]}20`, color: BATCH_STAGE_COLORS[statusKey], border: `1px solid ${BATCH_STAGE_COLORS[statusKey]}30` }}>
                              {BATCH_STAGE_LABELS[statusKey]}
                            </span>
                          ) : product.current_stage && DEV_STAGE_LABELS[product.current_stage] ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${DEV_STAGE_COLORS[product.current_stage]}20`, color: DEV_STAGE_COLORS[product.current_stage], border: `1px solid ${DEV_STAGE_COLORS[product.current_stage]}30` }}>
                              {DEV_STAGE_LABELS[product.current_stage]}
                              {product.current_stage === "sample_approved" && (() => {
                                const approvedReq = (product.plm_sample_requests || []).find((r: any) => r.status === "approved");
                                return approvedReq?.factory_catalog?.name ? ` · ${approvedReq.factory_catalog.name}` : "";
                              })()}
                            </span>
                          ) : (
                            <span className="text-[10px] text-white/20">Concept</span>
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
        ) : activeTab === "designer_access" ? (
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
        ) : null} 

        {activeTab === "prioritization" && (
          <div className="space-y-6">
            {prioLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 size={18} className="animate-spin text-white/20" /></div>
            ) : prioFactories.length === 0 ? (
              <div className="text-center py-20"><p className="text-white/30 text-sm">No factories found. Add factories in Factory Access first.</p></div>
            ) : (
              <>
                {/* Factory tabs */}
                <div className="flex gap-2 border-b border-white/[0.06] pb-3">
                  {prioFactories.map(f => {
                    const factorySamples = prioSamples.filter((s: any) => s.factory_id === f.id);
                    const prioritized = (prioOrder[f.id] || []).filter(id => {
                      const s = prioSamples.find((s: any) => s.id === id);
                      return s?.priority_order != null;
                    }).length;
                    const max = f.max_samples || 50;
                    return (
                      <button key={f.id} onClick={() => setPrioActiveFactory(f.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${prioActiveFactory === f.id ? "bg-white text-black" : "text-white/40 hover:text-white/70 border border-white/[0.06]"}`}>
                        {f.name}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${prioActiveFactory === f.id ? "bg-black/10" : "bg-white/[0.06]"}`}>
                          {factorySamples.length} pending
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active factory content */}
                {prioActiveFactory && (() => {
                  const factory = prioFactories.find(f => f.id === prioActiveFactory);
                  const max = factory?.max_samples || 50;
                  const orderedIds = prioOrder[prioActiveFactory] || [];
                  const orderedSamples = orderedIds.map(id => prioSamples.find((s: any) => s.id === id)).filter(Boolean);
                  const prioritizedCount = orderedSamples.length;

                  return (
                    <div className="space-y-4">
                      {/* Header with max samples + counter */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Factory Capacity</p>
                            <div className="flex items-center gap-2">
                              {prioMaxEditing[prioActiveFactory] !== undefined ? (
                                <div className="flex items-center gap-2">
                                  <input type="number" value={prioMaxEditing[prioActiveFactory]}
                                    onChange={e => setPrioMaxEditing(prev => ({ ...prev, [prioActiveFactory]: e.target.value }))}
                                    className="w-20 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1 text-white/70 text-xs focus:outline-none" />
                                  <button onClick={() => saveMaxSamples(prioActiveFactory, prioMaxEditing[prioActiveFactory])}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-white text-black font-semibold">Save</button>
                                  <button onClick={() => setPrioMaxEditing(prev => { const n = { ...prev }; delete n[prioActiveFactory]; return n; })}
                                    className="text-[10px] px-2 py-1 rounded-lg border border-white/[0.06] text-white/30">Cancel</button>
                                </div>
                              ) : (
                                <button onClick={() => setPrioMaxEditing(prev => ({ ...prev, [prioActiveFactory]: String(max) }))}
                                  className="flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white transition">
                                  {max} samples allowed
                                  <span className="text-[10px] text-white/25 border border-white/[0.08] px-1.5 py-0.5 rounded">edit</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${prioritizedCount >= max ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-white/[0.03] border-white/[0.08] text-white/60"}`}>
                            {prioritizedCount} / {max} samples
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {prioSaved && <span className="text-emerald-400 text-xs">Saved ✓</span>}
                          <button onClick={() => savePriorities(prioActiveFactory)} disabled={prioSaving}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 disabled:opacity-40 transition">
                            {prioSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                            Save Order
                          </button>
                        </div>
                      </div>

                      {/* Instructions */}
                      <p className="text-[11px] text-white/25">Drag samples to reorder priority. Top = highest priority. The factory portal shows samples in this order with their priority number.</p>

                      {/* Sample list */}
                      {orderedSamples.length === 0 ? (
                        <div className="text-center py-16 border border-white/[0.06] rounded-2xl">
                          <p className="text-white/20 text-sm">No pending samples for this factory</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {orderedSamples.map((sample: any, idx: number) => {
                            const product = sample.plm_products;
                            const isPrioritized = idx < max;
                            return (
                              <div key={sample.id}
                                draggable
                                onDragStart={e => e.dataTransfer.setData("text/plain", String(idx))}
                                onDragOver={e => { e.preventDefault(); setDragOver(sample.id); }}
                                onDragLeave={() => setDragOver(null)}
                                onDrop={e => {
                                  e.preventDefault();
                                  setDragOver(null);
                                  const fromIdx = parseInt(e.dataTransfer.getData("text/plain"));
                                  moveSample(prioActiveFactory, fromIdx, idx);
                                }}
                                className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition cursor-grab active:cursor-grabbing ${
                                  dragOver === sample.id ? "border-blue-500/40 bg-blue-500/5" :
                                  isPrioritized ? "border-white/[0.08] bg-white/[0.02]" : "border-white/[0.04] bg-transparent opacity-50"
                                }`}>
                                {/* Priority number */}
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                  isPrioritized ? "bg-blue-500/20 border border-blue-500/30 text-blue-400" : "bg-white/[0.04] border border-white/[0.06] text-white/20"
                                }`}>
                                  {isPrioritized ? idx + 1 : "—"}
                                </div>
                                {/* Product image + name */}
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {product?.images?.[0] && <img src={product.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />}
                                  <div className="min-w-0">
                                    <p className="text-sm text-white/80 font-medium truncate">{product?.name}</p>
                                    {product?.sku && <p className="text-[10px] text-white/30 font-mono">{product.sku}</p>}
                                  </div>
                                </div>
                                {/* Status */}
                                <div className="flex items-center gap-2">
                                  {/* Type badge */}
                                  <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${
                                    sample.label === "revision" ? "bg-amber-500/20 border-amber-500/40 text-amber-300" :
                                    sample.label === "additional" ? "bg-purple-500/20 border-purple-500/40 text-purple-300" :
                                    "bg-blue-500/20 border-blue-500/40 text-blue-300"
                                  }`}>
                                    {sample.label === "revision" ? "Revision" : sample.label === "additional" ? "Additional" : "First Sample"}
                                  </span>
                                  {/* Stage badge with color */}
                                  {sample.current_stage && (() => {
                                    const stageColorMap: Record<string,string> = { sample_production: "#f59e0b", sample_complete: "#10b981", sample_shipped: "#3b82f6", sample_arrived: "#8b5cf6", revision_requested: "#f59e0b" };
                                    const sc = stageColorMap[sample.current_stage] || "#6b7280";
                                    const sl = sample.current_stage.replace(/_/g, " ").replace(/\w/g, (c: string) => c.toUpperCase());
                                    return (
                                      <span className="text-xs px-3 py-1 rounded-full border font-medium" style={{ background: `${sc}15`, borderColor: `${sc}40`, color: sc }}>
                                        {sl}
                                      </span>
                                    );
                                  })()}
                                  {/* Upcoming badge only if over capacity */}
                                  {!isPrioritized && (
                                    <span className="text-xs px-3 py-1 rounded-full border font-medium bg-amber-500/10 border-amber-500/20 text-amber-400">
                                      Upcoming
                                    </span>
                                  )}
                                  {!isPrioritized && <span className="text-[10px] text-amber-400/60">Upcoming</span>}
                                </div>
                                {/* Drag handle */}
                                <div className="flex flex-col gap-0.5 flex-shrink-0 opacity-30">
                                  <div className="w-4 h-0.5 bg-white/40 rounded" />
                                  <div className="w-4 h-0.5 bg-white/40 rounded" />
                                  <div className="w-4 h-0.5 bg-white/40 rounded" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
