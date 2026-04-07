"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Factory, Eye, EyeOff } from "lucide-react";

export default function PortalLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/portal/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      setError(data.error || "Invalid credentials");
      setLoading(false);
      return;
    }

    // Store portal session
    const role = data.user?.role || "factory";
    localStorage.setItem("portal_token", data.token);
    localStorage.setItem("portal_user", JSON.stringify(data.user));
    localStorage.setItem(`portal_token_${role}`, data.token);
    localStorage.setItem(`portal_user_${role}`, JSON.stringify(data.user));
    router.push("/portal/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <Factory size={22} className="text-white/60" />
          </div>
          <h1 className="text-xl font-bold text-white">Factory Portal</h1>
          <p className="text-sm text-white/30 mt-1">Powered by Jimmy AI</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[11px] text-white/30 mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="factory@example.com"
              required
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20 transition"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/30 mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20 transition pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-white/20 mt-6">
          Contact your account manager if you need access
        </p>
      </div>
    </div>
  );
}
