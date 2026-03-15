"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DrivePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/microsoft/drive")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-lg">Loading OneDrive...</p>
      </div>
    );
  }

  const files = data?.files || [];
  const wordFiles = files.filter((f: any) => f.name?.endsWith(".docx") || f.name?.endsWith(".doc"));
  const pptFiles = files.filter((f: any) => f.name?.endsWith(".pptx") || f.name?.endsWith(".ppt"));
  const excelFiles = files.filter((f: any) => f.name?.endsWith(".xlsx") || f.name?.endsWith(".xls"));
  const otherFiles = files.filter((f: any) => !f.name?.match(/\.(docx|doc|pptx|ppt|xlsx|xls)$/));

  const FileRow = ({ file }: { file: any }) => (
    <div className="flex justify-between items-center border-b border-gray-800 pb-3">
      <div>
        <p className="font-medium">{file.name}</p>
        <p className="text-gray-400 text-sm">{file.parentReference?.path?.replace("/drive/root:", "") || "OneDrive"}</p>
      </div>
      <div className="text-right">
        <p className="text-gray-400 text-sm">{file.lastModifiedDateTime ? new Date(file.lastModifiedDateTime).toLocaleDateString() : ""}</p>
        <p className="text-gray-500 text-xs">{file.size ? `${Math.round(file.size / 1024)} KB` : ""}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/microsoft" className="text-gray-400 hover:text-white text-sm">Microsoft 365</Link>
          <span className="text-gray-600">→</span>
          <span className="text-white text-sm">OneDrive</span>
        </div>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-xl">🗂️</div>
          <div>
            <h1 className="text-3xl font-bold">OneDrive</h1>
            <p className="text-green-400 text-sm">● Connected — {files.length} files</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{wordFiles.length}</p>
            <p className="text-gray-400 text-sm">Word Docs</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{excelFiles.length}</p>
            <p className="text-gray-400 text-sm">Excel Files</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-orange-400">{pptFiles.length}</p>
            <p className="text-gray-400 text-sm">PowerPoints</p>
          </div>
        </div>

        {wordFiles.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-blue-400">📝 Word Documents</h2>
            <div className="space-y-3">{wordFiles.map((f: any) => <FileRow key={f.id} file={f} />)}</div>
          </div>
        )}

        {excelFiles.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-green-400">📊 Excel Files</h2>
            <div className="space-y-3">{excelFiles.map((f: any) => <FileRow key={f.id} file={f} />)}</div>
          </div>
        )}

        {pptFiles.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-orange-400">📊 PowerPoint Files</h2>
            <div className="space-y-3">{pptFiles.map((f: any) => <FileRow key={f.id} file={f} />)}</div>
          </div>
        )}

        {files.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400">No files found in OneDrive.</p>
          </div>
        )}
      </div>
    </div>
  );
}
