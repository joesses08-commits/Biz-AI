"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, AlertCircle, Check, X, ChevronRight, ChevronDown,
  Settings, Eye, Factory, CreditCard, Calendar, FileText,
  TrendingDown, Loader2, ArrowRight, Shield, Bot, RotateCcw, Circle,
  Upload, Plus, FileSpreadsheet, ExternalLink, Trash2, Send, Building2, Sparkles
} from "lucide-react";

interface PendingAction {
  id: string; workflow_type: string; action_type: string;
  title: string; description: string; payload: Record<string, unknown>;
  status: string; created_at: string;
}
interface UserWorkflow {
  id: string; workflow_type: string; enabled: boolean;
  settings: Record<string, unknown>; last_run_at: string | null;
}
interface HistoryItem {
  id: string; workflow_type: string; action_type: string;
  title: string; status: string; created_at: string;
}
interface Factory { id: string; name: string; email: string; contact_name?: string; notes?: string; }

const WORKFLOW_DEFS = [
  {
    type: "factory_quote", icon: Factory, name: "Factory Quote Request",
    tagline: "Upload product list → Jimmy emails factories → auto-compares quotes", color: "#3b82f6",
    steps: [
      { label: "Upload product list + pick factories", type: "input", auto: false },
      { label: "Jimmy emails file to each factory", type: "draft", auto: true },
      { label: "Jimmy monitors replies", type: "monitor", auto: true },
      { label: "Quotes auto-extracted", type: "execute", auto: true },
      { label: "Comparison sheet + AI recommendation", type: "analysis", auto: true },
    ],
    settingsFields: [],
  },
  {
    type: "invoice_overdue", icon: TrendingDown, name: "Invoice Overdue Chaser",
    tagline: "Auto-detect overdue invoices & draft reminders", color: "#f59e0b",
    steps: [
      { label: "QuickBooks detects overdue invoice", type: "trigger", auto: true },
      { label: "Jimmy finds client email thread", type: "execute", auto: true },
      { label: "Reminder email drafted", type: "draft", auto: true },
      { label: "You approve & Jimmy sends", type: "approval", auto: false },
      { label: "Action item added to tracker", type: "execute", auto: true },
    ],
    settingsFields: [
      { key: "days_overdue", label: "Days Overdue Before Triggering", placeholder: "e.g. 7", type: "text" },
      { key: "reminder_tone", label: "Reminder Tone", placeholder: "polite / firm / urgent", type: "text" },
    ],
  },
  {
    type: "payment_failed", icon: CreditCard, name: "Payment Failed Recovery",
    tagline: "Stripe payment fails → instant follow-up drafted", color: "#ef4444",
    steps: [
      { label: "Stripe webhook fires payment failed", type: "trigger", auto: true },
      { label: "Dashboard alert created", type: "execute", auto: true },
      { label: "Follow-up email drafted", type: "draft", auto: true },
      { label: "You approve & Jimmy sends", type: "approval", auto: false },
      { label: "Action item: collect payment", type: "execute", auto: true },
    ],
    settingsFields: [
      { key: "retry_days", label: "Days Until Retry Reminder", placeholder: "e.g. 3", type: "text" },
    ],
  },
  {
    type: "meeting_followup", icon: FileText, name: "Meeting Follow-up",
    tagline: "Transcript in → action items & summary out", color: "#8b5cf6",
    steps: [
      { label: "Meeting transcript detected", type: "trigger", auto: true },
      { label: "Jimmy extracts action items", type: "execute", auto: true },
      { label: "Action items added to tracker", type: "execute", auto: true },
      { label: "Follow-up summary email drafted", type: "draft", auto: true },
      { label: "You approve & Jimmy sends to attendees", type: "approval", auto: false },
    ],
    settingsFields: [
      { key: "auto_add_actions", label: "Auto-add to Action Tracker", placeholder: "yes / no", type: "text" },
    ],
  },
  {
    type: "month_end", icon: Calendar, name: "Month End Summary",
    tagline: "Auto-generate financial summary every month end", color: "#10b981",
    steps: [
      { label: "Month end date triggers workflow", type: "trigger", auto: true },
      { label: "Jimmy pulls Stripe + QuickBooks data", type: "execute", auto: true },
      { label: "Financial summary generated", type: "execute", auto: true },
      { label: "Email to accountant drafted", type: "draft", auto: true },
      { label: "You approve & Jimmy sends", type: "approval", auto: false },
    ],
    settingsFields: [
      { key: "recipient_email", label: "Send Summary To", placeholder: "accountant@firm.com", type: "text" },
      { key: "trigger_day", label: "Day of Month to Trigger", placeholder: "e.g. 1", type: "text" },
    ],
  },
];

const ACTION_LABELS: Record<string, string> = {
  send_email_gmail: "Send Gmail", send_email_outlook: "Send Outlook Email",
  create_sheet: "Create Google Sheet", update_sheet: "Update Google Sheet",
  create_action_item: "Create Action Item",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b", approved: "#3b82f6", executed: "#10b981",
  rejected: "#6b7280", failed: "#ef4444",
};

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StepDot({ type }: { type: string }) {
  const configs: Record<string, { bg: string; border: string; icon: React.ReactNode }> = {
    approval: { bg: "bg-amber-500/10", border: "border-amber-500", icon: <Eye size={9} className="text-amber-400" /> },
    trigger: { bg: "bg-blue-500/10", border: "border-blue-500", icon: <Zap size={9} className="text-blue-400" /> },
    input: { bg: "bg-white/5", border: "border-white/20", icon: <Circle size={9} className="text-white/40" /> },
    draft: { bg: "bg-purple-500/10", border: "border-purple-500", icon: <Bot size={9} className="text-purple-400" /> },
    monitor: { bg: "bg-blue-500/10", border: "border-blue-500", icon: <Eye size={9} className="text-blue-400" /> },
    analysis: { bg: "bg-purple-500/10", border: "border-purple-500", icon: <Bot size={9} className="text-purple-400" /> },
  };
  const c = configs[type] || { bg: "bg-emerald-500/10", border: "border-emerald-500", icon: <Zap size={9} className="text-emerald-400" /> };
  return (
    <div className={`w-5 h-5 rounded-full border ${c.border} ${c.bg} flex items-center justify-center flex-shrink-0`}>
      {c.icon}
    </div>
  );
}

function PendingCard({ action, onApprove, onReject, approving }: {
  action: PendingAction; onApprove: (id: string) => void;
  onReject: (id: string) => void; approving: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const def = WORKFLOW_DEFS.find(w => w.type === action.workflow_type);
  return (
    <div className="border border-amber-500/20 bg-amber-500/5 rounded-2xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${def?.color || "#f59e0b"}20`, border: `1px solid ${def?.color || "#f59e0b"}30` }}>
            {def ? <def.icon size={14} style={{ color: def.color }} /> : <Zap size={14} className="text-amber-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/70">Awaiting Approval</span>
              <span className="text-[10px] text-white/20">{timeAgo(action.created_at)}</span>
            </div>
            <p className="text-sm font-semibold text-white">{action.title}</p>
            <p className="text-xs text-white/40">{ACTION_LABELS[action.action_type] || action.action_type}</p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-white/20 hover:text-white/50 transition mt-1">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
        {expanded && action.payload && (
          <div className="mt-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2">Preview</p>
            {Object.entries(action.payload).map(([k, v]) => (
              <div key={k} className="flex gap-2 mb-1">
                <span className="text-[11px] text-white/30 min-w-[60px] capitalize">{k}:</span>
                <span className="text-[11px] text-white/60 truncate">{String(v).slice(0, 120)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={() => onApprove(action.id)} disabled={approving === action.id}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition disabled:opacity-50">
            {approving === action.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            Approve & Execute
          </button>
          <button onClick={() => onReject(action.id)} disabled={approving === action.id}
            className="px-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/60 transition disabled:opacity-50">
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FACTORY CATALOG MANAGER ────────────────────────────────────────────────
function FactoryCatalog({ factories, onRefresh }: { factories: Factory[]; onRefresh: () => void; }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", contact_name: "", notes: "" });

  const save = async () => {
    if (!form.name || !form.email) return;
    setSaving(true);
    await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_factory", ...form }),
    });
    setSaving(false);
    setAdding(false);
    setForm({ name: "", email: "", contact_name: "", notes: "" });
    onRefresh();
  };

  const remove = async (id: string) => {
    await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_factory", id }),
    });
    onRefresh();
  };

  return (
    <div className="border border-white/[0.06] rounded-xl p-4 bg-white/[0.01]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 size={12} className="text-white/30" />
          <p className="text-[11px] text-white/40 uppercase tracking-widest">Factory Catalog</p>
          <span className="text-[10px] text-white/20">{factories.length} saved</span>
        </div>
        <button onClick={() => setAdding(!adding)}
          className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition px-2 py-1 rounded-lg border border-white/[0.06]">
          <Plus size={10} />Add Factory
        </button>
      </div>

      {adding && (
        <div className="mb-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Factory Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Yuecheng" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Email *</label>
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                placeholder="quotes@factory.com" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Contact Name</label>
              <input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})}
                placeholder="Jenny Li" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Notes</label>
              <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                placeholder="Specializes in glass" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !form.name || !form.email}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-white/90 transition disabled:opacity-40">
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}Save
            </button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg border border-white/[0.06] text-white/30 text-xs">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {factories.length === 0 ? (
          <p className="text-[11px] text-white/15 py-2">No factories saved yet — add one above. These stay saved across all jobs.</p>
        ) : factories.map(f => (
          <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <Building2 size={11} className="text-white/20 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/70 font-medium">{f.name}</p>
              <p className="text-[10px] text-white/30">{f.email}{f.contact_name ? ` · ${f.contact_name}` : ""}</p>
            </div>
            <button onClick={() => remove(f.id)} className="text-white/15 hover:text-red-400 transition"><Trash2 size={11} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FACTORY QUOTE MANAGER ──────────────────────────────────────────────────
function FactoryQuoteManager({ factories, onCatalogRefresh }: {
  factories: Factory[]; onCatalogRefresh: () => void;
}) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [building, setBuilding] = useState<string | null>(null);
  // Factories tab removed - now managed in PLM
  const [productFile, setProductFile] = useState<File | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [providerModal, setProviderModal] = useState<{ jobId: string; gmailEmail: string; outlookEmail: string } | null>(null);
  const [draftModal, setDraftModal] = useState<{ jobId: string; emailBody: string; fields: string[] } | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [activeDraftJob, setActiveDraftJob] = useState<any>(null);
  const [pendingProvider, setPendingProvider] = useState<string | undefined>(undefined);
  const [newJob, setNewJob] = useState({
    job_name: "",
    factory_ids: [] as string[],
    duty_pct: "30",
    tariff_pct: "20",
    freight: "0.15",
  });

  const loadJobs = async () => {
    const res = await fetch("/api/workflows/factory-quote");
    const data = await res.json();
    setJobs(data.jobs || []);
    setLoading(false);
  };

  const deleteSelectedJobs = async () => {
    if (!selectedJobs.length) return;
    setDeleting(true);
    await fetch("/api/workflows/factory-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_jobs", job_ids: selectedJobs }),
    });
    setDeleting(false);
    setSelectMode(false);
    setSelectedJobs([]);
    loadJobs();
  };

  useEffect(() => { loadJobs(); }, []);

  const toggleFactory = (id: string) => {
    setNewJob(j => ({
      ...j,
      factory_ids: j.factory_ids.includes(id)
        ? j.factory_ids.filter(f => f !== id)
        : [...j.factory_ids, id],
    }));
  };

  const DEFAULT_FIELDS = ["Unit price (USD)", "MOQ", "Lead time", "Sample lead time", "Payment terms"];

  const buildDraftBody = (jobName: string, fields: string[]) => {
    const fieldList = fields.map(f => `• ${f}`).join("\n");
    return `Hi [contact name],

Please find attached our product list for the ${jobName}. We would appreciate it if you could review the attached file and provide us with your pricing and details.

Please fill in the following for each item:
${fieldList}

Kindly reply to this email with the completed sheet at your earliest convenience. If you have any questions regarding the specifications, please don't hesitate to reach out.

We look forward to hearing from you.

Best regards,
[your name]`;
  };

  const openDraft = async (jobId: string, provider?: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    setPendingProvider(provider);
    setDraftModal({
      jobId,
      emailBody: buildDraftBody(job.job_name, DEFAULT_FIELDS),
      fields: [...DEFAULT_FIELDS],
    });
  };

  const sendRfq = async (jobId: string, provider?: string, emailBody?: string) => {
    setSending(jobId);
    const res = await fetch("/api/workflows/factory-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  const saveAsDraft = async () => {
    if (!newJob.job_name) return;
    setSavingDraft(true);
    const selectedFactories = factories.filter(f => newJob.factory_ids.includes(f.id));
    let fileBase64 = "";
    let fileName = "";
    if (productFile) {
      fileBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = e => resolve((e.target?.result as string).split(",")[1]);
        reader.readAsDataURL(productFile);
      });
      fileName = productFile.name;
    } else if (activeDraftJob) {
      fileBase64 = activeDraftJob.product_file_base64 || "";
      fileName = activeDraftJob.product_file_name || "RFQ.xlsx";
    }
    if (activeDraftJob) {
      await fetch("/api/workflows/factory-quote", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_jobs", job_ids: [activeDraftJob.id] }) });
    }
    await fetch("/api/workflows/factory-quote", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_job",
        job_name: newJob.job_name,
        factories: selectedFactories.map(f => ({ name: f.name, email: f.email, contact_name: f.contact_name })),
        order_details: { duty_pct: newJob.duty_pct, tariff_pct: newJob.tariff_pct, freight: newJob.freight, plm_product_ids: activeDraftJob?.order_details?.plm_product_ids || [] },
        product_file_base64: fileBase64,
        product_file_name: fileName,
        status: "draft",
      }),
    });
    setSavingDraft(false);
    setShowNew(false);
    setNewJob({ job_name: "", factory_ids: [], duty_pct: "30", tariff_pct: "20", freight: "0.15" });
    setProductFile(null);
    setActiveDraftJob(null);
    await loadJobs();
  };

  const createJob = async () => {
    if (!newJob.job_name || newJob.factory_ids.length === 0 || (!productFile && !activeDraftJob)) return;
    setCreating(true);

    const selectedFactories = factories.filter(f => newJob.factory_ids.includes(f.id));

    let fileBase64 = "";
    let fileName = "";

    if (productFile) {
      fileBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = e => resolve((e.target?.result as string).split(",")[1]);
        reader.readAsDataURL(productFile);
      });
      fileName = productFile.name;
    } else if (activeDraftJob) {
      fileBase64 = activeDraftJob.product_file_base64 || "";
      fileName = activeDraftJob.product_file_name || "RFQ.xlsx";
    }

    // If using draft job, delete it first then create proper job
    if (activeDraftJob) {
      await fetch("/api/workflows/factory-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_jobs", job_ids: [activeDraftJob.id] }),
      });
    }

    const res = await fetch("/api/workflows/factory-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_job",
        job_name: newJob.job_name,
        factories: selectedFactories.map(f => ({ name: f.name, email: f.email, contact_name: f.contact_name })),
        order_details: { 
          duty_pct: newJob.duty_pct, 
          tariff_pct: newJob.tariff_pct, 
          freight: newJob.freight,
          plm_product_ids: activeDraftJob?.order_details?.plm_product_ids || [],
        },
        product_file_base64: fileBase64,
        product_file_name: fileName,
      }),
    });
    const data = await res.json();
    setCreating(false);
    setShowNew(false);
    setNewJob({ job_name: "", factory_ids: [], duty_pct: "30", tariff_pct: "20", freight: "0.15" });
    setProductFile(null);
    await loadJobs();

    // Open draft modal
    if (data.job?.id) {
      await loadJobs();
      const jobName = newJob.job_name;
      const DEFAULT_FIELDS = ["Unit price (USD)", "MOQ", "Lead time", "Sample lead time", "Payment terms"];
      const emailBody = `Hi [contact name],

Please find attached our product list for the ${jobName}. We would appreciate it if you could review the attached file and provide us with your pricing and details.

Please fill in the following for each item:
${DEFAULT_FIELDS.map((f: string) => `• ${f}`).join("\n")}

Kindly reply to this email with the completed sheet at your earliest convenience. If you have any questions regarding the specifications, please don't hesitate to reach out.

We look forward to hearing from you.

Best regards,
[your name]`;

      // Check if both providers connected first
      const providerCheck = await fetch("/api/workflows/factory-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_rfq", job_id: data.job.id, check_only: true }),
      });
      const providerData = await providerCheck.json();

      if (providerData.error === "both_connected") {
        setProviderModal({ jobId: data.job.id, gmailEmail: providerData.gmailEmail, outlookEmail: providerData.outlookEmail });
      } else {
        setDraftModal({ jobId: data.job.id, emailBody, fields: DEFAULT_FIELDS });
      }
    }
  };

  const uploadQuote = async (jobId: string, file: File, factoryName?: string) => {
    setProcessing(factoryName ? jobId + factoryName : jobId);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      const job = jobs.find(j => j.id === jobId);
      const jobFactories = job?.factories || [];
      const matchedFactory = factoryName
        ? jobFactories.find((f: any) => f.name === factoryName)
        : jobFactories.find((f: any) => file.name.toLowerCase().includes(f.name?.toLowerCase()));
      await fetch("/api/workflows/factory-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "process_file",
          job_id: jobId,
          factory_name: matchedFactory?.name || factoryName || file.name.replace(/\.xlsx?$/, ""),
          factory_email: matchedFactory?.email || "",
          file_base64: base64,
          file_name: file.name,
        }),
      });
      setProcessing(null);
      loadJobs();
    };
    reader.readAsDataURL(file);
  };

  const buildMaster = async (jobId: string) => {
    setBuilding(jobId);
    const res = await fetch("/api/workflows/factory-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "build_master", job_id: jobId }),
    });
    const data = await res.json();
    console.log("BUILD MASTER RESPONSE:", JSON.stringify(data).slice(0, 500));
    setBuilding(null);
    loadJobs();
    if (data.sheetUrl) {
      window.open(data.sheetUrl, "_blank");
    } else if (data.base64) {
      const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName || "Master_Quote_Comparison.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const statusColors: Record<string, string> = {
    waiting: "text-white/40 bg-white/5 border-white/10",
    rfq_sent: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    ready: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    complete: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  };

  const statusLabels: Record<string, string> = {
    waiting: "Draft", rfq_sent: "RFQs Sent", ready: "Ready", complete: "Complete",
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Draft email modal */}
      {draftModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg space-y-4 p-6">
            <div>
              <p className="text-sm font-semibold text-white mb-0.5">Review RFQ Email</p>
              <p className="text-[11px] text-white/30">This email will be sent to each factory with their name filled in. Edit the body below then click Send.</p>
            </div>

            {/* Field toggles */}
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Fields to request</p>
              <div className="flex flex-wrap gap-2">
                {["Unit price (USD)", "MOQ", "Lead time", "Sample lead time", "Sample price", "Payment terms", "Packaging details", "Notes/Comments"].map(field => {
                  const active = draftModal.fields.includes(field);
                  return (
                    <button key={field} onClick={() => {
                      const newFields = active
                        ? draftModal.fields.filter(f => f !== field)
                        : [...draftModal.fields, field];
                      setDraftModal({
                        ...draftModal,
                        fields: newFields,
                        emailBody: buildDraftBody(jobs.find(j => j.id === draftModal.jobId)?.job_name || "", newFields),
                      });
                    }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${active ? "border-blue-500/40 bg-blue-500/10 text-blue-300" : "border-white/10 bg-white/[0.03] text-white/30"}`}>
                      {field}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email body editor */}
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Email body <span className="normal-case text-white/20">— [contact name] and [your name] will be filled in automatically</span></p>
              <textarea
                value={draftModal.emailBody}
                onChange={e => setDraftModal({ ...draftModal, emailBody: e.target.value })}
                rows={10}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white/70 text-xs focus:outline-none focus:border-white/20 transition resize-none font-mono leading-relaxed"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const j = draftModal;
                  setDraftModal(null);
                  sendRfq(j.jobId, pendingProvider, j.emailBody);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 transition">
                <Send size={11} />Send to All Factories
              </button>
              <button onClick={() => setDraftModal(null)}
                className="px-4 rounded-xl border border-white/[0.06] text-white/30 text-xs hover:text-white/50 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provider picker modal */}
      {providerModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-80 space-y-4">
            <div>
              <p className="text-sm font-semibold text-white mb-1">Send RFQs via which account?</p>
              <p className="text-[11px] text-white/30">Both Gmail and Outlook are connected. Pick which one to send from.</p>
            </div>
            <div className="space-y-2">
              <button onClick={() => { const j = providerModal; setProviderModal(null); openDraft(j.jobId, "gmail"); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-white/20 transition text-left">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs">G</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Gmail</p>
                  <p className="text-[10px] text-white/30">{providerModal.gmailEmail}</p>
                </div>
              </button>
              <button onClick={() => { const j = providerModal; setProviderModal(null); openDraft(j.jobId, "outlook"); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-white/20 transition text-left">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs">O</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Outlook</p>
                  <p className="text-[10px] text-white/30">{providerModal.outlookEmail}</p>
                </div>
              </button>
            </div>
            <button onClick={() => setProviderModal(null)} className="w-full text-center text-[11px] text-white/20 hover:text-white/40 transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Jobs Section */}
      {true && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => { setActiveDraftJob(null); setProductFile(null); setNewJob({ job_name: "", factory_ids: [], duty_pct: "30", tariff_pct: "20", freight: "0.15" }); setShowNew(!showNew); }}
              className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition px-3 py-2 rounded-xl border border-white/[0.06] hover:border-white/10 bg-white/[0.02]">
              <Plus size={11} />New Quote Job
            </button>
            {jobs.length > 0 && (
              <button onClick={() => { setSelectMode(!selectMode); setSelectedJobs([]); }}
                className={`flex items-center gap-2 text-xs transition px-3 py-2 rounded-xl border ${selectMode ? "border-red-500/30 text-red-400 bg-red-500/5" : "border-white/[0.06] text-white/30 hover:text-white/50 bg-white/[0.02]"}`}>
                {selectMode ? <X size={11} /> : <Trash2 size={11} />}
                {selectMode ? "Cancel" : "Select"}
              </button>
            )}
            {selectMode && selectedJobs.length > 0 && (
              <button onClick={deleteSelectedJobs} disabled={deleting}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50">
                {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                Delete {selectedJobs.length} job{selectedJobs.length > 1 ? "s" : ""}
              </button>
            )}
          </div>

          {showNew && (
            <div className="border border-white/[0.08] rounded-xl p-4 bg-white/[0.02] space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-white/40 uppercase tracking-widest">New Quote Job</p>
                {activeDraftJob && activeDraftJob.order_details?.plm_product_ids?.length > 0 && <span className="text-[10px] text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">From PLM</span>}
              </div>

              <div>
                <label className="text-[11px] text-white/30 mb-1 block">Job Name</label>
                <input value={newJob.job_name} onChange={e => setNewJob({...newJob, job_name: e.target.value})}
                  placeholder="e.g. Spring 2026 Glass Collection"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20" />
              </div>

              {/* Product file upload */}
              <div>
                <label className="text-[11px] text-white/30 mb-1.5 block">Product List File <span className="text-white/15">(your Excel with products — gets sent to factories as-is)</span></label>
                <label className="cursor-pointer block">
                  <input type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={e => setProductFile(e.target.files?.[0] || null)} />
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${productFile ? "border-emerald-500/30 bg-emerald-500/5" : (activeDraftJob && activeDraftJob.product_file_base64) ? "border-pink-500/30 bg-pink-500/5" : "border-dashed border-white/[0.08] hover:border-white/20 bg-white/[0.02]"}`}>
                    {productFile ? (
                      <>
                        <FileSpreadsheet size={14} className="text-emerald-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-emerald-300 font-medium truncate">{productFile.name}</p>
                          <p className="text-[10px] text-white/30">This exact file will be emailed to each factory</p>
                        </div>
                        <button onClick={e => { e.preventDefault(); setProductFile(null); }} className="text-white/20 hover:text-red-400 transition">
                          <X size={12} />
                        </button>
                      </>
                    ) : activeDraftJob && activeDraftJob.product_file_base64 && !productFile ? (
                      <>
                        <FileSpreadsheet size={14} className="text-pink-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-pink-300 font-medium truncate">{activeDraftJob.product_file_name || "RFQ sheet"}</p>
                          <p className="text-[10px] text-white/30">Saved in draft — will be sent to factories</p>
                        </div>
                        <button onClick={e => { e.preventDefault(); setActiveDraftJob((prev: any) => ({...prev, product_file_base64: null, product_file_name: null})); }} className="text-white/20 hover:text-red-400 transition">
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload size={14} className="text-white/20 flex-shrink-0" />
                        <p className="text-xs text-white/30">Click to upload your product list Excel</p>
                      </>
                    )}
                  </div>
                </label>
              </div>

              {/* Factory picker */}
              <div>
                <label className="text-[11px] text-white/30 mb-1.5 block">Send To <span className="text-white/15">(select factories)</span></label>
                {factories.length === 0 ? (
                  <div className="text-[11px] text-white/20 italic p-3 border border-white/[0.06] rounded-xl">
                    No factories saved yet — add them in Product Lifecycle → Factory Access.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {factories.map(f => (
                      <button key={f.id} onClick={() => toggleFactory(f.id)}
                        className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs transition ${newJob.factory_ids.includes(f.id) ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-white/[0.06] bg-white/[0.02] text-white/50 hover:border-white/10"}`}>
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

              {/* Cost settings */}
              <div>
                <label className="text-[11px] text-white/30 mb-1.5 block">Cost Settings</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "duty_pct", label: "Duty %", placeholder: "30" },
                    { key: "tariff_pct", label: "Tariff %", placeholder: "20" },
                    { key: "freight", label: "Freight/unit ($)", placeholder: "0.15" },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="text-[10px] text-white/20 mb-1 block">{field.label}</label>
                      <input value={(newJob as any)[field.key]} onChange={e => setNewJob({...newJob, [field.key]: e.target.value})}
                        placeholder={field.placeholder}
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <button onClick={createJob}
                  disabled={creating || !newJob.job_name || newJob.factory_ids.length === 0 || (!productFile && !activeDraftJob)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 transition disabled:opacity-40">
                  {creating ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                  Draft RFQs
                </button>
                <button onClick={saveAsDraft}
                  disabled={savingDraft || !newJob.job_name}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.10] text-white/60 text-xs font-semibold hover:bg-white/5 transition disabled:opacity-40">
                  {savingDraft ? <Loader2 size={11} className="animate-spin" /> : <FileSpreadsheet size={11} />}
                  Save as Draft
                </button>
                <button onClick={() => { setShowNew(false); setProductFile(null); setActiveDraftJob(null); }}
                  className="px-4 py-2 rounded-xl border border-white/[0.06] text-white/30 text-xs hover:text-white/50 transition">
                  Cancel
                </button>
              </div>
              <p className="text-[10px] text-white/15">Jimmy will email your product list to each selected factory with a personalized message asking them to fill in their pricing and send it back.</p>
            </div>
          )}

          {/* Draft banner */}
          {!loading && jobs.filter(j => j.status === "draft").map(job => (
            <div key={job.id} className="border border-pink-500/30 bg-pink-500/[0.04] rounded-xl p-4 flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet size={14} className="text-pink-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{job.job_name}</p>
                  <p className="text-xs text-white/30">
                    {job.order_details?.plm_product_ids?.length ? "Draft from PLM" : "Saved draft"} — add factories, set costs, then Draft RFQs
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => {
                  setActiveDraftJob(job);
                  const draftFactoryIds = (job.factories || []).map((df: any) => {
                    const match = factories.find((f: any) => f.name === df.name || f.email === df.email);
                    return match?.id;
                  }).filter(Boolean);
                  setNewJob(prev => ({ ...prev, job_name: job.job_name, duty_pct: job.order_details?.duty_pct || "30", tariff_pct: job.order_details?.tariff_pct || "20", freight: job.order_details?.freight || "0.15", factory_ids: draftFactoryIds }));
                  setShowNew(true);
                }}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-pink-500 text-white font-semibold hover:bg-pink-400 transition">
                  Open Draft →
                </button>
                <button onClick={async () => {
                  await fetch("/api/workflows/factory-quote", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "delete_jobs", job_ids: [job.id] }) });
                  loadJobs();
                }}
                  className="p-2 rounded-xl border border-white/[0.06] text-white/30 hover:text-red-400 hover:border-red-500/30 transition">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}

          {/* Job list */}
          {loading ? (
            <div className="flex items-center gap-2 text-white/20 text-xs py-2"><Loader2 size={11} className="animate-spin" />Loading jobs...</div>
          ) : jobs.filter(j => j.status !== "draft").length === 0 && jobs.filter(j => j.status === "draft").length === 0 ? (
            <p className="text-white/15 text-xs py-2">No quote jobs yet — create one above.</p>
          ) : (
            <div className="space-y-4">
              {jobs.filter(j => j.status !== "draft").map(job => {
                const quotesReceived = job.factory_quotes?.length || 0;
                const totalFactories = job.factories?.length || 0;
                const pct = totalFactories > 0 ? Math.round((quotesReceived / totalFactories) * 100) : 0;
                const isSending = sending === job.id;

                return (
                  <div key={job.id} className={`border rounded-xl overflow-hidden transition ${selectedJobs.includes(job.id) ? "border-red-500/30 bg-red-500/[0.03]" : "border-white/[0.06] bg-white/[0.01]"}`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-2">
                          {selectMode && (
                            <button onClick={() => setSelectedJobs(s => s.includes(job.id) ? s.filter(id => id !== job.id) : [...s, job.id])}
                              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition ${selectedJobs.includes(job.id) ? "border-red-400 bg-red-500" : "border-white/20"}`}>
                              {selectedJobs.includes(job.id) && <Check size={9} className="text-white" />}
                            </button>
                          )}
                          <div>
                          <p className="text-sm font-semibold text-white mb-0.5">{job.job_name}</p>
                          {job.product_file_name && (
                            <p className="text-[10px] text-blue-400/60 mb-0.5">📎 {job.product_file_name}</p>
                          )}
                          <p className="text-[10px] text-white/25">{new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[job.status] || "text-white/30 bg-white/5 border-white/10"}`}>
                          {statusLabels[job.status] || job.status}
                        </span>
                      </div>

                      {isSending && (
                        <div className="flex items-center gap-2 text-blue-400 text-xs mb-3 bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-2">
                          <Loader2 size={11} className="animate-spin" />
                          Sending RFQ emails to {totalFactories} {totalFactories === 1 ? "factory" : "factories"}...
                        </div>
                      )}

                      {/* Progress */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-white/30">Quotes received</span>
                          <span className="text-[10px] text-white/40">{quotesReceived} / {totalFactories}</span>
                        </div>
                        <div className="w-full bg-white/[0.05] rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      {/* Factory statuses — per-factory upload */}
                      <div className="space-y-2 mb-3">
                        {(job.factories || []).map((factory: any, i: number) => {
                          const received = job.factory_quotes?.find((q: any) =>
                            q.factory_name === factory.name || q.factory_email === factory.email
                          );
                          const isProcessing = processing === job.id + factory.name;
                          return (
                            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition ${received ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-white/[0.05] bg-white/[0.01]"}`}>
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${received ? "bg-emerald-400" : job.status === "rfq_sent" || job.status === "ready" || job.status === "complete" ? "bg-blue-400/40" : "bg-white/15"}`} />
                              <span className="text-[11px] text-white/60 flex-1">{factory.name}</span>
                              {received ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-emerald-400/80">{received.processed_data?.length || 0} products received</span>
                                  <button onClick={async () => {
                                    if (!confirm("Remove this quote?")) return;
                                    await fetch("/api/workflows/factory-quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_quote", quote_id: received.id }) });
                                    loadJobs();
                                  }} className="text-white/15 hover:text-red-400 transition"><Trash2 size={10} /></button>
                                </div>
                              ) : job.status !== "complete" ? (
                                <label className="cursor-pointer">
                                  <input type="file" accept=".xlsx,.xls" className="hidden"
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) uploadQuote(job.id, file, factory.name);
                                    }} />
                                  {isProcessing ? (
                                    <div className="flex items-center gap-1 text-blue-400">
                                      <Loader2 size={10} className="animate-spin" />
                                      <span className="text-[10px]">Processing...</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-white/30 hover:text-white/60 transition">
                                      <Upload size={10} />
                                      <span className="text-[10px]">Upload quote</span>
                                    </div>
                                  )}
                                </label>
                              ) : (
                                <span className="text-[10px] text-white/20">no quote received</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {job.status === "complete" && job.master_sheet_url ? (
                          <a href={job.master_sheet_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition">
                            <ExternalLink size={11} />View Master Sheet
                          </a>
                        ) : (
                          <button onClick={() => buildMaster(job.id)}
                            disabled={building === job.id || quotesReceived === 0}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition disabled:opacity-40">
                            {building === job.id ? <Loader2 size={11} className="animate-spin" /> : <FileSpreadsheet size={11} />}
                            {building === job.id ? "Building..." : "Build Master Sheet"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* AI Recommendation — shows after complete */}
                    {job.status === "complete" && job.ai_recommendation && (
                      <div className="border-t border-white/[0.06] px-4 py-3 bg-purple-500/[0.03]">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={11} className="text-purple-400" />
                          <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest">Jimmy's Recommendation</p>
                        </div>
                        <p className="text-xs text-white/50 leading-relaxed">{job.ai_recommendation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WorkflowCard({ def, userWorkflow, onToggle, onSaveSettings, factories, onCatalogRefresh }: {
  def: typeof WORKFLOW_DEFS[0]; userWorkflow: UserWorkflow | undefined;
  onToggle: (type: string, enabled: boolean) => void;
  onSaveSettings: (type: string, settings: Record<string, string>) => void;
  factories: Factory[]; onCatalogRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>((userWorkflow?.settings as Record<string, string>) || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const enabled = userWorkflow?.enabled ?? false;

  const handleSave = async () => {
    setSaving(true);
    await onSaveSettings(def.type, settings);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${enabled ? "border-white/10 bg-white/[0.02]" : "border-white/[0.05] bg-white/[0.01]"}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${def.color}15`, border: `1px solid ${def.color}25` }}>
              <def.icon size={16} style={{ color: def.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-white">{def.name}</p>
                {enabled && <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Live</span>}
              </div>
              <p className="text-xs text-white/35">{def.tagline}</p>
              {userWorkflow?.last_run_at && <p className="text-[10px] text-white/20 mt-1">Last ran {timeAgo(userWorkflow.last_run_at)}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setExpanded(!expanded)}
              className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 transition">
              <Settings size={12} />
            </button>
            <button onClick={() => onToggle(def.type, !enabled)}
              className={`relative w-11 h-6 rounded-full transition-all ${enabled ? "bg-emerald-500" : "bg-white/10"}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${enabled ? "left-6" : "left-1"}`} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1">
          {def.steps.map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.05] rounded-lg px-2 py-1">
                <StepDot type={step.type} />
                <span className="text-[10px] text-white/35 whitespace-nowrap">{step.label}</span>
                {!step.auto && <Shield size={7} className="text-amber-400 flex-shrink-0" />}
              </div>
              {i < def.steps.length - 1 && <ArrowRight size={9} className="text-white/10 flex-shrink-0" />}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1"><Bot size={9} className="text-purple-400" /><span className="text-[9px] text-white/20">AI Auto</span></div>
          <div className="flex items-center gap-1"><Shield size={9} className="text-amber-400" /><span className="text-[9px] text-white/20">Needs Approval</span></div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.06] p-5 bg-white/[0.01]">
          {def.type === "factory_quote" ? (
            <FactoryQuoteManager factories={factories} onCatalogRefresh={onCatalogRefresh} />
          ) : def.settingsFields.length > 0 ? (
            <>
              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4">Settings</p>
              <div className="space-y-3">
                {def.settingsFields.map(field => (
                  <div key={field.key}>
                    <label className="text-[11px] text-white/40 mb-1.5 block">{field.label}</label>
                    {field.type === "textarea" ? (
                      <textarea value={settings[field.key] || ""} onChange={e => setSettings({ ...settings, [field.key]: e.target.value })}
                        placeholder={field.placeholder} rows={3}
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20 transition resize-none" />
                    ) : (
                      <input type="text" value={settings[field.key] || ""} onChange={e => setSettings({ ...settings, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white/70 placeholder-white/15 text-xs focus:outline-none focus:border-white/20 transition" />
                    )}
                  </div>
                ))}
              </div>
              <button onClick={handleSave} disabled={saving}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 transition disabled:opacity-50">
                {saving ? <Loader2 size={11} className="animate-spin" /> : saved ? <Check size={11} /> : null}
                {saved ? "Saved!" : "Save Settings"}
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function FactoryQuotePage() {
  const router = useRouter();
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCatalog = useCallback(async () => {
    const res = await fetch("/api/catalog?type=factories");
    const data = await res.json();
    setFactories(data.factories || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);



  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.push("/workflows")} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition mb-3">
            ← Back to Workflows
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Factory size={14} className="text-blue-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Factory Quote Request</h1>
            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Live</span>
          </div>
          <p className="text-white/30 text-sm">Upload product list → Jimmy emails factories → auto-compares quotes</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-white/20" /></div>
        ) : (
          <FactoryQuoteManager factories={factories} onCatalogRefresh={loadCatalog} />
        )}
      </div>
    </div>
  );
}
