"use client";
import { createBrowserClient } from "@supabase/ssr";
const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

import { useState, useEffect } from "react";
import CollectionsView from "@/components/CollectionsView";
import { useRouter } from "next/navigation";
import { Package, Plus, ChevronRight, Loader2, Layers, Factory, X, Check, Trash2, Users, Upload, Download, FileSpreadsheet, FileText, Building2 } from "lucide-react";

const BATCH_STAGE_ORDER = ["po_issued","production_started","production_complete","qc_inspection","ready_to_ship","shipped"];
const BATCH_STAGE_LABELS: Record<string,string> = { po_issued:"PO Issued", production_started:"Production Started", production_complete:"Production Complete", qc_inspection:"QC Inspection", ready_to_ship:"Ready to Ship", shipped:"Shipped" };
const BATCH_STAGE_COLORS: Record<string,string> = { po_issued:"#f59e0b", production_started:"#f59e0b", production_complete:"#10b981", qc_inspection:"#f59e0b", ready_to_ship:"#3b82f6", shipped:"#10b981" };
const DEV_STAGE_LABELS: Record<string,string> = { concept:"Concept", ready_for_quote:"Ready for Quote", artwork_sent:"Artwork Sent", quotes_received:"Quotes Received", samples_requested:"Samples Requested", sample_production:"Sample Production", sample_complete:"Sample Complete", sample_shipped:"Sample Shipped", sample_arrived:"Sample Arrived", sample_approved:"Sample Approved" };
const DEV_STAGE_COLORS: Record<string,string> = { concept:"#6b7280", ready_for_quote:"#ec4899", artwork_sent:"#8b5cf6", quotes_received:"#3b82f6", samples_requested:"#f59e0b", sample_production:"#f59e0b", sample_complete:"#f59e0b", sample_shipped:"#3b82f6", sample_arrived:"#10b981", sample_approved:"#10b981" };
const SEASONS = ["Spring", "Summer", "Fall", "Winter", "Holiday", "Resort", "Pre-Fall"];
const EXPORT_COLUMNS = ["name","sku","description","specs","category","collection","factory","weight","dimensions","target_elc","target_sell_price","margin","order_quantity","moq","current_stage","notes","images"];
const COLUMN_LABELS: Record<string,string> = { name:"Product Name", sku:"SKU", description:"Description", specs:"Specifications", weight:"Weight", dimensions:"Dimensions", category:"Category", collection:"Collection", factory:"Factory", target_elc:"ELC ($)", target_sell_price:"Sell Price ($)", margin:"Margin (%)", order_quantity:"Order Qty", moq:"MOQ", current_stage:"Stage", notes:"Notes", images:"Image URL" };

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
  const [productTracks, setProductTracks] = useState<Record<string, any[]>>({});
  const [factories, setFactories] = useState<any[]>([]);
  const [portalUsers, setPortalUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"collections"|"all_products"|"factory_access"|"designer_access"|"prioritization">("all_products");
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showInlineCollection, setShowInlineCollection] = useState(false);
  const [inlineCollectionName, setInlineCollectionName] = useState("");
  const [showNewPortalUser, setShowNewPortalUser] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [adminName, setAdminName] = useState("Admin");
  const [assignDesigners, setAssignDesigners] = useState<any[]>([]);
  const [existingAssignments, setExistingAssignments] = useState<Record<string, string[]>>({});
  const [selectedDesignerIds, setSelectedDesignerIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPortalUser, setSavingPortalUser] = useState(false);
  const [deletingPortalUser, setDeletingPortalUser] = useState<string|null>(null);
  const [filterStage, setFilterStage] = useState("");
  const [filterCollection, setFilterCollection] = useState("");
  const [filterFactory, setFilterFactory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingProducts, setDeletingProducts] = useState(false);
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
  const [newProduct, setNewProduct] = useState({ name:"", sku:"", description:"", specs:"", category:"", collection_id:"", factory_id:"", target_elc:"", target_sell_price:"", moq:"", order_quantity:"", notes:"", weight:"", dimensions:"" });
  const [newPortalUser, setNewPortalUser] = useState({ name:"", email:"", password:"", factory_id:"", role:"factory" });
  
  // Factory management
  const [showAddFactory, setShowAddFactory] = useState(false);
  const [savingFactory, setSavingFactory] = useState(false);
  const [newFactory, setNewFactory] = useState({ name: "", email: "", contact_name: "", notes: "" });
  const [deletingFactory, setDeletingFactory] = useState<string | null>(null);
  const [showPortalModal, setShowPortalModal] = useState<{ factory: any } | null>(null);
  const [portalPassword, setPortalPassword] = useState("");
  const [creatingPortal, setCreatingPortal] = useState(false);



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
  const [rfqAskFor, setRfqAskFor] = useState<string[]>(["price","moq","lead_time","sample_lead_time","payment_terms"]);
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
    setFactories(catData.factories || []);
    setPortalUsers(portalData.users || []);
    // Load factory tracks for each product
    const prods = plmData.products || [];
    const tracksResults = await Promise.all(
      prods.map((p: any) => fetch(`/api/plm/tracks?product_id=${p.id}`).then(r => r.json()))
    );
    const tracksMap: Record<string, any[]> = {};
    prods.forEach((p: any, i: number) => { tracksMap[p.id] = tracksResults[i]?.tracks || []; });
    setProductTracks(tracksMap);
    setProducts(prods);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from("profiles").select("full_name").eq("id", data.user.id).single().then(({ data: p }) => {
          if (p?.full_name) setAdminName(p.full_name);
        });
      }
    });
  }, []);

  useEffect(() => { if (typeof window !== "undefined") { const params = new URLSearchParams(window.location.search); const tabParam = params.get("tab"); if (tabParam && ["collections", "all_products", "factory_access", "designer_access", "prioritization"].includes(tabParam)) { setActiveTab(tabParam as any); } } load(); }, []);
  useEffect(() => { if (activeTab === "prioritization" && prioFactories.length === 0 && !prioLoading) loadPrioritization(); }, [activeTab]);

  const loadPrioritization = async () => {
    setPrioLoading(true);
    const res = await fetch("/api/plm/prioritize");
    const data = await res.json();
    setPrioFactories(data.factories || []);
    setPrioSamples(data.samples || []);
    // Build order map per factory and auto-fix priority numbers
    const orderMap: Record<string, string[]> = {};
    for (const f of (data.factories || [])) {
      const factorySamples = (data.samples || []).filter((s: any) => s.factory_id === f.id);
      const prioritized = factorySamples.filter((s: any) => s.priority_order != null).sort((a: any, b: any) => a.priority_order - b.priority_order);
      const unprioritized = factorySamples.filter((s: any) => s.priority_order == null);
      const ordered = [...prioritized, ...unprioritized].map((s: any) => s.id);
      orderMap[f.id] = ordered;
      // Auto-save corrected priority numbers
      await fetch("/api/plm/prioritize", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_priorities", factory_id: f.id, ordered_ids: ordered }) });
    }
    setPrioOrder(orderMap);
    if (!prioActiveFactory && data.factories?.length > 0) setPrioActiveFactory(data.factories[0].id);
    setPrioLoading(false);
  };

  const savePriorities = async (factoryId: string) => {
    setPrioSaving(true);
    await fetch("/api/plm/prioritize", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_priorities", factory_id: factoryId, ordered_ids: prioOrder[factoryId] || [], changer_name: adminName }) });
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
    setNewProduct({ name:"", sku:"", description:"", specs:"", category:"", collection_id:"", factory_id:"", target_elc:"", target_sell_price:"", moq:"", order_quantity:"", notes:"", weight:"", dimensions:"" });
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

  const createFactory = async () => {
    if (!newFactory.name || !newFactory.email) return;
    setSavingFactory(true);
    await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_factory", ...newFactory }),
    });
    setSavingFactory(false);
    setShowAddFactory(false);
    setNewFactory({ name: "", email: "", contact_name: "", notes: "" });
    load();
  };

  const deleteFactory = async (id: string) => {
    if (!confirm("Delete this factory? This will also remove their portal access.")) return;
    setDeletingFactory(id);
    await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_factory", id }),
    });
    setDeletingFactory(null);
    load();
  };

  const createFactoryPortal = async () => {
    if (!showPortalModal || !portalPassword) return;
    setCreatingPortal(true);
    const res = await fetch("/api/portal/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: showPortalModal.factory.contact_name || showPortalModal.factory.name,
        email: showPortalModal.factory.email,
        password: portalPassword,
        factory_id: showPortalModal.factory.id,
        role: "factory",
        send_email: true,
      }),
    });
    setCreatingPortal(false);
    if (res.ok) {
      setShowPortalModal(null);
      setPortalPassword("");
      load();
    }
  };

  const deletePortalUser = async (id: string) => {
    setDeletingPortalUser(id);
    await fetch("/api/plm/portal-users", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"delete", id }) });
    setDeletingPortalUser(null); load();
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string|null>(null);
  const deleteProduct = async (id: string) => {
    await fetch("/api/plm", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ action:"delete_product", id }) });
    setConfirmDeleteId(null); load();
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
    if (filterFactory) {
      const tracks: any[] = p.plm_factory_tracks || [];
      const hasActive = tracks.some((t: any) => t.factory_id === filterFactory && t.status === "active");
      if (!hasActive) return false;
    }
    return true;
  });

  const ACTION_SORT: Record<string, number> = { action_required: 0, updates_made: 1, up_to_date: 2 };
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    // Killed/hold go to bottom
    if (a.killed && !b.killed) return 1;
    if (!a.killed && b.killed) return -1;
    if (a.status === "hold" && b.status !== "hold") return 1;
    if (a.status !== "hold" && b.status === "hold") return -1;
    const aScore = ACTION_SORT[a.action_status || "up_to_date"] ?? 2;
    const bScore = ACTION_SORT[b.action_status || "up_to_date"] ?? 2;
    if (aScore !== bScore) return aScore - bScore;
    // Last updated first
    return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
  });

  const hasActionRequired = filteredProducts.some(p => p.action_status === "action_required");
  const hasUpdatesMade = filteredProducts.some(p => p.action_status === "updates_made");

  const ic = "w-full bg-bg-elevated border border-bg-border rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20 transition";
  const lc = "text-[11px] text-text-muted mb-1 block";

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <div className="border-b border-bg-border px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-white/5 border border-bg-border flex items-center justify-center">
                <Package size={14} className="text-text-secondary" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Product Lifecycle</h1>
              <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">{products.length} SKUs</span>
            </div>
            <p className="text-text-muted text-sm">Track every product from concept to shelf</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowImportModal(true); setImportStep("upload"); setImportData(null); setImportResult(null); }}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl border border-bg-border text-text-secondary hover:text-white/80 hover:border-white/20 transition bg-bg-surface">
              <Upload size={11} />Import
            </button>
            <button onClick={() => setShowNewProduct(true)}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl border border-bg-border text-text-secondary hover:text-white/80 hover:border-white/20 transition bg-bg-surface">
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
            <div className="bg-bg-elevated border border-bg-border rounded-2xl w-full max-w-2xl p-6 space-y-4 my-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Import Products from Spreadsheet</p>
                  <p className="text-xs text-text-muted mt-0.5">Upload a CSV or Excel file — Jimmy will map the columns automatically</p>
                </div>
                <button onClick={() => setShowImportModal(false)} className="text-text-muted hover:text-text-secondary"><X size={14} /></button>
              </div>
              {importStep === "upload" && (
                <label className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-bg-border rounded-xl cursor-pointer hover:border-white/20 transition">
                  {importing ? <Loader2 size={24} className="animate-spin text-text-muted mb-3" /> : <FileSpreadsheet size={24} className="text-text-muted mb-3" />}
                  <p className="text-sm text-text-secondary">{importing ? "Reading file & mapping columns..." : "Click to upload CSV or Excel"}</p>
                  <p className="text-xs text-text-muted mt-1">Supports .csv, .xlsx, .xls</p>
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
                        <span className="text-xs text-text-secondary w-40 truncate flex-shrink-0">{header}</span>
                        <span className="text-text-muted text-xs">→</span>
                        <select value={importMappings[header] || "ignore"} onChange={e => setImportMappings((prev: any) => ({...prev, [header]: e.target.value}))} className="flex-1 bg-bg-elevated border border-bg-border rounded-lg px-3 py-1.5 text-text-secondary text-xs focus:outline-none">
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
                  <p className="text-xs text-text-muted">{importData.all_rows.length} products will be imported</p>
                  <div className="flex gap-2">
                    <button onClick={handleImport} disabled={importing} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                      {importing ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                      {importing ? "Importing..." : `Import ${importData.all_rows.length} Products`}
                    </button>
                    <button onClick={() => setShowImportModal(false)} className="px-4 rounded-xl border border-bg-border text-text-muted text-xs">Cancel</button>
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
                      <p className="text-xs text-text-muted">{importResult.errors.length} errors:</p>
                      {importResult.errors.map((e: string, i: number) => <p key={i} className="text-xs text-red-400">{e}</p>)}
                    </div>
                  )}
                  <button onClick={() => setShowImportModal(false)} className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-semibold">Done</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-bg-elevated border border-red-500/20 rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={16} className="text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">Delete {selectedProducts.length} product{selectedProducts.length > 1 ? "s" : ""}?</p>
                  <p className="text-xs text-text-secondary mt-0.5">This cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={async () => {
                  setDeletingProducts(true);
                  for (const pid of selectedProducts) {
                    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "delete_product", product_id: pid }) });
                  }
                  setDeletingProducts(false);
                  setShowDeleteConfirm(false);
                  setSelectedProducts([]);
                  setSelectMode(false);
                  load();
                }} disabled={deletingProducts}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-40">
                  {deletingProducts ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Yes, delete
                </button>
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-bg-border text-text-secondary text-sm font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Assign Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-bg-elevated border border-bg-border rounded-2xl p-6 w-full max-w-sm space-y-4">
              <h3 className="text-sm font-bold text-text-primary">Assign {selectedProducts.length} Products</h3>
              <p className="text-xs text-text-secondary">Select team members to assign these products to.</p>
              <div className="space-y-2">
                {assignDesigners.length === 0 && <p className="text-xs text-text-muted">No designers found. Add designers in the Designer Access tab.</p>}
                {assignDesigners.map((d: any) => {
                  const assignedCount = selectedProducts.filter(pid => (existingAssignments[pid] || []).includes(d.id)).length;
                  const alreadyInAll = assignedCount === selectedProducts.length;
                  const alreadyInSome = assignedCount > 0 && !alreadyInAll;
                  return (
                  <button key={d.id} onClick={() => { if (alreadyInAll) return; setSelectedDesignerIds(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id]); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition ${alreadyInAll ? "border-white/[0.04] opacity-40 cursor-default" : selectedDesignerIds.includes(d.id) ? "border-blue-500/40 bg-blue-500/10" : "border-bg-border hover:border-white/15"}`}>
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-text-secondary">
                      {(d.name || d.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-xs font-semibold text-white/80">{d.name || d.email}</p>
                      {alreadyInAll && <p className="text-[10px] text-emerald-400/60">Already assigned to all</p>}
                      {alreadyInSome && <p className="text-[10px] text-text-muted">Assigned to {assignedCount}/{selectedProducts.length} products</p>}
                      {!alreadyInAll && !alreadyInSome && d.name && <p className="text-[10px] text-text-muted">{d.email}</p>}
                    </div>
                    {selectedDesignerIds.includes(d.id) && <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
                  </button>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={async () => {
                  setAssigning(true);
                  for (const pid of selectedProducts) {
                    await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "assign_product", product_id: pid, designer_ids: selectedDesignerIds }) });
                  }
                  setAssigning(false);
                  setShowAssignModal(false);
                  setSelectedProducts([]);
                  load();
                }} disabled={assigning || selectedDesignerIds.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                  {assigning ? "Assigning..." : `Assign to ${selectedDesignerIds.length} member${selectedDesignerIds.length !== 1 ? "s" : ""}`}
                </button>
                <button onClick={() => setShowAssignModal(false)} className="px-4 rounded-xl border border-bg-border text-text-muted text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-bg-elevated border border-bg-border rounded-2xl w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Export Product Catalog</p>
                  <p className="text-xs text-text-muted mt-0.5">{selectedProducts.length} products selected</p>
                </div>
                <button onClick={() => setShowExportModal(false)} className="text-text-muted hover:text-text-secondary"><X size={14} /></button>
              </div>
              <div>
                <p className="text-[11px] text-text-muted mb-2">Presets</p>
                <div className="flex gap-2 flex-wrap">
                  {[["buyer","Buyer Catalog"],["internal","Internal"],["factory","Factory Sheet"],["custom","Custom"]].map(([key, label]) => (
                    <button key={key} onClick={() => applyPreset(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${exportPreset === key ? "bg-white text-black border-white" : "border-bg-border text-text-secondary hover:text-white/70"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-text-muted mb-2">Columns to include</p>
                <div className="grid grid-cols-2 gap-2">
                  {EXPORT_COLUMNS.map(col => (
                    <label key={col} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={exportColumns.includes(col)} onChange={e => setExportColumns(prev => e.target.checked ? [...prev, col] : prev.filter(c => c !== col))} className="rounded" />
                      <span className="text-xs text-text-secondary">{COLUMN_LABELS[col]}</span>
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
                <button onClick={() => setShowExportModal(false)} className="px-4 rounded-xl border border-bg-border text-text-muted text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* RFQ Modal */}
        {/* Delete confirmation modal */}
        {confirmDeleteId && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-bg-elevated border border-bg-border rounded-2xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-400 text-sm">✕</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Delete Product</p>
                  <p className="text-xs text-text-secondary mt-0.5">This cannot be undone. All factory tracks and samples will be removed.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-bg-border text-text-secondary text-xs hover:text-white transition">
                  Cancel
                </button>
                <button onClick={() => deleteProduct(confirmDeleteId)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/30 transition">
                  Delete Product
                </button>
              </div>
            </div>
          </div>
        )}

        {showRfqModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-bg-elevated border border-bg-border rounded-2xl w-full max-w-2xl p-6 space-y-5 my-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Create RFQ</p>
                  <p className="text-xs text-text-muted mt-0.5">Select products, choose what to include and ask for, then export to Workflows</p>
                </div>
                <button onClick={() => setShowRfqModal(false)} className="text-text-muted hover:text-text-secondary"><X size={14} /></button>
              </div>

              {/* Product selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-text-muted uppercase tracking-widest">Products to Include</p>
                  <div className="flex gap-2">
                    <button onClick={() => setRfqSelectedProducts(products.filter(p => p.current_stage === "ready_for_quote").map(p => p.id))}
                      className="text-[11px] text-pink-400 hover:text-pink-300 transition">Select RFQ Ready</button>
                    <button onClick={() => setRfqSelectedProducts(products.map(p => p.id))}
                      className="text-[11px] text-text-muted hover:text-text-secondary transition">Select All</button>
                    <button onClick={() => setRfqSelectedProducts([])}
                      className="text-[11px] text-text-muted hover:text-text-secondary transition">Clear</button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-bg-border rounded-xl p-3">
                  {products.map(p => (
                    <label key={p.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-bg-surface px-2 py-1.5 rounded-lg transition">
                      <input type="checkbox" checked={rfqSelectedProducts.includes(p.id)}
                        onChange={e => setRfqSelectedProducts(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))}
                        className="rounded" />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {p.images?.[0] && <img src={p.images[0]} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />}
                        <span className="text-xs text-white/70 truncate">{p.name}</span>
                        {p.sku && <span className="text-[10px] text-text-muted font-mono flex-shrink-0">{p.sku}</span>}
                        {p.current_stage === "ready_for_quote" && <span className="text-[10px] text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0">RFQ Ready</span>}
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-white/25 mt-1.5">{rfqSelectedProducts.length} products selected</p>
              </div>

              {/* What to include */}
              <div>
                <p className="text-[11px] text-text-muted uppercase tracking-widest mb-2">Include in Sheet</p>
                <div className="grid grid-cols-3 gap-2">
                  {[["name","Product Name"],["sku","SKU"],["description","Description"],["specs","Specifications"],["weight","Weight"],["dimensions","Dimensions"],["images","Image URLs"],["reference_url","Dropbox Link"],["category","Category"],["collection","Collection"],["notes","Notes"]].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={rfqInclude.includes(key)}
                        onChange={e => setRfqInclude(prev => e.target.checked ? [...prev, key] : prev.filter(k => k !== key))}
                        className="rounded" />
                      <span className="text-xs text-text-secondary">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* What to ask factories */}
              <div>
                <p className="text-[11px] text-text-muted uppercase tracking-widest mb-2">Ask Factories to Fill In</p>
                <div className="grid grid-cols-3 gap-2">
                  {[["price","Unit Price"],["sample_lead_time","Sample Lead Time"],["moq","MOQ"],["lead_time","Production Lead Time"],["sample_price","Sample Price"],["payment_terms","Payment Terms"],["packaging","Packaging Details"],["notes","Notes/Comments"]].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={rfqAskFor.includes(key)}
                        onChange={e => setRfqAskFor(prev => e.target.checked ? [...prev, key] : prev.filter(k => k !== key))}
                        className="rounded" />
                      <span className="text-xs text-text-secondary">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {rfqJobId && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                  <Check size={14} className="text-emerald-400" />
                  <p className="text-xs text-emerald-700">RFQ job created! <button onClick={() => { setShowRfqModal(false); router.push(`/workflows/factory-quote`); }} className="underline ml-1 font-semibold">Open in Workflows →</button></p>
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
                <button onClick={() => { setShowRfqModal(false); setRfqJobId(null); }} className="px-4 rounded-xl border border-bg-border text-text-muted text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Sample Request Modal */}
        {showSampleRequestModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-bg-elevated border border-bg-border rounded-2xl w-full max-w-2xl p-6 space-y-5 my-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Request Samples</p>
                  <p className="text-xs text-text-muted mt-0.5">Select products and pick which factories to request from</p>
                </div>
                <button onClick={() => setShowSampleRequestModal(false)} className="text-text-muted hover:text-text-secondary"><X size={14} /></button>
              </div>

              {/* Collection quick-select */}
              {collections.length > 0 && (
                <div className="border border-bg-border rounded-xl p-3 space-y-2 bg-bg-surface">
                  <p className="text-[10px] text-text-muted uppercase tracking-widest">Quick-select by collection</p>
                  <div className="flex flex-wrap gap-1.5">
                    {collections.map((c: any) => {
                      const collectionProductIds = products
                        .filter((p: any) => p.collection_id === c.id && !p.killed)
                        .map((p: any) => p.id);
                      const allSelected = collectionProductIds.every((id: string) => bulkSampleProductIds.includes(id));
                      return (
                        <button key={c.id}
                          onClick={() => {
                            if (allSelected) {
                              setBulkSampleProductIds(prev => prev.filter((id: string) => !collectionProductIds.includes(id)));
                            } else {
                              setBulkSampleProductIds(prev => Array.from(new Set([...prev, ...collectionProductIds])));
                              // Auto-select all factories for each product
                              const newSelections: Record<string, any> = { ...bulkSampleSelections };
                              collectionProductIds.forEach((pid: string) => {
                                if (!newSelections[pid]) {
                                  newSelections[pid] = factories.map((f: any) => f.id);
                                }
                              });
                              setBulkSampleSelections(newSelections);
                            }
                          }}
                          className={`text-[10px] px-3 py-1.5 rounded-lg border transition font-medium ${allSelected ? "border-amber-500/60 bg-transparent text-text-primary font-bold" : "border-bg-border text-text-secondary hover:text-text-primary hover:border-bg-border"}`}>
                          {c.name} ({collectionProductIds.length})
                        </button>
                      );
                    })}
                    <button onClick={() => {
                      const allIds = products.filter((p: any) => !p.killed).map((p: any) => p.id);
                      setBulkSampleProductIds(allIds);
                      const newSelections: Record<string, any> = {};
                      allIds.forEach((pid: string) => { newSelections[pid] = factories.map((f: any) => f.id); });
                      setBulkSampleSelections(newSelections);
                    }} className="text-[10px] px-3 py-1.5 rounded-lg border border-bg-border text-text-muted hover:text-text-secondary transition">
                      Select All
                    </button>
                    <button onClick={() => { setBulkSampleProductIds([]); setBulkSampleSelections({}); }}
                      className="text-[10px] px-3 py-1.5 rounded-lg border border-bg-border text-text-muted hover:text-text-secondary transition">
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Info note */}
              <div className="flex items-start gap-2.5 bg-bg-surface border border-bg-border rounded-xl px-3 py-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white/30 flex-shrink-0 mt-1" />
                <p className="text-[11px] text-text-secondary">Products with active sample requests are not shown here. To request an additional sample or revision, open the individual product card.</p>
              </div>

              {/* Product list with factory picker per product */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {products.filter(p => {
                  if (p.killed) return false;
                  // Hide only if there's an active (non-killed) sample request
                  const activeRequest = (p.plm_sample_requests || []).find((r: any) => r.status === "requested");
                  if (activeRequest) return false;
                  return true;
                }).map((p: any) => {
                  const isSelected = bulkSampleProductIds.includes(p.id);
                  const selectedFactories = bulkSampleSelections[p.id] || [];
                  const approvedReq = (p.plm_sample_requests || []).find((r: any) => r.status === "approved");
                  const isAdditional = !!approvedReq;
                  const approvedFactory = isAdditional ? factories.find((f: any) => f.id === approvedReq.factory_id) : null;
                  return (
                    <div key={p.id} className={`border rounded-xl p-3 space-y-2 transition ${isSelected ? "border-amber-500/30 bg-amber-500/[0.03]" : "border-bg-border"}`}>
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
                          {p.sku && <span className="text-[10px] text-text-muted font-mono flex-shrink-0">{p.sku}</span>}
                          {isAdditional && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/20 flex-shrink-0">Additional</span>}
                        </div>
                      </label>
                      {isSelected && (
                        <div className="pl-6 space-y-2">
                          {isAdditional ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs text-text-secondary">
                                <span className="text-[10px] text-text-muted uppercase tracking-widest">Factory:</span>
                                <span className="px-2 py-0.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700">{approvedFactory?.name || "Approved factory"}</span>
                                <span className="text-[10px] text-text-muted">(locked — approved factory only)</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Quantity *</p>
                                  <input type="number" placeholder="e.g. 3"
                                    value={bulkSampleSelections[`${p.id}_qty`] || ""}
                                    onChange={e => setBulkSampleSelections(prev => ({ ...prev, [`${p.id}_qty`]: e.target.value }))}
                                    className="w-full bg-bg-elevated border border-bg-border rounded-lg px-2 py-1.5 text-white/70 text-xs focus:outline-none" />
                                </div>
                                <div>
                                  <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Reason *</p>
                                  <input type="text" placeholder="e.g. Color change"
                                    value={bulkSampleSelections[`${p.id}_reason`] || ""}
                                    onChange={e => setBulkSampleSelections(prev => ({ ...prev, [`${p.id}_reason`]: e.target.value }))}
                                    className="w-full bg-bg-elevated border border-bg-border rounded-lg px-2 py-1.5 text-white/70 text-xs focus:outline-none" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Request from:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {factories.map((f: any) => (
                                  <button key={f.id} onClick={() => setBulkSampleSelections(prev => ({
                                    ...prev,
                                    [p.id]: selectedFactories.includes(f.id) ? selectedFactories.filter((id: string) => id !== f.id) : [...selectedFactories, f.id]
                                  }))}
                                    className={`text-xs px-2.5 py-1 rounded-lg border transition ${selectedFactories.includes(f.id) ? "border-amber-500/60 bg-transparent text-text-primary font-bold" : "border-bg-border text-text-muted hover:text-text-secondary"}`}>
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
                <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1.5">Note to factories (optional)</p>
                <textarea value={bulkSampleNote} onChange={e => setBulkSampleNote(e.target.value)}
                  placeholder="e.g. Priority samples needed by May 1st"
                  rows={2} className="w-full bg-bg-elevated border border-bg-border rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none resize-none" />
              </div>

              <div className="flex gap-2">
                <button onClick={async () => {
                  const toRequest = bulkSampleProductIds.filter(id => Array.isArray(bulkSampleSelections[id]) && bulkSampleSelections[id].length > 0);
                  if (!toRequest.length) return;
                  setSubmittingBulkSample(true);
                  // Group products by factory for bulk email
                  await fetch("/api/plm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "bulk_sample_requests",
                      items: toRequest.map(productId => {
                        const p = products.find((pr: any) => pr.id === productId);
                        const isAdditional = (p?.plm_sample_requests || []).some((r: any) => r.status === "approved");
                        return {
                          product_id: productId,
                          factory_ids: bulkSampleSelections[productId],
                          note: isAdditional ? bulkSampleSelections[`${productId}_reason`] : bulkSampleNote,
                          force: isAdditional,
                          label: isAdditional ? "additional" : undefined,
                          qty: isAdditional ? parseInt(bulkSampleSelections[`${productId}_qty`]) || undefined : undefined,
                        };
                      }),
                      note: bulkSampleNote,
                      provider: "gmail",
                    }),
                  });
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
                <button onClick={() => setShowSampleRequestModal(false)} className="px-4 rounded-xl border border-bg-border text-text-muted text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* New Collection Modal */}
        {showNewCollection && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-bg-elevated border border-bg-border rounded-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text-primary">New Collection</p>
                <button onClick={() => setShowNewCollection(false)} className="text-text-muted hover:text-text-secondary"><X size={14} /></button>
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
                <button onClick={() => setShowNewCollection(false)} className="px-4 rounded-xl border border-bg-border text-text-muted text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* New Product Modal */}
        {showNewProduct && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-bg-elevated border border-bg-border rounded-2xl w-full max-w-lg p-6 space-y-4 my-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text-primary">New Product / SKU</p>
                <button onClick={() => setShowNewProduct(false)} className="text-text-muted hover:text-text-secondary"><X size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lc}>Product Name *</label><input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="16oz Glass Dog Cup" className={ic} /></div>
                <div><label className={lc}>SKU</label><input value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} placeholder="GL-001" className={ic} /></div>
              </div>
              <div><label className={lc}>Description</label><input value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} placeholder="Brief product description" className={ic} /></div>
              <div><label className={lc}>Specs</label><textarea value={newProduct.specs} onChange={e => setNewProduct({...newProduct, specs: e.target.value})} placeholder="Material, size, color..." rows={2} className={`${ic} resize-none`} /></div>
              <div>
                <label className={lc}>Collection</label>
                {!showInlineCollection ? (
                  <div className="flex gap-2">
                    <select value={newProduct.collection_id} onChange={e => setNewProduct({...newProduct, collection_id: e.target.value})} className={`${ic} flex-1`}>
                      <option value="">No collection</option>
                      {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowInlineCollection(true)}
                      className="px-3 py-2 rounded-xl border border-bg-border text-text-secondary hover:text-white/70 text-xs whitespace-nowrap">+ New</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input autoFocus value={inlineCollectionName} onChange={e => setInlineCollectionName(e.target.value)}
                      placeholder="Collection name..." className={`${ic} flex-1`} />
                    <button type="button" onClick={async () => {
                      if (!inlineCollectionName.trim()) return;
                      const res = await fetch("/api/plm", { method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "create_collection", name: inlineCollectionName.trim() }) });
                      const data = await res.json();
                      if (data.collection?.id) {
                        setCollections(prev => [...prev, data.collection]);
                        setNewProduct(p => ({ ...p, collection_id: data.collection.id }));
                      }
                      setShowInlineCollection(false);
                      setInlineCollectionName("");
                    }} className="px-3 py-2 rounded-xl bg-white text-black text-xs font-semibold">Create</button>
                    <button type="button" onClick={() => { setShowInlineCollection(false); setInlineCollectionName(""); }}
                      className="px-3 py-2 rounded-xl border border-bg-border text-text-muted text-xs">✕</button>
                  </div>
                )}
              </div>
              <div>
                <label className={lc}>Category</label>
                <input value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} placeholder="Glassware" className={ic} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lc}>Weight (e.g. 0.5 kg)</label><input value={(newProduct as any).weight || ""} onChange={e => setNewProduct({...newProduct, weight: e.target.value} as any)} placeholder="0.5 kg" className={ic} /></div>
                <div><label className={lc}>Dimensions (e.g. 10x5x3 cm)</label><input value={(newProduct as any).dimensions || ""} onChange={e => setNewProduct({...newProduct, dimensions: e.target.value} as any)} placeholder="10x5x3 cm" className={ic} /></div>
              </div>
              <div><label className={lc}>Notes</label><textarea value={newProduct.notes} onChange={e => setNewProduct({...newProduct, notes: e.target.value})} rows={2} className={`${ic} resize-none`} /></div>
              <div className="flex gap-2">
                <button onClick={createProduct} disabled={saving || !newProduct.name} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Create Product
                </button>
                <button onClick={() => setShowNewProduct(false)} className="px-4 rounded-xl border border-bg-border text-text-muted text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-bg-elevated border border-bg-border rounded-xl p-0.5 w-fit mb-8">
          <button onClick={() => setActiveTab("all_products")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "all_products" ? "bg-white text-black" : "text-text-secondary"}`}>All Products</button>
          <button onClick={() => setActiveTab("collections")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "collections" ? "bg-white text-black" : "text-text-secondary"}`}>Collections</button>
          <button onClick={() => setActiveTab("factory_access")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "factory_access" ? "bg-white text-black" : "text-text-secondary"}`}>Factory Access</button>
          <button onClick={() => setActiveTab("designer_access")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "designer_access" ? "bg-white text-black" : "text-text-secondary"}`}>Designer Access</button>
          <button onClick={() => setActiveTab("prioritization")} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "prioritization" ? "bg-white text-black" : "text-text-secondary"}`}>Prioritization</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-text-muted" /></div>
        ) : activeTab === "collections" ? (
          <CollectionsView
            collections={collections}
            factories={factories}
            onRFQ={(productIds: string[]) => { setRfqSelectedProducts(productIds); setShowRfqModal(true); }}
            onSampleRequest={(productIds: string[]) => {
              setBulkSampleProductIds(productIds);
              // Pre-select factories for each product
              const sel: Record<string, string[]> = {};
              productIds.forEach((pid: string) => {
                const p = products.find((pr: any) => pr.id === pid);
                const activeFactoryIds = (p?.plm_factory_tracks || []).filter((t: any) => t.status === "active").map((t: any) => t.factory_id);
                sel[pid] = activeFactoryIds.length > 0 ? activeFactoryIds : factories.map((f: any) => f.id);
              });
              setBulkSampleSelections(sel);
              setShowSampleRequestModal(true);
            }}
            onNavigate={(collectionId: string) => { setFilterCollection(collectionId); setActiveTab("all_products"); }}
          />
        ) : activeTab === "all_products" ? (
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search products..." className="bg-bg-elevated border border-bg-border rounded-xl px-3 py-2 text-white/70 placeholder-white/20 text-xs focus:outline-none focus:border-white/20 transition w-44" />
<select value={filterCollection} onChange={e => setFilterCollection(e.target.value)} className="bg-bg-elevated border border-bg-border rounded-xl px-3 py-2 text-text-secondary text-xs focus:outline-none">
                  <option value="">All Collections</option>
                  {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={filterFactory} onChange={e => setFilterFactory(e.target.value)} className="bg-bg-elevated border border-bg-border rounded-xl px-3 py-2 text-text-secondary text-xs focus:outline-none">
                  <option value="">All Factories</option>
                  {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {(filterStage || filterCollection || filterFactory) && (
                  <button onClick={() => { setFilterStage(""); setFilterCollection(""); setFilterFactory(""); setSearchQuery(""); }} className="text-[11px] text-text-muted hover:text-text-secondary flex items-center gap-1">
                    <X size={10} />Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => {
                  const rfqReady = products.filter(p => p.current_stage === "ready_for_quote").map(p => p.id);
                  setRfqSelectedProducts(rfqReady);
                  setShowRfqModal(true);
                }} className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-pink-500 text-white font-semibold hover:bg-pink-400 transition">
                  <FileSpreadsheet size={11} />RFQ
                </button>
                <button onClick={() => {
                  setBulkSampleProductIds([]);
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
              <div className="text-center py-20"><Package size={32} className="text-white/10 mx-auto mb-3" /><p className="text-text-muted text-sm">No products yet</p></div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3 px-4 py-2">
                  <button onClick={() => { setSelectMode(s => !s); setSelectedProducts([]); }} className={`flex items-center gap-2 text-xs px-4 py-2 rounded-xl border font-semibold transition ${selectMode ? "border-white/20 text-white/70 bg-white/5 hover:bg-bg-hover" : "border-bg-border text-text-secondary hover:bg-bg-hover"}`}>
                    {selectMode && selectedProducts.length > 0 ? `${selectedProducts.length} selected` : "Select"}
                  </button>
                  {selectMode && (
                    <button onClick={toggleAll} className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl border border-bg-border text-text-secondary hover:bg-bg-hover font-semibold transition">
                      {selectedProducts.length === filteredProducts.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                  <button onClick={() => { if (selectedProducts.length > 0) setShowExportModal(true); }} className={`flex items-center gap-2 text-xs px-4 py-2 rounded-xl border font-semibold transition ${selectedProducts.length > 0 ? "border-bg-border text-text-secondary hover:bg-bg-hover" : "border-white/[0.04] text-text-muted cursor-not-allowed"}`}>
                    <Download size={11} />{selectedProducts.length > 0 ? `Export ${selectedProducts.length}` : "Export"}
                  </button>
                  <button onClick={async () => { if (selectedProducts.length === 0) return; 
  const res = await fetch("/api/plm?type=designers"); 
  const data = await res.json(); 
  setAssignDesigners(data.designers || []); 
  setSelectedDesignerIds([]);
  // Load existing assignments for selected products
  const assignMap: Record<string, string[]> = {};
  for (const pid of selectedProducts) {
    const r = await fetch("/api/plm?type=product&id=" + pid);
    const d = await r.json();
    assignMap[pid] = (d.product?.plm_assignments || []).map((a: any) => a.designer_id);
  }
  setExistingAssignments(assignMap);
  setShowAssignModal(true); }} className={`flex items-center gap-2 text-xs px-4 py-2 rounded-xl border font-semibold transition ${selectedProducts.length > 0 ? "border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20" : "border-white/[0.04] text-text-muted cursor-not-allowed"}`}>
                    {selectedProducts.length > 0 ? `Assign ${selectedProducts.length}` : "Assign"}
                  </button>
                  {selectMode && selectedProducts.length > 0 && (
                    <button onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 font-semibold transition ml-auto">
                      <Trash2 size={11} />Delete {selectedProducts.length}
                    </button>
                  )}
                </div>
                {sortedProducts.map(product => {
                  const statusKey = getProductStatus(product);
                  const milestones = product.milestones || {};
                  const productStatusMode = product.status || "progression";
                  if (product.killed || productStatusMode === "killed") return (
                    <div key={product.id} onClick={() => router.push(`/plm/${product.id}`)} className="flex items-center gap-3 p-4 border border-red-500/10 rounded-xl bg-red-500/[0.01] opacity-50 cursor-pointer hover:opacity-70 transition">
                      {product.images?.[0] && <img src={product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 grayscale" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-secondary truncate line-through">{product.name}</p>
                        {product.sku && <p className="text-[10px] text-text-muted font-mono">{product.sku}</p>}
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400/70 border border-red-500/15 flex-shrink-0">Product Discontinued</span>
                    </div>
                  );
                  const lastMilestone = milestones.sample_approved ? "Sample Approved" : milestones.sampling ? "Sampling" : milestones.design_brief ? "Design Brief" : null;
                  const tracks = productTracks[product.id] || [];
                  const approvedTracks = tracks.filter((t: any) => t.status === "approved");
                  const activeTracks = tracks.filter((t: any) => t.status === "active");
                  const killedTracks = tracks.filter((t: any) => t.status === "killed");

                  // Build award badges from tracks
                  const awardBadges: { label: string; color: string; bg: string; border: string }[] = [];



                  // Fixed ordered badges
                  const ORDERED_STAGES = [
                    { key: "artwork_sent",     label: "Artwork Sent",     color: "#8b5cf6", bg: "#8b5cf615", border: "#8b5cf630" },
                    { key: "quote_requested",  label: "Quote Requested",  color: "#ec4899", bg: "#ec489915", border: "#ec489930" },
                    { key: "quote_received",   label: "Quote Received",   color: "#3b82f6", bg: "#3b82f615", border: "#3b82f630" },
                    { key: "sample_requested", label: "Sample Requested", color: "#f59e0b", bg: "#f59e0b15", border: "#f59e0b30" },
                    { key: "sample_reviewed",  label: "Sample Reviewed",  color: "#10b981", bg: "#10b98115", border: "#10b98130" },
                  ];

                  const totalTracks = tracks.length;

                  // Count done per stage across all tracks
                  ORDERED_STAGES.forEach(stageDef => {
                    const count = tracks.filter((t: any) =>
                      (t.plm_track_stages || []).some((s: any) => s.stage === stageDef.key && s.status === "done")
                    ).length;
                    if (count === 0) return;
                    const label = totalTracks > 1
                      ? `${stageDef.label} · ${count}/${totalTracks} factories`
                      : stageDef.label;
                    awardBadges.push({ label, color: stageDef.color, bg: stageDef.bg, border: stageDef.border });
                  });

                  // Approved factory (only 1)
                  if (approvedTracks.length > 0) {
                    const t = approvedTracks[0];
                    const price = t.approved_price ? ` · $${t.approved_price}` : "";
                    awardBadges.push({
                      label: `✓ Approved · ${t.factory_catalog?.name}${price}`,
                      color: "#10b981", bg: "#10b98115", border: "#10b98130",
                    });
                  }

                  // Orders
                  const orderCount = (product.plm_batches || []).length;
                  if (orderCount > 0) {
                    const orderFactories = Array.from(new Set((product.plm_batches || []).map((b: any) => {
                      const f = factories.find((f: any) => f.id === b.factory_id);
                      return f?.name || "Factory";
                    }))).join(", ");
                    awardBadges.push({
                      label: `${orderCount} ${orderCount === 1 ? "Order" : "Orders"} · ${orderFactories}`,
                      color: "#3b82f6", bg: "#3b82f615", border: "#3b82f630",
                    });
                  } else if (approvedTracks.length > 0) {
                    awardBadges.push({
                      label: "No orders yet",
                      color: "#6b7280", bg: "#6b728015", border: "#6b728030",
                    });
                  }

                  if (killedTracks.length > 0 && activeTracks.length === 0 && approvedTracks.length === 0) {
                    awardBadges.push({ label: "All Factories Discontinued", color: "#ef4444", bg: "#ef444415", border: "#ef444430" });
                  }

                  if (tracks.length === 0) {
                    // No tracks yet — show concept stage
                    awardBadges.push({ label: "Concept", color: "#6b7280", bg: "#6b728015", border: "#6b728030" });
                  }

                  return (
                    <div key={product.id} className="border border-bg-border rounded-xl p-4 bg-bg-surface hover:border-bg-border transition flex items-center gap-4"
                      style={{ borderColor: selectedProducts.includes(product.id) ? "var(--bg-border)" : "" }}>
                      {selectMode && <input type="checkbox" checked={selectedProducts.includes(product.id)} onChange={() => toggleProduct(product.id)} className="rounded flex-shrink-0" onClick={e => e.stopPropagation()} />}
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-10 h-10 rounded-lg object-cover border border-bg-border flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-bg-border flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/plm/${product.id}`)}>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-text-primary">{product.name}</p>
                          {product.sku && <span className="text-xs text-text-muted font-mono font-semibold">{product.sku}</span>}
                          {product.plm_collections && <span className="text-xs text-text-muted">{product.plm_collections.name}</span>}
                          {product.action_status === "action_required" && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/25 uppercase tracking-wide">⚡ Action Required</span>
                          )}
                          {product.action_status === "updates_made" && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/25 uppercase tracking-wide">● Updates Made</span>
                          )}
                          {productStatusMode === "hold" && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/25">⏸ Hold</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {awardBadges.map((badge, i) => (
                            <span key={i} className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                              style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                              {badge.label}
                            </span>
                          ))}
                          {statusKey && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${BATCH_STAGE_COLORS[statusKey]}20`, color: BATCH_STAGE_COLORS[statusKey], border: `1px solid ${BATCH_STAGE_COLORS[statusKey]}30` }}>
                              {BATCH_STAGE_LABELS[statusKey]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setConfirmDeleteId(product.id)} className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition">
                          <Trash2 size={12} />
                        </button>
                        <ChevronRight size={14} className="text-text-muted cursor-pointer" onClick={() => router.push(`/plm/${product.id}`)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === "factory_access" ? (
          <div className="space-y-8">
            {/* FACTORIES SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Your Factories</p>
                  <p className="text-xs text-text-muted mt-0.5">Add factories you work with — then create portal access for them</p>
                </div>
                <button onClick={() => setShowAddFactory(true)} className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition">
                  <Plus size={11} />Add Factory
                </button>
              </div>

              {showAddFactory && (
                <div className="border border-bg-border rounded-2xl p-5 bg-bg-surface space-y-3">
                  <p className="text-xs font-semibold text-white/70">New Factory</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lc}>Factory Name *</label><input value={newFactory.name} onChange={e => setNewFactory({...newFactory, name: e.target.value})} placeholder="Yuecheng Glass" className={ic} /></div>
                    <div><label className={lc}>Email *</label><input value={newFactory.email} onChange={e => setNewFactory({...newFactory, email: e.target.value})} placeholder="sales@factory.com" className={ic} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lc}>Contact Name</label><input value={newFactory.contact_name} onChange={e => setNewFactory({...newFactory, contact_name: e.target.value})} placeholder="Jenny Li" className={ic} /></div>
                    <div><label className={lc}>Notes</label><input value={newFactory.notes} onChange={e => setNewFactory({...newFactory, notes: e.target.value})} placeholder="Specializes in glassware" className={ic} /></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={createFactory} disabled={savingFactory || !newFactory.name || !newFactory.email} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                      {savingFactory ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Save Factory
                    </button>
                    <button onClick={() => setShowAddFactory(false)} className="px-4 py-2 rounded-xl border border-bg-border text-text-muted text-xs">Cancel</button>
                  </div>
                </div>
              )}

              {factories.length === 0 && !showAddFactory ? (
                <div className="text-center py-16 border border-dashed border-bg-border rounded-2xl">
                  <Building2 size={28} className="text-white/10 mx-auto mb-3" />
                  <p className="text-text-muted text-sm">No factories yet — add your first factory above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {factories.map(f => {
                    const hasPortal = portalUsers.some(u => u.factory_id === f.id);
                    return (
                      <div key={f.id} className="flex items-center gap-4 border border-bg-border rounded-xl px-5 py-4 bg-bg-surface">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <Building2 size={16} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-primary">{f.name}</p>
                          <p className="text-xs text-text-muted">{f.email}{f.contact_name ? ` · ${f.contact_name}` : ""}</p>
                          {f.notes && <p className="text-[10px] text-text-muted mt-0.5">{f.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {hasPortal ? (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full flex items-center gap-1">
                              <Check size={10} />Portal Active
                            </span>
                          ) : (
                            <button onClick={() => { setShowPortalModal({ factory: f }); setPortalPassword(""); }} className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full hover:bg-blue-500/20 transition">
                              Create Portal Access
                            </button>
                          )}
                          <button onClick={() => deleteFactory(f.id)} disabled={deletingFactory === f.id} className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition">
                            {deletingFactory === f.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PORTAL USERS SECTION */}
            <div className="space-y-4 pt-4 border-t border-bg-border">
              <div>
                <p className="text-sm font-semibold text-text-primary">Factory Portal Users</p>
                <p className="text-xs text-text-muted mt-0.5">Factories log into portal.myjimmy.ai to update sample and production stages</p>
              </div>

              {portalUsers.filter(u => u.role !== "designer").length === 0 ? (
                <div className="text-center py-12 border border-dashed border-bg-border rounded-2xl">
                  <Users size={24} className="text-white/10 mx-auto mb-2" />
                  <p className="text-text-muted text-sm">No factory portal users yet</p>
                  <p className="text-text-muted text-xs mt-1">Create portal access from a factory above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {portalUsers.filter(u => u.role !== "designer").map(u => (
                    <div key={u.id} className="flex items-center gap-4 border border-bg-border rounded-xl px-5 py-4 bg-bg-surface">
                      <div className="w-8 h-8 rounded-full bg-bg-elevated border border-bg-border flex items-center justify-center flex-shrink-0">
                        <Users size={13} className="text-text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{u.name || u.email}</p>
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-text-muted">{u.email}</p>
                          {u.factory_catalog && <p className="text-xs text-text-muted">{u.factory_catalog.name}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Active</span>
                        <button onClick={() => deletePortalUser(u.id)} disabled={deletingPortalUser === u.id} className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition">
                          {deletingPortalUser === u.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create Portal Modal */}
            {showPortalModal && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                <div className="bg-bg-elevated border border-bg-border rounded-2xl p-6 w-full max-w-md">
                  <h3 className="text-base font-bold text-white mb-1">Create Portal Access</h3>
                  <p className="text-xs text-text-secondary mb-4">Create login credentials for <span className="text-text-primary">{showPortalModal.factory.name}</span> to access their portal</p>
                  
                  <div className="space-y-3 mb-5">
                    <div>
                      <label className={lc}>Email</label>
                      <input value={showPortalModal.factory.email} disabled className={`${ic} opacity-50 cursor-not-allowed`} />
                      <p className="text-[10px] text-text-muted mt-1">Uses the factory's email address</p>
                    </div>
                    <div>
                      <label className={lc}>Password *</label>
                      <input value={portalPassword} onChange={e => setPortalPassword(e.target.value)} placeholder="Create a password" className={ic} type="text" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={createFactoryPortal} disabled={creatingPortal || !portalPassword} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-xs font-semibold disabled:opacity-40">
                      {creatingPortal ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Create & Send Email
                    </button>
                    <button onClick={() => setShowPortalModal(null)} className="px-4 py-2.5 rounded-xl border border-bg-border text-text-muted text-xs">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "designer_access" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">Designer Portal Users</p>
                <p className="text-xs text-text-muted mt-0.5">Designers log into portal.myjimmy.ai to add products and submit for approval</p>
              </div>
              <button onClick={() => { setNewPortalUser({name:"", email:"", password:"", factory_id:"", role:"designer"}); setShowNewPortalUser(true); }} className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition">
                <Plus size={11} />Add Designer
              </button>
            </div>
            {showNewPortalUser && newPortalUser.role === "designer" && (
              <div className="border border-bg-border rounded-2xl p-5 bg-bg-surface space-y-3">
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
                  <button onClick={() => setShowNewPortalUser(false)} className="px-4 py-2 rounded-xl border border-bg-border text-text-muted text-xs">Cancel</button>
                </div>
              </div>
            )}
            {portalUsers.filter(u => u.role === "designer").length === 0 && !showNewPortalUser ? (
              <div className="text-center py-16 border border-dashed border-bg-border rounded-2xl">
                <Users size={28} className="text-white/10 mx-auto mb-3" />
                <p className="text-text-muted text-sm">No designers yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {portalUsers.filter(u => u.role === "designer").map(u => (
                  <div key={u.id} className="flex items-center gap-4 border border-bg-border rounded-xl px-5 py-4 bg-bg-surface">
                    <div className="w-8 h-8 rounded-full bg-bg-elevated border border-bg-border flex items-center justify-center flex-shrink-0">
                      <Users size={13} className="text-text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{u.name || u.email}</p>
                      <p className="text-xs text-text-muted">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">Designer</span>
                      <button onClick={() => deletePortalUser(u.id)} disabled={deletingPortalUser === u.id} className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition">
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
              <div className="flex items-center justify-center py-20"><Loader2 size={18} className="animate-spin text-text-muted" /></div>
            ) : prioFactories.length === 0 ? (
              <div className="text-center py-20"><p className="text-text-muted text-sm">No factories found. Add factories in Factory Access first.</p></div>
            ) : (
              <>
                {/* Factory tabs */}
                <div className="flex gap-2 border-b border-bg-border pb-3">
                  {prioFactories.map(f => {
                    const factorySamples = prioSamples.filter((s: any) => s.factory_id === f.id);
                    const prioritized = (prioOrder[f.id] || []).filter(id => {
                      const s = prioSamples.find((s: any) => s.id === id);
                      return s?.priority_order != null;
                    }).length;
                    const max = f.max_samples || 50;
                    return (
                      <button key={f.id} onClick={() => setPrioActiveFactory(f.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${prioActiveFactory === f.id ? "bg-white text-black" : "text-text-secondary hover:text-white/70 border border-bg-border"}`}>
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
                            <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Factory Capacity</p>
                            <div className="flex items-center gap-2">
                              {prioMaxEditing[prioActiveFactory] !== undefined ? (
                                <div className="flex items-center gap-2">
                                  <input type="number" value={prioMaxEditing[prioActiveFactory]}
                                    onChange={e => setPrioMaxEditing(prev => ({ ...prev, [prioActiveFactory]: e.target.value }))}
                                    className="w-20 bg-bg-elevated border border-bg-border rounded-lg px-2 py-1 text-white/70 text-xs focus:outline-none" />
                                  <button onClick={() => saveMaxSamples(prioActiveFactory, prioMaxEditing[prioActiveFactory])}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-white text-black font-semibold">Save</button>
                                  <button onClick={() => setPrioMaxEditing(prev => { const n = { ...prev }; delete n[prioActiveFactory]; return n; })}
                                    className="text-[10px] px-2 py-1 rounded-lg border border-bg-border text-text-muted">Cancel</button>
                                </div>
                              ) : (
                                <button onClick={() => setPrioMaxEditing(prev => ({ ...prev, [prioActiveFactory]: String(max) }))}
                                  className="flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white transition">
                                  {max} samples allowed
                                  <span className="text-[10px] text-white/25 border border-bg-border px-1.5 py-0.5 rounded">edit</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${prioritizedCount >= max ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-bg-elevated border-bg-border text-text-secondary"}`}>
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
                        <div className="text-center py-16 border border-bg-border rounded-2xl">
                          <p className="text-text-muted text-sm">No pending samples for this factory</p>
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
                                  isPrioritized ? "border-bg-border bg-bg-surface" : "border-white/[0.04] bg-transparent opacity-50"
                                }`}>
                                {/* Priority number */}
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                  isPrioritized ? "bg-blue-500/20 border border-blue-500/30 text-blue-400" : "bg-bg-elevated border border-bg-border text-text-muted"
                                }`}>
                                  {isPrioritized ? idx + 1 : "—"}
                                </div>
                                {/* Product image + name */}
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {product?.images?.[0] && <img src={product.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />}
                                  <div className="min-w-0">
                                    <p className="text-sm text-white/80 font-medium truncate">{product?.name}</p>
                                    {product?.sku && <p className="text-[10px] text-text-muted font-mono">{product.sku}</p>}
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
