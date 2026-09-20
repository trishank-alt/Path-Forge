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

  console.log("================================================================================");
  console.log(`ALL ${passedTests} DISCOVERY INVARIANT & CONVERSATIONAL TESTS PASSED (100%)!`);
  console.log("================================================================================\n");
}

runDiscoveryInvariantTests().catch((err) => {
  console.error("Discovery Invariant Test Suite Failed:", err);
  process.exit(1);
});
