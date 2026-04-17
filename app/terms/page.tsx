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

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <BackButton />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-white/30 text-sm mb-12">Last updated: April 16, 2026</p>
        <div className="space-y-10 text-white/60 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Jimmy AI, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
            <p>Jimmy AI is a product lifecycle management and sourcing platform for wholesale businesses. The platform enables you to track products from concept through production, manage factory relationships, request and compare quotes, track samples, and generate purchase orders.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Use of Service</h2>
            <p>You agree to use Jimmy AI only for lawful business purposes related to wholesale product sourcing and lifecycle management. You agree not to misuse, reverse engineer, or attempt to gain unauthorized access to the platform.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Account Responsibility</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and Admin PIN. You are responsible for all activity that occurs under your account, including actions taken by factory portal users you create.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Factory Portal Users</h2>
            <p>When you create factory portal access, you grant that factory limited access to view and update product information you share with them. You are responsible for managing factory access and can revoke it at any time.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Data & Privacy</h2>
            <p>Your use of Jimmy AI is also governed by our Privacy Policy. By using the service, you consent to the collection and use of your data as described therein.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. AI-Generated Content</h2>
            <p>Jimmy AI uses artificial intelligence to extract pricing from documents, generate emails, and provide recommendations. While we strive for accuracy, you are responsible for reviewing AI-generated content before sending to factories or making business decisions.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Intellectual Property</h2>
            <p>All content, features, and functionality of Jimmy AI are owned by Jimmy AI and protected by applicable intellectual property laws. You retain ownership of all product data, images, and business information you upload to the platform.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p>Jimmy AI is provided "as is." We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform, including but not limited to business decisions made based on AI recommendations or errors in quote extraction. Our total liability shall not exceed the amount you paid in the past 12 months.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Termination</h2>
            <p>We reserve the right to suspend or terminate your access at any time for violation of these terms or for any other reason at our sole discretion. Upon termination, factory portal users you created will also lose access.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Contact</h2>
            <p>For questions about these terms, contact us at joey@myjimmy.ai.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
