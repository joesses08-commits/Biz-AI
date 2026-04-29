"use client";

import { useEffect, useState } from "react";

export default function DrivePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/microsoft/drive")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (!data?.connected) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-white text-2xl font-semibold mb-3">OneDrive Not Connected</h1>
        <a href="/api/microsoft/connect" className="inline-flex items-center gap-2 bg-white text-black font-medium py-2.5 px-6 rounded-xl text-sm hover:bg-white/90 transition">Connect Microsoft 365</a>
      </div>
    </div>
  );

  const files = data.files || [];
  const wordFiles = files.filter((f: any) => f.name?.match(/\.(docx|doc)$/i));
  const excelFiles = files.filter((f: any) => f.name?.match(/\.(xlsx|xls)$/i));
  const pptFiles = files.filter((f: any) => f.name?.match(/\.(pptx|ppt)$/i));
  const otherFiles = files.filter((f: any) => !f.name?.match(/\.(docx|doc|xlsx|xls|pptx|ppt)$/i));

  const filtered = files.filter((f: any) => f.name?.toLowerCase().includes(search.toLowerCase()));

  const FileRow = ({ file }: { file: any }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0 hover:bg-bg-surface px-1 rounded-lg transition">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/70 truncate">{file.name}</p>
        <p className="text-[10px] text-white/25 mt-0.5">
          {file.parentReference?.path?.replace("/drive/root:", "") || "OneDrive"}
        </p>
      </div>
      <div className="text-right flex-shrink-0 ml-4">
        <p className="text-[10px] text-text-muted">{file.lastModifiedDateTime ? new Date(file.lastModifiedDateTime).toLocaleDateString() : ""}</p>
        <p className="text-[10px] text-text-muted">{file.size ? `${Math.round(file.size / 1024)} KB` : ""}</p>
      </div>
    </div>
  );

  const groups = [
    { label: "Word Documents", files: wordFiles, color: "text-blue-400", count: wordFiles.length },
    { label: "Excel Files", files: excelFiles, color: "text-emerald-400", count: excelFiles.length },
    { label: "PowerPoint", files: pptFiles, color: "text-orange-400", count: pptFiles.length },
    { label: "Other Files", files: otherFiles, color: "text-text-secondary", count: otherFiles.length },
  ].filter(g => g.files.length > 0);

  return (
    <div className="min-h-screen bg-bg-base text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
              <path d="M10.5 7.5A5.5 5.5 0 0 1 21 10a4 4 0 0 1-.5 8H5a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 6-2.5z" fill="#0078D4" fillOpacity="0.3" stroke="#0078D4" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">OneDrive</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-text-secondary text-xs">{files.length} files</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Word", count: wordFiles.length, color: "text-blue-400" },
            { label: "Excel", count: excelFiles.length, color: "text-emerald-400" },
            { label: "PowerPoint", count: pptFiles.length, color: "text-orange-400" },
            { label: "Other", count: otherFiles.length, color: "text-text-secondary" },
          ].map(s => (
            <div key={s.label} className="bg-bg-surface border border-bg-border rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-text-muted text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <input type="text" placeholder="Search files..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-bg-elevated border border-bg-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/20 transition" />
        </div>

        {search ? (
          <div className="bg-bg-surface border border-bg-border rounded-2xl p-5">
            <p className="text-[10px] text-text-muted uppercase tracking-widest mb-4">{filtered.length} results</p>
            {filtered.map((f: any) => <FileRow key={f.id} file={f} />)}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(group => (
              <div key={group.label} className="bg-bg-surface border border-bg-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
                  <p className={`text-xs font-semibold ${group.color}`}>{group.label}</p>
                  <span className="text-[10px] text-text-muted">{group.count} files</span>
                </div>
                <div className="px-5 py-2">
                  {group.files.map((f: any) => <FileRow key={f.id} file={f} />)}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
