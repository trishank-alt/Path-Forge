"use client";

import React from "react";
import {
  Compass,
  Sparkles,
  Settings2,
  FileSpreadsheet,
  User,
  RotateCcw,
  Activity,
  Layers,
} from "lucide-react";
import { LearnerProfile, Roadmap } from "@/lib/contracts";

interface NavigationProps {
  profile: LearnerProfile | null;
  roadmap: Roadmap | null;
  learnerId: string;
  onOpenUserModal: () => void;
  onSelectPreset: (preset: { title: string; initialMessage: string }) => void;
  onReset: () => void;
  onOpenSettings: () => void;
  onOpenFacts: () => void;
  activeTab: "roadmap" | "skills" | "scenarios";
  setActiveTab: (tab: "roadmap" | "skills" | "scenarios") => void;
}

export function Navigation({
  profile,
  roadmap,
  learnerId,
  onOpenUserModal,
  onSelectPreset,
  onReset,
  onOpenSettings,
  onOpenFacts,
  activeTab,
  setActiveTab,
}: NavigationProps) {
  const hasActivePhase = Boolean(profile?.activePhase);

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Active Status */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-slate-950 font-black shadow-md glow-cyan">
              <Compass className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent tracking-tight">
                  PathForge
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50 text-cyan-400 font-mono">
                  Adaptive
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Evidence-Driven Adaptive Career Navigator
              </p>
            </div>
          </div>

          {/* Current State Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass-card border border-slate-700/60">
            {hasActivePhase ? (
              <>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs text-slate-200 font-semibold">
                  Active Intervention: Phase {profile?.activePhase?.phaseNumber}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs text-slate-300 font-medium">
                  Conversational Discovery
                </span>
              </>
            )}
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("roadmap")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "roadmap"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Navigator
          </button>
          <button
            onClick={() => setActiveTab("skills")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "skills"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Skill Matrix
          </button>
          <button
            onClick={() => setActiveTab("scenarios")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "scenarios"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            What-If Studio
          </button>
        </div>

        {/* Quick Actions & Modals */}
        <div className="flex items-center gap-2">
          {/* User / Workspace Switcher */}
          <button
            onClick={onOpenUserModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 transition-all shadow-sm glow-cyan"
            title="Switch Learner Workspace or Profile"
          >
            <User className="w-3.5 h-3.5" />
            <span className="max-w-[90px] truncate">{learnerId}</span>
          </button>

          {/* Fact Inspector */}
          <button
            onClick={onOpenFacts}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl glass-card hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 transition-colors"
            title="Inspect & Edit Stored Facts"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">
              Facts ({profile?.facts.filter((f) => f.status === "active").length || 0})
            </span>
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2 text-xs font-medium rounded-xl glass-card hover:border-slate-500 text-slate-300 hover:text-white transition-colors"
            title="LLM Settings (Gemini / Groq / OpenAI API Keys)"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {/* Start Fresh / Reset Button */}
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-rose-100 transition-all shadow-sm"
            title="Wipe state and start completely fresh"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Preset Quick Loader Bar */}
      <div className="max-w-7xl mx-auto mt-3 pt-2.5 border-t border-slate-800/60 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">
          Conversational Prompts:
        </span>
        <button
          onClick={() =>
            onSelectPreset({
              title: "I have no idea what career I want",
              initialMessage: "I have no idea what career I want.",
            })
          }
          className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/60 whitespace-nowrap transition-colors"
        >
          &quot;I have no idea what career I want&quot;
        </button>
        <button
          onClick={() =>
            onSelectPreset({
              title: "Backend curiosity",
              initialMessage: "I think backend might be interesting.",
            })
          }
          className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/60 whitespace-nowrap transition-colors"
        >
          &quot;Backend might be interesting&quot;
        </button>
        <button
          onClick={() =>
            onSelectPreset({
              title: "Struggle / Difficulty",
              initialMessage: "I'm finding backend difficult.",
            })
          }
          className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/60 whitespace-nowrap transition-colors"
        >
          &quot;I'm finding backend difficult&quot;
        </button>
        <button
          onClick={() =>
            onSelectPreset({
              title: "Direction pivot to AI",
              initialMessage: "I've realized I don't want to do backend anymore. I want to explore AI.",
            })
          }
          className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/60 whitespace-nowrap transition-colors"
        >
          &quot;Pivot from Backend to AI&quot;
        </button>
      </div>
    </header>
  );
}
