"use client";

import React, { useState, useEffect } from "react";
import { X, Terminal, RefreshCw, Layers, ShieldCheck, Activity } from "lucide-react";
import { DecisionAuditEvent } from "@/lib/persistence/repositories";

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuditLogModal({ isOpen, onClose }: AuditLogModalProps) {
  const [events, setEvents] = useState<DecisionAuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/audit");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error("Failed to load audit events:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEvents();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[85vh] glass-panel rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 lg:p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Decision & Mathematical Audit Trail</h3>
              <p className="text-xs text-slate-400">
                Transparent log of entropy calculations, policy gating evaluations, and state transitions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchEvents}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Audit Log Entries */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-3 font-mono text-xs">
          {events.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No audit events recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="text-purple-400 font-bold uppercase">{event.eventType}</span>
                    <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <pre className="text-[11px] text-slate-300 overflow-x-auto bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    {JSON.stringify(event.details, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
