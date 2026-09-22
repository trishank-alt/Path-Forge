"use client";

import React, { useState } from "react";
import { History, CheckCircle2, ArrowUpRight, ChevronDown, ChevronUp, Compass } from "lucide-react";
import { RoadmapPhase } from "@/lib/contracts";

interface JourneyHistoryProps {
  activePhase: RoadmapPhase | null;
  phaseHistory: RoadmapPhase[];
  className?: string;
}

export function JourneyHistory({
  activePhase,
  phaseHistory = [],
  className = "",
}: JourneyHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const completedPhases = phaseHistory.filter((p) => p.status === "completed");
  const supersededPhases = phaseHistory.filter((p) => p.status === "superseded");
  const totalHistoryCount = completedPhases.length + supersededPhases.length;

  if (totalHistoryCount === 0 && !activePhase) {
    return null;
  }

  return (
    <div className={`rounded-xl bg-slate-900/70 border border-slate-800/80 overflow-hidden ${className}`}>
      {/* Accordion Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between text-left text-xs font-semibold text-slate-300 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <span>Journey History ({totalHistoryCount + (activePhase ? 1 : 0)})</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Expanded Journey Timeline */}
      {isExpanded && (
        <div className="p-3 pt-1 border-t border-slate-800/80 space-y-2.5 text-xs animate-in fade-in duration-150">
          {/* Active Phase in Journey */}
          {activePhase && (
            <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-500/30 flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-cyan-200 truncate">
                    Phase {activePhase.phaseNumber}: {activePhase.objective}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                    Current Focus
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Active intervention in progress.</p>
              </div>
            </div>
          )}

          {/* Historical Completed Phases */}
          {completedPhases.map((phase) => (
            <div
              key={phase.id}
              className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-emerald-200 truncate">
                    Phase {phase.phaseNumber}: {phase.objective}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                    Completed
                  </span>
                </div>
                <p className="text-[11px] text-emerald-300/80 mt-0.5">
                  Demonstrated capabilities verified by practical deliverable.
                </p>
              </div>
            </div>
          ))}

          {/* Historical Superseded Phases */}
          {supersededPhases.map((phase) => (
            <div
              key={phase.id}
              className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 flex items-start gap-2.5"
            >
              <ArrowUpRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-amber-200 line-through opacity-85 truncate">
                    Phase {phase.phaseNumber}: {phase.objective}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                    Superseded
                  </span>
                </div>
                <p className="text-[11px] text-amber-300/90 mt-0.5 leading-snug">
                  <strong>Why:</strong> {phase.supersessionReason || "Direction changed after evaluation and reflection."}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
