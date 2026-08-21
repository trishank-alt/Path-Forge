import {
  ConfidenceBreakdown,
  IntakeMessageRequest,
  LearnerProfile,
  ProfileFact,
  QuestionDecision,
  Roadmap,
  Scenario,
  ScenarioDiff,
  CompetencyRecord,
} from "../contracts";
import { FactPrecedenceEngine } from "../domain/intent/fact-precedence-engine";
import { HypothesisEngine } from "../domain/intent/hypothesis-engine";
import { IntentConfidenceService } from "../domain/intent/confidence-service";
import { QuestionSelector } from "../domain/intent/question-selector";
import { SkillGraph } from "../domain/learning/skill-graph";
import { SkillGapService } from "../domain/learning/skill-gap-service";
import { MilestonePlanner } from "../domain/learning/milestone-planner";
import { NextBestActionService } from "../domain/learning/next-best-action-service";
import { LlmGateway, LlmGatewayConfig } from "../llm/llm-gateway";
import {
  AuditRepository,
  ProfileRepository,
  RoadmapRepository,
  ScenarioRepository,
} from "../persistence/repositories";
import { SEEDED_PATHS, PathDefinition } from "../persistence/seed-data";

export interface IntakeResponse {
  profile: LearnerProfile;
  extractedFacts: ProfileFact[];
  confidence: ConfidenceBreakdown;
  activeQuestion: QuestionDecision | null;
  roadmap: Roadmap | null;
}

export class LearningOrchestrator {
  private profileRepo: ProfileRepository;
  private roadmapRepo: RoadmapRepository;
  private scenarioRepo: ScenarioRepository;
  private auditRepo: AuditRepository;

  private factEngine: FactPrecedenceEngine;
  private hypothesisEngine: HypothesisEngine;
  private confidenceService: IntentConfidenceService;
  private questionSelector: QuestionSelector;
  private skillGraph: SkillGraph;
  private skillGapService: SkillGapService;
  private milestonePlanner: MilestonePlanner;
  private nbaService: NextBestActionService;
  private llmGateway: LlmGateway;

  constructor() {
    this.profileRepo = new ProfileRepository();
    this.roadmapRepo = new RoadmapRepository();
    this.scenarioRepo = new ScenarioRepository();
    this.auditRepo = new AuditRepository();

    this.factEngine = new FactPrecedenceEngine();
    this.hypothesisEngine = new HypothesisEngine();
    this.confidenceService = new IntentConfidenceService();
    this.questionSelector = new QuestionSelector(this.hypothesisEngine);
    this.skillGraph = new SkillGraph();
    this.skillGapService = new SkillGapService(this.skillGraph);
    this.milestonePlanner = new MilestonePlanner();
    this.nbaService = new NextBestActionService();
    this.llmGateway = new LlmGateway();
  }

  /**
   * Main Conversational Intake pipeline:
   * Redact/validate -> Extract facts (LLM) -> Merge facts (Precedence) -> Update hypotheses ->
   * Compute deterministic confidence -> Propose/Select question or Generate Roadmap -> Persist & Audit
   */
  public async handleIntake(
    request: IntakeMessageRequest,
    profileId: string = "demo_learner_1"
  ): Promise<IntakeResponse> {
    const profile = await this.profileRepo.getProfile(profileId);
    profile.goalText = profile.goalText ? `${profile.goalText}; ${request.message}` : request.message;

    const llmConfig: LlmGatewayConfig = {
      provider: request.modelProvider,
      apiKey: request.apiKey,
      modelName: request.modelName,
    };
    const llm = this.llmGateway.getAdapter(llmConfig);

    // 1. LLM Fact Extraction
    const extraction = await llm.extract({
      message: request.message,
      existingFacts: profile.facts,
      currentHypotheses: profile.intent.hypotheses,
    });

    // 2. Convert to ProfileFact objects
    const now = new Date().toISOString();
    const newFacts: ProfileFact[] = extraction.facts.map((f, idx) => ({
      id: `fact_${Date.now()}_${idx}`,
      dimension: f.dimension,
      normalizedValue: f.value,
      rawValue: f.rawValue,
      source: "llm_inference",
      evidence: f.evidence,
      reliability: f.reliability,
      impact: f.impact,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }));

    // 3. Merge Facts with Precedence Engine
    const mergeResult = this.factEngine.mergeFacts(profile.facts, newFacts);
    profile.facts = mergeResult.updatedFacts;

    // 4. Update Path Hypotheses
    const hypResult = this.hypothesisEngine.updateHypotheses(profile.facts);
    profile.intent.hypotheses = hypResult.hypotheses;
    profile.intent.topPathId = hypResult.topPath.pathId;

    // 5. Deterministic Intent Confidence Evaluation
    const confidence = this.confidenceService.evaluateConfidence({
      hypotheses: profile.intent.hypotheses,
      facts: profile.facts,
      contradictions: mergeResult.contradictions,
      questionCount: profile.intent.questionCount,
      maxBudget: profile.intent.maxQuestionBudget,
    });

    profile.intent.confidence = confidence;
    profile.intent.status = confidence.status;
    profile.intent.unansweredDimensions = confidence.missingDimensions;

    let activeQuestion: QuestionDecision | null = null;
    let generatedRoadmap: Roadmap | null = null;

    // 6. Branching on Confidence Gate
    if (confidence.status === "ready") {
      profile.declaredTargetRole = hypResult.topPath.pathTitle;
      profile.selectedPathId = hypResult.topPath.pathId;
      await this.profileRepo.saveProfile(profile);
      generatedRoadmap = await this.generateRoadmap(profile.id);
      profile.activeRoadmapId = generatedRoadmap.id;
    } else {
      if (confidence.status === "provisional") {
        profile.declaredTargetRole = `Provisional: ${hypResult.topPath.pathTitle}`;
        profile.selectedPathId = hypResult.topPath.pathId;
        await this.profileRepo.saveProfile(profile);
        generatedRoadmap = await this.generateRoadmap(profile.id);
        profile.activeRoadmapId = generatedRoadmap.id;
      } else {
        profile.declaredTargetRole = null;
        profile.selectedPathId = null;
        profile.activeRoadmapId = null;
        generatedRoadmap = null;
      }

      // A provisional plan is a terminal discovery state. Only ask another
      // clarification while the profile remains below the policy threshold.
      if (confidence.status === "clarifying") {
      let candidateList: any[] = [];
      try {
        const questionProposal = await llm.proposeQuestions({
          goalText: profile.goalText,
          existingFacts: profile.facts,
          currentHypotheses: profile.intent.hypotheses,
          unknownDimensions: confidence.missingDimensions,
        });
        if (questionProposal?.candidates && questionProposal.candidates.length > 0) {
          candidateList = questionProposal.candidates;
        }
      } catch (qErr) {
        console.warn("Question proposal failed, falling back:", qErr);
      }

      if (candidateList.length === 0) {
        const fallbackProp = await this.llmGateway.getAdapter({ provider: "deterministic" }).proposeQuestions({
          goalText: profile.goalText,
          existingFacts: profile.facts,
          currentHypotheses: profile.intent.hypotheses,
          unknownDimensions: confidence.missingDimensions,
        });
        candidateList = fallbackProp.candidates || [];
      }

      // Information-Gain Question Selection
      const decision = this.questionSelector.selectBestQuestion(
        candidateList.map((c, i) => ({
          ...c,
          id: c.id || `q_${Date.now()}_${i}`,
          informationGain: 0,
          utilityScore: 0,
        })),
        profile.intent.hypotheses,
        profile.facts
      );

      activeQuestion = decision;
      }
    }

    await this.profileRepo.saveProfile(profile);

    await this.auditRepo.recordEvent({
      profileId: profile.id,
      eventType: "intake_processed",
      details: {
        message: request.message,
        extractedCount: newFacts.length,
        confidenceScore: confidence.finalScore,
        confidenceStatus: confidence.status,
        topPath: hypResult.topPath.pathId,
      },
    });

    return {
      profile,
      extractedFacts: newFacts,
      confidence,
      activeQuestion,
      roadmap: generatedRoadmap,
    };
  }

  /**
   * Submit an explicit answer to a clarification question.
   */
  public async answerQuestion(
    dimension: string,
    answer: string | string[],
    profileId: string = "demo_learner_1",
    config?: LlmGatewayConfig
  ): Promise<IntakeResponse> {
    const profile = await this.profileRepo.getProfile(profileId);
    profile.intent.questionCount++;

    const now = new Date().toISOString();
    const normalizedAnswer = this.normalizeAnswer(dimension, answer);
    const answerFact: ProfileFact = {
      id: `fact_ans_${Date.now()}`,
      dimension,
      normalizedValue: normalizedAnswer,
      rawValue: Array.isArray(answer) ? answer.join(", ") : String(answer),
      source: "user_answer",
      evidence: `User answered question for ${dimension}: ${JSON.stringify(answer)}`,
      reliability: 0.98,
      impact: "high",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    const mergeResult = this.factEngine.mergeFacts(profile.facts, [answerFact]);
    profile.facts = mergeResult.updatedFacts;

    // Update constraints if hours_per_week answered
    if (dimension === "hours_per_week") {
      const match = String(answer).match(/\d+/);
      if (match) profile.constraints.hoursPerWeek = parseInt(match[0], 10);
    }

    // Update hypotheses
    const hypResult = this.hypothesisEngine.updateHypotheses(profile.facts);
    profile.intent.hypotheses = hypResult.hypotheses;
    profile.intent.topPathId = hypResult.topPath.pathId;

    // Evaluate confidence
    const confidence = this.confidenceService.evaluateConfidence({
      hypotheses: profile.intent.hypotheses,
      facts: profile.facts,
      contradictions: mergeResult.contradictions,
      questionCount: profile.intent.questionCount,
      maxBudget: profile.intent.maxQuestionBudget,
    });

    profile.intent.confidence = confidence;
    profile.intent.status = confidence.status;
    profile.intent.unansweredDimensions = confidence.missingDimensions;

    let activeQuestion: QuestionDecision | null = null;
    let generatedRoadmap: Roadmap | null = null;

    if (confidence.status === "ready") {
      profile.declaredTargetRole = hypResult.topPath.pathTitle;
      profile.selectedPathId = hypResult.topPath.pathId;
      await this.profileRepo.saveProfile(profile);
      generatedRoadmap = await this.generateRoadmap(profile.id);
      profile.activeRoadmapId = generatedRoadmap.id;
    } else {
      if (confidence.status === "provisional") {
        profile.declaredTargetRole = `Provisional: ${hypResult.topPath.pathTitle}`;
        profile.selectedPathId = hypResult.topPath.pathId;
        await this.profileRepo.saveProfile(profile);
        generatedRoadmap = await this.generateRoadmap(profile.id);
        profile.activeRoadmapId = generatedRoadmap.id;
      } else {
        profile.declaredTargetRole = null;
        profile.selectedPathId = null;
        profile.activeRoadmapId = null;
        generatedRoadmap = null;
      }

      if (confidence.status === "clarifying") {
      const llm = this.llmGateway.getAdapter(config);
      let candidateList: any[] = [];
      try {
        const questionProposal = await llm.proposeQuestions({
          goalText: profile.goalText,
          existingFacts: profile.facts,
          currentHypotheses: profile.intent.hypotheses,
          unknownDimensions: confidence.missingDimensions,
        });
        if (questionProposal?.candidates && questionProposal.candidates.length > 0) {
          candidateList = questionProposal.candidates;
        }
      } catch (qErr) {
        console.warn("Gemini question proposal failed in answerQuestion, falling back:", qErr);
      }

      if (candidateList.length === 0) {
        const fallbackProp = await this.llmGateway.getAdapter({ provider: "deterministic" }).proposeQuestions({
          goalText: profile.goalText,
          existingFacts: profile.facts,
          currentHypotheses: profile.intent.hypotheses,
          unknownDimensions: confidence.missingDimensions,
        });
        candidateList = fallbackProp.candidates || [];
      }

      activeQuestion = this.questionSelector.selectBestQuestion(
        candidateList.map((c, i) => ({
          ...c,
          id: c.id || `q_${Date.now()}_${i}`,
          informationGain: 0,
          utilityScore: 0,
        })),
        profile.intent.hypotheses,
        profile.facts
      );
      }
    }

    await this.profileRepo.saveProfile(profile);

    await this.auditRepo.recordEvent({
      profileId: profile.id,
      eventType: "question_answered",
      details: {
        dimension,
        answer,
        newConfidenceScore: confidence.finalScore,
        newStatus: confidence.status,
      },
    });

    return {
      profile,
      extractedFacts: [answerFact],
      confidence,
      activeQuestion,
      roadmap: generatedRoadmap,
    };
  }

  /**
   * Converts a learner's natural-language or LLM-generated choice into the
   * stable vocabulary used by the deterministic hypothesis policy.
   */
  private normalizeAnswer(dimension: string, answer: string | string[]): string | string[] | number {
    if (Array.isArray(answer)) return answer.map((value) => this.normalizeAnswer(dimension, value) as string);

    const raw = answer.trim();
    const value = raw.toLowerCase();
    if (dimension === "hours_per_week") {
      const hours = value.match(/\d+/);
      return hours ? Number(hours[0]) : raw;
    }
    if (dimension === "primary_language") {
      if (value.includes("typescript") || value.includes("javascript") || value.includes("node")) return "typescript_node";
      if (value.includes("python")) return "python";
      if (value.includes("c#") || value.includes(".net")) return "dotnet";
      if (value.includes("go")) return "go";
      if (value.includes("java") && !value.includes("javascript")) return "java";
    }
    if (dimension === "target_domain" || dimension === "specialization_focus") {
      if (value.includes("erp") || value.includes("enterprise") || value.includes("bank") || value.includes("fintech")) return "enterprise_erp";
      if (value.includes("saas") || value.includes("web") || value.includes("consumer") || value.includes("product")) return "saas_web";
      if (value.includes("cloud") || value.includes("data") || value.includes("ai") || value.includes("async")) return "cloud_data";
      if (value.includes("security") || value.includes("cyber")) return "security";
      if (value.includes("infra") || value.includes("devops") || value.includes("tool")) return "infrastructure";
    }
    if (dimension === "architecture_preference") {
      if (value.includes("monolith") || value.includes("transaction")) return "modular_monolith";
      if (value.includes("microservice") || value.includes("event") || value.includes("queue")) return "microservices";
      if (value.includes("serverless") || value.includes("edge")) return "serverless";
    }
    if (dimension === "ethical_scope_confirmed") return value.startsWith("yes") || value.includes("confirm") ? "confirmed" : "unconfirmed";
    return raw;
  }

  /**
   * User explicitly corrects or revokes an inferred or stated fact.
   */
  public async correctFact(
    factId: string,
    correction: { newValue?: any; revoke?: boolean; reason?: string },
    profileId: string = "demo_learner_1"
  ): Promise<{ profile: LearnerProfile; roadmapStale: boolean }> {
    const profile = await this.profileRepo.getProfile(profileId);
    profile.facts = this.factEngine.correctFact(profile.facts, factId, correction);

    // Recalculate hypotheses & confidence
    const hypResult = this.hypothesisEngine.updateHypotheses(profile.facts);
    profile.intent.hypotheses = hypResult.hypotheses;
    profile.intent.topPathId = hypResult.topPath.pathId;

    const confidence = this.confidenceService.evaluateConfidence({
      hypotheses: profile.intent.hypotheses,
      facts: profile.facts,
      contradictions: [],
      questionCount: profile.intent.questionCount,
    });
    profile.intent.confidence = confidence;
    profile.intent.status = confidence.status;

    // Invalidate active roadmap
    let roadmapStale = false;
    if (profile.activeRoadmapId) {
      const rm = await this.roadmapRepo.getRoadmap(profile.activeRoadmapId);
      if (rm) {
        rm.isStale = true;
        rm.staleReason = `Profile fact corrected: ${correction.reason || "Updated by user"}`;
        await this.roadmapRepo.saveRoadmap(rm);
        roadmapStale = true;
      }
    }

    if (confidence.status === "clarifying") {
      profile.activeRoadmapId = null;
      profile.declaredTargetRole = null;
      profile.selectedPathId = null;
    } else if (confidence.status === "provisional") {
      profile.declaredTargetRole = `Provisional: ${hypResult.topPath.pathTitle}`;
      profile.selectedPathId = hypResult.topPath.pathId;
    } else {
      profile.declaredTargetRole = hypResult.topPath.pathTitle;
      profile.selectedPathId = hypResult.topPath.pathId;
    }

    await this.profileRepo.saveProfile(profile);

    await this.auditRepo.recordEvent({
      profileId: profile.id,
      eventType: "fact_corrected",
      details: { factId, correction, newConfidence: confidence.finalScore },
    });

    return { profile, roadmapStale };
  }

  /**
   * Generates a deterministic roadmap. Requires Intent Confidence gate to be ready or provisional.
   */
  public async generateRoadmap(profileId: string = "demo_learner_1"): Promise<Roadmap> {
    const profile = await this.profileRepo.getProfile(profileId);
    const targetPathId = profile.selectedPathId || profile.intent.topPathId || "backend_enterprise_java";
    const pathDef = SEEDED_PATHS.find((p) => p.id === targetPathId) || SEEDED_PATHS[0];

    // 1. Skill Gap Analysis
    const gapResults = this.skillGapService.analyzeGaps(
      pathDef.targetSkillWeights,
      profile.competencies,
      profile.constraints.deadlineMonths
    );

    // 2. Dependency-Safe Milestone Planning
    const roadmap = this.milestonePlanner.planMilestones(
      pathDef,
      gapResults,
      profile.preferences,
      profile.constraints,
      profile.id
    );

    // 3. Next-Best Action Computation
    roadmap.nextBestAction = this.nbaService.selectNextBestAction(roadmap);

    // 4. Save & associate
    await this.roadmapRepo.saveRoadmap(roadmap);
    profile.activeRoadmapId = roadmap.id;
    profile.selectedPathId = targetPathId;
    await this.profileRepo.saveProfile(profile);

    await this.auditRepo.recordEvent({
      profileId: profile.id,
      eventType: "roadmap_generated",
      details: {
        roadmapId: roadmap.id,
        pathId: targetPathId,
        milestonesCount: roadmap.milestones.length,
        totalHours: roadmap.totalEstimatedHours,
      },
    });

    return roadmap;
  }

  /**
   * Creates a non-destructive What-If Scenario with live diff calculations.
   */
  public async createScenario(
    baseRoadmapId: string,
    name: string,
    overrides: Scenario["overrides"],
    profileId: string = "demo_learner_1"
  ): Promise<Scenario> {
    const baseRoadmap = await this.roadmapRepo.getRoadmap(baseRoadmapId);
    const profile = await this.profileRepo.getProfile(profileId);

    const effectivePathId = overrides.targetRole || overrides.targetDomain || baseRoadmap?.targetPathId || "backend_enterprise_java";
    const pathDef = SEEDED_PATHS.find((p) => p.id === effectivePathId) || SEEDED_PATHS[0];

    const effectiveConstraints = {
      ...profile.constraints,
      hoursPerWeek: overrides.hoursPerWeek || profile.constraints.hoursPerWeek,
      deadlineMonths: overrides.deadlineMonths || profile.constraints.deadlineMonths,
    };

    const gapResults = this.skillGapService.analyzeGaps(
      pathDef.targetSkillWeights,
      profile.competencies,
      effectiveConstraints.deadlineMonths
    );

    const computedRoadmap = this.milestonePlanner.planMilestones(
      pathDef,
      gapResults,
      profile.preferences,
      effectiveConstraints,
      profile.id
    );

    computedRoadmap.nextBestAction = this.nbaService.selectNextBestAction(computedRoadmap);

    // Compute Diff against Base Roadmap
    const baseHours = baseRoadmap?.totalEstimatedHours || 0;
    const baseWeeks = baseRoadmap?.totalEstimatedWeeks || 0;
    const hoursDelta = computedRoadmap.totalEstimatedHours - baseHours;
    const weeksDelta = Number((computedRoadmap.totalEstimatedWeeks - baseWeeks).toFixed(1));

    const baseSkills = new Set(baseRoadmap?.milestones.flatMap((m) => m.skillIds) || []);
    const scenarioSkills = new Set(computedRoadmap.milestones.flatMap((m) => m.skillIds));

    const addedSkillIds = Array.from(scenarioSkills).filter((s) => !baseSkills.has(s));
    const removedSkillIds = Array.from(baseSkills).filter((s) => !scenarioSkills.has(s));

    const diff: ScenarioDiff = {
      addedSkillIds,
      removedSkillIds,
      hoursDelta,
      weeksDelta,
      confidenceDelta: 0,
      summary: `Changing pace to ${effectiveConstraints.hoursPerWeek}h/week results in ${weeksDelta > 0 ? `+${weeksDelta}` : weeksDelta} weeks timeline adjustment.`,
      affectedMilestoneTitles: computedRoadmap.milestones.map((m) => m.title),
    };

    const scenario: Scenario = {
      id: `scenario_${Date.now()}`,
      baseRoadmapId,
      name,
      overrides,
      computedRoadmap,
      diff,
      createdAt: new Date().toISOString(),
    };

    await this.scenarioRepo.saveScenario(profileId, scenario);

    await this.auditRepo.recordEvent({
      profileId: profile.id,
      eventType: "scenario_created",
      details: { scenarioId: scenario.id, overrides, diffSummary: diff.summary },
    });

    return scenario;
  }

  /**
   * Submits diagnostic assessment results, updating competency records and active roadmap.
   */
  public async submitAssessment(
    skillId: string,
    score: number,
    passed: boolean,
    profileId: string = "demo_learner_1",
    notes?: string
  ): Promise<{ profile: LearnerProfile; roadmap: Roadmap }> {
    const profile = await this.profileRepo.getProfile(profileId);

    const existingIndex = profile.competencies.findIndex((c) => c.skillId === skillId);
    const updatedRecord: CompetencyRecord = {
      skillId,
      skillTitle: skillId,
      claimedLevel: "proficient",
      verifiedLevel: passed ? "proficient" : "novice",
      status: passed ? "assessed_diagnostic" : "unknown",
      confidence: passed ? 0.95 : 0.4,
      evidenceNotes: [notes || `Diagnostic score: ${score}% (Passed: ${passed})`],
      lastAssessedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      profile.competencies[existingIndex] = updatedRecord;
    } else {
      profile.competencies.push(updatedRecord);
    }

    await this.profileRepo.saveProfile(profile);

    // Regenerate active roadmap to reflect unlocked/skipped modules
    const updatedRoadmap = await this.generateRoadmap(profile.id);

    await this.auditRepo.recordEvent({
      profileId: profile.id,
      eventType: "assessment_submitted",
      details: { skillId, score, passed },
    });

    return { profile, roadmap: updatedRoadmap };
  }

  public async getProfile(profileId: string = "demo_learner_1"): Promise<LearnerProfile> {
    return this.profileRepo.getProfile(profileId);
  }

  public async getRoadmap(roadmapId: string): Promise<Roadmap | null> {
    return this.roadmapRepo.getRoadmap(roadmapId);
  }

  public async getScenarios(profileId: string = "demo_learner_1"): Promise<Scenario[]> {
    return this.scenarioRepo.getScenariosForProfile(profileId);
  }

  public async getAuditEvents(limit: number = 50) {
    return this.auditRepo.getRecentEvents(limit);
  }

  public async getSavedRoadmaps(profileId: string = "demo_learner_1"): Promise<Roadmap[]> {
    return this.roadmapRepo.getSavedRoadmapsForProfile(profileId);
  }

  public async switchActiveRoadmap(roadmapId: string, profileId: string = "demo_learner_1"): Promise<{ profile: LearnerProfile; roadmap: Roadmap }> {
    const rm = await this.roadmapRepo.getRoadmap(roadmapId);
    if (!rm) throw new Error("Roadmap not found");
    const profile = await this.profileRepo.getProfile(profileId);
    profile.activeRoadmapId = rm.id;
    profile.selectedPathId = rm.targetPathId;
    profile.declaredTargetRole = rm.targetPathTitle;
    await this.profileRepo.saveProfile(profile);
    return { profile, roadmap: rm };
  }

  public async resetState(profileId: string = "demo_learner_1"): Promise<LearnerProfile> {
    return this.profileRepo.resetProfile(profileId);
  }
}

// Singleton Orchestrator Instance
export const orchestrator = new LearningOrchestrator();
