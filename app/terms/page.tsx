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
      if (data?.user) setHref("/dashboard");
    });
  }, []);
  return <a href={href} className="text-white/30 text-sm hover:text-white transition">← Back</a>;
}

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <BackButton />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-white/30 text-sm mb-12">Last updated: March 19, 2026</p>
        <div className="space-y-10 text-white/60 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Jimmy AI, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Use of Service</h2>
            <p>Jimmy AI is a business intelligence platform. You agree to use it only for lawful business purposes and not to misuse, reverse engineer, or attempt to gain unauthorized access to the platform.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Account Responsibility</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data & Privacy</h2>
            <p>Your use of Jimmy AI is also governed by our Privacy Policy. By using the service, you consent to the collection and use of your data as described therein.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Intellectual Property</h2>
            <p>All content, features, and functionality of Jimmy AI are owned by Jimmy AI and protected by applicable intellectual property laws. You may not copy, modify, or distribute any part of the platform without written permission.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Limitation of Liability</h2>
            <p>Jimmy AI is provided "as is." We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our total liability shall not exceed the amount you paid in the past 12 months.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Termination</h2>
            <p>We reserve the right to suspend or terminate your access at any time for violation of these terms or for any other reason at our sole discretion.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Contact</h2>
            <p>For questions about these terms, contact us at jo.esses08@gmail.com.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
