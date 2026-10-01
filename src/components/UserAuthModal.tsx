"use client";

import React from "react";
import {
  X,
  User,
  Users,
  RotateCcw,
  Shield,
  LogOut,
  Mail,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { LearnerProfile } from "@/lib/contracts";
import { AuthUser } from "@/lib/auth/auth-service";

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthUser | null;
  onResetLearner: () => void;
  onLogout: () => void;
  profile: LearnerProfile | null;
}

export function UserAuthModal({
  isOpen,
  onClose,
  authUser,
  onResetLearner,
  onLogout,
  profile,
}: UserAuthModalProps) {
  if (!isOpen) return null;

  const handleResetCurrent = () => {
    if (confirm("Reset this learner profile to a clean, empty state? This will clear active facts and roadmaps for your account.")) {
      onResetLearner();
      onClose();
    }
  };

  const handleLogoutClick = () => {
    onLogout();
    onClose();
  };

  const memberSince = authUser?.createdAt
    ? new Date(authUser.createdAt).toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Active";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md glass-panel rounded-2xl border border-slate-700/80 shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">User Account & Workspace</h3>
              <p className="text-xs text-slate-400">
                Authenticated session details and profile management
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-slate-950 font-black text-lg shadow-md glow-cyan">
              {authUser?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white truncate">{authUser?.name || "Learner"}</h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
                  Authenticated
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate mt-0.5">
                <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{authUser?.email || "user@pathforge.ai"}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">User ID</span>
              <p className="font-mono text-slate-300 text-[11px] truncate">{authUser?.id || "unknown"}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Member Since</span>
              <p className="text-slate-300 text-[11px] flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>{memberSince}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Current Active Workspace Metrics */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Learning Readiness State:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-700/60 text-cyan-300 font-semibold text-[11px]">
              {profile?.intent.status === "ready" ? "Roadmap Ready" : "In Clarification"}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Recorded Facts:</span>
            <span className="font-bold text-slate-200">
              {profile?.facts.filter((f) => f.status === "active").length || 0} active
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Active Target:</span>
            <span className="font-bold text-cyan-300 max-w-[200px] truncate text-right">
              {profile?.goalText || "None specified"}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <button
            onClick={handleResetCurrent}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-rose-800/40 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset My Profile to Clean State</span>
          </button>

          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Sign Out of PathForge</span>
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
