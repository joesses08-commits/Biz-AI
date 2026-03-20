export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <a href="/" className="text-white/30 text-sm hover:text-white transition">← BizAI</a>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-white/30 text-sm mb-12">Last updated: March 19, 2026</p>

        <div className="space-y-10 text-white/60 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Agreement to Terms</h2>
            <p>By accessing or using BizAI ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service. BizAI is operated by BizAI ("we," "us," or "our").</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
            <p>BizAI is an AI-powered business intelligence platform that connects to your business tools and provides insights, analysis, and recommendations. The Service uses artificial intelligence to analyze data from connected integrations including email, financial tools, and productivity software.</p>
            <p className="mt-3 text-amber-400/70 text-sm">Important: BizAI provides AI-generated insights for informational purposes only. All business decisions remain solely your responsibility. BizAI is not a substitute for professional financial, legal, or business advice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Account Terms</h2>
            <p>Access to BizAI is by invitation only. You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately of any unauthorized use of your account. You must be at least 18 years old to use this Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/50">
              <li>Use the Service for any unlawful purpose</li>
              <li>Share your account credentials with others</li>
              <li>Attempt to reverse engineer or compromise the Service</li>
              <li>Upload malicious content or interfere with the Service</li>
              <li>Use the Service to process data you don't have rights to access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Third-Party Integrations</h2>
            <p>BizAI connects to third-party services on your behalf. You are responsible for ensuring you have the right to connect and share data from these services. You authorize BizAI to access data from connected services solely to provide the Service to you.</p>
            <p className="mt-3">You may disconnect any integration at any time from your account settings. Disconnecting an integration will stop BizAI from accessing new data from that service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Payment Terms</h2>
            <p>BizAI offers paid subscription plans. Subscriptions are billed monthly and automatically renew unless cancelled. All payments are processed securely through Stripe. Refunds are handled on a case-by-case basis — contact us within 7 days of a charge if you believe it was made in error.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. AI Disclaimer</h2>
            <p>BizAI uses artificial intelligence to generate insights and recommendations. AI-generated content may contain errors, inaccuracies, or outdated information. You should independently verify any AI-generated insight before acting on it. BizAI is not liable for any decisions made based on AI-generated content.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Intellectual Property</h2>
            <p>The BizAI platform, including its design, code, and AI models, is owned by BizAI. Your business data remains yours — we claim no ownership over data you connect to the platform. You grant us a limited license to process your data solely to provide the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, BizAI shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service. Our total liability to you shall not exceed the amount you paid us in the past 12 months.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Termination</h2>
            <p>We reserve the right to suspend or terminate your account at any time for violation of these terms. You may cancel your account at any time by contacting us. Upon termination, your data will be retained for 30 days before deletion.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Changes to Terms</h2>
            <p>We may update these Terms of Service at any time. Continued use of the Service after changes constitutes acceptance of the new terms. We will notify active users of significant changes via email.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Contact</h2>
            <p>For questions about these Terms, contact us at:</p>
            <p className="mt-2 text-white/80">BizAI<br />Email: joey@bizai.co</p>
          </section>

        </div>
      </div>
    </div>
  );
}
