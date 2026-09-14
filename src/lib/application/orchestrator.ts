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
  LlmExecutionMetadata,
  ALLOWED_QUESTION_DIMENSIONS,
  RoadmapGenerationEligibility,
  FeasibilityResult,
  LockedPathReason,
  RoadmapDecision,
  TechnologyEcosystem,
  CurriculumDiscoveryContext,
  PendingGoalChange,
} from "../contracts";
import { FactPrecedenceEngine } from "../domain/intent/fact-precedence-engine";
import { HypothesisEngine, HypothesisUpdateResult } from "../domain/intent/hypothesis-engine";
import { IntentConfidenceService } from "../domain/intent/confidence-service";
import { QuestionSelector } from "../domain/intent/question-selector";
import { SkillGraph } from "../domain/learning/skill-graph";
import { SkillGapService, SkillGapAnalysisResult } from "../domain/learning/skill-gap-service";
import { MilestonePlanner } from "../domain/learning/milestone-planner";
import { NextBestActionService } from "../domain/learning/next-best-action-service";
import { resolveLearnerTechnologyContext } from "../domain/learning/technology-ecosystem";
import { pathCompatibilityGate, IntentCompatibilityEvaluation, isNonCommittalAnswer } from "../domain/intent/path-compatibility-gate";
import { feasibilityEvaluator } from "../domain/learning/feasibility-evaluator";
import { Curriculum, catalogPathToCurriculum } from "../domain/learning/curriculum-model";
import { CurriculumDiscoveryService, curriculumDiscoveryService } from "../domain/learning/curriculum-discovery-service";
import { RecommendationEngine, recommendationEngine } from "../domain/intent/recommendation-engine";
import { semanticDimensionValidator } from "../domain/intent/semantic-dimension-validator";
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
  roadmapEligibility: RoadmapGenerationEligibility;
  feasibility: FeasibilityResult | null;
  decision: RoadmapDecision;
  pendingGoalChange?: PendingGoalChange | null;
  executionMetadata?: LlmExecutionMetadata | null;
}

/**
 * Global runtime invariant assertion layer.
 * Validates that every state transition strictly obeys architectural invariants.
 */
export function assertGlobalInvariants(
  profile: LearnerProfile,
  decision: RoadmapDecision,
  roadmap: Roadmap | null
): void {
  // 1. Unsupported intent invariants
  if (decision.eligibility === "unsupported_intent") {
    if (decision.selectedPathId !== null) {
      throw new Error(
        `[INVARIANT VIOLATION] selectedPathId must be null for unsupported_intent, got: ${decision.selectedPathId}`
      );
    }
    if (roadmap !== null) {
      throw new Error(`[INVARIANT VIOLATION] roadmap must be null for unsupported_intent`);
    }
    if (decision.activeQuestion !== null) {
      throw new Error(`[INVARIANT VIOLATION] activeQuestion must be null for unsupported_intent`);
    }
  }

  // 2. No compatible path invariants
  if (decision.eligibility === "no_compatible_path") {
    if (decision.selectedPathId !== null) {
      throw new Error(
        `[INVARIANT VIOLATION] selectedPathId must be null for no_compatible_path, got: ${decision.selectedPathId}`
      );
    }
    if (roadmap !== null) {
      throw new Error(`[INVARIANT VIOLATION] roadmap must be null for no_compatible_path`);
    }
    if (decision.activeQuestion !== null) {
      throw new Error(`[INVARIANT VIOLATION] activeQuestion must be null for no_compatible_path`);
    }
  }

  // 3. Material uncertainty invariants
  if (decision.eligibility === "material_uncertainty") {
    if (decision.selectedPathId !== null) {
      throw new Error(
        `[INVARIANT VIOLATION] selectedPathId must be null for material_uncertainty, got: ${decision.selectedPathId}`
      );
    }
    if (roadmap !== null) {
      throw new Error(`[INVARIANT VIOLATION] roadmap must be null for material_uncertainty`);
    }
  }

  // 4. Infeasible plan invariants
  if (decision.eligibility === "infeasible") {
    if (roadmap !== null) {
      throw new Error(`[INVARIANT VIOLATION] roadmap must be null for infeasible plan`);
    }
    if (decision.activeQuestion !== null) {
      throw new Error(`[INVARIANT VIOLATION] activeQuestion must be null for infeasible plan`);
    }
    if (!decision.feasibility || decision.feasibility.status !== "infeasible") {
      throw new Error(`[INVARIANT VIOLATION] feasibility status must be infeasible when eligibility is infeasible`);
    }
  }

  // 5. Eligible decision invariants
  if (decision.eligibility === "eligible") {
    if (decision.curriculumSource === "catalog") {
      if (decision.selectedPathId === null) {
        throw new Error(`[INVARIANT VIOLATION] selectedPathId cannot be null for eligible catalog roadmap`);
      }
      if (roadmap && roadmap.targetPathId === null) {
        throw new Error(`[INVARIANT VIOLATION] roadmap.targetPathId cannot be null for catalog roadmap`);
      }
    } else if (decision.curriculumSource === "constructed") {
      if (decision.selectedPathId !== null) {
        throw new Error(
          `[INVARIANT VIOLATION] selectedPathId must be null for constructed roadmap, got: ${decision.selectedPathId}`
        );
      }
      if (!decision.curriculumId) {
        throw new Error(`[INVARIANT VIOLATION] curriculumId cannot be null for constructed roadmap`);
      }
      if (roadmap && roadmap.targetPathId !== null) {
        throw new Error(
          `[INVARIANT VIOLATION] roadmap.targetPathId must be null for constructed roadmap, got: ${roadmap.targetPathId}`
        );
      }
    }

    if (roadmap === null) {
      throw new Error(`[INVARIANT VIOLATION] roadmap cannot be null for eligible decision`);
    }
    if (!decision.feasibility || (decision.feasibility.status !== "feasible" && decision.feasibility.status !== "strained")) {
      throw new Error(`[INVARIANT VIOLATION] feasibility must be feasible or strained for eligible roadmap`);
    }
  }

  // 6. No roadmap exists unless decision.eligibility === "eligible"
  if (roadmap !== null && decision.eligibility !== "eligible") {
    throw new Error(`[INVARIANT VIOLATION] roadmap generated when decision.eligibility is '${decision.eligibility}'`);
  }

  // 7. No question exists unless roadmapEligibility === "material_uncertainty"
  if (decision.activeQuestion !== null && decision.eligibility !== "material_uncertainty") {
    throw new Error(`[INVARIANT VIOLATION] activeQuestion returned when decision.eligibility is '${decision.eligibility}'`);
  }

  // 8. Zero contamination check for generated roadmaps
  if (roadmap !== null) {
    for (const milestone of roadmap.milestones) {
      for (const res of milestone.resources) {
        if (roadmap.targetPathId === "backend_web_product_node") {
          const lowerTitle = res.title.toLowerCase();
          const lowerDesc = (res.description || "").toLowerCase();
          if (
            lowerTitle.includes("spring boot") ||
            lowerTitle.includes("jpa") ||
            lowerTitle.includes("hibernate") ||
            lowerDesc.includes("spring framework")
          ) {
            throw new Error(
              `[INVARIANT VIOLATION] Incompatible Java/Spring resource '${res.title}' found in Node/TypeScript roadmap`
            );
          }
        }
      }
      if (milestone.project) {
        if (roadmap.targetPathId === "backend_web_product_node") {
          if (milestone.project.ecosystem === "java_spring") {
            throw new Error(
              `[INVARIANT VIOLATION] Incompatible Java project '${milestone.project.title}' in Node roadmap`
            );
          }
        }
      }
    }
  }

  // 9. Active Question dimension must exist in missing material dimensions
  if (decision.activeQuestion !== null && decision.activeQuestion.selectedQuestion) {
    const qDim = decision.activeQuestion.selectedQuestion.dimension.toLowerCase();
    const missingMaterialLower = decision.missingMaterialDimensions.map((d) => d.toLowerCase());
    if (!missingMaterialLower.includes(qDim)) {
      throw new Error(
        `[INVARIANT VIOLATION] activeQuestion dimension '${qDim}' is not in missingMaterialDimensions: [${missingMaterialLower.join(", ")}]`
      );
    }
  }

  // 10. Recommendation mode must have options and activeQuestion must be null
  if (decision.recommendation) {
    if (decision.activeQuestion !== null) {
      throw new Error(
        `[INVARIANT VIOLATION] activeQuestion must be null when recommendation mode is active`
      );
    }
    if (!decision.recommendation.options || decision.recommendation.options.length === 0) {
      throw new Error(
        `[INVARIANT VIOLATION] recommendation mode must contain at least 1 viable option`
      );
    }
  }
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
  private curriculumDiscoveryService: CurriculumDiscoveryService;
  private recommendationEngine: RecommendationEngine;

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
    this.curriculumDiscoveryService = new CurriculumDiscoveryService();
    this.recommendationEngine = new RecommendationEngine();
  }

  /**
   * Synchronizes profile.preferences and profile.constraints from active facts.
   */
  private syncProfilePreferencesAndConstraints(profile: LearnerProfile): void {
    const activeFacts = profile.facts.filter((f) => f.status === "active");
    const languages = new Set<string>(profile.preferences.languages || []);
    const domains = new Set<string>(profile.preferences.domains || []);

    for (const fact of activeFacts) {
      const dim = String(fact.dimension || "").toLowerCase();

      if (
        dim === "primary_language" ||
        dim === "languages" ||
        dim === "known_skills" ||
        dim === "technical_background"
      ) {
        if (Array.isArray(fact.normalizedValue)) {
          for (const item of fact.normalizedValue) {
            if (typeof item === "string" && item.trim()) languages.add(item.trim());
          }
        } else if (typeof fact.normalizedValue === "string") {
          languages.add(fact.normalizedValue.trim());
        }
      }

      if (
        dim === "target_domain" ||
        dim === "domain" ||
        dim === "specialization_focus" ||
        dim === "industry"
      ) {
        if (Array.isArray(fact.normalizedValue)) {
          for (const item of fact.normalizedValue) {
            if (typeof item === "string" && item.trim()) domains.add(item.trim());
          }
        } else if (typeof fact.normalizedValue === "string") {
          domains.add(fact.normalizedValue.trim());
        }
      }

      if (dim === "hours_per_week") {
        const num =
          typeof fact.normalizedValue === "number"
            ? fact.normalizedValue
            : parseInt(String(fact.normalizedValue), 10);
        if (!isNaN(num) && num > 0) {
          profile.constraints.hoursPerWeek = num;
        }
      }

      if (dim === "deadline_months") {
        const num =
          typeof fact.normalizedValue === "number"
            ? fact.normalizedValue
            : parseInt(String(fact.normalizedValue), 10);
        if (!isNaN(num) && num > 0) {
          profile.constraints.deadlineMonths = num;
        }
      }
    }

    profile.preferences.languages = Array.from(languages);
    profile.preferences.domains = Array.from(domains);
  }

  /**
   * Extracts and permanently preserves declaredTargetRole representing learner intent.
   * NEVER clears declaredTargetRole to null because roadmap generation was blocked or in clarifying state.
   */
  private extractAndPreserveDeclaredRole(
    profile: LearnerProfile,
    detectedGoal: string | undefined,
    activeFacts: ProfileFact[]
  ): string | null {
    const goalFact = activeFacts.find(
      (f) =>
        f.dimension === "declared_goal" ||
        f.dimension === "target_role" ||
        f.dimension === "goal"
    );
    if (goalFact) {
      return String(goalFact.normalizedValue || goalFact.rawValue);
    }

    if (detectedGoal && detectedGoal.trim()) {
      return detectedGoal.trim();
    }

    if (profile.declaredTargetRole) {
      return profile.declaredTargetRole;
    }

    return null;
  }

  /**
   * Evaluates the single authoritative RoadmapDecision state machine.
   */
  private async evaluateRoadmapDecision(
    profile: LearnerProfile,
    compatEval: IntentCompatibilityEvaluation,
    hypResult: HypothesisUpdateResult,
    confidence: ConfidenceBreakdown,
    llm: any
  ): Promise<{
    decision: RoadmapDecision;
    lockedPath: PathDefinition | null;
    curriculum: Curriculum | null;
    gapResults: SkillGapAnalysisResult[];
    targetEcosystem: TechnologyEcosystem;
  }> {
    const activeFacts = profile.facts.filter((f) => f.status === "active");
    const techContext = resolveLearnerTechnologyContext(profile.preferences, activeFacts);
    const knownDimensions = new Set(
      activeFacts
        .filter((f) => !isNonCommittalAnswer(String(f.normalizedValue || f.rawValue || "")))
        .map((f) => f.dimension.toLowerCase())
    );

    const goalFacts = activeFacts.filter(
      (f) => f.dimension === "declared_goal" || f.dimension === "goal" || f.dimension === "target_role"
    );
    const domainFacts = activeFacts.filter(
      (f) => f.dimension === "target_domain" || f.dimension === "domain" || f.dimension === "industry"
    );
    const specializationFacts = activeFacts.filter(
      (f) => f.dimension === "specialization_focus" || f.dimension === "specialization"
    );

    // ==========================================
    // PATH 1: CATALOG PATH MATCHING
    // ==========================================
    if (compatEval.eligiblePaths.length > 0) {
      let lockedPath: PathDefinition | null = null;
      let lockedReason: LockedPathReason | null = null;

      if (confidence.missingMaterialDimensions.length === 0) {
        if (compatEval.eligiblePaths.length === 1) {
          lockedPath = compatEval.eligiblePaths[0];
          lockedReason = "sole_eligible_path";
        } else if (hypResult.topPath && hypResult.topPath.posteriorProbability >= 0.8) {
          const topDef = compatEval.eligiblePaths.find((p) => p.id === hypResult.topPath?.pathId);
          if (topDef) {
            lockedPath = topDef;
            lockedReason = "fully_disambiguated";
          }
        } else if (hypResult.topPath) {
          const competingEcosystems = new Set(
            compatEval.eligiblePaths.map((p) => p.technologyEcosystem || "agnostic")
          );
          if (competingEcosystems.size > 1 && !knownDimensions.has("primary_language")) {
            lockedPath = null;
          } else {
            const topDef = compatEval.eligiblePaths.find((p) => p.id === hypResult.topPath?.pathId);
            if (topDef && (confidence.status === "ready" || confidence.status === "provisional")) {
              lockedPath = topDef;
              lockedReason = "fully_disambiguated";
            }
          }
        }
      }

      // If catalog path cannot be locked due to material uncertainty:
      if (!lockedPath) {
        // Check if learner has delegated any dimension
        const delegatedFacts = activeFacts.filter((f) =>
          isNonCommittalAnswer(String(f.normalizedValue || f.rawValue || ""))
        );

        let activeQuestion: QuestionDecision | null = null;
        let recommendation: any = null;

        if (delegatedFacts.length > 0) {
          const lastDelegated = delegatedFacts[delegatedFacts.length - 1];
          recommendation = await this.recommendationEngine.generateRecommendation({
            dimension: lastDelegated.dimension,
            eligiblePaths: compatEval.eligiblePaths,
            declaredTargetRole: profile.declaredTargetRole,
            existingFacts: activeFacts,
          });
        }

        if (!recommendation) {
          activeQuestion = await this.resolveClarificationQuestion(profile, confidence, llm);
        }

        const explanation = recommendation
          ? `Here are the supported directions for your path, highlighted by market demand.`
          : "Material dimensions are required before establishing a learning path.";

        const decision: RoadmapDecision = {
          eligibility: "material_uncertainty",
          selectedPathId: null,
          curriculumId: null,
          curriculumSource: null,
          declaredTargetRole: profile.declaredTargetRole,
          lockedPathReason: null,
          confidence,
          feasibility: null,
          missingMaterialDimensions: confidence.missingMaterialDimensions,
          activeQuestion,
          recommendation,
          explanation,
        };
        return { decision, lockedPath: null, curriculum: null, gapResults: [], targetEcosystem: "agnostic" };
      }

      // Catalog Path Locked -> Convert to Curriculum, Gap Analysis & Feasibility
      const targetEcosystem: TechnologyEcosystem =
        lockedPath.technologyEcosystem && lockedPath.technologyEcosystem !== "agnostic"
          ? lockedPath.technologyEcosystem
          : techContext.backendEcosystem;

      const curriculum = catalogPathToCurriculum(lockedPath, targetEcosystem);

      const specializedWeights = this.skillGapService.specializeTargetSkillWeights(
        lockedPath.id,
        lockedPath.targetSkillWeights,
        targetEcosystem
      );

      const gapResults = this.skillGapService.analyzeGaps(
        specializedWeights,
        profile.competencies,
        profile.constraints.deadlineMonths,
        targetEcosystem,
        { skills: curriculum.skills, edges: curriculum.edges }
      );

      const requiredHours = this.milestonePlanner.calculateRequiredHours(
        curriculum,
        gapResults,
        targetEcosystem
      );

      const feasibility = feasibilityEvaluator.evaluate({
        requiredHours,
        hoursPerWeek: profile.constraints.hoursPerWeek,
        deadlineMonths: profile.constraints.deadlineMonths,
      });

      if (feasibility.status === "infeasible") {
        const decision: RoadmapDecision = {
          eligibility: "infeasible",
          selectedPathId: lockedPath.id,
          curriculumId: curriculum.id,
          curriculumSource: "catalog",
          declaredTargetRole: profile.declaredTargetRole,
          lockedPathReason: lockedReason,
          confidence,
          feasibility,
          missingMaterialDimensions: [],
          activeQuestion: null,
          explanation: feasibility.explanation,
        };
        return { decision, lockedPath, curriculum, gapResults, targetEcosystem };
      }

      const decision: RoadmapDecision = {
        eligibility: "eligible",
        selectedPathId: lockedPath.id,
        curriculumId: curriculum.id,
        curriculumSource: "catalog",
        declaredTargetRole: profile.declaredTargetRole,
        lockedPathReason: lockedReason,
        confidence,
        feasibility,
        missingMaterialDimensions: [],
        activeQuestion: null,
        explanation: feasibility.explanation,
      };

      return { decision, lockedPath, curriculum, gapResults, targetEcosystem };
    }

    // ==========================================
    // PATH 2: NO CATALOG MATCH -> CAPABILITY ASSESSMENT -> CLARIFICATION -> CURRICULUM DISCOVERY
    // ==========================================
    const declaredRoleOrGoal = profile.declaredTargetRole || goalFacts[0]?.rawValue;

    // If learner gave no clear goal/role at all, intent is materially uncertain
    if (!declaredRoleOrGoal || declaredRoleOrGoal.trim().length === 0) {
      const activeQuestion = await this.resolveClarificationQuestion(profile, confidence, llm);
      const decision: RoadmapDecision = {
        eligibility: "material_uncertainty",
        selectedPathId: null,
        curriculumId: null,
        curriculumSource: null,
        declaredTargetRole: null,
        lockedPathReason: null,
        confidence,
        feasibility: null,
        missingMaterialDimensions: ["declared_goal"],
        activeQuestion,
        explanation: "Please declare your target career goal or role.",
      };
      return { decision, lockedPath: null, curriculum: null, gapResults: [], targetEcosystem: "agnostic" };
    }

    // Step 2 & 3: Run Capability Assessment on uncatalogued goal
    const capability = await llm.assessCurriculumCapability(declaredRoleOrGoal, {
      existingFacts: activeFacts,
      learnerBackground: profile.goalText,
    });

    if (!capability.supported) {
      const decision: RoadmapDecision = {
        eligibility: "unsupported_intent",
        selectedPathId: null,
        curriculumId: null,
        curriculumSource: null,
        declaredTargetRole: declaredRoleOrGoal,
        lockedPathReason: null,
        confidence: {
          ...confidence,
          unsupportedIntent: true,
          unsupportedReason: capability.rationale,
        },
        feasibility: null,
        missingMaterialDimensions: [],
        activeQuestion: null,
        explanation: capability.rationale,
      };
      return { decision, lockedPath: null, curriculum: null, gapResults: [], targetEcosystem: "agnostic" };
    }

    // Step 4 & 5: Check Material Dimensions / Clarification / Exploration Mode for uncatalogued goal
    if (confidence.missingMaterialDimensions.length > 0) {
      // Check if learner has delegated any dimension (e.g. "Not sure")
      const delegatedFacts = activeFacts.filter((f) =>
        isNonCommittalAnswer(String(f.normalizedValue || f.rawValue || ""))
      );

      let activeQuestion: QuestionDecision | null = null;
      let recommendation: any = null;

      if (delegatedFacts.length > 0) {
        const lastDelegated = delegatedFacts[delegatedFacts.length - 1];
        recommendation = await this.recommendationEngine.generateRecommendation({
          dimension: lastDelegated.dimension,
          eligiblePaths: [],
          declaredTargetRole: declaredRoleOrGoal,
          existingFacts: activeFacts,
        });
      }

      if (!recommendation) {
        activeQuestion = await this.resolveClarificationQuestion(profile, confidence, llm);
      }

      const explanation = recommendation
        ? `Here are the supported directions for ${declaredRoleOrGoal}, highlighted by market demand.`
        : `Material dimensions are required before constructing a curriculum for ${declaredRoleOrGoal}.`;

      const decision: RoadmapDecision = {
        eligibility: "material_uncertainty",
        selectedPathId: null,
        curriculumId: null,
        curriculumSource: null,
        declaredTargetRole: declaredRoleOrGoal,
        lockedPathReason: null,
        confidence,
        feasibility: null,
        missingMaterialDimensions: confidence.missingMaterialDimensions,
        activeQuestion,
        recommendation,
        explanation,
      };
      return { decision, lockedPath: null, curriculum: null, gapResults: [], targetEcosystem: "agnostic" };
    }

    // Step 10 & 11: Intent is resolved -> initiate controlled discovery with deterministic verification
    const targetEcosystem = techContext.backendEcosystem;
    const discoveryContext: CurriculumDiscoveryContext = {
      targetRole: declaredRoleOrGoal,
      targetDomain: domainFacts[0]?.rawValue,
      specialization: specializationFacts[0]?.rawValue,
      technicalConstraints: profile.preferences.languages.concat(profile.preferences.domains),
      learnerBackground: profile.goalText,
    };

    const discoveryResult = await this.curriculumDiscoveryService.discoverAndVerifyCurriculum(
      discoveryContext,
      llm,
      targetEcosystem
    );

    if (discoveryResult.status !== "success" || !discoveryResult.curriculum) {
      const explanation =
        discoveryResult.failureReason ||
        `The system cannot establish sufficient verified curriculum knowledge for the requested goal: '${declaredRoleOrGoal}'.`;

      const decision: RoadmapDecision = {
        eligibility: "unsupported_intent",
        selectedPathId: null,
        curriculumId: null,
        curriculumSource: null,
        declaredTargetRole: declaredRoleOrGoal,
        lockedPathReason: null,
        confidence,
        feasibility: null,
        missingMaterialDimensions: [],
        activeQuestion: null,
        explanation,
      };
      return { decision, lockedPath: null, curriculum: null, gapResults: [], targetEcosystem: "agnostic" };
    }

    // Discovery Succeeded & Passed 10 Hard Gates!
    const constructedCurriculum = discoveryResult.curriculum;

    const gapResults = this.skillGapService.analyzeGaps(
      constructedCurriculum.targetSkillWeights,
      profile.competencies,
      profile.constraints.deadlineMonths,
      targetEcosystem,
      { skills: constructedCurriculum.skills, edges: constructedCurriculum.edges }
    );

    const requiredHours = this.milestonePlanner.calculateRequiredHours(
      constructedCurriculum,
      gapResults,
      targetEcosystem
    );

    const feasibility = feasibilityEvaluator.evaluate({
      requiredHours,
      hoursPerWeek: profile.constraints.hoursPerWeek,
      deadlineMonths: profile.constraints.deadlineMonths,
    });

    if (feasibility.status === "infeasible") {
      const decision: RoadmapDecision = {
        eligibility: "infeasible",
        selectedPathId: null,
        curriculumId: constructedCurriculum.id,
        curriculumSource: "constructed",
        declaredTargetRole: profile.declaredTargetRole,
        lockedPathReason: null,
        confidence,
        feasibility,
        missingMaterialDimensions: [],
        activeQuestion: null,
        explanation: feasibility.explanation,
      };
      return { decision, lockedPath: null, curriculum: constructedCurriculum, gapResults, targetEcosystem };
    }

    const decision: RoadmapDecision = {
      eligibility: "eligible",
      selectedPathId: null,
      curriculumId: constructedCurriculum.id,
      curriculumSource: "constructed",
      declaredTargetRole: profile.declaredTargetRole,
      lockedPathReason: "fully_disambiguated",
      confidence,
      feasibility,
      missingMaterialDimensions: [],
      activeQuestion: null,
      explanation: feasibility.explanation,
    };

    return { decision, lockedPath: null, curriculum: constructedCurriculum, gapResults, targetEcosystem };
  }

  /**
   * Main Conversational Intake pipeline:
   * 1. Extract facts (LLM)
   * 2. Merge facts (Precedence)
   * 3. Sync preferences & constraints
   * 4. Preserve declaredTargetRole
   * 5. Path Compatibility Gate
   * 6. Hypotheses ranking
   * 7. Intent confidence & material completeness
   * 8. State Machine RoadmapDecision evaluation
   * 9. Construct roadmap if eligible
   * 10. Persist & assert global invariants
   */
  /**
   * Invalidates all derived state (facts, hypotheses, recommendations, roadmaps) when declared_goal changes.
   */
  public async invalidateDerivedState(
    profile: LearnerProfile,
    newGoal: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const cleanGoal = newGoal.trim();

    // 1. Invalidate all goal-dependent downstream facts
    const preservedFacts: ProfileFact[] = [];
    for (const f of profile.facts) {
      const dim = (f.dimension || "").toLowerCase();
      if (
        dim === "declared_goal" ||
        dim === "goal" ||
        dim === "target_role" ||
        dim === "target_domain" ||
        dim === "domain" ||
        dim === "specialization_focus" ||
        dim === "specialization" ||
        dim === "architecture_preference" ||
        dim === "primary_language" ||
        dim === "languages"
      ) {
        // Drop old goal-dependent fact
        continue;
      }
      if (f.status === "active") {
        preservedFacts.push(f);
      }
    }

    // 2. Add fresh declared_goal fact
    const newGoalFact: ProfileFact = {
      id: `fact_goal_${Date.now()}`,
      dimension: "declared_goal",
      normalizedValue: cleanGoal,
      rawValue: cleanGoal,
      source: "self_report",
      evidence: `User declared career goal: ${cleanGoal}`,
      reliability: 0.98,
      impact: "high",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    preservedFacts.push(newGoalFact);

    profile.facts = preservedFacts;
    profile.declaredTargetRole = cleanGoal;
    profile.goalText = cleanGoal;
    profile.preferences.domains = [];
    profile.preferences.languages = [];
    profile.selectedPathId = null;
    profile.curriculumId = null;
    profile.curriculumSource = null;

    if (profile.activeRoadmapId) {
      const rm = await this.roadmapRepo.getRoadmap(profile.activeRoadmapId);
      if (rm) {
        rm.isStale = true;
        rm.staleReason = `Career goal changed to: ${cleanGoal}`;
        await this.roadmapRepo.saveRoadmap(rm);
      }
      profile.activeRoadmapId = null;
    }

    profile.intent.hypotheses = [];
    profile.intent.topPathId = null;
    profile.intent.questionCount = 0;
    profile.intent.unansweredDimensions = [];
  }

  /**
   * Main Conversational Intake pipeline:
   * Enforces Mode A (Active Clarification/Recommendation/Confirmation) vs Mode B (Open Intake).
   */
  public async handleIntake(
    request: IntakeMessageRequest,
    profileId: string = "demo_learner_1"
  ): Promise<IntakeResponse> {
    const profile = await this.profileRepo.getProfile(profileId);

    const llmConfig: LlmGatewayConfig = {
      provider: request.modelProvider,
      apiKey: request.apiKey,
      modelName: request.modelName,
    };
    const llm = this.llmGateway.getAdapter(llmConfig);

    const activeFacts = profile.facts.filter((f) => f.status === "active");

    // ==========================================
    // MODE A: ACTIVE CLARIFICATION / RECOMMENDATION
    // ==========================================
    if (activeFacts.length > 0 && profile.declaredTargetRole) {
      const curHypResult = this.hypothesisEngine.updateHypotheses(profile.facts);
      const curConfidence = this.confidenceService.evaluateConfidence({
        hypotheses: curHypResult.hypotheses,
        facts: profile.facts,
        contradictions: [],
        questionCount: profile.intent.questionCount,
        maxBudget: profile.intent.maxQuestionBudget,
      });

      const delegatedFacts = activeFacts.filter((f) =>
        isNonCommittalAnswer(String(f.normalizedValue || f.rawValue || ""))
      );

      let expectedDimension: string | null = null;
      if (delegatedFacts.length > 0) {
        expectedDimension = delegatedFacts[delegatedFacts.length - 1].dimension;
      } else if (curConfidence.missingMaterialDimensions.length > 0) {
        expectedDimension = curConfidence.missingMaterialDimensions[0];
      }

      if (expectedDimension) {
        const validation = semanticDimensionValidator.validateDimensionAnswer(
          expectedDimension,
          request.message,
          profile.declaredTargetRole
        );

        // A. Explicit goal-change statement (e.g. "Actually, I want to become a Mobile App Developer")
        if (validation.status === "explicit_goal_change") {
          const newGoal = validation.proposedGoal || request.message.trim();
          await this.invalidateDerivedState(profile, newGoal);
          this.syncProfilePreferencesAndConstraints(profile);

          const compatEval = pathCompatibilityGate.evaluateIntentCompatibility(
            profile.facts.filter((f) => f.status === "active"),
            SEEDED_PATHS
          );
          const hypResult = this.hypothesisEngine.updateHypotheses(profile.facts);
          profile.intent.hypotheses = hypResult.hypotheses;
          profile.intent.topPathId = hypResult.topPath ? hypResult.topPath.pathId : null;

          const confidence = this.confidenceService.evaluateConfidence({
            hypotheses: profile.intent.hypotheses,
            facts: profile.facts,
            contradictions: [],
            questionCount: profile.intent.questionCount,
            maxBudget: profile.intent.maxQuestionBudget,
          });
          profile.intent.confidence = confidence;
          profile.intent.status = confidence.status;
          profile.intent.unansweredDimensions = confidence.missingDimensions;

          const { decision, lockedPath, curriculum, gapResults, targetEcosystem } = await this.evaluateRoadmapDecision(
            profile,
            compatEval,
            hypResult,
            confidence,
            llm
          );

          profile.selectedPathId = decision.selectedPathId;
          profile.curriculumId = decision.curriculumId;
          profile.curriculumSource = decision.curriculumSource;

          let generatedRoadmap: Roadmap | null = null;
          if (decision.eligibility === "eligible" && curriculum) {
            generatedRoadmap = this.milestonePlanner.planMilestones(
              curriculum,
              gapResults,
              profile.preferences,
              profile.constraints,
              profile.id,
              targetEcosystem
            );
            generatedRoadmap.nextBestAction = this.nbaService.selectNextBestAction(generatedRoadmap);
            await this.roadmapRepo.saveRoadmap(generatedRoadmap);
            profile.activeRoadmapId = generatedRoadmap.id;
          } else {
            profile.activeRoadmapId = null;
          }

          await this.profileRepo.saveProfile(profile);
          assertGlobalInvariants(profile, decision, generatedRoadmap);

          return {
            profile,
            extractedFacts: profile.facts.filter((f) => f.dimension === "declared_goal" && f.status === "active"),
            confidence,
            activeQuestion: decision.activeQuestion,
            roadmap: generatedRoadmap,
            roadmapEligibility: decision.eligibility,
            feasibility: decision.feasibility,
            decision,
            pendingGoalChange: null,
            executionMetadata: (llm as any).getLastExecutionMetadata?.() || null,
          };
        }

        // B. Semantic role mismatch (e.g. user typed "Mobile App Developer" for target_domain)
        if (validation.status === "role_mismatch") {
          const currentGoal = profile.declaredTargetRole || "Software Engineer";
          const proposedGoal = validation.proposedGoal || request.message.trim();
          const pendingGoalChange = {
            proposedGoal,
            currentGoal,
            previousDimension: expectedDimension,
          };

          const confirmQuestionCandidate = {
            id: `q_confirm_goal_${Date.now()}`,
            dimension: "confirm_goal_change",
            question: `${proposedGoal} looks like a change to your target career rather than a ${expectedDimension.replace(/_/g, " ")} choice. Do you want to change your career goal from ${currentGoal} to ${proposedGoal}?`,
            answerType: "single_choice" as const,
            options: [
              `Yes, change my goal to ${proposedGoal}`,
              `No, keep ${currentGoal}`,
            ],
            why: "Changing your career goal resets downstream curriculum recommendations so they align with your new role.",
            predictedAnswerBuckets: ["confirmed", "rejected"],
            informationGain: 1.0,
            utilityScore: 1.0,
          };

          const activeQuestion: QuestionDecision = {
            selectedQuestion: confirmQuestionCandidate,
            consideredCandidates: [confirmQuestionCandidate],
            decisionRationale: `Proposing confirmation to switch career goal from ${currentGoal} to ${proposedGoal}.`,
            selectionTimestamp: new Date().toISOString(),
          };

          const decision: RoadmapDecision = {
            eligibility: "material_uncertainty",
            selectedPathId: null,
            curriculumId: null,
            curriculumSource: null,
            declaredTargetRole: profile.declaredTargetRole,
            lockedPathReason: null,
            confidence: curConfidence,
            feasibility: null,
            missingMaterialDimensions: ["confirm_goal_change"],
            activeQuestion,
            recommendation: null,
            pendingGoalChange,
            explanation: `Please confirm if you want to change your goal from ${currentGoal} to ${proposedGoal}.`,
          };

          await this.profileRepo.saveProfile(profile);
          assertGlobalInvariants(profile, decision, null);

          return {
            profile,
            extractedFacts: [],
            confidence: curConfidence,
            activeQuestion,
            roadmap: null,
            roadmapEligibility: "material_uncertainty",
            feasibility: null,
            decision,
            pendingGoalChange,
            executionMetadata: (llm as any).getLastExecutionMetadata?.() || null,
          };
        }

        // C. Valid domain / language / constraint answer for expected dimension
        return this.answerQuestion(expectedDimension, request.message, profileId, llmConfig);
      }
    }

    // ==========================================
    // MODE B: OPEN INTAKE
    // ==========================================
    profile.goalText = profile.goalText ? `${profile.goalText}; ${request.message}` : request.message;

    // 1. LLM Fact Extraction
    const extraction = await llm.extract({
      message: request.message,
      existingFacts: profile.facts,
      currentHypotheses: profile.intent.hypotheses,
    });

    // If new goal in open intake differs from existing declaredTargetRole, invalidate derived state
    if (
      extraction.detectedGoal &&
      profile.declaredTargetRole &&
      extraction.detectedGoal.toLowerCase().trim() !== profile.declaredTargetRole.toLowerCase().trim()
    ) {
      await this.invalidateDerivedState(profile, extraction.detectedGoal);
    }

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
    this.syncProfilePreferencesAndConstraints(profile);

    // 4. Preserve declaredTargetRole (learner objective)
    profile.declaredTargetRole = this.extractAndPreserveDeclaredRole(
      profile,
      extraction.detectedGoal,
      profile.facts.filter((f) => f.status === "active")
    );

    // 5. Evaluate Compatibility Gate
    const compatEval = pathCompatibilityGate.evaluateIntentCompatibility(
      profile.facts.filter((f) => f.status === "active"),
      SEEDED_PATHS
    );

    // 6. Update Path Hypotheses strictly within eligible paths
    const hypResult = this.hypothesisEngine.updateHypotheses(profile.facts);
    profile.intent.hypotheses = hypResult.hypotheses;
    profile.intent.topPathId = hypResult.topPath ? hypResult.topPath.pathId : null;

    // 7. Deterministic Intent Confidence Evaluation
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

    // 8. Deterministic RoadmapDecision State Machine
    const { decision, lockedPath, curriculum, gapResults, targetEcosystem } = await this.evaluateRoadmapDecision(
      profile,
      compatEval,
      hypResult,
      confidence,
      llm
    );

    profile.selectedPathId = decision.selectedPathId;
    profile.curriculumId = decision.curriculumId;
    profile.curriculumSource = decision.curriculumSource;

    // 9. Single Authoritative Roadmap Construction
    let generatedRoadmap: Roadmap | null = null;
    if (decision.eligibility === "eligible" && curriculum) {
      generatedRoadmap = this.milestonePlanner.planMilestones(
        curriculum,
        gapResults,
        profile.preferences,
        profile.constraints,
        profile.id,
        targetEcosystem
      );
      generatedRoadmap.nextBestAction = this.nbaService.selectNextBestAction(generatedRoadmap);
      if (decision.feasibility?.status === "strained") {
        generatedRoadmap.warnings = [
          ...generatedRoadmap.warnings,
          `Workload is strained: ${decision.feasibility.explanation}`,
        ];
      }
      await this.roadmapRepo.saveRoadmap(generatedRoadmap);
      profile.activeRoadmapId = generatedRoadmap.id;
    } else {
      profile.activeRoadmapId = null;
      generatedRoadmap = null;
    }

    await this.profileRepo.saveProfile(profile);

    // 10. Assert Global Runtime Invariants
    assertGlobalInvariants(profile, decision, generatedRoadmap);

    await this.auditRepo.recordEvent({
      profileId: profile.id,
      eventType: "intake_processed",
      details: {
        message: request.message,
        extractedCount: newFacts.length,
        confidenceScore: confidence.finalScore,
        confidenceStatus: confidence.status,
        roadmapEligibility: decision.eligibility,
        selectedPathId: decision.selectedPathId,
      },
    });

    const execMeta = (llm as any).getLastExecutionMetadata?.() || null;

    return {
      profile,
      extractedFacts: newFacts,
      confidence,
      activeQuestion: decision.activeQuestion,
      roadmap: generatedRoadmap,
      roadmapEligibility: decision.eligibility,
      feasibility: decision.feasibility,
      decision,
      pendingGoalChange: null,
      executionMetadata: execMeta,
    };
  }

  /**
   * Deterministically evaluates whether clarification question generation should occur.
   * Enforces the fundamental invariant:
   * NO ANSWERABLE MISSING DIMENSION = NO QUESTION (activeQuestion: null).
   */
  private async resolveClarificationQuestion(
    profile: LearnerProfile,
    confidence: ConfidenceBreakdown,
    llm: any
  ): Promise<QuestionDecision | null> {
    if (confidence.status === "ready" && confidence.missingMaterialDimensions.length === 0) {
      return null;
    }

    if (profile.intent.questionCount >= profile.intent.maxQuestionBudget) {
      return null;
    }

    const activeFacts = profile.facts.filter((f) => f.status === "active");
    const compatEval = pathCompatibilityGate.evaluateIntentCompatibility(activeFacts, SEEDED_PATHS);
    // If explicit career intent is genuinely unsupported by policy, NEVER ask questions
    if (!compatEval.isIntentSupported) {
      return null;
    }

    const knownDimensions = new Set(
      activeFacts
        .filter((f) => !isNonCommittalAnswer(String(f.normalizedValue || f.rawValue || "")))
        .map((f) => f.dimension.toLowerCase())
    );
    const canonicalAllowed = new Set<string>(ALLOWED_QUESTION_DIMENSIONS as readonly string[]);

    // Determine genuinely missing answerable dimensions that are supported and unknown
    const answerableMissingDimensions = (confidence.missingDimensions || [])
      .map((d) => d.toLowerCase())
      .filter((d) => canonicalAllowed.has(d) && !knownDimensions.has(d));

    if (answerableMissingDimensions.length === 0) {
      return null;
    }

    let candidateList: any[] = [];
    try {
      const questionProposal = await llm.proposeQuestions({
        goalText: profile.goalText,
        existingFacts: profile.facts,
        currentHypotheses: profile.intent.hypotheses,
        unknownDimensions: answerableMissingDimensions,
      });
      if (questionProposal?.candidates && questionProposal.candidates.length > 0) {
        candidateList = questionProposal.candidates;
      }
    } catch (qErr) {
      console.warn("Question proposal failed, falling back to deterministic adapter:", qErr);
    }

    if (candidateList.length === 0) {
      const fallbackProp = await this.llmGateway
        .getAdapter({ provider: "deterministic" })
        .proposeQuestions({
          goalText: profile.goalText,
          existingFacts: profile.facts,
          currentHypotheses: profile.intent.hypotheses,
          unknownDimensions: answerableMissingDimensions,
        });
      candidateList = fallbackProp.candidates || [];
    }

    if (candidateList.length === 0) {
      return null;
    }

    return this.questionSelector.selectBestQuestion(
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

  /**
   * Submit an explicit answer to a clarification question.
   * Authoritative API: strictly modifies ONLY the requested dimension.
   */
  public async answerQuestion(
    dimension: string,
    answer: string | string[],
    profileId: string = "demo_learner_1",
    config?: LlmGatewayConfig
  ): Promise<IntakeResponse> {
    const profile = await this.profileRepo.getProfile(profileId);
    const llm = this.llmGateway.getAdapter(config);
    const rawAnswer = Array.isArray(answer) ? answer.join(", ") : String(answer);

    // ==========================================
    // 1. CONFIRM GOAL CHANGE DIMENSION
    // ==========================================
    if (dimension === "confirm_goal_change") {
      const valResult = semanticDimensionValidator.validateDimensionAnswer("confirm_goal_change", rawAnswer);

      if (valResult.normalizedValue === "confirmed") {
        let proposedGoal = "Mobile App Developer";
        const match = rawAnswer.match(/to\s+(.+)$/i);
        if (match && match[1]) {
          proposedGoal = match[1].trim();
        } else {
          const roleDetect = semanticDimensionValidator.detectCareerRole(rawAnswer);
          if (roleDetect.roleName) proposedGoal = roleDetect.roleName;
        }

        await this.invalidateDerivedState(profile, proposedGoal);
        this.syncProfilePreferencesAndConstraints(profile);

        const compatEval = pathCompatibilityGate.evaluateIntentCompatibility(
          profile.facts.filter((f) => f.status === "active"),
          SEEDED_PATHS
        );
        const hypResult = this.hypothesisEngine.updateHypotheses(profile.facts);
        profile.intent.hypotheses = hypResult.hypotheses;
        profile.intent.topPathId = hypResult.topPath ? hypResult.topPath.pathId : null;

        const confidence = this.confidenceService.evaluateConfidence({
          hypotheses: profile.intent.hypotheses,
          facts: profile.facts,
          contradictions: [],
          questionCount: profile.intent.questionCount,
          maxBudget: profile.intent.maxQuestionBudget,
        });
        profile.intent.confidence = confidence;
        profile.intent.status = confidence.status;
        profile.intent.unansweredDimensions = confidence.missingDimensions;

        const { decision, lockedPath, curriculum, gapResults, targetEcosystem } = await this.evaluateRoadmapDecision(
          profile,
          compatEval,
          hypResult,
          confidence,
          llm
        );

        profile.selectedPathId = decision.selectedPathId;
        profile.curriculumId = decision.curriculumId;
        profile.curriculumSource = decision.curriculumSource;

        let generatedRoadmap: Roadmap | null = null;
        if (decision.eligibility === "eligible" && curriculum) {
          generatedRoadmap = this.milestonePlanner.planMilestones(
            curriculum,
            gapResults,
            profile.preferences,
            profile.constraints,
            profile.id,
            targetEcosystem
          );
          generatedRoadmap.nextBestAction = this.nbaService.selectNextBestAction(generatedRoadmap);
          await this.roadmapRepo.saveRoadmap(generatedRoadmap);
          profile.activeRoadmapId = generatedRoadmap.id;
        } else {
          profile.activeRoadmapId = null;
        }

        await this.profileRepo.saveProfile(profile);
        assertGlobalInvariants(profile, decision, generatedRoadmap);

        return {
          profile,
          extractedFacts: profile.facts.filter((f) => f.dimension === "declared_goal" && f.status === "active"),
          confidence,
          activeQuestion: decision.activeQuestion,
          roadmap: generatedRoadmap,
          roadmapEligibility: decision.eligibility,
          feasibility: decision.feasibility,
          decision,
          pendingGoalChange: null,
          executionMetadata: (llm as any).getLastExecutionMetadata?.() || null,
        };
      } else {
        // User rejected goal change! Preserve declaredTargetRole and resume clarification
        this.syncProfilePreferencesAndConstraints(profile);

        const compatEval = pathCompatibilityGate.evaluateIntentCompatibility(
          profile.facts.filter((f) => f.status === "active"),
          SEEDED_PATHS
        );
        const hypResult = this.hypothesisEngine.updateHypotheses(profile.facts);
        profile.intent.hypotheses = hypResult.hypotheses;
        profile.intent.topPathId = hypResult.topPath ? hypResult.topPath.pathId : null;

        const confidence = this.confidenceService.evaluateConfidence({
          hypotheses: profile.intent.hypotheses,
          facts: profile.facts,
          contradictions: [],
          questionCount: profile.intent.questionCount,
          maxBudget: profile.intent.maxQuestionBudget,
        });
        profile.intent.confidence = confidence;
        profile.intent.status = confidence.status;
        profile.intent.unansweredDimensions = confidence.missingDimensions;

        const { decision, lockedPath, curriculum, gapResults, targetEcosystem } = await this.evaluateRoadmapDecision(
          profile,
          compatEval,
          hypResult,
          confidence,
          llm
        );

        profile.selectedPathId = decision.selectedPathId;
        profile.curriculumId = decision.curriculumId;
        profile.curriculumSource = decision.curriculumSource;

        let generatedRoadmap: Roadmap | null = null;
        if (decision.eligibility === "eligible" && curriculum) {
          generatedRoadmap = this.milestonePlanner.planMilestones(
            curriculum,
            gapResults,
            profile.preferences,
            profile.constraints,
            profile.id,
            targetEcosystem
          );
          generatedRoadmap.nextBestAction = this.nbaService.selectNextBestAction(generatedRoadmap);
          await this.roadmapRepo.saveRoadmap(generatedRoadmap);
          profile.activeRoadmapId = generatedRoadmap.id;
        } else {
          profile.activeRoadmapId = null;
        }

        await this.profileRepo.saveProfile(profile);
        assertGlobalInvariants(profile, decision, generatedRoadmap);

        return {
          profile,
          extractedFacts: [],
          confidence,
          activeQuestion: decision.activeQuestion,
          roadmap: generatedRoadmap,
          roadmapEligibility: decision.eligibility,
          feasibility: decision.feasibility,
          decision,
          pendingGoalChange: null,
          executionMetadata: (llm as any).getLastExecutionMetadata?.() || null,
        };
      }
    }

    // ==========================================
    // 2. REGULAR DIMENSION: SEMANTIC VALIDATION
    // ==========================================
    const validation = semanticDimensionValidator.validateDimensionAnswer(
      dimension,
      rawAnswer,
      profile.declaredTargetRole
    );

    if (validation.status === "explicit_goal_change") {
      const newGoal = validation.proposedGoal || rawAnswer.trim();
      await this.invalidateDerivedState(profile, newGoal);
      this.syncProfilePreferencesAndConstraints(profile);

      const compatEval = pathCompatibilityGate.evaluateIntentCompatibility(
        profile.facts.filter((f) => f.status === "active"),
        SEEDED_PATHS
      );
      const hypResult = this.hypothesisEngine.updateHypotheses(profile.facts);
      profile.intent.hypotheses = hypResult.hypotheses;
      profile.intent.topPathId = hypResult.topPath ? hypResult.topPath.pathId : null;

      const confidence = this.confidenceService.evaluateConfidence({
        hypotheses: profile.intent.hypotheses,
        facts: profile.facts,
        contradictions: [],
        questionCount: profile.intent.questionCount,
        maxBudget: profile.intent.maxQuestionBudget,
      });
      profile.intent.confidence = confidence;
      profile.intent.status = confidence.status;
      profile.intent.unansweredDimensions = confidence.missingDimensions;

      const { decision, lockedPath, curriculum, gapResults, targetEcosystem } = await this.evaluateRoadmapDecision(
        profile,
        compatEval,
        hypResult,
        confidence,
        llm
      );

      profile.selectedPathId = decision.selectedPathId;
      profile.curriculumId = decision.curriculumId;
      profile.curriculumSource = decision.curriculumSource;

      let generatedRoadmap: Roadmap | null = null;
      if (decision.eligibility === "eligible" && curriculum) {
        generatedRoadmap = this.milestonePlanner.planMilestones(
          curriculum,
          gapResults,
          profile.preferences,
          profile.constraints,
          profile.id,
          targetEcosystem
        );
        generatedRoadmap.nextBestAction = this.nbaService.selectNextBestAction(generatedRoadmap);
        await this.roadmapRepo.saveRoadmap(generatedRoadmap);
        profile.activeRoadmapId = generatedRoadmap.id;
      } else {
        profile.activeRoadmapId = null;
      }

      await this.profileRepo.saveProfile(profile);
      assertGlobalInvariants(profile, decision, generatedRoadmap);

      return {
        profile,
        extractedFacts: profile.facts.filter((f) => f.dimension === "declared_goal" && f.status === "active"),
        confidence,
        activeQuestion: decision.activeQuestion,
        roadmap: generatedRoadmap,
        roadmapEligibility: decision.eligibility,
        feasibility: decision.feasibility,
        decision,
        pendingGoalChange: null,
        executionMetadata: (llm as any).getLastExecutionMetadata?.() || null,
      };
    }

    if (validation.status === "role_mismatch") {
      const currentGoal = profile.declaredTargetRole || "Software Engineer";
      const proposedGoal = validation.proposedGoal || rawAnswer.trim();
      const pendingGoalChange = {
        proposedGoal,
        currentGoal,
        previousDimension: dimension,
      };

      const hypResult = this.hypothesisEngine.updateHypotheses(profile.facts);
      const confidence = this.confidenceService.evaluateConfidence({
        hypotheses: hypResult.hypotheses,
        facts: profile.facts,
        contradictions: [],
        questionCount: profile.intent.questionCount,
        maxBudget: profile.intent.maxQuestionBudget,
      });

      const confirmQuestionCandidate = {
        id: `q_confirm_goal_${Date.now()}`,
        dimension: "confirm_goal_change",
        question: `${proposedGoal} looks like a change to your target career rather than a ${dimension.replace(/_/g, " ")} choice. Do you want to change your career goal from ${currentGoal} to ${proposedGoal}?`,
        answerType: "single_choice" as const,
        options: [
          `Yes, change my goal to ${proposedGoal}`,
          `No, keep ${currentGoal}`,
        ],
        why: "Changing your career goal resets downstream curriculum recommendations so they align with your new role.",
        predictedAnswerBuckets: ["confirmed", "rejected"],
        informationGain: 1.0,
        utilityScore: 1.0,
      };

      const activeQuestion: QuestionDecision = {
        selectedQuestion: confirmQuestionCandidate,
        consideredCandidates: [confirmQuestionCandidate],
        decisionRationale: `Proposing confirmation to switch career goal from ${currentGoal} to ${proposedGoal}.`,
        selectionTimestamp: new Date().toISOString(),
      };

      const decision: RoadmapDecision = {
        eligibility: "material_uncertainty",
        selectedPathId: null,
        curriculumId: null,
        curriculumSource: null,
        declaredTargetRole: profile.declaredTargetRole,
        lockedPathReason: null,
        confidence,
        feasibility: null,
        missingMaterialDimensions: ["confirm_goal_change"],
        activeQuestion,
        recommendation: null,
        pendingGoalChange,
        explanation: `Please confirm if you want to change your goal from ${currentGoal} to ${proposedGoal}.`,
      };

      await this.profileRepo.saveProfile(profile);
      assertGlobalInvariants(profile, decision, null);

      return {
        profile,
        extractedFacts: [],
        confidence,
        activeQuestion,
        roadmap: null,
        roadmapEligibility: "material_uncertainty",
        feasibility: null,
        decision,
        pendingGoalChange,
        executionMetadata: (llm as any).getLastExecutionMetadata?.() || null,
      };
    }

    // ==========================================
    // 3. AUTHORITATIVE FACT MUTATION FOR DIMENSION
    // ==========================================
    profile.intent.questionCount++;

    const now = new Date().toISOString();
    const normalizedAnswer = this.normalizeAnswer(dimension, answer);
    const answerFact: ProfileFact = {
      id: `fact_ans_${Date.now()}`,
      dimension,
      normalizedValue: normalizedAnswer,
      rawValue: rawAnswer,
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
    this.syncProfilePreferencesAndConstraints(profile);

    // Update constraints if hours_per_week answered
    if (dimension === "hours_per_week") {
      const match = String(answer).match(/\d+/);
      if (match) profile.constraints.hoursPerWeek = parseInt(match[0], 10);
    }
    if (dimension === "deadline_months") {
      const match = String(answer).match(/\d+/);
      if (match) profile.constraints.deadlineMonths = parseInt(match[0], 10);
    }

    // Preserve declaredTargetRole (authoritative invariant: answerQuestion never mutates declaredTargetRole)
    profile.declaredTargetRole = this.extractAndPreserveDeclaredRole(
      profile,
      undefined,
      profile.facts.filter((f) => f.status === "active")
    );

    // Evaluate compatibility gate
    const compatEval = pathCompatibilityGate.evaluateIntentCompatibility(
      profile.facts.filter((f) => f.status === "active"),
      SEEDED_PATHS
    );

    // Update hypotheses
    const hypResult = this.hypothesisEngine.updateHypotheses(profile.facts);
    profile.intent.hypotheses = hypResult.hypotheses;
    profile.intent.topPathId = hypResult.topPath ? hypResult.topPath.pathId : null;

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

    // Evaluate state machine decision
    const { decision, lockedPath, curriculum, gapResults, targetEcosystem } = await this.evaluateRoadmapDecision(
      profile,
      compatEval,
      hypResult,
      confidence,
      llm
    );

    profile.selectedPathId = decision.selectedPathId;
    profile.curriculumId = decision.curriculumId;
    profile.curriculumSource = decision.curriculumSource;

    let generatedRoadmap: Roadmap | null = null;
    if (decision.eligibility === "eligible" && curriculum) {
      generatedRoadmap = this.milestonePlanner.planMilestones(
        curriculum,
        gapResults,
        profile.preferences,
        profile.constraints,
        profile.id,
        targetEcosystem
      );
      generatedRoadmap.nextBestAction = this.nbaService.selectNextBestAction(generatedRoadmap);
      if (decision.feasibility?.status === "strained") {
        generatedRoadmap.warnings = [
          ...generatedRoadmap.warnings,
          `Workload is strained: ${decision.feasibility.explanation}`,
        ];
      }
      await this.roadmapRepo.saveRoadmap(generatedRoadmap);
      profile.activeRoadmapId = generatedRoadmap.id;
    } else {
      profile.activeRoadmapId = null;
      generatedRoadmap = null;
    }

    await this.profileRepo.saveProfile(profile);

    // Assert Global Invariants
    assertGlobalInvariants(profile, decision, generatedRoadmap);

    await this.auditRepo.recordEvent({
      profileId: profile.id,
      eventType: "question_answered",
      details: {
        dimension,
        answer,
        newConfidenceScore: confidence.finalScore,
        newStatus: confidence.status,
        roadmapEligibility: decision.eligibility,
      },
    });

    const execMeta = (llm as any).getLastExecutionMetadata?.() || null;

    return {
      profile,
      extractedFacts: [answerFact],
      confidence,
      activeQuestion: decision.activeQuestion,
      roadmap: generatedRoadmap,
      roadmapEligibility: decision.eligibility,
      feasibility: decision.feasibility,
      decision,
      pendingGoalChange: null,
      executionMetadata: execMeta,
    };
  }

  /**
   * Converts a learner's natural-language or LLM-generated choice into the
   * stable vocabulary used by the deterministic hypothesis policy.
   */
  private normalizeAnswer(dimension: string, answer: string | string[]): string | string[] | number {
    if (Array.isArray(answer)) return answer.map((value) => this.normalizeAnswer(dimension, value) as string);

    const raw = answer.trim();
    if (isNonCommittalAnswer(raw)) {
      return "delegated_to_system";
    }

    const value = raw.toLowerCase();
    if (dimension === "hours_per_week") {
      const hours = value.match(/\d+/);
      return hours ? Number(hours[0]) : raw;
    }
    if (dimension === "primary_language") {
      if (value.includes("typescript") || value.includes("javascript") || value.includes("node")) return "typescript_node";
      if (value.includes("python")) return "python";
      if (value.includes("c#") || value.includes(".net")) return "dotnet";
      if (value.includes("c++") || value.includes("cpp")) return "cpp";
      if (value.includes("go")) return "go";
      if (value.includes("java") && !value.includes("javascript")) return "java";
      if (value.includes("kotlin")) return "Kotlin";
      if (value.includes("swift")) return "Swift";
      if (value.includes("rust")) return "Rust";
      if (value.includes("systemverilog") || value.includes("verilog")) return "SystemVerilog";
      if (value.includes("vhdl")) return "VHDL";
    }
    if (dimension === "target_domain" || dimension === "specialization_focus") {
      if (value.includes("erp") || value.includes("enterprise") || value.includes("bank") || value.includes("fintech") || value === "enterprise_erp" || value === "fintech_banking") return "enterprise_erp";
      if (value.includes("saas") || value.includes("web") || value.includes("consumer") || value.includes("product") || value === "saas_web_products" || value === "fullstack_web") return "saas_web";
      if (value.includes("cloud") || value.includes("data") || value.includes("ai") || value.includes("async") || value === "cloud_data_services") return "cloud_data";
      if (value.includes("vlsi") || value.includes("semiconductor") || value.includes("chip") || value.includes("asic") || value.includes("fpga") || value.includes("rtl") || value.includes("microarchitecture") || value.includes("uvm")) return "vlsi_hardware";
      if (value.includes("security") || value.includes("cyber") || value.includes("threat") || value.includes("hardening")) return "security";
      if (value.includes("infra") || value.includes("devops") || value.includes("tool") || value.includes("ci_cd") || value.includes("pipeline")) return "infrastructure";
      if (value.includes("gaming") || value.includes("game")) return "Gaming";
      if (value.includes("low-level") || value.includes("performance") || (value.includes("systems") && !value.includes("flight") && !value.includes("aerospace"))) return "systems_engineering";
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
    this.syncProfilePreferencesAndConstraints(profile);

    profile.declaredTargetRole = this.extractAndPreserveDeclaredRole(
      profile,
      undefined,
      profile.facts.filter((f) => f.status === "active")
    );

    const compatEval = pathCompatibilityGate.evaluateIntentCompatibility(
      profile.facts.filter((f) => f.status === "active"),
      SEEDED_PATHS
    );

    // Recalculate hypotheses & confidence
    const hypResult = this.hypothesisEngine.updateHypotheses(profile.facts);
    profile.intent.hypotheses = hypResult.hypotheses;
    profile.intent.topPathId = hypResult.topPath ? hypResult.topPath.pathId : null;

    const confidence = this.confidenceService.evaluateConfidence({
      hypotheses: profile.intent.hypotheses,
      facts: profile.facts,
      contradictions: [],
      questionCount: profile.intent.questionCount,
    });
    profile.intent.confidence = confidence;
    profile.intent.status = confidence.status;

    // Evaluate state machine decision
    const { decision } = await this.evaluateRoadmapDecision(
      profile,
      compatEval,
      hypResult,
      confidence,
      this.llmGateway.getAdapter({ provider: "deterministic" })
    );

    profile.selectedPathId = decision.selectedPathId;
    profile.curriculumId = decision.curriculumId;
    profile.curriculumSource = decision.curriculumSource;

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

    if (decision.eligibility !== "eligible") {
      profile.activeRoadmapId = null;
    }

    await this.profileRepo.saveProfile(profile);

    await this.auditRepo.recordEvent({
      profileId: profile.id,
      eventType: "fact_corrected",
      details: { factId, correction, newConfidence: confidence.finalScore, roadmapEligibility: decision.eligibility },
    });

    return { profile, roadmapStale };
  }

  /**
   * Generates a deterministic roadmap.
   * Single authoritative entry point: fails immediately if RoadmapDecision eligibility is NOT 'eligible'.
   */
  public async generateRoadmap(profileId: string = "demo_learner_1"): Promise<Roadmap> {
    const profile = await this.profileRepo.getProfile(profileId);
    this.syncProfilePreferencesAndConstraints(profile);

    const activeFacts = profile.facts.filter((f) => f.status === "active");
    const compatEval = pathCompatibilityGate.evaluateIntentCompatibility(activeFacts, SEEDED_PATHS);
    const hypResult = this.hypothesisEngine.updateHypotheses(profile.facts);
    const confidence = this.confidenceService.evaluateConfidence({
      hypotheses: hypResult.hypotheses,
      facts: profile.facts,
      contradictions: [],
      questionCount: profile.intent.questionCount,
    });

    const { decision, lockedPath, curriculum, gapResults, targetEcosystem } = await this.evaluateRoadmapDecision(
      profile,
      compatEval,
      hypResult,
      confidence,
      this.llmGateway.getAdapter({ provider: "deterministic" })
    );

    if (decision.eligibility !== "eligible" || !curriculum) {
      throw new Error(
        `Cannot generate roadmap: Explicit career goal is not supported by the catalog (${decision.explanation}).`
      );
    }

    const roadmap = this.milestonePlanner.planMilestones(
      curriculum,
      gapResults,
      profile.preferences,
      profile.constraints,
      profile.id,
      targetEcosystem
    );

    roadmap.nextBestAction = this.nbaService.selectNextBestAction(roadmap);
    if (decision.feasibility?.status === "strained") {
      roadmap.warnings = [
        ...roadmap.warnings,
        `Workload is strained: ${decision.feasibility.explanation}`,
      ];
    }

    await this.roadmapRepo.saveRoadmap(roadmap);
    profile.activeRoadmapId = roadmap.id;
    profile.selectedPathId = decision.selectedPathId;
    profile.curriculumId = decision.curriculumId;
    profile.curriculumSource = decision.curriculumSource;
    await this.profileRepo.saveProfile(profile);

    assertGlobalInvariants(profile, decision, roadmap);

    await this.auditRepo.recordEvent({
      profileId: profile.id,
      eventType: "roadmap_generated",
      details: {
        roadmapId: roadmap.id,
        targetPathId: decision.selectedPathId,
        targetPathTitle: roadmap.targetPathTitle,
        curriculumId: decision.curriculumId,
        curriculumSource: decision.curriculumSource,
        milestonesCount: roadmap.milestones.length,
        totalEstimatedWeeks: roadmap.totalEstimatedWeeks,
      },
    });

    return roadmap;
  }

  /**
   * Generates a "What-If" scenario simulation without modifying active learner profile state.
   */
  public async createScenario(
    baseRoadmapId: string,
    name: string,
    overrides: Scenario["overrides"],
    profileId: string = "demo_learner_1"
  ): Promise<Scenario> {
    const baseRoadmap = await this.roadmapRepo.getRoadmap(baseRoadmapId);
    const profile = await this.profileRepo.getProfile(profileId);
    this.syncProfilePreferencesAndConstraints(profile);

    const activeFacts = profile.facts.filter((f) => f.status === "active");
    const compatEval = pathCompatibilityGate.evaluateIntentCompatibility(activeFacts, SEEDED_PATHS);

    const techContext = resolveLearnerTechnologyContext(profile.preferences, activeFacts);

    const effectivePathId =
      overrides.targetRole ||
      overrides.targetDomain ||
      baseRoadmap?.targetPathId ||
      profile.selectedPathId ||
      profile.intent.topPathId;

    if (!effectivePathId) {
      throw new Error(
        `Cannot simulate scenario: Career intent is unsupported by the catalog (${compatEval.unsupportedReason || "no eligible paths"}).`
      );
    }

    const pathDef = compatEval.eligiblePaths.find((p: PathDefinition) => p.id === effectivePathId);

    if (!pathDef) {
      throw new Error(`Cannot simulate scenario: Path definition '${effectivePathId}' not found or incompatible.`);
    }

    const targetEcosystem =
      pathDef.technologyEcosystem && pathDef.technologyEcosystem !== "agnostic"
        ? pathDef.technologyEcosystem
        : techContext.backendEcosystem;

    const effectiveConstraints = {
      ...profile.constraints,
      hoursPerWeek: overrides.hoursPerWeek || profile.constraints.hoursPerWeek,
      deadlineMonths: overrides.deadlineMonths || profile.constraints.deadlineMonths,
    };

    const specializedWeights = this.skillGapService.specializeTargetSkillWeights(
      pathDef.id,
      pathDef.targetSkillWeights,
      targetEcosystem
    );

    const gapResults = this.skillGapService.analyzeGaps(
      specializedWeights,
      profile.competencies,
      effectiveConstraints.deadlineMonths,
      targetEcosystem
    );

    const computedRoadmap = this.milestonePlanner.planMilestones(
      pathDef,
      gapResults,
      profile.preferences,
      effectiveConstraints,
      profile.id,
      targetEcosystem
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

    // Regenerate active roadmap if eligible
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

  public async switchActiveRoadmap(
    roadmapId: string,
    profileId: string = "demo_learner_1"
  ): Promise<{ profile: LearnerProfile; roadmap: Roadmap }> {
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
