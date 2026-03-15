"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function MicrosoftPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/microsoft/data")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-lg">Loading Microsoft 365...</p>
      </div>
    );
  }

  if (!data || !data.connected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-white text-3xl font-bold mb-4">Microsoft 365 Not Connected</h1>
          <p className="text-gray-400 mb-8">Connect your Microsoft account to access Outlook, Calendar, Excel, and OneDrive.</p>
          <a href="/api/microsoft/connect" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg">
            Connect Microsoft 365
          </a>
        </div>
      </div>
    );
  }

  const tools = [
    { href: "/microsoft/outlook", icon: "📧", label: "Outlook", description: "Emails, inbox, unread messages", color: "bg-blue-600" },
    { href: "/microsoft/calendar", icon: "📅", label: "Calendar", description: "Meetings, events, schedule", color: "bg-indigo-600" },
    { href: "/microsoft/excel", icon: "📊", label: "Excel", description: "Spreadsheets, financial models, live data", color: "bg-green-600" },
    { href: "/microsoft/drive", icon: "🗂️", label: "OneDrive", description: "Word docs, PowerPoints, all files", color: "bg-purple-600" },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold">Microsoft 365</h1>
            <p className="text-green-400 text-sm">● Connected — {data.email}</p>
          </div>
        </div>
        <p className="text-gray-400 mb-8 ml-13">Full access to your Microsoft workspace</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href}>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition cursor-pointer">
                <div className="flex items-center gap-4 mb-3">
                  <div className={`w-12 h-12 ${tool.color} rounded-xl flex items-center justify-center text-2xl`}>
                    {tool.icon}
                  </div>
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
