"use client";

const COMING_SOON = [
  {
    category: "Intelligence",
    color: "#a855f7",
    items: [
      {
        title: "Action Tracker",
        subtitle: "AI-generated tasks from your business data",
        description: "Jimmy scans your emails, invoices, and integrations daily and surfaces the exact actions you need to take — with deadlines, priorities, and who owns what. No manual entry. Just a clean list of what needs to happen today.",
        tags: ["AI-powered", "Auto-generated", "Priority ranking"],
        eta: "Q2 2026",
      },
      {
        title: "Predictive Forecasting",
        subtitle: "Know what's coming before it arrives",
        description: "Jimmy analyzes your historical sales, seasonal patterns, and current pipeline to forecast revenue, inventory needs, and cash flow — weeks before you'd normally see the signal.",
        tags: ["Revenue forecasting", "Inventory planning", "Cash flow"],
        eta: "Q3 2026",
      },
      {
        title: "PLM ↔ Dashboard Intelligence",
        subtitle: "Your product data connected to your business brain",
        description: "Jimmy pulls your PLM data — production stages, sample timelines, factory performance — directly into your AI dashboard and chat. Ask 'which factory is causing delays?' or 'what's our landed cost on the Christmas collection?' and get instant answers.",
        tags: ["Cross-system AI", "Factory analytics", "Cost analysis"],
        eta: "Q2 2026",
      },
    ],
  },
  {
    category: "Meetings & Communication",
    color: "#3b82f6",
    items: [
      {
        title: "Meeting Intelligence",
        subtitle: "Every meeting turned into action",
        description: "Connect your Google Meet or Teams calls. Jimmy transcribes, summarizes, and extracts action items automatically. After every meeting, you get a clean summary and a list of who owes what — sent to your inbox before you close your laptop.",
        tags: ["Auto-transcription", "Action extraction", "Follow-up emails"],
        eta: "Q2 2026",
      },
      {
        title: "Smart Email Drafting",
        subtitle: "Jimmy writes, you approve",
        description: "Based on what's happening in your business — overdue invoices, sample approvals, factory delays — Jimmy drafts the right email, to the right person, at the right time. You review and send in one click.",
        tags: ["Context-aware", "One-click send", "All email providers"],
        eta: "Q3 2026",
      },
    ],
  },
  {
    category: "Team & Operations",
    color: "#10b981",
    items: [
      {
        title: "Team Management",
        subtitle: "Roles, permissions, and accountability",
        description: "Invite your team with role-based access. Designers see their products. Sales sees the pipeline. Finance sees the numbers. Everyone gets exactly what they need — and nothing they don't. Full audit trail on every action.",
        tags: ["Role-based access", "Audit trail", "Multi-user"],
        eta: "Q3 2026",
      },
      {
        title: "Project Management",
        subtitle: "Launches, campaigns, and initiatives",
        description: "Plan product launches, trade show prep, and seasonal campaigns with Jimmy as your project brain. Set milestones, assign tasks, and let Jimmy flag when something is off track before it becomes a problem.",
        tags: ["Launch planning", "Milestone tracking", "AI alerts"],
        eta: "Q4 2026",
      },
      {
        title: "Notification & Responsibility Routing",
        subtitle: "The right alert to the right person",
        description: "When a sample arrives, the designer gets notified. When an invoice is overdue, finance gets the alert. When a PO is stuck, the ops lead knows. Jimmy routes every signal to the right person automatically.",
        tags: ["Smart routing", "Multi-channel", "Custom rules"],
        eta: "Q3 2026",
      },
    ],
  },
  {
    category: "Workflows & Automations",
    color: "#f59e0b",
    items: [
      {
        title: "Invoice Overdue Chaser",
        subtitle: "Automatic follow-up on unpaid invoices",
        description: "Jimmy monitors your QuickBooks and Stripe for overdue invoices and automatically sends professional follow-up emails at the right intervals. Escalates tone over time. Stops the moment payment is received.",
        tags: ["QuickBooks sync", "Auto-escalation", "Payment detection"],
        eta: "Q2 2026",
      },
      {
        title: "Reorder Trigger",
        subtitle: "Never run out of your best sellers",
        description: "Set inventory thresholds per product. When stock drops below your target, Jimmy drafts the PO, selects your approved factory, and alerts your team — ready to send in one click.",
        tags: ["Inventory monitoring", "Auto PO draft", "Factory routing"],
        eta: "Q3 2026",
      },
      {
        title: "Advanced Settings & Custom Automations",
        subtitle: "Build your own workflows",
        description: "Define your own triggers and actions. When X happens, do Y. Connect any integration to any workflow. For power users who want Jimmy to work exactly the way their business works.",
        tags: ["Custom triggers", "No-code builder", "All integrations"],
        eta: "Q4 2026",
      },
    ],
  },
  {
    category: "Integrations",
    color: "#ec4899",
    items: [
      {
        title: "Shopify",
        subtitle: "Your store data in Jimmy's brain",
        description: "Connect Shopify to pull real-time sales, inventory, and customer data directly into your dashboard. Jimmy correlates your Shopify performance with your production pipeline — so you always know if supply can meet demand.",
        tags: ["Real-time sync", "Inventory correlation", "Sales analytics"],
        eta: "Q3 2026",
      },
      {
        title: "HubSpot & Salesforce",
        subtitle: "CRM intelligence inside Jimmy",
        description: "Pull your pipeline, deals, and customer history into Jimmy's context. Ask 'what deals are at risk this quarter?' or 'which customers haven't ordered in 90 days?' and get instant AI analysis.",
        tags: ["Pipeline analysis", "Customer insights", "Deal alerts"],
        eta: "Q4 2026",
      },
      {
        title: "Bank Account & Cash Flow",
        subtitle: "Real money, real time",
        description: "Connect your business bank account for live cash flow monitoring. Jimmy alerts you when balances drop below thresholds, flags unusual transactions, and gives you a daily cash position alongside your P&L.",
        tags: ["Live balance", "Anomaly detection", "Cash forecasting"],
        eta: "Q4 2026",
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
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-14">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-3 py-1 rounded-full border border-white/10">Roadmap</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">What's coming to Jimmy</h1>
          <p className="text-white/40 text-sm leading-relaxed max-w-xl">
            Jimmy is built to be the operating system for your entire business — not just a dashboard.
            Here's what we're building next. Every feature is designed around how wholesale businesses actually work.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-14">
          {COMING_SOON.map(section => (
            <div key={section.category}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: section.color }} />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: section.color }}>{section.category}</span>
                <div className="flex-1 h-px bg-white/[0.05]" />
              </div>
              <div className="space-y-4">
                {section.items.map(item => (
                  <div key={item.title} className="border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01] hover:border-white/10 transition">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-white mb-0.5">{item.title}</h3>
                        <p className="text-xs text-white/40">{item.subtitle}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 border" style={{ color: ETA_COLORS[item.eta] || "#6b7280", borderColor: `${ETA_COLORS[item.eta]}30` || "#6b728030", background: `${ETA_COLORS[item.eta]}10` || "#6b728010" }}>
                        {item.eta}
                      </span>
                    </div>
                    <p className="text-xs text-white/30 leading-relaxed mb-4">{item.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {item.tags.map(tag => (
                        <span key={tag} className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/30 border border-white/[0.06]">{tag}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-16 border border-white/[0.06] rounded-2xl p-6 bg-white/[0.01] text-center">
          <p className="text-xs text-white/30 leading-relaxed">
            Have a feature request or want something prioritized? Reach out directly — this roadmap is shaped by how our customers actually work.
          </p>
        </div>

      </div>
    </div>
  );
}
