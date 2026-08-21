import {
  ConfidenceBreakdown,
  Contradiction,
  IntentStatus,
  PathHypothesis,
  ProfileFact,
} from "../../contracts";
import { SEEDED_PATHS, PathDefinition } from "../../persistence/seed-data";

export interface ConfidenceEvaluationInput {
  hypotheses: PathHypothesis[];
  facts: ProfileFact[];
  contradictions: Contradiction[];
  questionCount: number;
  maxBudget?: number;
}

export class IntentConfidenceService {
  private paths: PathDefinition[];

  constructor(paths: PathDefinition[] = SEEDED_PATHS) {
    this.paths = paths;
  }

  /**
   * Computes deterministic intent confidence and state gating according to the formal readiness policy:
   * 1. topPathPosterior: likelihood of leading candidate path
   * 2. coverage: percentage of required decision dimensions known
   * 3. consistency: penalty for unresolved contradictions
   * 4. evidenceQuality: reliability of supporting evidence
   * 5. overallIntentConfidence: deterministic score = topPathPosterior * coverage * consistency * evidenceQuality
   * 6. missingHighImpactDimensions: required unresolved dimensions
   *
   * Gating:
   * - ready: topPathPosterior >= 0.8 && coverage >= 0.75 && consistency >= 0.8 && missingHighImpactDimensions.length === 0
   * - provisional: !intentReady && topPathPosterior >= 0.55 && coverage >= 0.4 && missingHighImpactDimensions.length <= 1
   * - clarifying: otherwise (coverage = 0 can NEVER be provisional or ready)
   */
  public evaluateConfidence(input: ConfidenceEvaluationInput): ConfidenceBreakdown {
    const { hypotheses, facts, contradictions, questionCount, maxBudget = 6 } = input;
    const activeFacts = facts.filter((f) => f.status === "active");
    const topHypothesis = hypotheses[0];

    const topPathPosterior = topHypothesis ? topHypothesis.posteriorProbability : 0;
    const topPathDef = this.paths.find((p) => p.id === topHypothesis?.pathId);

    // 1. Required decision dimensions & missing high-impact dimensions
    const requiredDims = topPathDef?.requiredDimensions || [
      "primary_language",
      "target_domain",
      "architecture_preference",
      "hours_per_week",
    ];

    const knownDimensions = new Set(activeFacts.map((f) => f.dimension.toLowerCase()));
    const missingHighImpactDimensions = requiredDims.filter((d) => !knownDimensions.has(d.toLowerCase()));
    const answeredCount = requiredDims.length - missingHighImpactDimensions.length;

    // 2. Coverage Factor (0.0 to 1.0)
    const coverage = requiredDims.length > 0 ? Number((answeredCount / requiredDims.length).toFixed(4)) : 0;

    // 3. Consistency Factor (0.0 to 1.0)
    const unaddressedContradictions = contradictions.filter((c) => !c.resolved);
    const highImpactContradiction = unaddressedContradictions.some((c) => c.severity === "high");
    let consistency = 1.0;

    if (highImpactContradiction) {
      consistency = 0.5;
    } else if (unaddressedContradictions.length > 0) {
      consistency = Math.max(0.6, Number((1.0 - unaddressedContradictions.length * 0.15).toFixed(4)));
    }

    // 4. Evidence Quality Factor (0.0 to 1.0)
    let evidenceQuality = 0.0;
    if (activeFacts.length > 0) {
      const avgReliability =
        activeFacts.reduce((sum, f) => sum + f.reliability, 0) / activeFacts.length;
      evidenceQuality = Number(Math.max(0.4, Math.min(1.0, avgReliability)).toFixed(4));
    }

    // 5. Overall Deterministic Intent Confidence Score
    const overallIntentConfidence = Number(
      (topPathPosterior * coverage * consistency * evidenceQuality).toFixed(4)
    );

    // 6. Strict Deterministic State Gating Policy
    const intentReady =
      topPathPosterior >= 0.8 &&
      coverage >= 0.75 &&
      consistency >= 0.8 &&
      missingHighImpactDimensions.length === 0;

    const questionBudgetExhausted = questionCount >= maxBudget;
    const provisionalReady =
      !intentReady &&
      ((topPathPosterior >= 0.55 && coverage >= 0.4 && missingHighImpactDimensions.length <= 1) ||
        questionBudgetExhausted);

    const intentState: IntentStatus = intentReady
      ? "ready"
      : provisionalReady
      ? "provisional"
      : "clarifying";

    // 7. Explanations adhering strictly to user requirements
    let explanation = "";
    if (intentState === "ready") {
      explanation = `We have enough information to tailor this learning path to your goals and preferences.`;
    } else if (intentState === "provisional") {
      explanation = questionBudgetExhausted
        ? "We've created a provisional learning path using what you've shared so far. You can refine it anytime by adding more details."
        : "We have a strong starting direction. A few details are still open, so this path remains easy to refine.";
    } else {
      // Clarifying state wording
      if (topPathPosterior >= 0.55) {
        explanation =
          "We have a leading hypothesis, but need a few details before recommending a learning path.";
      } else {
        explanation = "A few preferences will help us make your learning path more relevant.";
      }
    }

    // Active assumptions
    const assumptions = topPathDef ? [...topPathDef.defaultAssumptions] : [];
    if (missingHighImpactDimensions.length > 0) {
      assumptions.push(`Assuming default baseline for missing dimensions: ${missingHighImpactDimensions.join(", ")}.`);
    }

    return {
      topProbability: topPathPosterior,
      coverageFactor: coverage,
      consistencyFactor: consistency,
      evidenceQualityFactor: evidenceQuality,
      finalScore: overallIntentConfidence,
      status: intentState,
      missingDimensions: missingHighImpactDimensions,
      missingHighImpactDimensions,
      assumptions,
      contradictions: unaddressedContradictions,
      explanation,
    };
  }
}
