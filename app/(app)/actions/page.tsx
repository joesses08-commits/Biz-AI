"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Plus, Check, X, ChevronDown, ChevronUp, Calendar, Users, AlertTriangle, Zap, Archive, Edit3 } from "lucide-react";

type Step = { id: string; text: string; done: boolean };

type ActionItem = {
  id: string;
  title: string;
  detail: string;
  source: string;
  status: string;
  priority: string;
  due_date: string | null;
  people_involved: string[];
  steps: Step[];
  progress: number;
  context_note: string;
  dismissed_reason: string;
  created_at: string;
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 border-red-500/30 text-red-400",
  high: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  medium: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  low: "bg-white/5 border-white/10 text-white/30",
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-400",
  high: "bg-amber-400",
  medium: "bg-blue-400",
  low: "bg-white/20",
};

const SOURCE_LABEL: Record<string, string> = {
  ai: "AI Detected",
  email: "From Email",
  chat: "From Chat",
  manual: "Manual",
  dashboard: "Dashboard",
};

function generateId() { return Math.random().toString(36).slice(2); }

function daysUntil(date: string) {
  const diff = new Date(date).getTime() - new Date().setHours(0,0,0,0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function DueBadge({ date }: { date: string }) {
  const days = daysUntil(date);
  if (days < 0) return <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">Overdue {Math.abs(days)}d</span>;
  if (days === 0) return <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">Due today</span>;
  if (days <= 3) return <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Due in {days}d</span>;
  return <span className="text-[10px] bg-white/5 text-white/30 border border-white/10 px-2 py-0.5 rounded-full">{new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>;
}

function ActionCard({ item, onUpdate, onDismiss, onComplete }: {
  item: ActionItem;
  onUpdate: (id: string, updates: Partial<ActionItem>) => void;
  onDismiss: (id: string, reason: string) => void;
  onComplete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingContext, setEditingContext] = useState(false);
  const [contextNote, setContextNote] = useState(item.context_note || "");
  const [dismissReason, setDismissReason] = useState("");
  const [showDismiss, setShowDismiss] = useState(false);
  const [editingSteps, setEditingSteps] = useState(false);
  const [newStep, setNewStep] = useState("");

  const completedSteps = item.steps?.filter(s => s.done).length || 0;
  const totalSteps = item.steps?.length || 0;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : item.progress;

  const toggleStep = (stepId: string) => {
    const updated = item.steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s);
    const newProgress = updated.length > 0 ? Math.round((updated.filter(s => s.done).length / updated.length) * 100) : 0;
    onUpdate(item.id, { steps: updated, progress: newProgress });
  };

  const addStep = () => {
    if (!newStep.trim()) return;
    const updated = [...(item.steps || []), { id: generateId(), text: newStep.trim(), done: false }];
    onUpdate(item.id, { steps: updated });
    setNewStep("");
  };

  const removeStep = (stepId: string) => {
    const updated = item.steps.filter(s => s.id !== stepId);
    onUpdate(item.id, { steps: updated });
  };

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium}`}>
      {/* Main row */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Complete button */}
          <button onClick={() => onComplete(item.id)}
            className="w-5 h-5 rounded-full border border-white/20 hover:border-emerald-400 hover:bg-emerald-400/10 flex items-center justify-center flex-shrink-0 mt-0.5 transition group">
            <Check size={10} className="text-white/0 group-hover:text-emerald-400 transition" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[item.priority]}`} />
                <h3 className="text-sm font-semibold text-white leading-snug">{item.title}</h3>
                <span className="text-[10px] text-white/25 border border-white/10 px-1.5 py-0.5 rounded-full">
                  {SOURCE_LABEL[item.source] || item.source}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.due_date && <DueBadge date={item.due_date} />}
                <button onClick={() => setExpanded(!expanded)}
                  className="text-white/20 hover:text-white/50 transition">
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>

            <p className="text-xs text-white/40 leading-relaxed mb-3">{item.detail}</p>

            {/* Progress bar */}
            {totalSteps > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[10px] text-white/30 flex-shrink-0">{completedSteps}/{totalSteps} steps</span>
              </div>
            )}

            {/* People + context note preview */}
            <div className="flex items-center gap-3 flex-wrap">
              {item.people_involved?.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users size={11} className="text-white/25" />
                  <span className="text-[10px] text-white/30">{item.people_involved.join(", ")}</span>
                </div>
              )}
              {item.context_note && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-white/25 italic">"{item.context_note.slice(0, 50)}{item.context_note.length > 50 ? "..." : ""}"</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-white/[0.06] p-5 space-y-5">

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Steps</p>
              <button onClick={() => setEditingSteps(!editingSteps)}
                className="text-[10px] text-white/30 hover:text-white/60 transition">
                {editingSteps ? "Done" : "Edit"}
              </button>
            </div>
            <div className="space-y-2">
              {(item.steps || []).map(step => (
                <div key={step.id} className="flex items-center gap-2.5 group">
                  <button onClick={() => toggleStep(step.id)}
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition ${step.done ? "bg-emerald-400 border-emerald-400" : "border-white/20 hover:border-emerald-400"}`}>
                    {step.done && <Check size={9} className="text-black" />}
                  </button>
                  <span className={`text-xs flex-1 ${step.done ? "line-through text-white/20" : "text-white/60"}`}>{step.text}</span>
                  {editingSteps && (
                    <button onClick={() => removeStep(step.id)} className="opacity-0 group-hover:opacity-100 transition">
                      <X size={12} className="text-white/30 hover:text-red-400" />
                    </button>
                  )}
                </div>
              ))}
              {editingSteps && (
                <div className="flex items-center gap-2 mt-2">
                  <input value={newStep} onChange={e => setNewStep(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addStep(); }}}
                    placeholder="Add a step..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-white/20" />
                  <button onClick={addStep} className="text-xs text-white/40 hover:text-white px-2 py-1.5 border border-white/10 rounded-lg transition">Add</button>
                </div>
              )}
              {(item.steps || []).length === 0 && !editingSteps && (
                <p className="text-xs text-white/20 italic">No steps yet — click Edit to add some</p>
              )}
            </div>
          </div>

          {/* Context note */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Context for AI</p>
              <button onClick={() => setEditingContext(!editingContext)}
                className="text-[10px] text-white/30 hover:text-white/60 transition flex items-center gap-1">
                <Edit3 size={10} />
                {editingContext ? "Save" : "Edit"}
              </button>
            </div>
            {editingContext ? (
              <textarea value={contextNote}
                onChange={e => setContextNote(e.target.value)}
                onBlur={() => { onUpdate(item.id, { context_note: contextNote }); setEditingContext(false); }}
                placeholder="Tell the AI what it should know about this item... e.g. 'I already handled this' or 'This doesn't matter, it's a side project' or 'Waiting on client response'"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/20 outline-none focus:border-white/20 resize-none leading-relaxed" />
            ) : (
              <p className="text-xs text-white/30 italic leading-relaxed">
                {item.context_note || "No context added — click Edit to tell the AI what it should know about this item"}
              </p>
            )}
          </div>

          {/* People involved */}
          <div>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">People Involved</p>
            <input
              defaultValue={item.people_involved?.join(", ") || ""}
              onBlur={e => onUpdate(item.id, { people_involved: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
              placeholder="e.g. John Smith, Sarah Lee"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-white/20" />
          </div>

          {/* Due date */}
          <div>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Due Date</p>
            <input type="date"
              defaultValue={item.due_date || ""}
              onBlur={e => onUpdate(item.id, { due_date: e.target.value || null })}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/20" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
            <button onClick={() => onComplete(item.id)}
              className="flex items-center gap-1.5 text-xs text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg transition">
              <Check size={11} /> Mark Done
            </button>
            <button onClick={() => setShowDismiss(!showDismiss)}
              className="flex items-center gap-1.5 text-xs text-white/30 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition">
              <Archive size={11} /> Dismiss
            </button>
          </div>

          {showDismiss && (
            <div className="space-y-2">
              <input value={dismissReason} onChange={e => setDismissReason(e.target.value)}
                placeholder="Why are you dismissing this? (AI will learn from this)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-white/20" />
              <button onClick={() => { if (dismissReason.trim()) onDismiss(item.id, dismissReason); }}
                disabled={!dismissReason.trim()}
                className="text-xs text-white/50 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition disabled:opacity-30">
                Confirm Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActionsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [newItem, setNewItem] = useState({ title: "", detail: "", due_date: "", priority: "medium", people_involved: "" });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("action_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  const updateItem = async (id: string, updates: Partial<ActionItem>) => {
    await supabase.from("action_items").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const completeItem = async (id: string) => {
    await updateItem(id, { status: "completed" });
  };

  const dismissItem = async (id: string, reason: string) => {
    await updateItem(id, { status: "dismissed", dismissed_reason: reason });
  };

  const addItem = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !newItem.title.trim()) return;
    const { data } = await supabase.from("action_items").insert({
      user_id: user.id,
      title: newItem.title.trim(),
      detail: newItem.detail.trim(),
      due_date: newItem.due_date || null,
      priority: newItem.priority,
      people_involved: newItem.people_involved.split(",").map(s => s.trim()).filter(Boolean),
      source: "manual",
      steps: [],
      progress: 0,
      status: "active",
    }).select().single();
    if (data) setItems(prev => [data, ...prev]);
    setNewItem({ title: "", detail: "", due_date: "", priority: "medium", people_involved: "" });
    setAddingNew(false);
  };

  const generateFromAI = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/actions/generate", { method: "POST" });
      const data = await res.json();
      if (data.items?.length) {
        await loadItems();
      }
    } catch {}
    setGenerating(false);
  };

  const active = items.filter(i => i.status === "active");
  const completed = items.filter(i => i.status === "completed");
  const dismissed = items.filter(i => i.status === "dismissed");

  const filtered = active.filter(item => {
    if (filter === "all") return true;
    if (!item.due_date) return filter === ("all" as typeof filter);
    const days = daysUntil(item.due_date);
    if (filter === "today") return days <= 0;
    if (filter === "week") return days <= 7;
    if (filter === "month") return days <= 30;
    return true;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const pa = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
    const pb = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
    if (pa !== pb) return pa - pb;
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    return 0;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Action Tracker</h1>
            <p className="text-white/30 text-sm">
              {active.length} active · {completed.length} completed · {dismissed.length} dismissed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={generateFromAI} disabled={generating}
              className="flex items-center gap-2 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/20 px-3 py-2 rounded-xl transition disabled:opacity-40">
              <Zap size={12} className={generating ? "animate-pulse" : ""} />
              {generating ? "Generating..." : "AI Generate"}
            </button>
            <button onClick={() => setAddingNew(true)}
              className="flex items-center gap-2 text-xs text-black bg-white hover:bg-white/90 px-3 py-2 rounded-xl transition font-semibold">
              <Plus size={12} /> Add Action
            </button>
          </div>
        </div>

        {/* Add new item */}
        {addingNew && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6 space-y-4">
            <h3 className="text-sm font-semibold">New Action Item</h3>
            <input value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})}
              placeholder="What needs to be done?"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/20" />
            <textarea value={newItem.detail} onChange={e => setNewItem({...newItem, detail: e.target.value})}
              placeholder="More context..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/20 resize-none" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5 block">Priority</label>
                <select value={newItem.priority} onChange={e => setNewItem({...newItem, priority: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5 block">Due Date</label>
                <input type="date" value={newItem.due_date} onChange={e => setNewItem({...newItem, due_date: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5 block">People</label>
                <input value={newItem.people_involved} onChange={e => setNewItem({...newItem, people_involved: e.target.value})}
                  placeholder="John, Sarah..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addItem} disabled={!newItem.title.trim()}
                className="text-xs text-black bg-white hover:bg-white/90 px-4 py-2 rounded-xl font-semibold transition disabled:opacity-30">
                Add Item
              </button>
              <button onClick={() => setAddingNew(false)}
                className="text-xs text-white/40 hover:text-white border border-white/10 px-4 py-2 rounded-xl transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-1 mb-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
          {(["all", "today", "week", "month"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${filter === f ? "bg-white text-black" : "text-white/40 hover:text-white"}`}>
              {f === "all" ? "All" : f === "today" ? "Today" : f === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>

        {/* Active items */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-white/[0.02] border border-white/[0.05] rounded-2xl animate-pulse" />)}
          </div>
        ) : sortedFiltered.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-10 text-center">
            <p className="text-white/20 text-sm mb-2">No action items</p>
            <p className="text-white/10 text-xs">Click "AI Generate" to pull actions from your data, or add one manually</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedFiltered.map(item => (
              <ActionCard key={item.id} item={item} onUpdate={updateItem} onDismiss={dismissItem} onComplete={completeItem} />
            ))}
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div className="mt-8">
            <button onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 text-xs text-white/30 hover:text-white/50 transition mb-3">
              {showCompleted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Completed ({completed.length})
            </button>
            {showCompleted && (
              <div className="space-y-2 opacity-50">
                {completed.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                    <Check size={12} className="text-emerald-400 flex-shrink-0" />
                    <p className="text-xs text-white/40 line-through flex-1">{item.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dismissed */}
        {dismissed.length > 0 && (
          <div className="mt-4">
            <button onClick={() => setShowDismissed(!showDismissed)}
              className="flex items-center gap-2 text-xs text-white/20 hover:text-white/40 transition mb-3">
              {showDismissed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Dismissed ({dismissed.length})
            </button>
            {showDismissed && (
              <div className="space-y-2 opacity-40">
                {dismissed.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                    <X size={12} className="text-white/30 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/30 line-through">{item.title}</p>
                      {item.dismissed_reason && <p className="text-[10px] text-white/20 italic mt-0.5">"{item.dismissed_reason}"</p>}
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
