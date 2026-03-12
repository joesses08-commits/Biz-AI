"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Integration = {
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  live?: boolean;
};

const integrations: Integration[] = [
  { id: "gmail", name: "Gmail", description: "Read emails, track leads, monitor client communication and flag action items.", category: "Communication", logo: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg", live: true },
  { id: "microsoft365", name: "Microsoft 365", description: "Connect Outlook, Teams, and calendar for full communication intelligence.", category: "Communication", logo: "https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" },
  { id: "slack", name: "Slack", description: "Get AI COO briefings and alerts delivered directly to your Slack channels.", category: "Communication", logo: "https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg" },
  { id: "zoom", name: "Zoom", description: "Transcribe meetings, extract action items, and track follow-ups automatically.", category: "Meetings", logo: "https://upload.wikimedia.org/wikipedia/commons/1/11/Zoom_Logo_2022.svg" },
  { id: "quickbooks", name: "QuickBooks", description: "Sync invoices, expenses, P&L, and cash flow directly into your AI COO.", category: "Accounting", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Intuit_QuickBooks_logo.svg/320px-Intuit_QuickBooks_logo.svg.png" },
  { id: "xero", name: "Xero", description: "Connect your Xero accounting data for real-time financial insights.", category: "Accounting", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/8/84/Xero_software_logo.svg/320px-Xero_software_logo.svg.png" },
  { id: "stripe", name: "Stripe", description: "Track revenue, subscriptions, failed payments, and MRR in real time.", category: "Payments", logo: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" },
  { id: "square", name: "Square", description: "Monitor point-of-sale transactions, refunds, and daily sales summaries.", category: "Payments", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Square%2C_Inc._logo.svg/320px-Square%2C_Inc._logo.svg.png" },
  { id: "hubspot", name: "HubSpot", description: "Monitor your sales pipeline, deal stages, and CRM activity.", category: "CRM", logo: "https://upload.wikimedia.org/wikipedia/commons/3/3f/HubSpot_Logo.svg" },
  { id: "salesforce", name: "Salesforce", description: "Sync your CRM data, opportunities, and customer activity.", category: "CRM", logo: "https://upload.wikimedia.org/wikipedia/commons/f/f9/Salesforce.com_logo.svg" },
  { id: "shopify", name: "Shopify", description: "Track orders, inventory, product performance, and store revenue.", category: "E-commerce", logo: "https://upload.wikimedia.org/wikipedia/commons/0/0e/Shopify_logo_2018.svg" },
  { id: "woocommerce", name: "WooCommerce", description: "Connect your WordPress store to track sales and inventory.", category: "E-commerce", logo: "https://upload.wikimedia.org/wikipedia/commons/2/2a/WooCommerce_logo.svg" },
  { id: "chase", name: "Chase Business", description: "Monitor your Chase business bank account, transactions, and cash flow.", category: "Banking", logo: "https://upload.wikimedia.org/wikipedia/commons/a/af/J_P_Morgan_Logo_2008_1.svg" },
  { id: "bankofamerica", name: "Bank of America", description: "Connect your BofA business account for real-time balance and transaction tracking.", category: "Banking", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Bank_of_America_logo.svg/320px-Bank_of_America_logo.svg.png" },
  { id: "wellsfargo", name: "Wells Fargo", description: "Sync Wells Fargo business accounts for cash flow monitoring.", category: "Banking", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Wells_Fargo_Bank.svg/320px-Wells_Fargo_Bank.svg.png" },
  { id: "appfolio", name: "AppFolio", description: "Sync property management data, rent rolls, maintenance, and financials.", category: "Property Management", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/AppFolio_logo.svg/320px-AppFolio_logo.svg.png" },
  { id: "buildium", name: "Buildium", description: "Track rental income, expenses, vacancies, and tenant communications.", category: "Property Management", logo: "https://www.buildium.com/wp-content/uploads/2021/10/buildium-logo.svg" },
  { id: "asana", name: "Asana", description: "Monitor team projects, task completion rates, and deadlines.", category: "Project Management", logo: "https://upload.wikimedia.org/wikipedia/commons/3/3b/Asana_logo.svg" },
  { id: "monday", name: "Monday.com", description: "Sync project boards, team workload, and milestone tracking.", category: "Project Management", logo: "https://upload.wikimedia.org/wikipedia/commons/c/c9/Monday.com_logo_%282019%29.svg" },
  { id: "gusto", name: "Gusto", description: "Track payroll, headcount, benefits costs, and compensation trends.", category: "HR & Payroll", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Gusto_logo_2017.svg/320px-Gusto_logo_2017.svg.png" },
  { id: "adp", name: "ADP", description: "Sync payroll runs, employee data, and labor cost reporting.", category: "HR & Payroll", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/ADP_Logo.svg/320px-ADP_Logo.svg.png" },
  { id: "googleanalytics", name: "Google Analytics", description: "Track website traffic, conversions, and marketing performance.", category: "Marketing", logo: "https://upload.wikimedia.org/wikipedia/commons/8/89/Logo_Google_Analytics.svg" },
  { id: "mailchimp", name: "Mailchimp", description: "Monitor email campaign performance, open rates, and subscriber growth.", category: "Marketing", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Freddie_and_Co_2018_icon.svg/240px-Freddie_and_Co_2018_icon.svg.png" },
  { id: "servicetitan", name: "ServiceTitan", description: "Track jobs, technician performance, revenue, and service agreements.", category: "Field Service", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/ServiceTitan_Logo.svg/320px-ServiceTitan_Logo.svg.png" },
  { id: "zendesk", name: "Zendesk", description: "Monitor support ticket volume, resolution times, and customer satisfaction.", category: "Customer Support", logo: "https://upload.wikimedia.org/wikipedia/commons/c/c8/Zendesk_logo.svg" },
];

const categories = ["All", ...Array.from(new Set(integrations.map((i) => i.category)))];

function LogoImage({ src, name }: { src: string; name: string }) {
  return (
    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden p-1.5">
      <img src={src} alt={name} className="w-full h-full object-contain"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          const parent = target.parentElement;
          if (parent) parent.innerHTML = `<span style="font-size:18px;font-weight:700;color:#333">${name[0]}</span>`;
        }}
      />
    </div>
  );
}

export default function IntegrationsPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [notified, setNotified] = useState<string[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState("");
  const [connecting, setConnecting] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "gmail") {
      checkGmailConnection();
      window.history.replaceState({}, "", "/integrations");
    } else {
      checkGmailConnection();
    }
  }, []);

  const checkGmailConnection = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("gmail_connections")
      .select("email")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setGmailConnected(true);
      setGmailEmail(data.email);
    }
  };

  const handleConnectGmail = () => {
    setConnecting(true);
    window.location.href = "/api/gmail/connect";
  };

  const handleDisconnectGmail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("gmail_connections").delete().eq("user_id", user.id);
    setGmailConnected(false);
    setGmailEmail("");
  };

  const filtered = activeCategory === "All" ? integrations : integrations.filter((i) => i.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#080b12] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-white/40 mt-1 text-sm">Connect your business tools so your AI COO has full visibility across your company.</p>
        </div>

        {gmailConnected && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-6 py-4 mb-6 flex items-center gap-4">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-green-400 font-semibold text-sm">Gmail Connected</p>
              <p className="text-white/40 text-xs mt-0.5">{gmailEmail} — your AI COO can now read and analyze your emails</p>
            </div>
            <button onClick={handleDisconnectGmail} className="ml-auto text-xs text-white/30 hover:text-red-400 transition">Disconnect</button>
          </div>
        )}

        <div className="bg-blue-600/10 border border-blue-500/30 rounded-2xl px-6 py-4 mb-8 flex items-center gap-4">
          <span className="text-2xl">🚀</span>
          <div>
            <p className="text-blue-400 font-semibold text-sm">More integrations coming in Phase 1</p>
            <p className="text-white/40 text-xs mt-0.5">QuickBooks and Stripe are launching next. Click "Notify Me" to get early access.</p>
          </div>
          <div className="ml-auto text-white/30 text-xs font-medium">{integrations.length} integrations</div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${activeCategory === cat ? "bg-blue-600 text-white" : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"}`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((integration) => (
            <div key={integration.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3 hover:border-white/20 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <LogoImage src={integration.logo} name={integration.name} />
                  <div>
                    <h3 className="font-semibold text-white text-sm leading-tight">{integration.name}</h3>
                    <span className="text-[10px] text-white/30">{integration.category}</span>
                  </div>
                </div>
                {integration.id === "gmail" && gmailConnected ? (
                  <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">Connected</span>
                ) : integration.live ? (
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">Live</span>
                ) : (
                  <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full">Coming Soon</span>
                )}
              </div>

              <p className="text-white/40 text-xs leading-relaxed flex-1">{integration.description}</p>

              {integration.id === "gmail" ? (
                gmailConnected ? (
                  <button onClick={handleDisconnectGmail}
                    className="w-full py-2 rounded-xl text-xs font-semibold bg-green-600/20 text-green-400 border border-green-500/20 hover:bg-red-600/20 hover:text-red-400 hover:border-red-500/20 transition">
                    ✓ Connected — Click to disconnect
                  </button>
                ) : (
                  <button onClick={handleConnectGmail} disabled={connecting}
                    className="w-full py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50">
                    {connecting ? "Connecting..." : "Connect Gmail"}
                  </button>
                )
              ) : (
                <button onClick={() => setNotified((prev) => [...prev, integration.id])}
                  disabled={notified.includes(integration.id)}
                  className={`w-full py-2 rounded-xl text-xs font-semibold transition ${notified.includes(integration.id) ? "bg-green-600/20 text-green-400 border border-green-500/20 cursor-default" : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"}`}>
                  {notified.includes(integration.id) ? "✓ You'll be notified" : "Notify Me"}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-white/20 text-xs mt-12">
          Don't see an integration you need?{" "}
          <span className="text-blue-400 cursor-pointer hover:underline">Let us know</span>
        </p>
      </div>
    </div>
  );
}
