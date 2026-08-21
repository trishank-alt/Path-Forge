"use client";

import React, { useState } from "react";
import {
  Sliders,
  Sparkles,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  Layers,
  Calendar,
} from "lucide-react";
import { LearnerProfile, Roadmap, Scenario } from "@/lib/contracts";

interface ScenarioStudioProps {
  profile: LearnerProfile | null;
  roadmap: Roadmap | null;
  scenarios: Scenario[];
  onCreateScenario: (name: string, overrides: Scenario["overrides"]) => Promise<void>;
  onAdoptScenario: (scenario: Scenario) => void;
  isLoading: boolean;
}

export function ScenarioStudio({
  profile,
  roadmap,
  scenarios,
  onCreateScenario,
  onAdoptScenario,
  isLoading,
}: ScenarioStudioProps) {
  const [hoursPerWeek, setHoursPerWeek] = useState(profile?.constraints.hoursPerWeek || 8);
  const [selectedDomain, setSelectedDomain] = useState<string>(
    roadmap?.targetPathId || "backend_enterprise_java"
  );
  const [scenarioName, setScenarioName] = useState("Reduced Pace (4h/wk)");

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roadmap) return;
    await onCreateScenario(scenarioName, {
      hoursPerWeek,
      targetDomain: selectedDomain,
    });
  };

  if (!roadmap) {
    return (
      <div className="glass-panel rounded-2xl border border-slate-800 p-8 text-center space-y-3">
        <Sliders className="w-10 h-10 text-slate-500 mx-auto" />
        <h3 className="text-base font-semibold text-slate-200">What-If Scenario Studio</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Please generate an initial roadmap first. Then use this studio to simulate schedule changes, specialization pivots, or tech stack variations without modifying your baseline roadmap.
        </p>
      </div>
    );
  }

  const latestScenario = scenarios[scenarios.length - 1];

  return (
    <div className="space-y-6">
      {/* Simulation Controls Card */}
      <div className="glass-panel rounded-2xl border border-slate-800 p-4 lg:p-6 space-y-5 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-indigo-950/40">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Non-Destructive What-If Simulator</h2>
            <p className="text-xs text-slate-400">
              Simulate trade-offs in time, tech stack, or specialization. The active plan is never mutated until adopted.
            </p>
          </div>
        </div>

        <form onSubmit={handleSimulate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Scenario Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Scenario Title:</label>
              <input
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="e.g. 4h/week Weekend Pace"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Weekly Pace Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300">Weekly Availability:</span>
                <span className="text-cyan-300 font-mono">{hoursPerWeek} hours/week</span>
              </div>
              <input
                type="range"
                min="2"
                max="40"
                step="2"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>2h (Casual)</span>
                <span>8h (Standard)</span>
                <span>20h+ (Intensive)</span>
              </div>
            </div>

            {/* Specialization Domain */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Target Track:</label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="backend_enterprise_java">Enterprise Java & ERP Architect</option>
                <option value="backend_web_product_node">Modern Web Product & Node.js</option>
                <option value="backend_python_cloud">Python Cloud & Async Services</option>
                <option value="cybersecurity_defensive_redteam">Defensive Security & Lab Track</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md glow-cyan transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulate Scenario Diff</span>
            </button>
          </div>
        </form>
      </div>

      {/* Latest Scenario Diff Inspection */}
      {latestScenario && (
        <div className="glass-panel rounded-2xl border border-indigo-500/40 p-4 lg:p-6 space-y-4 glow-purple animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase font-bold text-indigo-400">
                  Scenario Diff:
                </span>
                <h3 className="text-base font-bold text-slate-100">{latestScenario.name}</h3>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{latestScenario.diff.summary}</p>
            </div>

            <button
              onClick={() => onAdoptScenario(latestScenario)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md glow-emerald transition-all shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Adopt as Active Plan</span>
            </button>
          </div>

          {/* Metrics Delta Comparison */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Estimated Weeks</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold font-mono text-slate-100">
                  {latestScenario.computedRoadmap.totalEstimatedWeeks} wks
                </span>
                <span
                  className={`text-xs font-mono font-semibold flex items-center ${
                    latestScenario.diff.weeksDelta > 0
                      ? "text-rose-400"
                      : latestScenario.diff.weeksDelta < 0
                      ? "text-emerald-400"
                      : "text-slate-400"
                  }`}
                >
                  {latestScenario.diff.weeksDelta > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {latestScenario.diff.weeksDelta > 0
                    ? `+${latestScenario.diff.weeksDelta}`
                    : latestScenario.diff.weeksDelta}
                  w
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Total Effort</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold font-mono text-slate-100">
                  {latestScenario.computedRoadmap.totalEstimatedHours} hrs
                </span>
                <span className="text-xs font-mono text-slate-400">
                  ({latestScenario.computedRoadmap.weeklyPaceHours}h/wk)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Added Skills</span>
              <span className="text-base font-bold font-mono text-emerald-400 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                {latestScenario.diff.addedSkillIds.length} skills
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">Removed Skills</span>
              <span className="text-base font-bold font-mono text-rose-400 flex items-center gap-1">
                <Minus className="w-3.5 h-3.5" />
                {latestScenario.diff.removedSkillIds.length} skills
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
