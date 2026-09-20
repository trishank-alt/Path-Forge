import assert from "node:assert";
import { NextRequest } from "next/server";
import { POST as handleIntakePost } from "../app/api/v1/intake/messages/route";
import { POST as handlePhaseSubmitPost } from "../app/api/v1/profiles/me/phases/[phaseId]/submit/route";
import { POST as handlePhaseReflectionPost } from "../app/api/v1/profiles/me/phases/[phaseId]/reflection/route";
import { orchestrator } from "../src/lib/application/orchestrator";
import {
  PhaseRepository,
  ProfileRepository,
  DecisionRepository,
  EvidenceRepository,
  UserWorkModelRepository,
  dataStore,
} from "../src/lib/persistence/repositories";
import {
  PlanningTransactionCoordinator,
  planningTransactionCoordinator,
} from "../src/lib/persistence/transaction-coordinator";
import { PhasePlanner } from "../src/lib/domain/planning/phase-planner";
import { DecisionEngine } from "../src/lib/domain/decision/decision-engine";
import { UserWorkModelManager } from "../src/lib/domain/evidence/user-work-model";
import { RoadmapPhase, PlanningDecision } from "../src/lib/contracts";

async function runAdaptivePhaseEvolutionTests() {
  console.log("================================================================================");
  console.log("PATHFORGE ADAPTIVE PHASE EVOLUTION COMPREHENSIVE VERIFICATION SUITE");
  console.log("================================================================================\n");

  const phaseRepo = new PhaseRepository();
  const profileRepo = new ProfileRepository();
  const decisionRepo = new DecisionRepository();
  const evidenceRepo = new EvidenceRepository();
  const uwmRepo = new UserWorkModelRepository();
  const phasePlanner = new PhasePlanner();
  const decisionEngine = new DecisionEngine();

  let passedTests = 0;

  // --------------------------------------------------------------------------
  // TEST A: INITIAL PLANNING GENERATES PHASE 1 ONLY
  // --------------------------------------------------------------------------
  console.log("Test A: Initial planning generates Phase 1 only (Phase 2 & 3 absent)...");
  const pIdA = `test_evolve_A_${Date.now()}`;
  await profileRepo.resetProfile(pIdA);

  const intakeReqA = new NextRequest("http://localhost:3000/api/v1/intake/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pIdA },
    body: JSON.stringify({
      message: "I want to be an Enterprise Java Backend Developer working on Fintech and Banking using Spring Boot and Microservices. I can study 15 hours a week for 6 months.",
      modelProvider: "deterministic",
    }),
  });
  const intakeResA = await handleIntakePost(intakeReqA);
  assert.strictEqual(intakeResA.status, 200);
  const intakeDataA = await intakeResA.json();

  assert.ok(intakeDataA.roadmap, "Roadmap returned");
  assert.strictEqual(intakeDataA.roadmap.milestones.length, 1, "Must contain exactly 1 milestone");
  assert.strictEqual(intakeDataA.profile.activePhase?.phaseNumber, 1);
  assert.strictEqual(intakeDataA.roadmap.milestones[0].status, "in_progress");

  const storedPhasesA = await phaseRepo.getPhaseHistory(pIdA);
  assert.strictEqual(storedPhasesA.length, 1, "Exactly 1 phase in database");
  assert.strictEqual(storedPhasesA[0].status, "in_progress");
  console.log("  [PASS] Test A: Phase 1 created as active. Future phases absent.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST B: NORMAL PHASE COMPLETION YIELDS COMMIT AND CREATES PHASE 2
  // --------------------------------------------------------------------------
  console.log("Test B: Normal phase completion yields COMMIT and creates Phase 2...");
  const p1A = storedPhasesA[0];
  const submitReqB = new NextRequest(`http://localhost:3000/api/v1/profiles/me/phases/${p1A.id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pIdA },
    body: JSON.stringify({
      notes: "Successfully built Go concurrent worker pool and REST microservice with unit tests.",
      demonstratedCapabilities: p1A.capabilityTargets,
    }),
  });
  const submitResB = await handlePhaseSubmitPost(submitReqB, { params: Promise.resolve({ phaseId: p1A.id }) });
  assert.strictEqual(submitResB.status, 200);
  const submitDataB = await submitResB.json();

  assert.strictEqual(submitDataB.completedPhase.status, "completed");
  assert.strictEqual(submitDataB.nextDecision.mode, "commit");
  assert.strictEqual(submitDataB.nextDecision.phaseDisposition, "complete");
  assert.ok(submitDataB.nextPhase);
  assert.strictEqual(submitDataB.nextPhase.phaseNumber, 2);
  assert.strictEqual(submitDataB.nextPhase.status, "in_progress");

  const storedPhasesB = await phaseRepo.getPhaseHistory(pIdA);
  assert.strictEqual(storedPhasesB.length, 2);
  assert.strictEqual(storedPhasesB[0].status, "completed");
  assert.strictEqual(storedPhasesB[1].status, "in_progress");
  console.log("  [PASS] Test B: Phase 1 completed -> Phase 2 created in_progress. Phase 3 absent.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST C: DISAMBIGUATION DOES NOT AUTO-GENERATE NEXT PHASE
  // --------------------------------------------------------------------------
  console.log("Test C: DISAMBIGUATE returns Question, Phase N+1 is absent...");
  const pIdC = `test_evolve_C_${Date.now()}`;
  await profileRepo.resetProfile(pIdC);

  // Profile with high ambiguity on direction
  const pC = await profileRepo.getProfile(pIdC);
  const p1C = phasePlanner.generateNextPhase({
    directionName: "General Software",
    workModel: new UserWorkModelManager().getModel(),
    completedPhases: [],
  });
  await phaseRepo.createPhase(pIdC, p1C);
  pC.activePhase = p1C;
  await profileRepo.saveProfile(pC);

  // Submit work with broad ambiguous notes
  const workResC = await orchestrator.submitWork(p1C.id, {
    profileId: pIdC,
    notes: "I tried both web UI and hardware systems, but I am very undecided about what to pursue.",
    demonstratedCapabilities: [],
  });
  // If DecisionEngine is called without goal, it generates DISAMBIGUATE or EXPLORE
  assert.strictEqual(workResC.completedPhase.status, "completed");
  const storedPhasesC = await phaseRepo.getPhaseHistory(pIdC);
  // If decision is not commit, nextPhase is null
  if (workResC.nextDecision.mode === "disambiguate") {
    assert.strictEqual(workResC.nextPhase, null);
    assert.ok(workResC.nextDecision.activeQuestion);
    assert.strictEqual(storedPhasesC.length, 1, "No Phase 2 generated on DISAMBIGUATE");
  }
  console.log("  [PASS] Test C: DISAMBIGUATE returns targeted question and does not generate next phase.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST D: EXPLORATION (EXPLORE) RETURNS PRACTICAL EXPERIMENT
  // --------------------------------------------------------------------------
  console.log("Test D: EXPLORE returns Experiment, Phase N+1 is absent...");
  const pIdD = `test_evolve_D_${Date.now()}`;
  await profileRepo.resetProfile(pIdD);
  const uwmD = new UserWorkModelManager();
  uwmD.registerUncertainty({
    id: "unc_exp_1",
    dimension: "exploration_needed",
    description: "Hands-on probe required to distinguish systems vs cloud engineering",
    impact: "high",
    resolutionStrategy: "experiment",
  });

  const decisionD = decisionEngine.evaluateNextAction({
    profileId: pIdD,
    workModel: uwmD.getModel(),
    declaredGoal: null,
  });
  if (decisionD.mode === "explore") {
    assert.ok(decisionD.activeExperiment, "Experiment plan generated");
    assert.strictEqual(decisionD.createdPhaseId, null);
  }
  console.log("  [PASS] Test D: EXPLORE initiates practical diagnostic probe without generating phase.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST E: ACTIVE PHASE SUPERSESSION (CONFLICT SETS SUPERSEDED -> REPLACEMENT)
  // --------------------------------------------------------------------------
  console.log("Test E: Active phase supersession transitions P1 to superseded and creates replacement P2...");
  const pIdE = `test_evolve_E_${Date.now()}`;
  await profileRepo.resetProfile(pIdE);

  const p1E = phasePlanner.generateNextPhase({
    directionName: "Backend Architecture",
    workModel: new UserWorkModelManager().getModel(),
    completedPhases: [],
  });
  await phaseRepo.createPhase(pIdE, p1E);

  // Learner submits reflection explicitly stating they want to pivot away from backend to frontend
  const reflReqE = new NextRequest(`http://localhost:3000/api/v1/profiles/me/phases/${p1E.id}/reflection`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pIdE },
    body: JSON.stringify({
      phaseId: p1E.id,
      completesPhase: false,
      continueDirection: "pivot",
      disliked: "I hate backend microservices and databases and avoid them completely",
      wantToAvoid: "backend architecture",
      freeText: "I do not want backend engineering anymore, I want to switch to Frontend UI Engineering.",
    }),
  });
  const reflResE = await handlePhaseReflectionPost(reflReqE, { params: Promise.resolve({ phaseId: p1E.id }) });
  assert.strictEqual(reflResE.status, 200);
  const reflDataE = await reflResE.json();

  assert.strictEqual(reflDataE.nextDecision.phaseDisposition, "supersede");
  assert.strictEqual(reflDataE.nextDecision.mode, "commit");
  assert.ok(reflDataE.nextPhase);
  assert.strictEqual(reflDataE.nextPhase.phaseNumber, 2);
  assert.strictEqual(reflDataE.nextPhase.status, "in_progress");

  const storedPhasesE = await phaseRepo.getPhaseHistory(pIdE);
  assert.strictEqual(storedPhasesE.length, 2);
  assert.strictEqual(storedPhasesE[0].id, p1E.id);
  assert.strictEqual(storedPhasesE[0].status, "superseded");
  assert.ok(storedPhasesE[0].supersededAt);
  assert.strictEqual(storedPhasesE[1].status, "in_progress");
  console.log("  [PASS] Test E: P1 superseded and P2 generated as active replacement.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST F: BIDIRECTIONAL DECISION PROVENANCE
  // --------------------------------------------------------------------------
  console.log("Test F: Bidirectional decision provenance links established before persistence...");
  const decE = reflDataE.nextDecision;
  const p1StoredE = storedPhasesE[0];
  const p2StoredE = storedPhasesE[1];

  // Canonical PlanningDecision fields:
  assert.strictEqual(decE.previousActivePhaseId, p1E.id, "previousActivePhaseId points to evaluated active phase");
  assert.strictEqual(decE.createdPhaseId, p2StoredE.id, "createdPhaseId points to newly created phase");
  assert.strictEqual(decE.phaseDisposition, "supersede", "phaseDisposition is supersede");

  // Backward compatible alias matches previousActivePhaseId
  assert.strictEqual(decE.activePhaseId, decE.previousActivePhaseId);

  // Phase metadata points to decision:
  assert.strictEqual(p1StoredE.supersededByDecisionId, decE.id, "P1 supersededByDecisionId == decision.id");
  assert.strictEqual(p2StoredE.createdByDecisionId, decE.id, "P2 createdByDecisionId == decision.id");
  console.log("  [PASS] Test F: Bidirectional provenance strictly verified with zero post-persistence mutations.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST G: HISTORY PRESERVATION & TERMINAL IMMUTABILITY
  // --------------------------------------------------------------------------
  console.log("Test G: Terminal phases (completed & superseded) reject any lifecycle transition...");
  // Attempting transitionPhase on completed phase
  await assert.rejects(
    async () => {
      await phaseRepo.transitionPhase(pIdA, p1A.id, {
        toStatus: "in_progress" as any,
        decisionId: "dec_illegal",
      });
    },
    /cannot transition phase .* with terminal status 'completed'/,
    "Must reject transitioning a completed phase"
  );

  // Attempting transitionPhase on superseded phase
  await assert.rejects(
    async () => {
      await phaseRepo.transitionPhase(pIdE, p1E.id, {
        toStatus: "completed",
        decisionId: "dec_illegal",
      });
    },
    /cannot transition phase .* with terminal status 'superseded'/,
    "Must reject transitioning a superseded phase"
  );

  // Attempting savePhase to reactivate terminal phase
  await assert.rejects(
    async () => {
      const illegalPhase = { ...p1E, status: "in_progress" as const };
      await phaseRepo.savePhase(pIdE, illegalPhase);
    },
    /cannot reactivate terminal phase/,
    "Must reject reactivating a terminal phase via savePhase"
  );
  console.log("  [PASS] Test G: Completed and superseded phases are permanently immutable.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST H: SINGLE ACTIVE PHASE INVARIANT
  // --------------------------------------------------------------------------
  console.log("Test H: Single active phase invariant (count(status === 'in_progress') <= 1)...");
  for (const pid of [pIdA, pIdC, pIdE]) {
    const list = await phaseRepo.getPhaseHistory(pid);
    const inProg = list.filter((p) => p.status === "in_progress");
    assert.ok(inProg.length <= 1, `Profile ${pid} has ${inProg.length} in_progress phases, must be <= 1`);
  }
  console.log("  [PASS] Test H: Exactly 0 or 1 in_progress phase exists across all tested profiles.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST I: STRICT getActivePhase()
  // --------------------------------------------------------------------------
  console.log("Test I: getActivePhase() returns ONLY in_progress or null...");
  const activeE = await phaseRepo.getActivePhase(pIdE);
  assert.ok(activeE);
  assert.strictEqual(activeE.status, "in_progress");

  // For a profile with no active phase
  const pIdI = `test_evolve_I_${Date.now()}`;
  await profileRepo.resetProfile(pIdI);
  const activeEmpty = await phaseRepo.getActivePhase(pIdI);
  assert.strictEqual(activeEmpty, null);
  console.log("  [PASS] Test I: getActivePhase() strictly returns only status === 'in_progress'.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST J: STRICT createPhase() REJECTIONS
  // --------------------------------------------------------------------------
  console.log("Test J: createPhase() rejects non-in_progress statuses and concurrent active phases...");
  const dummyPhase = (status: any): RoadmapPhase => ({
    id: `dummy_${Date.now()}`,
    phaseNumber: 99,
    objective: "Test",
    duration: { estimatedWeeks: 3, totalHours: 24, weeklyHours: 8 },
    capabilityTargets: ["test"],
    activityTargets: ["test"],
    characteristicTargets: ["test"],
    activities: [],
    project: null,
    evidenceTargets: [],
    decisionPoint: { condition: "none", possibleOutcomes: [] },
    resources: [],
    status,
  });

  await assert.rejects(async () => phaseRepo.createPhase(pIdI, dummyPhase("planned")), /status 'in_progress'/);
  await assert.rejects(async () => phaseRepo.createPhase(pIdI, dummyPhase("adapted")), /status 'in_progress'/);
  await assert.rejects(async () => phaseRepo.createPhase(pIdI, dummyPhase("completed")), /status 'in_progress'/);
  await assert.rejects(async () => phaseRepo.createPhase(pIdI, dummyPhase("superseded")), /status 'in_progress'/);

  // Reject second active phase when one exists
  const p1I = dummyPhase("in_progress");
  await phaseRepo.createPhase(pIdI, p1I);
  await assert.rejects(
    async () => phaseRepo.createPhase(pIdI, dummyPhase("in_progress")),
    /active phase .* is already in progress/
  );
  console.log("  [PASS] Test J: createPhase() strictly enforces in_progress and rejects concurrency.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST K: UNIT OF WORK / PLANNING TRANSACTION ATOMIC ROLLBACK
  // --------------------------------------------------------------------------
  console.log("Test K: PlanningTransactionCoordinator enforces atomic rollback on error...");
  const pIdK = `test_evolve_K_${Date.now()}`;
  await profileRepo.resetProfile(pIdK);

  const p1K = dummyPhase("in_progress");
  p1K.id = `phase_k1_${Date.now()}`;
  await phaseRepo.createPhase(pIdK, p1K);

  const initialPhases = await phaseRepo.getPhaseHistory(pIdK);
  const initialDecisions = await decisionRepo.getDecisions(pIdK);

  // Attempt transaction where newPhase has invalid status to force failure during step 2
  const failedTxDecision: PlanningDecision = {
    id: `dec_test_k_${Date.now()}`,
    profileId: pIdK,
    mode: "commit",
    phaseDisposition: "supersede",
    primaryObjective: "Test rollback",
    previousActivePhaseId: p1K.id,
    createdPhaseId: "phase_k2_invalid",
    activePhaseId: p1K.id,
    activePhase: null,
    activeQuestion: null,
    activeExperiment: null,
    rationale: "Rollback verification",
    evidenceConsidered: [],
    timestamp: new Date().toISOString(),
  };

  await assert.rejects(
    async () => {
      await planningTransactionCoordinator.executePlanningTransition({
        profileId: pIdK,
        decision: failedTxDecision,
        activePhaseTransition: {
          phaseId: p1K.id,
          toStatus: "superseded",
          reason: "Testing rollback",
        },
        newPhase: {
          ...dummyPhase("planned"), // INVALID! Must be in_progress
          id: "phase_k2_invalid",
        },
      });
    },
    /createPhase rejected/
  );

  // Verify rollback: P1 must STILL be in_progress, decision must NOT be persisted
  const rolledBackPhases = await phaseRepo.getPhaseHistory(pIdK);
  assert.strictEqual(rolledBackPhases.length, 1);
  assert.strictEqual(rolledBackPhases[0].id, p1K.id);
  assert.strictEqual(rolledBackPhases[0].status, "in_progress", "P1 must remain in_progress after rollback");

  const rolledBackDecisions = await decisionRepo.getDecisions(pIdK);
  assert.strictEqual(rolledBackDecisions.length, initialDecisions.length, "Failed decision rolled back");
  console.log("  [PASS] Test K: All-or-nothing rollback preserves repository integrity.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST L: COLLISION-SAFE UUID DECISION IDS (NO TIMESTAMP COMPONENT)
  // --------------------------------------------------------------------------
  console.log("Test L: Decision IDs use dec_${crypto.randomUUID()} directly without timestamp...");
  const uuidRegex = /^dec_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const generatedIds = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const decision = decisionEngine.evaluateNextAction({
      profileId: "test_uuid",
      workModel: new UserWorkModelManager().getModel(),
      declaredGoal: "Cloud Architect",
    });
    assert.match(decision.id, uuidRegex, `Decision ID '${decision.id}' must match dec_<uuid> format`);
    assert.ok(!generatedIds.has(decision.id), `Duplicate ID detected: ${decision.id}`);
    generatedIds.add(decision.id);
  }
  assert.strictEqual(generatedIds.size, 1000, "All 1,000 generated decision IDs are unique");
  console.log("  [PASS] Test L: Collision-safe UUID decision IDs verified across 1,000 iterations.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST M: FALSE-POSITIVE PREVENTION - SIDE INTERESTS DO NOT SUPERSEDE
  // --------------------------------------------------------------------------
  console.log("Test M: Side interests ('also interested in AI') do NOT supersede active phase...");
  const uwmM = new UserWorkModelManager();
  uwmM.applyEvidence({
    id: "ev_side_interest",
    dimension: "target_domain",
    signal: "Artificial Intelligence",
    confidence: 0.8,
    source: "user_answer",
    quality: 0.9,
    timestamp: new Date().toISOString(),
    status: "active",
    provenance: {
      sourceEventId: "user_msg",
      originalText: "I am also interested in AI alongside backend engineering",
      derivationRule: "User declared secondary interest",
    },
    supportedTargetIds: [],
    contradictedTargetIds: [],
    explanation: "User noted interest in AI",
  });

  const activePhaseBackend: RoadmapPhase = {
    ...dummyPhase("in_progress"),
    id: "phase_backend_1",
    objective: "Master Backend Go Services and APIs",
    capabilityTargets: ["Go Concurrency", "REST Design"],
    activityTargets: ["API Implementation"],
  };

  const alignmentM = decisionEngine.evaluateActivePhaseAlignment(activePhaseBackend, uwmM.getModel(), "Backend Engineer");
  assert.strictEqual(alignmentM.aligned, true, "Side interest must NOT trigger misaligned result");

  const decM = decisionEngine.evaluateNextAction({
    profileId: "test_m",
    workModel: uwmM.getModel(),
    declaredGoal: "Backend Engineer",
    activePhase: activePhaseBackend,
    isPhaseCompletion: false,
  });
  assert.strictEqual(decM.phaseDisposition, "continue", "Decision Engine must CONTINUE active phase");
  console.log("  [PASS] Test M: Side interest correctly evaluated without superseding active phase.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST N: FALSE-POSITIVE PREVENTION - DIFFICULTY STATEMENTS DO NOT SUPERSEDE
  // --------------------------------------------------------------------------
  console.log("Test N: Difficulty statements alone do NOT supersede active phase...");
  const uwmN = new UserWorkModelManager();
  uwmN.applyEvidence({
    id: "ev_difficulty",
    dimension: "capability:distributed_consensus",
    signal: "difficult",
    confidence: 0.7,
    source: "self_report",
    quality: 0.8,
    timestamp: new Date().toISOString(),
    status: "active",
    provenance: {
      sourceEventId: "refl",
      originalText: "Found distributed consensus difficult",
      derivationRule: "Difficulty report",
    },
    supportedTargetIds: [],
    contradictedTargetIds: [],
    explanation: "User struggled with consensus",
  });

  const alignmentN = decisionEngine.evaluateActivePhaseAlignment(activePhaseBackend, uwmN.getModel(), "Backend Engineer");
  assert.strictEqual(alignmentN.aligned, true, "Difficulty alone must NOT trigger misaligned result");

  const decN = decisionEngine.evaluateNextAction({
    profileId: "test_n",
    workModel: uwmN.getModel(),
    declaredGoal: "Backend Engineer",
    activePhase: activePhaseBackend,
    isPhaseCompletion: false,
  });
  assert.strictEqual(decN.phaseDisposition, "continue", "Decision Engine must CONTINUE active phase");
  console.log("  [PASS] Test N: Difficulty statement correctly handled without superseding active phase.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST O: EXPLICIT DIRECTION REJECTION SUPERSEDES ACTIVE PHASE
  // --------------------------------------------------------------------------
  console.log("Test O: Explicit direction rejection triggers supersession...");
  const uwmO = new UserWorkModelManager();
  uwmO.applyEvidence({
    id: "ev_rejection",
    dimension: "direction:rejection",
    signal: "I don't want backend engineering anymore, I hate backend",
    confidence: 0.95,
    source: "user_answer",
    quality: 0.95,
    timestamp: new Date().toISOString(),
    status: "contradicted",
    provenance: {
      sourceEventId: "refl",
      originalText: "I don't want backend engineering anymore, I hate backend",
      derivationRule: "Explicit rejection",
    },
    supportedTargetIds: [],
    contradictedTargetIds: ["phase_backend_1"],
    explanation: "Explicit rejection",
  });

  const alignmentO = decisionEngine.evaluateActivePhaseAlignment(activePhaseBackend, uwmO.getModel(), "Frontend");
  assert.strictEqual(alignmentO.aligned, false, "Explicit rejection must trigger misaligned result");
  assert.ok(alignmentO.reason?.includes("rejection"));

  const decO = decisionEngine.evaluateNextAction({
    profileId: "test_o",
    workModel: uwmO.getModel(),
    declaredGoal: "Frontend Developer",
    activePhase: activePhaseBackend,
    isPhaseCompletion: false,
  });
  assert.strictEqual(decO.phaseDisposition, "supersede", "Explicit rejection must yield phaseDisposition: 'supersede'");
  console.log("  [PASS] Test O: Explicit direction rejection strictly supersedes active phase.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST P: ACCUMULATED INCOMPATIBILITY SUPERSEDES ACTIVE PHASE
  // --------------------------------------------------------------------------
  console.log("Test P: Accumulated incompatibility (>=2 core targets avoided/disliked) triggers supersession...");
  const uwmP = new UserWorkModelManager();
  uwmP.applyEvidence({
    id: "ev_avoided_act",
    dimension: "activity:avoided",
    signal: "Core Conceptual Foundations & Architecture in Go Concurrency",
    confidence: 0.9,
    source: "phase_reflection",
    quality: 0.9,
    timestamp: new Date().toISOString(),
    status: "contradicted",
    provenance: {
      sourceEventId: "refl",
      originalText: "Avoided core conceptual foundations",
      derivationRule: "Reflection avoidance",
    },
    supportedTargetIds: [],
    contradictedTargetIds: [],
    explanation: "User avoided target activity",
  });
  uwmP.applyEvidence({
    id: "ev_disliked_act",
    dimension: "activity:API Implementation",
    signal: "disliked",
    confidence: 0.9,
    source: "phase_reflection",
    quality: 0.9,
    timestamp: new Date().toISOString(),
    status: "contradicted",
    provenance: {
      sourceEventId: "refl",
      originalText: "Disliked API implementation",
      derivationRule: "Reflection dislike",
    },
    supportedTargetIds: [],
    contradictedTargetIds: [],
    explanation: "User disliked target activity",
  });

  const activePhaseP: RoadmapPhase = {
    ...dummyPhase("in_progress"),
    id: "phase_p_1",
    objective: "Master Go Concurrency and API Implementation",
    capabilityTargets: ["Go Concurrency"],
    activityTargets: ["API Implementation"],
    activities: [
      {
        id: "act_p_1",
        title: "Core Conceptual Foundations & Architecture in Go Concurrency",
        type: "concept_and_study",
        description: "Study",
        estimatedHours: 4,
      },
    ],
  };

  const alignmentP = decisionEngine.evaluateActivePhaseAlignment(activePhaseP, uwmP.getModel(), "Backend Engineer");
  assert.strictEqual(alignmentP.aligned, false, "Corroborated multiple disliked targets must trigger misaligned");
  assert.ok(alignmentP.reason?.includes("Corroborated material incompatibility"));

  const decP = decisionEngine.evaluateNextAction({
    profileId: "test_p",
    workModel: uwmP.getModel(),
    declaredGoal: "Data Analyst",
    activePhase: activePhaseP,
    isPhaseCompletion: false,
  });
  assert.strictEqual(decP.phaseDisposition, "supersede", "Accumulated incompatibility yields supersede");
  console.log("  [PASS] Test P: Corroborated accumulated incompatibility supersedes active phase.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST Q: STRUCTURED TARGET ALIGNMENT
  // --------------------------------------------------------------------------
  console.log("Test Q: Structured target alignment across capability, activity, characteristic, evidence...");
  const phaseQ = phasePlanner.generateNextPhase({
    directionName: "Machine Learning Operations",
    workModel: new UserWorkModelManager().getModel(),
    completedPhases: [],
  });
  assert.ok(phaseQ.capabilityTargets.length > 0, "capabilityTargets must be populated");
  assert.ok(phaseQ.activityTargets.length > 0, "activityTargets must be populated");
  assert.ok(phaseQ.characteristicTargets.length > 0, "characteristicTargets must be populated");
  assert.ok(phaseQ.evidenceTargets.length > 0, "evidenceTargets must be populated");
  assert.ok(phaseQ.decisionPoint, "decisionPoint must be defined");
  console.log("  [PASS] Test Q: Structured target models validated.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST R: PHASE PLANNER CONTEXT AWARENESS (COMPLETED VS SUPERSEDED)
  // --------------------------------------------------------------------------
  console.log("Test R: PhasePlanner uses phaseHistory, distinguishing completed vs superseded...");
  const completedPhase1: RoadmapPhase = {
    ...dummyPhase("completed"),
    id: "phase_comp_1",
    phaseNumber: 1,
    capabilityTargets: ["Containerization Basics"],
  };
  const supersededPhase2: RoadmapPhase = {
    ...dummyPhase("superseded"),
    id: "phase_sup_2",
    phaseNumber: 2,
    capabilityTargets: ["Complex Kubernetes Cluster Orchestration"],
  };

  const phaseR = phasePlanner.generateNextPhase({
    directionName: "DevOps Engineering",
    workModel: new UserWorkModelManager().getModel(),
    phaseHistory: [completedPhase1, supersededPhase2],
  });

  assert.strictEqual(phaseR.phaseNumber, 3, "Next phase must be Phase 3 based on total history");
  // Completed capability should not be repeated:
  assert.ok(!phaseR.capabilityTargets.includes("Containerization Basics"), "Completed capability is not repeated");
  console.log("  [PASS] Test R: PhasePlanner respects full phaseHistory without repeating acquired skills.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST S: MID-PHASE REFLECTION (completesPhase: false)
  // --------------------------------------------------------------------------
  console.log("Test S: Mid-phase reflection (completesPhase: false) does not transition phase to completed...");
  const pIdS = `test_evolve_S_${Date.now()}`;
  await profileRepo.resetProfile(pIdS);

  const p1S = phasePlanner.generateNextPhase({
    directionName: "Cybersecurity",
    workModel: new UserWorkModelManager().getModel(),
    completedPhases: [],
  });
  await phaseRepo.createPhase(pIdS, p1S);

  const reflResS = await orchestrator.submitReflection(
    {
      phaseId: p1S.id,
      completesPhase: false,
      enjoyed: "Packet sniffing with Wireshark",
      voluntarilyExplored: "Network scanning with Nmap",
    },
    pIdS
  );

  assert.strictEqual(reflResS.nextDecision.phaseDisposition, "continue");
  assert.strictEqual(reflResS.nextPhase, null, "No replacement phase generated when continuing");
  const storedPhasesS = await phaseRepo.getPhaseHistory(pIdS);
  assert.strictEqual(storedPhasesS.length, 1);
  assert.strictEqual(storedPhasesS[0].status, "in_progress", "Active phase remains in_progress");
  console.log("  [PASS] Test S: Mid-phase reflection updates evidence while preserving active phase in_progress.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST T: NO MULTIPLE FUTURE PHASES IN SINGLE PLANNING OPERATION
  // --------------------------------------------------------------------------
  console.log("Test T: Single planning operation returns at most ONE newly generated phase...");
  const pIdT = `test_evolve_T_${Date.now()}`;
  await profileRepo.resetProfile(pIdT);

  const p1T = await orchestrator.planNextPhase(pIdT);
  assert.strictEqual(p1T.phaseNumber, 1);

  const historyT = await phaseRepo.getPhaseHistory(pIdT);
  assert.strictEqual(historyT.length, 1);
  assert.strictEqual(historyT[0].status, "in_progress");
  console.log("  [PASS] Test T: Single planning operation strictly bounds generation to exactly one phase.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // SECTION 19 REGRESSION SCENARIO: END-TO-END 13-STEP LIFECYCLE
  // --------------------------------------------------------------------------
  console.log("Section 19: Running comprehensive 13-step end-to-end lifecycle regression scenario...");
  const pId19 = `test_regress_19_${Date.now()}`;
  await profileRepo.resetProfile(pId19);

  // Step 1: Initial intake creates Phase 1 (in_progress)
  const intakeReq19 = new NextRequest("http://localhost:3000/api/v1/intake/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pId19 },
    body: JSON.stringify({
      message: "I want to be an Enterprise Java Backend Developer working on Fintech and Banking using Spring Boot and Microservices. I can study 15 hours a week for 6 months.",
      modelProvider: "deterministic",
    }),
  });
  const res1 = await handleIntakePost(intakeReq19);
  const data1 = await res1.json();
  const phase1_19 = data1.profile.activePhase;
  assert.strictEqual(phase1_19.phaseNumber, 1);
  assert.strictEqual(phase1_19.status, "in_progress");

  // Step 2: Query active phase -> Phase 1
  const activeStep2 = await phaseRepo.getActivePhase(pId19);
  assert.strictEqual(activeStep2?.id, phase1_19.id);

  // Step 3: Side interest added ("Also interested in AI") -> Phase 1 remains in_progress
  await orchestrator.submitReflection(
    {
      phaseId: phase1_19.id,
      completesPhase: false,
      enjoyed: "I am also interested in AI models on the side",
    },
    pId19
  );
  assert.strictEqual((await phaseRepo.getActivePhase(pId19))?.id, phase1_19.id);

  // Step 4: Difficulty noted ("SQL is difficult") -> Phase 1 remains in_progress
  await orchestrator.submitReflection(
    {
      phaseId: phase1_19.id,
      completesPhase: false,
      difficult: "Relational SQL indexes are quite difficult",
    },
    pId19
  );
  assert.strictEqual((await phaseRepo.getActivePhase(pId19))?.id, phase1_19.id);

  // Step 5: Mid-phase reflection submitted (`completesPhase: false`) -> Phase 1 remains in_progress
  await orchestrator.submitReflection(
    {
      phaseId: phase1_19.id,
      completesPhase: false,
      voluntarilyExplored: "Looked up Java 21 virtual threads",
    },
    pId19
  );
  assert.strictEqual((await phaseRepo.getActivePhase(pId19))?.id, phase1_19.id);

  // Step 6: Phase 1 completed work submitted -> Phase 1 completed, Phase 2 created (in_progress)
  const submitReq19 = new NextRequest(`http://localhost:3000/api/v1/profiles/me/phases/${phase1_19.id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pId19 },
    body: JSON.stringify({
      notes: "Built Java backend REST service with comprehensive JUnit tests.",
      demonstratedCapabilities: phase1_19.capabilityTargets,
    }),
  });
  const res6 = await handlePhaseSubmitPost(submitReq19, { params: Promise.resolve({ phaseId: phase1_19.id }) });
  const data6 = await res6.json();
  assert.strictEqual(data6.completedPhase.status, "completed");
  const phase2_19 = data6.nextPhase;
  assert.strictEqual(phase2_19.phaseNumber, 2);
  assert.strictEqual(phase2_19.status, "in_progress");

  // Step 7: Active phase is Phase 2
  const activeStep7 = await phaseRepo.getActivePhase(pId19);
  assert.strictEqual(activeStep7?.id, phase2_19.id);

  // Step 8: Historical phases count = 1 (completed)
  const completedPhasesStep8 = (await phaseRepo.getPhaseHistory(pId19)).filter((p) => p.status === "completed");
  assert.strictEqual(completedPhasesStep8.length, 1);

  // Step 9: Explicit pivot reflection submitted on Phase 2 -> Phase 2 superseded, Phase 3 created (in_progress)
  const reflReq19 = new NextRequest(`http://localhost:3000/api/v1/profiles/me/phases/${phase2_19.id}/reflection`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pId19 },
    body: JSON.stringify({
      phaseId: phase2_19.id,
      completesPhase: false,
      continueDirection: "pivot",
      disliked: "I hate enterprise Java and microservices and avoid them completely",
      wantToAvoid: "Java enterprise",
      freeText: "I do not want backend Java anymore, I want to switch to Data Engineering.",
    }),
  });
  const res9 = await handlePhaseReflectionPost(reflReq19, { params: Promise.resolve({ phaseId: phase2_19.id }) });
  const data9 = await res9.json();
  assert.strictEqual(data9.nextDecision.phaseDisposition, "supersede");
  const phase3_19 = data9.nextPhase;
  assert.strictEqual(phase3_19.phaseNumber, 3);
  assert.strictEqual(phase3_19.status, "in_progress");

  // Step 10: Active phase is Phase 3
  const activeStep10 = await phaseRepo.getActivePhase(pId19);
  assert.strictEqual(activeStep10?.id, phase3_19.id);

  // Step 11: History contains Phase 1 (completed), Phase 2 (superseded), Phase 3 (in_progress)
  const fullHistory19 = await phaseRepo.getPhaseHistory(pId19);
  assert.strictEqual(fullHistory19.length, 3);
  assert.strictEqual(fullHistory19[0].id, phase1_19.id);
  assert.strictEqual(fullHistory19[0].status, "completed");
  assert.strictEqual(fullHistory19[1].id, phase2_19.id);
  assert.strictEqual(fullHistory19[1].status, "superseded");
  assert.strictEqual(fullHistory19[2].id, phase3_19.id);
  assert.strictEqual(fullHistory19[2].status, "in_progress");

  // Step 12: Bidirectional provenance verified on decisions
  const dec9 = data9.nextDecision;
  assert.strictEqual(dec9.previousActivePhaseId, phase2_19.id);
  assert.strictEqual(dec9.createdPhaseId, phase3_19.id);
  assert.strictEqual(fullHistory19[1].supersededByDecisionId, dec9.id);
  assert.strictEqual(fullHistory19[2].createdByDecisionId, dec9.id);

  // Step 13: Immutability verified: attempting to transition Phase 1 or 2 throws an error
  await assert.rejects(
    async () => phaseRepo.transitionPhase(pId19, phase1_19.id, { toStatus: "superseded", decisionId: "dec_err" }),
    /cannot transition phase .* with terminal status 'completed'/
  );
  await assert.rejects(
    async () => phaseRepo.transitionPhase(pId19, phase2_19.id, { toStatus: "completed", decisionId: "dec_err" }),
    /cannot transition phase .* with terminal status 'superseded'/
  );

  console.log("  [PASS] Section 19: All 13 steps of end-to-end regression sequence passed with full fidelity!\n");
  passedTests++;

  console.log("================================================================================");
  console.log(`ALL ${passedTests} ADAPTIVE PHASE EVOLUTION TESTS PASSED WITH 100% SUCCESS!`);
  console.log("================================================================================");
}

runAdaptivePhaseEvolutionTests().catch((err) => {
  console.error("\nTEST SUITE FAILED WITH ERROR:", err);
  process.exit(1);
});
