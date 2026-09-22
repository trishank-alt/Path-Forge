"use client";

import React, { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { IntakeChat, ChatMessageItem } from "@/components/IntakeChat";
import { CareerMap } from "@/components/map/CareerMap";
import { CurrentFocusCard } from "@/components/journey/CurrentFocusCard";
import { SkillMatrix } from "@/components/SkillMatrix";
import { ScenarioStudio } from "@/components/ScenarioStudio";
import { FactInspectorModal } from "@/components/FactInspectorModal";
import { SettingsModal } from "@/components/SettingsModal";
import { DiagnosticQuizModal } from "@/components/DiagnosticQuizModal";
import { UserAuthModal } from "@/components/UserAuthModal";
import { translateDecisionToDialogue } from "@/lib/conversational/dialogue-translator";
import {
  LearnerProfile,
  NextBestAction,
  QuestionDecision,
  Roadmap,
  Scenario,
} from "@/lib/contracts";

export default function Home() {
  const [learnerId, setLearnerId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pathfinder_learner_id") || "trishank";
    }
    return "trishank";
  });
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [savedRoadmaps, setSavedRoadmaps] = useState<Roadmap[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<QuestionDecision | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [lastAction, setLastAction] = useState<{
    type: "message" | "answer";
    payload: any;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"roadmap" | "skills" | "scenarios">("roadmap");

  // Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isFactsOpen, setIsFactsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [diagnosticSkillId, setDiagnosticSkillId] = useState<string | null>(null);

  const getHeaders = (currentId: string = learnerId) => ({
    "Content-Type": "application/json",
    "x-learner-id": currentId,
  });

  const getLlmSettings = () => {
    const provider = sessionStorage.getItem("pathfinder_provider") as "gemini" | "openai" | "deterministic" | "groq" | null;
    const apiKey = sessionStorage.getItem("pathfinder_api_key") || undefined;
    const modelName = sessionStorage.getItem("pathfinder_model") || undefined;
    return { provider: provider || undefined, apiKey, modelName };
  };

  const getFormattedTime = () => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Load profile and roadmap on initial mount or when learnerId changes
  const loadInitialData = async (targetLearnerId: string = learnerId) => {
    try {
      const res = await fetch("/api/v1/profiles/me", {
        headers: { "x-learner-id": targetLearnerId },
      });
      if (res.ok) {
        const p: LearnerProfile = await res.json();
        setProfile(p);

        if (p.activeRoadmapId) {
          const rmRes = await fetch(`/api/v1/roadmaps/${p.activeRoadmapId}`, {
            headers: { "x-learner-id": targetLearnerId },
          });
          if (rmRes.ok) {
            const rm: Roadmap = await rmRes.json();
            setRoadmap(rm);
          } else {
            setRoadmap(null);
          }
        } else {
          setRoadmap(null);
        }
      }

      // Load saved roadmaps history
      const histRes = await fetch("/api/v1/profiles/me/roadmaps/history", {
        headers: { "x-learner-id": targetLearnerId },
      });
      if (histRes.ok) {
        const histData = await histRes.json();
        setSavedRoadmaps(histData.savedRoadmaps || []);
      }

      const scRes = await fetch("/api/v1/scenarios", {
        headers: { "x-learner-id": targetLearnerId },
      });
      if (scRes.ok) {
        const scData = await scRes.json();
        setScenarios(scData.scenarios || []);
      }
    } catch (err) {
      console.error("Failed to load initial data:", err);
    }
  };

  useEffect(() => {
    loadInitialData(learnerId);
  }, [learnerId]);

  // 1. Send Message
  const handleSendMessage = async (message: string, forceProvider?: "gemini" | "openai" | "deterministic" | "groq") => {
    setIsLoading(true);
    setLastAction({ type: "message", payload: { message } });

    // Append user message immediately
    const userMsg: ChatMessageItem = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: message,
      timestamp: getFormattedTime(),
    };
    setChatMessages((prev) => [...prev, userMsg]);

    const prevPhase = profile?.activePhase || null;

    try {
      const llmSettings = getLlmSettings();
      const provider = forceProvider || llmSettings.provider;
      const apiKey = forceProvider === "deterministic" ? undefined : llmSettings.apiKey;
      const modelName = forceProvider === "deterministic" ? "rule-engine-v1" : llmSettings.modelName;

      const res = await fetch("/api/v1/intake/messages", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          message,
          modelProvider: provider,
          apiKey,
          modelName,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `API request failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      setProfile(data.profile);
      setActiveQuestion(data.activeQuestion);

      if (data.roadmap) {
        setRoadmap(data.roadmap);
        setSavedRoadmaps((prev) => {
          const exists = prev.some((r) => r.id === data.roadmap.id);
          return exists ? prev : [data.roadmap, ...prev];
        });
      } else {
        setRoadmap(null);
      }

      // Translate planning decision and resulting state into natural dialogue
      const latestDecision =
        data.profile?.decisions && data.profile.decisions.length > 0
          ? data.profile.decisions[data.profile.decisions.length - 1]
          : null;

      const translation = translateDecisionToDialogue({
        userMessage: message,
        intent: data.intent || null,
        decision: latestDecision,
        activePhase: data.profile?.activePhase || null,
        previousPhase: prevPhase,
        workModel: data.profile?.workModel || null,
        activeQuestion: data.activeQuestion || null,
        extractedFactsCount: data.extractedFacts?.length || 0,
      });

      const assistantMsg: ChatMessageItem = {
        id: `asst_${Date.now()}`,
        sender: "assistant",
        text: translation.replyText,
        timestamp: getFormattedTime(),
        inlineEvent: translation.inlineEvent,
        suggestedChips: translation.suggestedChips,
        transparentReasoning: translation.transparentReasoning,
        facts: data.extractedFacts,
        question: data.activeQuestion,
        decision: data.decision,
        feasibility: data.feasibility,
        executionMetadata: data.executionMetadata,
        status: data.profile?.intent?.status,
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Error sending message:", err);
      const errorMsg: ChatMessageItem = {
        id: `err_${Date.now()}`,
        sender: "error",
        text: "Failed to generate response from AI provider.",
        timestamp: getFormattedTime(),
        errorMessage: err.message || "An error occurred while connecting to the AI model provider.",
        errorProvider: forceProvider || getLlmSettings().provider || "groq",
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Answer Question
  const handleAnswerQuestion = async (
    dimension: string,
    answer: string | string[],
    forceProvider?: "gemini" | "openai" | "deterministic" | "groq"
  ) => {
    setIsLoading(true);
    setLastAction({ type: "answer", payload: { dimension, answer } });

    const answerText = Array.isArray(answer) ? answer.join(", ") : String(answer);
    const userMsg: ChatMessageItem = {
      id: `user_ans_${Date.now()}`,
      sender: "user",
      text: answerText,
      timestamp: getFormattedTime(),
    };
    setChatMessages((prev) => [...prev, userMsg]);

    const prevPhase = profile?.activePhase || null;

    try {
      const llmSettings = getLlmSettings();
      const provider = forceProvider || llmSettings.provider;
      const apiKey = forceProvider === "deterministic" ? undefined : llmSettings.apiKey;
      const modelName = forceProvider === "deterministic" ? "rule-engine-v1" : llmSettings.modelName;

      const res = await fetch("/api/v1/profiles/me/answers", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          questionId: activeQuestion?.selectedQuestion?.id || `q_${Date.now()}`,
          dimension,
          answer,
          modelProvider: provider,
          apiKey,
          modelName,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `API request failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      setProfile(data.profile);
      setActiveQuestion(data.activeQuestion);

      if (data.roadmap) {
        setRoadmap(data.roadmap);
        setSavedRoadmaps((prev) => {
          const exists = prev.some((r) => r.id === data.roadmap.id);
          return exists ? prev : [data.roadmap, ...prev];
        });
      } else {
        setRoadmap(null);
      }

      const latestDecision =
        data.profile?.decisions && data.profile.decisions.length > 0
          ? data.profile.decisions[data.profile.decisions.length - 1]
          : null;

      const translation = translateDecisionToDialogue({
        userMessage: answerText,
        intent: data.intent || null,
        decision: latestDecision,
        activePhase: data.profile?.activePhase || null,
        previousPhase: prevPhase,
        workModel: data.profile?.workModel || null,
        activeQuestion: data.activeQuestion || null,
        extractedFactsCount: data.extractedFacts?.length || 0,
      });

      const assistantMsg: ChatMessageItem = {
        id: `asst_ans_${Date.now()}`,
        sender: "assistant",
        text: translation.replyText,
        timestamp: getFormattedTime(),
        inlineEvent: translation.inlineEvent,
        suggestedChips: translation.suggestedChips,
        transparentReasoning: translation.transparentReasoning,
        facts: data.extractedFacts,
        question: data.activeQuestion,
        decision: data.decision,
        feasibility: data.feasibility,
        executionMetadata: data.executionMetadata,
        status: data.profile?.intent?.status,
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Error answering question:", err);
      const errorMsg: ChatMessageItem = {
        id: `err_${Date.now()}`,
        sender: "error",
        text: "Failed to process question answer with AI provider.",
        timestamp: getFormattedTime(),
        errorMessage: err.message || "An error occurred while connecting to the AI model provider.",
        errorProvider: forceProvider || getLlmSettings().provider || "groq",
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Submit Work & Reflect (passes through EvidenceEngine -> DecisionEngine)
  const handleSubmitWorkAndReflect = async (phaseId: string) => {
    setIsLoading(true);
    const prevPhase = profile?.activePhase || null;

    try {
      const res = await fetch(`/api/v1/profiles/me/phases/${phaseId}/submit`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          notes: `Completed practical project deliverable and reflection for phase ${phaseId}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.profile) setProfile(data.profile);
        if (data.roadmap) setRoadmap(data.roadmap);

        const translation = translateDecisionToDialogue({
          userMessage: "Submitted practical deliverable & reflection",
          decision: data.nextDecision || null,
          activePhase: data.nextPhase || data.profile?.activePhase || null,
          previousPhase: data.completedPhase || prevPhase,
          workModel: data.profile?.workModel || null,
          activeQuestion: data.nextDecision?.activeQuestion || null,
        });

        const assistantMsg: ChatMessageItem = {
          id: `asst_submit_${Date.now()}`,
          sender: "assistant",
          text: translation.replyText,
          timestamp: getFormattedTime(),
          inlineEvent: translation.inlineEvent,
          suggestedChips: translation.suggestedChips,
          transparentReasoning: translation.transparentReasoning,
        };

        setChatMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      console.error("Error submitting work deliverable:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Switch to Deterministic Engine Fallback
  const handleSwitchToDeterministic = async () => {
    sessionStorage.setItem("pathfinder_provider", "deterministic");
    sessionStorage.setItem("pathfinder_model", "rule-engine-v1");

    if (lastAction?.type === "message") {
      await handleSendMessage(lastAction.payload.message, "deterministic");
    } else if (lastAction?.type === "answer") {
      await handleAnswerQuestion(lastAction.payload.dimension, lastAction.payload.answer, "deterministic");
    } else {
      await handleSendMessage("I want to become a backend engineer", "deterministic");
    }
  };

  // 5. Retry Last Action
  const handleRetryLastAction = async () => {
    if (lastAction?.type === "message") {
      await handleSendMessage(lastAction.payload.message);
    } else if (lastAction?.type === "answer") {
      await handleAnswerQuestion(lastAction.payload.dimension, lastAction.payload.answer);
    }
  };

  // 6. Preset Quick Loader
  const handleSelectPreset = async (preset: { title: string; initialMessage: string }) => {
    await handleReset();
    await handleSendMessage(preset.initialMessage);
  };

  // 7. Reset Session
  const handleReset = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/profiles/me", {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setRoadmap(null);
        setActiveQuestion(null);
        setScenarios([]);
        setChatMessages([]);
        setLastAction(null);

        const histRes = await fetch("/api/v1/profiles/me/roadmaps/history", {
          headers: getHeaders(),
        });
        if (histRes.ok) {
          const histData = await histRes.json();
          setSavedRoadmaps(histData.savedRoadmaps || []);
        }
      }
    } catch (err) {
      console.error("Error resetting profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 8. Correct / Revoke Fact
  const handleCorrectFact = async (factId: string, newValue: any, reason?: string) => {
    try {
      const res = await fetch(`/api/v1/profiles/me/facts/${factId}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ dimension: "corrected", newValue, reason }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
      }
    } catch (err) {
      console.error("Error correcting fact:", err);
    }
  };

  const handleRevokeFact = async (factId: string) => {
    try {
      const res = await fetch(`/api/v1/profiles/me/facts/${factId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
      }
    } catch (err) {
      console.error("Error revoking fact:", err);
    }
  };

  // 9. Create / Adopt Scenario
  const handleCreateScenario = async (name: string, overrides: Scenario["overrides"]) => {
    if (!roadmap) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/scenarios", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          baseRoadmapId: roadmap.id,
          name,
          overrides,
        }),
      });

      if (res.ok) {
        const newScenario = await res.json();
        setScenarios((prev) => [...prev, newScenario]);
      }
    } catch (err) {
      console.error("Error creating scenario:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdoptScenario = (scenario: Scenario) => {
    const targetRoadmap = scenario.computedRoadmap || scenario.resultRoadmap || null;
    if (targetRoadmap) {
      setRoadmap(targetRoadmap);
      setActiveTab("roadmap");
    }
  };

  // 10. Switch Learner Profile
  const handleSwitchLearner = (newLearnerId: string) => {
    setLearnerId(newLearnerId);
    localStorage.setItem("pathfinder_learner_id", newLearnerId);
    setRoadmap(null);
    setActiveQuestion(null);
    setScenarios([]);
    loadInitialData(newLearnerId);
  };

  // Diagnostic Quiz submission
  const handleSubmitDiagnostic = async (skillId: string, score: number, passed: boolean) => {
    try {
      const res = await fetch(`/api/v1/assessments/diag_${skillId}/attempts`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          skillId,
          score,
          passed,
          notes: `Passed: ${passed} (Score: ${score}%)`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setRoadmap(data.roadmap);
      }
    } catch (err) {
      console.error("Error submitting diagnostic:", err);
    }
  };

  const hasActivePhase = Boolean(profile?.activePhase);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Header Navigation */}
      <Navigation
        profile={profile}
        roadmap={roadmap}
        learnerId={learnerId}
        onOpenUserModal={() => setIsUserModalOpen(true)}
        onSelectPreset={handleSelectPreset}
        onReset={handleReset}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenFacts={() => setIsFactsOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Dynamic View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col min-h-0">
        {activeTab === "roadmap" && (
          <div className="flex flex-col gap-6 flex-1 min-h-0">
            {/* Layer 1: Dominant Interactive Career Map */}
            <section className="w-full h-[460px] lg:h-[500px] shrink-0" aria-label="Interactive Career Map">
              <CareerMap
                profile={profile}
                onAskAboutSkill={(skill) => {
                  handleSendMessage(`Can you explain more about ${skill} and how it connects to my learning journey?`);
                }}
              />
            </section>

            {/* Layers 2 & 3: Responsive Bottom Grid: Conversation & Current Focus */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[480px]">
              {/* Primary Conversation Panel (7 cols desktop, 8 on xl) */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full min-h-[440px]">
                <IntakeChat
                  profile={profile}
                  activeQuestion={activeQuestion}
                  messages={chatMessages}
                  onSendMessage={handleSendMessage}
                  onAnswerQuestion={handleAnswerQuestion}
                  isLoading={isLoading}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onSwitchToDeterministic={handleSwitchToDeterministic}
                  onRetryLastAction={handleRetryLastAction}
                />
              </div>

              {/* Current Focus & Journey History Panel (5 cols desktop, 4 on xl) */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full min-h-[440px]">
                <CurrentFocusCard
                  activePhase={profile?.activePhase || null}
                  phaseHistory={profile?.phaseHistory || []}
                  onSubmitWorkAndReflect={handleSubmitWorkAndReflect}
                  isLoading={isLoading}
                />
              </div>
            </section>
          </div>
        )}

        {activeTab === "skills" && (
          <div className="flex-1 py-2">
            <SkillMatrix
              competencies={profile?.competencies || []}
              onOpenDiagnostic={(skillId) => setDiagnosticSkillId(skillId)}
            />
          </div>
        )}

        {activeTab === "scenarios" && (
          <div className="flex-1 py-2">
            <ScenarioStudio
              profile={profile}
              roadmap={roadmap}
              scenarios={scenarios}
              onCreateScenario={handleCreateScenario}
              onAdoptScenario={handleAdoptScenario}
              isLoading={isLoading}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <UserAuthModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        currentLearnerId={learnerId}
        onSwitchLearner={handleSwitchLearner}
        onResetLearner={handleReset}
        profile={profile}
      />

      <FactInspectorModal
        facts={profile?.facts || []}
        isOpen={isFactsOpen}
        onClose={() => setIsFactsOpen(false)}
        onCorrectFact={handleCorrectFact}
        onRevokeFact={handleRevokeFact}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveSettings={() => {}}
      />

      <DiagnosticQuizModal
        skillId={diagnosticSkillId}
        isOpen={!!diagnosticSkillId}
        onClose={() => setDiagnosticSkillId(null)}
        onSubmitResult={handleSubmitDiagnostic}
      />
    </div>
  );
}
