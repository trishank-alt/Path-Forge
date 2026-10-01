"use client";

import React, { useState } from "react";
import {
  Compass,
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { AuthUser } from "@/lib/auth/auth-service";

interface AuthScreenProps {
  onAuthSuccess: (user: AuthUser) => void;
}

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (tab === "register") {
      if (!name.trim()) {
        setErrorMessage("Please enter your name.");
        return;
      }
      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }
    }

    setIsLoading(true);

    try {
      const endpoint = tab === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";
      const payload = tab === "login" ? { email, password } : { name, email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Authentication failed.");
        setIsLoading(false);
        return;
      }

      onAuthSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected network error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: demoEmail, password: "password123" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "Demo login failed.");
        setIsLoading(false);
        return;
      }

      onAuthSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err?.message || "Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#090d16] text-slate-100 relative overflow-hidden selection:bg-cyan-500 selection:text-slate-950">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-600/15 via-indigo-600/15 to-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-600/20 border border-cyan-500/30 text-cyan-400 shadow-xl glow-cyan mb-2">
            <Compass className="w-8 h-8 animate-spin-slow" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            PathForge <span className="text-cyan-400 text-xs px-2 py-0.5 rounded-full border border-cyan-500/40 bg-cyan-950/60 font-mono font-medium">Auth</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Evidence-driven adaptive learning & career navigator. Sign in to access your personalized roadmap.
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel rounded-2xl border border-slate-700/80 shadow-2xl p-6 sm:p-7 space-y-5 backdrop-blur-xl bg-slate-900/80">
          {/* Tabs */}
          <div className="flex rounded-xl bg-slate-950/70 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setTab("login");
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === "login"
                  ? "bg-cyan-500 text-slate-950 shadow-md glow-cyan"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("register");
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === "register"
                  ? "bg-cyan-500 text-slate-950 shadow-md glow-cyan"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "register" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {tab === "register" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg glow-cyan disabled:opacity-50 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{tab === "login" ? "Signing In..." : "Creating Account..."}</span>
                </>
              ) : (
                <>
                  <span>{tab === "login" ? "Sign In to PathForge" : "Complete Registration"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Instant 1-Click Evaluation / Demo Accounts */}
          <div className="pt-3 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Instant Evaluation Credentials</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo("demo@pathforge.ai")}
                disabled={isLoading}
                className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/70 hover:bg-slate-800 hover:border-cyan-500/40 text-left transition-all text-xs group"
              >
                <div className="font-semibold text-slate-200 group-hover:text-cyan-300 flex items-center justify-between">
                  <span>Demo Engineer</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 opacity-60 group-hover:opacity-100" />
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate">demo@pathforge.ai</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo("trishank@pathforge.ai")}
                disabled={isLoading}
                className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/70 hover:bg-slate-800 hover:border-cyan-500/40 text-left transition-all text-xs group"
              >
                <div className="font-semibold text-slate-200 group-hover:text-cyan-300 flex items-center justify-between">
                  <span>Trishank</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 opacity-60 group-hover:opacity-100" />
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate">trishank@pathforge.ai</div>
              </button>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Stateless encrypted HMAC-SHA256 session verification</span>
        </div>
      </div>
    </div>
  );
}
