"use client";

import React, { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { IntakeChat } from "@/components/IntakeChat";
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

  const getLlmSettings = () => {
    const provider = sessionStorage.getItem("pathfinder_provider") as "gemini" | "openai" | "deterministic" | null;
    const apiKey = sessionStorage.getItem("pathfinder_api_key") || undefined;
    const modelName = sessionStorage.getItem("pathfinder_model") || undefined;
    return { provider: provider || undefined, apiKey, modelName };
  };

  // 1. Send Message
  const handleSendMessage = async (message: string) => {
    setIsLoading(true);
    try {
      const { provider, apiKey, modelName } = getLlmSettings();
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

      if (res.ok) {
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
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Answer Question
  const handleAnswerQuestion = async (dimension: string, answer: string | string[]) => {
    setIsLoading(true);
    try {
      const { provider, apiKey, modelName } = getLlmSettings();
      const res = await fetch("/api/v1/profiles/me/answers", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          questionId: activeQuestion?.selectedQuestion.id || "q_answer",
          dimension,
          answer,
          modelProvider: provider,
          apiKey,
          modelName,
        }),
      });

      if (res.ok) {
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
      }
    } catch (err) {
      console.error("Error answering question:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Preset Quick Loader
  const handleSelectPreset = async (preset: { title: string; initialMessage: string }) => {
    await handleReset();
    await handleSendMessage(preset.initialMessage);
  };

  // 4. Reset Session (Start Fresh with Roadmap Archiving)
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
    setRoadmap(scenario.computedRoadmap);
    setActiveTab("roadmap");
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

  const handleCompleteMilestone = (milestoneId: string) => {
    if (!roadmap) return;
    const updated = {
      ...roadmap,
      milestones: roadmap.milestones.map((m) =>
        m.id === milestoneId
          ? {
              ...m,
              status: (m.status === "completed" ? "in_progress" : "completed") as any,
            }
          : m
      ),
    };
    setRoadmap(updated);
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
          <div className="h-[480px]">
            <IntakeChat
              profile={profile}
              activeQuestion={activeQuestion}
              onSendMessage={handleSendMessage}
              onAnswerQuestion={handleAnswerQuestion}
              isLoading={isLoading}
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
