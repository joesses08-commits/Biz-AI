"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function IntegrationsPage() {
  const [gmailConnected, setGmailConnected] = useState(false);
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
    fetch("/api/gmail/status").then(r => r.json()).then(d => setGmailConnected(d.connected)).catch(() => {});
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

  const GoogleLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );

  const MicrosoftLogo = () => (
    <svg width="22" height="22" viewBox="0 0 23 23">
      <path fill="#f35325" d="M1 1h10v10H1z"/>
      <path fill="#81bc06" d="M12 1h10v10H12z"/>
      <path fill="#05a6f0" d="M1 12h10v10H1z"/>
      <path fill="#ffba08" d="M12 12h10v10H12z"/>
    </svg>
  );

  const StripeLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <path fill="#635BFF" d="M13.976 9.15c-2.172-.806-3.361-1.426-3.361-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
    </svg>
  );

  const QBLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="#2CA01C"/>
      <path fill="white" d="M12 4.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 12a4.5 4.5 0 110-9 4.5 4.5 0 010 9zm0-7.5a3 3 0 100 6 3 3 0 000-6z"/>
    </svg>
  );

  const integrations = [
    // Connected ones
    { id: "gmail", name: "Google Workspace", description: "Gmail, Sheets, Drive, Calendar", category: "Productivity", connected: gmailConnected, connectHref: "/api/gmail/connect", dashboardHref: "/google", logo: <GoogleLogo /> },
    { id: "microsoft", name: "Microsoft 365", description: "Outlook, Excel, OneDrive, Teams", category: "Productivity", connected: msConnected, connectHref: "/api/microsoft/connect", dashboardHref: "/microsoft", logo: <MicrosoftLogo /> },
    { id: "stripe", name: "Stripe", description: "Revenue, subscriptions, and payments", category: "Payments", connected: stripeConnected, connectHref: "/api/stripe/connect", dashboardHref: "/stripe", logo: <StripeLogo /> },
    { id: "quickbooks", name: "QuickBooks", description: "P&L, invoices, and cash flow", category: "Accounting", connected: qbConnected, connectHref: "/api/quickbooks/connect", dashboardHref: "/quickbooks", logo: <QBLogo /> },
    // Coming soon
    { id: "slack", name: "Slack", description: "Team communication and project activity", category: "Communication", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/><path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/><path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/><path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg> },
    { id: "hubspot", name: "HubSpot", description: "Leads, deals, and pipeline", category: "CRM", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#FF7A59" d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.978V3.06A2.2 2.2 0 0 0 17.235.862h-.046a2.2 2.2 0 0 0-2.196 2.197v.046a2.198 2.198 0 0 0 1.267 1.978V7.93a6.232 6.232 0 0 0-2.962 1.301L5.57 3.842a2.45 2.45 0 1 0-1.304 1.44l7.532 5.24a6.232 6.232 0 0 0 .48 8.144 6.235 6.235 0 1 0 5.886-10.736zm-1.022 9.586a3.13 3.13 0 1 1 0-6.26 3.13 3.13 0 0 1 0 6.26z"/></svg> },
    { id: "salesforce", name: "Salesforce", description: "Enterprise CRM and sales forecasting", category: "CRM", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#00A1E0" d="M10.002 6.257a4.195 4.195 0 0 1 2.918-1.172c1.56 0 2.928.85 3.666 2.116a5.09 5.09 0 0 1 2.03-.423c2.83 0 5.122 2.297 5.122 5.13 0 2.833-2.292 5.13-5.123 5.13a5.1 5.1 0 0 1-1.015-.102 3.85 3.85 0 0 1-3.43 2.11 3.84 3.84 0 0 1-1.74-.413A4.5 4.5 0 0 1 8.26 20.6c-2.484 0-4.498-2.015-4.498-4.5 0-.403.054-.793.153-1.165A3.944 3.944 0 0 1 2 11.07c0-2.18 1.766-3.945 3.944-3.945.78 0 1.507.224 2.12.613a4.18 4.18 0 0 1 1.938-1.48z"/></svg> },
    { id: "shopify", name: "Shopify", description: "E-commerce sales and inventory", category: "E-commerce", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#96BF48" d="M20.924 7.625a.88.88 0 0 0-.79-.75c-.336-.028-3.544-.263-3.544-.263s-2.363-2.35-2.614-2.6a.733.733 0 0 0-.648-.163L12 4.47S10.9 1.8 7.796 1.8a.97.97 0 0 0-.173.015C7.47 1.57 7.2 1.5 6.93 1.5 4.776 1.5 3.74 4.06 3.415 5.42c-.876.271-1.493.462-1.567.487-.625.196-.644.215-.724.8C1.063 7.2 0 16.214 0 16.214L15.532 19 24 17.13S20.994 7.876 20.924 7.625zM13.2 4.85l-1.666.516v-.36c0-.73-.1-1.32-.264-1.787.651.082 1.09.822 1.93 1.63zm-2.67-1.484c.172.455.283 1.094.283 1.965v.124l-2.125.658c.41-1.578 1.18-2.346 1.842-2.747zm-.963-.504c.1 0 .198.034.29.098C9.133 3.46 8.196 4.63 7.84 6.54l-1.6.496c.447-1.806 1.7-3.674 3.327-3.674z"/></svg> },
    { id: "zoom", name: "Zoom", description: "Meeting transcripts and intelligence", category: "Communication", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#2D8CFF" d="M24 12c0 6.627-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0s12 5.373 12 12zM10.218 7.93H6.375C5.476 7.93 5 8.408 5 9.308v5.46l1.563-.9v-4.5h3.655c.9 0 1.376-.476 1.376-1.376v-.063zm2.718 0h-1.876v8.14h1.876V7.93zm4.688 0h-3.654c0 .9.476 1.376 1.375 1.376h1.313v4.5l1.563.9V9.308c0-.9-.476-1.378-1.375-1.378h-.001v.1-.1z"/></svg> },
    { id: "xero", name: "Xero", description: "Accounting, bank reconciliation, and reporting", category: "Accounting", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#13B5EA" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.41 16.847l-3.701-3.695 3.703-3.703.705.705-2.998 2.998 2.996 2.99-.705.705zm2.82 0l-.705-.705 2.996-2.99-2.997-2.998.705-.705 3.702 3.703-3.701 3.695z"/></svg> },
    { id: "plaid", name: "Plaid", description: "Bank accounts and real-time cash flow", category: "Banking", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#000000" d="M8.49 0L3.37 2.13 0 7.37v3.06l3.79 3.79-1.26 4.5L5.4 24h3.44l4.5-1.97 3.41-3.41V15.5L8.49 0zM15.5 0l-4.5 1.97L7.59 5.38v3.12l8.26 8.26 4.78-1.26L24 12.63V9.19L15.5 0z"/></svg> },
    { id: "adp", name: "ADP", description: "Payroll, headcount, and HR data", category: "HR", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#D4002A"/><path fill="white" d="M7 8h4c2.2 0 3.5 1.1 3.5 3s-1.3 3-3.5 3H9v2H7V8zm2 4.5h1.8c1 0 1.7-.4 1.7-1.5S11.8 9.5 10.8 9.5H9v3z"/></svg> },
    { id: "bamboohr", name: "BambooHR", description: "Employee data, PTO, and performance", category: "HR", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#73C41D"/><path fill="white" d="M8 7h2.5c2 0 3 .9 3 2.3 0 .9-.5 1.6-1.3 1.9.9.3 1.6 1 1.6 2.1 0 1.6-1.1 2.7-3.2 2.7H8V7zm2 3.7h.4c.8 0 1.2-.4 1.2-1s-.4-1-1.2-1H10v2zm0 3.6h.5c.9 0 1.4-.4 1.4-1.1S11.4 12 10.5 12H10v2.3z"/></svg> },
    { id: "gusto", name: "Gusto", description: "Payroll, benefits, and compliance", category: "HR", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#F45D48"/><path fill="white" d="M12 6a6 6 0 0 0-6 6h3a3 3 0 0 1 3-3v-3zm0 12a6 6 0 0 0 6-6h-3a3 3 0 0 1-3 3v3z"/></svg> },
    { id: "amazon", name: "Amazon Seller", description: "Marketplace revenue and inventory", category: "E-commerce", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#FF9900" d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.7-3.182v.686zm3.186 7.705a.66.66 0 0 1-.748.075c-1.051-.875-1.238-1.279-1.814-2.113-1.732 1.768-2.958 2.296-5.207 2.296-2.658 0-4.728-1.642-4.728-4.924 0-2.566 1.391-4.309 3.37-5.164 1.715-.756 4.111-.891 5.943-1.099v-.41c0-.753.059-1.642-.384-2.294-.384-.582-1.124-.823-1.774-.823-1.206 0-2.278.618-2.54 1.897-.054.285-.265.567-.56.582l-3.127-.337c-.264-.06-.557-.272-.48-.678C5.932 2.916 9.119 2 11.979 2c1.463 0 3.376.389 4.532 1.497C17.868 4.695 17.799 6.3 17.799 8.048v5.301c0 1.594.662 2.296 1.285 3.159.22.308.268.677-.014.904l-1.926 1.383z"/><path fill="#FF9900" d="M20.801 18.909c-3.056 2.289-7.491 3.507-11.307 3.507-5.348 0-10.16-1.976-13.8-5.261-.286-.258-.03-.61.314-.41 3.929 2.285 8.787 3.661 13.802 3.661 3.384 0 7.104-.702 10.527-2.154.516-.219.949.339.464.657z"/></svg> },
    { id: "linkedin", name: "LinkedIn", description: "Hiring activity and team growth", category: "HR", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
    { id: "teams", name: "Microsoft Teams", description: "Team messages and meeting transcripts", category: "Communication", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#5059C9" d="M19.5 8.5h-9A1.5 1.5 0 0 0 9 10v6.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V10a1.5 1.5 0 0 0-1.5-1.5zM15 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path fill="#7B83EB" d="M8 9H3.5A1.5 1.5 0 0 0 2 10.5v5A1.5 1.5 0 0 0 3.5 17H8a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 8 9zM5.75 8.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5z"/></svg> },
    { id: "dropbox", name: "Dropbox", description: "File storage and document sharing", category: "Storage", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#0061FF" d="M6 2L0 6l6 4-6 4 6 4 6-4-6-4 6-4L6 2zm12 0l-6 4 6 4-6 4 6 4 6-4-6-4 6-4-6-4zM6 17.5L12 21.5l6-4-6-4-6 4z"/></svg> },
    { id: "notion", name: "Notion", description: "Wikis, docs, and project databases", category: "Productivity", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#000000" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/></svg> },
    { id: "asana", name: "Asana", description: "Project management and task tracking", category: "Productivity", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#F06A6A" d="M12 0C5.373 0 0 5.372 0 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-6.628-5.373-12-12-12zm5.25 13.5a2.25 2.25 0 1 1 0-4.501 2.25 2.25 0 0 1 0 4.501zm-10.5 0a2.25 2.25 0 1 1 0-4.501 2.25 2.25 0 0 1 0 4.501zM12 10.5a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5z"/></svg> },
    { id: "jira", name: "Jira", description: "Issues, sprints, and engineering velocity", category: "Productivity", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#0052CC" d="M11.571 11.429L6.429 6.286A8.053 8.053 0 0 0 4 12c0 2.19.882 4.175 2.31 5.619l5.261-5.261c.277-.277.277-.652 0-.929zm.858.857l5.142 5.143A8.053 8.053 0 0 0 20 12c0-2.19-.882-4.175-2.31-5.619l-5.261 5.261c-.277.277-.277.652 0 .929v-.286zM12 4.286A7.714 7.714 0 1 0 12 19.714 7.714 7.714 0 0 0 12 4.286z"/></svg> },
    { id: "paypal", name: "PayPal", description: "Payment transactions and sales data", category: "Payments", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#003087" d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/></svg> },
    { id: "twilio", name: "Twilio", description: "SMS alerts and communication tracking", category: "Communication", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#F22F46" d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm0 20.785c-4.844 0-8.785-3.94-8.785-8.785S7.156 3.215 12 3.215s8.785 3.94 8.785 8.785-3.941 8.785-8.785 8.785zM9.128 9.128a2.785 2.785 0 1 1-5.57 0 2.785 2.785 0 0 1 5.57 0zm11.314 0a2.785 2.785 0 1 1-5.57 0 2.785 2.785 0 0 1 5.57 0zm0 5.744a2.785 2.785 0 1 1-5.57 0 2.785 2.785 0 0 1 5.57 0zM9.128 14.872a2.785 2.785 0 1 1-5.57 0 2.785 2.785 0 0 1 5.57 0z"/></svg> },
    { id: "mailchimp", name: "Mailchimp", description: "Email marketing and campaign analytics", category: "Marketing", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#FFE01B" d="M21.03 13.56c-.13-.1-.26-.2-.36-.25-.1-.06-.17-.06-.2 0-.03.05 0 .1.07.17.07.06.17.14.25.23.08.1.12.2.1.28-.03.1-.13.15-.26.13-.13-.02-.26-.09-.36-.18l-.03-.03-.05.16c.12.13.27.22.43.24.17.02.32-.04.38-.18.07-.14.03-.3-.1-.44-.06-.07-.14-.14-.23-.21.07-.03.14-.04.2-.01.06.02.13.07.2.13.14.13.22.3.2.44l.06.01c.03-.2-.04-.4-.2-.53zm-.47.35c-.06-.07-.11-.14-.14-.2.05-.02.1-.02.15 0 .06.02.11.06.16.11.1.1.14.22.12.32-.02.1-.1.14-.2.13-.1-.02-.2-.08-.28-.16.07.01.15 0 .2-.04.05-.04.07-.1.04-.16h-.05zm-3.3-8.82C16.8 2.2 14.88 1 12.53 1 7.81 1 4 4.81 4 9.53c0 2.27.88 4.33 2.32 5.87l.1.1s-.02.05-.06.13c-.1.2-.26.56-.34 1.01-.1.6-.08 1.38.4 2.07.5.71 1.37 1.17 2.6 1.33 1.53.2 2.92-.2 3.87-1.1.54-.5.88-1.12.98-1.78.06-.4.03-.78-.08-1.1-.1-.33-.26-.58-.42-.76l-.05-.06s.05-.02.12-.04c.5-.1 1.5-.44 2.42-1.27.9-.82 1.63-2.07 1.63-3.87 0-.1-.01-.2-.02-.3.37-.2.66-.48.83-.82.17-.34.2-.72.1-1.08-.1-.36-.33-.67-.66-.87zm-5.5 14.1c-.88.8-2.14 1.17-3.54.98-1.1-.14-1.88-.54-2.3-1.15-.4-.6-.44-1.28-.35-1.83.06-.38.18-.68.27-.87.04-.08.07-.14.09-.18.13.14.29.26.47.36.8.43 2.02.54 3.54.13 1-.27 1.8-.7 2.36-1.24.13.2.22.44.26.7.08.58-.06 1.25-.5 1.65v.45zm1.38-2.5c-.63.66-1.57 1.17-2.7 1.47-1.64.44-2.9.3-3.6-.1-.35-.19-.55-.43-.64-.7-.12-.38-.06-.85.12-1.3.06.07.12.14.18.2.5.5 1.2.9 2.06 1.1.86.2 1.8.17 2.7-.08.87-.24 1.6-.68 2.1-1.24.18.24.17.5-.22.65zm.54-.9c-.46.54-1.16 1-2.04 1.24-.86.24-1.76.27-2.6.08-.84-.2-1.52-.6-2-.1-.47-.45-.74-1.04-.77-1.74-.04-.7.17-1.46.55-2.1.38-.64.9-1.15 1.48-1.47.58-.32 1.2-.44 1.78-.36.58.08 1.12.36 1.56.8.44.44.73 1.03.8 1.7.08.67-.06 1.37-.44 1.95h-.32zm4.4-2.75c-.07.19-.24.37-.48.5-.02-.32-.1-.63-.23-.92.17.07.35.1.52.08.18-.02.35-.1.46-.24.03-.04.06-.08.08-.12.03.23.02.49-.35.7zm.14-1.04c-.12.16-.3.24-.5.26-.16.02-.34 0-.5-.06.06-.26.07-.52.03-.77.18.1.37.16.57.16.2 0 .37-.06.5-.17.04.18.03.4-.1.58zm.24-.85c-.14.12-.32.18-.52.18-.2 0-.38-.07-.52-.2-.1-.1-.16-.22-.18-.36.17-.16.28-.36.28-.58v-.04c.13.1.3.17.48.17.18 0 .35-.07.47-.18.1.18.1.4-.01.6v.41zm.6-1.06c-.1.14-.26.22-.43.24-.17.02-.34-.03-.47-.14-.1-.08-.17-.2-.2-.33.2-.1.36-.27.46-.47.08.12.2.22.33.27.14.06.28.06.4.02.05.14.02.3-.1.4zm-11.77.7c-.5-.32-1.1-.5-1.74-.5-.94 0-1.77.38-2.37 1-.6.62-.97 1.48-.97 2.42 0 .96.38 1.8.98 2.42.6.62 1.43 1 2.36 1 .65 0 1.24-.18 1.74-.5-.6-.57-1-1.37-1-2.24 0-.88.4-1.67 1-2.24v-.36zm4.7-.62c-.1-.46-.35-.87-.7-1.2-.46-.42-1.07-.68-1.76-.68-.68 0-1.3.25-1.76.66-.45.4-.74.97-.76 1.6 0 .06 0 .12.01.18.35-.27.77-.44 1.23-.5.04 0 .08-.01.12-.01.7 0 1.3.32 1.7.82.2.25.34.54.38.86h.04c.7-.12 1.27-.57 1.5-1.1v-.03c.01-.2 0-.4-.06-.58l.06-.02z"/></svg> },
    { id: "intercom", name: "Intercom", description: "Customer support and chat analytics", category: "Support", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#1F8FEB" d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.84 16.8a.82.82 0 0 1-1.12.32c-3.08-1.84-6.96-2.26-11.53-1.24a.82.82 0 0 1-.36-1.6c5-.11 9.2.38 12.69 2.4a.82.82 0 0 1 .32 1.12zm1.56-3.38a1.02 1.02 0 0 1-1.4.41c-3.52-2.16-8.88-2.79-13.04-1.53a1.02 1.02 0 1 1-.59-1.95c4.76-1.44 10.68-.74 14.62 1.67a1.02 1.02 0 0 1 .41 1.4zm.13-3.5C15.8 7.5 9.74 7.3 6.35 8.3a1.22 1.22 0 0 1-.71-2.33c3.96-1.21 10.54-.97 14.7 1.52a1.22 1.22 0 0 1-1.21 2.12l-.64-.59z"/></svg> },
    { id: "zendesk", name: "Zendesk", description: "Support tickets and customer satisfaction", category: "Support", comingSoon: true, logo: <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#03363D" d="M11.5 0A11.5 11.5 0 0 0 0 11.5 11.5 11.5 0 0 0 11.5 23 11.5 11.5 0 0 0 23 11.5 11.5 11.5 0 0 0 11.5 0zm-.5 5.5c1.93 0 3.5 1.57 3.5 3.5S12.93 12.5 11 12.5 7.5 10.93 7.5 9s1.57-3.5 3.5-3.5zm5 12H6v-1c0-2.76 2.24-5 5-5s5 2.24 5 5v1z"/></svg> },
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
          <p className="text-text-muted">Connect your business tools so Jimmy AI has full visibility across your company.</p>
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
