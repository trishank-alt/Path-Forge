"use client";

import React from "react";
import { Plus, Minus, Crosshair, RotateCcw } from "lucide-react";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenterOnMe: () => void;
  onResetView: () => void;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onCenterOnMe,
  onResetView,
}: MapControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 p-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800/80 shadow-lg">
      <button
        onClick={onZoomIn}
        className="p-2 rounded-lg text-slate-300 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors"
        title="Zoom In (+)"
        aria-label="Zoom in"
      >
        <Plus className="w-4 h-4" />
      </button>

      <button
        onClick={onZoomOut}
        className="p-2 rounded-lg text-slate-300 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors"
        title="Zoom Out (-)"
        aria-label="Zoom out"
      >
        <Minus className="w-4 h-4" />
      </button>

      <div className="h-px bg-slate-800 my-0.5" />

      <button
        onClick={onCenterOnMe}
        className="p-2 rounded-lg text-slate-300 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors"
        title="Center on Current Position"
        aria-label="Center on me"
      >
        <Crosshair className="w-4 h-4" />
      </button>

      <button
        onClick={onResetView}
        className="p-2 rounded-lg text-slate-300 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors"
        title="Reset Map View"
        aria-label="Reset view"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  );
}
