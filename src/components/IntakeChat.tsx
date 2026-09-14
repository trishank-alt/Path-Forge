"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  Tag,
  ArrowRight,
  Loader2,
  Info,
  AlertTriangle,
  RotateCcw,
  Cpu,
  Zap,
  Settings2,
  Bot,
  User,
  Clock,
  Ban,
  Calendar,
  Compass,
  Flame,
  TrendingUp,
  Layers,
} from "lucide-react";
import { LearnerProfile, ProfileFact, QuestionDecision, RoadmapDecision, FeasibilityResult } from "@/lib/contracts";

export interface ChatMessageItem {
  id: string;
  sender: "user" | "assistant" | "error";
  text: string;
  timestamp: string;
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
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, activeQuestion]);

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const msg = inputText.trim();
    setInputText("");
    await onSendMessage(msg);
  };

  const handleOptionClick = async (dimension: string, option: string) => {
    if (isLoading) return;
    setSelectedOption(option);
    await onAnswerQuestion(dimension, option);
    setSelectedOption(null);
  };

  const activeFacts = profile?.facts.filter((f) => f.status === "active") || [];
  const status = profile?.intent.status || "clarifying";

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-slate-800 p-4 lg:p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Conversational Discovery</h2>
            <p className="text-[11px] text-slate-400">
              Interactive intent analysis • Information-gain discovery
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {profile?.declaredTargetRole && (
            <button
              onClick={() => {
                setInputText("Actually, I want to change my career goal to ");
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-1.5 transition-all"
              title="Explicitly switch to a different career goal"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Change Goal</span>
            </button>
          )}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-300 text-xs flex items-center gap-1.5 transition-all"
              title="Configure AI Models & Keys"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>AI Settings</span>
            </button>
          )}
          <span className="text-xs px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            {status === "ready" ? "Path Ready" : status === "provisional" ? "Provisional" : "Clarifying"}
          </span>
        </div>
      </div>

      {/* Extracted Facts Live Summary Bar */}
      {activeFacts.length > 0 && (
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 shrink-0">
          <div className="flex items-center justify-between gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              <span>Active Profile Facts ({activeFacts.length}):</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Real-time profile state</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
            {activeFacts.map((fact) => (
              <span
                key={fact.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-800/90 border border-slate-700/60 text-slate-200"
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

      {/* Scrollable Conversation Stream */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Bot className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-sm font-semibold text-slate-200">Start Your Engineering Journey</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tell PathFinder what engineering role or technical goals you are targeting (e.g. &quot;I want to become a backend engineer with Java and Spring Boot&quot;).
              </p>
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
                  <span className="font-semibold text-red-400">AI Error</span>
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-cyan-400" />
                  <span className="font-semibold text-cyan-300">PathFinder AI</span>
                  {msg.executionMetadata && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono">
                      {msg.executionMetadata.provider === "groq" ? (
                        <Zap className="w-2.5 h-2.5 text-amber-400" />
                      ) : msg.executionMetadata.provider === "gemini" ? (
                        <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                      ) : (
                        <Cpu className="w-2.5 h-2.5 text-indigo-400" />
                      )}
                      <span>
                        {msg.executionMetadata.provider === "groq"
                          ? `Groq LPU (${msg.executionMetadata.modelName})`
                          : msg.executionMetadata.provider === "gemini"
                          ? `Gemini (${msg.executionMetadata.modelName})`
                          : "Deterministic Rule Engine"}
                      </span>
                      {msg.executionMetadata.latencyMs ? (
                        <span className="text-slate-400">
                          • {(msg.executionMetadata.latencyMs / 1000).toFixed(2)}s
                        </span>
                      ) : null}
                    </span>
                  )}
                </>
              )}
              <span>• {msg.timestamp}</span>
            </div>

            {/* Message Bubble: USER */}
            {msg.sender === "user" && (
              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2.5 text-xs text-white shadow-md leading-relaxed font-medium">
                {msg.text}
              </div>
            )}

            {/* Message Bubble: ASSISTANT */}
            {msg.sender === "assistant" && (
              <div className="w-full max-w-[95%] rounded-2xl rounded-tl-sm bg-slate-900/90 border border-slate-800 p-4 text-xs text-slate-200 shadow-md space-y-3">
                <p className="leading-relaxed text-slate-200">{msg.text}</p>

                {/* Extracted Facts in this turn */}
                {msg.facts && msg.facts.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                    <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-cyan-400" />
                      Identified Career Dimensions ({msg.facts.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.facts.map((f, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-200"
                        >
                          <strong className="text-cyan-400">{f.dimension}:</strong> {f.rawValue}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feasibility Alert Card (Infeasible / Strained) */}
                {(msg.feasibility?.status === "infeasible" || msg.decision?.eligibility === "infeasible") && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-red-950/40 via-slate-900/70 to-amber-950/40 border border-red-500/40 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-red-300 font-semibold text-xs">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span>Execution Feasibility Boundary: Infeasible Workload</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {msg.feasibility?.explanation || msg.decision?.explanation}
                    </p>
                    {msg.feasibility && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-center">
                          <span className="text-[10px] text-slate-400 block">Required</span>
                          <span className="text-xs font-bold text-slate-100">{msg.feasibility.requiredHours}h</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-center">
                          <span className="text-[10px] text-slate-400 block">Available</span>
                          <span className="text-xs font-bold text-slate-100">{msg.feasibility.availableHours}h</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-center">
                          <span className="text-[10px] text-slate-400 block">Capacity Ratio</span>
                          <span className="text-xs font-bold text-red-400">{(msg.feasibility.capacityRatio * 100).toFixed(1)}%</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-center">
                          <span className="text-[10px] text-slate-400 block">Est. Weeks</span>
                          <span className="text-xs font-bold text-slate-100">{msg.feasibility.estimatedWeeks}w</span>
                        </div>
                      </div>
                    )}
                    {msg.feasibility?.alternative && (
                      <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-500/30 text-amber-200 text-xs space-y-1">
                        <span className="font-semibold text-amber-300 block">Recommended Alternative Adjustments:</span>
                        <p className="text-[11px] text-slate-300">
                          {msg.feasibility.alternative.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Capability Boundary Notice (Unsupported Intent) */}
                {msg.decision?.eligibility === "unsupported_intent" && (
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                      <Ban className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Curriculum Verification Boundary</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {msg.decision.explanation}
                    </p>
                  </div>
                )}

                {/* Constraint Conflict Notice (No Compatible Path) */}
                {msg.decision?.eligibility === "no_compatible_path" && (
                  <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/40 text-indigo-200 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                      <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Constraint Incompatibility</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {msg.decision.explanation}
                    </p>
                  </div>
                )}

                {/* Recommendation Exploration Mode */}
                {msg.decision?.recommendation && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-950/50 via-slate-900/80 to-purple-950/40 border border-purple-500/40 glow-purple space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-purple-300 font-semibold text-xs">
                        <Compass className="w-4 h-4 text-purple-400" />
                        <span>{msg.decision.recommendation.promptTitle}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-500/30 text-purple-200 font-medium">
                        Exploration Catalogue
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {msg.decision.recommendation.promptDescription}
                    </p>

                    <div className="space-y-2 pt-1">
                      {msg.decision.recommendation.options.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleOptionClick(opt.dimension, opt.id)}
                          disabled={isLoading}
                          className="w-full p-3 rounded-xl bg-slate-800/90 hover:bg-purple-950/60 border border-slate-700 hover:border-purple-500/60 text-left transition-all group flex flex-col gap-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-100 group-hover:text-purple-200">
                                {opt.title}
                              </span>
                              {opt.category === "high_demand" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/50 text-amber-300">
                                  <Flame className="w-3 h-3 text-amber-400" />
                                  High Demand {opt.demandSignal ? `(${opt.demandSignal.score}/100)` : ""}
                                </span>
                              )}
                              {opt.category === "strong_option" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-500/50 text-blue-300">
                                  <TrendingUp className="w-3 h-3 text-blue-400" />
                                  Strong Option
                                </span>
                              )}
                              {opt.category === "supported_track" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-slate-300">
                                  <Layers className="w-3 h-3 text-slate-400" />
                                  Supported Track
                                </span>
                              )}
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                          </div>

                          <p className="text-[11px] text-slate-300 leading-snug">
                            {opt.description}
                          </p>

                          {opt.demandSignal?.explanation && (
                            <p className="text-[10px] text-purple-300/80 italic pt-0.5">
                              📈 {opt.demandSignal.explanation}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Embedded Clarification Question */}
                {msg.question && msg.question.selectedQuestion && (
                  <div
                    className={`p-3.5 rounded-xl border space-y-2.5 ${
                      msg.question.selectedQuestion.dimension === "confirm_goal_change"
                        ? "bg-gradient-to-br from-amber-950/50 via-slate-900/80 to-amber-900/30 border-amber-500/50 glow-amber"
                        : "bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-cyan-950/40 border-cyan-500/30 glow-cyan"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                      {msg.question.selectedQuestion.dimension === "confirm_goal_change" ? (
                        <>
                          <RotateCcw className="w-4 h-4 text-amber-400" />
                          <span className="text-amber-300">Career Goal Change Confirmation:</span>
                        </>
                      ) : (
                        <>
                          <HelpCircle className="w-4 h-4 text-cyan-400" />
                          <span className="text-cyan-300">Clarification Question:</span>
                        </>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm font-medium text-slate-100 leading-snug">
                      {msg.question.selectedQuestion.question}
                    </p>

                    {msg.question.selectedQuestion.why && (
                      <p className="text-[11px] text-slate-400 italic">
                        <strong className="text-cyan-400 not-italic">Why it matters: </strong>
                        {msg.question.selectedQuestion.why}
                      </p>
                    )}

                    {/* Question Options */}
                    {msg.question.selectedQuestion.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {msg.question.selectedQuestion.options.map((opt, idx) => {
                          const isConfirmDimension = msg.question?.selectedQuestion.dimension === "confirm_goal_change";
                          const isYes = opt.toLowerCase().startsWith("yes");
                          return (
                            <button
                              key={idx}
                              onClick={() =>
                                handleOptionClick(
                                  msg.question!.selectedQuestion.dimension,
                                  opt
                                )
                              }
                              disabled={isLoading}
                              className={`flex items-center justify-between p-2.5 rounded-lg border text-left text-xs font-medium transition-all group ${
                                isConfirmDimension
                                  ? isYes
                                    ? "bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-100"
                                    : "bg-slate-800/90 hover:bg-slate-800 border-slate-700 text-slate-300"
                                  : "bg-slate-800/90 hover:bg-cyan-950/60 border-slate-700 hover:border-cyan-500/60 text-slate-200 hover:text-cyan-200"
                              }`}
                            >
                              <span className="pr-2">{opt}</span>
                              {selectedOption === opt ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
                              ) : (
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Message Bubble: ERROR / FALLBACK PROMPT */}
            {msg.sender === "error" && (
              <div className="w-full max-w-[95%] rounded-2xl rounded-tl-sm bg-gradient-to-br from-red-950/50 via-slate-900/90 to-amber-950/40 border border-red-500/40 p-4 text-xs text-slate-200 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-red-300 font-bold text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>AI Provider Execution Issue ({msg.errorProvider || "AI Service"})</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {msg.errorMessage || msg.text || "An unexpected error occurred while communicating with the AI service."}
                </p>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-amber-500/30 text-amber-200/90 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Instant Fallback Available</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    You can switch to the calibrated Deterministic Engine to generate your career roadmap and answer discovery questions offline with zero API limits.
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {onSwitchToDeterministic && (
                      <button
                        onClick={onSwitchToDeterministic}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
                      >
                        <Cpu className="w-3.5 h-3.5 text-slate-950" />
                        <span>Use Deterministic Engine & Continue</span>
                      </button>
                    )}

                    {onRetryLastAction && (
                      <button
                        onClick={onRetryLastAction}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition-all border border-slate-700"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                    )}

                    {onOpenSettings && (
                      <button
                        onClick={onOpenSettings}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-all border border-slate-700"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>Configure API Keys</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Real-time Typing / Processing Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-cyan-300 p-3 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Analyzing career intent and synthesizing decision graph...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Threshold Gate Passed Alert */}
      {status === "ready" && (
        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 glow-emerald flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Target verified: Your learning path is ready</span>
          </div>
          <span className="text-[11px] text-emerald-400/80 font-mono">
            Score: {((profile?.intent.confidence.finalScore || 0) * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmitMessage} className="mt-auto pt-1 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            activeQuestion?.selectedQuestion?.dimension === "confirm_goal_change"
              ? "Confirm career goal switch (e.g. Yes / No)..."
              : activeQuestion?.selectedQuestion
              ? `Answer for ${activeQuestion.selectedQuestion.dimension.replace(/_/g, " ")}...`
              : status !== "ready"
              ? "Answer question or provide free-text career details..."
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
