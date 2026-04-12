"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Package, Warehouse,
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  Video,
  Settings,
  BarChart2,
  HelpCircle,
  LogOut,
  Plug,
  CreditCard,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Mail,
  Calendar,
  FileSpreadsheet,
  HardDrive,
  BarChart3,
  Zap,
  Sparkles,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { cn } from "@/lib/utils";

export default function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [googleOpen, setGoogleOpen] = useState(pathname.startsWith("/google") || pathname.startsWith("/gmail"));
  const [microsoftOpen, setMicrosoftOpen] = useState(pathname.startsWith("/microsoft"));
  const [plmActionCount, setPlmActionCount] = useState(0);
  const [plmUpdateCount, setPlmUpdateCount] = useState(0);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );



  useEffect(() => {
    const fetchActionCounts = async () => {
      try {
        const res = await fetch("/api/plm?type=action_counts");
        if (!res.ok) return;
        const data = await res.json();
        setPlmActionCount(data.action_required || 0);
        setPlmUpdateCount(data.updates_made || 0);
      } catch {}
    };
    fetchActionCounts();
    const interval = setInterval(fetchActionCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const NavItem = ({ href, icon: Icon, label, description, dot }: { href: string; icon: any; label: string; description: string; dot?: "red" | "yellow" | null }) => (
    <Link href={href} onClick={onNavigate}>
      <div className={cn("nav-item group", isActive(href) && "active")}>
        <div className="relative flex-shrink-0">
          <Icon size={16} className={cn("transition-colors", isActive(href) ? "text-accent" : "text-text-muted group-hover:text-text-secondary")} />
          {dot === "red" && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />}
          {dot === "yellow" && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium leading-none">{label}</div>
          <div className="text-[10px] text-text-muted mt-0.5 leading-none truncate">{description}</div>
        </div>
        {isActive(href) && <div className="w-1 h-1 rounded-full bg-accent flex-shrink-0" />}
      </div>
    </Link>
  );

  const SubItem = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => (
    <Link href={href} onClick={onNavigate}>
      <div className={cn("flex items-center gap-2.5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ml-4", isActive(href) ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text-secondary hover:bg-white/5")}>
        <Icon size={13} className="flex-shrink-0" />
        <span className="text-[12px] font-medium">{label}</span>
      </div>
    </Link>
  );


  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col h-screen bg-bg-surface border-r border-bg-border">
      <div className="px-5 py-5 border-b border-bg-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="10" fill="#0a0a0a"/>
              <line x1="24" y1="8" x2="24" y2="26" stroke="white" strokeWidth="4" strokeLinecap="round"/>
              <path d="M24 26 Q24 34 18 35 Q11 36 10 30" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-text-primary leading-none" style={{ fontFamily: "var(--font-display)" }}>Jimmy</div>
            <div className="text-[10px] text-text-muted mt-0.5 leading-none">AI Operating System</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-widest px-3 mb-3">Workspace</div>

        <NavItem href="/integrations" icon={Plug} label="Integrations" description="Connect your tools" />
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" description="Business metrics" />
        <NavItem href="/chat" icon={MessageSquare} label="AI Analyst" description="Ask questions" />
        <NavItem href="/plm" icon={Package} label="Product Lifecycle" description="SKUs & collections" dot={plmActionCount > 0 ? "red" : plmUpdateCount > 0 ? "yellow" : null} />
        <NavItem href="/workflows" icon={Zap} label="Workflows" description="AI automations" />
        <NavItem href="/coming-soon" icon={Sparkles} label="Coming Soon" description="What's next" />

        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-widest px-3 mt-4 mb-2">Integrations</div>

        {/* Google Workspace */}
        <div>
          <button
            onClick={() => setGoogleOpen(!googleOpen)}
            className={cn("nav-item w-full group", (isActive("/google") || isActive("/gmail")) && "active")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" className="flex-shrink-0">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium leading-none text-left">Google Workspace</div>
              <div className="text-[10px] text-text-muted mt-0.5 leading-none">Gmail, Sheets, Drive</div>
            </div>
            {googleOpen ? <ChevronDown size={12} className="text-text-muted" /> : <ChevronRight size={12} className="text-text-muted" />}
          </button>
          {googleOpen && (
            <div className="mt-1 space-y-0.5">
              <SubItem href="/gmail" icon={Mail} label="Gmail" />
              <SubItem href="/google/sheets" icon={FileSpreadsheet} label="Sheets" />
              <SubItem href="/google/drive" icon={HardDrive} label="Drive" />
            </div>
          )}
        </div>

        {/* Microsoft 365 */}
        <div>
          <button
            onClick={() => setMicrosoftOpen(!microsoftOpen)}
            className={cn("nav-item w-full group", isActive("/microsoft") && "active")}
          >
            <svg width="16" height="16" viewBox="0 0 23 23" className="flex-shrink-0">
              <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
              <path fill="#f35325" d="M1 1h10v10H1z"/>
              <path fill="#81bc06" d="M12 1h10v10H12z"/>
              <path fill="#05a6f0" d="M1 12h10v10H1z"/>
              <path fill="#ffba08" d="M12 12h10v10H12z"/>
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium leading-none text-left">Microsoft 365</div>
              <div className="text-[10px] text-text-muted mt-0.5 leading-none">Outlook, Excel, OneDrive</div>
            </div>
            {microsoftOpen ? <ChevronDown size={12} className="text-text-muted" /> : <ChevronRight size={12} className="text-text-muted" />}
          </button>
          {microsoftOpen && (
            <div className="mt-1 space-y-0.5">
              <SubItem href="/microsoft/outlook" icon={Mail} label="Outlook" />
              <SubItem href="/microsoft/calendar" icon={Calendar} label="Calendar" />
              <SubItem href="/microsoft/excel" icon={FileSpreadsheet} label="Excel" />
              <SubItem href="/microsoft/drive" icon={HardDrive} label="OneDrive" />
            </div>
          )}
        </div>

        {/* Stripe */}
        <div>
          <Link href="/stripe">
            <div className={cn("nav-item group", isActive("/stripe") && "active")}>
              <svg width="16" height="16" viewBox="0 0 24 24" className="flex-shrink-0">
                <path fill="#635BFF" d="M13.976 9.15c-2.172-.806-3.361-1.426-3.361-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium leading-none">Stripe</div>
                <div className="text-[10px] text-text-muted mt-0.5 leading-none">Revenue & payments</div>
              </div>
              {isActive("/stripe") && <div className="w-1 h-1 rounded-full bg-accent flex-shrink-0" />}
            </div>
          </Link>
        </div>

        {/* QuickBooks */}
        <div>
          <Link href="/quickbooks">
            <div className={cn("nav-item group", isActive("/quickbooks") && "active")}>
              <svg width="16" height="16" viewBox="0 0 24 24" className="flex-shrink-0">
                <circle cx="12" cy="12" r="12" fill="#2CA01C"/>
                <path fill="white" d="M12 4.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 12a4.5 4.5 0 110-9 4.5 4.5 0 010 9zm0-7.5a3 3 0 100 6 3 3 0 000-6z"/>
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium leading-none">QuickBooks</div>
                <div className="text-[10px] text-text-muted mt-0.5 leading-none">Invoices & financials</div>
              </div>
              {isActive("/quickbooks") && <div className="w-1 h-1 rounded-full bg-accent flex-shrink-0" />}
            </div>
          </Link>
        </div>

      </nav>

      <div className="px-3 pb-4 border-t border-bg-border pt-3 space-y-1">
        <Link href="/quota">
          <div className="nav-item">
            <Zap size={15} className="text-text-muted flex-shrink-0" />
            <span className="text-[13px]">AI Tokens</span>
          </div>
        </Link>
        <Link href="/settings/usage">
          <div className="nav-item">
            <BarChart2 size={15} className="text-text-muted flex-shrink-0" />
            <span className="text-[13px]">Usage & Costs</span>
          </div>
        </Link>
        <Link href="/settings">
          <div className="nav-item">
            <Settings size={15} className="text-text-muted flex-shrink-0" />
            <span className="text-[13px]">Settings</span>
          </div>
        </Link>
        <Link href="/help">
          <div className="nav-item">
            <HelpCircle size={15} className="text-text-muted flex-shrink-0" />
            <span className="text-[13px]">Help</span>
          </div>
        </Link>
        <button onClick={handleSignOut} className="nav-item w-full text-left">
          <LogOut size={15} className="text-text-muted flex-shrink-0" />
          <span className="text-[13px]">Sign Out</span>
        </button>
        <div className="px-3 pt-2">
          <div className="flex items-center gap-2 mb-1">
            <a href="/privacy" className="text-[10px] text-text-muted hover:text-white transition">Privacy</a>
            <span className="text-[10px] text-text-muted">·</span>
            <a href="/terms" className="text-[10px] text-text-muted hover:text-white transition">Terms</a>
          </div>
          <div className="text-[10px] text-text-muted">Jimmy v1.0 · Claude Sonnet</div>
        </div>
      </div>
    </aside>
  );
}
