"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function OutlookPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/microsoft/outlook")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-lg">Loading Outlook...</p>
      </div>
    );
  }

  if (!data || !data.connected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-white text-3xl font-bold mb-4">Outlook Not Connected</h1>
          <a href="/api/microsoft/connect" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg">Connect Microsoft</a>
        </div>
      </div>
    );
  }

  const emails = data.emails || [];
  const unread = emails.filter((e: any) => !e.isRead).length;

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/microsoft" className="text-gray-400 hover:text-white text-sm">Microsoft 365</Link>
          <span className="text-gray-600">→</span>
          <span className="text-white text-sm">Outlook</span>
        </div>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-xl">📧</div>
          <div>
            <h1 className="text-3xl font-bold">Outlook</h1>
            <p className="text-green-400 text-sm">● Connected — {data.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm mb-1">Total Emails</p>
            <p className="text-3xl font-bold">{emails.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm mb-1">Unread</p>
            <p className="text-3xl font-bold text-yellow-400">{unread}</p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Recent Emails</h2>
          {emails.length === 0 ? (
            <p className="text-gray-400">No emails found. This account may not have Outlook emails.</p>
          ) : (
            <div className="space-y-3">
              {emails.map((email: any) => (
                <div key={email.id} className="border-b border-gray-800 pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className={`font-medium ${!email.isRead ? "text-white" : "text-gray-400"}`}>{email.subject || "(No subject)"}</p>
                      <p className="text-gray-500 text-sm">{email.from?.emailAddress?.name} · {new Date(email.receivedDateTime).toLocaleDateString()}</p>
                      <p className="text-gray-600 text-xs mt-1 truncate">{email.bodyPreview}</p>
                    </div>
                    {!email.isRead && <span className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0 mt-2 ml-2" />}
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
