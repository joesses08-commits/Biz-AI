"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function IntegrationsPage() {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [qbConnected, setQbConnected] = useState(false);

  useEffect(() => {
    fetch("/api/gmail/status").then(r => r.json()).then(d => setGmailConnected(d.connected)).catch(() => {});
    fetch("/api/stripe/status").then(r => r.json()).then(d => setStripeConnected(d.connected)).catch(() => {});
    fetch("/api/quickbooks/data").then(r => r.json()).then(d => setQbConnected(d.connected)).catch(() => {});
  }, []);

  const integrations = [
    {
      name: "Gmail",
      description: "Read emails, extract action items, monitor client communication",
      icon: "G",
      color: "bg-red-600",
      connected: gmailConnected,
      connectHref: "/api/gmail/connect",
      dashboardHref: "/gmail",
    },
    {
      name: "Stripe",
      description: "Track payments, revenue, subscriptions, and failed charges",
      icon: "S",
      color: "bg-purple-600",
      connected: stripeConnected,
      connectHref: "/api/stripe/connect",
      dashboardHref: "/stripe",
    },
    {
      name: "QuickBooks",
      description: "Monitor invoices, expenses, profit & loss, and cash flow",
      icon: "Q",
      color: "bg-green-600",
      connected: qbConnected,
      connectHref: "/api/quickbooks/connect",
      dashboardHref: "/quickbooks",
    },
    {
      name: "Microsoft 365",
      description: "Connect Outlook, Excel, and Teams for full business intelligence",
      icon: "M",
      color: "bg-blue-600",
      connected: false,
      connectHref: "#",
      dashboardHref: "#",
      comingSoon: true,
    },
    {
      name: "Slack",
      description: "Monitor team conversations and extract key decisions",
      icon: "Sl",
      color: "bg-yellow-600",
      connected: false,
      connectHref: "#",
      dashboardHref: "#",
      comingSoon: true,
    },
    {
      name: "HubSpot",
      description: "Track deals, contacts, and sales pipeline",
      icon: "H",
      color: "bg-orange-600",
      connected: false,
      connectHref: "#",
      dashboardHref: "#",
      comingSoon: true,
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Integrations</h1>
        <p className="text-gray-400 mb-8">Connect your business tools to give BizAI full visibility.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration) => (
            <div key={integration.name} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 ${integration.color} rounded-lg flex items-center justify-center`}>
                  <span className="text-white font-bold">{integration.icon}</span>
                </div>
                <div>
                  <h3 className="font-bold">{integration.name}</h3>
                  {integration.comingSoon ? (
                    <span className="text-xs text-gray-500">Coming soon</span>
                  ) : integration.connected ? (
                    <span className="text-xs text-green-400">● Connected</span>
                  ) : (
                    <span className="text-xs text-gray-500">● Not connected</span>
                  )}
                </div>
              </div>
              <p className="text-gray-400 text-sm mb-4">{integration.description}</p>
              {integration.comingSoon ? (
                <button disabled className="w-full py-2 rounded-lg bg-gray-800 text-gray-600 text-sm cursor-not-allowed">
                  Coming Soon
                </button>
              ) : integration.connected ? (
                <Link href={integration.dashboardHref} className="block w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-center text-sm text-white">
                  View Dashboard →
                </Link>
              ) : (
                <a href={integration.connectHref} className="block w-full py-2 rounded-lg bg-white hover:bg-gray-200 text-center text-sm text-black font-bold">
                  Connect
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
