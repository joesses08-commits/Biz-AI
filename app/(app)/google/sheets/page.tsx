"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function GoogleSheetsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileData, setFileData] = useState<any>(null);
  const [fileLoading, setFileLoading] = useState(false);

  useEffect(() => {
    fetch("/api/google/sheets")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  const openSheet = async (file: any) => {
    setSelectedFile(file);
    setFileLoading(true);
    const res = await fetch(`/api/google/sheets-data?fileId=${file.id}`);
    const d = await res.json();
    setFileData(d);
    setFileLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-lg">Loading Google Sheets...</p>
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-white text-3xl font-bold mb-4">Google Not Connected</h1>
          <a href="/api/gmail/connect" className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg">Connect Google</a>
        </div>
      </div>
    );
  }

  const files = data?.files || [];

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/google" className="text-gray-400 hover:text-white text-sm">Google</Link>
          <span className="text-gray-600">→</span>
          <span className="text-white text-sm">Sheets</span>
        </div>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-xl">📊</div>
          <div>
            <h1 className="text-3xl font-bold">Google Sheets</h1>
            <p className="text-green-400 text-sm">● Connected — {files.length} spreadsheets found</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">Your Spreadsheets</h2>
            {files.length === 0 ? (
              <p className="text-gray-400">No Google Sheets found. You may need to reconnect Google to grant Sheets access.</p>
            ) : (
              <div className="space-y-2">
                {files.map((file: any) => (
                  <button key={file.id} onClick={() => openSheet(file)}
                    className={`w-full text-left p-3 rounded-lg border transition ${selectedFile?.id === file.id ? "border-green-500 bg-green-500/10" : "border-gray-700 hover:border-gray-500"}`}>
                    <p className="font-medium text-green-400">{file.name}</p>
                    <p className="text-gray-500 text-xs">{file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ""}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">{selectedFile ? selectedFile.name : "Select a sheet to preview"}</h2>
            {!selectedFile && <p className="text-gray-400">Click any spreadsheet on the left to preview its data.</p>}
            {fileLoading && <p className="text-gray-400">Loading sheet data...</p>}
            {fileData && !fileLoading && (
              fileData.error ? (
                <p className="text-red-400">{fileData.error}</p>
              ) : (
                <div className="overflow-auto max-h-96">
                  <table className="w-full text-xs">
                    <tbody>
                      {fileData.data?.slice(0, 20).map((row: any[], rowIndex: number) => (
                        <tr key={rowIndex} className={rowIndex === 0 ? "bg-gray-800" : "border-b border-gray-800"}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className={`px-2 py-1 ${rowIndex === 0 ? "font-bold text-white" : "text-gray-300"}`}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-gray-500 text-xs mt-2">{fileData.rowCount} rows total</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
