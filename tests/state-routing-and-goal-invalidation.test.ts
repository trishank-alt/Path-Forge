import { orchestrator } from "../src/lib/application/orchestrator";
import { strict as assert } from "assert";

async function runTests() {
  console.log("================================================================================");
  console.log("RUNNING STATE ROUTING, INPUT VALIDATION & GOAL INVALIDATION REGRESSION TESTS");
  console.log("================================================================================");

  // ============================================================================
  // TEST 1: EXACT MULTI-STEP REPRODUCTION SCENARIO (Steps 1-7)
  // ============================================================================
  console.log("\nTest 1: Exact Reproduction Scenario (Software Engineer -> Not sure -> Mobile App Developer -> reject/confirm -> Kotlin)...");

  // Step 1: User says "I want to become a Software Engineer"
  const r1 = await orchestrator.handleIntake(
    { message: "I want to become a Software Engineer" },
    "test_state_routing_1"
  );
  console.log("  [Step 1]", {
    declared_goal: r1.profile.declaredTargetRole,
    activeQuestion: r1.decision.activeQuestion?.selectedQuestion?.dimension,
    missingMaterialDimensions: r1.decision.missingMaterialDimensions,
    eligibility: r1.decision.eligibility,
  });
  assert.equal(r1.profile.declaredTargetRole, "Software Engineer");
  assert.equal(r1.decision.activeQuestion?.selectedQuestion?.dimension, "target_domain");
  assert.equal(r1.decision.eligibility, "material_uncertainty");

  // Step 2: User answers "Not sure yet / Open to suggestions"
  const r2 = await orchestrator.answerQuestion(
    "target_domain",
    "Not sure yet / Open to suggestions",
    "test_state_routing_1"
  );
  console.log("  [Step 2]", {
    declared_goal: r2.profile.declaredTargetRole,
    recommendationDimension: r2.decision.recommendation?.dimension,
    missingMaterialDimensions: r2.decision.missingMaterialDimensions,
    activeFacts: r2.profile.facts.filter(f => f.status === "active").map(f => `${f.dimension}=${f.rawValue}`),
  });
  assert.equal(r2.profile.declaredTargetRole, "Software Engineer");
  assert.equal(r2.decision.recommendation?.dimension, "target_domain");
  assert.ok(r2.decision.recommendation.options.length > 0);

  // Step 3: User types "Mobile App Developer" into textbox while in recommendation mode
  const r3 = await orchestrator.handleIntake(
    { message: "Mobile App Developer" },
    "test_state_routing_1"
  );
  console.log("  [Step 3]", {
    declared_goal: r3.profile.declaredTargetRole,
    activeQuestion: r3.decision.activeQuestion?.selectedQuestion?.dimension,
    pendingGoalChange: r3.decision.pendingGoalChange,
    activeFacts: r3.profile.facts.filter(f => f.status === "active").map(f => `${f.dimension}=${f.rawValue}`),
  });
  // Hard invariant: declared_goal must STILL be Software Engineer!
  assert.equal(r3.profile.declaredTargetRole, "Software Engineer");
  assert.equal(r3.decision.activeQuestion?.selectedQuestion?.dimension, "confirm_goal_change");
  assert.equal(r3.decision.pendingGoalChange?.proposedGoal, "Mobile App Developer");
  assert.equal(r3.decision.pendingGoalChange?.currentGoal, "Software Engineer");

  // Step 4: User rejects goal change
  const r4 = await orchestrator.answerQuestion(
    "confirm_goal_change",
    "No, keep Software Engineer",
    "test_state_routing_1"
  );
  console.log("  [Step 4]", {
    declared_goal: r4.profile.declaredTargetRole,
    recommendationDimension: r4.decision.recommendation?.dimension,
    activeFacts: r4.profile.facts.filter(f => f.status === "active").map(f => `${f.dimension}=${f.rawValue}`),
  });
  assert.equal(r4.profile.declaredTargetRole, "Software Engineer");
  assert.equal(r4.decision.recommendation?.dimension, "target_domain");

  // Step 5: User again submits "Mobile App Developer" and confirms goal change
  const r5_proposal = await orchestrator.handleIntake(
    { message: "Mobile App Developer" },
    "test_state_routing_1"
  );
  assert.equal(r5_proposal.decision.activeQuestion?.selectedQuestion?.dimension, "confirm_goal_change");

  const r5_confirm = await orchestrator.answerQuestion(
    "confirm_goal_change",
    "Yes, change my goal to Mobile App Developer",
    "test_state_routing_1"
  );
  console.log("  [Step 5]", {
    declared_goal: r5_confirm.profile.declaredTargetRole,
    activeFacts: r5_confirm.profile.facts.filter(f => f.status === "active").map(f => `${f.dimension}=${f.rawValue}`),
    missingMaterialDimensions: r5_confirm.decision.missingMaterialDimensions,
    eligibility: r5_confirm.decision.eligibility,
  });
  assert.equal(r5_confirm.profile.declaredTargetRole, "Mobile App Developer");
  // Verify that previous Software Engineer domain facts and recommendations are cleared
  const activeDimsR5 = r5_confirm.profile.facts.filter(f => f.status === "active").map(f => f.dimension);
  assert.ok(!activeDimsR5.includes("target_domain"), "Old Software Engineer target_domain must be cleared");
  assert.equal(r5_confirm.profile.selectedPathId, null);
  assert.equal(r5_confirm.profile.activeRoadmapId, null);

  // Step 6 & 7: User selects language "Kotlin"
  const r6 = await orchestrator.answerQuestion(
    "primary_language",
    "Kotlin",
    "test_state_routing_1"
  );
  console.log("  [Step 6/7]", {
    declared_goal: r6.profile.declaredTargetRole,
    primary_language: r6.profile.facts.find(f => f.dimension === "primary_language" && f.status === "active")?.rawValue,
    activeFacts: r6.profile.facts.filter(f => f.status === "active").map(f => `${f.dimension}=${f.rawValue}`),
  });
  assert.equal(r6.profile.declaredTargetRole, "Mobile App Developer");
  const langFact = r6.profile.facts.find(f => f.dimension === "primary_language" && f.status === "active");
  assert.ok(langFact, "primary_language fact must exist");
  assert.equal(langFact.rawValue, "Kotlin");
  // target_domain must NOT be overwritten by Kotlin
  const domainFact = r6.profile.facts.find(f => f.dimension === "target_domain" && f.status === "active");
  assert.ok(!domainFact || domainFact.rawValue !== "Kotlin");

  console.log("  [PASS] Test 1: Full multi-step exact reproduction scenario passed.");

  // ============================================================================
  // TEST 2: SECOND REGRESSION (Software Engineer + high_performance_systems + Kotlin)
  // ============================================================================
  console.log("\nTest 2: Second Regression (Software Engineer + high_performance_systems + Kotlin)...");

  await orchestrator.handleIntake({ message: "I want to be a Software Engineer" }, "test_state_routing_2");
  await orchestrator.answerQuestion("target_domain", "high_performance_systems", "test_state_routing_2");
  const r2_final = await orchestrator.answerQuestion("primary_language", "Kotlin", "test_state_routing_2");

  const r2_facts = r2_final.profile.facts.filter(f => f.status === "active");
  console.log("  [Result 2]", {
    declared_goal: r2_final.profile.declaredTargetRole,
    facts: r2_facts.map(f => `${f.dimension}=${f.rawValue}`),
  });

  assert.equal(r2_final.profile.declaredTargetRole, "Software Engineer");
  const r2_domain = r2_facts.find(f => f.dimension === "target_domain");
  const r2_lang = r2_facts.find(f => f.dimension === "primary_language");
  assert.ok(r2_domain && String(r2_domain.normalizedValue).includes("systems"));
  assert.ok(r2_lang && r2_lang.rawValue === "Kotlin");
  // Must NOT convert declared_goal to Mobile App Developer simply because Kotlin was selected
  assert.equal(r2_final.profile.declaredTargetRole, "Software Engineer");

  console.log("  [PASS] Test 2: Software Engineer with systems domain and Kotlin language preserved correctly.");

  // ============================================================================
  // TEST 3: THIRD REGRESSION (Software Engineer + target_domain recommendation -> user types "Gaming")
  // ============================================================================
  console.log("\nTest 3: Third Regression (Software Engineer + recommendation -> types 'Gaming')...");

  await orchestrator.handleIntake({ message: "I want to become a Software Engineer" }, "test_state_routing_3");
  await orchestrator.answerQuestion("target_domain", "Not sure yet", "test_state_routing_3");
  const r3_game = await orchestrator.handleIntake({ message: "Gaming" }, "test_state_routing_3");

  const r3_facts = r3_game.profile.facts.filter(f => f.status === "active");
  console.log("  [Result 3]", {
    declared_goal: r3_game.profile.declaredTargetRole,
    facts: r3_facts.map(f => `${f.dimension}=${f.rawValue}`),
    missingMaterialDimensions: r3_game.decision.missingMaterialDimensions,
  });

  assert.equal(r3_game.profile.declaredTargetRole, "Software Engineer");
  const r3_domain = r3_facts.find(f => f.dimension === "target_domain");
  assert.ok(r3_domain, "target_domain fact must exist");
  assert.equal(r3_domain.rawValue, "Gaming");

  console.log("  [PASS] Test 3: Free-text 'Gaming' routed to target_domain under Software Engineer.");

  // ============================================================================
  // TEST 4: FOURTH REGRESSION (Explicit goal change: "Actually, I want to become a Mobile App Developer.")
  // ============================================================================
  console.log("\nTest 4: Fourth Regression (Explicit goal change: 'Actually, I want to become a Mobile App Developer.')...");

  await orchestrator.handleIntake({ message: "I want to become a Software Engineer" }, "test_state_routing_4");
  const r4_switch = await orchestrator.handleIntake(
    { message: "Actually, I want to become a Mobile App Developer." },
    "test_state_routing_4"
  );

  console.log("  [Result 4]", {
    declared_goal: r4_switch.profile.declaredTargetRole,
    activeFacts: r4_switch.profile.facts.filter(f => f.status === "active").map(f => `${f.dimension}=${f.rawValue}`),
  });

  assert.equal(r4_switch.profile.declaredTargetRole, "Mobile App Developer");
  const r4_domain = r4_switch.profile.facts.find(f => f.dimension === "target_domain" && f.status === "active");
  assert.equal(r4_domain, undefined, "Explicit goal change must not store goal as target_domain");

  console.log("  [PASS] Test 4: Explicit goal change cleanly updated goal without domain pollution.");

  // ============================================================================
  // TEST 5: HARD FACT MUTATION INVARIANT
  // ============================================================================
  console.log("\nTest 5: Hard Fact Mutation Invariant...");

  await orchestrator.handleIntake({ message: "I want to be a Software Engineer" }, "test_state_routing_5");
  const preFacts = await orchestrator.getProfile("test_state_routing_5");
  const preGoal = preFacts.declaredTargetRole;

  await orchestrator.answerQuestion("target_domain", "high_performance_systems", "test_state_routing_5");
  const postDomainProfile = await orchestrator.getProfile("test_state_routing_5");
  assert.equal(postDomainProfile.declaredTargetRole, preGoal, "answerQuestion(target_domain) must NOT mutate declaredTargetRole");

  await orchestrator.answerQuestion("primary_language", "Kotlin", "test_state_routing_5");
  const postLangProfile = await orchestrator.getProfile("test_state_routing_5");
  assert.equal(postLangProfile.declaredTargetRole, preGoal, "answerQuestion(primary_language) must NOT mutate declaredTargetRole");
  const postLangDomain = postLangProfile.facts.find(f => f.dimension === "target_domain" && f.status === "active");
  assert.ok(postLangDomain && String(postLangDomain.normalizedValue).includes("systems"), "target_domain must remain intact");

  console.log("  [PASS] Test 5: Hard Fact Mutation Invariant strictly holds.");

  console.log("\n================================================================================");
  console.log("ALL STATE ROUTING & GOAL INVALIDATION REGRESSION TESTS PASSED (5/5)!");
  console.log("================================================================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
