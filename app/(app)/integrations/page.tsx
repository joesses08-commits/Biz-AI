"use client";

import { useState } from "react";

type Integration = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  status: "coming_soon" | "connect";
};

const integrations: Integration[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Read emails, track leads, monitor client communication and flag action items.",
    category: "Communication",
    icon: "📧",
    status: "coming_soon",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Sync invoices, expenses, P&L, and cash flow directly into your AI COO.",
    category: "Accounting",
    icon: "📊",
    status: "coming_soon",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Track revenue, subscriptions, failed payments, and MRR in real time.",
    category: "Payments",
    icon: "💳",
    status: "coming_soon",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Get AI COO briefings and alerts delivered directly to your Slack channels.",
    category: "Communication",
    icon: "💬",
    status: "coming_soon",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Monitor your sales pipeline, deal stages, and CRM activity.",
    category: "CRM",
    icon: "🎯",
    status: "coming_soon",
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Track orders, inventory, product performance, and store revenue.",
    category: "E-commerce",
    icon: "🛍️",
    status: "coming_soon",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Sync your CRM data, opportunities, and customer activity.",
    category: "CRM",
    icon: "☁️",
    status: "coming_soon",
  },
  {
    id: "microsoft365",
    name: "Microsoft 365",
    description: "Connect Outlook, Teams, and calendar for full communication intelligence.",
    category: "Communication",
    icon: "🪟",
    status: "coming_soon",
  },
  {
    id: "zoom",
    name: "Zoom",
    description: "Transcribe meetings, extract action items, and track follow-ups automatically.",
    category: "Meetings",
    icon: "🎥",
    status: "coming_soon",
  },
  {
    id: "bank",
    name: "Bank Account",
    description: "Connect your business bank account to monitor cash flow and transactions.",
    category: "Banking",
    icon: "🏦",
    status: "coming_soon",
  },
];

const categories = ["All", ...Array.from(new Set(integrations.map((i) => i.category)))];

export default function IntegrationsPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [notified, setNotified] = useState<string[]>([]);

  const filtered =
    activeCategory === "All"
      ? integrations
      : integrations.filter((i) => i.category === activeCategory);

  const handleNotify = (id: string) => {
    setNotified((prev) => [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-[#080b12] text-white p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-white/40 mt-1 text-sm">
            Connect your business tools so your AI COO has full visibility across your company.
          </p>
        </div>

        {/* Coming Soon Banner */}
        <div className="bg-blue-600/10 border border-blue-500/30 rounded-2xl px-6 py-4 mb-8 flex items-center gap-4">
          <span className="text-2xl">🚀</span>
          <div>
            <p className="text-blue-400 font-semibold text-sm">Integrations are coming in Phase 1</p>
            <p className="text-white/40 text-xs mt-0.5">
              Gmail, QuickBooks, and Stripe are launching first. Click "Notify Me" to get early access.
            </p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                activeCategory === cat
                  ? "bg-blue-600 text-white"
                  : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Integration Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((integration) => (
            <div
              key={integration.id}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 hover:border-white/20 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{integration.icon}</div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{integration.name}</h3>
                    <span className="text-xs text-white/30">{integration.category}</span>
                  </div>
                </div>
                <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                  Soon
                </span>
              </div>

              <p className="text-white/40 text-xs leading-relaxed">{integration.description}</p>

              <button
                onClick={() => handleNotify(integration.id)}
                disabled={notified.includes(integration.id)}
                className={`w-full py-2 rounded-xl text-xs font-semibold transition ${
                  notified.includes(integration.id)
                    ? "bg-green-600/20 text-green-400 border border-green-500/20 cursor-default"
                    : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {notified.includes(integration.id) ? "✓ You'll be notified" : "Notify Me"}
              </button>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-white/20 text-xs mt-12">
          Don't see an integration you need?{" "}
          <span className="text-blue-400 cursor-pointer hover:underline">Let us know</span>
        </p>

      </div>
    </div>
  );
}
