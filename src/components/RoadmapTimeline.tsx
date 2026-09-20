import React, { useState } from "react";
import {
  CheckCircle,
  Clock,
  ExternalLink,
  Lock,
  Sparkles,
  Code2,
  BookOpen,
  Calendar,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  History,
  ArrowRight,
} from "lucide-react";
import { Milestone, Roadmap } from "@/lib/contracts";

interface RoadmapTimelineProps {
  roadmap: Roadmap | null;
  savedRoadmaps?: Roadmap[];
  onOpenDiagnostic: (skillId: string) => void;
  onCompleteMilestone: (milestoneId: string) => void;
  onSwitchRoadmap?: (roadmapId: string) => void;
}

export function RoadmapTimeline({
  roadmap,
  savedRoadmaps = [],
  onOpenDiagnostic,
  onCompleteMilestone,
  onSwitchRoadmap,
}: RoadmapTimelineProps) {
  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({
    "ms_backend_enterprise_java_1": true,
    "ms_backend_web_product_node_1": true,
    "ms_backend_python_cloud_1": true,
    "ms_cybersecurity_defensive_redteam_1": true,
  });

  if (!roadmap) {
    return (
      <div className="space-y-6">
        <div className="glass-panel rounded-2xl border border-slate-800 p-8 text-center space-y-3">
          <Layers className="w-10 h-10 text-cyan-500/60 mx-auto animate-pulse" />
          <h3 className="text-base font-semibold text-slate-200">No Active Roadmap While Exploring New Goal</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            You are in a clean exploration state. Declare a learning goal or answer clarification questions above to generate your customized roadmap.
          </p>
        </div>

        {/* Saved Roadmaps History */}
        {savedRoadmaps.length > 0 && (
          <div className="glass-panel rounded-2xl border border-slate-800 p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <History className="w-4 h-4 text-cyan-400" />
              <span>Saved Roadmaps History ({savedRoadmaps.length}):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {savedRoadmaps.map((rm) => (
                <div
                  key={rm.id}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 flex flex-col justify-between space-y-2.5 transition-all group"
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold text-cyan-400">
                      v{rm.version} • {rm.totalEstimatedHours}h Effort
                    </span>
                    <h4 className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                      {rm.targetPathTitle}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {rm.milestones.length} milestones planned ({rm.totalEstimatedWeeks} wks)
                    </p>
                  </div>

                  {onSwitchRoadmap && (
                    <button
                      onClick={() => onSwitchRoadmap(rm.id)}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-cyan-300 font-bold text-[11px] border border-slate-700 hover:border-cyan-500/40 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <span>Restore Roadmap</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const isProvisional = roadmap.targetPathTitle.startsWith("Provisional:");

  const toggleExpand = (id: string) => {
    setExpandedMilestones((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-5">
      {/* Saved Roadmaps History Switcher Bar */}
      {savedRoadmaps.length > 1 && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 pl-1 shrink-0">
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span>Saved Roadmaps:</span>
          </div>
          <div className="flex items-center gap-2">
            {savedRoadmaps.map((rm) => {
              const isActive = rm.id === roadmap.id;
              return (
                <button
                  key={rm.id}
                  onClick={() => onSwitchRoadmap && onSwitchRoadmap(rm.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm glow-cyan"
                      : "bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60"
                  }`}
                >
                  <span>{rm.targetPathTitle.replace("Provisional: ", "")}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Provisional Plan Warning Banner */}
      {isProvisional && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            <strong>Provisional Learning Plan: </strong>
            This plan is a draft based on partial coverage. Complete follow-up clarification questions to unlock committed, verified milestones.
          </span>
        </div>
      )}

      {/* Roadmap Summary Header Card */}
      <div className="glass-panel rounded-2xl border border-slate-800 p-4 lg:p-6 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-indigo-950/40 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">{roadmap.targetPathTitle}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 font-mono">
                v{roadmap.version}
              </span>
              {isProvisional && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800/60 text-amber-300 font-semibold">
                  Provisional Draft
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Personalized dependency-safe milestone sequence based on your verified gaps
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">Total Effort</span>
              <span className="font-bold text-cyan-300">{roadmap.totalEstimatedHours} hrs</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">Timeline</span>
              <span className="font-bold text-indigo-300">{roadmap.totalEstimatedWeeks} wks</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">Pace</span>
              <span className="font-bold text-slate-200">{roadmap.weeklyPaceHours}h / wk</span>
            </div>
          </div>
        </div>

        {/* Assumptions & Caveats */}
        {roadmap.assumptions.length > 0 && (
          <div className="text-xs text-slate-400 space-y-1">
            <span className="font-semibold text-slate-300">Underlying Plan Assumptions:</span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-400 text-[11px]">
              {roadmap.assumptions.map((asm, i) => (
                <li key={i}>{asm}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Milestones Timeline */}
      <div className="space-y-4">
        {roadmap.milestones.map((milestone, idx) => {
          const isExpanded = expandedMilestones[milestone.id] ?? (idx === 0);
          const isInProgress = milestone.status === "in_progress";
          const isLocked = milestone.status === "locked";
          const isCompleted = milestone.status === "completed";
          const isSuperseded = milestone.status === "superseded";

          return (
            <div
              key={milestone.id}
              className={`glass-panel rounded-2xl border transition-all duration-200 ${
                isInProgress
                  ? "border-cyan-500/40 glow-cyan bg-slate-900/90"
                  : isCompleted
                  ? "border-emerald-500/30 bg-slate-900/60"
                  : isSuperseded
                  ? "border-amber-500/30 bg-slate-900/40 opacity-80"
                  : "border-slate-800/80 bg-slate-900/40 opacity-85"
              }`}
            >
              {/* Milestone Header */}
              <div
                onClick={() => toggleExpand(milestone.id)}
                className="p-4 lg:p-5 flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isInProgress
                        ? "bg-gradient-to-tr from-cyan-500 to-indigo-600 text-slate-950 font-black shadow-md glow-cyan"
                        : isCompleted
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : isSuperseded
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-sm font-bold ${isSuperseded ? "text-slate-300 line-through opacity-80" : "text-slate-100"}`}>
                        {milestone.title}
                      </h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          isInProgress
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                            : isCompleted
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : isSuperseded
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {isInProgress ? "In Progress" : isCompleted ? "Completed" : isSuperseded ? "Superseded" : "Locked"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{milestone.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      {milestone.estimatedHours}h
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      {milestone.estimatedWeeks}w
                    </span>
                  </div>

                  <button className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded Milestone Details */}
              {isExpanded && (
                <div className="px-4 lg:px-6 pb-6 pt-2 border-t border-slate-800/80 space-y-4 animate-in fade-in duration-200">
                  {/* Diagnostic Alert if needed */}
                  {milestone.isDiagnosticRequired && (
                    <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs text-amber-200">
                          Unverified prerequisite skill claimed: Take a quick 5-min diagnostic to skip foundational lessons.
                        </span>
                      </div>
                      <button
                        onClick={() => onOpenDiagnostic(milestone.skillIds[0])}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap transition-colors"
                      >
                        Take Diagnostic
                      </button>
                    </div>
                  )}

                  {/* Curated Resources */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                      Curated Learning Guides & Docs (Scored & Ranked):
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {milestone.resources.map((res) => (
                        <a
                          key={res.id}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl bg-slate-950/60 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all group flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                                {res.provider}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                {res.costType} • {res.durationHours}h
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition-colors flex items-center gap-1">
                              <span>{res.title}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                              {res.description}
                            </p>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-900 flex justify-between text-[10px] text-slate-400 font-mono">
                            <span>Score: {( (res.rankingScore || res.qualityScore) * 100).toFixed(0)}%</span>
                            <span>Format: {res.format.replace("_", " ")}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Practical Project Deliverables */}
                  {milestone.project && (
                    <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code2 className="w-4 h-4 text-indigo-400" />
                          <h4 className="text-xs font-bold text-indigo-200">
                            Practical Capstone Project: {milestone.project.title}
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-300">
                          {milestone.project.domainContext} • ~{milestone.project.estimatedHours}h
                        </span>
                      </div>

                      <p className="text-xs text-slate-300">{milestone.project.description}</p>

                      <div className="space-y-1 text-xs">
                        <span className="text-[11px] font-semibold text-slate-300">Key Deliverables:</span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-400 text-[11px]">
                          {milestone.project.deliverables.map((deliv, i) => (
                            <li key={i}>{deliv}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-1 text-xs pt-1 border-t border-indigo-900/40">
                        <span className="text-[11px] font-semibold text-emerald-400">
                          Verification Checklist:
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                          {milestone.project.verificationChecklist.map((chk, i) => (
                            <li key={i}>{chk}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Completion Action */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => onCompleteMilestone(milestone.id)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isCompleted
                          ? "bg-slate-800 text-slate-400 hover:text-white"
                          : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md glow-emerald"
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{isCompleted ? "Mark Incomplete" : "Mark Milestone Complete"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
