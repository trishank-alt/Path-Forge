import {
  PathHypothesis,
  ProfileFact,
  QuestionCandidate,
  QuestionDecision,
} from "../../contracts";
import { HypothesisEngine } from "./hypothesis-engine";

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
   * Selects the single highest-value question using Information Gain and Product Utility.
   * IG(q) = H(H|E) - Σ_a P(a|q, E) * H(H|E, a)
   * Utility = IG × path_impact × answerability - friction - repetition_penalty
   */
  public selectBestQuestion(
    candidates: QuestionCandidate[],
    currentHypotheses: PathHypothesis[],
    existingFacts: ProfileFact[]
  ): QuestionDecision {
    const activeFacts = existingFacts.filter((f) => f.status === "active");
    const answeredDimensions = new Set(activeFacts.map((f) => f.dimension.toLowerCase()));
    const currentEntropy = this.calculateEntropy(currentHypotheses);

    const scoredCandidates: QuestionCandidate[] = [];

    for (const candidate of candidates) {
      const dim = candidate.dimension.toLowerCase();
      const isAlreadyAnswered = answeredDimensions.has(dim);

      // Repetition penalty: severely penalize already answered dimensions
      const repetitionPenalty = isAlreadyAnswered ? 5.0 : 0.0;
      const friction = candidate.answerType === "free_text" ? 0.2 : 0.05; // Multiple choice is lower friction
      const answerability = 1.0;

      // Estimate Information Gain
      const answerBuckets = candidate.predictedAnswerBuckets || ["bucket_a", "bucket_b", "unknown"];
      let expectedConditionalEntropy = 0;
      const pPerBucket = 1.0 / answerBuckets.length;

      for (const bucket of answerBuckets) {
        // Simulate evidence addition
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

      // Path Impact: High impact if dimension separates top paths
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
        (informationGain * pathImpact * answerability + (candidate.why ? 0.1 : 0) - friction - repetitionPenalty).toFixed(4)
      );

      scoredCandidates.push({
        ...candidate,
        informationGain: Number(informationGain.toFixed(4)),
        utilityScore,
      });
    }

    // Sort descending by utility score
    scoredCandidates.sort((a, b) => b.utilityScore - a.utilityScore);

    const fallbackQuestion: QuestionCandidate = {
      id: `q_fallback_${Date.now()}`,
      dimension: "target_domain",
      question: "Which domain of software engineering or systems architecture would you like to specialize in?",
      answerType: "single_choice",
      options: [
        "Enterprise Systems & Scalable Transactional Backends",
        "Modern Full-Stack SaaS Products & Web APIs",
        "Cloud-Native Data Pipelines & Asynchronous Services",
        "Ethical Cybersecurity & Defensive Security Labs",
      ],
      why: "Specialization determines which technical modules and capstone projects compose your roadmap.",
      predictedAnswerBuckets: ["enterprise", "saas", "data", "security"],
      informationGain: 0.35,
      utilityScore: 0.5,
    };

    const selectedQuestion = scoredCandidates[0] || candidates[0] || fallbackQuestion;

    return {
      selectedQuestion,
      consideredCandidates: scoredCandidates.length > 0 ? scoredCandidates : [fallbackQuestion],
      decisionRationale: `Selected '${selectedQuestion.question}' because dimension '${selectedQuestion.dimension}' maximizes information gain (IG: ${selectedQuestion.informationGain || 0.35}, Utility: ${selectedQuestion.utilityScore || 0.5}) and cleanly disambiguates top career paths.`,
      selectionTimestamp: new Date().toISOString(),
    };
  }
}
