"use client";

import React, { useState } from "react";
import {
  Compass,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  Code2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  History,
  RotateCcw,
  Target,
  FileCheck,
  Brain,
  Lightbulb,
} from "lucide-react";
import { Milestone, Roadmap, RoadmapPhase } from "@/lib/contracts";

interface CurrentInterventionPanelProps {
  roadmap: Roadmap | null;
  activePhase: RoadmapPhase | null;
  phaseHistory?: RoadmapPhase[];
  onSubmitWorkAndReflect?: (phaseId: string) => Promise<void>;
  isLoading?: boolean;
}

export function CurrentInterventionPanel({
  roadmap,
  activePhase,
  phaseHistory = [],
  onSubmitWorkAndReflect,
  isLoading = false,
}: CurrentInterventionPanelProps) {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive historical phases (completed or superseded)
  const historicalPhases = phaseHistory.filter(
    (p) => p.id !== activePhase?.id && (p.status === "completed" || p.status === "superseded")
  );

  // Active milestone from roadmap or activePhase
  const activeMilestone = roadmap?.milestones.find(
    (m) => m.status === "in_progress"
  ) || (roadmap?.milestones.length === 1 ? roadmap.milestones[0] : null);

  const handleSubmitWork = async () => {
    if (!activePhase || !onSubmitWorkAndReflect || isSubmitting || isLoading) return;
    setIsSubmitting(true);
    try {
      await onSubmitWorkAndReflect(activePhase.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activePhase && !activeMilestone) {
    return null;
  }

  const phaseTitle = activePhase?.objective || activeMilestone?.title || "Active Learning Intervention";
  const phaseNumber = activePhase?.phaseNumber || (roadmap?.milestones.findIndex(m => m.id === activeMilestone?.id) ?? 0) + 1;
  const estimatedWeeks = activePhase?.duration?.estimatedWeeks || activeMilestone?.estimatedWeeks || 3;
  const weeklyHours = activePhase?.duration?.weeklyHours || roadmap?.weeklyPaceHours || 12;
  const totalHours = activePhase?.duration?.totalHours || activeMilestone?.estimatedHours || 36;
  const project = activePhase?.project || activeMilestone?.project;

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-slate-800 p-4 lg:p-5 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">What We're Doing</h2>
            <p className="text-[11px] text-slate-400">
              Active learning & measurement intervention
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>In Progress</span>
        </span>
      </div>

      {/* Active Intervention Card */}
      <div className="rounded-xl bg-slate-900/90 border border-cyan-500/30 glow-cyan p-4 space-y-3.5">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-cyan-400">
              Phase {phaseNumber} • Sustained Intervention
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {estimatedWeeks} wks • {weeklyHours}h/wk (~{totalHours}h)
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-100 leading-snug">
            {phaseTitle}
          </h3>
        </div>

        {/* 1. Why we're doing this */}
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
            <Lightbulb className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Why we're doing this:</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {activePhase?.explanation ||
              activeMilestone?.description ||
              "Testing your real-world affinity for system design, data modeling, and asynchronous development through hands-on practice."}
          </p>
        </div>

        {/* 2. What you're going to do */}
        {activePhase?.activities && activePhase.activities.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>What you're going to do:</span>
            </span>
            <ul className="space-y-1 pl-1 text-xs text-slate-300">
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
            <span>Evidence we're looking for:</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {activePhase?.evidenceTargets && activePhase.evidenceTargets.length > 0
              ? activePhase.evidenceTargets.map((et) => `${et.dimension}: ${et.expectedSignal}`).join(" • ")
              : "Observing whether you enjoy asynchronous debugging, API contract structuring, and database query modeling."}
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
              <div className="pt-1 space-y-0.5 border-t border-emerald-900/40 text-[11px] text-slate-400">
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

        {/* Action: Submit Work & Reflect (passes through EvidenceEngine -> DecisionEngine) */}
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
              Submits your completed deliverable & reflection to evaluate progress with the Decision Engine.
            </p>
          </div>
        )}
      </div>

      {/* Historical Interventions Accordion */}
      {historicalPhases.length > 0 && (
        <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shrink-0">
          <button
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className="w-full p-3 flex items-center justify-between text-left text-xs font-semibold text-slate-300 hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <span>Past Interventions ({historicalPhases.length})</span>
            </div>
            {isHistoryExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {isHistoryExpanded && (
            <div className="p-3 pt-0 space-y-2.5 border-t border-slate-800/80 animate-in fade-in duration-150">
              {historicalPhases.map((phase) => {
                const isCompleted = phase.status === "completed";
                const isSuperseded = phase.status === "superseded";

                return (
                  <div
                    key={phase.id}
                    className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                      isCompleted
                        ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                        : "bg-amber-950/20 border-amber-500/30 text-amber-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-bold ${isSuperseded ? "line-through opacity-80" : ""}`}>
                        Phase {phase.phaseNumber}: {phase.objective}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isCompleted
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        }`}
                      >
                        {isCompleted ? "Completed" : "Superseded"}
                      </span>
                    </div>

                    {isSuperseded && phase.supersessionReason && (
                      <p className="text-[11px] text-amber-300/90 leading-snug">
                        <strong>Why:</strong> {phase.supersessionReason}
                      </p>
                    )}

                    {isCompleted && (
                      <p className="text-[11px] text-emerald-300/80">
                        Successfully completed and verified with the Decision Engine.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
