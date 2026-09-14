import { describe, it } from "node:test";
import assert from "node:assert";
import { orchestrator } from "../src/lib/application/orchestrator";
import { pathCompatibilityGate, isNonCommittalAnswer } from "../src/lib/domain/intent/path-compatibility-gate";
import { recommendationEngine, CatalogExplorationProvider } from "../src/lib/domain/intent/recommendation-engine";
import { SEEDED_PATHS } from "../src/lib/persistence/seed-data";
import { ProfileFact } from "../src/lib/contracts";

describe("Exploration Catalogue & Recommendation Mode Test Suite (Tests A - T)", () => {
  // Test A & B: Non-committal answer semantics & PathCompatibilityGate preservation
  it("Test A, B: 'Not sure yet' / 'Open to suggestions' does not create hard conflicts or reduce eligiblePaths to 0", () => {
    const activeFacts: ProfileFact[] = [
      {
        id: "f1",
        dimension: "declared_goal",
        normalizedValue: "backend_engineering",
        rawValue: "I want to become a Backend Engineer",
        source: "llm_inference",
        evidence: "Stated backend engineering",
        reliability: 0.95,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "f2",
        dimension: "target_domain",
        normalizedValue: "delegated_to_system",
        rawValue: "Not sure yet / Open to suggestions",
        source: "user_answer",
        evidence: "User answered: Not sure yet / Open to suggestions",
        reliability: 0.98,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    assert.strictEqual(isNonCommittalAnswer("Not sure yet / Open to suggestions"), true);
    assert.strictEqual(isNonCommittalAnswer("I don't know"), true);
    assert.strictEqual(isNonCommittalAnswer("Whatever is best"), true);
    assert.strictEqual(isNonCommittalAnswer("FinTech"), false);

    const compatEval = pathCompatibilityGate.evaluateIntentCompatibility(activeFacts, SEEDED_PATHS);

    // Must preserve all 3 catalog backend paths
    assert.strictEqual(compatEval.eligiblePaths.length, 3);
    assert.strictEqual(compatEval.isIntentSupported, true);
    assert.strictEqual(compatEval.isCatalogMatch, true);

    const eligibleIds = compatEval.eligiblePaths.map((p) => p.id);
    assert.ok(eligibleIds.includes("backend_enterprise_java"));
    assert.ok(eligibleIds.includes("backend_web_product_node"));
    assert.ok(eligibleIds.includes("backend_python_cloud"));
  });

  // Test C & D: Backend Engineer + delegated domain enters recommendation mode with rich catalog derived options
  it("Test C, D: Backend Engineer with delegated domain enters recommendationMode 'domain_selection' with rich options", async () => {
    const learnerId = `test_rec_${Date.now()}`;

    // Step 1: Intake
    const intakeRes = await orchestrator.handleIntake(
      {
        message: "I want to become a Backend Engineer",
        modelProvider: "deterministic",
      },
      learnerId
    );

    assert.strictEqual(intakeRes.decision.eligibility, "material_uncertainty");
    assert.strictEqual(intakeRes.roadmap, null);
    assert.strictEqual(intakeRes.decision.selectedPathId, null);

    // Step 2: Answer question with "Not sure yet / Open to suggestions"
    const ansRes = await orchestrator.answerQuestion(
      "target_domain",
      "Not sure yet / Open to suggestions",
      learnerId,
      { provider: "deterministic" }
    );

    // Recommendation Mode Assertions
    assert.strictEqual(ansRes.decision.eligibility, "material_uncertainty");
    assert.strictEqual(ansRes.roadmap, null);
    assert.strictEqual(ansRes.decision.selectedPathId, null);
    assert.ok(ansRes.decision.recommendation !== null && ansRes.decision.recommendation !== undefined);
    assert.strictEqual(ansRes.decision.recommendation.mode, "domain_selection");
    assert.strictEqual(ansRes.decision.recommendation.dimension, "target_domain");

    // Dynamic catalog options check (more than original 3-4 options)
    const options = ansRes.decision.recommendation.options;
    assert.ok(options.length >= 5, `Must expose multiple catalog-derived domains, got ${options.length}`);

    const optionIds = options.map((o) => o.id);
    assert.ok(optionIds.includes("saas_web_products"));
    assert.ok(optionIds.includes("cloud_data_services"));
    assert.ok(optionIds.includes("enterprise_erp"));
    assert.ok(optionIds.includes("fintech_banking"));
    assert.ok(optionIds.includes("distributed_event_systems"));

    // Options must be categorized into High Demand, Strong Options, Supported Tracks
    const categories = new Set(options.map((o) => o.category));
    assert.ok(categories.has("high_demand"));
    assert.ok(categories.has("strong_option"));
  });

  // Test E: Backend Engineer + delegated primary_language enters technology recommendation mode
  it("Test E: Backend Engineer + delegated primary_language enters technology_selection recommendation mode", async () => {
    const learnerId = `test_be_lang_rec_${Date.now()}`;

    await orchestrator.handleIntake(
      {
        message: "I want to become a Backend Engineer",
        modelProvider: "deterministic",
      },
      learnerId
    );

    const res = await orchestrator.answerQuestion(
      "primary_language",
      "I don't know which language to choose",
      learnerId,
      { provider: "deterministic" }
    );

    assert.strictEqual(res.decision.eligibility, "material_uncertainty");
    assert.strictEqual(res.roadmap, null);
    assert.ok(res.decision.recommendation);
    assert.strictEqual(res.decision.recommendation!.mode, "technology_selection");
    assert.strictEqual(res.decision.recommendation!.dimension, "primary_language");

    const optionIds = res.decision.recommendation!.options.map((o) => o.id);
    assert.ok(optionIds.includes("typescript_node"));
    assert.ok(optionIds.includes("python_fastapi"));
    assert.ok(optionIds.includes("java_spring"));
    assert.strictEqual(res.decision.activeQuestion, null);
  });

  // Test F: Delegated primary_language never causes target_domain question while primary_language is unresolved
  it("Test F: Delegated primary_language never causes target_domain question", async () => {
    const learnerId = `test_be_lang_no_domain_${Date.now()}`;

    await orchestrator.handleIntake(
      {
        message: "I want to become a Backend Engineer",
        modelProvider: "deterministic",
      },
      learnerId
    );

    const res = await orchestrator.answerQuestion(
      "primary_language",
      "Not sure yet / Open to suggestions",
      learnerId,
      { provider: "deterministic" }
    );

    // Must remain on primary_language, NEVER jump to target_domain
    if (res.decision.recommendation) {
      assert.strictEqual(res.decision.recommendation.dimension, "primary_language");
    }
    if (res.decision.activeQuestion) {
      assert.strictEqual(res.decision.activeQuestion.selectedQuestion.dimension, "primary_language");
    }
  });

  // Test G: DevOps + delegated primary_language returns language/toolchain options
  it("Test G: DevOps + delegated primary_language returns language/toolchain options", async () => {
    const learnerId = `test_devops_lang_${Date.now()}`;

    await orchestrator.handleIntake(
      {
        message: "I want to become a DevOps & Cloud Platform Infrastructure Engineer.",
        modelProvider: "deterministic",
      },
      learnerId
    );

    const res = await orchestrator.answerQuestion(
      "primary_language",
      "Open to suggestions",
      learnerId,
      { provider: "deterministic" }
    );

    assert.strictEqual(res.decision.eligibility, "material_uncertainty");
    assert.strictEqual(res.roadmap, null);
    assert.ok(res.decision.recommendation);
    assert.strictEqual(res.decision.recommendation!.mode, "technology_selection");
    assert.strictEqual(res.decision.recommendation!.dimension, "primary_language");

    const optionIds = res.decision.recommendation!.options.map((o) => o.id);
    assert.ok(optionIds.includes("python_automation"));
    assert.ok(optionIds.includes("golang_cloud_native"));
    assert.ok(optionIds.includes("bash_shell_scripting"));
    assert.strictEqual(res.decision.activeQuestion, null);
  });

  // Test H: Cybersecurity + delegated primary_language returns meaningful options
  it("Test H: Cybersecurity + delegated primary_language returns meaningful options", async () => {
    const learnerId = `test_sec_lang_${Date.now()}`;

    await orchestrator.handleIntake(
      {
        message: "I want to become a Cybersecurity Threat Defense Analyst.",
        modelProvider: "deterministic",
      },
      learnerId
    );

    const res = await orchestrator.answerQuestion(
      "primary_language",
      "Not sure yet",
      learnerId,
      { provider: "deterministic" }
    );

    assert.strictEqual(res.decision.eligibility, "material_uncertainty");
    assert.strictEqual(res.roadmap, null);
    assert.ok(res.decision.recommendation);
    assert.strictEqual(res.decision.recommendation!.mode, "technology_selection");
    assert.strictEqual(res.decision.recommendation!.dimension, "primary_language");

    const optionIds = res.decision.recommendation!.options.map((o) => o.id);
    assert.ok(optionIds.includes("python_security"));
    assert.ok(optionIds.includes("cpp_security"));
    assert.ok(optionIds.includes("bash_powershell_security"));
  });

  // Test I: Selecting a recommendation exits recommendation mode and resumes normal deterministic flow
  it("Test I: Selecting a recommendation exits recommendation mode and proceeds to roadmap generation", async () => {
    const learnerId = `test_exit_rec_${Date.now()}`;

    // Step 1: Intake
    await orchestrator.handleIntake(
      {
        message: "I want to become a Backend Engineer",
        modelProvider: "deterministic",
      },
      learnerId
    );

    // Step 2: Delegate domain
    const recRes = await orchestrator.answerQuestion(
      "target_domain",
      "Not sure yet / Open to suggestions",
      learnerId,
      { provider: "deterministic" }
    );
    assert.ok(recRes.decision.recommendation !== null);

    // Step 3: Select recommended domain "saas_web_products"
    const domainSelectRes = await orchestrator.answerQuestion(
      "target_domain",
      "saas_web_products",
      learnerId,
      { provider: "deterministic" }
    );

    // Recommendation mode is exited
    assert.strictEqual(domainSelectRes.decision.recommendation, null);

    // Step 4: Supply primary language "TypeScript"
    await orchestrator.answerQuestion(
      "primary_language",
      "TypeScript",
      learnerId,
      { provider: "deterministic" }
    );

    // Step 5: Supply architecture preference
    await orchestrator.answerQuestion(
      "architecture_preference",
      "Microservices & REST APIs",
      learnerId,
      { provider: "deterministic" }
    );

    // Step 6: Complete required hours_per_week
    const finalRes = await orchestrator.answerQuestion(
      "hours_per_week",
      "10 hours/week",
      learnerId,
      { provider: "deterministic" }
    );

    // Now locks backend_web_product_node and generates roadmap!
    assert.strictEqual(finalRes.decision.eligibility, "eligible");
    assert.strictEqual(finalRes.decision.selectedPathId, "backend_web_product_node");
    assert.ok(finalRes.roadmap !== null);
    assert.ok(finalRes.roadmap.milestones.length > 0);
  });

  // Test J: Backend + TypeScript reaches expected catalog roadmap
  it("Test J: Backend + TypeScript reaches expected catalog roadmap", async () => {
    const learnerId = `test_ts_catalog_${Date.now()}`;

    await orchestrator.handleIntake(
      {
        message: "I want to become a Backend Engineer using TypeScript for SaaS products",
        modelProvider: "deterministic",
      },
      learnerId
    );

    await orchestrator.answerQuestion(
      "architecture_preference",
      "Microservices & REST APIs",
      learnerId,
      { provider: "deterministic" }
    );

    const res = await orchestrator.answerQuestion(
      "hours_per_week",
      "10 hours/week",
      learnerId,
      { provider: "deterministic" }
    );

    assert.strictEqual(res.decision.eligibility, "eligible");
    assert.strictEqual(res.decision.curriculumSource, "catalog");
    assert.strictEqual(res.decision.selectedPathId, "backend_web_product_node");
    assert.ok(res.roadmap !== null);
  });

  // Test K: Backend + Python reaches expected catalog roadmap
  it("Test K: Backend + Python reaches expected catalog roadmap", async () => {
    const learnerId = `test_py_catalog_${Date.now()}`;

    await orchestrator.handleIntake(
      {
        message: "I want to become a Backend Cloud Developer using Python and FastAPI",
        modelProvider: "deterministic",
      },
      learnerId
    );

    await orchestrator.answerQuestion(
      "architecture_preference",
      "Microservices & Asynchronous Queues",
      learnerId,
      { provider: "deterministic" }
    );

    const res = await orchestrator.answerQuestion(
      "hours_per_week",
      "10 hours/week",
      learnerId,
      { provider: "deterministic" }
    );

    assert.strictEqual(res.decision.eligibility, "eligible");
    assert.strictEqual(res.decision.curriculumSource, "catalog");
    assert.strictEqual(res.decision.selectedPathId, "backend_python_cloud");
    assert.ok(res.roadmap !== null);
  });

  // Test L, M, S: Mechanical Engineer uncatalogued career creates constructed curriculum with selectedPathId=null
  it("Test L, M, S: Mechanical Engineer uncatalogued career creates constructed curriculum with selectedPathId=null", async () => {
    const learnerId = `test_mech_eng_${Date.now()}`;

    const res = await orchestrator.handleIntake(
      {
        message: "I want to become a Mechanical Engineer specializing in Autonomous Robotics using ROS 2 and kinematics.",
        modelProvider: "deterministic",
      },
      learnerId
    );

    assert.strictEqual(res.decision.eligibility, "eligible");
    assert.strictEqual(res.decision.curriculumSource, "constructed");
    assert.strictEqual(res.decision.selectedPathId, null);
    assert.ok(res.decision.curriculumId!.startsWith("constructed:"));
    assert.ok(res.roadmap !== null);
    assert.strictEqual(res.roadmap.targetPathId, null);
    assert.ok(res.roadmap.milestones.length > 0);
  });

  // Test N & O: Failed verification or unsupported niche produces unsupported_intent
  it("Test N, O: Nonsensical niche career produces unsupported_intent with roadmap=null and preserved role", async () => {
    const learnerId = `test_sonar_diver_${Date.now()}`;

    const res = await orchestrator.handleIntake(
      {
        message: "I want to study underwater marine archaeology sonar mapping algorithms.",
        modelProvider: "deterministic",
      },
      learnerId
    );

    assert.strictEqual(res.decision.eligibility, "unsupported_intent");
    assert.strictEqual(res.roadmap, null);
    assert.strictEqual(res.decision.selectedPathId, null);
    assert.ok(
      res.decision.explanation.includes("could not generate a curriculum proposal") ||
      res.decision.explanation.includes("cannot currently establish a verified curriculum") ||
      res.decision.explanation.includes("cannot be structured") ||
      res.decision.explanation.includes("not recognized")
    );
  });

  // Test P: Roadmap is null unless decision.eligibility === 'eligible'
  it("Test P: Infeasible constraints evaluate to eligibility='infeasible' with roadmap=null", async () => {
    const learnerId = `test_infeasible_${Date.now()}`;

    await orchestrator.handleIntake(
      {
        message: "I want to become an Enterprise Java Architect",
        modelProvider: "deterministic",
      },
      learnerId
    );

    await orchestrator.answerQuestion("target_domain", "enterprise_erp", learnerId, { provider: "deterministic" });
    await orchestrator.answerQuestion("primary_language", "java", learnerId, { provider: "deterministic" });
    await orchestrator.answerQuestion("architecture_preference", "modular_monolith", learnerId, { provider: "deterministic" });
    await orchestrator.answerQuestion("deadline_months", "1 month", learnerId, { provider: "deterministic" });
    const res = await orchestrator.answerQuestion("hours_per_week", "2 hours/week", learnerId, { provider: "deterministic" });

    assert.strictEqual(res.decision.eligibility, "infeasible");
    assert.strictEqual(res.roadmap, null);
    assert.ok(res.decision.feasibility !== null);
    assert.strictEqual(res.decision.feasibility.status, "infeasible");
  });

  // Test Q: Recommendation decision structure invariant
  it("Test Q: Recommendation decision structure invariant", async () => {
    const learnerId = `test_rec_inv_${Date.now()}`;

    await orchestrator.handleIntake(
      { message: "I want to become a Backend Engineer", modelProvider: "deterministic" },
      learnerId
    );

    const res = await orchestrator.answerQuestion(
      "target_domain",
      "Not sure yet / Open to suggestions",
      learnerId,
      { provider: "deterministic" }
    );

    assert.ok(res.decision.recommendation);
    assert.strictEqual(res.decision.activeQuestion, null);
    assert.ok(res.decision.recommendation!.options.length > 0);
  });

  // Test R: ActiveQuestion dimension always corresponds to an unresolved material dimension
  it("Test R: ActiveQuestion dimension is always an unresolved material dimension", async () => {
    const learnerId = `test_q_dim_${Date.now()}`;

    const res = await orchestrator.handleIntake(
      { message: "I want to become a Backend Engineer", modelProvider: "deterministic" },
      learnerId
    );

    assert.strictEqual(res.decision.eligibility, "material_uncertainty");
    assert.ok(res.decision.activeQuestion);
    const qDim = res.decision.activeQuestion!.selectedQuestion.dimension;
    assert.ok(res.decision.missingMaterialDimensions.includes(qDim));
  });

  // Test T: Catalog curriculum has selectedPathId !== null
  it("Test T: Catalog curriculum has non-null selectedPathId", async () => {
    const learnerId = `test_cat_path_id_${Date.now()}`;

    await orchestrator.handleIntake(
      {
        message: "I want to become a Full-Stack Web & Applications Engineer using React and TypeScript",
        modelProvider: "deterministic",
      },
      learnerId
    );

    await orchestrator.answerQuestion("target_domain", "saas_web_products", learnerId, { provider: "deterministic" });
    await orchestrator.answerQuestion("architecture_preference", "microservices", learnerId, { provider: "deterministic" });
    const res = await orchestrator.answerQuestion("hours_per_week", "10 hours/week", learnerId, { provider: "deterministic" });

    assert.strictEqual(res.decision.eligibility, "eligible");
    assert.strictEqual(res.decision.curriculumSource, "catalog");
    assert.strictEqual(res.decision.selectedPathId, "fullstack_software_engineer");
    assert.ok(res.roadmap !== null);
    assert.strictEqual(res.roadmap.targetPathId, "fullstack_software_engineer");
  });
});
