"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function GoogleDrivePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/google/drive")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-lg">Loading Google Drive...</p>
      </div>
    );
  }

  const files = data?.files || [];
  const docs = files.filter((f: any) => f.mimeType === "application/vnd.google-apps.document");
  const sheets = files.filter((f: any) => f.mimeType === "application/vnd.google-apps.spreadsheet");
  const slides = files.filter((f: any) => f.mimeType === "application/vnd.google-apps.presentation");
  const others = files.filter((f: any) => !["application/vnd.google-apps.document", "application/vnd.google-apps.spreadsheet", "application/vnd.google-apps.presentation"].includes(f.mimeType));

  const FileRow = ({ file }: { file: any }) => (
    <div className="flex justify-between items-center border-b border-gray-800 pb-3">
      <div className="flex-1">
        <a href={file.webViewLink} target="_blank" rel="noreferrer" className="font-medium hover:text-blue-400 transition">
          {file.name}
        </a>
        <p className="text-gray-400 text-xs">{file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ""}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/google" className="text-gray-400 hover:text-white text-sm">Google</Link>
          <span className="text-gray-600">→</span>
          <span className="text-white text-sm">Drive</span>
        </div>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-yellow-600 rounded-lg flex items-center justify-center text-xl">🗂️</div>
          <div>
            <h1 className="text-3xl font-bold">Google Drive</h1>
            <p className="text-green-400 text-sm">● Connected — {files.length} files</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{docs.length}</p>
            <p className="text-gray-400 text-sm">Google Docs</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{sheets.length}</p>
            <p className="text-gray-400 text-sm">Sheets</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{slides.length}</p>
            <p className="text-gray-400 text-sm">Slides</p>
          </div>
        </div>

        {docs.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-blue-400">📝 Google Docs</h2>
            <div className="space-y-3">{docs.map((f: any) => <FileRow key={f.id} file={f} />)}</div>
          </div>
        )}
        {sheets.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-green-400">📊 Google Sheets</h2>
            <div className="space-y-3">{sheets.map((f: any) => <FileRow key={f.id} file={f} />)}</div>
          </div>
        )}
        {slides.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-yellow-400">📊 Google Slides</h2>
            <div className="space-y-3">{slides.map((f: any) => <FileRow key={f.id} file={f} />)}</div>
          </div>
        )}
        {files.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400">No files found. You may need to reconnect Google to grant Drive access.</p>
          </div>
        )}
      </div>
    </div>
  );
}
