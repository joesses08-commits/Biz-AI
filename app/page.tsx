"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const integrations = [
  { name: "Gmail" }, { name: "Outlook" }, { name: "Google Sheets" }, { name: "Google Drive" },
  { name: "Microsoft Excel" }, { name: "OneDrive" }, { name: "QuickBooks" }, { name: "Stripe" },
];

const features = [
  {
    title: "Product Lifecycle Management",
    description: "Every SKU tracked from concept to shelf. Move products through development stages, manage sample rounds per factory, approve or revise with one click, and issue production orders — all in one place.",
    stat: "100%",
    statLabel: "sourcing visibility",
  },
  {
    title: "Factory Quote Automation",
    description: "Upload your product list. Jimmy emails your factories, collects their quotes, and builds a comparison sheet automatically — highlighting the best price per product and your margin at every price point.",
    stat: "10x",
    statLabel: "faster than spreadsheets",
  },
  {
    title: "Sample Tracking & Factory Portal",
    description: "Request samples from multiple factories simultaneously. Factories update their progress directly in their own portal — production, shipped, arrived. You see every round, every revision, every decision in one timeline.",
    stat: "0",
    statLabel: "missed sample updates",
  },
  {
    title: "AI Command Center",
    description: "Jimmy reads your emails, invoices, and production pipeline and tells you what actually needs your attention today. Not a summary — specific risks, opportunities, and next steps based on your real data.",
    stat: "Daily",
    statLabel: "AI briefings",
  },
  {
    title: "PO Generator",
    description: "Generate professional purchase orders in seconds. Select products, set quantities, pick your factory — Jimmy builds the PO and emails it directly to the factory from your Gmail or Outlook.",
    stat: "60s",
    statLabel: "from approved to PO sent",
  },
  {
    title: "Ask Jimmy Anything",
    description: "One chat window connected to your entire operation. Ask about products, factories, invoices, emails. Jimmy answers using your actual data — not generic advice.",
    stat: "∞",
    statLabel: "questions answered",
  },
];

const workflow = [
  { step: "01", title: "Send RFQs automatically", desc: "Upload your product list. Jimmy emails every factory, collects quotes, and builds your comparison sheet." },
  { step: "02", title: "Track samples in real time", desc: "Factories update their portal as samples move through production, shipping, and arrival. You see everything live." },
  { step: "03", title: "Issue POs in seconds", desc: "Sample approved? Jimmy generates the PO, emails the factory, and logs the order — all from one screen." },
  { step: "04", title: "Monitor from your dashboard", desc: "Every product, every order, every factory — tracked automatically. Jimmy tells you what needs attention today." },
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
        .marquee-track { animation: marquee 30s linear infinite; display: flex; gap: 12px; }
        .integration-pill { border: 1px solid #1a1a1a; padding: 10px 18px; font-size: 13px; color: #555; letter-spacing: 0.03em; white-space: nowrap; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "20px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: scrollY > 50 ? "1px solid #111" : "1px solid transparent", background: scrollY > 50 ? "rgba(8,8,8,0.95)" : "transparent", backdropFilter: scrollY > 50 ? "blur(12px)" : "none", transition: "all 0.3s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "28px", height: "28px", background: "#f0ede8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <line x1="24" y1="8" x2="24" y2="26" stroke="#080808" strokeWidth="4" strokeLinecap="round"/>
              <path d="M24 26 Q24 34 18 35 Q11 36 10 30" fill="none" stroke="#080808" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: "15px", fontWeight: "500", letterSpacing: "0.02em" }}>Jimmy</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "36px" }}>
          <a href="#how-it-works" className="nav-link">How It Works</a>
          <a href="#features" className="nav-link">Features</a>
          <a href="#integrations" className="nav-link">Integrations</a>
          <Link href="/login" className="nav-link">Sign In</Link>
          <a href="mailto:jo.esses08@gmail.com" className="btn-primary" style={{ padding: "9px 20px", fontSize: "13px" }}>Request Access</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 48px 80px", textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)", backgroundSize: "80px 80px", opacity: 0.3, maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 40%, transparent 100%)" }} />
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)", width: "600px", height: "400px", background: "radial-gradient(ellipse, rgba(240,237,232,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: "820px" }}>
          <div className="fade-up d1"><span className="label">For wholesale product businesses</span></div>
          <h1 className="fade-up d2" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(48px, 7vw, 88px)", fontWeight: "400", lineHeight: "1.05", letterSpacing: "-0.02em", margin: "24px 0 28px", color: "#f0ede8" }}>
            Your sourcing operation,{" "}<br /><span style={{ fontStyle: "italic", color: "#888" }}>on autopilot.</span>
          </h1>
          <p className="fade-up d3" style={{ fontSize: "18px", color: "#777", lineHeight: "1.7", maxWidth: "560px", margin: "0 auto 40px", fontWeight: "300" }}>
            Jimmy connects your factories, samples, orders, emails, and financials into one AI-powered system — so your team spends less time managing spreadsheets and more time building the business.
          </p>
          <div className="fade-up d4" style={{ display: "flex", gap: "12px", justifyContent: "center", alignItems: "center" }}>
            <a href="mailto:jo.esses08@gmail.com" className="btn-primary">Request Access</a>
            <a href="#how-it-works" className="btn-ghost">See how it works</a>
          </div>
          <div className="fade-up d4" style={{ marginTop: "80px", display: "flex", gap: "48px", justifyContent: "center", alignItems: "center" }}>
            {[["RFQ to PO", "Fully automated"], ["One platform", "Factory to finance"], ["Invitation only", "Beta access"]].map(([stat, label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: "300", fontFamily: "'Playfair Display', serif", color: "#f0ede8" }}>{stat}</div>
                <div className="label" style={{ marginTop: "4px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The problem */}
      <section style={{ padding: "120px 48px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "48px" }}>
          <span className="label">The Problem</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px, 3vw, 42px)", fontWeight: "400", marginTop: "16px", lineHeight: "1.2", letterSpacing: "-0.02em", maxWidth: "560px", color: "#f0ede8" }}>
            Wholesale runs on too many<br /><span style={{ fontStyle: "italic", color: "#777" }}>disconnected tools.</span>
          </h2>
          <p style={{ fontSize: "15px", color: "#666", lineHeight: "1.7", maxWidth: "520px", marginTop: "20px", fontWeight: "300" }}>
            Your RFQs are in email threads. Your samples are tracked in spreadsheets. Your orders are in one system, your invoices in another. Nothing talks to each other — so your team spends half their day managing information instead of making decisions.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1px", background: "#111", marginTop: "60px" }}>
          {[
            { before: "RFQs sent manually by email", after: "Automated — Jimmy emails every factory" },
            { before: "Samples tracked in spreadsheets", after: "Live factory portal with real-time updates" },
            { before: "POs built in Word or Excel", after: "Generated and sent in 60 seconds" },
          ].map((item) => (
            <div key={item.before} style={{ background: "#0a0a0a", padding: "36px" }}>
              <div style={{ fontSize: "13px", color: "#555", marginBottom: "8px", fontWeight: "300", textDecoration: "line-through" }}>{item.before}</div>
              <div style={{ fontSize: "16px", color: "#f0ede8", fontWeight: "500" }}>{item.after}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ padding: "0 48px 120px", borderTop: "1px solid #111", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "72px", paddingTop: "120px" }}>
          <span className="label">How It Works</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: "400", marginTop: "16px", lineHeight: "1.1", letterSpacing: "-0.02em" }}>
            From RFQ to shelf,<br /><span style={{ fontStyle: "italic", color: "#777" }}>automated.</span>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", background: "#111" }}>
          {workflow.map((s) => (
            <div key={s.step} style={{ padding: "40px", background: "#0a0a0a" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "48px", color: "#1a1a1a", fontWeight: "400", lineHeight: "1", marginBottom: "24px" }}>{s.step}</div>
              <h3 style={{ fontSize: "16px", fontWeight: "500", marginBottom: "12px", color: "#f0ede8" }}>{s.title}</h3>
              <p style={{ fontSize: "13px", color: "#666", lineHeight: "1.7", fontWeight: "300" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: "0 48px 120px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "72px" }}>
          <span className="label">The Platform</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: "400", marginTop: "16px", lineHeight: "1.1", letterSpacing: "-0.02em", maxWidth: "480px" }}>
            Everything your team needs.<br /><span style={{ fontStyle: "italic", color: "#777" }}>Nothing they don't.</span>
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

      {/* Integrations */}
      <section id="integrations" style={{ borderTop: "1px solid #111", borderBottom: "1px solid #111", padding: "80px 48px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto 48px" }}>
          <span className="label">Integrations</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px, 3vw, 42px)", fontWeight: "400", marginTop: "16px", lineHeight: "1.2", letterSpacing: "-0.02em", maxWidth: "480px" }}>
            Connects to the tools<br /><span style={{ fontStyle: "italic", color: "#777" }}>you already use.</span>
          </h2>
        </div>
        <div style={{ overflow: "hidden" }}>
          <div className="marquee-track">
            {[...integrations, ...integrations].map((item, i) => (
              <div key={i} className="integration-pill">{item.name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: "120px 48px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "72px", textAlign: "center" }}>
          <span className="label">Pricing</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: "400", marginTop: "16px", lineHeight: "1.1", letterSpacing: "-0.02em" }}>
            Simple, transparent pricing.
          </h2>
          <p style={{ fontSize: "15px", color: "#666", marginTop: "16px", fontWeight: "300" }}>Currently in invite-only beta. Early clients receive preferred pricing.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "#111" }}>
          {[
            { name: "Starter", price: "$299", per: "/month", desc: "For small teams getting started with sourcing automation.", features: ["Product Lifecycle Management", "Factory Quote Automation", "Sample Tracking", "PO Generator", "AI Dashboard & Chat", "Gmail + Outlook"] },
            { name: "Growth", price: "$999", per: "/month", desc: "For growing wholesale teams managing multiple collections.", features: ["Everything in Starter", "Unlimited products & factories", "Designer portal access", "QuickBooks + Stripe", "Priority support", "Advanced analytics"], highlight: true },
            { name: "Enterprise", price: "$4,999", per: "/month", desc: "For established wholesale operations that need full control.", features: ["Everything in Growth", "Custom integrations", "Dedicated onboarding", "SLA guarantee", "Team training", "Custom workflows"] },
          ].map((plan) => (
            <div key={plan.name} style={{ padding: "48px 40px", background: plan.highlight ? "#0f0f0f" : "#0a0a0a", borderTop: plan.highlight ? "2px solid #f0ede8" : "none" }}>
              <div style={{ marginBottom: "24px" }}>
                <div style={{ fontSize: "13px", color: "#555", marginBottom: "8px", letterSpacing: "0.1em", textTransform: "uppercase" }}>{plan.name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "42px", fontWeight: "400", color: "#f0ede8" }}>{plan.price}</span>
                  <span style={{ color: "#555", fontSize: "14px" }}>{plan.per}</span>
                </div>
                <p style={{ fontSize: "13px", color: "#666", marginTop: "12px", lineHeight: "1.6", fontWeight: "300" }}>{plan.desc}</p>
              </div>
              <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "24px", marginBottom: "32px" }}>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="#444" strokeWidth="2" strokeLinecap="round"/></svg>
                    <span style={{ fontSize: "13px", color: "#666", fontWeight: "300" }}>{f}</span>
                  </div>
                ))}
              </div>
              <a href="mailto:jo.esses08@gmail.com" className={plan.highlight ? "btn-primary" : "btn-ghost"} style={{ display: "block", textAlign: "center", width: "100%" }}>Request Access</a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "120px 48px", borderTop: "1px solid #111", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "800px", height: "400px", background: "radial-gradient(ellipse, rgba(240,237,232,0.03) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: "560px", margin: "0 auto" }}>
          <span className="label">Get Started</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px, 5vw, 64px)", fontWeight: "400", margin: "20px 0 24px", lineHeight: "1.05", letterSpacing: "-0.02em" }}>
            Ready to automate<br /><span style={{ fontStyle: "italic", color: "#777" }}>your sourcing?</span>
          </h2>
          <p style={{ fontSize: "16px", color: "#666", marginBottom: "40px", lineHeight: "1.7", fontWeight: "300" }}>
            Jimmy is invite-only. We onboard every client personally and make sure the platform is set up correctly for your operation before you go live.
          </p>
          <a href="mailto:jo.esses08@gmail.com" className="btn-primary" style={{ fontSize: "15px", padding: "16px 36px" }}>Request Access →</a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #111", padding: "32px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "13px", color: "#555", fontWeight: "300" }}>© 2026 Jimmy. All rights reserved.</span>
        <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
          <Link href="/privacy" style={{ fontSize: "13px", color: "#555", textDecoration: "none" }}>Privacy</Link>
          <Link href="/terms" style={{ fontSize: "13px", color: "#555", textDecoration: "none" }}>Terms</Link>
          <Link href="/login" style={{ fontSize: "13px", color: "#555", textDecoration: "none" }}>Client Login →</Link>
        </div>
      </footer>
    </div>
  );
}
