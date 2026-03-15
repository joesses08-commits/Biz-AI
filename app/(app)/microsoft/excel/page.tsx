"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ExcelPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/microsoft/excel")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-lg">Loading Excel files...</p>
      </div>
    );
  }

  const files = data?.files || [];

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/microsoft" className="text-gray-400 hover:text-white text-sm">Microsoft 365</Link>
          <span className="text-gray-600">→</span>
          <span className="text-white text-sm">Excel</span>
        </div>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-xl">📊</div>
          <div>
            <h1 className="text-3xl font-bold">Excel</h1>
            <p className="text-green-400 text-sm">● Connected — {files.length} files found</p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Your Excel Files</h2>
          {files.length === 0 ? (
            <p className="text-gray-400">No Excel files found in your OneDrive.</p>
          ) : (
            <div className="space-y-3">
              {files.map((file: any) => (
                <div key={file.id} className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <div>
                    <p className="font-medium text-green-400">{file.name}</p>
                    <p className="text-gray-400 text-sm">{file.parentReference?.path?.replace("/drive/root:", "") || "OneDrive"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-sm">{file.lastModifiedDateTime ? new Date(file.lastModifiedDateTime).toLocaleDateString() : ""}</p>
                    <p className="text-gray-500 text-xs">{file.size ? `${Math.round(file.size / 1024)} KB` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
