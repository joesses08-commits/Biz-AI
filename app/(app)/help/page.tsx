"use client";

import Link from "next/link";

const FAQS = [
  {
    q: "How do I add a new factory?",
    a: "Go to Product Lifecycle → Factory Access. Click 'Add Factory' and enter their name, email, and contact person. Once added, you can create portal access so they can update sample and production status themselves."
  },
  {
    q: "How do I request quotes from factories?",
    a: "Go to Workflows → Factory Quote Request. Create a new job, select your factories and upload your product list. Jimmy generates a professional RFQ email with all your product details attached."
  },
  {
    q: "What happens when a factory sends back their quote?",
    a: "Drop the Excel file into the PLM Agent chat. Jimmy automatically extracts all pricing, calculates landed costs (with your tariff/duty/freight settings), and wires the quotes to the right products."
  },
  {
    q: "How do I track sample status?",
    a: "Open any product in Product Lifecycle and expand a factory track. You'll see every stage from quote requested through sample arrived. Factories can update their own status via their portal."
  },
  {
    q: "What is the Factory Portal?",
    a: "Each factory gets their own login at portal.myjimmy.ai. They can update sample progress (production, shipped, etc.), add tracking numbers, and see which products need their attention — without accessing your other data."
  },
  {
    q: "How do I compare quotes across factories?",
    a: "Go to Workflows → Factory Quote Request and open a completed job. The comparison view shows all quotes side-by-side with landed costs calculated. Yellow rows = best price per product."
  },
  {
    q: "What does 'Disqualify' do?",
    a: "When a factory is too slow, too expensive, or doesn't respond, click Disqualify. Jimmy sends them a professional email explaining they weren't selected and removes them from that product's active tracks."
  },
  {
    q: "How do I generate a Purchase Order?",
    a: "After approving a sample, click 'Generate PO' on the approved factory track. Jimmy creates a formatted PO with your negotiated price, terms, and product details, then emails it directly to the factory."
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight">Help</h1>
          <p className="text-white/30 text-sm mt-1">Everything you need to get the most out of Jimmy.</p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { label: "Add Factories", href: "/plm?tab=factory_access", desc: "Manage your factory contacts" },
            { label: "Product Lifecycle", href: "/plm", desc: "Track products & samples" },
            { label: "PLM Agent", href: "/plm/agent", desc: "Ask anything about your products" },
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
