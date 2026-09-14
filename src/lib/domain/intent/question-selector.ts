import {
  ALLOWED_QUESTION_DIMENSIONS,
  PathHypothesis,
  ProfileFact,
  QuestionCandidate,
  QuestionDecision,
} from "../../contracts";
import { HypothesisEngine } from "./hypothesis-engine";
import { isNonCommittalAnswer } from "./path-compatibility-gate";

export class QuestionSelector {
  private hypothesisEngine: HypothesisEngine;

  constructor(hypothesisEngine: HypothesisEngine = new HypothesisEngine()) {
    this.hypothesisEngine = hypothesisEngine;
  }

  /**
   * Computes entropy of a probability distribution: H(P) = - Σ p * log2(p)
   */
  private calculateEntropy(hypotheses: PathHypothesis[]): number {
    let entropy = 0;
    for (const h of hypotheses) {
      if (h.posteriorProbability > 0) {
        entropy -= h.posteriorProbability * Math.log2(h.posteriorProbability);
      }
    }
    return entropy;
  }

  /**
   * Evaluates whether a candidate question is semantically valid given the learner's active facts and intent hypotheses.
   */
  private isCandidateEligible(
    candidate: QuestionCandidate,
    answeredDimensions: Set<string>,
    activeFacts: ProfileFact[]
  ): boolean {
    const dim = candidate.dimension.toLowerCase();
    const allowedSet = new Set<string>(ALLOWED_QUESTION_DIMENSIONS as readonly string[]);

    // 1. Dimension must be supported
    if (!allowedSet.has(dim)) {
      return false;
    }

    // 2. Dimension must not already be answered/known in active facts
    if (answeredDimensions.has(dim)) {
      return false;
    }

    // 3. Question must have non-empty text and valid options
    if (!candidate.question || candidate.question.trim().length === 0) {
      return false;
    }

    // 4. Must not contradict explicit learner facts (e.g. asking for Java when learner is explicit Hardware/VLSI)
    const goalFacts = activeFacts.filter(
      (f) => f.dimension === "declared_goal" || f.dimension === "target_role"
    );
    const goalText = goalFacts.map((f) => String(f.normalizedValue || f.rawValue)).join(" ").toLowerCase();

    if (goalText.includes("vlsi") || goalText.includes("hardware") || goalText.includes("chip")) {
      const questionText = candidate.question.toLowerCase();
      if (
        questionText.includes("spring boot") ||
        questionText.includes("fastify") ||
        questionText.includes("react") ||
        questionText.includes("web application")
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Selects the single highest-value question using Information Gain and Product Utility.
   * Returns null if no semantically eligible candidates exist.
   */
  public selectBestQuestion(
    candidates: QuestionCandidate[],
    currentHypotheses: PathHypothesis[],
    existingFacts: ProfileFact[]
  ): QuestionDecision | null {
    if (!candidates || candidates.length === 0) {
      return null;
    }

    const activeFacts = existingFacts.filter((f) => f.status === "active");
    const answeredDimensions = new Set(
      activeFacts
        .filter((f) => !isNonCommittalAnswer(String(f.normalizedValue || f.rawValue || "")))
        .map((f) => f.dimension.toLowerCase())
    );

    // 1. Filter out semantically ineligible candidates BEFORE scoring
    const eligibleCandidates = candidates.filter((c) =>
      this.isCandidateEligible(c, answeredDimensions, activeFacts)
    );

    if (eligibleCandidates.length === 0) {
      return null;
    }

    const currentEntropy = this.calculateEntropy(currentHypotheses);
    const scoredCandidates: QuestionCandidate[] = [];

    for (const candidate of eligibleCandidates) {
      const dim = candidate.dimension.toLowerCase();
      const friction = candidate.answerType === "free_text" ? 0.2 : 0.05;
      const answerability = 1.0;

      // Estimate Information Gain
      const answerBuckets = candidate.predictedAnswerBuckets || ["bucket_a", "bucket_b", "unknown"];
      let expectedConditionalEntropy = 0;
      const pPerBucket = 1.0 / answerBuckets.length;

      for (const bucket of answerBuckets) {
        const simulatedFact: ProfileFact = {
          id: "simulated",
          dimension: candidate.dimension,
          normalizedValue: bucket,
          rawValue: bucket,
          source: "user_answer",
          evidence: `Simulated answer: ${bucket}`,
          reliability: 0.9,
          impact: "medium",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const simulatedResult = this.hypothesisEngine.updateHypotheses([...activeFacts, simulatedFact]);
        const branchEntropy = this.calculateEntropy(simulatedResult.hypotheses);
        expectedConditionalEntropy += pPerBucket * branchEntropy;
      }

      const informationGain = Math.max(0, currentEntropy - expectedConditionalEntropy);

      let pathImpact = 1.0;
      if (
        dim === "specialization_focus" ||
        dim === "primary_language" ||
        dim === "target_domain" ||
        dim === "ethical_scope_confirmed"
      ) {
        pathImpact = 1.8;
      } else if (dim === "architecture_preference" || dim === "hours_per_week") {
        pathImpact = 1.4;
      }

      const utilityScore = Number(
        (informationGain * pathImpact * answerability + (candidate.why ? 0.1 : 0) - friction).toFixed(4)
      );

      scoredCandidates.push({
        ...candidate,
        informationGain: Number(informationGain.toFixed(4)),
        utilityScore,
      });
    }

    if (scoredCandidates.length === 0) {
      return null;
    }

    // Sort descending by utility score
    scoredCandidates.sort((a, b) => b.utilityScore - a.utilityScore);

    const selectedQuestion = scoredCandidates[0];

    return {
      selectedQuestion,
      consideredCandidates: scoredCandidates,
      decisionRationale: `Selected '${selectedQuestion.question}' because dimension '${selectedQuestion.dimension}' maximizes information gain (IG: ${selectedQuestion.informationGain || 0}, Utility: ${selectedQuestion.utilityScore || 0}) and cleanly disambiguates top career paths.`,
      selectionTimestamp: new Date().toISOString(),
    };
  }
}
