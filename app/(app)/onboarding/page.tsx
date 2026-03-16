"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const steps = [
  {
    id: 1,
    title: "Welcome to BizAI",
    subtitle: "Your AI COO is ready",
    description: "BizAI connects every tool your business runs on and gives you a single intelligent layer that tells you exactly what's happening, why it's happening, and what to do about it.",
    bullets: [
      "Real-time insights from all your business tools",
      "AI that knows your specific business — not generic advice",
      "Proactive alerts before problems become crises",
      "Ask anything about your business in plain English",
    ],
  },
  {
    id: 2,
    title: "Connect Your Tools",
    subtitle: "Give BizAI visibility into your business",
    description: "Connect the tools your business already uses. The more you connect, the smarter your AI COO becomes.",
    integrations: [
      { name: "Gmail", href: "/api/gmail/connect", icon: "📧", description: "Emails & client communication" },
      { name: "QuickBooks", href: "/api/quickbooks/connect", icon: "📊", description: "Invoices, P&L, cash flow" },
      { name: "Microsoft 365", href: "/api/microsoft/connect", icon: "💼", description: "Outlook, Excel, OneDrive" },
      { name: "Stripe", href: "/api/stripe/connect", icon: "💳", description: "Revenue & payments" },
    ],
  },
  {
    id: 3,
    title: "Ask Your First Question",
    subtitle: "Your AI COO is ready to brief you",
    description: "Try asking BizAI anything about your business. Here are some questions to get you started.",
    questions: [
      "What's the most important thing I should focus on today?",
      "What does my financial position look like right now?",
      "Are there any urgent issues I should know about?",
      "Who are my most valuable customers?",
    ],
  },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function finish() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert({ id: user.id, onboarded: true });
    }
    router.push("/dashboard");
  }

  const step = steps[currentStep];

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">

        {/* Progress */}
        <div className="flex items-center gap-3 mb-12 justify-center">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${i <= currentStep ? "bg-white text-black" : "bg-gray-800 text-gray-400"}`}>
                {i < currentStep ? "✓" : s.id}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-16 h-0.5 ${i < currentStep ? "bg-white" : "bg-gray-800"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="text-center mb-10">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">{step.subtitle}</p>
          <h1 className="text-4xl font-bold mb-4">{step.title}</h1>
          <p className="text-gray-400 text-lg leading-relaxed">{step.description}</p>
        </div>

        {/* Step 1 - bullets */}
        {step.bullets && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
            <div className="space-y-3">
              {step.bullets.map((bullet, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-green-400 text-xs">✓</span>
                  </div>
                  <p className="text-gray-300">{bullet}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 - integrations */}
        {step.integrations && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            {step.integrations.map((integration) => (
              <a key={integration.name} href={integration.href}
                className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 transition text-left">
                <div className="text-2xl mb-2">{integration.icon}</div>
                <p className="font-bold">{integration.name}</p>
                <p className="text-gray-400 text-sm">{integration.description}</p>
              </a>
            ))}
          </div>
        )}

        {/* Step 3 - questions */}
        {step.questions && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
            <p className="text-gray-400 text-sm mb-4">Try asking:</p>
            <div className="space-y-2">
              {step.questions.map((q, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition cursor-pointer"
                  onClick={() => router.push(`/chat?q=${encodeURIComponent(q)}`)}>
                  <span className="text-gray-500">→</span>
                  <p className="text-gray-300 text-sm">{q}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            className={`px-6 py-2.5 rounded-lg text-gray-400 hover:text-white transition ${currentStep === 0 ? "invisible" : ""}`}
          >
            ← Back
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="bg-white text-black font-bold px-8 py-2.5 rounded-lg hover:bg-gray-200 transition"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={finish}
              className="bg-white text-black font-bold px-8 py-2.5 rounded-lg hover:bg-gray-200 transition"
            >
              Go to Dashboard →
            </button>
          )}
        </div>

        <p className="text-center text-gray-600 text-sm mt-6 cursor-pointer hover:text-gray-400" onClick={finish}>
          Skip for now
        </p>
      </div>
    </div>
  );
}
