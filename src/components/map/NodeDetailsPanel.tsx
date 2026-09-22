"use client";

import React from "react";
import {
  X,
  Award,
  Sparkles,
  FileCheck,
  Calendar,
  Layers,
  ArrowRight,
  MessageSquareQuote,
  ShieldCheck,
  Compass,
} from "lucide-react";
import { MapNodeViewModel } from "./map-layout-adapter";

interface NodeDetailsPanelProps {
  node: MapNodeViewModel | null;
  onClose: () => void;
  onAskAboutNode?: (nodeLabel: string) => void;
  onSelectConnectedNode?: (nodeId: string) => void;
  allNodesMap?: Map<string, MapNodeViewModel>;
}

export function NodeDetailsPanel({
  node,
  onClose,
  onAskAboutNode,
  onSelectConnectedNode,
  allNodesMap,
}: NodeDetailsPanelProps) {
  if (!node) return null;

  const getStatusBadge = () => {
    switch (node.status) {
      case "current":
        return {
          label: "Current Position",
          color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
          desc: "Your active focal area in the career space",
        };
      case "developing":
        return {
          label: "Developing",
          color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
          desc: "Targeted by your active learning intervention",
        };
      case "demonstrated":
        return {
          label: "Demonstrated",
          color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
          desc: "Supported by practical deliverables and verified evidence",
        };
      case "explored":
        return {
          label: "Explored",
          color: "bg-amber-500/15 text-amber-300 border-amber-500/30",
          desc: "Investigated in prior phases and preserved in your history",
        };
      case "emerging":
      default:
        return {
          label: "Emerging",
          color: "bg-slate-700/40 text-slate-300 border-slate-600/40",
          desc: "Inferred from initial conversation or technical responses",
        };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="absolute top-4 right-4 z-30 w-80 sm:w-96 max-h-[calc(100%-2rem)] flex flex-col rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-start justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadge.color}`}
            >
              {statusBadge.label}
            </span>
            {node.level && (
              <span className="text-[10px] font-mono text-slate-400 capitalize px-2 py-0.5 rounded bg-slate-800/80">
                {node.level}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-slate-100 leading-snug">{node.label}</h3>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="p-4 space-y-4 overflow-y-auto text-xs scrollbar-thin scrollbar-thumb-slate-700">
        {/* Why this appears */}
        <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Why this appears on your map
          </span>
          <p className="text-slate-300 leading-relaxed text-xs">
            {node.description || statusBadge.desc}
          </p>
        </div>

        {/* Supporting Evidence Provenance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Supporting Evidence ({node.evidence.length})
            </span>
          </div>

          {node.evidence.length > 0 ? (
            <div className="space-y-2">
              {node.evidence.map((ev, i) => (
                <div
                  key={ev.id || i}
                  className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="capitalize text-cyan-400 font-semibold">
                      {ev.source.replace(/_/g, " ")}
                    </span>
                    {ev.timestamp && (
                      <span>
                        {new Date(ev.timestamp).toLocaleDateString([], {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-200 text-xs leading-snug">
                    {ev.explanation || (typeof ev.signal === "string" ? ev.signal : "Demonstrated capability")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 italic text-xs p-2 rounded-lg bg-slate-950/40">
              No direct demonstration artifacts yet. This area will strengthen as you complete hands-on deliverables.
            </p>
          )}
        </div>

        {/* Related Capabilities */}
        {node.connectedNodeIds.length > 0 && allNodesMap && (
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Connected Capabilities
            </span>
            <div className="flex flex-wrap gap-1.5">
              {node.connectedNodeIds.map((connId) => {
                const connNode = allNodesMap.get(connId);
                if (!connNode || connNode.id === node.id) return null;
                return (
                  <button
                    key={connId}
                    onClick={() => onSelectConnectedNode?.(connId)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-[11px] font-medium transition-colors flex items-center gap-1"
                  >
                    <span>{connNode.label}</span>
                    <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Action */}
      {onAskAboutNode && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 shrink-0">
          <button
            onClick={() => onAskAboutNode(node.label)}
            className="w-full py-2 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <MessageSquareQuote className="w-3.5 h-3.5" />
            <span>Ask PathForge about {node.label}</span>
          </button>
        </div>
      )}
    </div>
  );
}
