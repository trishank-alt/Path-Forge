import { orchestrator } from "../src/lib/application/orchestrator";

async function run() {
  console.log("=== Scenario A: User says 'I want to become a Software Engineer' ===");
  const r1 = await orchestrator.handleIntake({ message: "I want to become a Software Engineer" }, "test_reproduce_2");
  console.log("Step 1 r1:", {
    declared_goal: r1.profile.declaredTargetRole,
    activeFacts: r1.profile.facts.filter(f => f.status === "active").map(f => `${f.dimension}=${f.rawValue}`),
    missingMaterialDimensions: r1.decision.missingMaterialDimensions,
    activeQuestion: r1.decision.activeQuestion?.selectedQuestion?.dimension,
    recommendation: r1.decision.recommendation?.dimension,
  });

  console.log("\n=== Step 2: User answers 'Not sure yet / Open to suggestions' ===");
  const r2 = await orchestrator.answerQuestion("target_domain", "Not sure yet / Open to suggestions", "test_reproduce_2");
  console.log("Step 2 r2:", {
    declared_goal: r2.profile.declaredTargetRole,
    activeFacts: r2.profile.facts.filter(f => f.status === "active").map(f => `${f.dimension}=${f.rawValue}`),
    missingMaterialDimensions: r2.decision.missingMaterialDimensions,
    recommendation: r2.decision.recommendation?.dimension,
  });

  console.log("\n=== Step 3: In chat box, user enters 'I want to be a Mobile App Developer' (or LLM extracts declared_goal) ===");
  const r3 = await orchestrator.handleIntake({ message: "I want to be a Mobile App Developer" }, "test_reproduce_2");
  console.log("Step 3 r3:", {
    declared_goal: r3.profile.declaredTargetRole,
    activeFacts: r3.profile.facts.filter(f => f.status === "active").map(f => `${f.dimension}=${f.rawValue}`),
    missingMaterialDimensions: r3.decision.missingMaterialDimensions,
    activeQuestion: r3.decision.activeQuestion?.selectedQuestion?.dimension,
    recommendation: r3.decision.recommendation?.dimension,
  });

  console.log("\n=== Step 4: User clicks 'high_performance_systems' from previous recommendation ===");
  const r4 = await orchestrator.answerQuestion("target_domain", "high_performance_systems", "test_reproduce_2");
  console.log("Step 4 r4:", {
    declared_goal: r4.profile.declaredTargetRole,
    activeFacts: r4.profile.facts.filter(f => f.status === "active").map(f => `${f.dimension}=${f.rawValue}`),
    missingMaterialDimensions: r4.decision.missingMaterialDimensions,
    activeQuestion: r4.decision.activeQuestion?.selectedQuestion?.dimension,
    activeQuestionText: r4.decision.activeQuestion?.selectedQuestion?.question,
    recommendation: r4.decision.recommendation?.dimension,
  });

  console.log("\n=== Step 5: User answers primary_language: 'Kotlin' ===");
  const r5 = await orchestrator.answerQuestion("primary_language", "Kotlin", "test_reproduce_2");
  console.log("Step 5 r5:", {
    declared_goal: r5.profile.declaredTargetRole,
    activeFacts: r5.profile.facts.filter(f => f.status === "active").map(f => `${f.dimension}=${f.rawValue}`),
    missingMaterialDimensions: r5.decision.missingMaterialDimensions,
    activeQuestion: r5.decision.activeQuestion?.selectedQuestion?.dimension,
    recommendation: r5.decision.recommendation?.dimension,
    eligibility: r5.decision.eligibility,
  });
}

run().catch(console.error);
