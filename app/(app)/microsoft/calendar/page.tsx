"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CalendarPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/microsoft/calendar")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-lg">Loading Calendar...</p>
      </div>
    );
  }

  const events = data?.events || [];

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/microsoft" className="text-gray-400 hover:text-white text-sm">Microsoft 365</Link>
          <span className="text-gray-600">→</span>
          <span className="text-white text-sm">Calendar</span>
        </div>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-xl">📅</div>
          <div>
            <h1 className="text-3xl font-bold">Calendar</h1>
            <p className="text-green-400 text-sm">● Connected</p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Upcoming Events</h2>
          {events.length === 0 ? (
            <p className="text-gray-400">No upcoming events found.</p>
          ) : (
            <div className="space-y-3">
              {events.map((event: any) => (
                <div key={event.id} className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <div>
                    <p className="font-medium">{event.subject}</p>
                    <p className="text-gray-400 text-sm">{event.organizer?.emailAddress?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-indigo-400 text-sm">{new Date(event.start.dateTime).toLocaleDateString()}</p>
                    <p className="text-gray-500 text-xs">{new Date(event.start.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
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
