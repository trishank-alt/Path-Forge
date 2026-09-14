"use client";

import React from "react";
import {
  Compass,
  Sparkles,
  Database,
  Layers,
  ShieldAlert,
  Terminal,
  Settings2,
  FileSpreadsheet,
  User,
  RotateCcw,
  Activity,
  PlusCircle,
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
  const status = profile?.intent.status || "clarifying";

  const getStatusBadge = () => {
    switch (status) {
      case "ready":
        return {
          label: "Your plan is ready",
          color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
          icon: Sparkles,
        };
      case "provisional":
        return {
          label: "Provisional Plan",
          color: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          icon: Activity,
        };
      default:
        return {
          label: "Clarifying Intent",
          color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
          icon: Compass,
        };
    }
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  const activeFactsCount = profile?.facts.filter((f) => f.status === "active").length || 0;
  const hasDistinctHypothesis =
    activeFactsCount > 0 &&
    Boolean(profile?.intent.topPathId) &&
    Boolean(
      profile?.intent.hypotheses.some(
        (h) => h.posteriorProbability > 1 / (profile.intent.hypotheses.length || 1) + 0.05
      )
    );

  const tentativeHypothesis = profile?.intent.topPathId
    ? profile.intent.hypotheses.find((h) => h.pathId === profile.intent.topPathId)
    : null;

  const displayRole =
    status === "ready"
      ? profile?.declaredTargetRole || "Committed Path"
      : status === "provisional"
      ? profile?.declaredTargetRole || "Provisional Path"
      : hasDistinctHypothesis && tentativeHypothesis?.pathTitle
      ? `Tentative: ${tentativeHypothesis.pathTitle}`
      : "Discovering Intent...";

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Active Path */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-slate-950 font-black shadow-md glow-cyan">
              <Compass className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent tracking-tight">
                  PathFinder AI
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50 text-cyan-400 font-mono">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                AI-Powered Personalized Learning Path Recommender
              </p>
            </div>
          </div>

          {/* Path status */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass-card border border-slate-700/60">
            <StatusIcon className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-xs text-slate-300 font-medium max-w-[220px] truncate">
              {displayRole}
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge.color}`}
            >
              {statusBadge.label}
            </span>
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
            Adaptive Roadmap
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
            <span className="hidden lg:inline">Facts ({profile?.facts.filter((f) => f.status === "active").length || 0})</span>
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
            <span>Start Fresh</span>
          </button>
        </div>
      </div>

      {/* Preset Quick Loader Bar */}
      <div className="max-w-7xl mx-auto mt-3 pt-2.5 border-t border-slate-800/60 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">
          Demo Presets:
        </span>
        <button
          onClick={() =>
            onSelectPreset({
              title: "Ambiguous Backend Goal",
              initialMessage: "I want to become a backend developer. I know HTTP and REST.",
            })
          }
          className="px-2.5 py-1 rounded-md bg-slate-800/70 hover:bg-cyan-950/40 border border-slate-700/60 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 whitespace-nowrap transition-colors flex items-center gap-1.5"
        >
          <Compass className="w-3 h-3 text-cyan-400" />
          1. Ambiguous Backend Goal
        </button>

        <button
          onClick={() =>
            onSelectPreset({
              title: "Enterprise Java & ERP",
              initialMessage:
                "I want to build enterprise ERP backend systems. I am proficient in Java and relational SQL.",
            })
          }
          className="px-2.5 py-1 rounded-md bg-slate-800/70 hover:bg-indigo-950/40 border border-slate-700/60 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-300 whitespace-nowrap transition-colors flex items-center gap-1.5"
        >
          <Database className="w-3 h-3 text-indigo-400" />
          2. Java / Spring / ERP Track
        </button>

        <button
          onClick={() =>
            onSelectPreset({
              title: "Modern Web Product & Node.js",
              initialMessage:
                "I want to build modern SaaS web products with TypeScript, Node.js, Fastify and PostgreSQL.",
            })
          }
          className="px-2.5 py-1 rounded-md bg-slate-800/70 hover:bg-sky-950/40 border border-slate-700/60 hover:border-sky-500/50 text-slate-300 hover:text-sky-300 whitespace-nowrap transition-colors flex items-center gap-1.5"
        >
          <Layers className="w-3 h-3 text-sky-400" />
          3. Node.js SaaS Product Track
        </button>

        <button
          onClick={() =>
            onSelectPreset({
              title: "DevOps & Cloud Platform Infrastructure",
              initialMessage:
                "I want to become a DevOps & Cloud Platform Infrastructure Engineer. I have experience with Linux and Python.",
            })
          }
          className="px-2.5 py-1 rounded-md bg-slate-800/70 hover:bg-cyan-950/40 border border-slate-700/60 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 whitespace-nowrap transition-colors flex items-center gap-1.5"
        >
          <Terminal className="w-3 h-3 text-cyan-400" />
          4. DevOps & Cloud Track
        </button>

        <button
          onClick={() =>
            onSelectPreset({
              title: "Full-Stack Web Software Engineer",
              initialMessage:
                "I want to build full-stack web applications with React, Next.js, Node.js and SQL.",
            })
          }
          className="px-2.5 py-1 rounded-md bg-slate-800/70 hover:bg-indigo-950/40 border border-slate-700/60 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-300 whitespace-nowrap transition-colors flex items-center gap-1.5"
        >
          <Sparkles className="w-3 h-3 text-indigo-400" />
          5. Full-Stack Web Track
        </button>

        <button
          onClick={() =>
            onSelectPreset({
              title: "Defensive Cybersecurity & Red-Team",
              initialMessage:
                "I want to get into defensive security and ethical red teaming. I confirm all testing is in authorized labs.",
            })
          }
          className="px-2.5 py-1 rounded-md bg-slate-800/70 hover:bg-emerald-950/40 border border-slate-700/60 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-300 whitespace-nowrap transition-colors flex items-center gap-1.5"
        >
          <ShieldAlert className="w-3 h-3 text-emerald-400" />
          6. Defensive Security Track
        </button>
      </div>
    </header>
  );
}
