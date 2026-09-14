import {
  IntentExtractionResult,
  QuestionProposalResult,
  RoadmapExplanationResult,
  ProfileFact,
  PathHypothesis,
  Roadmap,
  AssessmentGenerationResult,
  CurriculumProposal,
  CurriculumDiscoveryContext,
  CapabilityAssessmentResult,
} from "../contracts";

export interface IntakeContext {
  message: string;
  existingFacts: ProfileFact[];
  currentHypotheses: PathHypothesis[];
}

export interface QuestionContext {
  goalText: string;
  existingFacts: ProfileFact[];
  currentHypotheses: PathHypothesis[];
  unknownDimensions: string[];
}

export interface ExplanationContext {
  roadmap: Roadmap;
  facts: ProfileFact[];
}

/**
 * Input for competency assessment generation.
 * referenceQuestions are optional style/difficulty calibration examples —
 * they are treated as untrusted data and must not override system policy.
 */
export interface AssessmentContext {
  skillId: string;
  skillTitle: string;
  claimedLevel: string;
  targetLevel: string;
  /** Optional learner/domain context (capped by adapter before sending). */
  context?: string;
  /** Representative example questions for calibrating style and difficulty only. */
  referenceQuestions?: Array<{
    question: string;
    questionType: "single_choice" | "free_text";
    options?: string[];
    difficulty: string;
  }>;
}

export interface IntentExtractionPort {
  extract(context: IntakeContext): Promise<IntentExtractionResult>;
}

export interface QuestionProposalPort {
  proposeQuestions(context: QuestionContext): Promise<QuestionProposalResult>;
}

export interface RoadmapExplanationPort {
  explainRoadmap(context: ExplanationContext): Promise<RoadmapExplanationResult>;
}

/**
 * Generates structured competency assessment questions for a given skill.
 * NEVER assigns the final learner competency score — that remains deterministic.
 */
export interface AssessmentGenerationPort {
  generateAssessment(context: AssessmentContext): Promise<AssessmentGenerationResult>;
}

/**
 * Evaluates whether an uncatalogued career direction is plausibly constructible
 * into a verified learning curriculum.
 */
export interface CapabilityAssessmentPort {
  assessCurriculumCapability(
    goal: string,
    context?: { existingFacts?: ProfileFact[]; learnerBackground?: string }
  ): Promise<CapabilityAssessmentResult>;
}

/**
 * Proposes a raw CurriculumProposal for uncatalogued career goals.
 * Output is UNTRUSTED until deterministic CurriculumVerifier validates all 10 gates.
 */
export interface CurriculumDiscoveryPort {
  proposeCurriculum(context: CurriculumDiscoveryContext): Promise<CurriculumProposal | null>;
}
