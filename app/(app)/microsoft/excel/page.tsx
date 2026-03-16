"use client";

import { useEffect, useState } from "react";

export default function ExcelPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSheet, setSelectedSheet] = useState<any>(null);

  useEffect(() => {
    fetch("/api/microsoft/excel")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); if (d.sheets?.length > 0) setSelectedSheet(d.sheets[0]); });
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (!data?.connected) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-white text-2xl font-semibold mb-3">Microsoft Not Connected</h1>
        <a href="/api/microsoft/connect" className="inline-flex items-center gap-2 bg-white text-black font-medium py-2.5 px-6 rounded-xl text-sm hover:bg-white/90 transition">Connect Microsoft 365</a>
      </div>
    </div>
  );

  const files = data.files || [];
  const sheets = data.sheets || [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-[#217346]/10 border border-[#217346]/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="2" fill="#217346" fillOpacity="0.2"/>
              <path d="M14 2v20M2 8h20M2 14h20" stroke="#217346" strokeWidth="1.2" strokeOpacity="0.6"/>
              <path d="M6 5l3 4-3 4M11 13h4" stroke="#217346" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Excel</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-white/40 text-xs">{files.length} files found in OneDrive</span>
            </div>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-10 text-center">
            <p className="text-white/30 text-sm">No Excel files found in your OneDrive.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* File list */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <p className="text-xs font-semibold text-white/40">Files</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {sheets.map((sheet: any, i: number) => (
                  <button key={i} onClick={() => setSelectedSheet(sheet)}
                    className={`w-full text-left px-5 py-3.5 hover:bg-white/[0.03] transition ${selectedSheet === sheet ? "bg-white/[0.06]" : ""}`}>
                    <p className="text-xs font-medium text-white/80 truncate">{sheet.fileName}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{sheet.sheetName} · {sheet.rowCount} rows · {sheet.lastModified ? new Date(sheet.lastModified).toLocaleDateString() : "unknown date"}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Sheet data */}
            <div className="lg:col-span-2 bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
              {selectedSheet ? (
                <>
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white/60">{selectedSheet.fileName}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{selectedSheet.sheetName} · {selectedSheet.rowCount} rows</p>
                    </div>
                    {selectedSheet.lastModified && (
                      <span className="text-[10px] text-white/25">Last modified {new Date(selectedSheet.lastModified).toLocaleDateString()}</span>
                    )}
                  </div>
                  <div className="overflow-auto max-h-[500px]">
                    <table className="w-full text-xs">
                      <tbody>
                        {selectedSheet.rows?.slice(0, 50).map((row: any[], rowIndex: number) => (
                          <tr key={rowIndex} className={`border-b border-white/[0.04] ${rowIndex === 0 ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}>
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className={`px-4 py-2 whitespace-nowrap ${rowIndex === 0 ? "font-semibold text-white/70" : "text-white/50"}`}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <p className="text-white/20 text-xs">Select a file to preview</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
