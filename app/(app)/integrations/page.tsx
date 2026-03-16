"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  connected: boolean;
  connectHref?: string;
  dashboardHref?: string;
  comingSoon?: boolean;
  logo: React.ReactNode;
}

export default function IntegrationsPage() {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [qbConnected, setQbConnected] = useState(false);
  const [msConnected, setMsConnected] = useState(false);
  const [connecting, setConnecting] = useState("");
  const [notified, setNotified] = useState<string[]>([]);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    checkConnections();
  }, []);

  const checkConnections = async () => {
    fetch("/api/gmail/status").then(r => r.json()).then(d => setGmailConnected(d.connected)).catch(() => {});
    fetch("/api/stripe/status").then(r => r.json()).then(d => setStripeConnected(d.connected)).catch(() => {});
    fetch("/api/quickbooks/data").then(r => r.json()).then(d => setQbConnected(d.connected)).catch(() => {});
    fetch("/api/microsoft/data").then(r => r.json()).then(d => setMsConnected(d.connected)).catch(() => {});
  };

  const disconnect = async (integration: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const tables: Record<string, string> = {
      gmail: "gmail_connections",
      stripe: "stripe_connections",
      quickbooks: "quickbooks_connections",
      microsoft: "microsoft_connections",
    };
    if (tables[integration]) {
      await supabase.from(tables[integration]).delete().eq("user_id", user.id);
      checkConnections();
    }
  };

  const GoogleLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );

  const MicrosoftLogo = () => (
    <svg width="24" height="24" viewBox="0 0 23 23">
      <path fill="#f35325" d="M1 1h10v10H1z"/>
      <path fill="#81bc06" d="M12 1h10v10H12z"/>
      <path fill="#05a6f0" d="M1 12h10v10H1z"/>
      <path fill="#ffba08" d="M12 12h10v10H12z"/>
    </svg>
  );

  const StripeLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path fill="#635BFF" d="M13.976 9.15c-2.172-.806-3.361-1.426-3.361-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
    </svg>
  );

  const QBLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="#2CA01C"/>
      <path fill="white" d="M12 4.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 12a4.5 4.5 0 110-9 4.5 4.5 0 010 9zm0-7.5a3 3 0 100 6 3 3 0 000-6z"/>
    </svg>
  );

  const SlackLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z"/>
      <path fill="#E01E5A" d="M6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
      <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834z"/>
      <path fill="#36C5F0" d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
      <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834z"/>
      <path fill="#2EB67D" d="M17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/>
      <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52z"/>
      <path fill="#ECB22E" d="M15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  );

  const HubSpotLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path fill="#FF7A59" d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.978V3.06A2.2 2.2 0 0 0 17.235.862h-.046a2.2 2.2 0 0 0-2.196 2.197v.046a2.198 2.198 0 0 0 1.267 1.978V7.93a6.232 6.232 0 0 0-2.962 1.301L5.57 3.842a2.45 2.45 0 1 0-1.304 1.44l7.532 5.24a6.232 6.232 0 0 0 .48 8.144 6.235 6.235 0 1 0 5.886-10.736zm-1.022 9.586a3.13 3.13 0 1 1 0-6.26 3.13 3.13 0 0 1 0 6.26z"/>
    </svg>
  );

  const ShopifyLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path fill="#96BF48" d="M15.337.524s-.27.08-.717.217c-.078-.25-.195-.554-.39-.855C13.634-.81 12.83-.984 12.4-.984c-.024 0-.047 0-.07.002-.13-.156-.284-.3-.46-.424C11.33-1.87 10.534-2 9.874-2 7.6-2 6.47-.265 6.08 1.01c-1.1.34-1.874.58-1.975.612C3.512 1.84 3.48 1.87 3.456 2.44L2.5 17.863 15.956 20.4 21 18.72 15.337.524zM12.8 1.47l-1.834.567c0-.07.002-.14.002-.212 0-.653-.09-1.185-.234-1.61.578.07.962.698 1.067 1.255h-.001zm-2.38-.9c.15.415.234.99.234 1.75v.115l-1.788.553c.346-1.33 1-1.97 1.554-2.418zm-.71-.423c.076 0 .152.004.226.012-.752.575-1.484 1.55-1.797 3.186l-1.35.417c.377-1.515 1.432-3.615 2.92-3.615z"/>
    </svg>
  );

  const ZoomLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path fill="#2D8CFF" d="M24 12c0 6.627-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0s12 5.373 12 12zM10.218 7.93H6.375C5.476 7.93 5 8.408 5 9.308v5.46l1.563-.9v-4.5h3.655c.9 0 1.376-.476 1.376-1.376v-.063zm2.718 0h-1.876v8.14h1.876V7.93zm4.688 0h-3.654c0 .9.476 1.376 1.375 1.376h1.313v4.5l1.563.9V9.308c0-.9-.476-1.378-1.375-1.378h-.001v.1-.1z"/>
    </svg>
  );

  const integrations = [
    { id: "gmail", name: "Google Workspace", description: "Gmail, Sheets, Drive, Calendar — full Google integration", category: "Productivity", connected: gmailConnected, connectHref: "/api/gmail/connect", dashboardHref: "/google", logo: <GoogleLogo /> },
    { id: "microsoft", name: "Microsoft 365", description: "Outlook, Excel, OneDrive, Teams — full Microsoft integration", category: "Productivity", connected: msConnected, connectHref: "/api/microsoft/connect", dashboardHref: "/microsoft", logo: <MicrosoftLogo /> },
    { id: "stripe", name: "Stripe", description: "Revenue, subscriptions, failed payments, and MRR in real time", category: "Payments", connected: stripeConnected, connectHref: "/api/stripe/connect", dashboardHref: "/stripe", logo: <StripeLogo /> },
    { id: "quickbooks", name: "QuickBooks", description: "P&L, invoices, expenses, cash flow, and payroll", category: "Accounting", connected: qbConnected, connectHref: "/api/quickbooks/connect", dashboardHref: "/quickbooks", logo: <QBLogo /> },
    { id: "slack", name: "Slack", description: "Team communication, project activity, and response patterns", category: "Communication", comingSoon: true, logo: <SlackLogo /> },
    { id: "hubspot", name: "HubSpot", description: "Leads, deals, pipeline, and customer lifecycle", category: "CRM", comingSoon: true, logo: <HubSpotLogo /> },
    { id: "shopify", name: "Shopify", description: "E-commerce sales, inventory, returns, and customer data", category: "E-commerce", comingSoon: true, logo: <ShopifyLogo /> },
    { id: "zoom", name: "Zoom", description: "Meeting transcripts, attendance, and meeting intelligence", category: "Communication", comingSoon: true, logo: <ZoomLogo /> },
  ];

  const connected = integrations.filter(i => i.connected);
  const available = integrations.filter(i => !i.connected && !i.comingSoon);
  const comingSoon = integrations.filter(i => i.comingSoon);

  const Card = ({ integration }: { integration: typeof integrations[0] }) => (
    <div className={`bg-bg-surface border rounded-2xl p-6 transition ${integration.connected ? "border-green-500/30" : "border-bg-border"}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-bg-border flex items-center justify-center">
          {integration.logo}
        </div>
        {integration.connected && (
          <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            Connected
          </span>
        )}
        {integration.comingSoon && (
          <span className="text-xs text-text-muted font-medium bg-white/5 border border-bg-border px-2.5 py-1 rounded-full">
            Coming Soon
          </span>
        )}
      </div>

      <h3 className="font-semibold text-text-primary mb-1">{integration.name}</h3>
      <p className="text-text-muted text-sm leading-relaxed mb-4">{integration.description}</p>

      {integration.connected ? (
        <div className="flex gap-2">
          <button
            onClick={() => router.push(integration.dashboardHref!)}
            className="flex-1 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-gray-100 transition"
          >
            View Dashboard
          </button>
          <button
            onClick={() => router.push(integration.connectHref!)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-bg-border text-text-muted text-xs font-medium hover:bg-white/10 transition"
          >
            Reconnect
          </button>
          <button
            onClick={() => disconnect(integration.id)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-bg-border text-red-400 text-xs font-medium hover:bg-red-500/10 transition"
          >
            Disconnect
          </button>
        </div>
      ) : integration.comingSoon ? (
        <button
          onClick={() => setNotified(prev => [...prev, integration.id])}
          disabled={notified.includes(integration.id)}
          className="w-full py-2 rounded-lg bg-white/5 border border-bg-border text-text-muted text-xs font-medium hover:bg-white/10 transition disabled:opacity-50"
        >
          {notified.includes(integration.id) ? "Notified" : "Notify Me"}
        </button>
      ) : (
        <button
          onClick={() => { setConnecting(integration.id); window.location.href = integration.connectHref!; }}
          disabled={connecting === integration.id}
          className="w-full py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-gray-100 transition disabled:opacity-50"
        >
          {connecting === integration.id ? "Connecting..." : "Connect"}
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-base text-text-primary p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Integrations</h1>
          <p className="text-text-muted">Connect your business tools so BizAI has full visibility across your company.</p>
        </div>

        {connected.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Connected · {connected.length}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connected.map(i => <Card key={i.id} integration={i} />)}
            </div>
          </div>
        )}

        {available.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Available</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {available.map(i => <Card key={i.id} integration={i} />)}
            </div>
          </div>
        )}

        {comingSoon.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Coming Soon</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comingSoon.map(i => <Card key={i.id} integration={i} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
