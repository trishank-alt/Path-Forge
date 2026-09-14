import {
  ConfidenceBreakdown,
  Contradiction,
  IntentStatus,
  PathHypothesis,
  ProfileFact,
} from "../../contracts";
import { SEEDED_PATHS, PathDefinition } from "../../persistence/seed-data";
import { pathCompatibilityGate, isNonCommittalAnswer } from "./path-compatibility-gate";

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
   * 1. Evaluates path compatibility gate (hard eligibility boundary).
   * 2. topPathPosterior: likelihood of leading candidate path
   * 3. coverage: percentage of required decision dimensions known
   * 4. consistency: penalty for unresolved contradictions
   * 5. evidenceQuality: reliability of supporting evidence
   * 6. overallIntentConfidence: deterministic score = topPathPosterior * coverage * consistency * evidenceQuality
   * 7. missingHighImpactDimensions: required unresolved dimensions
   *
   * Gating:
   * - ready: compatible && topPathPosterior >= 0.8 && coverage >= 0.75 && consistency >= 0.8 && missingHighImpactDimensions.length === 0
   * - provisional: compatible && !intentReady && topPathPosterior >= 0.55 && coverage >= 0.4 && missingHighImpactDimensions.length <= 1
   * - clarifying: otherwise (coverage = 0 or incompatible intent can NEVER be provisional or ready)
   */
  public evaluateConfidence(input: ConfidenceEvaluationInput): ConfidenceBreakdown {
    const { hypotheses, facts, contradictions, questionCount, maxBudget = 6 } = input;
    const activeFacts = facts.filter((f) => f.status === "active");
    // 0. Hard Compatibility Check
    const compatEval = pathCompatibilityGate.evaluateIntentCompatibility(activeFacts, this.paths);
    const eligiblePathIds = new Set(compatEval.eligiblePaths.map((p) => p.id));
    const topHypothesis = hypotheses.find((h) => eligiblePathIds.has(h.pathId) && h.posteriorProbability > 0) || null;
    const topPathIsEligible = Boolean(topHypothesis && eligiblePathIds.has(topHypothesis.pathId));

    const knownDimensions = new Set(
      activeFacts
        .filter((f) => !isNonCommittalAnswer(String(f.normalizedValue || f.rawValue || "")))
        .map((f) => f.dimension.toLowerCase())
    );

    const goalFacts = activeFacts.filter(
      (f) => f.dimension === "declared_goal" || f.dimension === "goal" || f.dimension === "target_role"
    );
    const hasGoal = goalFacts.length > 0 && !isNonCommittalAnswer(String(goalFacts[0].normalizedValue || goalFacts[0].rawValue || ""));

    // If explicit career intent is genuinely unsupported by policy
    if (!compatEval.isIntentSupported) {
      const unsupportedExplanation =
        compatEval.unsupportedReason ||
        "We currently do not offer a learning path for the requested career domain.";

      return {
        topProbability: 0.0,
        coverageFactor: 0.0,
        consistencyFactor: 1.0,
        evidenceQualityFactor: 0.8,
        finalScore: 0.0,
        status: "clarifying",
        missingDimensions: [],
        missingHighImpactDimensions: [],
        missingMaterialDimensions: [],
        unsupportedIntent: true,
        unsupportedReason: unsupportedExplanation,
        assumptions: [],
        contradictions: [],
        explanation: unsupportedExplanation,
      };
    }

    // If no seeded catalog match, but goal is declared: treat as constructible candidate requiring clarification
    if (compatEval.eligiblePaths.length === 0) {
      if (!hasGoal) {
        return {
          topProbability: 0.0,
          coverageFactor: 0.0,
          consistencyFactor: 1.0,
          evidenceQualityFactor: 0.8,
          finalScore: 0.0,
          status: "clarifying",
          missingDimensions: ["declared_goal"],
          missingHighImpactDimensions: ["declared_goal"],
          missingMaterialDimensions: ["declared_goal"],
          unsupportedIntent: false,
          assumptions: [],
          contradictions: [],
          explanation: "Please declare your target career goal or role.",
        };
      }

      const uncataloguedRequiredDims = [
        "primary_language",
        "target_domain",
        "hours_per_week",
      ];
      const missingHighImpactDimensions = uncataloguedRequiredDims.filter((d) => !knownDimensions.has(d.toLowerCase()));
      const materialSet = new Set<string>([
        "primary_language",
        "target_domain",
        "target_role",
        "declared_goal",
        "specialization_focus",
        "architecture_preference",
      ]);
      const missingMaterialDimensions = missingHighImpactDimensions.filter((d) => materialSet.has(d.toLowerCase()));
      const answeredCount = uncataloguedRequiredDims.length - missingHighImpactDimensions.length;
      const coverage = Number((answeredCount / uncataloguedRequiredDims.length).toFixed(4));
      const status: IntentStatus = missingMaterialDimensions.length === 0 ? "ready" : "clarifying";

      return {
        topProbability: 0.85,
        coverageFactor: coverage,
        consistencyFactor: 1.0,
        evidenceQualityFactor: 0.85,
        finalScore: missingMaterialDimensions.length === 0 ? 0.85 : 0.45,
        status,
        missingDimensions: missingHighImpactDimensions,
        missingHighImpactDimensions,
        missingMaterialDimensions,
        unsupportedIntent: false,
        assumptions: ["Constructible uncatalogued career track entering curriculum discovery."],
        contradictions: [],
        explanation: missingMaterialDimensions.length === 0
          ? "Intent is resolved for uncatalogued curriculum discovery."
          : "Material dimensions are required before synthesizing curriculum.",
      };
    }

    const topPathPosterior = topHypothesis && topPathIsEligible ? topHypothesis.posteriorProbability : 0;
    const topPathDef = topHypothesis ? this.paths.find((p) => p.id === topHypothesis.pathId) : undefined;

    // 1. Required decision dimensions & missing high-impact dimensions
    const requiredDims = topPathDef?.requiredDimensions || [
      "primary_language",
      "target_domain",
      "architecture_preference",
      "hours_per_week",
    ];

    const missingHighImpactDimensions = requiredDims.filter((d) => !knownDimensions.has(d.toLowerCase()));
    const answeredCount = requiredDims.length - missingHighImpactDimensions.length;

    const materialSet = new Set<string>([
      "primary_language",
      "target_domain",
      "target_role",
      "declared_goal",
      "specialization_focus",
      "architecture_preference",
      "ethical_scope_confirmed",
    ]);
    const missingMaterialDimensions = missingHighImpactDimensions.filter((d) => materialSet.has(d.toLowerCase()));

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

    // 6. Strict Deterministic State Gating Policy (Requires Path Compatibility)
    const intentReady =
      topPathIsEligible &&
      topPathPosterior >= 0.8 &&
      coverage >= 0.75 &&
      consistency >= 0.8 &&
      missingHighImpactDimensions.length === 0;

    const questionBudgetExhausted = questionCount >= maxBudget;
    const provisionalReady =
      topPathIsEligible &&
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
      if (!topPathIsEligible) {
        explanation = "The candidate path is incompatible with your explicit career goal or technology preference.";
      } else if (topPathPosterior >= 0.55) {
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
      missingMaterialDimensions,
      assumptions,
      contradictions: unaddressedContradictions,
      explanation,
    };
  }
}
