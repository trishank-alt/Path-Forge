"use client";

import React, { useState } from "react";
import {
  Send,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  Tag,
  ArrowRight,
  Loader2,
  Info,
  Sliders,
} from "lucide-react";
import { LearnerProfile, QuestionDecision } from "@/lib/contracts";

interface IntakeChatProps {
  profile: LearnerProfile | null;
  activeQuestion: QuestionDecision | null;
  onSendMessage: (message: string) => Promise<void>;
  onAnswerQuestion: (dimension: string, answer: string | string[]) => Promise<void>;
  isLoading: boolean;
}

export function IntakeChat({
  profile,
  activeQuestion,
  onSendMessage,
  onAnswerQuestion,
  isLoading,
}: IntakeChatProps) {
  const [inputText, setInputText] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const msg = inputText.trim();
    setInputText("");
    await onSendMessage(msg);
  };

  const handleOptionClick = async (option: string) => {
    if (!activeQuestion || isLoading) return;
    setSelectedOption(option);
    await onAnswerQuestion(activeQuestion.selectedQuestion.dimension, option);
    setSelectedOption(null);
  };

  const activeFacts = profile?.facts.filter((f) => f.status === "active") || [];
  const status = profile?.intent.status || "clarifying";

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-slate-800 p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Conversational Discovery</h2>
            <p className="text-[11px] text-slate-400">
              Discovers true intent before advising • Information-gain clarification
            </p>
          </div>
        </div>

        <span className="text-xs px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
          Personalized discovery
        </span>
      </div>

      {/* Extracted Facts Live Chips */}
      {activeFacts.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
            <Tag className="w-3.5 h-3.5 text-cyan-400" />
            <span>Attributable Profile Facts ({activeFacts.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {activeFacts.map((fact) => (
              <span
                key={fact.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-800/80 border border-slate-700/60 text-slate-200"
              >
                <span className="text-cyan-400 font-semibold">{fact.dimension}:</span>
                <span className="text-slate-300">{fact.rawValue}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({(fact.reliability * 100).toFixed(0)}%)
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Clarification State Leading Hypothesis Notice */}
      {status === "clarifying" && (
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-xs text-slate-300 flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            <strong className="text-cyan-300 font-semibold">Status: </strong>
            We have a leading hypothesis, but need a few details before recommending a learning path.
          </span>
        </div>
      )}

      {/* Active Clarification Question Banner */}
      {status !== "ready" && activeQuestion && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-cyan-950/40 border border-cyan-500/30 glow-cyan animate-in fade-in duration-300 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-cyan-500/20 text-cyan-300">
                <HelpCircle className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                A quick question
              </span>
            </div>
          </div>

          <p className="text-sm font-medium text-slate-100 leading-relaxed">
            {activeQuestion.selectedQuestion.question}
          </p>

          {/* Why This Question Matters */}
          <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-cyan-300 font-semibold">Why this matters: </strong>
              {activeQuestion.selectedQuestion.why}
            </span>
          </div>

          {/* Quick Select Option Badges */}
          {activeQuestion.selectedQuestion.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {activeQuestion.selectedQuestion.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(opt)}
                  disabled={isLoading}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/80 hover:bg-cyan-950/50 border border-slate-700 hover:border-cyan-500/50 text-left text-xs font-medium text-slate-200 hover:text-cyan-200 transition-all group"
                >
                  <span className="pr-2">{opt}</span>
                  {selectedOption === opt ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Threshold Gate Passed Alert (ONLY shown when status === ready) */}
      {status === "ready" && (
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 glow-emerald space-y-2">
          <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Your learning path is ready</span>
          </div>
          <p className="text-xs text-slate-300">
            {profile?.intent.confidence.explanation}
          </p>
        </div>
      )}

      {/* Provisional Plan Notice (ONLY shown when status === provisional and no activeQuestion) */}
      {status === "provisional" && !activeQuestion && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5 text-amber-400" />
            <span>Your starter learning path is ready</span>
          </div>
          <p className="text-xs text-slate-300">
            {profile?.intent.confidence.explanation}
          </p>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmitMessage} className="mt-auto pt-2 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            status !== "ready"
              ? "Answer question or provide free-text details..."
              : "Refine your goal or add new constraints..."
          }
          disabled={isLoading}
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/80 transition-colors"
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md glow-cyan"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
          ) : (
            <>
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
