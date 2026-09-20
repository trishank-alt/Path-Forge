import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST as handleIntakePost } from "../app/api/v1/intake/messages/route";
import { POST as handlePhaseSubmitPost } from "../app/api/v1/profiles/me/phases/[phaseId]/submit/route";
import { orchestrator } from "../src/lib/application/orchestrator";
import {
  PhaseRepository,
  RoadmapRepository,
  ProfileRepository,
  DecisionRepository,
  EvidenceRepository,
  UserWorkModelRepository,
} from "../src/lib/persistence/repositories";

async function runRuntimeSinglePhaseAdaptiveTests() {
  console.log("================================================================================");
  console.log("PATHFORGE RUNTIME SINGLE-PHASE ADAPTIVE INVARIANT VERIFICATION SUITE");
  console.log("================================================================================\n");

  const phaseRepo = new PhaseRepository();
  const roadmapRepo = new RoadmapRepository();
  const profileRepo = new ProfileRepository();
  const decisionRepo = new DecisionRepository();
  const evidenceRepo = new EvidenceRepository();
  const uwmRepo = new UserWorkModelRepository();

  // ============================================================================
  // TEST 1: REAL HTTP/API INTAKE ROUTE GENERATES EXACTLY ONE PHASE (PHASE 1)
  // ============================================================================
  console.log("Test 1: POST /api/v1/intake/messages generates exactly ONE phase in response & persistence...");
  const t1LearnerId = `test_runtime_learner_1_${Date.now()}`;

  // Reset/seed initial profile
  await profileRepo.resetProfile(t1LearnerId);

  // Send fully specified intake request through the real Next.js route handler
  const intakeReq = new NextRequest("http://localhost:3000/api/v1/intake/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-learner-id": t1LearnerId,
    },
    body: JSON.stringify({
      message: "I want to be an Enterprise Java Backend Developer working on Fintech and Banking using Spring Boot and Microservices. I can study 15 hours a week for 6 months.",
      modelProvider: "deterministic",
    }),
  });

  const intakeRes = await handleIntakePost(intakeReq);
  assert.strictEqual(intakeRes.status, 200, "Intake route must respond with HTTP 200");

  const intakeData = await intakeRes.json();
  assert.ok(intakeData.roadmap, "Roadmap must be returned for fully specified eligible intent");

  // Invariant 1: Fresh roadmap contains ONLY Phase 1
  assert.strictEqual(
    intakeData.roadmap.milestones.length,
    1,
    `Fresh roadmap must contain exactly 1 milestone, got: ${intakeData.roadmap.milestones.length}`
  );
  assert.strictEqual(
    intakeData.roadmap.milestones[0].status,
    "in_progress",
    "Phase 1 milestone must be 'in_progress'"
  );
  assert.strictEqual(
    intakeData.profile.activePhase?.phaseNumber,
    1,
    "Profile activePhase must be Phase 1"
  );

  // Invariant 1 Verification in Persistence:
  const persistedPhases = await phaseRepo.getPhases(t1LearnerId);
  console.log(`  [Persistence Check] Stored phases count: ${persistedPhases.length}`);
  assert.strictEqual(persistedPhases.length, 1, "Exactly 1 phase must exist in persistence");
  assert.strictEqual(persistedPhases[0].phaseNumber, 1, "Phase 1 must exist");
  assert.strictEqual(persistedPhases[0].status, "in_progress", "Phase 1 must be in_progress");

  // Check Phase 2 and Phase 3 do NOT exist anywhere
  const phase2 = persistedPhases.find((p) => p.phaseNumber === 2);
  const phase3 = persistedPhases.find((p) => p.phaseNumber === 3);
  assert.strictEqual(phase2, undefined, "Phase 2 must NOT exist in persistence upon initial planning");
  assert.strictEqual(phase3, undefined, "Phase 3 must NOT exist in persistence upon initial planning");

  const persistedRoadmap = await roadmapRepo.getRoadmap(intakeData.roadmap.id);
  assert.ok(persistedRoadmap, "Roadmap must exist in persistence");
  assert.strictEqual(persistedRoadmap.milestones.length, 1, "Persisted roadmap must have exactly 1 milestone");
  console.log("  [PASS] Test 1: Real intake route creates Phase 1 only. Phase 2 and Phase 3 are strictly absent.\n");

  // ============================================================================
  // TEST 2: SEQUENTIAL LIFECYCLE: COMPLETE PHASE 1 -> COMMIT -> PRODUCE PHASE 2
  // ============================================================================
  console.log("Test 2: Complete Phase 1 via real submit route -> Decision COMMIT -> Phase 2 created...");
  const phase1Id = intakeData.profile.activePhase.id;

  const submitReqCommit = new NextRequest(
    `http://localhost:3000/api/v1/profiles/me/phases/${phase1Id}/submit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-learner-id": t1LearnerId,
      },
      body: JSON.stringify({
        notes: "Built secure REST services using Java and Spring Boot with enterprise database connections.",
        demonstratedCapabilities: ["java_enterprise_oop", "spring_boot_mvc_microservices"],
      }),
    }
  );

  const submitResCommit = await handlePhaseSubmitPost(submitReqCommit, {
    params: Promise.resolve({ phaseId: phase1Id }),
  });
  assert.strictEqual(submitResCommit.status, 200, "Submit route must respond with HTTP 200");

  const submitDataCommit = await submitResCommit.json();
  assert.strictEqual(submitDataCommit.completedPhase.status, "completed", "Phase 1 must be marked completed");
  assert.strictEqual(submitDataCommit.nextDecision.mode, "commit", "Decision Engine must choose COMMIT");
  assert.ok(submitDataCommit.nextPhase, "Next phase must be generated when mode is COMMIT");
  assert.strictEqual(submitDataCommit.nextPhase.phaseNumber, 2, "Next phase must be Phase 2");
  assert.strictEqual(submitDataCommit.nextPhase.status, "in_progress", "Phase 2 must be in_progress");

  // Historical phases preserved: roadmap has Phase 1 (completed) + Phase 2 (in_progress)
  assert.strictEqual(
    submitDataCommit.roadmap.milestones.length,
    2,
    `After Phase 1 completion + COMMIT, roadmap must contain exactly 2 milestones, got: ${submitDataCommit.roadmap.milestones.length}`
  );
  assert.strictEqual(
    submitDataCommit.roadmap.milestones[0].status,
    "completed",
    "Phase 1 milestone must be 'completed'"
  );
  assert.strictEqual(
    submitDataCommit.roadmap.milestones[1].status,
    "in_progress",
    "Phase 2 milestone must be 'in_progress'"
  );

  // Persistence Check after Phase 1 completion:
  const postPhase1Phases = await phaseRepo.getPhases(t1LearnerId);
  console.log(`  [Persistence Check] Stored phases count after Phase 1: ${postPhase1Phases.length}`);
  assert.strictEqual(postPhase1Phases.length, 2, "Persistence must contain exactly Phase 1 and Phase 2");
  assert.strictEqual(
    postPhase1Phases.find((p) => p.phaseNumber === 1)?.status,
    "completed",
    "Phase 1 must be completed in persistence"
  );
  assert.strictEqual(
    postPhase1Phases.find((p) => p.phaseNumber === 2)?.status,
    "in_progress",
    "Phase 2 must be in_progress in persistence"
  );
  const phase3Post1 = postPhase1Phases.find((p) => p.phaseNumber === 3);
  assert.strictEqual(phase3Post1, undefined, "Phase 3 must NOT exist in persistence after Phase 1 completion");

  console.log("  [PASS] Test 2: Phase 1 completed -> COMMIT -> Phase 1 completed + Phase 2 in_progress. Phase 3 absent.\n");

  // ============================================================================
  // TEST 3: SEQUENTIAL LIFECYCLE: COMPLETE PHASE 2 -> COMMIT -> PRODUCE PHASE 3
  // ============================================================================
  console.log("Test 3: Complete Phase 2 via submit route -> Decision COMMIT -> Phase 3 created...");
  const phase2Id = submitDataCommit.nextPhase.id;

  const submitReqPhase2 = new NextRequest(
    `http://localhost:3000/api/v1/profiles/me/phases/${phase2Id}/submit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-learner-id": t1LearnerId,
      },
      body: JSON.stringify({
        notes: "Configured relational persistence, transaction management, and Docker deployment.",
        demonstratedCapabilities: ["enterprise_relational_databases_sql", "docker_containerization_microservices"],
      }),
    }
  );

  const submitResPhase2 = await handlePhaseSubmitPost(submitReqPhase2, {
    params: Promise.resolve({ phaseId: phase2Id }),
  });
  assert.strictEqual(submitResPhase2.status, 200, "Submit route for Phase 2 must return HTTP 200");

  const submitDataPhase2 = await submitResPhase2.json();
  assert.strictEqual(submitDataPhase2.completedPhase.status, "completed", "Phase 2 must be completed");
  assert.strictEqual(submitDataPhase2.nextDecision.mode, "commit", "Decision must be COMMIT");
  assert.strictEqual(submitDataPhase2.nextPhase.phaseNumber, 3, "Next phase must be Phase 3");

  // Roadmap now has 3 milestones: Phase 1 (completed), Phase 2 (completed), Phase 3 (in_progress)
  assert.strictEqual(
    submitDataPhase2.roadmap.milestones.length,
    3,
    `After Phase 2 completion + COMMIT, roadmap must contain exactly 3 milestones, got: ${submitDataPhase2.roadmap.milestones.length}`
  );
  assert.strictEqual(submitDataPhase2.roadmap.milestones[0].status, "completed", "Phase 1 = completed");
  assert.strictEqual(submitDataPhase2.roadmap.milestones[1].status, "completed", "Phase 2 = completed");
  assert.strictEqual(submitDataPhase2.roadmap.milestones[2].status, "in_progress", "Phase 3 = in_progress");

  // Phase 4 must NOT exist
  const postPhase2Phases = await phaseRepo.getPhases(t1LearnerId);
  const phase4 = postPhase2Phases.find((p) => p.phaseNumber === 4);
  assert.strictEqual(phase4, undefined, "Phase 4 must NOT exist");

  console.log("  [PASS] Test 3: Phase 2 completed -> COMMIT -> Phase 1 & 2 completed + Phase 3 in_progress. Phase 4 absent.\n");

  // ============================================================================
  // TEST 4: NON-COMMIT BRANCH: SUBMIT WORK WITH UNCERTAINTY -> DISAMBIGUATE (NO NEXT PHASE)
  // ============================================================================
  console.log("Test 4: Submit work yielding DISAMBIGUATE -> Targeted question returned, Phase N+1 NOT created...");
  const t2LearnerId = `test_runtime_disambiguate_${Date.now()}`;
  await profileRepo.resetProfile(t2LearnerId);

  // Setup profile with Phase 1
  const intakeReq2 = new NextRequest("http://localhost:3000/api/v1/intake/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-learner-id": t2LearnerId,
    },
    body: JSON.stringify({
      message: "I want to be an Enterprise Java Backend Developer working on Fintech and Banking using Spring Boot and Microservices. I can study 15 hours a week for 6 months.",
      modelProvider: "deterministic",
    }),
  });
  const intakeRes2 = await handleIntakePost(intakeReq2);
  const intakeData2 = await intakeRes2.json();
  const phase1_T2 = intakeData2.profile.activePhase!;
  assert.ok(phase1_T2, "Phase 1 must exist for T2");

  // Inject a question-resolvable uncertainty into work model before submit
  const profileT2 = await profileRepo.getProfile(t2LearnerId);
  if (profileT2.workModel) {
    profileT2.workModel.uncertainties = [
      {
        id: "unc_cloud_1",
        dimension: "cloud_architecture",
        description: "Uncertainty regarding AWS vs Azure deployment requirements",
        impact: "high",
        resolutionStrategy: "question",
      },
    ];
    await profileRepo.saveProfile(profileT2);
    await uwmRepo.saveWorkModel(t2LearnerId, profileT2.workModel);
  }

  const submitReqDisambiguate = new NextRequest(
    `http://localhost:3000/api/v1/profiles/me/phases/${phase1_T2.id}/submit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-learner-id": t2LearnerId,
      },
      body: JSON.stringify({
        notes: "Completed Phase 1 exercises, but direction for cloud deployment is ambiguous.",
      }),
    }
  );

  const submitResDisambiguate = await handlePhaseSubmitPost(submitReqDisambiguate, {
    params: Promise.resolve({ phaseId: phase1_T2.id }),
  });
  const submitDataDisambiguate = await submitResDisambiguate.json();

  assert.strictEqual(
    submitDataDisambiguate.nextDecision.mode,
    "disambiguate",
    "Decision Engine must choose DISAMBIGUATE when question-resolvable uncertainty exists"
  );
  assert.ok(
    submitDataDisambiguate.nextDecision.activeQuestion,
    "Targeted question must be returned for DISAMBIGUATE"
  );
  assert.strictEqual(
    submitDataDisambiguate.nextPhase,
    null,
    "Phase N+1 (Phase 2) MUST NOT be created on DISAMBIGUATE"
  );

  // Verify persistence: Phase 2 is strictly absent!
  const t2Phases = await phaseRepo.getPhases(t2LearnerId);
  assert.strictEqual(
    t2Phases.find((p) => p.phaseNumber === 2),
    undefined,
    "Phase 2 must NOT exist in persistence when decision is DISAMBIGUATE"
  );
  console.log("  [PASS] Test 4: DISAMBIGUATE returns targeted question and does NOT create Phase 2.\n");

  // ============================================================================
  // TEST 5: NON-COMMIT BRANCH: SUBMIT WORK YIELDING EXPLORE (NO NEXT PHASE)
  // ============================================================================
  console.log("Test 5: Submit work yielding EXPLORE -> Practical experiment probe returned, Phase N+1 NOT created...");
  const t3LearnerId = `test_runtime_explore_${Date.now()}`;
  await profileRepo.resetProfile(t3LearnerId);

  const intakeReq3 = new NextRequest("http://localhost:3000/api/v1/intake/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-learner-id": t3LearnerId,
    },
    body: JSON.stringify({
      message: "I want to be an Enterprise Java Backend Developer working on Fintech and Banking using Spring Boot and Microservices. I can study 15 hours a week for 6 months.",
      modelProvider: "deterministic",
    }),
  });
  const intakeRes3 = await handleIntakePost(intakeReq3);
  const intakeData3 = await intakeRes3.json();
  const phase1_T3 = intakeData3.profile.activePhase!;
  assert.ok(phase1_T3, "Phase 1 must exist for T3");

  // Induce experiential uncertainty that requires practical exploration probe
  const profileT3 = await profileRepo.getProfile(t3LearnerId);
  if (profileT3.workModel) {
    profileT3.workModel.uncertainties = [
      {
        id: "unc_exp_1",
        dimension: "practical_aptitude",
        description: "Need practical diagnostic probe to measure engagement and problem-solving velocity",
        impact: "high",
        resolutionStrategy: "experiment",
      },
    ];
    await profileRepo.saveProfile(profileT3);
    await uwmRepo.saveWorkModel(t3LearnerId, profileT3.workModel);
  }

  const submitReqExplore = new NextRequest(
    `http://localhost:3000/api/v1/profiles/me/phases/${phase1_T3.id}/submit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-learner-id": t3LearnerId,
      },
      body: JSON.stringify({
        notes: "Completed Phase 1 deliverable, but seeking practical probe before committing further.",
      }),
    }
  );

  const submitResExplore = await handlePhaseSubmitPost(submitReqExplore, {
    params: Promise.resolve({ phaseId: phase1_T3.id }),
  });
  const submitDataExplore = await submitResExplore.json();

  assert.strictEqual(
    submitDataExplore.nextDecision.mode,
    "explore",
    "Decision Engine must choose EXPLORE when experiment-resolvable uncertainty exists"
  );
  assert.ok(
    submitDataExplore.nextDecision.activeExperiment,
    "Practical experiment plan must be returned for EXPLORE"
  );
  assert.strictEqual(
    submitDataExplore.nextPhase,
    null,
    "Phase N+1 (Phase 2) MUST NOT be created on EXPLORE"
  );

  // Verify persistence: Phase 2 is strictly absent!
  const t3Phases = await phaseRepo.getPhases(t3LearnerId);
  assert.strictEqual(
    t3Phases.find((p) => p.phaseNumber === 2),
    undefined,
    "Phase 2 must NOT exist in persistence when decision is EXPLORE"
  );
  console.log("  [PASS] Test 5: EXPLORE returns practical experiment and does NOT create Phase 2.\n");

  // ============================================================================
  // TEST 6: STATIC AUDIT: PROVE MilestonePlanner IS ABSENT FROM ACTIVE RUNTIME EXECUTION
  // ============================================================================
  console.log("Test 6: Static codebase audit: Prove MilestonePlanner is NOT in active runtime execution...");

  const repoRoot = path.resolve(__dirname, "..");
  const orchestratorFilePath = path.join(repoRoot, "src", "lib", "application", "orchestrator.ts");
  const orchestratorContent = fs.readFileSync(orchestratorFilePath, "utf-8");

  // Verify orchestrator.ts contains 0 references to MilestonePlanner
  const orchestratorMatches = (orchestratorContent.match(/MilestonePlanner/g) || []).length;
  assert.strictEqual(
    orchestratorMatches,
    0,
    `LearningOrchestrator must have 0 references to MilestonePlanner, found: ${orchestratorMatches}`
  );

  const milestonePlannerCallMatches = (orchestratorContent.match(/planMilestones/g) || []).length;
  assert.strictEqual(
    milestonePlannerCallMatches,
    0,
    `LearningOrchestrator must have 0 calls to planMilestones(), found: ${milestonePlannerCallMatches}`
  );

  // Scan all files in src/lib/ and app/ for active imports of MilestonePlanner
  const dirsToScan = [
    path.join(repoRoot, "src", "lib", "application"),
    path.join(repoRoot, "src", "lib", "domain", "planning"),
    path.join(repoRoot, "src", "lib", "domain", "decision"),
    path.join(repoRoot, "src", "lib", "domain", "evidence"),
    path.join(repoRoot, "app", "api"),
  ];

  for (const dir of dirsToScan) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir, { recursive: true }) as string[];
    for (const f of files) {
      if (typeof f === "string" && (f.endsWith(".ts") || f.endsWith(".tsx"))) {
        const fullPath = path.join(dir, f);
        const content = fs.readFileSync(fullPath, "utf-8");
        const hasImport = content.includes("import") && content.includes("MilestonePlanner");
        assert.strictEqual(
          hasImport,
          false,
          `Active runtime file '${f}' must not import MilestonePlanner`
        );
      }
    }
  }

  console.log("  [PASS] Test 6: MilestonePlanner is completely absent from all active application runtime code.\n");

  console.log("================================================================================");
  console.log("ALL 6 RUNTIME SINGLE-PHASE ADAPTIVE INVARIANT TESTS PASSED WITH 100% SUCCESS!");
  console.log("================================================================================");
}

runRuntimeSinglePhaseAdaptiveTests().catch((err) => {
  console.error("\nTEST SUITE FAILED WITH ERROR:", err);
  process.exit(1);
});
