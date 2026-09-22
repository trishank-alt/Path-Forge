"use client";

import React, { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";

export function MapLegend() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute top-4 left-4 z-20">
      <div className="rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-800/80 shadow-lg text-xs overflow-hidden transition-all duration-200">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white transition-colors w-full text-left"
          title="Toggle Legend"
        >
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-300">
            Map Legend
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500 ml-auto" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-auto" />
          )}
        </button>

        {isExpanded && (
          <div className="p-3 pt-1 border-t border-slate-800/60 space-y-2 text-[11px] animate-in fade-in duration-150">
            {/* Current Focus */}
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-cyan-400 bg-cyan-950 flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              </span>
              <div>
                <span className="font-semibold text-cyan-300">Current Position</span>
                <p className="text-[10px] text-slate-400">Active area of work or exploration</p>
              </div>
            </div>

            {/* Developing */}
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 bg-indigo-950/80 shrink-0" />
              <div>
                <span className="font-semibold text-indigo-300">Developing</span>
                <p className="text-[10px] text-slate-400">Targeted by current learning intervention</p>
              </div>
            </div>

            {/* Demonstrated */}
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-400 shrink-0" />
              <div>
                <span className="font-semibold text-emerald-300">Demonstrated</span>
                <p className="text-[10px] text-slate-400">Verified through completed deliverables</p>
              </div>
            </div>

            {/* Emerging */}
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border border-dashed border-slate-400 bg-slate-800/50 shrink-0" />
              <div>
                <span className="font-semibold text-slate-300">Emerging</span>
                <p className="text-[10px] text-slate-400">Early signal or self-reported curiosity</p>
              </div>
            </div>

            {/* Explored */}
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border border-amber-600/60 bg-amber-950/30 shrink-0" />
              <div>
                <span className="font-semibold text-amber-300/80">Explored</span>
                <p className="text-[10px] text-slate-400">Preserved from superseded phases</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
