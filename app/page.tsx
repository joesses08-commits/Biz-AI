"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const integrations = [
  { name: "Gmail" },{ name: "QuickBooks" },{ name: "Stripe" },{ name: "Slack" },{ name: "Zoom" },{ name: "HubSpot" },{ name: "Salesforce" },{ name: "Microsoft 365" },{ name: "Shopify" },{ name: "Xero" },{ name: "Notion" },{ name: "Linear" },
];

const features = [
  { title: "Daily Executive Briefing", description: "Every morning, your AI COO reads every metric, email thread, and data point — then delivers a single crisp brief. What matters. What to do. Nothing else.", stat: "2 min", statLabel: "avg. daily brief" },
  { title: "Proactive Alerts", description: "Don't wait for problems to become crises. BizAI monitors your revenue, costs, pipeline, and team performance in real time — and tells you before things go wrong.", stat: "48hr", statLabel: "avg. early warning" },
  { title: "Full Integration Layer", description: "Connect Gmail, QuickBooks, Stripe, Slack, Zoom, and more in minutes. One click per platform. Your entire business in one place.", stat: "15+", statLabel: "native integrations" },
  { title: "Team Intelligence", description: "Role-based dashboards for every level of your org. The CEO sees everything. Managers see their scope. Employees see their work. Everyone stays aligned.", stat: "∞", statLabel: "team members" },
];

const tiers = [
  { name: "Starter", price: "$299", description: "For founders and small teams ready to get clarity.", features: ["AI daily briefings", "Up to 3 integrations", "5 team members", "Dashboard & analytics", "Email support"], highlighted: false },
  { name: "Growth", price: "$999", description: "For scaling businesses that need deeper intelligence.", features: ["Everything in Starter", "Up to 10 integrations", "25 team members", "Predictive forecasting", "Dedicated onboarding"], highlighted: true },
  { name: "Professional", price: "$2,500", description: "For established companies demanding enterprise-grade ops.", features: ["Everything in Growth", "Unlimited integrations", "Unlimited team members", "Custom AI workflows", "Priority support"], highlighted: false },
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
        .tier-card { border: 1px solid #161616; padding: 40px; background: #0a0a0a; transition: all 0.3s; }
        .tier-card:hover { border-color: #2a2a2a; transform: translateY(-2px); }
        .tier-card.highlighted { border-color: #f0ede8; background: #0f0f0f; }
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L13 7L7 13M1 7H13" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontSize: "15px", fontWeight: "500", letterSpacing: "0.02em" }}>BizAI</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "36px" }}>
          <a href="#features" className="nav-link">Product</a>
          <a href="#pricing" className="nav-link">Pricing</a>
          <a href="#integrations" className="nav-link">Integrations</a>
          <Link href="/login" className="nav-link">Sign In</Link>
          <a href="#contact" className="btn-primary" style={{ padding: "9px 20px", fontSize: "13px" }}>Book a Demo</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 48px 80px", textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)", backgroundSize: "80px 80px", opacity: 0.3, maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 40%, transparent 100%)" }} />
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)", width: "600px", height: "400px", background: "radial-gradient(ellipse, rgba(240,237,232,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: "820px" }}>
          <div className="fade-up d1"><span className="label">AI-Powered Business Intelligence</span></div>
          <h1 className="fade-up d2" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(48px, 7vw, 88px)", fontWeight: "400", lineHeight: "1.05", letterSpacing: "-0.02em", margin: "24px 0 28px", color: "#f0ede8" }}>
            Your business,{" "}<span style={{ fontStyle: "italic", color: "#888" }}>fully</span><br />understood.
          </h1>
          <p className="fade-up d3" style={{ fontSize: "18px", color: "#555", lineHeight: "1.7", maxWidth: "520px", margin: "0 auto 40px", fontWeight: "300" }}>
            An AI COO that connects every platform you run on — and briefs your leadership team every morning with exactly what matters.
          </p>
          <div className="fade-up d4" style={{ display: "flex", gap: "12px", justifyContent: "center", alignItems: "center" }}>
            <a href="#contact" className="btn-primary">Book a Demo</a>
            <a href="#features" className="btn-ghost">See how it works</a>
          </div>
          <div className="fade-up d4" style={{ marginTop: "80px", display: "flex", gap: "48px", justifyContent: "center", alignItems: "center" }}>
            {[["$1M+", "ARR tracked"], ["15+", "Integrations"], ["60s", "Setup time"]].map(([stat, label]) => (
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

      {/* Features */}
      <section id="features" style={{ padding: "120px 48px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "72px" }}>
          <span className="label">The Platform</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: "400", marginTop: "16px", lineHeight: "1.1", letterSpacing: "-0.02em", maxWidth: "480px" }}>
            Built for operators,<br /><span style={{ fontStyle: "italic", color: "#555" }}>not analysts.</span>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1px", background: "#111" }}>
          {features.map((f) => (
            <div key={f.title} className="feature-card">
              <div style={{ fontSize: "36px", fontFamily: "'Playfair Display', serif", fontWeight: "400", color: "#f0ede8", marginBottom: "4px" }}>{f.stat}</div>
              <div className="label" style={{ marginBottom: "24px" }}>{f.statLabel}</div>
              <h3 style={{ fontSize: "18px", fontWeight: "500", marginBottom: "12px", color: "#f0ede8", letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p style={{ fontSize: "14px", color: "#555", lineHeight: "1.7", fontWeight: "300" }}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: "120px 48px", borderTop: "1px solid #111", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "72px" }}>
          <span className="label">The Process</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: "400", marginTop: "16px", lineHeight: "1.1", letterSpacing: "-0.02em" }}>Live in a day.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", background: "#111" }}>
          {[
            { step: "01", title: "Book a call", desc: "We learn your business and set up your workspace in 30 minutes." },
            { step: "02", title: "Connect your tools", desc: "One click per platform. Gmail, QuickBooks, Stripe — all connected instantly." },
            { step: "03", title: "Invite your team", desc: "Add your leadership team. Set roles and permissions. Everyone sees their scope." },
            { step: "04", title: "Get briefed daily", desc: "Every morning, your AI COO tells you exactly what needs your attention." },
          ].map((s) => (
            <div key={s.step} style={{ padding: "40px", background: "#0a0a0a" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "48px", color: "#1a1a1a", fontWeight: "400", lineHeight: "1", marginBottom: "24px" }}>{s.step}</div>
              <h3 style={{ fontSize: "16px", fontWeight: "500", marginBottom: "12px", color: "#f0ede8" }}>{s.title}</h3>
              <p style={{ fontSize: "13px", color: "#444", lineHeight: "1.7", fontWeight: "300" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: "120px 48px", borderTop: "1px solid #111", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "72px" }}>
          <span className="label">Pricing</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: "400", marginTop: "16px", letterSpacing: "-0.02em" }}>Straightforward.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "#111" }}>
          {tiers.map((tier) => (
            <div key={tier.name} className={`tier-card ${tier.highlighted ? "highlighted" : ""}`}>
              {tier.highlighted && <div className="label" style={{ marginBottom: "16px", color: "#f0ede8" }}>Most Popular</div>}
              <div className="label" style={{ marginBottom: "8px" }}>{tier.name}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "48px", fontWeight: "400", color: "#f0ede8", lineHeight: "1", marginBottom: "8px" }}>{tier.price}</div>
              <div style={{ fontSize: "13px", color: "#444", marginBottom: "32px", fontWeight: "300" }}>per month</div>
              <p style={{ fontSize: "14px", color: "#555", marginBottom: "32px", lineHeight: "1.6", fontWeight: "300" }}>{tier.description}</p>
              <div style={{ borderTop: "1px solid #161616", paddingTop: "24px", marginBottom: "32px" }}>
                {tier.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", fontSize: "13px", color: "#666", fontWeight: "300" }}>
                    <div style={{ width: "4px", height: "4px", background: "#333", flexShrink: 0 }} />
                    {f}
                  </div>
                ))}
              </div>
              <a href="#contact" className={tier.highlighted ? "btn-primary" : "btn-ghost"} style={{ width: "100%", textAlign: "center", display: "block" }}>Book a Demo</a>
            </div>
          ))}
        </div>
        <p style={{ marginTop: "32px", textAlign: "center", fontSize: "13px", color: "#333", fontWeight: "300" }}>Enterprise pricing available for larger organizations. Contact us.</p>
      </section>

      {/* CTA */}
      <section id="contact" style={{ padding: "120px 48px", borderTop: "1px solid #111", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "800px", height: "400px", background: "radial-gradient(ellipse, rgba(240,237,232,0.03) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: "560px", margin: "0 auto" }}>
          <span className="label">Get Started</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px, 5vw, 64px)", fontWeight: "400", margin: "20px 0 24px", lineHeight: "1.05", letterSpacing: "-0.02em" }}>
            Ready to meet your<br /><span style={{ fontStyle: "italic", color: "#555" }}>AI COO?</span>
          </h2>
          <p style={{ fontSize: "16px", color: "#444", marginBottom: "40px", lineHeight: "1.7", fontWeight: "300" }}>
            We onboard every client personally. Book a 30-minute call and we'll show you exactly what BizAI looks like for your business.
          </p>
          <a href="mailto:jo.esses08@gmail.com" className="btn-primary" style={{ fontSize: "15px", padding: "16px 36px" }}>Book a Demo →</a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #111", padding: "32px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "13px", color: "#333", fontWeight: "300" }}>© 2026 BizAI. All rights reserved.</span>
        <Link href="/login" style={{ fontSize: "13px", color: "#333", textDecoration: "none" }}>Client Login →</Link>
      </footer>
    </div>
  );
}
