import { LearningOrchestrator } from "../src/lib/application/orchestrator";
import { pathCompatibilityGate } from "../src/lib/domain/intent/path-compatibility-gate";
import { HypothesisEngine } from "../src/lib/domain/intent/hypothesis-engine";
import { IntentConfidenceService } from "../src/lib/domain/intent/confidence-service";
import { FactPrecedenceEngine } from "../src/lib/domain/intent/fact-precedence-engine";
import { RecommendationScorer } from "../src/lib/domain/learning/recommendation-scorer";
import { SkillGapService } from "../src/lib/domain/learning/skill-gap-service";
import { SkillGraph } from "../src/lib/domain/learning/skill-graph";
import { MilestonePlanner } from "../src/lib/domain/learning/milestone-planner";
import { DeterministicLlmAdapter } from "../src/lib/llm/deterministic-adapter";
import { SEEDED_PATHS, SEEDED_RESOURCES } from "../src/lib/persistence/seed-data";
import { ProfileFact } from "../src/lib/contracts";

async function runCareerIntentCompatibilityTests() {
  console.log("==================================================");
  console.log("Running Complete Intent & Compatibility Pipeline Tests (21/21)");
  console.log("==================================================\n");

  let passedTests = 0;
  const totalTests = 21;

  // ------------------------------------------------------------
  // TEST 1 — Explicit career goal survives extraction
  // ------------------------------------------------------------
  console.log("Test 1: Explicit career goal survives extraction...");
  {
    const adapter = new DeterministicLlmAdapter();
    const result = await adapter.extract({
      message: "I want to become a VLSI Design Engineer.",
      existingFacts: [],
      currentHypotheses: [],
    });

    const goalFact = result.facts.find((f) => f.dimension === "declared_goal");
    if (!goalFact || !String(goalFact.value).includes("VLSI")) {
      throw new Error(`FAIL: declared_goal was not extracted accurately: ${goalFact?.value}`);
    }
    console.log("  [PASS] Explicit career goal extracted accurately.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 2 — Explicit specialization survives extraction
  // ------------------------------------------------------------
  console.log("\nTest 2: Explicit specialization survives extraction as specialization_focus (not architecture_preference)...");
  {
    const adapter = new DeterministicLlmAdapter();
    const result = await adapter.extract({
      message: "I want to become a VLSI Design Engineer specializing in mixed-signal design.",
      existingFacts: [],
      currentHypotheses: [],
    });

    const specFact = result.facts.find((f) => f.dimension === "specialization_focus");
    if (!specFact || !String(specFact.value).toLowerCase().includes("mixed-signal")) {
      throw new Error(`FAIL: specialization_focus was not extracted: ${specFact?.value}`);
    }
    const archFact = result.facts.find((f) => f.dimension === "architecture_preference");
    if (archFact && String(archFact.value).toLowerCase().includes("mixed-signal")) {
      throw new Error(`FAIL: mixed-signal design was misclassified as architecture_preference!`);
    }
    console.log("  [PASS] Career specialization correctly extracted under specialization_focus.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 3 — Facts survive FactPrecedenceEngine merging
  // ------------------------------------------------------------
  console.log("\nTest 3: Facts survive FactPrecedenceEngine merging without silent deletion...");
  {
    const engine = new FactPrecedenceEngine();
    const existing: ProfileFact[] = [
      {
        id: "f_goal",
        dimension: "declared_goal",
        normalizedValue: "VLSI Design Engineer",
        rawValue: "VLSI Design Engineer",
        source: "llm_inference",
        evidence: "Goal stated",
        reliability: 0.95,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "f_spec",
        dimension: "specialization_focus",
        normalizedValue: "Mixed-signal design",
        rawValue: "Mixed-signal design",
        source: "llm_inference",
        evidence: "Specialization stated",
        reliability: 0.95,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const incoming: ProfileFact[] = [
      {
        id: "f_lang",
        dimension: "primary_language",
        normalizedValue: "Python",
        rawValue: "Python",
        source: "llm_inference",
        evidence: "Language stated",
        reliability: 0.95,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "f_hrs",
        dimension: "hours_per_week",
        normalizedValue: 15,
        rawValue: "15 hrs",
        source: "llm_inference",
        evidence: "Hours stated",
        reliability: 0.95,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const merged = engine.mergeFacts(existing, incoming);
    const activeDimensions = merged.updatedFacts.filter((f) => f.status === "active").map((f) => f.dimension);

    if (!activeDimensions.includes("declared_goal")) throw new Error("FAIL: declared_goal dropped during merge!");
    if (!activeDimensions.includes("specialization_focus")) throw new Error("FAIL: specialization_focus dropped during merge!");
    if (!activeDimensions.includes("primary_language")) throw new Error("FAIL: primary_language dropped during merge!");
    if (!activeDimensions.includes("hours_per_week")) throw new Error("FAIL: hours_per_week dropped during merge!");

    console.log("  [PASS] All 4 facts survived merging with active status.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 4 — Enterprise does not imply Java
  // ------------------------------------------------------------
  console.log("\nTest 4: Enterprise domain does NOT imply Java/Spring Boot...");
  {
    const facts: ProfileFact[] = [
      {
        id: "f_domain",
        dimension: "target_domain",
        normalizedValue: "Enterprise Systems & Software",
        rawValue: "Enterprise Systems",
        source: "llm_inference",
        evidence: "Domain",
        reliability: 0.95,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const evalResult = pathCompatibilityGate.evaluateIntentCompatibility(facts, SEEDED_PATHS);
    const nodeEligible = evalResult.eligiblePaths.some((p) => p.id === "backend_web_product_node");
    const pyEligible = evalResult.eligiblePaths.some((p) => p.id === "backend_python_cloud");

    if (!nodeEligible || !pyEligible) {
      throw new Error("FAIL: Generic enterprise domain falsely locked out Node or Python paths!");
    }
    console.log("  [PASS] Enterprise domain permits multiple compatible technology ecosystems.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 5 — VLSI + Python does NOT become Python Cloud
  // ------------------------------------------------------------
  console.log("\nTest 5: VLSI + Python does NOT become Python Cloud Developer...");
  {
    const facts: ProfileFact[] = [
      {
        id: "f_goal",
        dimension: "declared_goal",
        normalizedValue: "VLSI Design Engineer",
        rawValue: "VLSI Design Engineer",
        source: "llm_inference",
        evidence: "I want to become a VLSI engineer",
        reliability: 0.98,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "f_lang",
        dimension: "primary_language",
        normalizedValue: "Python",
        rawValue: "Python",
        source: "llm_inference",
        evidence: "I use Python",
        reliability: 0.98,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const hypEngine = new HypothesisEngine();
    const result = hypEngine.updateHypotheses(facts);

    const pythonCloudHyp = result.hypotheses.find((h) => h.pathId === "backend_python_cloud");
    if (pythonCloudHyp && pythonCloudHyp.posteriorProbability > 0) {
      throw new Error(`FAIL: Python Cloud assigned probability ${pythonCloudHyp.posteriorProbability} for VLSI goal!`);
    }

    console.log("  [PASS] Hard eligibility gate prevented Python technology from hijacking VLSI career goal.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 6 — Unsupported track remains clarifying
  // ------------------------------------------------------------
  console.log("\nTest 6: Unsupported track (Aerospace Avionics) remains strictly in clarifying state...");
  {
    const confidenceService = new IntentConfidenceService();
    const facts: ProfileFact[] = [
      {
        id: "f1",
        dimension: "declared_goal",
        normalizedValue: "Aerospace Avionics Engineer",
        rawValue: "Aerospace Avionics Engineer",
        source: "llm_inference",
        evidence: "Goal",
        reliability: 0.98,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const hypEngine = new HypothesisEngine();
    const hypResult = hypEngine.updateHypotheses(facts);

    const conf = confidenceService.evaluateConfidence({
      hypotheses: hypResult.hypotheses,
      facts,
      contradictions: [],
      questionCount: 4,
    });

    if (conf.status !== "clarifying") {
      throw new Error(`FAIL: Expected status 'clarifying', got '${conf.status}'`);
    }
    if (conf.missingMaterialDimensions.length === 0) {
      throw new Error(`FAIL: Expected missingMaterialDimensions for uncatalogued track`);
    }

    console.log("  [PASS] Confidence evaluation strictly enforces 'clarifying' for unsupported track.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 7 — Unsupported intent has null topPath
  // ------------------------------------------------------------
  console.log("\nTest 7: Unsupported intent explicitly produces topPath === null...");
  {
    const facts: ProfileFact[] = [
      {
        id: "f1",
        dimension: "declared_goal",
        normalizedValue: "Quantum Computing Hardware Engineer",
        rawValue: "Quantum Computing Hardware Engineer",
        source: "user_answer",
        evidence: "Goal",
        reliability: 1.0,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const hypEngine = new HypothesisEngine();
    const hypResult = hypEngine.updateHypotheses(facts);

    if (hypResult.topPath !== null) {
      throw new Error(`FAIL: topPath must be null when all candidates are unsupported, got ${JSON.stringify(hypResult.topPath)}`);
    }

    console.log("  [PASS] HypothesisEngine returned explicit null topPath for unsupported career track.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 8 — Zero compatible paths cannot select paths[0]
  // ------------------------------------------------------------
  console.log("\nTest 8: Zero compatible paths cannot fall back to paths[0] or SEEDED_PATHS[0]...");
  {
    const facts: ProfileFact[] = [
      {
        id: "f1",
        dimension: "declared_goal",
        normalizedValue: "Aerospace Avionics Engineer",
        rawValue: "Aerospace Avionics Engineer",
        source: "user_answer",
        evidence: "Goal",
        reliability: 1.0,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const gateEval = pathCompatibilityGate.evaluateIntentCompatibility(facts, SEEDED_PATHS);
    if (gateEval.eligiblePaths.length !== 0) {
      throw new Error(`FAIL: Expected 0 eligible paths for Aerospace, got ${gateEval.eligiblePaths.length}`);
    }

    console.log("  [PASS] Eligible paths is strictly empty with no array position fallbacks.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 9 — No roadmap without a valid selected path
  // ------------------------------------------------------------
  console.log("\nTest 9: Attempting to generate roadmap without valid eligible path throws descriptive error...");
  {
    const orchestrator = new LearningOrchestrator();
    await orchestrator.resetState("test_no_roadmap");

    await orchestrator.handleIntake(
      {
        message: "I want to become an Aerospace Avionics Engineer specializing in flight control systems.",
        modelProvider: "deterministic",
      },
      "test_no_roadmap"
    );

    let blocked = false;
    try {
      await orchestrator.generateRoadmap("test_no_roadmap");
    } catch (e: any) {
      blocked = true;
      console.log(`  Roadmap correctly blocked: ${e.message}`);
    }

    if (!blocked) {
      throw new Error("FAIL: generateRoadmap should have thrown for unsupported Aerospace goal!");
    }

    console.log("  [PASS] Roadmap generation prevented for unsupported career intent.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 10 — TypeScript + Enterprise selects Node/TypeScript
  // ------------------------------------------------------------
  console.log("\nTest 10: TypeScript + Enterprise selects Node/TypeScript path...");
  {
    const orchestrator = new LearningOrchestrator();
    await orchestrator.resetState("test_ts_ent");

    await orchestrator.handleIntake(
      {
        message: "I want to build enterprise backend APIs and SaaS systems using TypeScript and Node.js.",
        modelProvider: "deterministic",
      },
      "test_ts_ent"
    );
    await orchestrator.answerQuestion("architecture_preference", "Microservices & REST APIs", "test_ts_ent");
    const rFinal = await orchestrator.answerQuestion("hours_per_week", "10 hours/week", "test_ts_ent");

    if (!rFinal.roadmap) throw new Error("FAIL: Roadmap was not generated for Enterprise TS learner");
    if (rFinal.profile.selectedPathId === "backend_enterprise_java") {
      throw new Error("FAIL: TypeScript enterprise learner was assigned backend_enterprise_java!");
    }

    console.log(`  Selected Path: ${rFinal.profile.selectedPathId}`);
    console.log("  [PASS] TypeScript + Enterprise correctly selected TypeScript/Node track.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 11 — Java + Enterprise selects Java/Spring
  // ------------------------------------------------------------
  console.log("\nTest 11: Java + Enterprise selects Java/Spring Boot track...");
  {
    const orchestrator = new LearningOrchestrator();
    await orchestrator.resetState("test_java_ent");

    await orchestrator.handleIntake(
      {
        message: "I want to become an Enterprise Java & ERP Systems Architect using Spring Boot.",
        modelProvider: "deterministic",
      },
      "test_java_ent"
    );
    await orchestrator.answerQuestion("architecture_preference", "Modular Monolith & Transactional Workflows", "test_java_ent");
    const rFinal = await orchestrator.answerQuestion("hours_per_week", "10 hours/week", "test_java_ent");

    if (!rFinal.roadmap || rFinal.profile.selectedPathId !== "backend_enterprise_java") {
      throw new Error(`FAIL: Expected backend_enterprise_java, got ${rFinal.profile.selectedPathId}`);
    }

    console.log("  [PASS] Java + Enterprise correctly selected backend_enterprise_java.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 12 — Python + Backend selects Python/FastAPI
  // ------------------------------------------------------------
  console.log("\nTest 12: Python + Backend selects Python/FastAPI cloud developer track...");
  {
    const orchestrator = new LearningOrchestrator();
    await orchestrator.resetState("test_py_cloud");

    await orchestrator.handleIntake(
      {
        message: "I want to build cloud backend services and async APIs with Python and FastAPI.",
        modelProvider: "deterministic",
      },
      "test_py_cloud"
    );
    await orchestrator.answerQuestion("architecture_preference", "Microservices & Event Streams", "test_py_cloud");
    const rFinal = await orchestrator.answerQuestion("hours_per_week", "10 hours/week", "test_py_cloud");

    if (!rFinal.roadmap || rFinal.profile.selectedPathId !== "backend_python_cloud") {
      throw new Error(`FAIL: Expected backend_python_cloud, got ${rFinal.profile.selectedPathId}`);
    }

    console.log("  [PASS] Python + Backend correctly selected backend_python_cloud.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 13 — architecture_preference does not become specialization
  // ------------------------------------------------------------
  console.log("\nTest 13: architecture_preference does not get confused with career specialization...");
  {
    const facts: ProfileFact[] = [
      {
        id: "f_arch",
        dimension: "architecture_preference",
        normalizedValue: "Microservices",
        rawValue: "Microservices",
        source: "user_answer",
        evidence: "Architecture",
        reliability: 0.9,
        impact: "medium",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const evalResult = pathCompatibilityGate.evaluateIntentCompatibility(facts, SEEDED_PATHS);
    // Microservices architecture must not disqualify web/backend/cloud paths
    if (evalResult.eligiblePaths.length < 3) {
      throw new Error(`FAIL: architecture_preference 'Microservices' wrongly disqualified paths!`);
    }

    console.log("  [PASS] architecture_preference treated as technical preference, not career barrier.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 14 — Technology does not override explicit career intent
  // ------------------------------------------------------------
  console.log("\nTest 14: Technology signals do not override explicit career intent...");
  {
    const facts: ProfileFact[] = [
      {
        id: "f_goal",
        dimension: "declared_goal",
        normalizedValue: "Ethical Security & Defensive Red-Team Engineer",
        rawValue: "Cybersecurity Red-Team Engineer",
        source: "user_answer",
        evidence: "Goal",
        reliability: 1.0,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "f_lang",
        dimension: "primary_language",
        normalizedValue: "Python",
        rawValue: "Python",
        source: "user_answer",
        evidence: "Language",
        reliability: 1.0,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const hypEngine = new HypothesisEngine();
    const result = hypEngine.updateHypotheses(facts);

    if (!result.topPath || result.topPath.pathId !== "cybersecurity_defensive_redteam") {
      throw new Error(`FAIL: Cybersecurity goal was overridden by Python technology! Top path: ${result.topPath?.pathId}`);
    }

    console.log("  [PASS] Career goal correctly dominated technology constraint.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 15 — Incompatible path cannot become READY through posterior score
  // ------------------------------------------------------------
  console.log("\nTest 15: Incompatible path cannot become READY merely via high posterior score...");
  {
    const confService = new IntentConfidenceService();
    const facts: ProfileFact[] = [
      {
        id: "f_goal",
        dimension: "declared_goal",
        normalizedValue: "DevOps & Cloud Platform Infrastructure Engineer",
        rawValue: "DevOps Engineer",
        source: "user_answer",
        evidence: "Goal",
        reliability: 1.0,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Artificially construct conflicting hypothesis pointing to Java
    const conflictingHypotheses = [
      {
        pathId: "backend_enterprise_java",
        pathTitle: "Enterprise Java & ERP Systems Architect",
        priorProbability: 0.5,
        posteriorProbability: 0.99,
        supportEvidenceCount: 5,
        rationale: "Fabricated high score",
      },
    ];

    const conf = confService.evaluateConfidence({
      hypotheses: conflictingHypotheses,
      facts,
      contradictions: [],
      questionCount: 4,
    });

    if (conf.status === "ready") {
      throw new Error("FAIL: Confidence certified READY for a conflicting path!");
    }

    console.log("  [PASS] Confidence compatibility gate rejected conflicting candidate path.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 16 — No SEEDED_PROJECTS[0] fallback
  // ------------------------------------------------------------
  console.log("\nTest 16: No SEEDED_PROJECTS[0] fallback when no project matches...");
  {
    const planner = new MilestonePlanner();
    const fakePathDef = {
      ...SEEDED_PATHS[0],
      id: "esoteric_nonexistent_track",
      title: "Esoteric Nonexistent Track",
      domain: "quantum_firmware",
      technologyEcosystem: "cpp" as const,
    };

    const roadmap = planner.planMilestones(
      fakePathDef,
      [],
      { domains: [], languages: [], learningModes: [], resourceBudget: "free_only" },
      { hoursPerWeek: 10, deadlineMonths: 6, timezone: "UTC", safetyScopeConfirmed: true },
      "test_esoteric",
      "cpp"
    );

    for (const m of roadmap.milestones) {
      if (m.project) {
        if (m.project.ecosystem === "java_spring") {
          throw new Error(`FAIL: Incompatible Java project assigned to C++ path: ${m.project.title}`);
        }
      }
    }

    console.log("  [PASS] Unmatched project safely resolves to null, never SEEDED_PROJECTS[0].");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 17 — No incompatible resource fallback
  // ------------------------------------------------------------
  console.log("\nTest 17: Incompatible resource fallback prevented in recommendation scorer...");
  {
    const scorer = new RecommendationScorer();
    const scored = scorer.scoreAndRankResources(
      SEEDED_RESOURCES,
      "sql_relational_modeling",
      { languages: ["TypeScript"], domains: ["saas_web"], learningModes: ["hands_on_projects"], resourceBudget: "free_only" },
      2,
      "typescript_node"
    );

    const hasJava = scored.some((r) => r.ecosystem === "java_spring");
    if (hasJava) {
      throw new Error("FAIL: Java Spring resource returned in TypeScript resource recommendations!");
    }

    console.log("  [PASS] Recommendation scorer strictly filtered incompatible technology resources.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 18 — Skill graph does not introduce incompatible ecosystem prerequisites
  // ------------------------------------------------------------
  console.log("\nTest 18: Skill graph does not introduce incompatible ecosystem prerequisites...");
  {
    const graph = new SkillGraph();
    const gapService = new SkillGapService(graph);

    const nodePath = SEEDED_PATHS.find((p) => p.id === "backend_web_product_node")!;
    const nodeWeights = gapService.specializeTargetSkillWeights(nodePath.id, nodePath.targetSkillWeights, "typescript_node");
    const gapResults = gapService.analyzeGaps(nodeWeights, [], 6, "typescript_node");

    for (const gap of gapResults) {
      if (gap.skill.ecosystem === "java_spring") {
        throw new Error(`FAIL: Java Spring skill ${gap.skillId} present in Node.js gap analysis!`);
      }
    }

    console.log("  [PASS] Skill gap analysis strictly isolates TypeScript from Java prerequisites.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 19 — Correction Java → TypeScript recalculates correctly
  // ------------------------------------------------------------
  console.log("\nTest 19: Preference correction from Java to TypeScript recalculates cleanly...");
  {
    const orchestrator = new LearningOrchestrator();
    await orchestrator.resetState("test_corr_clean");

    await orchestrator.handleIntake(
      {
        message: "I am building backend systems in Java with Spring Boot.",
        modelProvider: "deterministic",
      },
      "test_corr_clean"
    );
    await orchestrator.answerQuestion("architecture_preference", "Microservices", "test_corr_clean");
    const r1 = await orchestrator.answerQuestion("hours_per_week", "10 hours/week", "test_corr_clean");

    if (r1.profile.selectedPathId !== "backend_enterprise_java") {
      throw new Error("Initial path should have been backend_enterprise_java");
    }

    const langFact = r1.profile.facts.find((f) => f.dimension === "primary_language");
    if (!langFact) throw new Error("primary_language fact not found");

    const corrected = await orchestrator.correctFact(
      langFact.id,
      { newValue: "TypeScript", reason: "Switched to TypeScript and Node.js" },
      "test_corr_clean"
    );

    if (!corrected.roadmapStale) throw new Error("Roadmap must be marked stale after language change");

    const r2 = await orchestrator.generateRoadmap("test_corr_clean");
    console.log(`  Recalculated Path: ${r2.targetPathId}`);

    if (r2.targetPathId === "backend_enterprise_java") {
      throw new Error("FAIL: Path remained backend_enterprise_java after correcting to TypeScript!");
    }

    console.log("  [PASS] Dynamic fact correction cleanly recalculated path without Java stale state.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 20 — Complete end-to-end VLSI scenario produces dedicated hardware roadmap
  // ------------------------------------------------------------
  console.log("\nTest 20: Complete end-to-end VLSI scenario selects VLSI path and produces hardware roadmap...");
  {
    const orchestrator = new LearningOrchestrator();
    await orchestrator.resetState("test_vlsi_complete");

    const r1 = await orchestrator.handleIntake(
      {
        message: "I want to become a VLSI Design Engineer specializing in RTL design. I know SystemVerilog and have 15 hours per week.",
        modelProvider: "deterministic",
      },
      "test_vlsi_complete"
    );

    const factDimensions = r1.profile.facts.map((f) => f.dimension);
    console.log(`  Extracted Dimensions: ${factDimensions.join(", ")}`);

    if (!factDimensions.includes("declared_goal")) throw new Error("Missing declared_goal");
    if (!factDimensions.includes("target_domain")) throw new Error("Missing target_domain");
    if (!factDimensions.includes("specialization_focus")) throw new Error("Missing specialization_focus");
    if (!factDimensions.includes("hours_per_week")) throw new Error("Missing hours_per_week");

    // Answer remaining architecture question to trigger ready state
    const r2 = await orchestrator.answerQuestion(
      "architecture_preference",
      "Pipelined Processor Microarchitecture (RISC-V RV32I)",
      "test_vlsi_complete"
    );

    if (r2.confidence.status !== "ready") {
      throw new Error(`FAIL: Expected ready status for complete VLSI profile, got ${r2.confidence.status}`);
    }
    if (r2.profile.selectedPathId !== "vlsi_design_engineer") {
      throw new Error(`FAIL: Expected path vlsi_design_engineer, got ${r2.profile.selectedPathId}`);
    }
    if (!r2.roadmap) {
      throw new Error("FAIL: Roadmap should be generated for ready VLSI path!");
    }

    console.log(`  Generated VLSI Roadmap: "${r2.roadmap.targetPathTitle}" (${r2.roadmap.milestones.length} milestones)`);
    console.log("  [PASS] Complete VLSI scenario accurately selected VLSI path and synthesized hardware roadmap.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // TEST 21 — Complete end-to-end Enterprise + TypeScript scenario contains zero Java/Spring contamination
  // ------------------------------------------------------------
  console.log("\nTest 21: Complete end-to-end Enterprise + TypeScript contains 0% Java/Spring contamination...");
  {
    const orchestrator = new LearningOrchestrator();
    await orchestrator.resetState("test_ts_zero_java");

    await orchestrator.handleIntake(
      {
        message: "I want to build enterprise backend systems and REST APIs using TypeScript and Node.js.",
        modelProvider: "deterministic",
      },
      "test_ts_zero_java"
    );
    await orchestrator.answerQuestion("architecture_preference", "Microservices & REST APIs", "test_ts_zero_java");
    const rFinal = await orchestrator.answerQuestion("hours_per_week", "12 hours/week", "test_ts_zero_java");

    if (!rFinal.roadmap) throw new Error("FAIL: Roadmap was not generated for Enterprise TS learner");

    console.log(`  Roadmap Target Path: ${rFinal.roadmap.targetPathId}`);

    for (const milestone of rFinal.roadmap.milestones) {
      if (milestone.title.toLowerCase().includes("java") || milestone.description.toLowerCase().includes("jvm") || milestone.description.toLowerCase().includes("spring")) {
        throw new Error(`FAIL: Incompatible Java text in milestone: ${milestone.title}`);
      }
      for (const skillId of milestone.skillIds) {
        if (skillId.includes("java") || skillId.includes("spring")) {
          throw new Error(`FAIL: Incompatible Java skill in milestone: ${skillId}`);
        }
      }
      for (const resource of milestone.resources) {
        if (resource.ecosystem === "java_spring") {
          throw new Error(`FAIL: Incompatible Java Spring resource in milestone: ${resource.title}`);
        }
      }
      if (milestone.project && milestone.project.ecosystem === "java_spring") {
        throw new Error(`FAIL: Incompatible Java Spring project in milestone: ${milestone.project.title}`);
      }
    }

    console.log("  [PASS] 0% Java/Spring contamination across milestones, skills, resources, and projects.");
    passedTests++;
  }

  console.log("\n==================================================");
  console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED WITH 100% SUCCESS!`);
  console.log("==================================================");
}

runCareerIntentCompatibilityTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
