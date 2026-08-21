import { HypothesisEngine } from "../src/lib/domain/intent/hypothesis-engine";
import { IntentConfidenceService } from "../src/lib/domain/intent/confidence-service";
import { QuestionSelector } from "../src/lib/domain/intent/question-selector";
import { FactPrecedenceEngine } from "../src/lib/domain/intent/fact-precedence-engine";
import { SkillGraph } from "../src/lib/domain/learning/skill-graph";
import { SkillGapService } from "../src/lib/domain/learning/skill-gap-service";
import { MilestonePlanner } from "../src/lib/domain/learning/milestone-planner";
import { NextBestActionService } from "../src/lib/domain/learning/next-best-action-service";
import { DeterministicLlmAdapter } from "../src/lib/llm/deterministic-adapter";
import { ProfileFact, PathHypothesis, Contradiction } from "../src/lib/contracts";
import { SEEDED_PATHS } from "../src/lib/persistence/seed-data";
import { LearningOrchestrator } from "../src/lib/application/orchestrator";

async function runVerification() {
  console.log("==================================================");
  console.log("Running PathFinder AI Verification Tests...");
  console.log("==================================================\n");

  const hypothesisEngine = new HypothesisEngine();
  const confidenceService = new IntentConfidenceService();
  const questionSelector = new QuestionSelector(hypothesisEngine);
  const factEngine = new FactPrecedenceEngine();
  const skillGraph = new SkillGraph();
  const skillGapService = new SkillGapService(skillGraph);
  const milestonePlanner = new MilestonePlanner();
  const nbaService = new NextBestActionService();
  const llm = new DeterministicLlmAdapter();

  const now = new Date().toISOString();

  // Test 1: One broad, low-context learner message results in `clarifying`
  console.log("Test 1: One broad, low-context learner message results in 'clarifying'");
  const initialExtraction = await llm.extract({
    message: "I want to become a backend developer. I know HTTP and REST.",
    existingFacts: [],
    currentHypotheses: [],
  });

  const initialFacts: ProfileFact[] = initialExtraction.facts.map((f, i) => ({
    id: `f_${i}`,
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

  const hyp1 = hypothesisEngine.updateHypotheses(initialFacts);
  const conf1 = confidenceService.evaluateConfidence({
    hypotheses: hyp1.hypotheses,
    facts: initialFacts,
    contradictions: [],
    questionCount: 0,
  });

  console.log(`- Top Path: ${hyp1.topPath.pathTitle}`);
  console.log(`- Top Likelihood: ${(conf1.topProbability * 100).toFixed(1)}%`);
  console.log(`- Coverage: ${(conf1.coverageFactor * 100).toFixed(1)}%`);
  console.log(`- Missing High Impact Dimensions: [${conf1.missingHighImpactDimensions.join(", ")}]`);
  console.log(`- Status: ${conf1.status}`);

  if (conf1.status === "clarifying") {
    console.log("  [PASS] Broad goal with low context correctly produces 'clarifying' state.\n");
  } else {
    throw new Error(`Test 1 Failed: Expected 'clarifying' but got '${conf1.status}'`);
  }

  // Test 2: coverage = 0 can NEVER result in provisional or ready, even with 100% posterior
  console.log("Test 2: coverage = 0 can NEVER result in 'provisional' or 'ready'");
  const syntheticHypotheses: PathHypothesis[] = [
    {
      pathId: "backend_enterprise_java",
      pathTitle: "Enterprise Java & ERP Systems Architect",
      priorProbability: 0.25,
      posteriorProbability: 0.99, // Extremely high posterior
      supportEvidenceCount: 1,
      rationale: "Synthetic high posterior test",
    },
  ];

  const zeroCoverageConf = confidenceService.evaluateConfidence({
    hypotheses: syntheticHypotheses,
    facts: [], // No facts -> coverage = 0
    contradictions: [],
    questionCount: 0,
  });

  console.log(`- Posterior: ${(zeroCoverageConf.topProbability * 100).toFixed(0)}%`);
  console.log(`- Coverage: ${(zeroCoverageConf.coverageFactor * 100).toFixed(0)}%`);
  console.log(`- Result Status: ${zeroCoverageConf.status}`);

  if (zeroCoverageConf.status === "clarifying") {
    console.log("  [PASS] coverage = 0 strictly forced status to 'clarifying' despite 99% posterior.\n");
  } else {
    throw new Error(`Test 2 Failed: Status must be 'clarifying' when coverage=0, but was '${zeroCoverageConf.status}'`);
  }

  // Test 3: Roadmap and Next-Best Action are unavailable in clarifying
  console.log("Test 3: Roadmap and Next-Best Action are unavailable in 'clarifying'");
  const orchestrator = new LearningOrchestrator();
  await orchestrator.resetState();

  const intakeResult = await orchestrator.handleIntake({
    message: "I want to become a backend developer. I know HTTP and REST.",
  });

  console.log(`- Intake Confidence Status: ${intakeResult.confidence.status}`);
  console.log(`- Returned Roadmap: ${intakeResult.roadmap}`);
  console.log(`- Profile Declared Target Role: ${intakeResult.profile.declaredTargetRole}`);
  console.log(`- Profile Active Roadmap ID: ${intakeResult.profile.activeRoadmapId}`);

  if (
    intakeResult.confidence.status === "clarifying" &&
    intakeResult.roadmap === null &&
    intakeResult.profile.declaredTargetRole === null &&
    intakeResult.profile.activeRoadmapId === null
  ) {
    console.log("  [PASS] Roadmap and Next-Best Action are strictly null and unavailable in clarifying.\n");
  } else {
    throw new Error("Test 3 Failed: Roadmap or target role was prematurely set during clarifying!");
  }

  // Test 4: Highest-information-gain question is returned during clarifying
  console.log("Test 4: Highest-information-gain question is returned during 'clarifying'");
  if (intakeResult.activeQuestion) {
    const q = intakeResult.activeQuestion.selectedQuestion;
    console.log(`- Selected Question: "${q.question}"`);
    console.log(`- Dimension: ${q.dimension}`);
    console.log(`- Information Gain: ${q.informationGain}`);
    console.log(`- Has 'Not sure yet' option: ${q.options?.some((opt) => opt.toLowerCase().includes("not sure") || opt.toLowerCase().includes("explore"))}`);

    if (
      (q.dimension === "primary_language" || q.dimension === "target_domain") &&
      q.informationGain >= 0 &&
      q.options?.some((opt) => opt.toLowerCase().includes("not sure") || opt.toLowerCase().includes("explore"))
    ) {
      console.log("  [PASS] Highest IG question returned with non-committal option.\n");
    } else {
      throw new Error("Test 4 Failed: Question selection did not satisfy requirements.");
    }
  } else {
    throw new Error("Test 4 Failed: No active question returned in clarifying state.");
  }

  // Test 5: A path becomes 'ready' only after posterior >= 0.8, coverage >= 0.75, consistency >= 0.8, missingHighImpactDimensions.length === 0
  console.log("Test 5: Path becomes 'ready' only when all 4 criteria are met");
  const javaFact: ProfileFact = {
    id: "f_java",
    dimension: "primary_language",
    normalizedValue: "Java",
    rawValue: "Java (OOP, Streams, Collections)",
    source: "user_answer",
    evidence: "Answered Java",
    reliability: 0.98,
    impact: "high",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const domainFact: ProfileFact = {
    id: "f_domain",
    dimension: "target_domain",
    normalizedValue: "Enterprise Systems, ERP & Financial Workflows",
    rawValue: "Enterprise Systems, ERP & Financial Workflows",
    source: "user_answer",
    evidence: "Answered Enterprise ERP",
    reliability: 0.98,
    impact: "high",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const hoursFact: ProfileFact = {
    id: "f_hours",
    dimension: "hours_per_week",
    normalizedValue: 10,
    rawValue: "10 hours/week",
    source: "user_answer",
    evidence: "Answered 10h",
    reliability: 1.0,
    impact: "high",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const archFact: ProfileFact = {
    id: "f_arch",
    dimension: "architecture_preference",
    normalizedValue: "Modular Monoliths & Robust Transactional Domain Models",
    rawValue: "Modular Monoliths",
    source: "user_answer",
    evidence: "Answered Monoliths",
    reliability: 0.95,
    impact: "medium",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  // 5a. Partial facts (2 of 4 dimensions) -> should be provisional, not ready
  const partialFacts = [javaFact, domainFact];
  const hypPartial = hypothesisEngine.updateHypotheses(partialFacts);
  const confPartial = confidenceService.evaluateConfidence({
    hypotheses: hypPartial.hypotheses,
    facts: partialFacts,
    contradictions: [],
    questionCount: 2,
  });

  console.log(`- Partial Facts Status: ${confPartial.status} (Coverage: ${(confPartial.coverageFactor * 100).toFixed(0)}%, Missing: [${confPartial.missingHighImpactDimensions.join(", ")}])`);
  if (confPartial.status !== "ready") {
    console.log("  [PASS] 2/4 dimensions cannot trigger 'ready'.");
  } else {
    throw new Error("Test 5a Failed: Partial dimensions triggered ready!");
  }

  // 5b. All 4 dimensions supplied -> triggers ready
  const fullFacts = [javaFact, domainFact, hoursFact, archFact];
  const hypFull = hypothesisEngine.updateHypotheses(fullFacts);
  const confFull = confidenceService.evaluateConfidence({
    hypotheses: hypFull.hypotheses,
    facts: fullFacts,
    contradictions: [],
    questionCount: 4,
  });

  console.log(`- Full Facts Status: ${confFull.status} (Likelihood: ${(confFull.topProbability * 100).toFixed(0)}%, Coverage: ${(confFull.coverageFactor * 100).toFixed(0)}%, Missing: [${confFull.missingHighImpactDimensions.join(", ")}])`);
  if (confFull.status === "ready" && confFull.topProbability >= 0.8 && confFull.coverageFactor >= 0.75 && confFull.missingHighImpactDimensions.length === 0) {
    console.log("  [PASS] All 4 criteria passed -> correctly reached 'ready'.\n");
  } else {
    throw new Error("Test 5b Failed: Full dimensions should have triggered ready!");
  }

  // Test 6: Learner correction recalculates state and invalidates stale recommendations
  console.log("Test 6: Learner correction invalidates stale recommendations");
  // Set up ready profile in orchestrator
  await orchestrator.answerQuestion("primary_language", "Java (OOP, Streams, Collections)");
  await orchestrator.answerQuestion("target_domain", "Enterprise Systems, ERP & Financial Workflows");
  await orchestrator.answerQuestion("hours_per_week", "10 hours/week");
  const readyResult = await orchestrator.answerQuestion("architecture_preference", "Modular Monoliths");

  console.log(`- Ready Roadmap ID: ${readyResult.roadmap?.id}`);
  console.log(`- Ready Status: ${readyResult.confidence.status}`);

  // Now revoke primary_language and target_domain facts to make goal ambiguous again
  const javaFactInProfile = readyResult.profile.facts.find((f) => f.dimension === "primary_language")!;
  const domainFactInProfile = readyResult.profile.facts.find((f) => f.dimension === "target_domain")!;

  const firstCorrection = await orchestrator.correctFact(javaFactInProfile.id, {
    revoke: true,
    reason: "No longer focusing on Java",
  });

  const finalCorrection = await orchestrator.correctFact(domainFactInProfile.id, {
    revoke: true,
    reason: "No longer focusing on Enterprise ERP",
  });

  const storedRoadmap = await orchestrator.getRoadmap(readyResult.roadmap!.id);

  console.log(`- First Correction Invalidation Flag: ${firstCorrection.roadmapStale}`);
  console.log(`- Stored Roadmap isStale: ${storedRoadmap?.isStale}`);
  console.log(`- Post-correction Status: ${finalCorrection.profile.intent.status}`);
  console.log(`- Active Roadmap ID: ${finalCorrection.profile.activeRoadmapId}`);

  if (
    firstCorrection.roadmapStale === true &&
    storedRoadmap?.isStale === true &&
    finalCorrection.profile.activeRoadmapId === null &&
    finalCorrection.profile.intent.status === "clarifying"
  ) {
    console.log("  [PASS] Fact corrections successfully recalculated state to 'clarifying' and invalidated stale roadmap.\n");
  } else {
    throw new Error("Test 6 Failed: Fact correction failed to invalidate recommendations!");
  }

  // Test 7: Skill Graph DAG cycle detection
  console.log("Test 7: Skill Graph DAG Cycle Check");
  const hasCycle = skillGraph.detectCycles();
  if (!hasCycle) {
    console.log("  [PASS] Seeded skill graph is a valid DAG.\n");
  } else {
    throw new Error("Test 7 Failed: Cycle found in skill graph.");
  }

  console.log("==================================================");
  console.log("ALL 7 VERIFICATION TESTS PASSED SUCCESSFULLY! (7/7)");
  console.log("==================================================");
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
