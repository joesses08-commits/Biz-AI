export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <a href="/dashboard" className="text-white/30 text-sm hover:text-white transition">← Back to Dashboard</a>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-white/30 text-sm mb-12">Last updated: March 19, 2026</p>

        <div className="space-y-10 text-white/60 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Introduction</h2>
            <p>BizAI ("we," "our," or "us") operates an AI-powered business intelligence platform. This Privacy Policy explains how we collect, use, and protect your information when you use our services at biz-ai-pi.vercel.app and any associated domains.</p>
            <p className="mt-3">By using BizAI, you agree to the collection and use of information in accordance with this policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Information We Collect</h2>
            <p className="font-medium text-white/80 mb-2">Account Information</p>
            <p>We collect your email address and password when you create an account. Accounts are created by invitation only.</p>
            <p className="font-medium text-white/80 mb-2 mt-4">Business Integration Data</p>
            <p>When you connect third-party services, we access and process data from those services to provide our AI analysis. This may include:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/50">
              <li>Gmail: Email metadata and content (subject lines, sender, body)</li>
              <li>Google Workspace: Spreadsheet and document data</li>
              <li>Microsoft 365: Outlook emails, OneDrive files, calendar events</li>
              <li>Stripe: Transaction data, customer information, revenue metrics</li>
              <li>QuickBooks: Invoice data, profit and loss reports</li>
            </ul>
            <p className="font-medium text-white/80 mb-2 mt-4">Usage Data</p>
            <p>We collect information about how you interact with our platform including pages visited, features used, and actions taken.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <p>We use your information exclusively to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/50">
              <li>Provide AI-powered business insights and analysis</li>
              <li>Generate daily briefing emails and alerts</li>
              <li>Improve the accuracy and relevance of our AI models</li>
              <li>Maintain and improve our platform</li>
              <li>Communicate with you about your account and our services</li>
            </ul>
            <p className="mt-4">We do not sell your data to third parties. We do not use your business data to train general AI models.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Storage and Security</h2>
            <p>Your data is stored securely using Supabase, a SOC 2 compliant database provider. All data is encrypted in transit using TLS/HTTPS. Access tokens for third-party integrations are stored encrypted and are never shared.</p>
            <p className="mt-3">We implement industry-standard security measures to protect your information. However, no method of transmission over the Internet is 100% secure.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Third-Party Services</h2>
            <p>BizAI integrates with third-party services. When you connect these services, you are also subject to their privacy policies:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/50">
              <li>Google: policies.google.com/privacy</li>
              <li>Microsoft: privacy.microsoft.com</li>
              <li>Stripe: stripe.com/privacy</li>
              <li>Intuit/QuickBooks: intuit.com/privacy</li>
            </ul>
            <p className="mt-4">We use Anthropic's Claude API to power our AI analysis. Data sent to Claude is governed by Anthropic's privacy policy at anthropic.com/privacy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Data Retention</h2>
            <p>We retain your data for as long as your account is active. Integration tokens are refreshed regularly and expired tokens are deleted. You may request deletion of your account and associated data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/50">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Disconnect any third-party integration at any time</li>
              <li>Opt out of marketing communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Children's Privacy</h2>
            <p>BizAI is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy or your data, please contact us at:</p>
            <p className="mt-2 text-white/80">BizAI<br />Email: joey@bizai.co</p>
          </section>

        </div>
      </div>
    </div>
  );
}
