"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function GooglePage() {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gmail/status")
      .then((r) => r.json())
      .then((d) => {
        setConnected(d.connected);
        setEmail(d.email || "");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-lg">Loading Google...</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-white text-3xl font-bold mb-4">Google Not Connected</h1>
          <p className="text-gray-400 mb-8">Connect your Google account to access Gmail, Sheets, Drive, and Calendar.</p>
          <a href="/api/gmail/connect" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg">Connect Google</a>
        </div>
      </div>
    );
  }

  const tools = [
    { href: "/gmail", icon: "📧", label: "Gmail", description: "Emails, inbox, unread messages", color: "bg-red-600" },
    { href: "/google/sheets", icon: "📊", label: "Google Sheets", description: "Spreadsheets, live data, financial models", color: "bg-green-600" },
    { href: "/google/drive", icon: "🗂️", label: "Google Drive", description: "Docs, Slides, all files", color: "bg-yellow-600" },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-xl">G</div>
          <div>
            <h1 className="text-3xl font-bold">Google</h1>
            <p className="text-green-400 text-sm">● Connected — {email}</p>
          </div>
        </div>
        <p className="text-gray-400 mb-8 ml-13">Full access to your Google workspace</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href}>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition cursor-pointer">
                <div className="flex items-center gap-4 mb-3">
                  <div className={`w-12 h-12 ${tool.color} rounded-xl flex items-center justify-center text-2xl`}>{tool.icon}</div>
                  <div>
                    <h3 className="text-xl font-bold">{tool.label}</h3>
                    <p className="text-gray-400 text-sm">{tool.description}</p>
                  </div>
                </div>
                <p className="text-blue-400 text-sm">Open {tool.label} →</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
