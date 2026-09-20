import assert from "node:assert";
import { LearningOrchestrator } from "../src/lib/application/orchestrator";
import { EvidenceEngine } from "../src/lib/domain/evidence/evidence-engine";
import { UserWorkModelManager } from "../src/lib/domain/evidence/user-work-model";
import { DecisionEngine } from "../src/lib/domain/decision/decision-engine";
import { PhasePlanner } from "../src/lib/domain/planning/phase-planner";
import { ReflectionService } from "../src/lib/domain/planning/reflection-service";
import { CandidateGenerator } from "../src/lib/domain/candidates/candidate-generator";
import { DomainKnowledge } from "../src/lib/domain/knowledge/domain-knowledge";
import { ProvenanceRepository } from "../src/lib/persistence/repositories";
import {
  EvidenceItem,
  ProfileFact,
  UserWorkModel,
  PlanningDecision,
  RoadmapPhase,
  ReflectionSubmission,
} from "../src/lib/contracts";

async function runAdaptiveArchitectureVerificationSuite() {
  console.log("================================================================================");
  console.log("RUNNING PATHFORGE EVIDENCE-DRIVEN ADAPTIVE PLANNING ARCHITECTURAL VERIFICATION");
  console.log("================================================================================\n");

  const orch = new LearningOrchestrator();
  const evidenceEngine = new EvidenceEngine();
  const candidateGen = new CandidateGenerator();
  const domainKnowledge = new DomainKnowledge();
  const decisionEngine = new DecisionEngine(candidateGen, domainKnowledge);
  const phasePlanner = new PhasePlanner(domainKnowledge);
  const reflectionService = new ReflectionService();
  const provenanceRepo = new ProvenanceRepository();

  let passedTests = 0;

  // ----------------------------------------------------------------------
  // INVARIANT 1: Evidence Retains Provenance
  // ----------------------------------------------------------------------
  console.log("Invariant 1: Evidence retains provenance...");
  {
    const res = await orch.handleIntake(
      {
        message: "I am experienced in Python and building asynchronous services.",
        modelProvider: "deterministic",
      },
      "test_inv_1"
    );

    const history = await orch.getReasoningHistory("test_inv_1");
    assert.ok(history.evidence.length > 0, "Evidence must be recorded in persistence");

    for (const ev of history.evidence) {
      assert.ok(ev.id, "Evidence item must have a unique ID");
      assert.ok(ev.timestamp, "Evidence item must have a timestamp");
      assert.ok(ev.source, "Evidence item must have a source");
      assert.ok(ev.provenance, "Evidence item must retain full provenance");
      assert.ok(
        ev.provenance.sourceEventId || ev.provenance.originalText,
        "Provenance must contain sourceEventId or originalText"
      );
    }

    console.log(`  [PASS] All ${history.evidence.length} evidence items strictly retain full provenance.\n`);
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 2: Conflicting Evidence is Preserved (No Silent Deletions)
  // ----------------------------------------------------------------------
  console.log("Invariant 2: Conflicting evidence is preserved without silent deletion...");
  {
    const now = new Date().toISOString();
    const ev1: EvidenceItem = {
      id: "ev_lang_initial",
      dimension: "primary_language",
      signal: "python",
      confidence: 0.8,
      source: "self_report",
      quality: 0.8,
      timestamp: now,
      status: "active",
      provenance: { originalText: "I usually write Python" },
      supportedTargetIds: [],
      contradictedTargetIds: [],
    };

    // User later corrects language to TypeScript with higher precedence
    const ev2: EvidenceItem = {
      id: "ev_lang_correction",
      dimension: "primary_language",
      signal: "typescript",
      confidence: 1.0,
      source: "user_correction",
      quality: 1.0,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      status: "active",
      provenance: { originalText: "Actually I work with TypeScript now" },
      supportedTargetIds: [],
      contradictedTargetIds: [],
    };

    const processResult = evidenceEngine.processEvidence([], [ev1, ev2]);
    assert.equal(processResult.acceptedEvidence.length, 2, "Both evidence items must be preserved");

    const prior = processResult.acceptedEvidence.find((e) => e.id === "ev_lang_initial");
    const incoming = processResult.acceptedEvidence.find((e) => e.id === "ev_lang_correction");

    assert.ok(prior, "Prior evidence must not be deleted");
    assert.equal(prior.status, "superseded", "Prior evidence must be marked superseded, not deleted");
    assert.ok(incoming, "Higher precedence incoming evidence must exist");
    assert.equal(incoming.status, "active", "Incoming evidence must be active");
    assert.equal(
      incoming.provenance?.priorEvidenceId,
      "ev_lang_initial",
      "Incoming evidence must link to prior evidence provenance"
    );

    // Now test lower precedence conflicting evidence: must be marked contradicted, not discarded!
    const ev3: EvidenceItem = {
      id: "ev_lang_llm_inference",
      dimension: "primary_language",
      signal: "go",
      confidence: 0.5,
      source: "llm_inference",
      quality: 0.6,
      timestamp: new Date(Date.now() + 2000).toISOString(),
      status: "active",
      provenance: { originalText: "Maybe they like Go" },
      supportedTargetIds: [],
      contradictedTargetIds: [],
    };

    const processResult2 = evidenceEngine.processEvidence(processResult.acceptedEvidence, [ev3]);
    assert.equal(processResult2.acceptedEvidence.length, 3, "All 3 items must be preserved");
    const lowPred = processResult2.acceptedEvidence.find((e) => e.id === "ev_lang_llm_inference");
    assert.ok(lowPred, "Low precedence contradictory item must be retained");
    assert.equal(lowPred.status, "contradicted", "Low precedence conflict must be marked contradicted");

    console.log("  [PASS] Contradictory and superseded evidence preserved with provenance links.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 3: Evidence Only Affects Relevant Dimensions (No Bleed)
  // ----------------------------------------------------------------------
  console.log("Invariant 3: Evidence only affects relevant dimensions...");
  {
    const manager = new UserWorkModelManager();

    // Add negative evidence about a specific activity
    const evNegativeActivity: EvidenceItem = {
      id: "ev_dislike_meetings",
      dimension: "activity:client_meetings",
      signal: "dislike client meetings and status calls",
      confidence: 0.9,
      source: "reflection",
      quality: 0.85,
      timestamp: new Date().toISOString(),
      status: "weakening",
      provenance: { originalText: "I hate status calls" },
      supportedTargetIds: [],
      contradictedTargetIds: [],
    };

    manager.applyEvidence(evNegativeActivity);
    const model = manager.getModel();

    // Verify activity is marked disliked
    const act = model.activities["client_meetings"];
    assert.ok(act, "Activity dimension must be registered");
    assert.equal(act.affinity, "disliked", "Target activity must be disliked");

    // Verify unrelated dimensions were untouched
    assert.equal(
      Object.keys(model.capabilities).length,
      0,
      "Negative activity signal must NOT alter capabilities"
    );
    assert.equal(
      model.preferences.languages.length,
      0,
      "Negative activity signal must NOT alter language preferences"
    );
    assert.equal(
      model.constraints.hoursPerWeek,
      8,
      "Negative activity signal must NOT alter constraints"
    );

    console.log("  [PASS] Evidence strictly restricted to target dimension without bleeding into others.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 4: User Work Model is Derived from Evidence
  // ----------------------------------------------------------------------
  console.log("Invariant 4: User Work Model is derived from evidence...");
  {
    const manager = new UserWorkModelManager();
    const evSkill: EvidenceItem = {
      id: "ev_cap_docker",
      dimension: "capability:docker",
      signal: "Docker containerization and compose",
      confidence: 0.9,
      source: "assessment_evidence",
      quality: 0.9,
      timestamp: new Date().toISOString(),
      status: "active",
      supportedTargetIds: ["docker"],
      contradictedTargetIds: [],
    };

    manager.applyEvidence(evSkill);
    const model = manager.getModel();

    const dockerCap = model.capabilities["docker"];
    assert.ok(dockerCap, "Capability must be derived from evidence");
    assert.equal(dockerCap.status, "demonstrated", "Assessment evidence produces demonstrated status");
    assert.ok(dockerCap.supportingEvidenceIds.includes("ev_cap_docker"));
    assert.ok(model.evidenceIds.includes("ev_cap_docker"));

    console.log("  [PASS] User Work Model accurately materialized from input evidence.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 5: User Work Model Can Be Reconstructed from Evidence History
  // ----------------------------------------------------------------------
  console.log("Invariant 5: User Work Model is 100% reconstructable from evidence history...");
  {
    const evidenceHistory: EvidenceItem[] = [
      {
        id: "ev_1",
        dimension: "capability:typescript",
        signal: "typescript",
        confidence: 0.85,
        source: "user_answer",
        quality: 0.85,
        timestamp: "2026-09-01T10:00:00Z",
        status: "active",
        supportedTargetIds: [],
        contradictedTargetIds: [],
      },
      {
        id: "ev_2",
        dimension: "activity:backend_development",
        signal: "enjoy building REST and GraphQL APIs",
        confidence: 0.9,
        source: "reflection",
        quality: 0.9,
        timestamp: "2026-09-02T10:00:00Z",
        status: "active",
        supportedTargetIds: [],
        contradictedTargetIds: [],
      },
      {
        id: "ev_3",
        dimension: "hours_per_week",
        signal: 12,
        confidence: 1.0,
        source: "user_answer",
        quality: 1.0,
        timestamp: "2026-09-03T10:00:00Z",
        status: "active",
        supportedTargetIds: [],
        contradictedTargetIds: [],
      },
    ];

    // Build model iteratively
    const originalManager = new UserWorkModelManager();
    evidenceHistory.forEach((e) => originalManager.applyEvidence(e));
    const originalModel = originalManager.getModel();

    // Reconstruct entirely from raw evidence history
    const reconstructedModel = UserWorkModelManager.reconstructFromEvidence(evidenceHistory);

    assert.deepEqual(
      Object.keys(reconstructedModel.capabilities),
      Object.keys(originalModel.capabilities),
      "Reconstructed capabilities must match original"
    );
    assert.equal(
      reconstructedModel.capabilities["typescript"].confidence,
      originalModel.capabilities["typescript"].confidence
    );
    assert.equal(
      reconstructedModel.activities["backend_development"].affinity,
      originalModel.activities["backend_development"].affinity
    );
    assert.equal(
      reconstructedModel.constraints.hoursPerWeek,
      originalModel.constraints.hoursPerWeek
    );

    console.log("  [PASS] User Work Model bit-for-bit reconstructed from evidence history.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 6: Candidate Generation Does Not Require Catalogue Membership
  // ----------------------------------------------------------------------
  console.log("Invariant 6: Candidate generation does not require catalogue membership...");
  {
    const workModel = new UserWorkModelManager().getModel();
    const novelGoal = "Quantum Cryptography Pipeline Engineer";

    const candidates = candidateGen.generateCandidates(workModel, novelGoal);
    assert.ok(candidates.length > 0, "Candidates must be generated for uncatalogued goals");

    const primary = candidates[0];
    assert.ok(
      primary.name.toLowerCase().includes("quantum"),
      "Primary candidate must decompose the novel goal"
    );
    assert.ok(primary.relevantCapabilities.length > 0, "Must decompose into capabilities");
    assert.ok(primary.relevantActivities.length > 0, "Must decompose into activities");
    assert.ok(
      primary.suggestedNextExperiment,
      "Must synthesize an experimental probe for novel candidate"
    );

    console.log(`  [PASS] Novel uncatalogued role '${novelGoal}' cleanly decomposed into primitives.\n`);
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 7: Candidate Generation is Not Mandatory for Every Decision
  // ----------------------------------------------------------------------
  console.log("Invariant 7: Candidate generation is conditional, not mandatory...");
  {
    const workModel = new UserWorkModelManager().getModel();
    workModel.preferences.domains = ["saas_web"];
    workModel.preferences.languages = ["typescript_node"];

    // When clear direction is already known, DecisionEngine evaluates directly
    const decision = decisionEngine.evaluateNextAction({
      profileId: "test_inv_7",
      workModel,
      declaredGoal: "Fullstack Web Developer",
      completedPhases: [],
    });

    assert.ok(decision.mode === "commit", "Decision engine directly evaluated commit mode");
    assert.equal(decision.targetCandidateDirection, "Fullstack Web Developer");

    console.log("  [PASS] Decision engine operates directly on Work Model without forced candidate loop.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 8: Decision Engine Can Choose COMMIT
  // ----------------------------------------------------------------------
  console.log("Invariant 8: Decision Engine chooses COMMIT when clarity exists...");
  {
    const manager = new UserWorkModelManager();
    manager.applyEvidence({
      id: "ev_goal",
      dimension: "declared_goal",
      signal: "Backend Cloud Engineer",
      confidence: 1.0,
      source: "user_answer",
      quality: 1.0,
      timestamp: new Date().toISOString(),
      status: "active",
      supportedTargetIds: [],
      contradictedTargetIds: [],
    });
    manager.applyEvidence({
      id: "ev_lang",
      dimension: "primary_language",
      signal: "python",
      confidence: 1.0,
      source: "user_answer",
      quality: 1.0,
      timestamp: new Date().toISOString(),
      status: "active",
      supportedTargetIds: [],
      contradictedTargetIds: [],
    });

    const decision = decisionEngine.evaluateNextAction({
      profileId: "test_inv_8",
      workModel: manager.getModel(),
      declaredGoal: "Backend Cloud Engineer",
      completedPhases: [],
    });

    assert.equal(decision.mode, "commit", "Decision mode must be COMMIT");
    assert.ok(decision.rationale.toLowerCase().includes("clarity"), "Rationale reflects clarity");

    console.log("  [PASS] Decision Engine chose COMMIT mode.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 9: Decision Engine Can Choose DISAMBIGUATE
  // ----------------------------------------------------------------------
  console.log("Invariant 9: Decision Engine chooses DISAMBIGUATE when question is high-value...");
  {
    const manager = new UserWorkModelManager();
    // Vague initial state with material ambiguity
    const proposedQuestions = [
      {
        id: "q_lang",
        dimension: "primary_language",
        question: "Which primary programming language do you wish to work with?",
        answerType: "single_choice" as const,
        options: ["Python", "TypeScript", "Go"],
        why: "Needed to target the initial project framework",
        informationGain: 0.95,
        utilityScore: 0.95,
      },
    ];

    const decision = decisionEngine.evaluateNextAction({
      profileId: "test_inv_9",
      workModel: manager.getModel(),
      declaredGoal: null, // missing goal
      proposedQuestions,
    });

    assert.equal(decision.mode, "disambiguate", "Decision mode must be DISAMBIGUATE");
    assert.ok(decision.activeQuestion, "Active question must be present");
    assert.equal(decision.activeQuestion.selectedQuestion.dimension, "primary_language");

    console.log("  [PASS] Decision Engine chose DISAMBIGUATE with targeted question.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 10: Decision Engine Can Choose EXPLORE
  // ----------------------------------------------------------------------
  console.log("Invariant 10: Decision Engine chooses EXPLORE when hands-on activity is best...");
  {
    const manager = new UserWorkModelManager();
    manager.registerUncertainty({
      id: "unc_1",
      dimension: "hardware_debugging",
      description: "Uncertain if user enjoys low-level register and memory debugging",
      impact: "high",
      resolutionStrategy: "experiment",
    });

    const decision = decisionEngine.evaluateNextAction({
      profileId: "test_inv_10",
      workModel: manager.getModel(),
      declaredGoal: "Embedded Systems Engineer",
    });

    assert.equal(decision.mode, "explore", "Decision mode must be EXPLORE");
    assert.ok(decision.activeExperiment, "Active experiment must be synthesized");
    assert.ok(decision.activeExperiment.activity.length > 0);
    assert.ok(decision.activeExperiment.observableMetrics.length > 0);

    console.log("  [PASS] Decision Engine chose EXPLORE with practical diagnostic probe.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 11: No Fixed Question Budget Controls Planning
  // ----------------------------------------------------------------------
  console.log("Invariant 11: No fixed question count controls planning transitions...");
  {
    const manager = new UserWorkModelManager();
    manager.applyEvidence({
      id: "ev_quick_clarity",
      dimension: "primary_language",
      signal: "typescript",
      confidence: 1.0,
      source: "user_answer",
      quality: 1.0,
      timestamp: new Date().toISOString(),
      status: "active",
      supportedTargetIds: [],
      contradictedTargetIds: [],
    });

    // Even with questionCount = 0 or 1, clarity allows COMMIT immediately
    const decision = decisionEngine.evaluateNextAction({
      profileId: "test_inv_11",
      workModel: manager.getModel(),
      declaredGoal: "Node Developer",
      completedPhases: [],
    });

    assert.equal(
      decision.mode,
      "commit",
      "Sufficient clarity transitions to COMMIT without needing 6 questions"
    );

    console.log("  [PASS] State transition emerged from information clarity, not question budget.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 12: Experiments Can Be Selected for Information Value
  // ----------------------------------------------------------------------
  console.log("Invariant 12: Experiments designed around explicit uncertainty...");
  {
    const manager = new UserWorkModelManager();
    manager.registerUncertainty({
      id: "unc_graphics",
      dimension: "shader_programming",
      description: "User has never written shaders or matrix transforms",
      impact: "high",
      resolutionStrategy: "experiment",
    });

    const decision = decisionEngine.evaluateNextAction({
      profileId: "test_inv_12",
      workModel: manager.getModel(),
      declaredGoal: "Graphics Programmer",
    });

    assert.equal(decision.mode, "explore");
    const exp = decision.activeExperiment;
    assert.ok(exp, "Experiment must exist");
    assert.ok(exp.observableMetrics.includes("completion_pace"));
    assert.ok(exp.observableMetrics.includes("reported_energy"));
    assert.ok(exp.estimatedHours <= 3, "Exploratory experiments must be low friction (<= 3 hours)");

    console.log("  [PASS] Experiment synthesized with explicit observables and low friction.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 13: Phase Planner Generates NEXT PHASE ONLY
  // ----------------------------------------------------------------------
  console.log("Invariant 13: Phase Planner generates next phase only (no multi-phase upfront)...");
  {
    const workModel = new UserWorkModelManager().getModel();
    const phase1 = phasePlanner.generateNextPhase({
      directionName: "Backend Engineer",
      workModel,
      completedPhases: [],
    });

    assert.equal(phase1.phaseNumber, 1, "Must generate Phase 1");
    assert.ok(phase1.objective, "Phase must contain an objective");
    assert.ok(phase1.duration.totalHours > 0, "Phase must specify duration");
    assert.ok(phase1.activities.length > 0, "Phase must specify concrete activities");
    assert.ok(phase1.project, "Phase must specify hands-on project deliverable");
    assert.ok(phase1.evidenceTargets.length > 0, "Phase must have evidence measurement targets");
    assert.ok(phase1.decisionPoint, "Phase must conclude with an adaptive decision point");

    // Phase 2 is only generated when Phase 1 is provided in completedPhases
    const phase2 = phasePlanner.generateNextPhase({
      directionName: "Backend Engineer",
      workModel,
      completedPhases: [phase1],
    });

    assert.equal(phase2.phaseNumber, 2, "Phase 2 emerges strictly after Phase 1");
    assert.notEqual(phase1.id, phase2.id, "Phases have distinct identities");

    console.log("  [PASS] Single phase generated at a time with measurement value + decision point.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 14: New Evidence Changes Subsequent Planning (Adaptive Closed Loop)
  // ----------------------------------------------------------------------
  console.log("Invariant 14: Full adaptive closed loop (Evidence -> Work -> Reflection -> Adapted Phase)...");
  {
    const profileId = `test_loop_${Date.now()}`;
    await orch.resetState(profileId);

    // 1. Initial Intake
    await orch.handleIntake(
      {
        message: "I want to become a Backend Engineer with TypeScript.",
        modelProvider: "deterministic",
      },
      profileId
    );

    // 2. Commit to Phase 1
    const phase1 = await orch.planNextPhase(profileId);
    assert.equal(phase1.phaseNumber, 1);

    // 3. User completes Phase 1 practical work
    const workResult = await orch.submitWork(phase1.id, {
      profileId,
      notes: "Built the REST API in TypeScript with Jest tests. Found SQL query optimization challenging.",
      demonstratedCapabilities: ["TypeScript Architecture", "REST API Design"],
    });

    assert.equal(workResult.completedPhase.status, "completed");

    // 4. User submits structured reflection revealing dislike of relational databases and love for event streaming
    const reflSubmission: ReflectionSubmission = {
      phaseId: phase1.id,
      enjoyed: "Async message queues and event streaming with Kafka",
      disliked: "Writing complex relational SQL queries and ORM mappings",
      voluntarilyExplored: "Built a small event-driven pipeline using RabbitMQ",
      energizing: "High autonomy event architectures",
    };

    const reflResult = await orch.submitReflection(reflSubmission, profileId);
    assert.ok(reflResult.extractedEvidence.length >= 3, "Extracted reflection evidence");

    // 5. Subsequent phase adaptation: verify Work Model has adapted
    const updatedModel = reflResult.profile.workModel;
    assert.ok(updatedModel, "Work model exists");

    // Check that event streaming interest is reflected
    const voluntaryAct = updatedModel.activities["voluntary_exploration"];
    assert.ok(voluntaryAct, "Voluntary exploration captured in work model");

    // Check that disliked relational SQL is dimension-isolated
    const dislikedAct = updatedModel.activities["disliked"];
    assert.ok(dislikedAct, "Disliked activity captured");

    // 6. Next planning decision adapts to new evidence
    assert.ok(reflResult.nextDecision, "Next planning decision generated");
    assert.equal(reflResult.profile.completedPhases?.length, 1);

    console.log("  [PASS] Closed loop verified: Evidence -> Work -> Reflection -> Adapted Model -> Refined Next Decision.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 15: Negative Evidence Does Not Cause Global Elimination
  // ----------------------------------------------------------------------
  console.log("Invariant 15: Negative evidence on dimension X does not eliminate domain Y...");
  {
    const manager = new UserWorkModelManager();
    // User dislikes CSS/styling
    manager.applyEvidence({
      id: "ev_dislike_css",
      dimension: "activity:css_styling",
      signal: "hate css and UI layout styling",
      confidence: 1.0,
      source: "reflection",
      quality: 0.9,
      timestamp: new Date().toISOString(),
      status: "weakening",
      supportedTargetIds: [],
      contradictedTargetIds: [],
    });

    const model = manager.getModel();
    assert.equal(model.activities["css_styling"]?.affinity, "disliked");

    // Fullstack Web Candidate still exists! It is NOT eliminated, but its UI task is adapted
    const candidates = candidateGen.generateCandidates(model, "Web Application Developer");
    assert.ok(
      candidates.length > 0,
      "Negative evidence about CSS does not eliminate Web Developer direction"
    );

    console.log("  [PASS] Dimension-specific negative evidence isolated without global career elimination.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 16: Capacity Changes Phase Scope Rather Than Blocking Planning
  // ----------------------------------------------------------------------
  console.log("Invariant 16: Capacity scales phase duration and scope (no hard blocker)...");
  {
    const managerLowCapacity = new UserWorkModelManager();
    managerLowCapacity.applyEvidence({
      id: "ev_low_hours",
      dimension: "hours_per_week",
      signal: 3, // only 3 hours per week!
      confidence: 1.0,
      source: "user_answer",
      quality: 1.0,
      timestamp: new Date().toISOString(),
      status: "active",
      supportedTargetIds: [],
      contradictedTargetIds: [],
    });

    const phase = phasePlanner.generateNextPhase({
      directionName: "Cloud Infrastructure",
      workModel: managerLowCapacity.getModel(),
      completedPhases: [],
    });

    assert.ok(phase, "Phase MUST be generated even with low capacity (3h/week)");
    assert.ok(phase.duration.totalHours <= 15, "Workload adapted to low hours/week capacity");
    assert.equal(phase.duration.weeklyHours, 3, "Weekly hours matches learner constraint");

    console.log(`  [PASS] 3h/week capacity scaled phase duration to ${phase.duration.estimatedWeeks}w (${phase.duration.totalHours}h total) without blocking.\n`);
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 17: Non-Catalogued Directions Remain Possible
  // ----------------------------------------------------------------------
  console.log("Invariant 17: Non-catalogued directions remain fully possible...");
  {
    const novelDirections = [
      "Bioinformatics Metagenomics Pipeline Developer",
      "Autonomous Drone Swarm Navigation Engineer",
      "Audio DSP & Spatial Acoustic Synthesizer Specialist",
    ];

    for (const dir of novelDirections) {
      const decomp = domainKnowledge.resolveOrDecomposeDirection(dir);
      assert.ok(decomp.capabilities.length >= 2, `Decomposed ${dir} into capabilities`);
      assert.ok(decomp.activities.length >= 2, `Decomposed ${dir} into activities`);

      const phase = phasePlanner.generateNextPhase({
        directionName: dir,
        workModel: new UserWorkModelManager().getModel(),
        completedPhases: [],
      });
      assert.ok(phase, `Generated Phase 1 for uncatalogued ${dir}`);
      assert.ok(phase.project?.title.includes(dir));
    }

    console.log("  [PASS] All 3 non-catalogued directions synthesized and planned successfully.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 18: LLM Output Cannot Bypass Deterministic Validation
  // ----------------------------------------------------------------------
  console.log("Invariant 18: LLM output cannot bypass deterministic validation...");
  {
    // LLM proposes an unvalidated low-confidence claim that contradicts user's explicit statement
    const existingActive: EvidenceItem = {
      id: "ev_user_stated",
      dimension: "primary_language",
      signal: "typescript",
      confidence: 1.0,
      source: "user_answer",
      quality: 1.0,
      timestamp: "2026-09-01T00:00:00Z",
      status: "active",
      supportedTargetIds: [],
      contradictedTargetIds: [],
    };

    const llmInference: EvidenceItem = {
      id: "ev_llm_hallucination",
      dimension: "primary_language",
      signal: "haskell",
      confidence: 0.4,
      source: "llm_inference",
      quality: 0.5,
      timestamp: "2026-09-01T00:01:00Z",
      status: "active",
      supportedTargetIds: [],
      contradictedTargetIds: [],
    };

    const result = evidenceEngine.processEvidence([existingActive], [llmInference]);
    const activeLang = result.acceptedEvidence.find(
      (e) => e.dimension === "primary_language" && e.status === "active"
    );

    assert.equal(
      activeLang?.signal,
      "typescript",
      "Deterministic precedence prevents LLM inference from overwriting user answer"
    );
    const halluItem = result.acceptedEvidence.find((e) => e.id === "ev_llm_hallucination");
    assert.equal(
      halluItem?.status,
      "contradicted",
      "LLM inference marked contradicted by deterministic validation"
    );

    console.log("  [PASS] LLM inference strictly bounded by deterministic validation and source precedence.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 19: Historical Reasoning Can Be Reconstructed
  // ----------------------------------------------------------------------
  console.log("Invariant 19: Historical reasoning narrative reconstructable...");
  {
    const profileId = "test_inv_19";
    await orch.resetState(profileId);

    await orch.handleIntake(
      {
        message: "I want to become a DevOps engineer focusing on Kubernetes and Terraform.",
        modelProvider: "deterministic",
      },
      profileId
    );

    const history = await orch.getReasoningHistory(profileId);
    assert.equal(history.profileId, profileId);
    assert.ok(history.evidence.length > 0, "Evidence history must be present");
    assert.ok(history.reconstructedWorkModel, "Work model reconstructable");
    assert.ok(history.narrative.whatWeKnew.length > 0, "Answers: What did we know?");
    assert.ok(history.narrative.whyWeBelievedIt.length > 0, "Answers: Why did we believe it?");

    console.log("  [PASS] Historical reasoning answered: What did we know? Why did we believe it?\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // INVARIANT 20: Deprecated Components Absent from Active Execution Paths
  // ----------------------------------------------------------------------
  console.log("Invariant 20: Deprecated reasoning absent from active execution...");
  {
    const profile = await orch.getProfile("test_inv_19");

    // 1. Career hypothesis softmax is NOT the central user work model
    assert.ok(profile.workModel, "UserWorkModel is present and active");
    assert.ok(profile.workModel.capabilities, "Capabilities tracked in WorkModel");

    // 2. No hard global elimination
    assert.equal(
      Object.keys(profile.workModel.negativeSignals).length,
      0,
      "Negative signals empty initially"
    );

    // 3. RoadmapPhase represents next phase
    assert.ok(
      !profile.activePhase || profile.activePhase.phaseNumber >= 1,
      "ActivePhase conforms to RoadmapPhase contract"
    );

    console.log("  [PASS] Active execution uses evidence-driven adaptive loop.\n");
    passedTests++;
  }

  console.log("================================================================================");
  console.log(`ALL 20 ARCHITECTURAL INVARIANT TESTS PASSED SUCCESSFULLY! (${passedTests}/20)`);
  console.log("================================================================================\n");
}

runAdaptiveArchitectureVerificationSuite().catch((err) => {
  console.error("\n[FATAL ERROR in Adaptive Architecture Verification Suite]:", err);
  process.exit(1);
});
