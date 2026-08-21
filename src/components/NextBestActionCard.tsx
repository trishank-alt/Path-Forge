"use client";

import React from "react";
import {
  Flame,
  Clock,
  TrendingDown,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  HelpCircle,
} from "lucide-react";
import { NextBestAction } from "@/lib/contracts";

interface NextBestActionCardProps {
  action: NextBestAction | null;
  onExecuteAction: (action: NextBestAction) => void;
}

export function NextBestActionCard({ action, onExecuteAction }: NextBestActionCardProps) {
  if (!action) return null;

  const getIcon = () => {
    switch (action.type) {
      case "assessment":
        return CheckCircle2;
      case "project_task":
        return Code2;
      case "clarification":
        return HelpCircle;
      default:
        return BookOpen;
    }
  };

  const ActionIcon = getIcon();

  return (
    <div className="glass-panel rounded-2xl border border-cyan-500/30 p-4 lg:p-5 glow-cyan bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Action Details */}
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-slate-950 font-bold shadow-md shrink-0">
            <ActionIcon className="w-5 h-5 text-slate-950" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                <Flame className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
                Next-Best Action (NBA)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 font-mono">
                {action.type.replace("_", " ")}
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-100">{action.title}</h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {action.description}
            </p>

            <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 flex-wrap">
              <span className="flex items-center gap-1 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                {action.estimatedMinutes} mins
              </span>
              <span className="flex items-center gap-1 text-emerald-300">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                -{(action.expectedGapReduction * 100).toFixed(0)}% Skill Gap
              </span>
              <span className="text-[11px] text-slate-400 italic">
                <strong>Why now: </strong>
                {action.whyNow}
              </span>
            </div>
          </div>
        </div>

        {/* Action CTA */}
        <div className="sm:self-center shrink-0">
          <button
            onClick={() => onExecuteAction(action)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md glow-cyan transition-all"
          >
            <span>Start Action</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
