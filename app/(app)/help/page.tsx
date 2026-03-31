"use client";

import Link from "next/link";

const FAQS = [
  {
    q: "How does Jimmy AI learn about my business?",
    a: "When you connect your tools, Jimmy reads your full history — emails, files, invoices, payments — and builds a permanent Company Brain. After that, it automatically picks up new data every hour so it's always current."
  },
  {
    q: "How much does it cost to run?",
    a: "Your AI usage is tracked in Usage & Costs under Settings. A typical day costs less than $1 in AI processing. The dashboard only rebuilds when something important changes, keeping costs low."
  },
  {
    q: "How do I update what Jimmy knows about me?",
    a: "Go to Settings → Company Brain. You can edit any section directly. You can also just tell Jimmy something in the AI Analyst chat and it will automatically update its memory."
  },
  {
    q: "Why is my dashboard not updating?",
    a: "The dashboard only rebuilds when something important happens — a new critical email, a payment, or a significant change. If nothing important happened, it stays the same to save cost. Press Sync Brain to force a refresh."
  },
  {
    q: "How do I connect more tools?",
    a: "Go to Integrations from the sidebar. You can connect Gmail, Microsoft 365, Stripe, and QuickBooks. Each integration gives Jimmy more context about your business."
  },
  {
    q: "What does Sync Brain do?",
    a: "Sync Brain fetches the latest data from all your connected integrations and updates Jimmy's knowledge snapshot. Use it when you want to make sure Jimmy has the most current picture of your business."
  },
  {
    q: "Is my data secure?",
    a: "Yes. Your data is stored securely in Supabase and never shared with third parties. Jimmy only reads your data to generate insights — it never writes to your email, files, or financial accounts."
  },
  {
    q: "How do I get the most out of the AI Analyst?",
    a: "Ask specific questions about your business. The more context you've added to your Company Brain and the more integrations you've connected, the more accurate and useful the answers will be."
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight">Help</h1>
          <p className="text-white/30 text-sm mt-1">Everything you need to get the most out of Jimmy AI.</p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { label: "Connect Integrations", href: "/integrations", desc: "Add your business tools" },
            { label: "Company Brain", href: "/settings", desc: "Update what Jimmy knows" },
            { label: "AI Analyst", href: "/chat", desc: "Ask anything about your business" },
          ].map((link, i) => (
            <Link key={i} href={link.href}
              className="bg-white/[0.03] border border-white/[0.06] hover:border-white/20 rounded-2xl p-5 transition">
              <p className="text-sm font-semibold mb-1">{link.label}</p>
              <p className="text-white/30 text-xs">{link.desc}</p>
            </Link>
          ))}
        </div>

        {/* FAQs */}
        <div className="space-y-3">
          <p className="text-xs text-white/30 uppercase tracking-widest mb-4">Frequently Asked Questions</p>
          {FAQS.map((faq, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-sm font-semibold text-white mb-2">{faq.q}</p>
              <p className="text-sm text-white/40 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-white mb-1">Need more help?</p>
          <p className="text-white/30 text-xs mb-4">Reach out and we'll get back to you within 24 hours.</p>
          <a href="mailto:joey@myjimmy.ai"
            className="inline-block bg-white text-black font-semibold px-6 py-2.5 rounded-xl hover:bg-white/90 transition text-sm">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
