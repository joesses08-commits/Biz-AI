"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function IntegrationsPage() {
  const [stripeConnected, setStripeConnected] = useState(false);
  const [qbConnected, setQbConnected] = useState(false);
  const [msConnected, setMsConnected] = useState(false);
  const [connecting, setConnecting] = useState("");
  const [notified, setNotified] = useState<string[]>([]);
  const [disconnecting, setDisconnecting] = useState("");
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    checkConnections();
  }, []);

  const checkConnections = async () => {
    fetch("/api/stripe/status").then(r => r.json()).then(d => setStripeConnected(d.connected)).catch(() => {});
    fetch("/api/quickbooks/data").then(r => r.json()).then(d => setQbConnected(d.connected)).catch(() => {});
    fetch("/api/microsoft/data").then(r => r.json()).then(d => setMsConnected(d.connected)).catch(() => {});
  };

  const disconnect = async (integration: string) => {
    setDisconnecting(integration);
    const res = await fetch("/api/integrations/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integration }),
    });
    await res.json();
    await checkConnections();
    setDisconnecting("");
  };

  const MicrosoftLogo = () => (
    <svg width="22" height="22" viewBox="0 0 23 23">
      <path fill="#f35325" d="M1 1h10v10H1z"/>
      <path fill="#81bc06" d="M12 1h10v10H12z"/>
      <path fill="#05a6f0" d="M1 12h10v10H1z"/>
      <path fill="#ffba08" d="M12 12h10v10H12z"/>
    </svg>
  );

  const QBLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="#2CA01C"/>
      <path fill="white" d="M12 4.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 12a4.5 4.5 0 110-9 4.5 4.5 0 010 9zm0-7.5a3 3 0 100 6 3 3 0 000-6z"/>
    </svg>
  );

  const GoogleLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );

  const WhatsAppLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );

  const ShipStationLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="#84C341"/>
      <path fill="white" d="M7 8h10v2H7zm0 3h10v2H7zm0 3h7v2H7z"/>
    </svg>
  );

  const ShopifyLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <path fill="#96BF48" d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-.769-.773-.943-.947c-.03-.03-.058-.048-.087-.066l-1.421 22.632zm-1.278-13.604c0-.378-.405-.705-1.01-.705-.604 0-1.23.327-1.23.705 0 .436.684.59 1.23.59.545 0 1.01-.154 1.01-.59zm-3.69-2.03c.09-.034.18-.067.274-.098l-.165-.507c-.552.134-1.105.3-1.634.515.394-.684.96-1.243 1.733-1.49-.017-.068-.034-.135-.054-.199-.67.192-1.303.618-1.785 1.32-.48.701-.733 1.568-.733 2.485 0 .285.025.562.074.828l.506-.117c-.037-.227-.056-.463-.056-.71 0-.778.213-1.51.587-2.124.093.13.246.21.418.21.248 0 .454-.166.52-.393z"/>
      <path fill="#5E8E3E" d="M14.059 10.375c-.604 0-1.23.327-1.23.705 0 .436.684.59 1.23.59.545 0 1.01-.154 1.01-.59 0-.378-.405-.705-1.01-.705z"/>
    </svg>
  );

  const AmazonLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <path fill="#FF9900" d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.7-3.182v.686zm3.186 7.705a.66.66 0 0 1-.748.075c-1.051-.875-1.238-1.279-1.814-2.113-1.732 1.768-2.958 2.296-5.207 2.296-2.658 0-4.728-1.642-4.728-4.924 0-2.566 1.391-4.309 3.37-5.164 1.715-.756 4.111-.891 5.943-1.099v-.41c0-.753.059-1.642-.384-2.294-.384-.582-1.124-.823-1.774-.823-1.206 0-2.278.618-2.54 1.897-.054.285-.265.567-.56.582l-3.127-.337c-.264-.06-.557-.272-.48-.678C5.932 2.916 9.119 2 11.979 2c1.463 0 3.376.389 4.532 1.497C17.868 4.695 17.799 6.3 17.799 8.048v5.301c0 1.594.662 2.296 1.285 3.159.22.308.268.677-.014.904l-1.926 1.383z"/>
      <path fill="#FF9900" d="M20.801 18.909c-3.056 2.289-7.491 3.507-11.307 3.507-5.348 0-10.16-1.976-13.8-5.261-.286-.258-.03-.61.314-.41 3.929 2.285 8.787 3.661 13.802 3.661 3.384 0 7.104-.702 10.527-2.154.516-.219.949.339.464.657z"/>
    </svg>
  );

  const XeroLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <path fill="#13B5EA" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.41 16.847l-3.701-3.695 3.703-3.703.705.705-2.998 2.998 2.996 2.99-.705.705zm2.82 0l-.705-.705 2.996-2.99-2.997-2.998.705-.705 3.702 3.703-3.701 3.695z"/>
    </svg>
  );

  const FlexportLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <rect width="24" height="24" rx="4" fill="#0033A0"/>
      <path fill="white" d="M6 7h12v2H6zm0 4h8v2H6zm0 4h10v2H6z"/>
    </svg>
  );

  const AlibabaLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="#FF6A00"/>
      <path fill="white" d="M8 8h8v2H8zm0 3h8v2H8zm0 3h8v2H8z"/>
    </svg>
  );

  const NetSuiteLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <rect width="24" height="24" rx="4" fill="#1A1A1A"/>
      <path fill="#00AAE7" d="M6 6h5v5H6zm7 0h5v5h-5zm-7 7h5v5H6zm7 0h5v5h-5z"/>
    </svg>
  );

  const StripeLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <path fill="#635BFF" d="M13.976 9.15c-2.172-.806-3.361-1.426-3.361-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
    </svg>
  );

  const integrations = [
    // Available now
    { id: "microsoft", name: "Microsoft 365", description: "Send RFQs, POs, and sample requests via Outlook. Read factory quotes from OneDrive.", category: "Email & Files", connected: msConnected, connectHref: "/api/microsoft/connect", dashboardHref: "/microsoft", logo: <MicrosoftLogo /> },
    { id: "quickbooks", name: "QuickBooks", description: "Sync invoices and track payments to factories", category: "Accounting", connected: qbConnected, connectHref: "/api/quickbooks/connect", dashboardHref: "/quickbooks", logo: <QBLogo /> },
    
    // Coming soon - wholesale/PLM relevant
    { id: "google", name: "Google Workspace", description: "Gmail, Sheets, and Drive for factory communication", category: "Email & Files", comingSoon: true, logo: <GoogleLogo /> },
    { id: "whatsapp", name: "WhatsApp Business", description: "Message factories directly, track conversations", category: "Communication", comingSoon: true, logo: <WhatsAppLogo /> },
    { id: "alibaba", name: "Alibaba / 1688", description: "Search suppliers, import product catalogs", category: "Sourcing", comingSoon: true, logo: <AlibabaLogo /> },
    { id: "shipstation", name: "ShipStation", description: "Track shipments, auto-update delivery status", category: "Logistics", comingSoon: true, logo: <ShipStationLogo /> },
    { id: "flexport", name: "Flexport", description: "Freight quotes, customs, logistics tracking", category: "Logistics", comingSoon: true, logo: <FlexportLogo /> },
    { id: "shopify", name: "Shopify", description: "Sync inventory and sales for demand planning", category: "E-commerce", comingSoon: true, logo: <ShopifyLogo /> },
    { id: "amazon", name: "Amazon Seller", description: "Marketplace sales and inventory sync", category: "E-commerce", comingSoon: true, logo: <AmazonLogo /> },
    { id: "xero", name: "Xero", description: "Accounting, invoices, and bank reconciliation", category: "Accounting", comingSoon: true, logo: <XeroLogo /> },
    { id: "stripe", name: "Stripe", description: "Payment processing and revenue tracking", category: "Payments", connected: stripeConnected, connectHref: "/api/stripe/connect", dashboardHref: "/stripe", logo: <StripeLogo /> },
    { id: "netsuite", name: "NetSuite", description: "Enterprise ERP integration", category: "ERP", comingSoon: true, logo: <NetSuiteLogo /> },
  ];

  const connected = integrations.filter(i => i.connected);
  const available = integrations.filter(i => !i.connected && !i.comingSoon);
  const comingSoon = integrations.filter(i => i.comingSoon);

  const Card = ({ integration }: { integration: typeof integrations[0] }) => (
    <div className={`bg-bg-surface border rounded-2xl p-5 transition ${integration.connected ? "border-green-500/30" : "border-bg-border"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-bg-border flex items-center justify-center">
          {integration.logo}
        </div>
        {integration.connected && (
          <span className="flex items-center gap-1.5 text-[11px] text-green-400 font-medium bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            Connected
          </span>
        )}
        {integration.comingSoon && (
          <span className="text-[11px] text-text-muted font-medium bg-white/5 border border-bg-border px-2 py-0.5 rounded-full">
            Soon
          </span>
        )}
      </div>

      <h3 className="font-semibold text-text-primary text-sm mb-1">{integration.name}</h3>
      <p className="text-text-muted text-xs leading-relaxed mb-3">{integration.description}</p>

      {integration.connected ? (
        <div className="flex gap-1.5">
          <button onClick={() => router.push(integration.dashboardHref!)}
            className="flex-1 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-gray-100 transition">
            Dashboard
          </button>
          <button onClick={() => { window.location.href = integration.connectHref!; }}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-bg-border text-text-muted text-xs hover:bg-white/10 transition">
            Reconnect
          </button>
          <button onClick={() => disconnect(integration.id)} disabled={disconnecting === integration.id}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-bg-border text-red-400 text-xs hover:bg-red-500/10 transition disabled:opacity-50">
            {disconnecting === integration.id ? "..." : "Remove"}
          </button>
        </div>
      ) : integration.comingSoon ? (
        <button onClick={() => setNotified(prev => [...prev, integration.id])}
          disabled={notified.includes(integration.id)}
          className="w-full py-1.5 rounded-lg bg-white/5 border border-bg-border text-text-muted text-xs hover:bg-white/10 transition disabled:opacity-50">
          {notified.includes(integration.id) ? "Notified" : "Notify Me"}
        </button>
      ) : (
        <button onClick={() => { setConnecting(integration.id); window.location.href = integration.connectHref!; }}
          disabled={connecting === integration.id}
          className="w-full py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-gray-100 transition disabled:opacity-50">
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
          <p className="text-text-muted">Connect your email, accounting, and logistics tools to streamline sourcing workflows.</p>
        </div>

        {connected.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-4">Connected · {connected.length}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {connected.map(i => <Card key={i.id} integration={i} />)}
            </div>
          </div>
        )}

        {available.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-4">Available</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {available.map(i => <Card key={i.id} integration={i} />)}
            </div>
          </div>
        )}

        {comingSoon.length > 0 && (
          <div>
            <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-4">Coming Soon · {comingSoon.length}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {comingSoon.map(i => <Card key={i.id} integration={i} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
