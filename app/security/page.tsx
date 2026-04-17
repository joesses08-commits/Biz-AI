import Link from "next/link";

export default function SecurityPage() {
  return (
    <div style={{ background: "#080808", color: "#f0ede8", fontFamily: "'DM Sans', sans-serif", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Playfair+Display:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .label { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #444; font-weight: 500; }
      `}</style>

      {/* Nav */}
      <nav style={{ padding: "24px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #111" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
          <div style={{ width: "28px", height: "28px", background: "#f0ede8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <line x1="24" y1="8" x2="24" y2="26" stroke="#080808" strokeWidth="4" strokeLinecap="round"/>
              <path d="M24 26 Q24 34 18 35 Q11 36 10 30" fill="none" stroke="#080808" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: "15px", fontWeight: "500", color: "#f0ede8" }}>Jimmy</span>
        </Link>
        <Link href="/" style={{ fontSize: "13px", color: "#555", textDecoration: "none" }}>← Back to home</Link>
      </nav>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "80px 48px" }}>

        {/* Header */}
        <div style={{ marginBottom: "72px" }}>
          <span className="label">Security</span>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px, 5vw, 64px)", fontWeight: "400", marginTop: "16px", lineHeight: "1.05", letterSpacing: "-0.02em" }}>
            Built for businesses that<br /><span style={{ fontStyle: "italic", color: "#777" }}>can't afford a breach.</span>
          </h1>
          <p style={{ fontSize: "16px", color: "#666", marginTop: "24px", lineHeight: "1.7", fontWeight: "300", maxWidth: "560px" }}>
            Jimmy manages your product data, factory relationships, pricing, and purchase orders. We take that responsibility seriously.
          </p>
        </div>

        {/* Key differentiators */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1px", background: "#111", marginBottom: "80px" }}>
          {[
            { label: "US-only servers", desc: "All data stored on AWS us-east-1. No foreign government access." },
            { label: "Factory isolation", desc: "Each factory sees only the products you share with them. Nothing else." },
            { label: "Invitation only", desc: "No self-signup. Every account is created by us personally." },
          ].map((item) => (
            <div key={item.label} style={{ padding: "36px", background: "#0a0a0a" }}>
              <div style={{ fontSize: "13px", fontWeight: "500", color: "#f0ede8", marginBottom: "8px" }}>{item.label}</div>
              <div style={{ fontSize: "13px", color: "#666", lineHeight: "1.6", fontWeight: "300" }}>{item.desc}</div>
            </div>
          ))}
        </div>

        {/* Sections */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px" }}>

          {/* Encryption */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "32px", height: "32px", background: "#0f0f0f", border: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <h2 style={{ fontSize: "15px", fontWeight: "500" }}>Encryption</h2>
            </div>
            <div style={{ fontSize: "13px", color: "#666", lineHeight: "1.8", fontWeight: "300" }}>
              <p style={{ marginBottom: "8px" }}>All data is encrypted in transit using TLS 1.3 — the same standard used by banks.</p>
              <p style={{ marginBottom: "8px" }}>All data is encrypted at rest using AES-256 — the US government standard for classified information.</p>
              <p>Encryption is enforced at the infrastructure level by Supabase and cannot be disabled.</p>
            </div>
          </div>

          {/* Access Control */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "32px", height: "32px", background: "#0f0f0f", border: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h2 style={{ fontSize: "15px", fontWeight: "500" }}>Access Control</h2>
            </div>
            <div style={{ fontSize: "13px", color: "#666", lineHeight: "1.8", fontWeight: "300" }}>
              <p style={{ marginBottom: "8px" }}>Row-level security means every database query is scoped to your account. It is technically impossible for one user to access another user's data.</p>
              <p style={{ marginBottom: "8px" }}>Factory portal users have strictly limited access — they can only see and update products you've explicitly assigned to them.</p>
              <p>No Jimmy employee can read your business data. Access to the database is logged and audited.</p>
            </div>
          </div>

          {/* Admin PIN */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "32px", height: "32px", background: "#0f0f0f", border: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h2 style={{ fontSize: "15px", fontWeight: "500" }}>Admin PIN</h2>
            </div>
            <div style={{ fontSize: "13px", color: "#666", lineHeight: "1.8", fontWeight: "300" }}>
              <p style={{ marginBottom: "8px" }}>Sensitive actions require your Admin PIN: approving samples, killing products, generating POs.</p>
              <p style={{ marginBottom: "8px" }}>Your PIN is hashed using SHA-256 — we cannot see or recover it. You can only reset via email.</p>
              <p>Sessions automatically expire after 8 hours of inactivity.</p>
            </div>
          </div>

          {/* Factory Portal */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "32px", height: "32px", background: "#0f0f0f", border: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <h2 style={{ fontSize: "15px", fontWeight: "500" }}>Factory Portal</h2>
            </div>
            <div style={{ fontSize: "13px", color: "#666", lineHeight: "1.8", fontWeight: "300" }}>
              <p style={{ marginBottom: "8px" }}>Factories log into a separate portal at portal.myjimmy.ai with credentials you create for them.</p>
              <p style={{ marginBottom: "8px" }}>They cannot see your pricing, margins, other factories, or any products not assigned to them.</p>
              <p>You can revoke factory access instantly from Factory Access in Product Lifecycle.</p>
            </div>
          </div>

          {/* Infrastructure */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "32px", height: "32px", background: "#0f0f0f", border: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
              </div>
              <h2 style={{ fontSize: "15px", fontWeight: "500" }}>Infrastructure</h2>
            </div>
            <div style={{ fontSize: "13px", color: "#666", lineHeight: "1.8", fontWeight: "300" }}>
              <p style={{ marginBottom: "8px" }}>Jimmy runs on Vercel — used by thousands of enterprise companies including Airbnb, GitHub, and The Washington Post.</p>
              <p style={{ marginBottom: "8px" }}>Data is stored on Supabase, which is SOC 2 Type II certified and runs on AWS in the United States.</p>
              <p>No data is ever stored outside the United States.</p>
            </div>
          </div>

          {/* Audit Logging */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "32px", height: "32px", background: "#0f0f0f", border: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <h2 style={{ fontSize: "15px", fontWeight: "500" }}>Audit Logging</h2>
            </div>
            <div style={{ fontSize: "13px", color: "#666", lineHeight: "1.8", fontWeight: "300" }}>
              <p style={{ marginBottom: "8px" }}>Every sensitive action in Jimmy is logged — who did it, when, and from which IP address.</p>
              <p style={{ marginBottom: "8px" }}>Logged actions include: sample stage updates, PO generation, sample approvals, factory portal logins, and PIN verifications.</p>
              <p>Audit logs are stored securely and cannot be modified or deleted.</p>
            </div>
          </div>

          {/* Email Security */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "32px", height: "32px", background: "#0f0f0f", border: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <h2 style={{ fontSize: "15px", fontWeight: "500" }}>Email Integrations</h2>
            </div>
            <div style={{ fontSize: "13px", color: "#666", lineHeight: "1.8", fontWeight: "300" }}>
              <p style={{ marginBottom: "8px" }}>Gmail and Outlook integrations use OAuth 2.0 — the industry standard. We never see or store your email password.</p>
              <p style={{ marginBottom: "8px" }}>OAuth tokens are encrypted. You can revoke Jimmy's access from your Google or Microsoft account at any time.</p>
              <p>We request only the minimum permissions necessary to send emails on your behalf.</p>
            </div>
          </div>

          {/* Incident Response */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "32px", height: "32px", background: "#0f0f0f", border: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <h2 style={{ fontSize: "15px", fontWeight: "500" }}>Incident Response</h2>
            </div>
            <div style={{ fontSize: "13px", color: "#666", lineHeight: "1.8", fontWeight: "300" }}>
              <p style={{ marginBottom: "8px" }}>In the event of a security incident, affected customers will be notified within 72 hours.</p>
              <p style={{ marginBottom: "8px" }}>Notifications will include what data was affected, what we are doing about it, and what you should do.</p>
              <p>To report a security vulnerability, email joey@myjimmy.ai with the subject "Security Vulnerability."</p>
            </div>
          </div>

        </div>

        {/* Footer CTA */}
        <div style={{ marginTop: "80px", padding: "48px", background: "#0a0a0a", border: "1px solid #161616", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", fontWeight: "400", marginBottom: "12px" }}>Questions about security?</h2>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "24px", fontWeight: "300" }}>We're happy to answer any questions your team has.</p>
          <a href="mailto:joey@myjimmy.ai" style={{ display: "inline-block", background: "#f0ede8", color: "#080808", padding: "12px 28px", fontSize: "13px", fontWeight: "500", textDecoration: "none" }}>
            Contact Us →
          </a>
        </div>

      </div>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #111", padding: "32px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "13px", color: "#555", fontWeight: "300" }}>© 2026 Jimmy. All rights reserved.</span>
        <div style={{ display: "flex", gap: "32px" }}>
          <Link href="/privacy" style={{ fontSize: "13px", color: "#555", textDecoration: "none" }}>Privacy</Link>
          <Link href="/terms" style={{ fontSize: "13px", color: "#555", textDecoration: "none" }}>Terms</Link>
          <Link href="/login" style={{ fontSize: "13px", color: "#555", textDecoration: "none" }}>Client Login →</Link>
        </div>
      </footer>
    </div>
  );
}
