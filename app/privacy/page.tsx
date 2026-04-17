"use client";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

function BackButton() {
  const [href, setHref] = useState("/");
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setHref("/plm");
    });
  }, []);
  return <a href={href} className="text-white/30 text-sm hover:text-white transition">← Back</a>;
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <BackButton />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-white/30 text-sm mb-12">Last updated: April 16, 2026</p>

        <div className="space-y-10 text-white/60 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Introduction</h2>
            <p>Jimmy AI ("we," "our," or "us") operates a sourcing and product lifecycle management platform for wholesale businesses. This Privacy Policy explains how we collect, use, and protect your information when you use our services at myjimmy.ai and any associated domains.</p>
            <p className="mt-3">By using Jimmy AI, you agree to the collection and use of information in accordance with this policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Information We Collect</h2>
            <p className="font-medium text-white/80 mb-2">Account Information</p>
            <p>We collect your email address and password when you create an account. Accounts are created by invitation only.</p>
            <p className="font-medium text-white/80 mb-2 mt-4">Product & Sourcing Data</p>
            <p>When you use our platform, we store data you provide including:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/50">
              <li>Product information: names, SKUs, descriptions, specifications, images</li>
              <li>Factory information: names, contact details, quotes, communications</li>
              <li>Sample and production tracking data</li>
              <li>Purchase orders and pricing information</li>
            </ul>
            <p className="font-medium text-white/80 mb-2 mt-4">Integration Data</p>
            <p>When you connect third-party services, we access and process data to enable email functionality:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/50">
              <li>Gmail/Outlook: Used to send RFQs, sample requests, and POs to factories</li>
              <li>Google Drive/OneDrive: Used to read uploaded quote files</li>
            </ul>
            <p className="font-medium text-white/80 mb-2 mt-4">Usage Data</p>
            <p>We collect information about how you interact with our platform including pages visited, features used, and actions taken.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <p>We use your information exclusively to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/50">
              <li>Track your product lifecycle from concept through production</li>
              <li>Send RFQs, sample requests, and purchase orders to factories on your behalf</li>
              <li>Extract pricing from factory quote files using AI</li>
              <li>Calculate landed costs and compare factory quotes</li>
              <li>Maintain and improve our platform</li>
              <li>Communicate with you about your account and our services</li>
            </ul>
            <p className="mt-4">We do not sell your data to third parties. We do not use your business data to train general AI models.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Factory Portal</h2>
            <p>When you create portal access for a factory, they receive a separate login to view and update only the products you've assigned to them. Factories cannot see your pricing, other factories, or any data beyond what you explicitly share with them.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Storage and Security</h2>
            <p>Your data is stored securely using Supabase, a SOC 2 compliant database provider running on AWS in the United States. All data is encrypted in transit using TLS and at rest using AES-256. Access tokens for third-party integrations are stored encrypted and are never shared.</p>
            <p className="mt-3">Sensitive actions require an Admin PIN that only you know.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Third-Party Services</h2>
            <p>Jimmy AI integrates with third-party services. When you connect these services, you are also subject to their privacy policies:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/50">
              <li>Google: policies.google.com/privacy</li>
              <li>Microsoft: privacy.microsoft.com</li>
            </ul>
            <p className="mt-4">We use Anthropic's Claude API to power our AI features. Data sent to Claude is governed by Anthropic's privacy policy at anthropic.com/privacy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Data Retention</h2>
            <p>We retain your data for as long as your account is active. You may request deletion of your account and associated data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/50">
              <li>Access the data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Disconnect any third-party integration at any time</li>
              <li>Revoke factory portal access at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy or your data, please contact us at:</p>
            <p className="mt-2 text-white/80">Jimmy AI<br />Email: joey@myjimmy.ai</p>
          </section>

        </div>
      </div>
    </div>
  );
}
