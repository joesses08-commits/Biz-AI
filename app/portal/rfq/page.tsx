"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Package, Layers, MessageSquare, ListOrdered, FileSpreadsheet, Settings, LogOut,
  Check, X, Loader2, Upload, Plus, ExternalLink, Trash2, Send, Sparkles, Factory,
} from "lucide-react";
import PortalNotificationBell from "../../../components/PortalNotificationBell";
import PortalThemeToggle from "@/components/PortalThemeToggle";

const NAV_ITEMS: [string, string, any][] = [
  ["products", "Products", Package],
  ["collections", "Collections", Layers],
  ["messages", "Messages", MessageSquare],
  ["prioritization", "Prioritization", ListOrdered],
  ["divider", "", null],
  ["rfq", "RFQ Workflow", FileSpreadsheet],
  ["settings", "Settings", Settings],
];

const STATUS_COLORS: Record<string, string> = {
  waiting: "text-text-secondary bg-white/5 border-bg-border",
  draft: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  rfq_sent: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  ready: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  complete: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};
const STATUS_LABELS: Record<string, string> = {
  waiting: "Draft", draft: "Draft", rfq_sent: "RFQs Sent", ready: "Quotes In", complete: "Complete",
};
const DEFAULT_FIELDS = ["Unit price (USD)", "MOQ", "Lead time", "Sample lead time", "Payment terms"];

function buildDraftBody(jobName: string, fields: string[]) {
  return `Hi [contact name],\n\nPlease find attached our product list for the ${jobName}. We would appreciate it if you could review the attached file and provide us with your pricing and details.\n\nPlease fill in the following for each item:\n${fields.map(f => `• ${f}`).join("\n")}\n\nKindly reply to this email with the completed sheet at your earliest convenience.\n\nBest regards,\n[your name]`;
}

export default function PortalRFQPage() {
  const router = useRouter();
  const [portalUser, setPortalUser] = useState<any>(null);
  const [tok, setTok] = useState("");
  const [factories, setFactories] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [building, setBuilding] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [activeDraftJob, setActiveDraftJob] = useState<any>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [draftModal, setDraftModal] = useState<{ jobId: string; emailBody: string; fields: string[] } | null>(null);
  const [providerModal, setProviderModal] = useState<{ jobId: string; gmailEmail: string; outlookEmail: string } | null>(null);
  const [pendingProvider, setPendingProvider] = useState<string | undefined>(undefined);
  const [newJob, setNewJob] = useState({ job_name: "", factory_ids: [] as string[], duty_pct: "30", tariff_pct: "20", freight: "0.15" });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("portal_user_designer") || localStorage.getItem("portal_user") || "{}");
    const t = localStorage.getItem("portal_token_designer") || localStorage.getItem("portal_token") || "";
    setPortalUser(user);
    setTok(t);
  }, []);

  const token = () => localStorage.getItem("portal_token_designer") || localStorage.getItem("portal_token") || "";

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: "Bearer " + token(),
  }), []);

  const loadJobs = useCallback(async () => {
    const res = await fetch("/api/workflows/factory-quote", { headers: { Authorization: "Bearer " + token() } });
    const data = await res.json();
    setJobs(data.jobs || []);
    setLoading(false);
  }, []);

  const loadFactories = useCallback(async () => {
    const res = await fetch("/api/portal/designer", { headers: { Authorization: "Bearer " + token() } });
    const data = await res.json();
    setFactories(data.factories || []);
  }, []);

  useEffect(() => {
    loadJobs();
    loadFactories();
  }, []);

  const logout = () => {
    localStorage.removeItem("portal_token_designer"); localStorage.removeItem("portal_user_designer");
    localStorage.removeItem("portal_token"); localStorage.removeItem("portal_user");
    router.push("/portal");
  };

  const toggleFactory = (id: string) =>
    setNewJob(j => ({ ...j, factory_ids: j.factory_ids.includes(id) ? j.factory_ids.filter(f => f !== id) : [...j.factory_ids, id] }));

  const openDraft = (jobId: string, provider?: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    setPendingProvider(provider);
    setDraftModal({ jobId, emailBody: buildDraftBody(job.job_name, DEFAULT_FIELDS), fields: [...DEFAULT_FIELDS] });
  };

  const sendRfq = async (jobId: string, provider?: string, emailBody?: string) => {
    setSending(jobId);
    const res = await fetch("/api/workflows/factory-quote", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action: "send_rfq", job_id: jobId, provider, custom_body: emailBody }),
    });
    const data = await res.json();
    setSending(null);
    if (data.error === "both_connected") {
      setProviderModal({ jobId, gmailEmail: data.gmailEmail, outlookEmail: data.outlookEmail });
      return;
    }
    loadJobs();
  };

  const getFileBase64 = (file: File): Promise<string> =>
    new Promise(resolve => { const r = new FileReader(); r.onload = e => resolve((e.target?.result as string).split(",")[1]); r.readAsDataURL(file); });

  const saveAsDraft = async () => {
    if (!newJob.job_name) return;
    setSavingDraft(true);
    const selectedFactories = factories.filter(f => newJob.factory_ids.includes(f.id));
    let fileBase64 = activeDraftJob?.product_file_base64 || "";
    let fileName = activeDraftJob?.product_file_name || "";
    if (productFile) { fileBase64 = await getFileBase64(productFile); fileName = productFile.name; }
    if (activeDraftJob) {
      await fetch("/api/workflows/factory-quote", { method: "POST", headers: authHeaders(), body: JSON.stringify({ action: "delete_jobs", job_ids: [activeDraftJob.id] }) });
    }
    await fetch("/api/workflows/factory-quote", {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({
        action: "create_job", job_name: newJob.job_name,
        factories: selectedFactories.map(f => ({ name: f.name, email: f.email, contact_name: f.contact_name })),
        order_details: { duty_pct: newJob.duty_pct, tariff_pct: newJob.tariff_pct, freight: newJob.freight, created_by_name: portalUser?.name || portalUser?.email || "Designer" },
        product_file_base64: fileBase64, product_file_name: fileName, status: "draft",
      }),
    });
    setSavingDraft(false); setShowNew(false); setProductFile(null); setActiveDraftJob(null);
    setNewJob({ job_name: "", factory_ids: [], duty_pct: "30", tariff_pct: "20", freight: "0.15" });
    loadJobs();
  };

  const createJob = async () => {
    if (!newJob.job_name || newJob.factory_ids.length === 0 || (!productFile && !activeDraftJob)) return;
    setCreating(true);
    const selectedFactories = factories.filter(f => newJob.factory_ids.includes(f.id));
    let fileBase64 = activeDraftJob?.product_file_base64 || "";
    let fileName = activeDraftJob?.product_file_name || "";
    if (productFile) { fileBase64 = await getFileBase64(productFile); fileName = productFile.name; }
    if (activeDraftJob) {
      await fetch("/api/workflows/factory-quote", { method: "POST", headers: authHeaders(), body: JSON.stringify({ action: "delete_jobs", job_ids: [activeDraftJob.id] }) });
    }
    const res = await fetch("/api/workflows/factory-quote", {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({
        action: "create_job", job_name: newJob.job_name,
        factories: selectedFactories.map(f => ({ name: f.name, email: f.email, contact_name: f.contact_name })),
        order_details: { duty_pct: newJob.duty_pct, tariff_pct: newJob.tariff_pct, freight: newJob.freight, created_by_name: portalUser?.name || portalUser?.email || "Designer" },
        product_file_base64: fileBase64, product_file_name: fileName,
      }),
    });
    const data = await res.json();
    setCreating(false); setShowNew(false); setProductFile(null); setActiveDraftJob(null);
    setNewJob({ job_name: "", factory_ids: [], duty_pct: "30", tariff_pct: "20", freight: "0.15" });
    await loadJobs();
    if (data.job?.id) {
      const provCheck = await fetch("/api/workflows/factory-quote", { method: "POST", headers: authHeaders(), body: JSON.stringify({ action: "send_rfq", job_id: data.job.id, check_only: true }) });
      const provData = await provCheck.json();
      if (provData.error === "both_connected") {
        setProviderModal({ jobId: data.job.id, gmailEmail: provData.gmailEmail, outlookEmail: provData.outlookEmail });
      } else {
        setDraftModal({ jobId: data.job.id, emailBody: buildDraftBody(newJob.job_name, DEFAULT_FIELDS), fields: [...DEFAULT_FIELDS] });
      }
    }
  };

  const uploadQuote = async (jobId: string, file: File, factoryName?: string) => {
    setProcessing(factoryName ? jobId + factoryName : jobId);
    const base64 = await getFileBase64(file);
    const job = jobs.find(j => j.id === jobId);
    const matched = factoryName
      ? (job?.factories || []).find((f: any) => f.name === factoryName)
      : (job?.factories || []).find((f: any) => file.name.toLowerCase().includes(f.name?.toLowerCase()));
    await fetch("/api/workflows/factory-quote", {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ action: "process_file", job_id: jobId, factory_name: matched?.name || factoryName || file.name.replace(/\.xlsx?$/, ""), factory_email: matched?.email || "", file_base64: base64, file_name: file.name }),
    });
    setProcessing(null); loadJobs();
  };

  const buildMaster = async (jobId: string) => {
    setBuilding(jobId);
    const res = await fetch("/api/workflows/factory-quote", { method: "POST", headers: authHeaders(), body: JSON.stringify({ action: "build_master", job_id: jobId }) });
    const data = await res.json();
    setBuilding(null); loadJobs();
    if (data.sheetUrl) { window.open(data.sheetUrl, "_blank"); }
    else if (data.base64) {
      const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = data.fileName || "Master_Quote_Comparison.xlsx"; a.click(); URL.revokeObjectURL(url);
    }
  };

  const deleteSelectedJobs = async () => {
    if (!selectedJobs.length) return;
    setDeleting(true);
    await fetch("/api/workflows/factory-quote", { method: "POST", headers: authHeaders(), body: JSON.stringify({ action: "delete_jobs", job_ids: selectedJobs }) });
    setDeleting(false); setSelectMode(false); setSelectedJobs([]); loadJobs();
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex">
      {/* Sidebar */}
      <div className="w-60 flex-shrink-0 border-r border-bg-border bg-bg-surface flex flex-col h-screen sticky top-0 overflow-y-auto">
        <div className="px-4 py-5 border-b border-bg-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-bg-border flex items-center justify-center flex-shrink-0">
              <Layers size={15} className="text-text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Jimmy AI</p>
              <p className="text-[10px] text-text-muted truncate">{portalUser?.name || portalUser?.email}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(([key, label, Icon]) => {
            if (key === "divider") return <div key="divider" className="my-2 border-t border-bg-border" />;
            return (
              <button key={key}
                onClick={() => {
                  if (key === "rfq") return;
                  if (key === "messages") { router.push("/portal/designer-messages"); return; }
                  if (key === "settings") { router.push("/portal/settings"); return; }
                  router.push("/portal/dashboard?role=designer");
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition text-left ${key === "rfq" ? "bg-white/10 text-text-primary" : "text-text-muted hover:text-text-secondary hover:bg-white/5"}`}>
                <Icon size={14} className="flex-shrink-0" />
                <span className="flex-1">{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-bg-border space-y-1">
          <div className="flex items-center gap-2 px-3 py-2">
            <PortalNotificationBell token={tok} onNavigate={(link: string) => router.push(link)} />
            <PortalThemeToggle />
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-text-muted hover:text-text-secondary hover:bg-white/5 transition">
            <LogOut size={14} />Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <div className="border-b border-bg-border px-8 py-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-bg-border flex items-center justify-center">
              <Factory size={14} className="text-blue-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">RFQ Workflow</h1>
          </div>
          <p className="text-text-muted text-sm">Upload product list → email factories → compare quotes</p>
        </div>

        <div className="max-w-4xl mx-auto px-8 py-8 space-y-4">

          {/* Draft email modal */}
          {draftModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-bg-elevated border border-bg-border rounded-2xl w-full max-w-lg space-y-4 p-6">
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-0.5">Review RFQ Email</p>
                  <p className="text-[11px] text-text-muted">This will be sent to each factory. [contact name] and [your name] fill in automatically.</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-widest mb-2">Fields to request</p>
                  <div className="flex flex-wrap gap-2">
                    {["Unit price (USD)", "MOQ", "Lead time", "Sample lead time", "Sample price", "Payment terms", "Packaging details", "Notes/Comments"].map(field => {
                      const active = draftModal.fields.includes(field);
                      return (
                        <button key={field} onClick={() => {
                          const fields = active ? draftModal.fields.filter(f => f !== field) : [...draftModal.fields, field];
                          setDraftModal({ ...draftModal, fields, emailBody: buildDraftBody(jobs.find(j => j.id === draftModal.jobId)?.job_name || "", fields) });
                        }} className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${active ? "border-blue-500/40 bg-blue-500/10 text-blue-400" : "border-bg-border text-text-muted"}`}>
                          {field}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-widest mb-2">Email body</p>
                  <textarea value={draftModal.emailBody} onChange={e => setDraftModal({ ...draftModal, emailBody: e.target.value })}
                    rows={10} className="w-full bg-bg-elevated border border-bg-border rounded-xl px-3 py-2.5 text-white/70 text-xs focus:outline-none focus:border-white/20 resize-none font-mono leading-relaxed" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { const m = draftModal; setDraftModal(null); sendRfq(m.jobId, pendingProvider, m.emailBody); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 transition">
                    <Send size={11} />Send to All Factories
                  </button>
                  <button onClick={() => setDraftModal(null)} className="px-4 rounded-xl border border-bg-border text-text-muted text-xs">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Provider picker modal */}
          {providerModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-bg-elevated border border-bg-border rounded-2xl p-6 w-80 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-1">Send RFQs via which account?</p>
                  <p className="text-[11px] text-text-muted">Both Gmail and Outlook are connected.</p>
                </div>
                <div className="space-y-2">
                  <button onClick={() => { const m = providerModal; setProviderModal(null); openDraft(m.jobId, "gmail"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-bg-border bg-bg-surface hover:border-white/20 transition text-left">
                    <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0"><span className="text-xs">G</span></div>
                    <div><p className="text-xs font-semibold text-text-primary">Gmail</p><p className="text-[10px] text-text-muted">{providerModal.gmailEmail}</p></div>
                  </button>
                  <button onClick={() => { const m = providerModal; setProviderModal(null); openDraft(m.jobId, "outlook"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-bg-border bg-bg-surface hover:border-white/20 transition text-left">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0"><span className="text-xs">O</span></div>
                    <div><p className="text-xs font-semibold text-text-primary">Outlook</p><p className="text-[10px] text-text-muted">{providerModal.outlookEmail}</p></div>
                  </button>
                </div>
                <button onClick={() => setProviderModal(null)} className="w-full text-center text-[11px] text-text-muted hover:text-text-secondary transition">Cancel</button>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <button onClick={() => { setActiveDraftJob(null); setProductFile(null); setNewJob({ job_name: "", factory_ids: [], duty_pct: "30", tariff_pct: "20", freight: "0.15" }); setShowNew(!showNew); }}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-bg-border text-text-secondary hover:text-text-secondary bg-bg-surface transition">
              <Plus size={11} />New Quote Job
            </button>
            {jobs.length > 0 && (
              <button onClick={() => { setSelectMode(!selectMode); setSelectedJobs([]); }}
                className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition ${selectMode ? "border-red-500/30 text-red-400 bg-red-500/5" : "border-bg-border text-text-muted bg-bg-surface"}`}>
                {selectMode ? <X size={11} /> : <Trash2 size={11} />}
                {selectMode ? "Cancel" : "Select"}
              </button>
            )}
            {selectMode && selectedJobs.length > 0 && (
              <button onClick={deleteSelectedJobs} disabled={deleting}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50">
                {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                Delete {selectedJobs.length}
              </button>
            )}
          </div>

          {/* New job form */}
          {showNew && (
            <div className="border border-bg-border rounded-xl p-4 bg-bg-surface space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-text-secondary uppercase tracking-widest">New Quote Job</p>
                {activeDraftJob && <span className="text-[10px] text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">From Draft</span>}
              </div>
              <div>
                <label className="text-[11px] text-text-muted mb-1 block">Job Name</label>
                <input value={newJob.job_name} onChange={e => setNewJob({ ...newJob, job_name: e.target.value })}
                  placeholder="e.g. Spring 2026 Glass Collection"
                  className="w-full bg-bg-elevated border border-bg-border rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-[11px] text-text-muted mb-1.5 block">Product List File <span className="text-white/15">(Excel sent to factories as-is)</span></label>
                <label className="cursor-pointer block">
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => setProductFile(e.target.files?.[0] || null)} />
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${productFile ? "border-emerald-500/30 bg-emerald-500/5" : activeDraftJob?.product_file_base64 ? "border-pink-500/30 bg-pink-500/5" : "border-dashed border-bg-border hover:border-white/20 bg-bg-surface"}`}>
                    {productFile ? (
                      <><FileSpreadsheet size={14} className="text-emerald-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0"><p className="text-xs text-emerald-300 font-medium truncate">{productFile.name}</p></div>
                        <button onClick={e => { e.preventDefault(); setProductFile(null); }} className="text-text-muted hover:text-red-400 transition"><X size={12} /></button>
                      </>
                    ) : activeDraftJob?.product_file_base64 ? (
                      <><FileSpreadsheet size={14} className="text-pink-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0"><p className="text-xs text-pink-300 font-medium truncate">{activeDraftJob.product_file_name || "RFQ sheet"}</p><p className="text-[10px] text-text-muted">Saved in draft</p></div>
                        <button onClick={e => { e.preventDefault(); setActiveDraftJob((p: any) => ({ ...p, product_file_base64: null, product_file_name: null })); }} className="text-text-muted hover:text-red-400 transition"><X size={12} /></button>
                      </>
                    ) : (
                      <><Upload size={14} className="text-text-muted flex-shrink-0" /><p className="text-xs text-text-muted">Click to upload your product list Excel</p></>
                    )}
                  </div>
                </label>
              </div>
              <div>
                <label className="text-[11px] text-text-muted mb-1.5 block">Send To</label>
                {factories.length === 0 ? (
                  <p className="text-[11px] text-text-muted italic p-3 border border-bg-border rounded-xl">No factories available — admin needs to add factories in PLM.</p>
                ) : (
                  <div className="space-y-1.5">
                    {factories.map(f => (
                      <button key={f.id} onClick={() => toggleFactory(f.id)}
                        className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs transition ${newJob.factory_ids.includes(f.id) ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-bg-border bg-bg-surface text-text-secondary"}`}>
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${newJob.factory_ids.includes(f.id) ? "border-emerald-400 bg-emerald-500" : "border-white/20"}`}>
                          {newJob.factory_ids.includes(f.id) && <Check size={9} className="text-black" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{f.name}</p>
                          <p className="text-[10px] opacity-60">{f.email}{f.contact_name ? ` · ${f.contact_name}` : ""}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-[11px] text-text-muted mb-1.5 block">Cost Settings</label>
                <div className="grid grid-cols-3 gap-2">
                  {[["duty_pct", "Duty %", "30"], ["tariff_pct", "Tariff %", "20"], ["freight", "Freight/unit ($)", "0.15"]].map(([key, label, ph]) => (
                    <div key={key}>
                      <label className="text-[10px] text-text-muted mb-1 block">{label}</label>
                      <input value={(newJob as any)[key]} onChange={e => setNewJob({ ...newJob, [key]: e.target.value })} placeholder={ph}
                        className="w-full bg-bg-elevated border border-bg-border rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <button onClick={createJob} disabled={creating || !newJob.job_name || newJob.factory_ids.length === 0 || (!productFile && !activeDraftJob)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 transition disabled:opacity-40">
                  {creating ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}Draft RFQs
                </button>
                <button onClick={saveAsDraft} disabled={savingDraft || !newJob.job_name}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-bg-border text-text-secondary text-xs font-semibold hover:bg-bg-hover transition disabled:opacity-40">
                  {savingDraft ? <Loader2 size={11} className="animate-spin" /> : <FileSpreadsheet size={11} />}Save as Draft
                </button>
                <button onClick={() => { setShowNew(false); setProductFile(null); setActiveDraftJob(null); }}
                  className="px-4 py-2 rounded-xl border border-bg-border text-text-muted text-xs">Cancel</button>
              </div>
            </div>
          )}

          {/* Draft banners */}
          {!loading && jobs.filter(j => j.status === "draft").map(job => (
            <div key={job.id} className="border border-pink-500/30 bg-pink-500/[0.04] rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center flex-shrink-0"><FileSpreadsheet size={14} className="text-pink-400" /></div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{job.job_name}</p>
                  <p className="text-xs text-text-muted">Saved draft — open to set factories and send</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => {
                  setActiveDraftJob(job);
                  const draftIds = (job.factories || []).map((df: any) => factories.find((f: any) => f.name === df.name || f.email === df.email)?.id).filter(Boolean);
                  setNewJob(p => ({ ...p, job_name: job.job_name, duty_pct: job.order_details?.duty_pct || "30", tariff_pct: job.order_details?.tariff_pct || "20", freight: job.order_details?.freight || "0.15", factory_ids: draftIds }));
                  setShowNew(true);
                }} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-pink-500 text-white font-semibold hover:bg-pink-400 transition">
                  Open Draft →
                </button>
                <button onClick={async () => { await fetch("/api/workflows/factory-quote", { method: "POST", headers: authHeaders(), body: JSON.stringify({ action: "delete_jobs", job_ids: [job.id] }) }); loadJobs(); }}
                  className="p-2 rounded-xl border border-bg-border text-text-muted hover:text-red-400 hover:border-red-500/30 transition"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}

          {/* Job list */}
          {loading ? (
            <div className="flex items-center gap-2 text-text-muted text-xs py-4"><Loader2 size={11} className="animate-spin" />Loading jobs...</div>
          ) : jobs.filter(j => j.status !== "draft").length === 0 && jobs.filter(j => j.status === "draft").length === 0 ? (
            <div className="text-center py-20 text-text-muted">
              <FileSpreadsheet size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No quote jobs yet</p>
              <p className="text-xs mt-1 opacity-60">Create a job above to request quotes from factories</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.filter(j => j.status !== "draft").map(job => {
                const quotesReceived = job.factory_quotes?.length || 0;
                const totalFactories = job.factories?.length || 0;
                const pct = totalFactories > 0 ? Math.round((quotesReceived / totalFactories) * 100) : 0;
                const createdBy = job.order_details?.created_by_name;
                return (
                  <div key={job.id} className={`border rounded-xl overflow-hidden transition ${selectedJobs.includes(job.id) ? "border-red-500/30 bg-red-500/[0.03]" : "border-bg-border bg-bg-surface"}`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-2">
                          {selectMode && (
                            <button onClick={() => setSelectedJobs(s => s.includes(job.id) ? s.filter(id => id !== job.id) : [...s, job.id])}
                              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${selectedJobs.includes(job.id) ? "border-red-400 bg-red-500" : "border-white/20"}`}>
                              {selectedJobs.includes(job.id) && <Check size={9} className="text-white" />}
                            </button>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-text-primary mb-0.5">{job.job_name}</p>
                            {job.product_file_name && <p className="text-[10px] text-blue-400/60 mb-0.5">📎 {job.product_file_name}</p>}
                            <p className="text-[10px] text-text-muted">
                              {new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              {createdBy ? ` · ${createdBy}` : ""}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLORS[job.status] || "text-text-muted bg-white/5 border-bg-border"}`}>
                          {STATUS_LABELS[job.status] || job.status}
                        </span>
                      </div>

                      {sending === job.id && (
                        <div className="flex items-center gap-2 text-blue-400 text-xs mb-3 bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-2">
                          <Loader2 size={11} className="animate-spin" />Sending RFQ emails to {totalFactories} {totalFactories === 1 ? "factory" : "factories"}...
                        </div>
                      )}

                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-text-muted">Quotes received</span>
                          <span className="text-[10px] text-text-secondary">{quotesReceived} / {totalFactories}</span>
                        </div>
                        <div className="w-full bg-bg-elevated rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <div className="space-y-2 mb-3">
                        {(job.factories || []).map((factory: any, i: number) => {
                          const received = job.factory_quotes?.find((q: any) => q.factory_name === factory.name || q.factory_email === factory.email);
                          const isProcessing = processing === job.id + factory.name;
                          return (
                            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition ${received ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-white/[0.08] bg-white/[0.02]"}`}>
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${received ? "bg-emerald-400" : job.status === "rfq_sent" || job.status === "ready" || job.status === "complete" ? "bg-blue-400/40" : "bg-white/15"}`} />
                              <span className="text-[11px] text-text-secondary flex-1">{factory.name}</span>
                              {received ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-emerald-400/80">{received.processed_data?.length || 0} products</span>
                                  <button onClick={async () => {
                                    if (!confirm("Remove this quote?")) return;
                                    await fetch("/api/workflows/factory-quote", { method: "POST", headers: authHeaders(), body: JSON.stringify({ action: "delete_quote", quote_id: received.id }) });
                                    loadJobs();
                                  }} className="text-white/15 hover:text-red-400 transition"><Trash2 size={10} /></button>
                                </div>
                              ) : job.status !== "complete" ? (
                                <label className="cursor-pointer">
                                  <input type="file" accept=".xlsx,.xls" className="hidden"
                                    onChange={e => { const file = e.target.files?.[0]; if (file) uploadQuote(job.id, file, factory.name); }} />
                                  {isProcessing ? (
                                    <div className="flex items-center gap-1 text-blue-400"><Loader2 size={10} className="animate-spin" /><span className="text-[10px]">Processing...</span></div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-text-muted hover:text-text-secondary transition"><Upload size={10} /><span className="text-[10px]">Upload quote</span></div>
                                  )}
                                </label>
                              ) : (
                                <span className="text-[10px] text-text-muted">no quote</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {job.status !== "rfq_sent" && job.status !== "complete" && (
                          <button onClick={() => openDraft(job.id)}
                            disabled={sending === job.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition disabled:opacity-40">
                            {sending === job.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                            {job.status === "waiting" ? "Send RFQs" : "Re-send RFQs"}
                          </button>
                        )}
                        {job.status === "rfq_sent" && (
                          <button onClick={() => openDraft(job.id)} disabled={sending === job.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition disabled:opacity-40">
                            {sending === job.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}Re-send RFQs
                          </button>
                        )}
                        {job.status === "complete" && job.master_sheet_url ? (
                          <a href={job.master_sheet_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition">
                            <ExternalLink size={11} />View Master Sheet
                          </a>
                        ) : (
                          <button onClick={() => buildMaster(job.id)} disabled={building === job.id || quotesReceived === 0}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold hover:bg-purple-500/20 transition disabled:opacity-40">
                            {building === job.id ? <Loader2 size={11} className="animate-spin" /> : <FileSpreadsheet size={11} />}
                            {building === job.id ? "Building..." : "Build Master Sheet"}
                          </button>
                        )}
                      </div>
                    </div>

                    {job.status === "complete" && job.ai_recommendation && (
                      <div className="border-t border-bg-border px-4 py-3 bg-purple-500/[0.03]">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={11} className="text-purple-400" />
                          <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest">Jimmy's Recommendation</p>
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">{job.ai_recommendation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
