"use client";

import { useState, useEffect } from "react";
import {
  Zap, AlertCircle, Check, X, ChevronRight, ChevronDown,
  Settings, Eye, Factory, CreditCard, Calendar, FileText,
  TrendingDown, Loader2, ArrowRight, Shield, Bot, RotateCcw, Circle
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

const WORKFLOW_DEFS = [
  {
    type: "factory_quote", icon: Factory, name: "Factory Quote Request",
    tagline: "Auto-request & compare quotes from suppliers", color: "#3b82f6",
    steps: [
      { label: "Enter item specs + factory emails", type: "input", auto: false },
      { label: "Jimmy drafts RFQ emails", type: "draft", auto: true },
      { label: "You approve & Jimmy sends", type: "approval", auto: false },
      { label: "Jimmy monitors replies & extracts pricing", type: "monitor", auto: true },
      { label: "Comparison sheet updated", type: "execute", auto: true },
      { label: "AI analysis & recommendation", type: "analysis", auto: true },
      { label: "Action items created", type: "execute", auto: true },
    ],
    settingsFields: [
      { key: "factory_emails", label: "Factory Email Addresses", placeholder: "factory1@co.com, factory2@co.com", type: "textarea" },
      { key: "default_item", label: "Default Item/Product", placeholder: "e.g. Stainless steel water bottles", type: "text" },
      { key: "comparison_sheet", label: "Google Sheet Name (optional)", placeholder: "e.g. Quote Comparisons 2026", type: "text" },
    ],
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

function WorkflowCard({ def, userWorkflow, onToggle, onSaveSettings }: {
  def: typeof WORKFLOW_DEFS[0]; userWorkflow: UserWorkflow | undefined;
  onToggle: (type: string, enabled: boolean) => void;
  onSaveSettings: (type: string, settings: Record<string, string>) => void;
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

        {/* Step flow */}
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
        </div>
      )}
    </div>
  );
}

export default function WorkflowsPage() {
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [userWorkflows, setUserWorkflows] = useState<UserWorkflow[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"workflows" | "history">("workflows");

  const load = async () => {
    const res = await fetch("/api/workflows");
    const data = await res.json();
    if (!data.error) { setPending(data.pending || []); setUserWorkflows(data.userWorkflows || []); setHistory(data.history || []); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: string) => {
    setApproving(id);
    await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve", actionId: id }) });
    setApproving(null); load();
  };

  const handleReject = async (id: string) => {
    await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", actionId: id }) });
    load();
  };

  const handleToggle = async (workflowType: string, enabled: boolean) => {
    await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", workflowType, enabled }) });
    load();
  };

  const handleSaveSettings = async (workflowType: string, settings: Record<string, string>) => {
    await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_settings", workflowType, settings }) });
    load();
  };

  const activeWorkflows = WORKFLOW_DEFS.filter(w => userWorkflows.find(uw => uw.workflow_type === w.type && uw.enabled));
  const inactiveWorkflows = WORKFLOW_DEFS.filter(w => !userWorkflows.find(uw => uw.workflow_type === w.type && uw.enabled));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="max-w-4xl mx-auto flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Zap size={14} className="text-white/60" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Workflows</h1>
              {pending.length > 0 && (
                <span className="text-[10px] bg-amber-500/15 border border-amber-500/25 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                  {pending.length} pending
                </span>
              )}
            </div>
            <p className="text-white/30 text-sm">AI-powered automations that act on your behalf</p>
          </div>
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            <button onClick={() => setActiveTab("workflows")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "workflows" ? "bg-white text-black" : "text-white/40 hover:text-white/60"}`}>Workflows</button>
            <button onClick={() => setActiveTab("history")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === "history" ? "bg-white text-black" : "text-white/40 hover:text-white/60"}`}>History</button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-white/20" /></div>
        ) : activeTab === "workflows" ? (
          <div className="space-y-8">
            {pending.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle size={14} className="text-amber-400" />
                  <h2 className="text-sm font-semibold text-white">Needs Your Approval</h2>
                  <span className="text-xs text-white/30">{pending.length} waiting</span>
                </div>
                <div className="space-y-3">
                  {pending.map(a => <PendingCard key={a.id} action={a} onApprove={handleApprove} onReject={handleReject} approving={approving} />)}
                </div>
              </div>
            )}

            {activeWorkflows.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h2 className="text-sm font-semibold text-white">Active Workflows</h2>
                  <span className="text-xs text-white/30">{activeWorkflows.length} running</span>
                </div>
                <div className="space-y-3">
                  {activeWorkflows.map(def => <WorkflowCard key={def.type} def={def} userWorkflow={userWorkflows.find(w => w.workflow_type === def.type)} onToggle={handleToggle} onSaveSettings={handleSaveSettings} />)}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-semibold text-white/50">Available Workflows</h2>
                <span className="text-xs text-white/20">{inactiveWorkflows.length} ready to activate</span>
              </div>
              <div className="space-y-3">
                {inactiveWorkflows.map(def => <WorkflowCard key={def.type} def={def} userWorkflow={userWorkflows.find(w => w.workflow_type === def.type)} onToggle={handleToggle} onSaveSettings={handleSaveSettings} />)}
              </div>
            </div>

            <div className="border border-white/[0.04] rounded-2xl p-4 bg-white/[0.01]">
              <p className="text-[10px] text-white/20 uppercase tracking-widest mb-3">How Workflows Work</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: <Zap size={10} className="text-blue-400" />, label: "Trigger", desc: "Auto-detected by Jimmy" },
                  { icon: <Bot size={10} className="text-purple-400" />, label: "AI Draft", desc: "Jimmy writes the content" },
                  { icon: <Shield size={10} className="text-amber-400" />, label: "Your Approval", desc: "You review before it sends" },
                  { icon: <Zap size={10} className="text-emerald-400" />, label: "Auto Execute", desc: "Jimmy acts immediately" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0">{item.icon}</div>
                    <div>
                      <p className="text-[11px] text-white/50 font-medium">{item.label}</p>
                      <p className="text-[10px] text-white/20">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <RotateCcw size={14} className="text-white/30" />
              <h2 className="text-sm font-semibold text-white">Workflow History</h2>
              <span className="text-xs text-white/30">{history.length} actions</span>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-16">
                <RotateCcw size={24} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/20 text-sm">No workflow history yet</p>
                <p className="text-white/10 text-xs mt-1">Actions you approve or reject will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(item => {
                  const def = WORKFLOW_DEFS.find(w => w.type === item.workflow_type);
                  return (
                    <div key={item.id} className="flex items-center gap-4 p-4 border border-white/[0.05] rounded-xl bg-white/[0.01] hover:border-white/10 transition">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${def?.color || "#6b7280"}15`, border: `1px solid ${def?.color || "#6b7280"}25` }}>
                        {def ? <def.icon size={13} style={{ color: def.color }} /> : <Zap size={13} className="text-white/30" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/70 font-medium truncate">{item.title}</p>
                        <p className="text-[11px] text-white/25">{ACTION_LABELS[item.action_type] || item.action_type} · {timeAgo(item.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[item.status] || "#6b7280" }} />
                        <span className="text-[11px] font-medium capitalize" style={{ color: STATUS_COLORS[item.status] || "#6b7280" }}>{item.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
