"use client";

import React, { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { IntakeChat, ChatMessageItem } from "@/components/IntakeChat";
import { NextBestActionCard } from "@/components/NextBestActionCard";
import { RoadmapTimeline } from "@/components/RoadmapTimeline";
import { SkillMatrix } from "@/components/SkillMatrix";
import { ScenarioStudio } from "@/components/ScenarioStudio";
import { FactInspectorModal } from "@/components/FactInspectorModal";
import { SettingsModal } from "@/components/SettingsModal";
import { DiagnosticQuizModal } from "@/components/DiagnosticQuizModal";
import { UserAuthModal } from "@/components/UserAuthModal";
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

      // Assistant response text
      let replyText = "I've analyzed your input and updated your profile attributes.";
      if (data.activeQuestion?.selectedQuestion?.dimension === "confirm_goal_change") {
        replyText = "It looks like you may be switching your target career. Please confirm below so I can align your curriculum recommendations:";
      } else if (data.roadmap) {
        replyText = `Target identified: ${data.profile?.declaredTargetRole || "Verified Track"}. Generated your customized learning milestones.`;
      } else if (data.decision?.recommendation) {
        replyText = `Not sure which direction to take? Here are the supported options for ${data.profile?.declaredTargetRole || "your track"}, highlighted by industry demand:`;
      } else if (data.decision?.eligibility === "unsupported_intent") {
        replyText = data.decision?.explanation || "PathFinder cannot currently establish a verified curriculum for this goal.";
      } else if (data.decision?.eligibility === "infeasible") {
        replyText = data.decision?.explanation || "Your target roadmap requires more time than your current pace allows.";
      } else if (data.activeQuestion) {
        replyText = `Extracted technical dimensions from your goal. Let's clarify a few details to tailor your curriculum:`;
      } else if (data.extractedFacts && data.extractedFacts.length > 0) {
        replyText = `Extracted ${data.extractedFacts.length} technical dimensions from your goal.`;
      }

      const assistantMsg: ChatMessageItem = {
        id: `asst_${Date.now()}`,
        sender: "assistant",
        text: replyText,
        timestamp: getFormattedTime(),
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

    // Append user answer bubble
    const userMsg: ChatMessageItem = {
      id: `user_ans_${Date.now()}`,
      sender: "user",
      text: Array.isArray(answer) ? answer.join(", ") : String(answer),
      timestamp: getFormattedTime(),
    };
    setChatMessages((prev) => [...prev, userMsg]);

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

      let replyText = `Captured preference for ${dimension.replace(/_/g, " ")}.`;
      if (data.roadmap) {
        replyText = "Target path verified! Your customized learning roadmap is ready below.";
      } else if (data.decision?.recommendation) {
        replyText = `Here are the supported directions for your path, highlighted by market demand:`;
      } else if (data.decision?.eligibility === "unsupported_intent") {
        replyText = data.decision?.explanation || "PathFinder cannot currently establish a verified curriculum for this goal.";
      } else if (data.decision?.eligibility === "infeasible") {
        replyText = data.decision?.explanation || "Your target roadmap requires more time than your current pace allows.";
      } else if (data.activeQuestion) {
        replyText = "Got it! Here is the next question to finalize your curriculum:";
      }

      const assistantMsg: ChatMessageItem = {
        id: `asst_ans_${Date.now()}`,
        sender: "assistant",
        text: replyText,
        timestamp: getFormattedTime(),
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

  // 3. Switch to Deterministic Engine Fallback
  const handleSwitchToDeterministic = async () => {
    sessionStorage.setItem("pathfinder_provider", "deterministic");
    sessionStorage.setItem("pathfinder_model", "rule-engine-v1");

    // Re-run last failed action with deterministic provider
    if (lastAction?.type === "message") {
      await handleSendMessage(lastAction.payload.message, "deterministic");
    } else if (lastAction?.type === "answer") {
      await handleAnswerQuestion(lastAction.payload.dimension, lastAction.payload.answer, "deterministic");
    } else {
      await handleSendMessage("I want to become a backend engineer", "deterministic");
    }
  };

  // 4. Retry Last Action
  const handleRetryLastAction = async () => {
    if (lastAction?.type === "message") {
      await handleSendMessage(lastAction.payload.message);
    } else if (lastAction?.type === "answer") {
      await handleAnswerQuestion(lastAction.payload.dimension, lastAction.payload.answer);
    }
  };

  // 5. Preset Quick Loader
  const handleSelectPreset = async (preset: { title: string; initialMessage: string }) => {
    await handleReset();
    await handleSendMessage(preset.initialMessage);
  };

  // 6. Reset Session (Start Fresh with Roadmap Archiving)
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

        // Reload history so the archived roadmap appears in Saved Roadmaps
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

  // Switch Active Roadmap
  const handleSwitchRoadmap = async (targetRoadmapId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/profiles/me/roadmaps/switch", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ roadmapId: targetRoadmapId }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setRoadmap(data.roadmap);
      }
    } catch (err) {
      console.error("Error switching roadmap:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Correct/Revoke Fact
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
        if (data.roadmapStale && profile?.activeRoadmapId) {
          // Re-generate roadmap
          const rmRes = await fetch("/api/v1/profiles/me/roadmaps", {
            method: "POST",
            headers: getHeaders(),
          });
          if (rmRes.ok) {
            const newRm = await rmRes.json();
            setRoadmap(newRm);
          }
        }
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

  // 6. Create Scenario
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

  // 7. Submit Diagnostic Quiz
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

  // 8. Switch Learner / Profile
  const handleSwitchLearner = (newLearnerId: string, newLearnerName?: string) => {
    setLearnerId(newLearnerId);
    localStorage.setItem("pathfinder_learner_id", newLearnerId);
    setRoadmap(null);
    setActiveQuestion(null);
    setScenarios([]);
    loadInitialData(newLearnerId);
  };

  // 9. Execute NBA
  const handleExecuteAction = (action: NextBestAction) => {
    if (action.type === "assessment" && action.skillId) {
      setDiagnosticSkillId(action.skillId);
    } else if (action.type === "clarification") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (action.resourceId && roadmap) {
      const resource = roadmap.milestones
        .flatMap((m) => m.resources)
        .find((r) => r.id === action.resourceId);
      if (resource?.url) {
        window.open(resource.url, "_blank");
      }
    }
  };

  const handleCompleteMilestone = async (milestoneId: string) => {
    if (!roadmap) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/v1/profiles/me/phases/${milestoneId}/submit`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          notes: `Completed phase deliverable for milestone ${milestoneId}`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) setProfile(data.profile);
        if (data.roadmap) setRoadmap(data.roadmap);
        if (data.nextDecision?.mode === "disambiguate" && data.nextDecision.activeQuestion?.selectedQuestion) {
          setActiveQuestion(data.nextDecision.activeQuestion.selectedQuestion.dimension);
        }
      }
    } catch (err) {
      console.error("Error submitting phase completion:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation */}
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

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Next-Best Action Spotlight (ONLY displayed when readiness gate passes: intentState === 'ready') */}
        {profile?.intent.status === "ready" && roadmap?.nextBestAction && (
          <NextBestActionCard
            action={roadmap.nextBestAction}
            onExecuteAction={handleExecuteAction}
          />
        )}

        <div className="grid grid-cols-1 gap-6">
          <div className="h-[520px]">
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
        </div>

        {/* Tabbed View Section: Roadmap vs Skills vs Scenarios */}
        <section className="pt-2">
          {activeTab === "roadmap" && (
            <RoadmapTimeline
              roadmap={roadmap}
              savedRoadmaps={savedRoadmaps}
              onOpenDiagnostic={(skillId) => setDiagnosticSkillId(skillId)}
              onCompleteMilestone={handleCompleteMilestone}
              onSwitchRoadmap={handleSwitchRoadmap}
            />
          )}

          {activeTab === "skills" && (
            <SkillMatrix
              competencies={profile?.competencies || []}
              onOpenDiagnostic={(skillId) => setDiagnosticSkillId(skillId)}
            />
          )}

          {activeTab === "scenarios" && (
            <ScenarioStudio
              profile={profile}
              roadmap={roadmap}
              scenarios={scenarios}
              onCreateScenario={handleCreateScenario}
              onAdoptScenario={handleAdoptScenario}
              isLoading={isLoading}
            />
          )}
        </section>
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
