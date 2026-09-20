import { randomUUID } from "crypto";
import {
  CandidateDirection,
  DecisionMode,
  ExperimentPlan,
  PhaseDisposition,
  PlanningDecision,
  QuestionCandidate,
  QuestionDecision,
  RoadmapPhase,
  UserWorkModel,
} from "../../contracts";
import { CandidateGenerator, candidateGenerator } from "../candidates/candidate-generator";
import { DomainKnowledge, domainKnowledge } from "../knowledge/domain-knowledge";

export interface DecisionEngineInput {
  decisionId?: string;
  profileId: string;
  workModel: UserWorkModel;
  declaredGoal?: string | null;
  activePhase?: RoadmapPhase | null;
  completedPhases?: RoadmapPhase[];
  phaseHistory?: RoadmapPhase[];
  recentObservations?: string[];
  proposedQuestions?: QuestionCandidate[];
  isPhaseCompletion?: boolean;
}

export interface ActivePhaseAlignmentResult {
  aligned: boolean;
  reason?: string;
  contradictedTargetIds?: string[];
  contradictedDimensions?: string[];
}

export class DecisionEngine {
  private candidateGen: CandidateGenerator;
  private knowledge: DomainKnowledge;

  constructor(
    candidateGen: CandidateGenerator = candidateGenerator,
    knowledge: DomainKnowledge = domainKnowledge
  ) {
    this.candidateGen = candidateGen;
    this.knowledge = knowledge;
  }

  /**
   * Evaluates structured alignment between the active phase's targets and the current UserWorkModel.
   * Enforces the rule:
   * - A single weak preference, difficulty statement, unrelated interest, or side interest MUST NOT supersede.
   * - Explicit directional rejection OR corroborated accumulated incompatibility DOES supersede.
   */
  public evaluateActivePhaseAlignment(
    activePhase: RoadmapPhase,
    workModel: UserWorkModel,
    declaredGoal?: string | null
  ): ActivePhaseAlignmentResult {
    const contradictedTargetIds: string[] = [];
    const contradictedDimensions: string[] = [];

    // 1. Explicit Direction Continuity Pivot (e.g. from reflection)
    const directionSignals = workModel.negativeSignals["direction:continuity"] || [];
    if (
      directionSignals.includes("pivot") ||
      directionSignals.includes("explore_alternatives")
    ) {
      return {
        aligned: false,
        reason: "User explicitly signaled a directional pivot away from current track.",
        contradictedTargetIds: [activePhase.id],
        contradictedDimensions: ["direction:continuity"],
      };
    }

    // 2. Explicit Directional Rejection Signals in Negative Signals
    const phaseTokens = [
      activePhase.objective.toLowerCase(),
      ...activePhase.capabilityTargets.map((c) => c.toLowerCase()),
      ...activePhase.activityTargets.map((a) => a.toLowerCase()),
      ...activePhase.activities.map((a) => a.title.toLowerCase()),
    ];

    for (const [dim, signals] of Object.entries(workModel.negativeSignals)) {
      for (const sig of signals) {
        const sigLower = sig.toLowerCase();
        const isExplicitRejection =
          sigLower.includes("don't want") ||
          sigLower.includes("dont want") ||
          sigLower.includes("do not want") ||
          sigLower.includes("not interested") ||
          sigLower.includes("hate") ||
          sigLower.includes("avoid") ||
          sigLower.includes("stop") ||
          sigLower.includes("no longer");

        if (isExplicitRejection) {
          const matchesPhase = phaseTokens.some((token) => {
            const words = token.split(/[\s,:/_-]+/).filter((w) => w.length > 3);
            return words.some((w) => sigLower.includes(w));
          });

          if (matchesPhase) {
            contradictedDimensions.push(dim);
            return {
              aligned: false,
              reason: `Explicit directional rejection detected against active phase focus: "${sig}".`,
              contradictedTargetIds: [activePhase.id],
              contradictedDimensions,
            };
          }
        }
      }
    }

    // 3. Accumulated Activity Incompatibility (Disliked / Avoided Activities)
    let dislikedTargetCount = 0;
    const matchedDislikedTargets: string[] = [];

    for (const act of activePhase.activities) {
      const actKey = act.title.toLowerCase().trim();
      const userAct = workModel.activities[actKey];
      if (userAct && (userAct.affinity === "disliked" || userAct.affinity === "avoided")) {
        dislikedTargetCount++;
        matchedDislikedTargets.push(act.title);
      }
    }

    for (const actTarget of activePhase.activityTargets) {
      const actKey = actTarget.toLowerCase().trim();
      const userAct = workModel.activities[actKey];
      if (userAct && (userAct.affinity === "disliked" || userAct.affinity === "avoided")) {
        dislikedTargetCount++;
        matchedDislikedTargets.push(actTarget);
      }
    }

    // Check capability targets with negative signals or contradiction
    for (const cap of activePhase.capabilityTargets) {
      const capKey = cap.toLowerCase().trim();
      const userCap = workModel.capabilities[capKey];
      if (userCap && userCap.contradictingEvidenceIds.length > 1) {
        dislikedTargetCount++;
        matchedDislikedTargets.push(cap);
      }
    }

    // A single difficulty or single disliked item alone does NOT supersede.
    // Multiple corroborated rejections/avoidances (>= 2) constitute accumulated material conflict.
    if (dislikedTargetCount >= 2) {
      return {
        aligned: false,
        reason: `Corroborated material incompatibility: multiple core phase targets are marked as disliked or avoided (${matchedDislikedTargets.join(", ")}).`,
        contradictedTargetIds: [activePhase.id, ...matchedDislikedTargets],
        contradictedDimensions: ["activity:disliked", "activity:avoided"],
      };
    }

    // If activePhase.id is specifically listed in any evidence item's contradictedTargetIds
    const allEvidenceIds = workModel.evidenceIds;
    // (Checked at evidence engine level if applicable)

    // Otherwise, phase remains aligned.
    // Additional interests (e.g., user is also interested in AI while doing backend)
    // or isolated difficulty statements ("Backend is difficult") do NOT trigger supersession.
    return {
      aligned: true,
    };
  }

  /**
   * Evaluates current UserWorkModel state and active phase alignment to determine:
   * 1. phaseDisposition: "continue" | "complete" | "supersede"
   * 2. mode: "commit" | "disambiguate" | "explore"
   */
  public evaluateNextAction(input: DecisionEngineInput): PlanningDecision {
    const {
      profileId,
      workModel,
      declaredGoal,
      activePhase,
      completedPhases = [],
      phaseHistory,
      proposedQuestions = [],
      isPhaseCompletion = false,
    } = input;
    const now = new Date().toISOString();
    const decisionId = input.decisionId || `dec_${randomUUID()}`;

    const capabilities = Object.values(workModel.capabilities);
    const uncertainties = workModel.uncertainties;
    const preferences = workModel.preferences;

    // Check if user has declared a goal or if preferences point to a direction
    const goalText = declaredGoal || (preferences.domains.length > 0 ? preferences.domains[0] : null);

    // 1. Evaluate Active Phase Alignment and Disposition
    let phaseDisposition: PhaseDisposition = "continue";
    let alignmentReason: string | undefined;

    if (activePhase) {
      const alignment = this.evaluateActivePhaseAlignment(activePhase, workModel, goalText);
      if (!alignment.aligned) {
        phaseDisposition = "supersede";
        alignmentReason = alignment.reason;
      } else if (isPhaseCompletion) {
        phaseDisposition = "complete";
      } else {
        phaseDisposition = "continue";
      }
    } else {
      phaseDisposition = isPhaseCompletion ? "complete" : "continue";
    }

    // 2. DISAMBIGUATE CHECK:
    const missingCoreGoal = !goalText || goalText.trim().length === 0;
    const hasMaterialUncertainty =
      missingCoreGoal ||
      (capabilities.length === 0 && (!preferences.languages || preferences.languages.length === 0));

    // Conditionally generate candidates only when helpful
    let candidates: CandidateDirection[] = [];
    if (goalText) {
      candidates = this.candidateGen.generateCandidates(workModel, goalText);
    }

    const competingDirections = candidates.filter((c) => c.status === "active" || c.status === "supported");
    const isAmbiguousDirection = competingDirections.length > 1;

    const questionUncertainty = uncertainties.find((u) => u.resolutionStrategy === "question");
    const experimentUncertainty = uncertainties.find((u) => u.resolutionStrategy === "experiment");

    // Case A: EXPLORE
    const needsExploration =
      !!experimentUncertainty ||
      (goalText && (goalText.toLowerCase().includes("not sure") || goalText.toLowerCase().includes("open to suggestions"))) ||
      (competingDirections.length > 1 && uncertainties.some((u) => u.impact === "high"));

    if (needsExploration) {
      const targetCandidate = candidates[0];
      const expName = targetCandidate ? targetCandidate.name : "Engineering Foundations";
      const experiment: ExperimentPlan = {
        id: `exp_${Date.now()}`,
        objective: `Hands-on exploratory probe to measure practical engagement and aptitude for ${expName}`,
        hypothesis: `User will demonstrate positive engagement and problem-solving persistence in ${expName} fundamentals`,
        activity: targetCandidate?.suggestedNextExperiment?.activity || `Complete a 90-minute hands-on diagnostic exercise exploring ${expName}`,
        observableMetrics: ["completion_pace", "voluntary_exploration", "reported_energy", "conceptual_grasp"],
        expectedEvidence: `Observable evidence regarding engagement and interest in ${expName}`,
        estimatedHours: 2,
        status: "pending",
      };

      return {
        id: decisionId,
        profileId,
        mode: "explore" as DecisionMode,
        phaseDisposition,
        primaryObjective: `Gather empirical evidence through practical exploration in ${expName}`,
        targetCandidateDirection: targetCandidate?.name || null,
        previousActivePhaseId: activePhase ? activePhase.id : null,
        activePhaseId: activePhase ? activePhase.id : null,
        createdPhaseId: null,
        activePhase: activePhase || null,
        activeQuestion: null,
        activeExperiment: experiment,
        rationale: alignmentReason
          ? `${alignmentReason} Initiating practical exploratory probe to resolve subsequent direction.`
          : `Direct questioning is insufficient to resolve uncertainty. Initiating practical exploratory probe.`,
        evidenceConsidered: workModel.evidenceIds,
        timestamp: now,
      };
    }

    // Case B: DISAMBIGUATE
    if (
      questionUncertainty ||
      ((missingCoreGoal || isAmbiguousDirection || hasMaterialUncertainty) && proposedQuestions.length > 0)
    ) {
      const candidatesToConsider =
        proposedQuestions.length > 0
          ? proposedQuestions
          : [
              {
                id: `q_disambiguate_${Date.now()}`,
                dimension:
                  questionUncertainty?.dimension ||
                  (missingCoreGoal ? "target_role" : "specialization_focus"),
                question: questionUncertainty
                  ? `Could you clarify your preference regarding ${questionUncertainty.dimension}?`
                  : missingCoreGoal
                  ? "What career direction or role would you like to target for your next phase?"
                  : "Which specialization focus or technical area would you like to target next?",
                answerType: "free_text" as const,
                why:
                  questionUncertainty?.description ||
                  "Directional clarification required to scope next phase.",
                utilityScore: 0.95,
                informationGain: 0.95,
              },
            ];

      const selectedQuestion = this.selectHighestValueQuestion(candidatesToConsider, workModel);
      if (selectedQuestion) {
        return {
          id: decisionId,
          profileId,
          mode: "disambiguate" as DecisionMode,
          phaseDisposition,
          primaryObjective: `Resolve uncertainty regarding ${selectedQuestion.dimension}`,
          targetCandidateDirection: candidates[0]?.name || null,
          previousActivePhaseId: activePhase ? activePhase.id : null,
          activePhaseId: activePhase ? activePhase.id : null,
          createdPhaseId: null,
          activePhase: activePhase || null,
          activeQuestion: {
            selectedQuestion,
            consideredCandidates: candidatesToConsider,
            decisionRationale: `Question selected to resolve high-impact ambiguity in ${selectedQuestion.dimension}`,
            selectionTimestamp: now,
          },
          activeExperiment: null,
          rationale: alignmentReason
            ? `${alignmentReason} Disambiguation question required before committing to replacement phase.`
            : `Disambiguation required: ${selectedQuestion.why || "Information needed to clarify direction."}`,
          evidenceConsidered: workModel.evidenceIds,
          timestamp: now,
        };
      }
    }

    // Case C: COMMIT
    // Sufficient directional clarity to commit
    const chosenDirection = candidates[0]?.name || goalText || "Technical Fundamentals";

    return {
      id: decisionId,
      profileId,
      mode: "commit" as DecisionMode,
      phaseDisposition,
      primaryObjective:
        phaseDisposition === "supersede"
          ? `Supersede misaligned active phase and commit to replacement phase for ${chosenDirection}`
          : `Generate and execute next phase for ${chosenDirection}`,
      targetCandidateDirection: chosenDirection,
      previousActivePhaseId: activePhase ? activePhase.id : null,
      activePhaseId: activePhase ? activePhase.id : null,
      createdPhaseId: null, // Populated upon phase creation
      activePhase: activePhase || null,
      activeQuestion: null,
      activeExperiment: null,
      rationale: alignmentReason
        ? `${alignmentReason} Committing to new adaptive phase aligned with current user direction.`
        : `Sufficient evidence and directional clarity established to commit to next development phase.`,
      evidenceConsidered: workModel.evidenceIds,
      timestamp: now,
    };
  }

  private selectHighestValueQuestion(
    candidates: QuestionCandidate[],
    workModel: UserWorkModel
  ): QuestionCandidate | null {
    if (!candidates || candidates.length === 0) return null;

    const knownDims = new Set([
      ...Object.keys(workModel.capabilities),
      ...Object.keys(workModel.workCharacteristics),
      ...workModel.preferences.domains,
      ...workModel.preferences.languages,
    ].map((s) => s.toLowerCase()));

    const eligible = candidates.filter((c) => !knownDims.has(c.dimension.toLowerCase()));
    if (eligible.length === 0) return candidates[0];

    eligible.sort((a, b) => (b.utilityScore ?? b.informationGain ?? 0) - (a.utilityScore ?? a.informationGain ?? 0));
    return eligible[0];
  }
}

export const decisionEngine = new DecisionEngine();
