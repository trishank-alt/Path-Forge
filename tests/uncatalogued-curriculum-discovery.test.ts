import { orchestrator } from "../src/lib/application/orchestrator";
import { CurriculumDiscoveryService } from "../src/lib/domain/learning/curriculum-discovery-service";
import { curriculumVerifier } from "../src/lib/domain/learning/curriculum-verifier";
import { strict as assert } from "assert";

async function runTests() {
  console.log("================================================================================");
  console.log("RUNNING UNCATALOGUED GOALS LLM CURRICULUM DISCOVERY & RESPONSIBILITY TESTS");
  console.log("================================================================================");

  // ============================================================================
  // TEST 1: KNOWN SEEDED GOAL (Backend Engineer / Software Engineer)
  // ============================================================================
  console.log("\nTest 1: Seeded Career Goal ('Software Engineer') uses Catalog Pipeline...");
  const t1_id = "test_discovery_trace_1";
  const r1 = await orchestrator.handleIntake(
    { message: "I want to become a Software Engineer" },
    t1_id
  );

  console.log("  [Trace 1]", {
    declared_goal: r1.profile.declaredTargetRole,
    target_domain: r1.profile.facts.find(f => f.dimension === "target_domain")?.rawValue,
    primary_language: r1.profile.facts.find(f => f.dimension === "primary_language")?.rawValue,
    missingMaterialDimensions: r1.decision.missingMaterialDimensions,
    eligibility: r1.decision.eligibility,
    selectedPathId: r1.decision.selectedPathId,
    curriculumSource: r1.decision.curriculumSource,
    recommendation: r1.decision.recommendation?.dimension,
    activeQuestion: r1.decision.activeQuestion?.selectedQuestion?.dimension,
    roadmap: r1.roadmap ? "created" : null,
  });

  assert.equal(r1.profile.declaredTargetRole, "Software Engineer");
  assert.equal(r1.decision.eligibility, "material_uncertainty");
  assert.equal(r1.decision.selectedPathId, null);
  assert.equal(r1.roadmap, null);
  assert.ok(r1.decision.missingMaterialDimensions.length > 0);
  assert.ok(r1.decision.activeQuestion !== null);

  // ============================================================================
  // TEST 2: SOFTWARE ENGINEER -> DELEGATED ("Not sure") -> EXPLORATION -> LOCK
  // ============================================================================
  console.log("\nTest 2: Software Engineer -> Not sure -> Choose Domain -> Ask Language -> Lock Catalog Path...");
  const t2_id = "test_discovery_trace_2";
  await orchestrator.handleIntake({ message: "I want to become a Software Engineer" }, t2_id);

  // User answers "Not sure yet"
  const r2_delegated = await orchestrator.answerQuestion(
    "target_domain",
    "Not sure yet / Open to suggestions",
    t2_id
  );

  console.log("  [Trace 2 - Delegated]", {
    declared_goal: r2_delegated.profile.declaredTargetRole,
    target_domain: r2_delegated.profile.facts.find(f => f.dimension === "target_domain")?.rawValue,
    missingMaterialDimensions: r2_delegated.decision.missingMaterialDimensions,
    recommendation: r2_delegated.decision.recommendation?.dimension,
    activeQuestion: r2_delegated.decision.activeQuestion,
    roadmap: r2_delegated.roadmap ? "created" : null,
  });

  // Invariant 2 & 3: delegated dimension stays in missingMaterialDimensions and triggers recommendation
  assert.ok(r2_delegated.decision.missingMaterialDimensions.includes("target_domain"));
  assert.equal(r2_delegated.decision.recommendation?.dimension, "target_domain");
  assert.equal(r2_delegated.decision.activeQuestion, null);
  assert.equal(r2_delegated.roadmap, null);

  // User selects "Cloud-native SaaS & Web Products"
  const r2_domainSelected = await orchestrator.answerQuestion(
    "target_domain",
    "saas_web_products",
    t2_id
  );

  console.log("  [Trace 2 - Domain Selected]", {
    declared_goal: r2_domainSelected.profile.declaredTargetRole,
    target_domain: r2_domainSelected.profile.facts.find(f => f.dimension === "target_domain")?.rawValue,
    missingMaterialDimensions: r2_domainSelected.decision.missingMaterialDimensions,
    activeQuestion: r2_domainSelected.decision.activeQuestion?.selectedQuestion?.dimension,
    roadmap: r2_domainSelected.roadmap ? "created" : null,
  });

  // Invariant 10: Selecting domain does NOT resolve primary_language
  assert.ok(r2_domainSelected.decision.missingMaterialDimensions.includes("primary_language"));
  assert.ok(!r2_domainSelected.decision.missingMaterialDimensions.includes("target_domain"));
  assert.equal(r2_domainSelected.decision.activeQuestion?.selectedQuestion?.dimension, "primary_language");

  // User selects TypeScript
  const r2_lang = await orchestrator.answerQuestion(
    "primary_language",
    "typescript",
    t2_id
  );

  assert.ok(r2_lang.decision.missingMaterialDimensions.includes("architecture_preference"));
  assert.equal(r2_lang.decision.activeQuestion?.selectedQuestion?.dimension, "architecture_preference");

  // User selects microservices architecture
  const r2_locked = await orchestrator.answerQuestion(
    "architecture_preference",
    "microservices",
    t2_id
  );

  console.log("  [Trace 2 - Fully Locked]", {
    declared_goal: r2_locked.profile.declaredTargetRole,
    eligibility: r2_locked.decision.eligibility,
    selectedPathId: r2_locked.decision.selectedPathId,
    curriculumSource: r2_locked.decision.curriculumSource,
    roadmapMilestones: r2_locked.roadmap?.milestones.length,
  });

  assert.equal(r2_locked.decision.eligibility, "eligible");
  assert.equal(r2_locked.decision.selectedPathId, "backend_web_product_node");
  assert.equal(r2_locked.decision.curriculumSource, "catalog");
  assert.ok(r2_locked.roadmap !== null);

  // ============================================================================
  // TEST 3: UNCATALOGUED GOAL ("ML Engineer") -> CLARIFICATION -> DISCOVERY -> VERIFICATION
  // ============================================================================
  console.log("\nTest 3: Uncatalogued Goal ('ML Engineer') -> Clarification -> Discovery -> 10-Gate Verification -> Constructed Roadmap...");
  const t3_id = "test_discovery_trace_3";
  const r3_intake = await orchestrator.handleIntake(
    { message: "I want to become an ML Engineer" },
    t3_id
  );

  console.log("  [Trace 3 - Intake]", {
    declared_goal: r3_intake.profile.declaredTargetRole,
    missingMaterialDimensions: r3_intake.decision.missingMaterialDimensions,
    eligibility: r3_intake.decision.eligibility,
    activeQuestion: r3_intake.decision.activeQuestion?.selectedQuestion?.dimension,
    roadmap: r3_intake.roadmap ? "created" : null,
  });

  // Invariant 1: No catalog match != unsupported intent!
  assert.equal(r3_intake.profile.declaredTargetRole, "ML Engineer");
  assert.equal(r3_intake.decision.eligibility, "material_uncertainty");
  assert.equal(r3_intake.decision.selectedPathId, null);
  assert.equal(r3_intake.roadmap, null);
  assert.ok(r3_intake.decision.missingMaterialDimensions.length > 0);

  // Answer target_domain
  const r3_domain = await orchestrator.answerQuestion(
    "target_domain",
    "NLP & Large Language Models (Fine-Tuning, LoRA & RAG)",
    t3_id
  );

  console.log("  [Trace 3 - Domain Answered]", {
    declared_goal: r3_domain.profile.declaredTargetRole,
    target_domain: r3_domain.profile.facts.find(f => f.dimension === "target_domain")?.rawValue,
    missingMaterialDimensions: r3_domain.decision.missingMaterialDimensions,
    activeQuestion: r3_domain.decision.activeQuestion?.selectedQuestion?.dimension,
  });

  assert.ok(r3_domain.decision.missingMaterialDimensions.includes("primary_language"));
  assert.equal(r3_domain.decision.activeQuestion?.selectedQuestion?.dimension, "primary_language");

  // Answer primary_language -> all material dimensions resolved -> triggers Discovery & 10-gate verification!
  const r3_final = await orchestrator.answerQuestion(
    "primary_language",
    "Python (PyTorch, Hugging Face, Scikit-Learn)",
    t3_id
  );

  console.log("  [Trace 3 - Discovery & Verified Snapshot]", {
    declared_goal: r3_final.profile.declaredTargetRole,
    eligibility: r3_final.decision.eligibility,
    selectedPathId: r3_final.decision.selectedPathId,
    curriculumSource: r3_final.decision.curriculumSource,
    curriculumId: r3_final.decision.curriculumId,
    roadmapMilestones: r3_final.roadmap?.milestones.map(m => m.title),
  });

  // Invariant 11, 12, 13: Intent resolved -> LLM discovery -> 10 gates passed -> constructed roadmap!
  assert.equal(r3_final.decision.eligibility, "eligible");
  assert.equal(r3_final.decision.selectedPathId, null);
  assert.equal(r3_final.decision.curriculumSource, "constructed");
  assert.ok(r3_final.decision.curriculumId !== null);
  assert.ok(r3_final.roadmap !== null);
  assert.strictEqual(r3_final.roadmap.milestones.length, 1);
  assert.ok(r3_final.roadmap.milestones.some(m => m.title.toLowerCase().includes("pytorch") || m.title.toLowerCase().includes("math") || m.title.toLowerCase().includes("ml") || m.title.toLowerCase().includes("phase 1")));

  // ============================================================================
  // TEST 4: UNCATALOGUED GOAL ("Data Scientist")
  // ============================================================================
  console.log("\nTest 4: Uncatalogued Goal ('Data Scientist') completes discovery pipeline...");
  const t4_id = "test_discovery_trace_4";
  await orchestrator.handleIntake({ message: "I want to become a Data Scientist" }, t4_id);
  await orchestrator.answerQuestion("target_domain", "Modern Data Stack & Analytics Engineering", t4_id);
  const r4_final = await orchestrator.answerQuestion("primary_language", "Python", t4_id);

  console.log("  [Trace 4 - Data Scientist]", {
    declared_goal: r4_final.profile.declaredTargetRole,
    eligibility: r4_final.decision.eligibility,
    curriculumSource: r4_final.decision.curriculumSource,
    roadmapMilestones: r4_final.roadmap?.milestones.map(m => m.title),
  });

  assert.equal(r4_final.decision.eligibility, "eligible");
  assert.equal(r4_final.decision.curriculumSource, "constructed");
  assert.ok(r4_final.roadmap !== null);

  // ============================================================================
  // TEST 5: UNCATALOGUED GOAL ("Robotics Engineer")
  // ============================================================================
  console.log("\nTest 5: Uncatalogued Goal ('Robotics Engineer') completes discovery pipeline...");
  const t5_id = "test_discovery_trace_5";
  await orchestrator.handleIntake({ message: "I want to become a Robotics Engineer" }, t5_id);
  await orchestrator.answerQuestion("target_domain", "Autonomous Navigation & ROS 2", t5_id);
  const r5_final = await orchestrator.answerQuestion("primary_language", "C++", t5_id);

  console.log("  [Trace 5 - Robotics Engineer]", {
    declared_goal: r5_final.profile.declaredTargetRole,
    eligibility: r5_final.decision.eligibility,
    curriculumSource: r5_final.decision.curriculumSource,
    roadmapMilestones: r5_final.roadmap?.milestones.map(m => m.title),
  });

  assert.equal(r5_final.decision.eligibility, "eligible");
  assert.equal(r5_final.decision.curriculumSource, "constructed");
  assert.ok(r5_final.roadmap !== null);

  // ==========================================
  // TEST 6: UNCATALOGUED GOAL ("Mobile App Developer") -> DISCOVERY PIPELINE
  // ==========================================
  console.log("\nTest 6: Uncatalogued Goal ('Mobile App Developer') -> Discovery Pipeline...");
  const t6_id = "test_discovery_trace_6";
  await orchestrator.handleIntake({ message: "I want to become a Mobile App Developer" }, t6_id);
  await orchestrator.answerQuestion("target_domain", "Native Android Engineering (Kotlin & Jetpack Compose)", t6_id);
  const r6_final = await orchestrator.answerQuestion("primary_language", "Kotlin (Modern Android Development)", t6_id);

  console.log("  [Trace 6 - Mobile Track]", {
    declared_goal: r6_final.profile.declaredTargetRole,
    curriculumSource: r6_final.decision.curriculumSource,
    roadmapMilestones: r6_final.roadmap?.milestones.map(m => m.title),
  });

  assert.equal(r6_final.decision.eligibility, "eligible");
  assert.equal(r6_final.decision.curriculumSource, "constructed");
  assert.ok(r6_final.roadmap !== null);
  assert.strictEqual(r6_final.roadmap.milestones.length, 1);

  // ============================================================================
  // TEST 7: GENUINELY UNSUPPORTED / NONSENSICAL INTENT REJECTION
  // ============================================================================
  console.log("\nTest 7: Genuinely Unsupported Intent ('become a unicorn wizard') is Rejected by Capability Assessment...");
  const t7_id = "test_discovery_trace_7";
  const r7 = await orchestrator.handleIntake({ message: "I want to become a unicorn wizard" }, t7_id);

  console.log("  [Trace 7 - Unsupported Intent]", {
    eligibility: r7.decision.eligibility,
    explanation: r7.decision.explanation,
    roadmap: r7.roadmap,
  });

  assert.equal(r7.decision.eligibility, "unsupported_intent");
  assert.equal(r7.roadmap, null);
  assert.ok(r7.decision.explanation.includes("cannot be structured"));

  // ============================================================================
  // TEST 8: DIAGNOSTIC FAILURE CODE CLASSIFICATION
  // ============================================================================
  console.log("\nTest 8: Diagnostic Error Codes in CurriculumDiscoveryService...");
  const discoveryService = new CurriculumDiscoveryService(curriculumVerifier);

  const errorAdapter = {
    proposeCurriculum: async () => {
      throw new Error("Groq API 503 Overloaded");
    },
    getLastExecutionMetadata: () => ({
      provider: "groq" as const,
      modelName: "openai/gpt-oss-120b",
      fallbackUsed: false,
      failureCategory: "provider_error" as const,
      latencyMs: 100,
      requestId: "req_err",
    }),
  };

  const errRes = await discoveryService.discoverAndVerifyCurriculum(
    { targetRole: "Quantum DevOps Wizard" },
    errorAdapter as any
  );

  assert.equal(errRes.status, "provider_error");
  assert.equal(errRes.failureCode, "DISCOVERY_API_FAILURE");

  const truncAdapter = {
    proposeCurriculum: async () => null,
    getLastExecutionMetadata: () => ({
      provider: "groq" as const,
      modelName: "openai/gpt-oss-120b",
      fallbackUsed: false,
      failureCategory: "generation_truncated" as const,
      latencyMs: 2500,
      requestId: "req_trunc",
    }),
  };

  const truncRes = await discoveryService.discoverAndVerifyCurriculum(
    { targetRole: "Robotics Engineer" },
    truncAdapter as any
  );

  assert.equal(truncRes.status, "generation_truncated");
  assert.equal(truncRes.failureCode, "DISCOVERY_TOKEN_LIMIT");

  console.log("\n================================================================================");
  console.log("ALL 8 UNCATALOGUED CURRICULUM DISCOVERY & INVARIANT TESTS PASSED PERFECTLY!");
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
