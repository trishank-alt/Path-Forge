"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Cpu,
  Zap,
  Settings2,
  Bot,
  User,
  FlaskConical,
  Info,
  CheckCircle2,
} from "lucide-react";
import {
  LearnerProfile,
  ProfileFact,
  QuestionDecision,
  RoadmapDecision,
  FeasibilityResult,
} from "@/lib/contracts";
import { InlinePlanningEvent } from "@/lib/conversational/dialogue-translator";

export interface ChatMessageItem {
  id: string;
  sender: "user" | "assistant" | "error";
  text: string;
  timestamp: string;
  inlineEvent?: InlinePlanningEvent;
  suggestedChips?: string[];
  transparentReasoning?: string;
  facts?: ProfileFact[];
  question?: QuestionDecision | null;
  decision?: RoadmapDecision | null;
  feasibility?: FeasibilityResult | null;
  executionMetadata?: {
    provider: string;
    modelName: string;
    latencyMs?: number;
    fallbackUsed?: boolean;
    failureCategory?: string;
  } | null;
  status?: string;
  errorMessage?: string;
  errorProvider?: string;
}

interface IntakeChatProps {
  profile: LearnerProfile | null;
  activeQuestion: QuestionDecision | null;
  messages: ChatMessageItem[];
  onSendMessage: (message: string) => Promise<void>;
  onAnswerQuestion: (dimension: string, answer: string | string[]) => Promise<void>;
  isLoading: boolean;
  onOpenSettings?: () => void;
  onSwitchToDeterministic?: () => Promise<void>;
  onRetryLastAction?: () => Promise<void>;
}

export function IntakeChat({
  profile,
  activeQuestion,
  messages,
  onSendMessage,
  onAnswerQuestion,
  isLoading,
  onOpenSettings,
  onSwitchToDeterministic,
  onRetryLastAction,
}: IntakeChatProps) {
  const [inputText, setInputText] = useState("");
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const msg = inputText.trim();
    setInputText("");
    await onSendMessage(msg);
  };

  const handleChipClick = async (chipText: string, dimension?: string) => {
    if (isLoading) return;
    if (dimension && activeQuestion) {
      await onAnswerQuestion(dimension, chipText);
    } else {
      await onSendMessage(chipText);
    }
  };

  const toggleReasoning = (id: string) => {
    setExpandedReasoningIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const hasActiveIntervention = Boolean(profile?.activePhase);

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-slate-800 p-4 lg:p-5 space-y-3">
      {/* Conversational Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Conversation</h2>
            <p className="text-[11px] text-slate-400">
              {hasActiveIntervention
                ? "Adaptive planning & reflection navigator"
                : "Open exploration & interest discovery"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-300 text-xs flex items-center gap-1.5 transition-all"
              title="Configure AI Models & Keys"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}

          <span
            className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
              hasActiveIntervention
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                : "bg-slate-800/80 border-slate-700 text-slate-300"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                hasActiveIntervention ? "bg-cyan-400 animate-pulse" : "bg-slate-400"
              }`}
            />
            <span>{hasActiveIntervention ? "Active Intervention" : "Discovery"}</span>
          </span>
        </div>
      </div>

      {/* Scrollable Message Thread */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-lg glow-cyan">
              <Bot className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="text-base font-semibold text-slate-100">
                Welcome to PathForge
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                I'm here to help you figure out what engineering work genuinely fits you.
                Tell me what problems, technologies, or projects you're thinking about—or share if you're not sure where to begin.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-lg">
              {[
                "I'm curious about backend & APIs",
                "AI engineering looks interesting",
                "I have no idea what career I want",
                "I enjoyed debugging today",
              ].map((starter, i) => (
                <button
                  key={i}
                  onClick={() => handleChipClick(starter)}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-cyan-950/60 border border-slate-700 text-xs text-slate-300 hover:text-cyan-200 transition-all text-left"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === "user" ? "items-end" : "items-start"
            } space-y-1.5 animate-in fade-in duration-200`}
          >
            {/* Sender Label & Timestamp */}
            <div className="flex items-center gap-1.5 px-1 text-[10px] text-slate-400">
              {msg.sender === "user" ? (
                <>
                  <span className="font-semibold text-slate-300">You</span>
                  <User className="w-3 h-3 text-slate-400" />
                </>
              ) : msg.sender === "error" ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span className="font-semibold text-red-400">Execution Notice</span>
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-cyan-400" />
                  <span className="font-semibold text-cyan-300">PathForge</span>
                  {msg.executionMetadata && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono">
                      {msg.executionMetadata.provider === "groq" ? (
                        <Zap className="w-2.5 h-2.5 text-amber-400" />
                      ) : msg.executionMetadata.provider === "gemini" ? (
                        <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                      ) : (
                        <Cpu className="w-2.5 h-2.5 text-indigo-400" />
                      )}
                      <span>
                        {msg.executionMetadata.provider === "groq"
                          ? `Groq (${msg.executionMetadata.modelName})`
                          : msg.executionMetadata.provider === "gemini"
                          ? `Gemini (${msg.executionMetadata.modelName})`
                          : "Deterministic Engine"}
                      </span>
                    </span>
                  )}
                </>
              )}
              <span>• {msg.timestamp}</span>
            </div>

            {/* Message Bubble: USER */}
            {msg.sender === "user" && (
              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2.5 text-xs sm:text-sm text-white shadow-md leading-relaxed font-medium">
                {msg.text}
              </div>
            )}

            {/* Message Bubble: ASSISTANT */}
            {msg.sender === "assistant" && (
              <div className="w-full max-w-[95%] rounded-2xl rounded-tl-sm bg-slate-900/90 border border-slate-800 p-4 text-xs sm:text-sm text-slate-200 shadow-md space-y-3">
                {/* Conversational Text */}
                <p className="leading-relaxed text-slate-100 whitespace-pre-wrap">
                  {msg.text}
                </p>

                {/* Inline Planning Event Card: PLAN UPDATED */}
                {msg.inlineEvent?.type === "plan_updated" && (
                  <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <RotateCcw className="w-4 h-4 text-amber-400" />
                      <span>{msg.inlineEvent.title || "PLAN UPDATED"}</span>
                    </div>

                    <div className="space-y-1.5 text-slate-300">
                      {msg.inlineEvent.previousPhaseTitle && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="line-through text-slate-400 font-semibold">
                            {msg.inlineEvent.previousPhaseTitle}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                            SUPERSEDED
                          </span>
                        </div>
                      )}

                      {msg.inlineEvent.reason && (
                        <p className="text-[11px] text-amber-200/90 leading-snug">
                          <strong>Reason:</strong> {msg.inlineEvent.reason}
                        </p>
                      )}

                      {msg.inlineEvent.newPhaseTitle && (
                        <div className="pt-1.5 border-t border-amber-900/40 space-y-0.5">
                          <span className="text-[10px] text-slate-400 block uppercase font-mono">
                            New Intervention Focus:
                          </span>
                          <p className="font-bold text-cyan-300 text-xs sm:text-sm">
                            {msg.inlineEvent.newPhaseTitle}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Inline Planning Event Card: NEW INTERVENTION ACTIVATED */}
                {msg.inlineEvent?.type === "new_phase" && (
                  <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/40 glow-cyan text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>{msg.inlineEvent.title || "INTERVENTION ACTIVATED"}</span>
                    </div>

                    <p className="font-bold text-slate-100 text-xs sm:text-sm">
                      {msg.inlineEvent.newPhaseTitle}
                    </p>

                    {msg.inlineEvent.duration && (
                      <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {msg.inlineEvent.duration}
                      </span>
                    )}

                    {msg.inlineEvent.newPhaseGoal && (
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {msg.inlineEvent.newPhaseGoal}
                      </p>
                    )}
                  </div>
                )}

                {/* Inline Planning Event Card: PRACTICAL EXPERIMENT PROPOSED */}
                {msg.inlineEvent?.type === "experiment_proposed" && (
                  <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/40 glow-purple text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-purple-300">
                        <FlaskConical className="w-4 h-4 text-purple-400" />
                        <span>{msg.inlineEvent.title || "PRACTICAL EXPERIMENT PROPOSED"}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-500/30 text-purple-200">
                        ~{msg.inlineEvent.experimentDurationMinutes || 60} mins
                      </span>
                    </div>

                    <p className="font-bold text-slate-100 text-xs sm:text-sm">
                      {msg.inlineEvent.experimentTitle}
                    </p>

                    {msg.inlineEvent.experimentGoal && (
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {msg.inlineEvent.experimentGoal}
                      </p>
                    )}
                  </div>
                )}

                {/* Interactive Suggested Chips */}
                {msg.suggestedChips && msg.suggestedChips.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {msg.suggestedChips.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleChipClick(chip, msg.question?.selectedQuestion?.dimension)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-cyan-950/70 hover:text-cyan-200 border border-slate-700 hover:border-cyan-500/50 text-slate-200 text-xs font-medium transition-all shadow-sm flex items-center gap-1.5 group"
                      >
                        <span>{chip}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Optional Transparent Reasoning Toggle */}
                {msg.transparentReasoning && (
                  <div className="pt-1 border-t border-slate-800/80">
                    <button
                      onClick={() => toggleReasoning(msg.id)}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                    >
                      <Info className="w-3 h-3 text-slate-400" />
                      <span>Why this response?</span>
                    </button>

                    {expandedReasoningIds[msg.id] && (
                      <div className="mt-1.5 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed italic animate-in fade-in duration-150">
                        {msg.transparentReasoning}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Message Bubble: ERROR */}
            {msg.sender === "error" && (
              <div className="w-full max-w-[95%] rounded-2xl rounded-tl-sm bg-slate-900/90 border border-red-500/40 p-4 text-xs text-slate-200 shadow-md space-y-2.5">
                <div className="flex items-center gap-1.5 text-red-300 font-bold">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>AI Model Issue ({msg.errorProvider || "AI Service"})</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {msg.errorMessage || msg.text || "Could not generate response from provider."}
                </p>
                {onSwitchToDeterministic && (
                  <button
                    onClick={onSwitchToDeterministic}
                    disabled={isLoading}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Cpu className="w-3.5 h-3.5 text-slate-950" />
                    <span>Use Deterministic Engine & Continue</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Real-time Typing / Processing Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-cyan-300 p-3 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            <span>PathForge is listening and updating your work model...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmitMessage} className="mt-auto pt-2 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Tell PathForge what's on your mind..."
          disabled={isLoading}
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/80 transition-colors"
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
