"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const integrations = [
  { name: "Gmail" },{ name: "QuickBooks" },{ name: "Stripe" },{ name: "Slack" },{ name: "Zoom" },{ name: "HubSpot" },{ name: "Salesforce" },{ name: "Microsoft 365" },{ name: "Shopify" },{ name: "Xero" },{ name: "Google Sheets" },{ name: "OneDrive" },{ name: "Outlook" },{ name: "Excel" },{ name: "Notion" },{ name: "Linear" },{ name: "Asana" },{ name: "Plaid" },
];

const features = [
  {
    title: "Qualitative + Quantitative Intelligence",
    description: "Not just your numbers — but what they mean in the context of the real world. Tariffs, competitors, market shifts, employee performance. Jimmy AI connects your internal data with what's happening outside your business.",
    stat: "360°",
    statLabel: "business visibility",
  },
  {
    title: "Ask Anything AI Agent",
    description: "One chat window that knows everything about your business. Ask it anything — \"Why did we lose that client?\" \"Should I hire someone?\" — and it answers using your actual data, not generic advice.",
    stat: "∞",
    statLabel: "questions answered",
  },
  {
    title: "24/7 Live Data Across Every Platform",
    description: "Gmail, Outlook, QuickBooks, Stripe, Slack, Sheets, Excel — all updating in real time. The moment something changes in your business, Jimmy AI knows. No manual reporting. No waiting for the monthly review.",
    stat: "15+",
    statLabel: "live integrations",
  },
  {
    title: "Live Excel & Financial Modeling",
    description: "Connect your actual spreadsheets. Model a new idea, run a scenario, build a pitch deck with live numbers — and send it directly to a buyer or investor without ever leaving Jimmy AI.",
    stat: "60s",
    statLabel: "to model any scenario",
  },
  {
    title: "Company Workflow & Action Tracking",
    description: "Every task, every commitment, every deadline — tracked automatically. The AI pulls action items from emails and meetings and assigns them to the right person. Nothing falls through the cracks.",
    stat: "0",
    statLabel: "missed commitments",
  },
  {
    title: "Zoom Meeting Intelligence",
    description: "Every meeting transcribed, summarized, and turned into action items automatically. Over time Jimmy AI builds a knowledge bank of everything your company has ever decided, discussed, and committed to.",
    stat: "2min",
    statLabel: "avg. meeting brief",
  },
];

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div style={{ background: "#080808", color: "#f0ede8", fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=Playfair+Display:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .nav-link { color: #888; text-decoration: none; font-size: 14px; font-weight: 400; letter-spacing: 0.01em; transition: color 0.2s; }
        .nav-link:hover { color: #f0ede8; }
        .btn-primary { background: #f0ede8; color: #080808; border: none; padding: 13px 28px; font-size: 14px; font-weight: 500; letter-spacing: 0.02em; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; text-decoration: none; display: inline-block; }
        .btn-primary:hover { background: #fff; transform: translateY(-1px); }
        .btn-ghost { background: transparent; color: #888; border: 1px solid #222; padding: 13px 28px; font-size: 14px; font-weight: 400; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; text-decoration: none; display: inline-block; }
        .btn-ghost:hover { border-color: #444; color: #f0ede8; }
        .feature-card { border: 1px solid #161616; padding: 40px; background: #0a0a0a; transition: border-color 0.3s; }
        .feature-card:hover { border-color: #2a2a2a; }
        .label { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #444; font-weight: 500; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.8s ease forwards; }
        .d1 { animation-delay: 0.1s; opacity: 0; } .d2 { animation-delay: 0.25s; opacity: 0; } .d3 { animation-delay: 0.4s; opacity: 0; } .d4 { animation-delay: 0.55s; opacity: 0; }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .marquee-track { animation: marquee 35s linear infinite; display: flex; gap: 12px; }
        .integration-pill { border: 1px solid #1a1a1a; padding: 10px 18px; font-size: 13px; color: #555; letter-spacing: 0.03em; white-space: nowrap; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "20px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: scrollY > 50 ? "1px solid #111" : "1px solid transparent", background: scrollY > 50 ? "rgba(8,8,8,0.95)" : "transparent", backdropFilter: scrollY > 50 ? "blur(12px)" : "none", transition: "all 0.3s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "28px", height: "28px", background: "#f0ede8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L13 7L7 13M1 7H13" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontSize: "15px", fontWeight: "500", letterSpacing: "0.02em" }}>Jimmy AI</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "36px" }}>
          <a href="#features" className="nav-link">Product</a>
          <a href="#integrations" className="nav-link">Integrations</a>
          <a href="#process" className="nav-link">How It Works</a>
          <Link href="/login" className="nav-link">Sign In</Link>
          <a href="#contact" className="btn-primary" style={{ padding: "9px 20px", fontSize: "13px" }}>Book a Demo</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 48px 80px", textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)", backgroundSize: "80px 80px", opacity: 0.3, maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 40%, transparent 100%)" }} />
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)", width: "600px", height: "400px", background: "radial-gradient(ellipse, rgba(240,237,232,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: "820px" }}>
          <div className="fade-up d1"><span className="label">The AI Operating System for Business</span></div>
          <h1 className="fade-up d2" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(48px, 7vw, 88px)", fontWeight: "400", lineHeight: "1.05", letterSpacing: "-0.02em", margin: "24px 0 28px", color: "#f0ede8" }}>
            Your business,{" "}<span style={{ fontStyle: "italic", color: "#888" }}>fully</span><br />understood.
          </h1>
          <p className="fade-up d3" style={{ fontSize: "18px", color: "#777", lineHeight: "1.7", maxWidth: "560px", margin: "0 auto 40px", fontWeight: "300" }}>
            Jimmy AI connects every tool your company runs on and gives you a single AI that knows everything — your numbers, your emails, your meetings, your risks — and tells you exactly what to do.
          </p>
          <div className="fade-up d4" style={{ display: "flex", gap: "12px", justifyContent: "center", alignItems: "center" }}>
            <a href="#contact" className="btn-primary">Book a Demo</a>
            <a href="#features" className="btn-ghost">See how it works</a>
          </div>
          <div className="fade-up d4" style={{ marginTop: "80px", display: "flex", gap: "48px", justifyContent: "center", alignItems: "center" }}>
            {[["Ask anything", "About your business"], ["One platform", "Every tool connected"], ["Daily", "AI briefings"]].map(([stat, label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "28px", fontWeight: "300", fontFamily: "'Playfair Display', serif", color: "#f0ede8" }}>{stat}</div>
                <div className="label" style={{ marginTop: "4px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations marquee */}
      <section id="integrations" style={{ borderTop: "1px solid #111", borderBottom: "1px solid #111", padding: "24px 0", overflow: "hidden" }}>
        <div style={{ overflow: "hidden" }}>
          <div className="marquee-track">
            {[...integrations, ...integrations].map((item, i) => (
              <div key={i} className="integration-pill">{item.name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* What makes it different */}
      <section style={{ padding: "120px 48px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "48px" }}>
          <span className="label">Why Jimmy AI</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px, 3vw, 42px)", fontWeight: "400", marginTop: "16px", lineHeight: "1.2", letterSpacing: "-0.02em", maxWidth: "560px", color: "#f0ede8" }}>
            Every business generates enormous data.<br /><span style={{ fontStyle: "italic", color: "#777" }}>Nobody can make sense of it.</span>
          </h2>
          <p style={{ fontSize: "15px", color: "#666", lineHeight: "1.7", maxWidth: "520px", marginTop: "20px", fontWeight: "300" }}>
            Your revenue is in Stripe. Your invoices are in QuickBooks. Your emails are in Gmail. Your decisions are in Zoom calls. None of these tools talk to each other — so you never see the full picture. Jimmy AI connects everything and tells you what it means.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1px", background: "#111", marginTop: "60px" }}>
          {[
            { before: "Separate tools", after: "One intelligent platform", icon: "→" },
            { before: "Monthly reports", after: "Real-time intelligence", icon: "→" },
            { before: "Expensive exec team", after: "AI COO for a fraction of the cost", icon: "→" },
          ].map((item) => (
            <div key={item.before} style={{ background: "#0a0a0a", padding: "36px" }}>
              <div style={{ fontSize: "13px", color: "#555", marginBottom: "8px", fontWeight: "300", textDecoration: "line-through" }}>{item.before}</div>
              <div style={{ fontSize: "16px", color: "#f0ede8", fontWeight: "500" }}>{item.after}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: "0 48px 120px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "72px" }}>
          <span className="label">The Platform</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: "400", marginTop: "16px", lineHeight: "1.1", letterSpacing: "-0.02em", maxWidth: "480px" }}>
            Built for operators,<br /><span style={{ fontStyle: "italic", color: "#777" }}>not analysts.</span>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1px", background: "#111" }}>
          {features.map((f) => (
            <div key={f.title} className="feature-card">
              <div style={{ fontSize: "36px", fontFamily: "'Playfair Display', serif", fontWeight: "400", color: "#f0ede8", marginBottom: "4px" }}>{f.stat}</div>
              <div className="label" style={{ marginBottom: "24px" }}>{f.statLabel}</div>
              <h3 style={{ fontSize: "18px", fontWeight: "500", marginBottom: "12px", color: "#f0ede8", letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p style={{ fontSize: "14px", color: "#777", lineHeight: "1.7", fontWeight: "300" }}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="process" style={{ padding: "120px 48px", borderTop: "1px solid #111", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "72px" }}>
          <span className="label">The Process</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: "400", marginTop: "16px", lineHeight: "1.1", letterSpacing: "-0.02em" }}>Live in a day.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", background: "#111" }}>
          {[
            { step: "01", title: "Book a call", desc: "We personally onboard every client. 30 minutes and your workspace is ready." },
            { step: "02", title: "Connect your tools", desc: "One click per platform. Gmail, QuickBooks, Stripe, Outlook — all live instantly." },
            { step: "03", title: "Invite your team", desc: "Add your leadership. Set roles. The CEO sees everything. Everyone sees their scope." },
            { step: "04", title: "Get briefed daily", desc: "Every morning your AI COO tells you exactly what needs your attention. Nothing else." },
          ].map((s) => (
            <div key={s.step} style={{ padding: "40px", background: "#0a0a0a" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "48px", color: "#1a1a1a", fontWeight: "400", lineHeight: "1", marginBottom: "24px" }}>{s.step}</div>
              <h3 style={{ fontSize: "16px", fontWeight: "500", marginBottom: "12px", color: "#f0ede8" }}>{s.title}</h3>
              <p style={{ fontSize: "13px", color: "#666", lineHeight: "1.7", fontWeight: "300" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>



      {/* CTA */}
      <section id="contact" style={{ padding: "120px 48px", borderTop: "1px solid #111", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "800px", height: "400px", background: "radial-gradient(ellipse, rgba(240,237,232,0.03) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: "560px", margin: "0 auto" }}>
          <span className="label">Get Started</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px, 5vw, 64px)", fontWeight: "400", margin: "20px 0 24px", lineHeight: "1.05", letterSpacing: "-0.02em" }}>
            Ready to meet your<br /><span style={{ fontStyle: "italic", color: "#777" }}>AI COO?</span>
          </h2>
          <p style={{ fontSize: "16px", color: "#666", marginBottom: "40px", lineHeight: "1.7", fontWeight: "300" }}>
            We onboard every client personally. Book a 30-minute call and we'll show you exactly what Jimmy AI looks like running on your business.
          </p>
          <a href="mailto:jo.esses08@gmail.com" className="btn-primary" style={{ fontSize: "15px", padding: "16px 36px" }}>Book a Demo →</a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #111", padding: "32px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "13px", color: "#555", fontWeight: "300" }}>© 2026 Jimmy AI. All rights reserved.</span>
        <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
          <Link href="/login" style={{ fontSize: "13px", color: "#555", textDecoration: "none" }}>Client Login →</Link>
        </div>
      </footer>
    </div>
  );
}
