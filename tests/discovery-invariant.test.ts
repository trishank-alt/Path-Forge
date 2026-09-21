import assert from "node:assert";
import { NextRequest } from "next/server";
import { POST as handleIntakePost } from "../app/api/v1/intake/messages/route";
import { POST as handlePhaseSubmitPost } from "../app/api/v1/profiles/me/phases/[phaseId]/submit/route";
import { orchestrator } from "../src/lib/application/orchestrator";
import {
  PhaseRepository,
  ProfileRepository,
  DecisionRepository,
  EvidenceRepository,
  UserWorkModelRepository,
} from "../src/lib/persistence/repositories";
import { PhasePlanner } from "../src/lib/domain/planning/phase-planner";
import { DecisionEngine } from "../src/lib/domain/decision/decision-engine";
import { UserWorkModelManager } from "../src/lib/domain/evidence/user-work-model";
import { translateDecisionToDialogue } from "../src/lib/conversational/dialogue-translator";
import { semanticDimensionValidator } from "../src/lib/domain/intent/semantic-dimension-validator";
import { PlanningDecision, RoadmapPhase } from "../src/lib/contracts";

async function runDiscoveryInvariantTests() {
  console.log("================================================================================");
  console.log("PATHFORGE DISCOVERY INVARIANT & CONVERSATIONAL MODEL TEST SUITE");
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
  // TEST 1: DISCOVERY INVARIANT (activePhase === null)
  // --------------------------------------------------------------------------
  console.log("Test 1: Discovery Invariant - No premature phase creation in discovery...");
  const pId1 = `test_disc_1_${Date.now()}`;
  await profileRepo.resetProfile(pId1);

  const p1 = await profileRepo.getProfile(pId1);
  assert.ok(!p1.activePhase, "Active phase must be falsy on reset");
  const storedPhases1 = await phaseRepo.getPhaseHistory(pId1);
  assert.strictEqual(storedPhases1.length, 0, "Zero phases in database during discovery");

  // Verify conversation is usable without active phase
  const initialDialogue = translateDecisionToDialogue({
    userMessage: "",
    isInitialGreeting: true,
  });
  assert.ok(initialDialogue.replyText.includes("PathForge"));
  assert.ok(initialDialogue.suggestedChips && initialDialogue.suggestedChips.length > 0);
  console.log("  [PASS] Test 1: Discovery invariant verified. Conversation active with zero phases.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST 2: SCENARIO H — DISCOVERY WITHOUT A ROADMAP
  // --------------------------------------------------------------------------
  console.log("Test 2: Scenario H - User has no idea what career they want...");
  const pIdH = `test_disc_H_${Date.now()}`;
  await profileRepo.resetProfile(pIdH);

  const reqH = new NextRequest("http://localhost:3000/api/v1/intake/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pIdH },
    body: JSON.stringify({
      message: "I have no idea what career I want. I am completely undecided.",
      modelProvider: "deterministic",
    }),
  });
  const resH = await handleIntakePost(reqH);
  assert.strictEqual(resH.status, 200);
  const dataH = await resH.json();

  assert.ok(!dataH.profile.activePhase, "Scenario H: activePhase must remain falsy");
  assert.strictEqual(dataH.roadmap, null, "Scenario H: No premature roadmap generated");

  const dialogueH = translateDecisionToDialogue({
    userMessage: "I have no idea what career I want. I am completely undecided.",
    decision: dataH.decision || null,
    activePhase: null,
  });
  assert.ok(dialogueH.replyText.includes("completely fine"), "Must normalize uncertainty conversationally");
  assert.strictEqual(dialogueH.inlineEvent, undefined, "No inline planning event created");
  console.log("  [PASS] Test 2: Scenario H: Conversation active, evidence captured, no fake roadmap.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST 3: SCENARIO I — DIRECTION MENTION WITHOUT COMMITMENT
  // --------------------------------------------------------------------------
  console.log("Test 3: Scenario I - Direction mentioned ('AI seems interesting') without commitment...");
  const pIdI = `test_disc_I_${Date.now()}`;
  await profileRepo.resetProfile(pIdI);

  const reqI = new NextRequest("http://localhost:3000/api/v1/intake/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pIdI },
    body: JSON.stringify({
      message: "AI seems interesting, but I'm not ready to commit to anything yet.",
      modelProvider: "deterministic",
    }),
  });
  const resI = await handleIntakePost(reqI);
  assert.strictEqual(resI.status, 200);
  const dataI = await resI.json();

  assert.ok(!dataI.profile.activePhase, "Scenario I: activePhase must remain falsy");
  assert.strictEqual(dataI.roadmap, null, "Scenario I: Roadmap must not be manufactured");

  const dialogueI = translateDecisionToDialogue({
    userMessage: "AI seems interesting, but I'm not ready to commit to anything yet.",
    decision: dataI.decision || null,
    activePhase: null,
  });
  assert.ok(dialogueI.replyText.includes("What makes that area interesting"), "Must explore interest conversationally");
  console.log("  [PASS] Test 3: Scenario I: Interest recorded as evidence without premature commitment.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST 4: SCENARIO J — EXPERIMENT BEFORE PHASE (EXPLORE)
  // --------------------------------------------------------------------------
  console.log("Test 4: Scenario J - Diagnostic probe proposed before any phase...");
  const pIdJ = `test_disc_J_${Date.now()}`;
  await profileRepo.resetProfile(pIdJ);
  const uwmJ = new UserWorkModelManager();
  uwmJ.registerUncertainty({
    id: "unc_ai_affinity",
    dimension: "exploration_needed",
    description: "Uncertain if learner enjoys hands-on prompt chaining vs backend data pipelines",
    impact: "high",
    resolutionStrategy: "experiment",
  });

  const decJ = decisionEngine.evaluateNextAction({
    profileId: pIdJ,
    workModel: uwmJ.getModel(),
    declaredGoal: null,
  });

  assert.strictEqual(decJ.mode, "explore", "DecisionEngine must choose EXPLORE");
  assert.strictEqual(decJ.createdPhaseId, null, "EXPLORE must not create a phase");
  assert.ok(decJ.activeExperiment, "EXPLORE must produce an active experiment");

  const dialogueJ = translateDecisionToDialogue({
    userMessage: "I want to know whether I actually like AI engineering.",
    decision: decJ,
    activePhase: null,
  });
  assert.ok(dialogueJ.replyText.includes("test it"), "Translates experiment proposal conversationally");
  assert.strictEqual(dialogueJ.inlineEvent?.type, "experiment_proposed");
  console.log("  [PASS] Test 4: Scenario J: Diagnostic experiment proposed without creating a phase.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST 5: SCENARIO K — GENUINE SUSTAINED INTERVENTION ACTIVATION
  // --------------------------------------------------------------------------
  console.log("Test 5: Scenario K - Sustained intervention created only when evidence warrants...");
  const pIdK = `test_disc_K_${Date.now()}`;
  await profileRepo.resetProfile(pIdK);

  const reqK = new NextRequest("http://localhost:3000/api/v1/intake/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pIdK },
    body: JSON.stringify({
      message: "I want to be an Enterprise Java Backend Developer working on Fintech and Banking using Spring Boot and Microservices. I can study 15 hours a week for 6 months.",
      modelProvider: "deterministic",
    }),
  });
  const resK = await handleIntakePost(reqK);
  assert.strictEqual(resK.status, 200);
  const dataK = await resK.json();

  assert.ok(dataK.profile.activePhase, "Active intervention created when evidence warrants");
  assert.strictEqual(dataK.profile.activePhase.phaseNumber, 1);
  assert.strictEqual(dataK.profile.activePhase.status, "in_progress");

  const dialogueK = translateDecisionToDialogue({
    userMessage: "I want to be an Enterprise Java Backend Developer",
    decision: dataK.profile.decisions[dataK.profile.decisions.length - 1],
    activePhase: dataK.profile.activePhase,
    previousPhase: null,
  });
  assert.ok(dialogueK.inlineEvent?.type === "new_phase");
  console.log("  [PASS] Test 5: Scenario K: Sustained intervention created and translated.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST 6: SCENARIO G — NO UI DECISION BYPASS FOR PIVOTS
  // --------------------------------------------------------------------------
  console.log("Test 6: Scenario G - Explicit pivot flows through planning pipeline without bypass...");
  const pIdG = `test_disc_G_${Date.now()}`;
  await profileRepo.resetProfile(pIdG);

  // Setup active backend phase
  const p1G = phasePlanner.generateNextPhase({
    directionName: "Backend Architecture",
    workModel: new UserWorkModelManager().getModel(),
    completedPhases: [],
  });
  await phaseRepo.createPhase(pIdG, p1G);

  // Submit reflection with explicit pivot
  const reflReqG = new NextRequest(`http://localhost:3000/api/v1/profiles/me/phases/${p1G.id}/reflection`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pIdG },
    body: JSON.stringify({
      phaseId: p1G.id,
      completesPhase: false,
      continueDirection: "pivot",
      disliked: "I hate backend microservices and databases and avoid them completely",
      wantToAvoid: "backend architecture",
      freeText: "I do not want backend engineering anymore, I want to switch to Frontend UI Engineering.",
    }),
  });

  const reflResG = await orchestrator.submitReflection({
    phaseId: p1G.id,
    completesPhase: false,
    continueDirection: "pivot",
    disliked: "I hate backend microservices and databases and avoid them completely",
    wantToAvoid: "backend architecture",
    freeText: "I do not want backend engineering anymore, I want to switch to Frontend UI Engineering.",
  }, pIdG);

  assert.strictEqual(reflResG.nextDecision.phaseDisposition, "supersede");
  assert.strictEqual(reflResG.nextDecision.mode, "commit");
  assert.ok(reflResG.nextPhase);
  assert.strictEqual(reflResG.nextPhase.phaseNumber, 2);

  // Verify dialogue translation reflects persisted state
  const dialogueG = translateDecisionToDialogue({
    userMessage: "I do not want backend engineering anymore",
    decision: reflResG.nextDecision,
    activePhase: reflResG.nextPhase,
    previousPhase: p1G,
  });

  assert.strictEqual(dialogueG.inlineEvent?.type, "plan_updated");
  assert.strictEqual(dialogueG.inlineEvent?.previousPhaseStatus, "superseded");
  console.log("  [PASS] Test 6: Scenario G: Explicit pivot strictly routed through normal planning pipeline.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST 7: SCENARIO F — WORK SUBMISSION DOES NOT DIRECTLY MARK COMPLETED
  // --------------------------------------------------------------------------
  console.log("Test 7: Scenario F - Work submission evaluated by DecisionEngine (not forced by UI)...");
  const pIdF = `test_disc_F_${Date.now()}`;
  await profileRepo.resetProfile(pIdF);

  const p1F = phasePlanner.generateNextPhase({
    directionName: "Cloud Systems",
    workModel: new UserWorkModelManager().getModel(),
    completedPhases: [],
  });
  await phaseRepo.createPhase(pIdF, p1F);

  // Submitting normal work without completion evidence passes through DecisionEngine
  const workResF = await orchestrator.submitWork(p1F.id, {
    profileId: pIdF,
    notes: "Successfully deployed containerized services to Kubernetes cluster with automated health checks.",
    demonstratedCapabilities: p1F.capabilityTargets,
  });

  assert.strictEqual(workResF.nextDecision.phaseDisposition, "complete");
  assert.strictEqual(workResF.completedPhase.status, "completed");
  assert.ok(workResF.nextPhase);

  const dialogueF = translateDecisionToDialogue({
    userMessage: "Submitted practical deliverable",
    decision: workResF.nextDecision,
    activePhase: workResF.nextPhase,
    previousPhase: workResF.completedPhase,
  });
  assert.strictEqual(dialogueF.inlineEvent?.type, "new_phase");
  console.log("  [PASS] Test 7: Scenario F: Work submission evaluated through DecisionEngine without direct UI bypass.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // TEST 8: UNSPECIFIED DIRECTION CHANGE DOES NOT LOOP OR RE-SUGGEST SELF
  // --------------------------------------------------------------------------
  console.log("Test 8: Unspecified direction change returns neutral exploration chips...");
  const pId8 = `test_disc_8_${Date.now()}`;
  await profileRepo.resetProfile(pId8);

  const p1_8 = phasePlanner.generateNextPhase({
    directionName: "Backend Systems",
    workModel: new UserWorkModelManager().getModel(),
    completedPhases: [],
  });
  await phaseRepo.createPhase(pId8, p1_8);

  const dialogue8 = translateDecisionToDialogue({
    userMessage: "I want to change direction",
    activePhase: p1_8,
    decision: {
      id: "dec_test_8",
      profileId: pId8,
      mode: "commit",
      phaseDisposition: "continue",
      primaryObjective: "Maintain phase",
      previousActivePhaseId: p1_8.id,
      activePhaseId: p1_8.id,
      createdPhaseId: null,
      activePhase: p1_8,
      activeQuestion: null,
      activeExperiment: null,
      rationale: "Gathering candidate alternatives for pivot.",
      evidenceConsidered: [],
      timestamp: new Date().toISOString(),
    },
  });

  // Verify it gives the neutral prompt without predetermined paths
  assert.ok(
    dialogue8.replyText.includes("what are you thinking of moving toward?"),
    "Must prompt user neutrally for direction they are thinking of moving toward"
  );
  assert.ok(
    !dialogue8.replyText.includes("adjust our approach to this phase"),
    "Must not claim to adjust current phase when user requested to change direction"
  );

  // Verify chips do NOT contain the self-referential 'I want to change direction'
  assert.ok(dialogue8.suggestedChips && dialogue8.suggestedChips.length > 0);
  assert.ok(
    !dialogue8.suggestedChips.some((c) => c.toLowerCase().includes("change direction")),
    "Must not re-suggest 'I want to change direction' to the user"
  );

  // Verify chips are strictly neutral and do NOT provide predetermined career catalogs
  assert.ok(
    dialogue8.suggestedChips.some((c) => c.toLowerCase().includes("another field in mind")),
    "Must offer neutral 'I have another field in mind' chip"
  );
  assert.ok(
    dialogue8.suggestedChips.some((c) => c.toLowerCase().includes("not sure yet")),
    "Must offer neutral 'I'm not sure yet' chip"
  );
  assert.ok(
    !dialogue8.suggestedChips.some((c) => c.toLowerCase().includes("explore ai & machine learning")),
    "Must NOT offer predetermined 'Explore AI & Machine Learning' chip for unspecified pivot"
  );
  assert.ok(
    !dialogue8.suggestedChips.some((c) => c.toLowerCase().includes("explore frontend")),
    "Must NOT offer predetermined 'Explore Frontend' chip for unspecified pivot"
  );

  // Verify semanticDimensionValidator prevents dimension pollution
  const valCheck = semanticDimensionValidator.validateDimensionAnswer("target_domain", "I want to change direction");
  assert.strictEqual(valCheck.status, "unknown", "Must not treat 'I want to change direction' as valid target_domain");
  console.log("  [PASS] Test 8: Unspecified direction change returns neutral exploration chips without loops or predetermined paths.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST 9: CONVERSATIONAL CHIPS (PACE & DELIVERABLE REVIEW) HANDLED CONTEXTUALLY
  // --------------------------------------------------------------------------
  console.log("Test 9: Conversational chips (pace & deliverable review) handled contextually...");
  const dialoguePace = translateDecisionToDialogue({
    userMessage: "Can we adjust the pace?",
    activePhase: p1_8,
  });
  assert.ok(
    dialoguePace.replyText.includes("adjust the pace to fit your schedule"),
    "Pace adjustment must return thoughtful capacity question"
  );
  assert.ok(
    !dialoguePace.suggestedChips?.some((c) => c.toLowerCase().includes("adjust the pace")),
    "Pace chip must not self-reference"
  );
  assert.ok(
    dialoguePace.suggestedChips?.some((c) => c.toLowerCase().includes("reduce weekly hours")),
    "Pace chips must offer capacity adjustment options"
  );

  const dialogueDeliverable = translateDecisionToDialogue({
    userMessage: "Let's review the current deliverable",
    activePhase: p1_8,
  });
  assert.ok(
    dialogueDeliverable.replyText.includes("Here is what we're working toward in this phase"),
    "Deliverable review must explain current phase deliverable"
  );
  assert.ok(
    !dialogueDeliverable.suggestedChips?.some((c) => c.toLowerCase().includes("review the current deliverable")),
    "Deliverable review chip must not self-reference"
  );
  console.log("  [PASS] Test 9: Pace adjustment and deliverable review handled contextually without loops.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST 10: UNSPECIFIED PIVOT DOES NOT CAUSE PREMATURE SUPERSESSION
  // --------------------------------------------------------------------------
  console.log("Test 10: Unspecified pivot does not cause premature supersession...");
  const pId10 = `test_disc_10_${Date.now()}`;
  await profileRepo.resetProfile(pId10);

  const p1_10 = phasePlanner.generateNextPhase({
    directionName: "Backend Systems",
    workModel: new UserWorkModelManager().getModel(),
    completedPhases: [],
  });
  await phaseRepo.createPhase(pId10, p1_10);
  const prof10 = await profileRepo.getProfile(pId10);
  prof10.activePhase = p1_10;
  prof10.declaredTargetRole = "Backend Engineer";
  await profileRepo.saveProfile(prof10);

  const req10 = new NextRequest("http://localhost:3000/api/v1/intake/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pId10 },
    body: JSON.stringify({
      message: "I want to change direction.",
      modelProvider: "deterministic",
    }),
  });
  const res10 = await handleIntakePost(req10);
  assert.strictEqual(res10.status, 200);
  const data10 = await res10.json();

  // Invariant verification:
  // 1. Pivot intent detected
  assert.strictEqual(data10.intent.type, "pivot_request");
  assert.strictEqual(data10.intent.hasExplicitRejection, false);
  // 2. No new target inferred
  assert.strictEqual(data10.intent.pivotTarget, null);
  // 3. No phase supersession, no new phase created
  assert.strictEqual(data10.profile.activePhase.id, p1_10.id, "Active phase ID must remain unchanged");
  assert.strictEqual(data10.profile.activePhase.status, "in_progress", "Active phase must remain in_progress");
  const storedPhases10 = await phaseRepo.getPhaseHistory(pId10);
  assert.strictEqual(storedPhases10.length, 1, "Only Phase 1 exists in DB, no premature replacement phase");

  // 4. Conversational clarification & neutral chips
  const dialogue10 = translateDecisionToDialogue({
    userMessage: "I want to change direction.",
    intent: data10.intent,
    decision: data10.decision,
    activePhase: data10.profile.activePhase,
  });
  assert.ok(
    dialogue10.replyText.includes("what are you thinking of moving toward?"),
    "Must clarify target direction conversationally"
  );
  assert.ok(
    dialogue10.suggestedChips?.some((c) => c.includes("another field in mind")),
    "Must offer neutral 'I have another field in mind' chip"
  );
  assert.ok(
    !dialogue10.suggestedChips?.some((c) => c.toLowerCase().includes("explore ai")),
    "Must not offer predetermined AI chip"
  );
  console.log("  [PASS] Test 10: Unspecified pivot preserves phase and offers neutral exploration chips.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST 11: PIVOT WITH EXPLICIT REJECTION AND TARGET ENTERS NORMAL PIPELINE
  // --------------------------------------------------------------------------
  console.log("Test 11: Pivot with explicit rejection and target enters normal planning pipeline...");
  const pId11 = `test_disc_11_${Date.now()}`;
  await profileRepo.resetProfile(pId11);

  const p1_11 = phasePlanner.generateNextPhase({
    directionName: "Backend Systems",
    workModel: new UserWorkModelManager().getModel(),
    completedPhases: [],
  });
  await phaseRepo.createPhase(pId11, p1_11);
  const prof11 = await profileRepo.getProfile(pId11);
  prof11.activePhase = p1_11;
  prof11.declaredTargetRole = "Backend Engineer";
  await profileRepo.saveProfile(prof11);

  const req11 = new NextRequest("http://localhost:3000/api/v1/intake/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pId11 },
    body: JSON.stringify({
      message: "I don't want backend anymore. I'd like to explore AI.",
      modelProvider: "deterministic",
    }),
  });
  const res11 = await handleIntakePost(req11);
  assert.strictEqual(res11.status, 200);
  const data11 = await res11.json();

  // Invariant verification:
  // 1. Directional rejection + target evidence detected
  assert.strictEqual(data11.intent.type, "pivot_request");
  assert.strictEqual(data11.intent.hasExplicitRejection, true);
  assert.ok(data11.intent.pivotTarget.includes("AI"));
  // 2. DecisionEngine evaluated material conflict -> phaseDisposition = SUPERSEDE
  // 3. PlanningTransaction coordinated transition
  assert.notStrictEqual(data11.profile.activePhase.id, p1_11.id, "New active phase generated");
  assert.strictEqual(data11.profile.activePhase.status, "in_progress", "New active phase is in_progress");
  assert.ok(data11.profile.activePhase.objective.includes("AI"), "New active phase is AI focused");

  const storedPhases11 = await phaseRepo.getPhaseHistory(pId11);
  assert.strictEqual(storedPhases11.length, 2, "Both old and new phase exist in history");
  const oldPhase11 = storedPhases11.find((p) => p.id === p1_11.id);
  assert.strictEqual(oldPhase11?.status, "superseded", "Old phase status must be superseded");
  console.log("  [PASS] Test 11: Explicit rejection + target correctly supersedes old phase and activates new intervention.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST 12: NEW INTEREST DOES NOT IMPLY REJECTION
  // --------------------------------------------------------------------------
  console.log("Test 12: New interest does not imply rejection...");
  const pId12 = `test_disc_12_${Date.now()}`;
  await profileRepo.resetProfile(pId12);

  const p1_12 = phasePlanner.generateNextPhase({
    directionName: "Backend Systems",
    workModel: new UserWorkModelManager().getModel(),
    completedPhases: [],
  });
  await phaseRepo.createPhase(pId12, p1_12);
  const prof12 = await profileRepo.getProfile(pId12);
  prof12.activePhase = p1_12;
  prof12.declaredTargetRole = "Backend Engineer";
  await profileRepo.saveProfile(prof12);

  const req12 = new NextRequest("http://localhost:3000/api/v1/intake/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pId12 },
    body: JSON.stringify({
      message: "I think AI might be more interesting than this.",
      modelProvider: "deterministic",
    }),
  });
  const res12 = await handleIntakePost(req12);
  assert.strictEqual(res12.status, 200);
  const data12 = await res12.json();

  // Invariant verification:
  // "I'm interested in X" != "I reject what I'm doing"
  assert.strictEqual(data12.intent.hasExplicitRejection, false, "Comparative interest must NOT be flagged as explicit rejection");
  assert.strictEqual(data12.profile.activePhase.id, p1_12.id, "Active phase must remain Backend Systems");
  assert.strictEqual(data12.profile.activePhase.status, "in_progress", "Active phase must remain in_progress");

  const storedPhases12 = await phaseRepo.getPhaseHistory(pId12);
  assert.strictEqual(storedPhases12.length, 1, "No new phase manufactured; Phase 1 remains the only phase");
  assert.strictEqual(storedPhases12[0].status, "in_progress", "Phase 1 is NOT superseded");
  console.log("  [PASS] Test 12: New interest captured as evidence without implying rejection or superseding active phase.\n");
  passedTests++;

  // --------------------------------------------------------------------------
  // TEST 13: EXPLICIT REJECTION CAUSES NORMAL SUPERSESSION FLOW (FOLLOW-UP TO TEST 12)
  // --------------------------------------------------------------------------
  console.log("Test 13: Explicit rejection causes normal supersession flow...");
  // Following Test 12 on the same learner profile, user explicitly rejects backend
  const req13 = new NextRequest("http://localhost:3000/api/v1/intake/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": pId12 },
    body: JSON.stringify({
      message: "I don't want backend anymore. I'd like to explore AI.",
      modelProvider: "deterministic",
    }),
  });
  const res13 = await handleIntakePost(req13);
  assert.strictEqual(res13.status, 200);
  const data13 = await res13.json();

  // Invariant verification:
  // Now explicit rejection is present -> DecisionEngine supersedes old phase and activates new intervention
  assert.strictEqual(data13.intent.hasExplicitRejection, true, "Explicit rejection detected");
  assert.notStrictEqual(data13.profile.activePhase.id, p1_12.id, "Active phase replaced");
  assert.strictEqual(data13.profile.activePhase.status, "in_progress", "New phase is in_progress");

  const storedPhases13 = await phaseRepo.getPhaseHistory(pId12);
  assert.strictEqual(storedPhases13.length, 2, "History now records 2 phases");
  const oldPhase13 = storedPhases13.find((p) => p.id === p1_12.id);
  assert.strictEqual(oldPhase13?.status, "superseded", "Old backend phase is superseded");
  console.log("  [PASS] Test 13: Explicit rejection properly supersedes previous phase and commits replacement.\n");
  passedTests++;

  console.log("================================================================================");
  console.log(`ALL ${passedTests} DISCOVERY INVARIANT & CONVERSATIONAL TESTS PASSED (100%)!`);
  console.log("================================================================================\n");
}

runDiscoveryInvariantTests().catch((err) => {
  console.error("Discovery Invariant Test Suite Failed:", err);
  process.exit(1);
});


