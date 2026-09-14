"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Award,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { SEEDED_SKILLS } from "@/lib/persistence/seed-data";

interface DiagnosticQuizModalProps {
  skillId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitResult: (skillId: string, score: number, passed: boolean) => Promise<void>;
}

interface Question {
  q: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function DiagnosticQuizModal({
  skillId,
  isOpen,
  onClose,
  onSubmitResult,
}: DiagnosticQuizModalProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const skill = SEEDED_SKILLS.find((s) => s.id === skillId);
  if (!isOpen || !skillId || !skill) return null;

  // Dynamic tailored 3 diagnostic questions per skill
  const getQuestions = (): Question[] => {
    if (skill.id === "sql_relational_modeling" || skill.id === "spring_data_jpa") {
      return [
        {
          q: "How do you prevent the N+1 select query problem when fetching parent entities with one-to-many child collections in JPA/Hibernate?",
          options: [
            "Use JOIN FETCH in JPQL or configure an EntityGraph",
            "Mark all collection relationships as FetchType.EAGER",
            "Disable transactions around the repository call",
            "Use native SQL without entity mapping",
          ],
          correctIndex: 0,
          explanation: "JOIN FETCH or EntityGraphs instruct Hibernate to load parent and children in a single SQL query.",
        },
        {
          q: "What ACID property ensures that intermediate states of concurrent transactions remain invisible to each other?",
          options: ["Atomicity", "Consistency", "Isolation", "Durability"],
          correctIndex: 2,
          explanation: "Isolation determines how concurrent transactions interact and prevent dirty/phantom reads.",
        },
        {
          q: "When should a B-Tree index be preferred over a GIN index in PostgreSQL?",
          options: [
            "For scalar equality and range queries on columns like IDs or timestamps",
            "For full-text search and JSONB containment queries",
            "Only for unindexed primary keys",
            "When rows are updated thousands of times per second",
          ],
          correctIndex: 0,
          explanation: "B-Tree indexes are optimal for scalar equality/range comparisons, whereas GIN is built for composite/inverted elements.",
        },
      ];
    }

    if (skill.id === "java_core" || skill.id === "spring_boot_core") {
      return [
        {
          q: "What is the primary benefit of Dependency Injection in Spring Boot?",
          options: [
            "Decouples components and enables easy unit testing with mock objects",
            "Speeds up Java JVM compilation time",
            "Automatically generates frontend HTML templates",
            "Eliminates the need for memory garbage collection",
          ],
          correctIndex: 0,
          explanation: "Dependency Injection inverts control, making dependencies easily mockable in automated tests.",
        },
        {
          q: "Which HTTP status code should be returned when a client attempts to create an order with missing required fields?",
          options: ["200 OK", "400 Bad Request / 422 Unprocessable Entity", "500 Internal Server Error", "404 Not Found"],
          correctIndex: 1,
          explanation: "Client validation errors should return 400 or 422 with structured problem details.",
        },
        {
          q: "In Java, what occurs when modifying a standard ArrayList while iterating over it with an enhanced for-loop without using an Iterator?",
          options: [
            "ConcurrentModificationException is thrown",
            "The loop silently skips elements",
            "The JVM crashes with a segmentation fault",
            "Java automatically creates a clone of the list",
          ],
          correctIndex: 0,
          explanation: "Java collections enforce fail-fast behavior by throwing ConcurrentModificationException.",
        },
      ];
    }

    return [
      {
        q: `What is the core architectural principle when implementing ${skill.title}?`,
        options: [
          "Enforce separation of concerns and validate contracts at boundaries",
          "Combine all database and presentation logic in a single monolithic controller",
          "Disable all caching and connection pooling",
          "Never write automated tests",
        ],
        correctIndex: 0,
        explanation: "Separation of concerns ensures modularity, testability, and resilience.",
      },
      {
        q: `How do you verify production readiness for ${skill.title}?`,
        options: [
          "Automated integration tests, health probes, and structured error handling",
          "Manual smoke testing only",
          "Deploying directly to production on Fridays",
          "Ignoring telemetry logs",
        ],
        correctIndex: 0,
        explanation: "Automated test suites and telemetry are foundational to production readiness.",
      },
      {
        q: "Which error handling standard is recommended for REST API problem details?",
        options: ["RFC 7807 (Problem Details for HTTP APIs)", "HTML error pages", "Plain string error messages", "Returning 200 with error: true"],
        correctIndex: 0,
        explanation: "RFC 7807 specifies a standard format for HTTP API error representations.",
      },
    ];
  };

  const questions = getQuestions();

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (selectedAnswers[i] === q.correctIndex) correct++;
    });
    return Math.round((correct / questions.length) * 100);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const score = calculateScore();
    const passed = score >= 66; // 2 out of 3 or higher
    setIsSubmitted(true);
    await onSubmitResult(skill.id, score, passed);
    setIsSubmitting(false);
  };

  const score = calculateScore();
  const passed = score >= 66;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl glass-panel rounded-2xl border border-slate-700/80 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Diagnostic Assessment</h3>
              <p className="text-xs text-slate-400">Verify competency for: {skill.title}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {questions.map((q, qIdx) => {
            const chosen = selectedAnswers[qIdx];

            return (
              <div key={qIdx} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <p className="text-xs font-bold text-slate-200">
                  {qIdx + 1}. {q.q}
                </p>

                <div className="space-y-1.5">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = chosen === optIdx;
                    const isCorrect = q.correctIndex === optIdx;

                    let btnClass = "bg-slate-800/80 border-slate-700 text-slate-300 hover:border-cyan-500/50";
                    if (isSubmitted) {
                      if (isCorrect) btnClass = "bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold";
                      else if (isSelected) btnClass = "bg-rose-950/60 border-rose-500 text-rose-300";
                      else btnClass = "bg-slate-900 border-slate-800 text-slate-400 opacity-60";
                    } else if (isSelected) {
                      btnClass = "bg-cyan-500/20 border-cyan-500 text-cyan-200 font-semibold";
                    }

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleSelect(qIdx, optIdx)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${btnClass}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {isSubmitted && (
                  <p className="text-[11px] text-slate-400 pt-1 italic">
                    <strong>Explanation: </strong> {q.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Results Banner */}
        {isSubmitted && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              passed
                ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300 glow-emerald"
                : "bg-amber-950/30 border-amber-500/40 text-amber-300"
            }`}
          >
            <div>
              <h4 className="text-sm font-bold">
                {passed ? "Competency Verified!" : "Needs Reinforcement"}
              </h4>
              <p className="text-xs opacity-90">
                Score: {score}% • {passed ? "Roadmap has been updated to skip prerequisite module." : "Module retained in active roadmap."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        )}

        {/* Action Button */}
        {!isSubmitted && (
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={Object.keys(selectedAnswers).length < questions.length || isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md glow-cyan transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <>
                  <span>Submit Diagnostic</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
