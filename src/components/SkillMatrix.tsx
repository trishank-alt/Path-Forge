"use client";

import React, { useState } from "react";
import {
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Search,
  CheckCircle2,
  Award,
  Layers,
} from "lucide-react";
import { CompetencyRecord, SkillNode } from "@/lib/contracts";
import { SEEDED_SKILLS } from "@/lib/persistence/seed-data";

interface SkillMatrixProps {
  competencies: CompetencyRecord[];
  onOpenDiagnostic: (skillId: string) => void;
}

export function SkillMatrix({ competencies, onOpenDiagnostic }: SkillMatrixProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const competencyMap = new Map<string, CompetencyRecord>();
  for (const comp of competencies) {
    competencyMap.set(comp.skillId, comp);
  }

  const categories = ["all", ...Array.from(new Set(SEEDED_SKILLS.map((s) => s.category)))];

  const filteredSkills = SEEDED_SKILLS.filter((skill) => {
    const matchesSearch =
      skill.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === "all" || skill.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 p-4 lg:p-6 space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Award className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-100">Competency & Skill Matrix</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparent distinction between verified evidence, stated claims, and identified gaps
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search 80+ skills..."
              className="bg-slate-900 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All Categories" : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Competency Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <strong className="text-emerald-300">Verified Evidence</strong> (Diagnostic/Artifact)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <strong className="text-amber-300">Claimed</strong> (Self-Reported / Unverified)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
          <strong className="text-slate-400">Identified Gap</strong> (Not yet covered)
        </span>
      </div>

      {/* Skill Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredSkills.map((skill) => {
          const comp = competencyMap.get(skill.id);
          const isVerified = comp?.status === "assessed_diagnostic" || comp?.status === "verified_artifact";
          const isClaimed = comp?.claimedLevel && comp.claimedLevel !== "none" && !isVerified;

          return (
            <div
              key={skill.id}
              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                isVerified
                  ? "bg-emerald-950/20 border-emerald-500/40 glow-emerald"
                  : isClaimed
                  ? "bg-amber-950/20 border-amber-500/40"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                    {skill.category}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isVerified
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : isClaimed
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {isVerified
                      ? "Verified"
                      : isClaimed
                      ? `Claimed (${comp?.claimedLevel})`
                      : `Level ${skill.level}`}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-100">{skill.title}</h4>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{skill.description}</p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {skill.tags.slice(0, 2).map((t) => (
                    <span
                      key={t}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400"
                    >
                      #{t}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => onOpenDiagnostic(skill.id)}
                  className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline"
                >
                  {isVerified ? "Re-test" : "Verify Skill"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
