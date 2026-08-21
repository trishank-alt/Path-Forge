"use client";

import React from "react";
import {
  ShieldCheck,
  Percent,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  SlidersHorizontal,
  FileCheck2,
  TrendingUp,
} from "lucide-react";
import { ConfidenceBreakdown, PathHypothesis } from "@/lib/contracts";

interface ConfidenceRadarProps {
  confidence: ConfidenceBreakdown | null;
  hypotheses: PathHypothesis[];
}

export function ConfidenceRadar({ confidence, hypotheses }: ConfidenceRadarProps) {
  const finalScore = confidence?.finalScore || 0;
  const topProb = confidence?.topProbability || 0;
  const coverage = confidence?.coverageFactor || 0;
  const consistency = confidence?.consistencyFactor || 1;
  const evidenceQuality = confidence?.evidenceQualityFactor || 0.7;
  const status = confidence?.status || "clarifying";

  const getScoreColor = () => {
    if (finalScore >= 0.8) return "text-emerald-400 border-emerald-500/50 bg-emerald-500/10";
    if (finalScore >= 0.55) return "text-amber-400 border-amber-500/50 bg-amber-500/10";
    return "text-cyan-400 border-cyan-500/50 bg-cyan-500/10";
  };

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 p-4 lg:p-6 space-y-5">
      {/* Header & Main Score Gauge */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Intent Confidence Engine</h3>
            <p className="text-[11px] text-slate-400">Deterministic Mathematical Policy Breakdown</p>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${getScoreColor()} font-mono font-bold text-xs`}>
          <Percent className="w-3.5 h-3.5" />
          <span>
            {status === "ready"
              ? `Confidence: ${(finalScore * 100).toFixed(1)}%`
              : `Overall Score: ${(finalScore * 100).toFixed(1)}%`}
          </span>
        </div>
      </div>

      {/* Progress Bar towards 0.80 Gate */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-medium">
          <span className="text-slate-400">
            {status === "ready"
              ? "Recommendation Readiness Gate Passed (≥ 80%):"
              : "Readiness Gate (Requires Likelihood ≥ 80%, Cov ≥ 75%, Const ≥ 80%, 0 Missing Dims):"}
          </span>
          <span className="text-cyan-300 font-mono font-semibold">
            {(finalScore * 100).toFixed(0)}% / 80%
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
          {/* Gate Marker at 80% */}
          <div className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-rose-500/80 z-10" title="0.80 Gate" />
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              finalScore >= 0.8
                ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm glow-emerald"
                : finalScore >= 0.55
                ? "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-sm"
                : "bg-gradient-to-r from-cyan-500 to-indigo-500 shadow-sm glow-cyan"
            }`}
            style={{ width: `${Math.min(100, Math.max(5, finalScore * 100))}%` }}
          />
        </div>
      </div>

      {/* Mathematical Factor Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            <span>Hypothesis</span>
          </div>
          <p className="text-sm font-bold font-mono text-cyan-300">
            {(topProb * 100).toFixed(0)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Leading hypothesis likelihood</p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
            <SlidersHorizontal className="w-3 h-3 text-indigo-400" />
            <span>Coverage</span>
          </div>
          <p className="text-sm font-bold font-mono text-indigo-300">
            {(coverage * 100).toFixed(0)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Required dims known</p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span>Consistency</span>
          </div>
          <p className="text-sm font-bold font-mono text-emerald-300">
            {(consistency * 100).toFixed(0)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">No contradictions</p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
            <FileCheck2 className="w-3 h-3 text-purple-400" />
            <span>Evidence Q</span>
          </div>
          <p className="text-sm font-bold font-mono text-purple-300">
            {(evidenceQuality * 100).toFixed(0)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Source reliability</p>
        </div>
      </div>

      {/* Target Path Hypotheses Distribution */}
      <div className="space-y-2 pt-1 border-t border-slate-800/80">
        <span className="text-xs font-semibold text-slate-300">Path Hypotheses Distribution:</span>
        <div className="space-y-1.5">
          {hypotheses.map((h) => (
            <div key={h.pathId} className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-300 font-medium truncate max-w-[200px]">
                  {h.pathTitle}
                </span>
                <span className="font-mono text-cyan-400 font-semibold">
                  {(h.posteriorProbability * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500/70 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(2, h.posteriorProbability * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Missing Dimensions & Assumptions */}
      {confidence?.missingDimensions && confidence.missingDimensions.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-amber-400 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Missing Decision Dimensions:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {confidence.missingDimensions.map((dim) => (
              <span
                key={dim}
                className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/50 text-amber-300 text-[11px] font-mono"
              >
                {dim}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
