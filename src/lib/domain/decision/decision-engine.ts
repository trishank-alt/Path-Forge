import {
  CandidateDirection,
  DecisionMode,
  ExperimentPlan,
  PlanningDecision,
  QuestionCandidate,
  QuestionDecision,
  RoadmapPhase,
  UserWorkModel,
} from "../../contracts";
import { CandidateGenerator, candidateGenerator } from "../candidates/candidate-generator";
import { DomainKnowledge, domainKnowledge } from "../knowledge/domain-knowledge";

export interface DecisionEngineInput {
  profileId: string;
  workModel: UserWorkModel;
  declaredGoal?: string | null;
  completedPhases?: RoadmapPhase[];
  recentObservations?: string[];
  proposedQuestions?: QuestionCandidate[];
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
   * Evaluates current UserWorkModel state and determines the next best planning action:
   * - Commit (generate next phase)
   * - Disambiguate (ask targeted question)
   * - Explore (run practical experiment)
   *
   * Candidate generation is conditional (consulted when comparing directions or clarifying targets).
   */
  public evaluateNextAction(input: DecisionEngineInput): PlanningDecision {
    const { profileId, workModel, declaredGoal, completedPhases = [], proposedQuestions = [] } = input;
    const now = new Date().toISOString();

    const capabilities = Object.values(workModel.capabilities);
    const uncertainties = workModel.uncertainties;
    const preferences = workModel.preferences;

    // Check if user has declared a goal or if preferences point to a direction
    const goalText = declaredGoal || (preferences.domains.length > 0 ? preferences.domains[0] : null);

    // 1. DISAMBIGUATE CHECK:
    // If the goal is completely missing, or high-impact uncertainties exist that are directly answerable via question
    const missingCoreGoal = !goalText || goalText.trim().length === 0;
    const hasMaterialUncertainty =
      missingCoreGoal ||
      (capabilities.length === 0 && (!preferences.languages || preferences.languages.length === 0));

    // Conditionally generate candidates only when helpful
    let candidates: CandidateDirection[] = [];
    if (goalText) {
      candidates = this.candidateGen.generateCandidates(workModel, goalText);
    }

    // Determine if candidate directions are ambiguous (multiple competing directions without clear evidence)
    const competingDirections = candidates.filter((c) => c.status === "active" || c.status === "supported");
    const isAmbiguousDirection = competingDirections.length > 1;

    const questionUncertainty = uncertainties.find((u) => u.resolutionStrategy === "question");
    const experimentUncertainty = uncertainties.find((u) => u.resolutionStrategy === "experiment");

    // Case A: EXPLORE
    // If an explicit uncertainty requires an experiment, or user is unsure
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
        id: `dec_${Date.now()}`,
        profileId,
        mode: "explore" as DecisionMode,
        primaryObjective: `Gather empirical evidence through practical exploration in ${expName}`,
        targetCandidateDirection: targetCandidate?.name || null,
        activePhase: null,
        activeQuestion: null,
        activeExperiment: experiment,
        rationale: `Direct questioning is insufficient to resolve uncertainty. Initiating practical exploratory probe.`,
        evidenceConsidered: workModel.evidenceIds,
        timestamp: now,
      };
    }

    // Case B: DISAMBIGUATE
    // If an explicit question uncertainty exists, or goal is missing/ambiguous/uncertain
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

      // Pick highest information-value question
      const selectedQuestion = this.selectHighestValueQuestion(candidatesToConsider, workModel);
      if (selectedQuestion) {
        return {
          id: `dec_${Date.now()}`,
          profileId,
          mode: "disambiguate" as DecisionMode,
          primaryObjective: `Resolve uncertainty regarding ${selectedQuestion.dimension}`,
          targetCandidateDirection: candidates[0]?.name || null,
          activePhase: null,
          activeQuestion: {
            selectedQuestion,
            consideredCandidates: candidatesToConsider,
            decisionRationale: `Question selected to resolve high-impact ambiguity in ${selectedQuestion.dimension}`,
            selectionTimestamp: now,
          },
          activeExperiment: null,
          rationale: `Disambiguation required: ${selectedQuestion.why || "Information needed to clarify direction."}`,
          evidenceConsidered: workModel.evidenceIds,
          timestamp: now,
        };
      }
    }

    // Case C: COMMIT
    // There is sufficient clarity to proceed with the next developmental phase
    const chosenDirection = candidates[0]?.name || goalText || "Technical Fundamentals";

    return {
      id: `dec_${Date.now()}`,
      profileId,
      mode: "commit" as DecisionMode,
      primaryObjective: `Generate and execute next phase for ${chosenDirection}`,
      targetCandidateDirection: chosenDirection,
      activePhase: null, // Will be populated by PhasePlanner
      activeQuestion: null,
      activeExperiment: null,
      rationale: `Sufficient evidence and directional clarity established to commit to next development phase.`,
      evidenceConsidered: workModel.evidenceIds,
      timestamp: now,
    };
  }

  private selectHighestValueQuestion(
    candidates: QuestionCandidate[],
    workModel: UserWorkModel
  ): QuestionCandidate | null {
    if (!candidates || candidates.length === 0) return null;

    // Filter out already known dimensions
    const knownDims = new Set([
      ...Object.keys(workModel.capabilities),
      ...Object.keys(workModel.workCharacteristics),
      ...workModel.preferences.domains,
      ...workModel.preferences.languages,
    ].map((s) => s.toLowerCase()));

    const eligible = candidates.filter((c) => !knownDims.has(c.dimension.toLowerCase()));
    if (eligible.length === 0) return candidates[0];

    // Rank by utility score / information gain
    eligible.sort((a, b) => (b.utilityScore ?? b.informationGain ?? 0) - (a.utilityScore ?? a.informationGain ?? 0));
    return eligible[0];
  }
}

export const decisionEngine = new DecisionEngine();
