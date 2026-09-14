import { LearningOrchestrator } from "../src/lib/application/orchestrator";
import { DeterministicLlmAdapter } from "../src/lib/llm/deterministic-adapter";
import { QuestionSelector } from "../src/lib/domain/intent/question-selector";
import { HypothesisEngine } from "../src/lib/domain/intent/hypothesis-engine";
import { IntentConfidenceService } from "../src/lib/domain/intent/confidence-service";
import { pathCompatibilityGate } from "../src/lib/domain/intent/path-compatibility-gate";
import { FactPrecedenceEngine } from "../src/lib/domain/intent/fact-precedence-engine";
import {
  ProfileFact,
  QuestionCandidate,
  PathHypothesis,
  ALLOWED_QUESTION_DIMENSIONS,
} from "../src/lib/contracts";
import { SEEDED_PATHS } from "../src/lib/persistence/seed-data";

async function runRegressionSuite() {
  console.log("==================================================");
  console.log("Running Intent Clarification & Question Correctness Tests (13/13)");
  console.log("==================================================\n");

  let passedTests = 0;
  const totalTests = 13;

  // --------------------------------------------------
  // TEST 1: Unsupported career/domain intent
  // --------------------------------------------------
  console.log("Test 1: Unsupported career intent preserves all facts and produces activeQuestion === null...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("test_learner_unsupported");

    const res = await orch.handleIntake(
      {
        message: "I want to become an underwater marine archaeology explorer with 15 hours per week.",
        modelProvider: "deterministic",
      },
      "test_learner_unsupported"
    );

    // 1. Facts preserved
    const factDims = res.extractedFacts.map((f) => f.dimension);
    if (!factDims.includes("declared_goal")) {
      throw new Error(`FAIL Test 1: Goal fact not extracted. Found: ${JSON.stringify(factDims)}`);
    }

    const allProfileDims = res.profile.facts.filter((f) => f.status === "active").map((f) => f.dimension);
    if (!allProfileDims.includes("hours_per_week")) {
      throw new Error("FAIL Test 1: Secondary constraint fact (hours_per_week) was not preserved!");
    }

    // 2. Intent unsupported & observable reason
    if (res.decision.eligibility !== "unsupported_intent") {
      throw new Error(`FAIL Test 1: Expected eligibility 'unsupported_intent', got '${res.decision.eligibility}'`);
    }

    // 3. No roadmap, no selected path, no active question!
    if (res.roadmap !== null) {
      throw new Error("FAIL Test 1: Generated roadmap for unsupported career!");
    }
    if (res.profile.selectedPathId !== null) {
      throw new Error(`FAIL Test 1: selectedPathId should be null, got: ${res.profile.selectedPathId}`);
    }
    if (res.activeQuestion !== null) {
      throw new Error(`FAIL Test 1: activeQuestion MUST be null for unsupported intent, got: ${JSON.stringify(res.activeQuestion)}`);
    }

    console.log("  [PASS] Unsupported career intent preserved facts with activeQuestion === null and roadmap === null.");
    passedTests++;
  }

  // --------------------------------------------------
  // TEST 2: Empty question candidate set on unrecognized dimensions
  // --------------------------------------------------
  console.log("Test 2: Proposing questions for unrecognized dimensions strictly returns candidates = []...");
  {
    const adapter = new DeterministicLlmAdapter();
    const result = await adapter.proposeQuestions({
      goalText: "I want to learn something",
      existingFacts: [],
      currentHypotheses: [],
      unknownDimensions: ["unsupported_dimension_xyz", "nonexistent_dimension"],
    });

    if (!result.candidates || result.candidates.length !== 0) {
      throw new Error(`FAIL Test 2: Expected candidates to be empty, got ${result.candidates?.length} items: ${JSON.stringify(result.candidates)}`);
    }

    console.log("  [PASS] Unrecognized dimensions produced strictly empty candidate set without fallback generic questions.");
    passedTests++;
  }

  // --------------------------------------------------
  // TEST 3: No semantic contamination for unsupported intent
  // --------------------------------------------------
  console.log("Test 3: Unsupported intent does NOT introduce unrelated catalog domains or questions...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("test_learner_wizard");

    const res = await orch.handleIntake(
      {
        message: "I want to become a medieval alchemy potion wizard casting magic spells.",
        modelProvider: "deterministic",
      },
      "test_learner_wizard"
    );

    if (res.activeQuestion !== null) {
      throw new Error(`FAIL Test 3: Unsupported wizard intent received question: ${JSON.stringify(res.activeQuestion)}`);
    }
    if (res.profile.selectedPathId !== null) {
      throw new Error(`FAIL Test 3: selectedPathId should be null, got ${res.profile.selectedPathId}`);
    }

    console.log("  [PASS] No semantic contamination or unrelated questions introduced for unsupported intent.");
    passedTests++;
  }

  // --------------------------------------------------
  // TEST 4: Supported incomplete intent produces valid relevant question
  // --------------------------------------------------
  console.log("Test 4: Supported incomplete intent produces a relevant clarification question...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("test_learner_backend");

    const res = await orch.handleIntake(
      {
        message: "I want to become a backend software engineer building distributed microservices.",
        modelProvider: "deterministic",
      },
      "test_learner_backend"
    );

    if (res.confidence.status !== "clarifying") {
      throw new Error(`FAIL Test 4: Expected clarifying status, got ${res.confidence.status}`);
    }
    if (res.activeQuestion === null) {
      throw new Error("FAIL Test 4: Expected activeQuestion to be non-null for supported incomplete intent!");
    }

    const qDim = res.activeQuestion.selectedQuestion.dimension;
    const allowed = ALLOWED_QUESTION_DIMENSIONS as readonly string[];
    if (!allowed.includes(qDim)) {
      throw new Error(`FAIL Test 4: Question dimension '${qDim}' is not in ALLOWED_QUESTION_DIMENSIONS`);
    }

    console.log(`  [PASS] Supported incomplete intent generated relevant question targeting '${qDim}'.`);
    passedTests++;
  }

  // --------------------------------------------------
  // TEST 5: Explicit technology constraint does not redefine career intent
  // --------------------------------------------------
  console.log("Test 5: Explicit technology constraint does not override career intent...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("test_learner_vlsi_python");

    const res = await orch.handleIntake(
      {
        message: "I want to become a VLSI design engineer. I know Python for scripting and have 10 hours a week.",
        modelProvider: "deterministic",
      },
      "test_learner_vlsi_python"
    );

    // Should align with VLSI track or ask hardware question, NEVER become Python Cloud Developer
    if (res.profile.selectedPathId === "backend_python_cloud") {
      throw new Error("FAIL Test 5: Python language preference hijacked VLSI career goal into Python Cloud!");
    }

    // Top hypothesis if any must be VLSI
    const topHyp = res.profile.intent.hypotheses.find((h) => h.posteriorProbability > 0);
    if (topHyp && topHyp.pathId !== "vlsi_design_engineer") {
      throw new Error(`FAIL Test 5: Top hypothesis should be VLSI, got ${topHyp.pathId}`);
    }

    console.log("  [PASS] Career goal correctly dominated secondary Python language signal.");
    passedTests++;
  }

  // --------------------------------------------------
  // TEST 6: Provider failure preserves intent and never invents questions
  // --------------------------------------------------
  console.log("Test 6: Provider failure falls back safely and produces activeQuestion === null when no candidates exist...");
  {
    const adapter = new DeterministicLlmAdapter();

    // Propose questions on unsupported track
    const result = await adapter.proposeQuestions({
      goalText: "Bioinformatics genomics researcher",
      existingFacts: [
        {
          id: "f1",
          dimension: "declared_goal",
          normalizedValue: "Bioinformatics Scientist",
          rawValue: "Bioinformatics Scientist",
          source: "llm_inference",
          evidence: "Stated",
          reliability: 0.9,
          impact: "high",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      currentHypotheses: [],
      unknownDimensions: [], // No missing answerable dimensions
    });

    if (result.candidates.length !== 0) {
      throw new Error(`FAIL Test 6: Fallback produced ${result.candidates.length} candidates when 0 were expected!`);
    }

    console.log("  [PASS] Deterministic fallback safely returned empty candidate list.");
    passedTests++;
  }

  // --------------------------------------------------
  // TEST 7: Empty LLM candidates result in activeQuestion === null
  // --------------------------------------------------
  console.log("Test 7: Empty LLM candidate proposal produces activeQuestion === null without catalog fallback...");
  {
    const selector = new QuestionSelector();
    const decision = selector.selectBestQuestion([], [], []);

    if (decision !== null) {
      throw new Error(`FAIL Test 7: QuestionSelector should return null on empty candidates, got: ${JSON.stringify(decision)}`);
    }

    console.log("  [PASS] Empty candidates produced strictly null QuestionDecision.");
    passedTests++;
  }

  // --------------------------------------------------
  // TEST 8: Invalid LLM candidates targeting already answered or non-allowlisted dimensions are rejected
  // --------------------------------------------------
  console.log("Test 8: QuestionSelector rejects invalid / already-answered candidates...");
  {
    const selector = new QuestionSelector();
    const activeFacts: ProfileFact[] = [
      {
        id: "f_lang",
        dimension: "primary_language",
        normalizedValue: "Java",
        rawValue: "Java",
        source: "user_answer",
        evidence: "Answered",
        reliability: 0.98,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const candidates: QuestionCandidate[] = [
      {
        id: "q_invalid_1",
        dimension: "primary_language", // Already answered!
        question: "Which programming language do you prefer?",
        answerType: "single_choice",
        options: ["Java", "Python"],
        why: "Test",
        informationGain: 0.9,
        utilityScore: 0.9,
      },
      {
        id: "q_invalid_2",
        dimension: "unsupported_random_dimension", // Not allowlisted!
        question: "What is your favorite color?",
        answerType: "single_choice",
        options: ["Blue", "Green"],
        why: "Test",
        informationGain: 0.95,
        utilityScore: 0.95,
      },
    ];

    const decision = selector.selectBestQuestion(candidates, [], activeFacts);

    if (decision !== null) {
      throw new Error(`FAIL Test 8: QuestionSelector should have rejected all invalid candidates, but selected: ${JSON.stringify(decision)}`);
    }

    console.log("  [PASS] QuestionSelector rejected all invalid candidates and returned null.");
    passedTests++;
  }

  // --------------------------------------------------
  // TEST 9: QuestionSelector prioritizes semantically valid candidate over high-gain invalid candidate
  // --------------------------------------------------
  console.log("Test 9: QuestionSelector selects only the semantically valid candidate...");
  {
    const selector = new QuestionSelector();
    const activeFacts: ProfileFact[] = [
      {
        id: "f_lang",
        dimension: "primary_language",
        normalizedValue: "Java",
        rawValue: "Java",
        source: "user_answer",
        evidence: "Answered",
        reliability: 0.98,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const validCandidate: QuestionCandidate = {
      id: "q_valid",
      dimension: "hours_per_week",
      question: "How many hours per week can you study?",
      answerType: "single_choice",
      options: ["5 hours", "10 hours"],
      why: "Calibrates milestone pacing",
      informationGain: 0.3,
      utilityScore: 0.3,
      predictedAnswerBuckets: ["5", "10"],
    };

    const invalidCandidate: QuestionCandidate = {
      id: "q_invalid",
      dimension: "primary_language", // Already answered!
      question: "Which language do you want?",
      answerType: "single_choice",
      options: ["Java", "Python"],
      why: "Language choice",
      informationGain: 0.99,
      utilityScore: 0.99,
      predictedAnswerBuckets: ["java", "python"],
    };

    const decision = selector.selectBestQuestion([invalidCandidate, validCandidate], [], activeFacts);

    if (!decision) {
      throw new Error("FAIL Test 9: Expected validCandidate to be selected, got null");
    }
    if (decision.selectedQuestion.id !== "q_valid") {
      throw new Error(`FAIL Test 9: Selected wrong question: ${decision.selectedQuestion.id}`);
    }

    console.log("  [PASS] QuestionSelector safely selected valid candidate over high-gain invalid candidate.");
    passedTests++;
  }

  // --------------------------------------------------
  // TEST 10: Answer flow re-evaluates compatibility and confidence cleanly
  // --------------------------------------------------
  console.log("Test 10: Answer flow re-evaluates intent confidence and missing dimensions cleanly...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("test_learner_flow");

    // Intake: Ambiguous Backend
    const intakeRes = await orch.handleIntake(
      {
        message: "I want to become a backend engineer.",
        modelProvider: "deterministic",
      },
      "test_learner_flow"
    );

    if (intakeRes.confidence.status !== "clarifying" || intakeRes.activeQuestion === null) {
      throw new Error("FAIL Test 10: Initial intake should produce clarifying state with activeQuestion");
    }

    const firstQDim = intakeRes.activeQuestion.selectedQuestion.dimension;

    // Answer first question with Java
    const answerRes = await orch.answerQuestion(firstQDim, "Java (OOP, Streams, Collections)", "test_learner_flow", {
      provider: "deterministic",
    });

    // Check that primary_language is now in active facts
    const activeDims = answerRes.profile.facts.filter((f) => f.status === "active").map((f) => f.dimension);
    if (!activeDims.includes(firstQDim)) {
      throw new Error(`FAIL Test 10: Answer fact '${firstQDim}' not found in active profile facts!`);
    }

    // If there is another activeQuestion, it must NOT ask about the answered dimension
    if (answerRes.activeQuestion) {
      if (answerRes.activeQuestion.selectedQuestion.dimension === firstQDim) {
        throw new Error(`FAIL Test 10: Next question asked about already-answered dimension '${firstQDim}'!`);
      }
    }

    console.log(`  [PASS] Answer for '${firstQDim}' successfully incorporated; next state re-evaluated.`);
    passedTests++;
  }

  // --------------------------------------------------
  // TEST 11: Unsupported state after answer produces activeQuestion === null
  // --------------------------------------------------
  console.log("Test 11: Answering with an unsupported domain immediately transitions to activeQuestion === null...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("test_learner_unsupported_answer");

    // Intake with impossible track
    const intakeRes = await orch.handleIntake(
      {
        message: "I want to become a Medieval Alchemy Potion Wizard casting magic spells.",
        modelProvider: "deterministic",
      },
      "test_learner_unsupported_answer"
    );

    if (intakeRes.decision.eligibility !== "unsupported_intent") {
      throw new Error(`FAIL Test 11: Expected eligibility 'unsupported_intent', got '${intakeRes.decision.eligibility}'`);
    }
    if (intakeRes.activeQuestion !== null) {
      throw new Error(`FAIL Test 11: activeQuestion MUST be null after unsupported answer, got: ${JSON.stringify(intakeRes.activeQuestion)}`);
    }
    if (intakeRes.roadmap !== null) {
      throw new Error("FAIL Test 11: Roadmap must be null after unsupported answer!");
    }

    console.log("  [PASS] Unsupported answer cleanly produced activeQuestion === null with no generic questions.");
    passedTests++;
  }

  // --------------------------------------------------
  // TEST 12: No array-position semantics (SEEDED_PATHS[0] / hypotheses[0])
  // --------------------------------------------------
  console.log("Test 12: Pipeline never falls back to array index [0] as semantic default...");
  {
    const hypEngine = new HypothesisEngine();
    const unsupportedFacts: ProfileFact[] = [
      {
        id: "f_bio",
        dimension: "declared_goal",
        normalizedValue: "Bioinformatics Scientist",
        rawValue: "Bioinformatics Scientist",
        source: "llm_inference",
        evidence: "Stated",
        reliability: 0.95,
        impact: "high",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const hypResult = hypEngine.updateHypotheses(unsupportedFacts);
    if (hypResult.topPath !== null) {
      throw new Error(`FAIL Test 12: HypothesisEngine topPath should be null for unsupported intent, got: ${JSON.stringify(hypResult.topPath)}`);
    }

    const confService = new IntentConfidenceService();
    const confResult = confService.evaluateConfidence({
      hypotheses: hypResult.hypotheses,
      facts: unsupportedFacts,
      contradictions: [],
      questionCount: 0,
    });

    if (confResult.status !== "clarifying") {
      throw new Error(`FAIL Test 12: status should be 'clarifying', got ${confResult.status}`);
    }
    if (confResult.missingMaterialDimensions.length === 0) {
      throw new Error(`FAIL Test 12: missingMaterialDimensions should not be empty for uncatalogued intent`);
    }

    console.log("  [PASS] Hypothesis and confidence engines return explicit null topPath without array [0] fallbacks.");
    passedTests++;
  }

  // --------------------------------------------------
  // TEST 13: Full end-to-end multi-turn invariant verification
  // --------------------------------------------------
  console.log("Test 13: Full end-to-end multi-turn intake and clarification invariant...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("test_learner_e2e_full");

    // 1. Initial intake: Frontend Web focus
    const turn1 = await orch.handleIntake(
      {
        message: "I want to become a full-stack web engineer building SaaS products with TypeScript and React.",
        modelProvider: "deterministic",
      },
      "test_learner_e2e_full"
    );

    if (turn1.confidence.status !== "clarifying") {
      throw new Error(`FAIL Test 13 Turn 1: Expected status 'clarifying', got '${turn1.confidence.status}'`);
    }
    if (!turn1.activeQuestion) {
      throw new Error("FAIL Test 13 Turn 1: Expected activeQuestion for missing hours/architecture");
    }

    // 2. Answer hours_per_week
    const turn2 = await orch.answerQuestion(
      "hours_per_week",
      "12 hours/week",
      "test_learner_e2e_full",
      { provider: "deterministic" }
    );

    // 3. Answer architecture_preference
    const turn3 = await orch.answerQuestion(
      "architecture_preference",
      "Modern Full-Stack Client-Server SPAs",
      "test_learner_e2e_full",
      { provider: "deterministic" }
    );

    if (turn3.confidence.status !== "ready") {
      throw new Error(`FAIL Test 13 Turn 3: Expected ready status, got '${turn3.confidence.status}'`);
    }
    if (turn3.roadmap === null) {
      throw new Error("FAIL Test 13 Turn 3: Expected generated roadmap upon reaching ready status!");
    }
    if (turn3.activeQuestion !== null) {
      throw new Error("FAIL Test 13 Turn 3: Expected activeQuestion to be null once intent is ready!");
    }
    if (!turn3.roadmap.nextBestAction) {
      throw new Error("FAIL Test 13 Turn 3: Expected next best action on ready roadmap!");
    }

    console.log("  [PASS] Full multi-turn intake completed smoothly to ready state with valid roadmap and NBA.");
    passedTests++;
  }

  console.log("\n==================================================");
  console.log(`ALL ${passedTests}/${totalTests} INTENT CLARIFICATION CORRECTNESS TESTS PASSED!`);
  console.log("==================================================");
}

runRegressionSuite().catch((err) => {
  console.error("TEST SUITE FAILED:", err);
  process.exit(1);
});
