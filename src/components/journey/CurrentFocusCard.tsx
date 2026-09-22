"use client";

import React, { useState } from "react";
import {
  Compass,
  CheckCircle2,
  Sparkles,
  Layers,
  Code2,
  ArrowRight,
  Brain,
  Lightbulb,
  FileCheck,
} from "lucide-react";
import { RoadmapPhase } from "@/lib/contracts";
import { JourneyHistory } from "./JourneyHistory";

interface CurrentFocusCardProps {
  activePhase: RoadmapPhase | null;
  phaseHistory?: RoadmapPhase[];
  onSubmitWorkAndReflect?: (phaseId: string) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export function CurrentFocusCard({
  activePhase,
  phaseHistory = [],
  onSubmitWorkAndReflect,
  isLoading = false,
  className = "",
}: CurrentFocusCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitWork = async () => {
    if (!activePhase || !onSubmitWorkAndReflect || isSubmitting || isLoading) return;
    setIsSubmitting(true);
    try {
      await onSubmitWorkAndReflect(activePhase.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Discovery State (No Active Phase)
  if (!activePhase) {
    return (
      <div
        className={`flex flex-col h-full glass-panel rounded-2xl border border-slate-800/80 p-5 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 ${className}`}
      >
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800/80">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Explore</h2>
            <p className="text-[11px] text-slate-400">Discovering your career landscape</p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-bold text-cyan-300">Your map is taking shape.</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            PathForge does not lock you into a rigid, pre-fabricated roadmap. We are actively learning what kind of engineering work genuinely fits you through conversation, questions, and hands-on diagnostic probes.
          </p>
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs text-slate-400 space-y-1">
            <span className="font-semibold text-slate-300">How to proceed:</span>
            <p>
              Share your technical curiosities, goals, or doubts in the conversation below. As evidence accumulates, targeted capabilities and interventions will emerge on your map.
            </p>
          </div>
        </div>

        <JourneyHistory activePhase={null} phaseHistory={phaseHistory} />
      </div>
    );
  }

  // 2. Active Intervention State
  const estimatedWeeks = activePhase.duration?.estimatedWeeks || 3;
  const weeklyHours = activePhase.duration?.weeklyHours || 12;
  const totalHours = activePhase.duration?.totalHours || 36;
  const project = activePhase.project;

  return (
    <div
      className={`flex flex-col h-full glass-panel rounded-2xl border border-slate-800/80 p-5 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 ${className}`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Current Focus</h2>
            <p className="text-[11px] text-slate-400">Active learning & measurement intervention</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>Active</span>
        </span>
      </div>

      {/* Main Intervention Card */}
      <div className="rounded-xl bg-slate-900/90 border border-cyan-500/30 p-4 space-y-3.5 shadow-lg">
        {/* Title & Timing Meta */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-cyan-400">
              Phase {activePhase.phaseNumber} • Sustained Intervention
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {estimatedWeeks} wks • {weeklyHours}h/wk (~{totalHours}h)
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-100 leading-snug">
            {activePhase.objective}
          </h3>
        </div>

        {/* 1. Why we're doing this */}
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
            <Lightbulb className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Why we&apos;re doing this:</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {activePhase.explanation ||
              "Testing your real-world affinity, task engagement, and problem-solving pace through authentic practical work."}
          </p>
        </div>

        {/* 2. What you're going to do (Activities) */}
        {activePhase.activities && activePhase.activities.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>What you&apos;ll do:</span>
            </span>
            <ul className="space-y-1.5 pl-1 text-xs text-slate-300">
              {activePhase.activities.slice(0, 3).map((act, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>
                    <strong className="text-slate-200">{act.title}:</strong>{" "}
                    <span className="text-slate-400">{act.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. Evidence we're looking for */}
        <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
            <Brain className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Evidence we&apos;re looking for:</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {activePhase.evidenceTargets && activePhase.evidenceTargets.length > 0
              ? activePhase.evidenceTargets.map((et) => `${et.dimension}: ${et.expectedSignal}`).join(" • ")
              : "Observing your problem-solving persistence, conceptual grasp, and voluntary exploration."}
          </p>
        </div>

        {/* 4. Practical Deliverable */}
        {project && (
          <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                <Code2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Practical Deliverable:</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400/80">
                ~{project.estimatedHours}h project
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-100">{project.title}</h4>
            <p className="text-[11px] text-slate-300 leading-snug">{project.description}</p>
            {project.verificationChecklist && project.verificationChecklist.length > 0 && (
              <div className="pt-1 space-y-1 border-t border-emerald-900/40 text-[11px] text-slate-400">
                <span className="text-slate-300 font-medium">Verification checklist:</span>
                {project.verificationChecklist.slice(0, 2).map((chk, i) => (
                  <div key={i} className="flex items-center gap-1 text-slate-300">
                    <FileCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>{chk}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action: Submit Work & Reflect */}
        {onSubmitWorkAndReflect && (
          <div className="pt-2">
            <button
              onClick={handleSubmitWork}
              disabled={isSubmitting || isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md glow-cyan transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>{isSubmitting ? "Submitting Work to Planning Engine..." : "Submit Work & Reflect"}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Submits your completed deliverable to the Decision Engine to evaluate progress and update the map.
            </p>
          </div>
        )}
      </div>

      {/* Historical Journey Timeline Accordion */}
      <JourneyHistory activePhase={activePhase} phaseHistory={phaseHistory} />
    </div>
  );
}
