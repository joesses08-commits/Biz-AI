"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ExcelPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileData, setFileData] = useState<any>(null);
  const [fileLoading, setFileLoading] = useState(false);

  useEffect(() => {
    fetch("/api/microsoft/excel")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  const openFile = async (file: any) => {
    setSelectedFile(file);
    setFileLoading(true);
    const res = await fetch(`/api/microsoft/excel-data?fileId=${file.id}`);
    const d = await res.json();
    setFileData(d);
    setFileLoading(false);
  };

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">Your Excel Files</h2>
            {files.length === 0 ? (
              <p className="text-gray-400">No Excel files found in your OneDrive.</p>
            ) : (
              <div className="space-y-2">
                {files.map((file: any) => (
                  <button
                    key={file.id}
                    onClick={() => openFile(file)}
                    className={`w-full text-left p-3 rounded-lg border transition ${selectedFile?.id === file.id ? "border-green-500 bg-green-500/10" : "border-gray-700 hover:border-gray-500"}`}
                  >
                    <p className="font-medium text-green-400">{file.name}</p>
                    <p className="text-gray-500 text-xs">{file.lastModifiedDateTime ? new Date(file.lastModifiedDateTime).toLocaleDateString() : ""} · {file.size ? `${Math.round(file.size / 1024)} KB` : ""}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">
              {selectedFile ? selectedFile.name : "Select a file to preview"}
            </h2>
            {!selectedFile && <p className="text-gray-400">Click any Excel file on the left to preview its data.</p>}
            {fileLoading && <p className="text-gray-400">Loading file data...</p>}
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
                            <td key={cellIndex} className={`px-2 py-1 ${rowIndex === 0 ? "font-bold text-white" : "text-gray-300"}`}>
                              {cell}
                            </td>
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
