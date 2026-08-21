"use client";

import React, { useState } from "react";
import {
  X,
  User,
  UserPlus,
  Users,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Trash2,
  Shield,
  Layers,
  Code2,
} from "lucide-react";
import { LearnerProfile } from "@/lib/contracts";

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLearnerId: string;
  onSwitchLearner: (learnerId: string, learnerName?: string) => void;
  onResetLearner: () => void;
  profile: LearnerProfile | null;
}

interface SavedUser {
  id: string;
  name: string;
  roleHint?: string;
}

const DEFAULT_USERS: SavedUser[] = [
  { id: "trishank", name: "Trishank (Personal)", roleHint: "Fresh Custom Workspace" },
  { id: "guest_session", name: "Guest Learner", roleHint: "Clean Sandbox" },
  { id: "demo_python_dev", name: "Python / Cloud Track", roleHint: "Async APIs & Pipelines" },
  { id: "demo_cybersec_dev", name: "Cybersecurity Track", roleHint: "Defensive Red-Teaming" },
];

export function UserAuthModal({
  isOpen,
  onClose,
  currentLearnerId,
  onSwitchLearner,
  onResetLearner,
  profile,
}: UserAuthModalProps) {
  const [newUserName, setNewUserName] = useState("");
  const [userList, setUserList] = useState<SavedUser[]>(() => {
    try {
      const stored = localStorage.getItem("pathfinder_user_list");
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return DEFAULT_USERS;
  });

  if (!isOpen) return null;

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newUserName.trim();
    if (!clean) return;
    const id = `user_${clean.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now().toString(36).slice(-4)}`;
    const updated = [...userList, { id, name: clean, roleHint: "Custom Learner" }];
    setUserList(updated);
    localStorage.setItem("pathfinder_user_list", JSON.stringify(updated));
    setNewUserName("");
    onSwitchLearner(id, clean);
    onClose();
  };

  const handleSelectUser = (user: SavedUser) => {
    onSwitchLearner(user.id, user.name);
    onClose();
  };

  const handleResetCurrent = () => {
    if (confirm("Reset this learner profile to a clean, empty state?")) {
      onResetLearner();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg glass-panel rounded-2xl border border-slate-700/80 shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Learner Profiles & Workspace</h3>
              <p className="text-xs text-slate-400">
                Switch workspaces or create a brand-new clean profile
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

        {/* Current Active Workspace Spotlight */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Active Profile</span>
                <p className="text-sm font-bold text-slate-100 font-mono">{currentLearnerId}</p>
              </div>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-700/60 text-cyan-300 font-medium">
              {profile?.intent.status === "ready" ? "Roadmap Ready" : "Discovering"}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs border-t border-slate-800/80">
            <span className="text-slate-400">
              Facts: <strong className="text-slate-200">{profile?.facts.length || 0}</strong> • Goal:{" "}
              <strong className="text-slate-200">{profile?.goalText ? `"${profile.goalText.slice(0, 30)}..."` : "None"}</strong>
            </span>

            <button
              onClick={handleResetCurrent}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-rose-300 hover:text-rose-200 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/40 text-xs font-semibold transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Blank</span>
            </button>
          </div>
        </div>

        {/* Workspace Switcher List */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">Switch Learner Workspace:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
            {userList.map((u) => {
              const isActive = u.id === currentLearnerId;
              return (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                    isActive
                      ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-200 glow-cyan"
                      : "bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-semibold block truncate">{u.name}</span>
                    <span className="text-[10px] text-slate-400 block truncate">{u.roleHint || u.id}</span>
                  </div>
                  {isActive && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Create New Learner Profile Form */}
        <form onSubmit={handleCreateUser} className="space-y-2 pt-2 border-t border-slate-800">
          <label className="text-xs font-semibold text-slate-300">Create New Clean Workspace:</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="e.g. My Custom Track, Trishank-Python..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={!newUserName.trim()}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-md glow-cyan"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create</span>
            </button>
          </div>
        </form>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
