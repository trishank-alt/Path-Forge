"use client";

import React, { useState } from "react";
import {
  X,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Check,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { ProfileFact } from "@/lib/contracts";

interface FactInspectorModalProps {
  facts: ProfileFact[];
  isOpen: boolean;
  onClose: () => void;
  onCorrectFact: (factId: string, newValue: any, reason?: string) => Promise<void>;
  onRevokeFact: (factId: string) => Promise<void>;
}

export function FactInspectorModal({
  facts,
  isOpen,
  onClose,
  onCorrectFact,
  onRevokeFact,
}: FactInspectorModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");

  if (!isOpen) return null;

  const startEdit = (fact: ProfileFact) => {
    setEditingId(fact.id);
    setEditValue(typeof fact.normalizedValue === "string" ? fact.normalizedValue : JSON.stringify(fact.normalizedValue));
    setEditReason("");
  };

  const saveEdit = async (factId: string) => {
    await onCorrectFact(factId, editValue, editReason || "User explicit correction in fact inspector");
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[85vh] glass-panel rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 lg:p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Profile Fact Provenance & Audit Ledger</h3>
              <p className="text-xs text-slate-400">
                Inspect, correct, or revoke attributable learner profile facts with immediate reactive re-scoring
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fact Table */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-3">
          {facts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No profile facts stored yet. Complete conversational discovery to generate attributable facts.
            </div>
          ) : (
            <div className="space-y-2.5">
              {facts.map((fact) => {
                const isEditing = editingId === fact.id;
                const isRevoked = fact.status === "revoked";
                const isSuperseded = fact.status === "superseded";

                return (
                  <div
                    key={fact.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isRevoked
                        ? "bg-rose-950/10 border-rose-900/30 opacity-60 line-through"
                        : isSuperseded
                        ? "bg-slate-900/40 border-slate-800 opacity-60"
                        : "bg-slate-900/80 border-slate-700/80 hover:border-cyan-500/40"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-cyan-400 font-mono">
                          {fact.dimension}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          source: {fact.source}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                          reliability: {(fact.reliability * 100).toFixed(0)}%
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            fact.status === "active"
                              ? "bg-emerald-950/60 border border-emerald-800/50 text-emerald-300"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {fact.status}
                        </span>
                      </div>

                      {/* Actions */}
                      {fact.status === "active" && !isEditing && (
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <button
                            onClick={() => startEdit(fact)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-700 text-xs flex items-center gap-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => onRevokeFact(fact.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                              Corrected Value:
                            </label>
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                              Reason for Correction:
                            </label>
                            <input
                              type="text"
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              placeholder="e.g. Switched focus to Java ERP"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(fact.id)}
                            className="px-3 py-1 rounded-lg text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save Correction</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs space-y-1">
                        <div className="text-slate-200 font-medium">
                          <strong>Normalized: </strong>
                          {JSON.stringify(fact.normalizedValue)}
                        </div>
                        <div className="text-slate-400 text-[11px] italic">
                          <strong>Evidence snippet: </strong>"{fact.evidence}"
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
