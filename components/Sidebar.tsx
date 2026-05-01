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
import NotificationBell from "@/components/NotificationBell";
import { cn } from "@/lib/utils";

export default function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const router = useRouter();
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
      <div className={cn("flex items-center gap-2.5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ml-4", isActive(href) ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text-secondary hover:bg-bg-hover")}>
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
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-text-primary leading-none" style={{ fontFamily: "var(--font-display)" }}>Jimmy</div>
            <div className="text-[10px] text-text-muted mt-0.5 leading-none">AI Operating System</div>
          </div>
          <NotificationBell />
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-widest px-3 mb-3">Workspace</div>

        <NavItem href="/integrations" icon={Plug} label="Integrations" description="Connect your tools" />
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" description="Business metrics" />
        <NavItem href="/plm" icon={Package} label="Product Lifecycle" description="SKUs & collections" dot={plmActionCount > 0 ? "red" : plmUpdateCount > 0 ? "yellow" : null} />
        <NavItem href="/inventory" icon={Warehouse} label="Inventory" description="Stock & warehouses" />
        <NavItem href="/workflows" icon={Zap} label="Workflows" description="AI automations" />
        <NavItem href="/plm/agent" icon={Sparkles} label="PLM Agent" description="Ask about your products" />
        <NavItem href="/messages" icon={MessageSquare} label="Messages" description="Factory & team chats" />
        <NavItem href="/coming-soon" icon={Sparkles} label="Coming Soon" description="What's next" />





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
