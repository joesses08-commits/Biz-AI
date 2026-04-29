"use client";

const FEATURES = [
  {
    category: "Intelligence",
    color: "#a855f7",
    bg: "#a855f715",
    items: [
      {
        title: "Action Tracker",
        subtitle: "Your daily to-do list, written by AI",
        description: "Jimmy reads your emails, invoices, and live data every morning and generates the exact actions your business needs today — ranked by urgency, assigned to the right person, with deadlines attached. No inbox archaeology. No missed follow-ups.",
        tags: ["AI-generated", "Priority ranking", "Auto-assigned"],
        eta: "Q2 2026",
        icon: (
          <svg viewBox="0 0 80 56" fill="none" className="w-full h-full">
            <rect x="8" y="8" width="64" height="8" rx="4" fill="#a855f730"/>
            <rect x="8" y="8" width="40" height="8" rx="4" fill="#a855f7"/>
            <rect x="8" y="22" width="64" height="6" rx="3" fill="#a855f720"/>
            <rect x="8" y="22" width="55" height="6" rx="3" fill="#a855f750"/>
            <rect x="8" y="34" width="64" height="6" rx="3" fill="#a855f720"/>
            <rect x="8" y="34" width="28" height="6" rx="3" fill="#a855f740"/>
            <circle cx="68" cy="44" r="8" fill="#a855f7"/>
            <path d="M64 44l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ),
      },
      {
        title: "Predictive Forecasting",
        subtitle: "See around corners before they happen",
        description: "Jimmy models your revenue, inventory, and cash position weeks in advance — using your real sales history, seasonal patterns, and open orders. Know when you'll run short, when cash gets tight, and when to push harder before the quarter ends.",
        tags: ["Revenue forecasting", "Inventory planning", "Cash flow"],
        eta: "Q3 2026",
        icon: (
          <svg viewBox="0 0 80 56" fill="none" className="w-full h-full">
            <polyline points="8,44 24,32 36,36 52,20 72,12" stroke="#a855f740" strokeWidth="1.5"/>
            <polyline points="52,20 72,12" stroke="#a855f7" strokeWidth="2" strokeDasharray="3 2"/>
            <circle cx="8" cy="44" r="2.5" fill="#a855f7"/>
            <circle cx="24" cy="32" r="2.5" fill="#a855f7"/>
            <circle cx="36" cy="36" r="2.5" fill="#a855f7"/>
            <circle cx="52" cy="20" r="2.5" fill="#a855f7"/>
            <circle cx="72" cy="12" r="3" fill="#a855f7" opacity="0.5"/>
            <line x1="8" y1="48" x2="72" y2="48" stroke="#ffffff10" strokeWidth="1"/>
          </svg>
        ),
      },
    ],
  },
  {
    category: "Meetings & Communication",
    color: "#3b82f6",
    bg: "#3b82f615",
    items: [
      {
        title: "Meeting Intelligence",
        subtitle: "Every meeting ends with a plan",
        description: "Connect Google Meet or Teams. Jimmy transcribes every call, pulls out decisions and action items, and sends a clean summary to all participants before you've even closed your laptop. Never lose a follow-up again.",
        tags: ["Auto-transcription", "Action extraction", "Follow-up emails"],
        eta: "Q2 2026",
        icon: (
          <svg viewBox="0 0 80 56" fill="none" className="w-full h-full">
            <rect x="8" y="12" width="44" height="32" rx="5" fill="#3b82f620" stroke="#3b82f640" strokeWidth="1"/>
            <circle cx="30" cy="28" r="7" fill="#3b82f640"/>
            <path d="M26 28c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z" fill="#3b82f6"/>
            <path d="M54 20l14-6v28l-14-6V20z" fill="#3b82f630" stroke="#3b82f640" strokeWidth="1"/>
            <rect x="14" y="38" width="20" height="2" rx="1" fill="#3b82f640"/>
          </svg>
        ),
      },
      {
        title: "Smart Email Drafting",
        subtitle: "Jimmy writes it. You approve it. Done.",
        description: "Overdue invoice? Factory hasn't responded? Sample decision needed? Jimmy drafts the right email, in the right tone, to the right person — based on exactly what's happening in your business. Review in 5 seconds, send in one click.",
        tags: ["Context-aware drafts", "One-click send", "Gmail + Outlook"],
        eta: "Q3 2026",
        icon: (
          <svg viewBox="0 0 80 56" fill="none" className="w-full h-full">
            <rect x="8" y="14" width="56" height="36" rx="5" fill="#3b82f615" stroke="#3b82f630" strokeWidth="1"/>
            <path d="M8 20l28 16 28-16" stroke="#3b82f650" strokeWidth="1.5"/>
            <rect x="48" y="8" width="20" height="14" rx="3" fill="#3b82f6"/>
            <path d="M53 15l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ),
      },
    ],
  },
  {
    category: "Team & Operations",
    color: "#10b981",
    bg: "#10b98115",
    items: [
      {
        title: "Team Management",
        subtitle: "Everyone sees exactly what they need",
        description: "Invite your team with role-based access. Designers see their products. Finance sees invoices and cash flow. Sales sees the pipeline. Ops sees everything. Full audit trail on every action — so nothing falls through the cracks and nothing leaks.",
        tags: ["Role-based access", "Audit trail", "Multi-user"],
        eta: "Q3 2026",
        icon: (
          <svg viewBox="0 0 80 56" fill="none" className="w-full h-full">
            <circle cx="40" cy="18" r="8" fill="#10b98140"/>
            <circle cx="40" cy="18" r="5" fill="#10b981"/>
            <circle cx="20" cy="36" r="6" fill="#10b98130"/>
            <circle cx="20" cy="36" r="4" fill="#10b98170"/>
            <circle cx="60" cy="36" r="6" fill="#10b98130"/>
            <circle cx="60" cy="36" r="4" fill="#10b98170"/>
            <line x1="40" y1="26" x2="20" y2="30" stroke="#10b98140" strokeWidth="1.5"/>
            <line x1="40" y1="26" x2="60" y2="30" stroke="#10b98140" strokeWidth="1.5"/>
          </svg>
        ),
      },
      {
        title: "Notification & Responsibility Routing",
        subtitle: "The right alert to the right person, automatically",
        description: "Sample arrived? The designer gets pinged. Invoice overdue? Finance gets the alert. Order stuck in production? Ops lead knows before you do. Jimmy routes every signal to the right person based on your team structure — no manual forwarding.",
        tags: ["Smart routing", "Multi-channel", "Custom rules"],
        eta: "Q3 2026",
        icon: (
          <svg viewBox="0 0 80 56" fill="none" className="w-full h-full">
            <circle cx="40" cy="28" r="10" fill="#10b98120" stroke="#10b98140" strokeWidth="1"/>
            <circle cx="40" cy="28" r="4" fill="#10b981"/>
            <line x1="40" y1="18" x2="40" y2="10" stroke="#10b98150" strokeWidth="1.5"/>
            <circle cx="40" cy="8" r="3" fill="#10b98160"/>
            <line x1="49" y1="23" x2="56" y2="18" stroke="#10b98150" strokeWidth="1.5"/>
            <circle cx="58" cy="17" r="3" fill="#10b98160"/>
            <line x1="49" y1="33" x2="56" y2="38" stroke="#10b98150" strokeWidth="1.5"/>
            <circle cx="58" cy="40" r="3" fill="#10b98160"/>
            <line x1="31" y1="23" x2="24" y2="18" stroke="#10b98150" strokeWidth="1.5"/>
            <circle cx="22" cy="17" r="3" fill="#10b98160"/>
          </svg>
        ),
      },
    ],
  },
  {
    category: "Workflows & Automation",
    color: "#f59e0b",
    bg: "#f59e0b15",
    items: [
      {
        title: "Invoice Overdue Chaser",
        subtitle: "Get paid without the awkward follow-up",
        description: "Jimmy monitors your open invoices and automatically sends professional follow-up emails at the right cadence — polite reminder at 7 days, firmer at 14, escalated at 30. The moment payment lands, it stops. You never have to chase again.",
        tags: ["QuickBooks sync", "Auto-escalation", "Payment detection"],
        eta: "Q2 2026",
        icon: (
          <svg viewBox="0 0 80 56" fill="none" className="w-full h-full">
            <rect x="16" y="10" width="48" height="36" rx="5" fill="#f59e0b15" stroke="#f59e0b30" strokeWidth="1"/>
            <rect x="24" y="20" width="32" height="3" rx="1.5" fill="#f59e0b40"/>
            <rect x="24" y="27" width="20" height="3" rx="1.5" fill="#f59e0b30"/>
            <rect x="24" y="34" width="14" height="3" rx="1.5" fill="#f59e0b20"/>
            <circle cx="58" cy="14" r="7" fill="#f59e0b"/>
            <text x="58" y="18" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">$</text>
          </svg>
        ),
      },
      {
        title: "Reorder Trigger",
        subtitle: "Never run out of your best sellers",
        description: "Set stock thresholds per product. When inventory drops below your target, Jimmy drafts the purchase order, selects your approved factory based on past performance, and alerts your team — ready to approve and send in one click.",
        tags: ["Inventory monitoring", "Auto PO draft", "Factory routing"],
        eta: "Q3 2026",
        icon: (
          <svg viewBox="0 0 80 56" fill="none" className="w-full h-full">
            <rect x="8" y="32" width="12" height="16" rx="2" fill="#f59e0b60"/>
            <rect x="24" y="24" width="12" height="24" rx="2" fill="#f59e0b80"/>
            <rect x="40" y="16" width="12" height="32" rx="2" fill="#f59e0ba0"/>
            <rect x="56" y="8" width="12" height="40" rx="2" fill="#f59e0b"/>
            <line x1="8" y1="52" x2="72" y2="52" stroke="#ffffff15" strokeWidth="1"/>
            <path d="M34 10l6-6 6 6" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="40" y1="4" x2="40" y2="14" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        ),
      },
    ],
  },
  {
    category: "Integrations",
    color: "#ec4899",
    bg: "#ec489915",
    items: [
      {
        title: "Shopify",
        subtitle: "Your store and your supply chain, finally talking",
        description: "Pull real-time Shopify sales and inventory into Jimmy's brain. See which products are flying off shelves, which are stalling, and whether your production pipeline can keep up — all in one view without bouncing between tools.",
        tags: ["Real-time sync", "Inventory correlation", "Sales analytics"],
        eta: "Q3 2026",
        icon: (
          <svg viewBox="0 0 80 56" fill="none" className="w-full h-full">
            <rect x="20" y="16" width="40" height="28" rx="5" fill="#ec489915" stroke="#ec489930" strokeWidth="1"/>
            <path d="M32 30h16M32 36h10" stroke="#ec489960" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="36" cy="24" r="4" fill="#ec489940"/>
            <circle cx="36" cy="24" r="2" fill="#ec4899"/>
            <path d="M56 10c4 2 8 8 8 18s-4 16-8 18" stroke="#ec489940" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M60 16c2 2 4 6 4 12s-2 10-4 12" stroke="#ec489960" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        ),
      },
      {
        title: "Bank Account & Cash Flow",
        subtitle: "Real money. Real time. No surprises.",
        description: "Connect your business bank account for live cash flow monitoring. Jimmy alerts you when balances drop below your threshold, flags unusual transactions, and shows you a daily cash position alongside your P&L — so you always know where you stand.",
        tags: ["Live balance", "Anomaly detection", "Cash forecasting"],
        eta: "Q4 2026",
        icon: (
          <svg viewBox="0 0 80 56" fill="none" className="w-full h-full">
            <rect x="12" y="18" width="56" height="28" rx="5" fill="#ec489915" stroke="#ec489930" strokeWidth="1"/>
            <rect x="12" y="24" width="56" height="6" fill="#ec489920"/>
            <rect x="20" y="34" width="16" height="4" rx="2" fill="#ec489940"/>
            <rect x="44" y="34" width="10" height="4" rx="2" fill="#ec489930"/>
            <path d="M32 12h16" stroke="#ec489940" strokeWidth="2" strokeLinecap="round"/>
            <path d="M36 8h8" stroke="#ec489930" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ),
      },
    ],
  },
];

const ETA_COLORS: Record<string, string> = {
  "Q2 2026": "#10b981",
  "Q3 2026": "#f59e0b",
  "Q4 2026": "#6b7280",
};

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-16">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted px-3 py-1 rounded-full border border-bg-border inline-block mb-5">Roadmap</span>
          <h1 className="text-4xl font-bold tracking-tight mb-4">What's coming to Jimmy</h1>
          <p className="text-white/35 text-sm leading-relaxed max-w-2xl">
            Jimmy is the operating system for your wholesale business — not just a dashboard. 
            Every feature below is designed around how real wholesale operations work. 
            We build what our customers actually need, not what looks good in a demo.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-16">
          {FEATURES.map(section => (
            <div key={section.category}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-7">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: section.color }} />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: section.color }}>{section.category}</span>
                <div className="flex-1 h-px bg-bg-elevated" />
              </div>

              {/* 2-column grid */}
              <div className="grid grid-cols-2 gap-4">
                {section.items.map(item => (
                  <div key={item.title} className="border border-bg-border rounded-2xl overflow-hidden bg-bg-surface hover:border-bg-border transition group">
                    {/* Illustration area */}
                    <div className="h-32 flex items-center justify-center px-8 py-6" style={{ background: section.bg }}>
                      <div className="w-full h-full max-w-[160px]">
                        {item.icon}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <h3 className="text-sm font-bold text-text-primary">{item.title}</h3>
                          <p className="text-[11px] text-white/35 mt-0.5">{item.subtitle}</p>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 border whitespace-nowrap mt-0.5"
                          style={{ color: ETA_COLORS[item.eta], borderColor: `${ETA_COLORS[item.eta]}40`, background: `${ETA_COLORS[item.eta]}10` }}>
                          {item.eta}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed mb-4">{item.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.tags.map(tag => (
                          <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full bg-bg-elevated text-white/25 border border-bg-border">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 border border-bg-border rounded-2xl p-7 bg-bg-surface text-center">
          <p className="text-sm font-semibold text-white mb-2">Have a feature request?</p>
          <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto">
            This roadmap is shaped entirely by how our customers work. If something's missing or you want something moved up, reach out directly.
          </p>
        </div>

      </div>
    </div>
  );
}
