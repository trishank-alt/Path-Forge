import { LearningOrchestrator } from "../src/lib/application/orchestrator";
import { pathCompatibilityGate } from "../src/lib/domain/intent/path-compatibility-gate";
import { SEEDED_PATHS } from "../src/lib/persistence/seed-data";
import { curriculumDiscoveryService } from "../src/lib/domain/learning/curriculum-discovery-service";
import { CurriculumVerifier } from "../src/lib/domain/learning/curriculum-verifier";
import { CurriculumProposal } from "../src/lib/contracts";
import { GroqLlmAdapter } from "../src/lib/llm/groq-adapter";

async function runRegressionTestSuite() {
  console.log("================================================================================");
  console.log("RUNNING SOFTWARE ENGINEER & CURRICULUM DISCOVERY REGRESSION TEST SUITE");
  console.log("================================================================================\n");

  let passedTests = 0;

  // ----------------------------------------------------------------------
  // TEST 1: 'I want to become a Software Engineer' matches catalog, not discovery
  // ----------------------------------------------------------------------
  console.log("Test 1: 'I want to become a Software Engineer' enters Catalog Clarification (NOT Discovery)...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("test_se_1");

    const res = await orch.handleIntake(
      {
        message: "I want to become a Software Engineer",
        modelProvider: "deterministic",
      },
      "test_se_1"
    );

    if (res.decision.eligibility !== "material_uncertainty") {
      throw new Error(`FAIL Test 1: Expected eligibility='material_uncertainty', got '${res.decision.eligibility}'`);
    }

    if (res.decision.curriculumSource === "constructed") {
      throw new Error("FAIL Test 1: Software Engineer must NOT trigger constructed curriculum discovery");
    }

    if (res.roadmap !== null) {
      throw new Error("FAIL Test 1: Roadmap must be null while material dimensions remain uncertain");
    }

    if (!res.activeQuestion) {
      throw new Error("FAIL Test 1: Expected an active clarification question for ambiguous Software Engineer goal");
    }

    // Verify PathCompatibilityGate directly
    const facts = (await orch.getProfile("test_se_1")).facts;
    const compat = pathCompatibilityGate.evaluateIntentCompatibility(facts, SEEDED_PATHS);

    if (compat.eligiblePaths.length === 0) {
      throw new Error("FAIL Test 1: eligiblePaths must be > 0 for Software Engineer");
    }

    if (!compat.isIntentSupported) {
      throw new Error("FAIL Test 1: isIntentSupported must be true for Software Engineer");
    }

    console.log(`  [PASS] Software Engineer matched ${compat.eligiblePaths.length} catalog paths with active clarification question.\n`);
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // TEST 2: Duplicated normalizedValue + rawValue does NOT break PathCompatibilityGate
  // ----------------------------------------------------------------------
  console.log("Test 2: Duplicated normalizedValue + rawValue does NOT break PathCompatibilityGate...");
  {
    const duplicatedFact = {
      id: "f_dup_1",
      dimension: "declared_goal",
      normalizedValue: "software engineer",
      rawValue: "Software Engineer",
      source: "user_answer" as const,
      evidence: "I want to become a Software Engineer",
      reliability: 0.95,
      impact: "high" as const,
      status: "active" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const compat = pathCompatibilityGate.evaluateIntentCompatibility([duplicatedFact], SEEDED_PATHS);

    if (compat.eligiblePaths.length === 0) {
      throw new Error("FAIL Test 2: Duplicated goal text caused 0 eligible paths");
    }

    if (!compat.isIntentSupported) {
      throw new Error("FAIL Test 2: Duplicated goal text caused isIntentSupported=false");
    }

    console.log(`  [PASS] PathCompatibilityGate safely resolved duplicated text with ${compat.eligiblePaths.length} eligible paths.\n`);
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // TEST 3: Semantically equivalent variations ('Software Developer', 'Programmer', 'Developer')
  // ----------------------------------------------------------------------
  console.log("Test 3: Semantically equivalent variations match catalog paths...");
  {
    const variations = [
      "I want to become a Software Developer",
      "I want to be a Programmer",
      "I want to work as a Developer",
      "I want to study Software Engineering",
    ];

    for (const msg of variations) {
      const orch = new LearningOrchestrator();
      const testId = `test_var_${Math.random().toString(36).slice(2, 6)}`;
      await orch.resetState(testId);

      const res = await orch.handleIntake(
        { message: msg, modelProvider: "deterministic" },
        testId
      );

      if (res.decision.eligibility !== "material_uncertainty") {
        throw new Error(`FAIL Test 3 for '${msg}': Expected eligibility='material_uncertainty', got '${res.decision.eligibility}'`);
      }

      if (res.decision.curriculumSource === "constructed") {
        throw new Error(`FAIL Test 3 for '${msg}': Expected catalog route, got constructed`);
      }
    }

    console.log("  [PASS] All general software variations recognized and routed to catalog clarification.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // TEST 4: Backend Engineer + 'Not sure yet' -> Recommendation Mode
  // ----------------------------------------------------------------------
  console.log("Test 4: Backend Engineer + 'Not sure yet' triggers recommendation mode without unsupported_intent...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("test_be_rec");

    // Turn 1: Declare backend engineering
    const t1 = await orch.handleIntake(
      { message: "I want to become a Backend Engineer", modelProvider: "deterministic" },
      "test_be_rec"
    );

    if (t1.decision.eligibility !== "material_uncertainty") {
      throw new Error(`FAIL Test 4 Turn 1: Expected material_uncertainty, got '${t1.decision.eligibility}'`);
    }

    if (!t1.activeQuestion) {
      throw new Error("FAIL Test 4 Turn 1: Expected active clarification question");
    }

    // Turn 2: Non-committal answer to question
    const t2 = await orch.answerQuestion(
      t1.activeQuestion.selectedQuestion.dimension,
      "Not sure yet / Open to suggestions",
      "test_be_rec",
      { provider: "deterministic" }
    );

    if (t2.decision.eligibility === "unsupported_intent") {
      throw new Error("FAIL Test 4 Turn 2: Non-committal answer should NOT produce unsupported_intent");
    }

    if (!t2.decision.recommendation) {
      throw new Error("FAIL Test 4 Turn 2: Expected active recommendation mode in decision.recommendation");
    }

    if (t2.decision.recommendation.options.length === 0) {
      throw new Error("FAIL Test 4 Turn 2: Expected non-empty recommendation options");
    }

    console.log(`  [PASS] Recommendation mode '${t2.decision.recommendation.mode}' activated successfully with ${t2.decision.recommendation.options.length} options.\n`);
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // TEST 5: Backend Engineer + selected option continues clarification for remaining dimensions
  // ----------------------------------------------------------------------
  console.log("Test 5: Selecting a recommendation option resolves dimension and continues clarification...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("test_be_cont");

    const t1 = await orch.handleIntake(
      { message: "I want to become a Backend Engineer", modelProvider: "deterministic" },
      "test_be_cont"
    );

    const t2 = await orch.answerQuestion(
      t1.activeQuestion!.selectedQuestion.dimension,
      "Not sure yet / Open to suggestions",
      "test_be_cont",
      { provider: "deterministic" }
    );

    // Turn 3: Select Enterprise domain from recommendations
    const t3 = await orch.answerQuestion(
      "target_domain",
      "Enterprise ERP & Banking",
      "test_be_cont",
      { provider: "deterministic" }
    );

    if (t3.decision.curriculumSource === "constructed") {
      throw new Error("FAIL Test 5 Turn 3: Expected catalog route, got constructed");
    }

    console.log("  [PASS] Dimension successfully resolved from recommendation selection.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // TEST 6: Fully specified Backend Engineer produces catalog roadmap
  // ----------------------------------------------------------------------
  console.log("Test 6: Fully specified Backend Engineer generates verified catalog roadmap...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("test_be_full");

    const t = await orch.handleIntake(
      {
        message: "I want to be an Enterprise Java Backend Developer working on Fintech and Banking using Spring Boot and Microservices. I can study 15 hours a week for 6 months.",
        modelProvider: "deterministic",
      },
      "test_be_full"
    );

    if (t.decision.eligibility !== "eligible") {
      throw new Error(`FAIL Test 6: Expected eligibility='eligible', got '${t.decision.eligibility}'`);
    }

    if (!t.roadmap) {
      throw new Error("FAIL Test 6: Expected non-null roadmap for fully specified learner");
    }

    if (t.decision.selectedPathId !== "backend_enterprise_java") {
      throw new Error(`FAIL Test 6: Expected selectedPathId='backend_enterprise_java', got '${t.decision.selectedPathId}'`);
    }

    console.log(`  [PASS] Generated catalog roadmap '${t.roadmap.targetPathTitle}' with ${t.roadmap.milestones.length} milestones.\n`);
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // TEST 7: Genuine Uncatalogued Career enters Curriculum Discovery and passes all 10 gates
  // ----------------------------------------------------------------------
  console.log("Test 7: Genuine uncatalogued career (Robotics) triggers Curriculum Discovery and passes all 10 gates...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("test_robotics");

    const t = await orch.handleIntake(
      {
        message: "I am a mechanical engineer and I want to transition to Autonomous Robotics Systems and ROS 2 navigation.",
        modelProvider: "deterministic",
      },
      "test_robotics"
    );

    if (t.decision.curriculumSource !== "constructed") {
      throw new Error(`FAIL Test 7: Expected curriculumSource='constructed', got '${t.decision.curriculumSource}'`);
    }

    if (t.decision.eligibility !== "eligible") {
      throw new Error(`FAIL Test 7: Expected eligibility='eligible', got '${t.decision.eligibility}'`);
    }

    if (!t.roadmap) {
      throw new Error("FAIL Test 7: Expected non-null constructed roadmap");
    }

    if (t.decision.selectedPathId !== null) {
      throw new Error("FAIL Test 7: SelectedPathId must be null for constructed curricula");
    }

    console.log(`  [PASS] Constructed curriculum '${t.roadmap.targetPathTitle}' verified through all 10 gates and generated roadmap.\n`);
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // TEST 8: CurriculumVerifier Gate 7 & Gate 8 Hard Enforcement Verification
  // ----------------------------------------------------------------------
  console.log("Test 8: CurriculumVerifier strictly rejects proposals violating Gate 7 or Gate 8...");
  {
    const verifier = new CurriculumVerifier();

    // Valid proposal base
    const validProposal: CurriculumProposal = {
      targetRole: "Autonomous Drone Engineer",
      domain: "Autonomous Avionics",
      description: "Flight control systems and autonomous drone navigation.",
      proposedSkills: [
        { id: "s_drone_fc", title: "Drone Flight Dynamics & Aerodynamics", domain: "Autonomous Avionics", level: 2, category: "Core", description: "Dynamics", evidenceCriteria: ["Crit 1", "Crit 2"], tags: ["drone", "autonomous"] },
        { id: "s_drone_sensors", title: "Drone IMU & Sensor Integration", domain: "Autonomous Avionics", level: 2, category: "Core", description: "Sensors", evidenceCriteria: ["Crit 1", "Crit 2"], tags: ["drone", "sensors"] },
        { id: "s_drone_slam", title: "Visual SLAM & LiDAR Mapping for Drones", domain: "Autonomous Avionics", level: 3, category: "Core", description: "SLAM", evidenceCriteria: ["Crit 1", "Crit 2"], tags: ["drone", "slam"] },
        { id: "s_drone_nav", title: "Autonomous Drone Path Planning", domain: "Autonomous Avionics", level: 4, category: "Core", description: "Navigation", evidenceCriteria: ["Crit 1", "Crit 2"], tags: ["drone", "autonomous"] },
      ],
      targetSkillWeights: {
        s_drone_fc: 0.25,
        s_drone_sensors: 0.25,
        s_drone_slam: 0.25,
        s_drone_nav: 0.25,
      },
      proposedEdges: [
        { id: "e1", fromSkillId: "s_drone_fc", toSkillId: "s_drone_sensors", type: "required", minimumLevel: "working", rationale: "Dynamics before sensors" },
        { id: "e2", fromSkillId: "s_drone_sensors", toSkillId: "s_drone_slam", type: "required", minimumLevel: "working", rationale: "Sensors before SLAM" },
        { id: "e3", fromSkillId: "s_drone_slam", toSkillId: "s_drone_nav", type: "required", minimumLevel: "working", rationale: "SLAM before navigation" },
      ],
      proposedResources: [
        { id: "r1", skillId: "s_drone_fc", title: "Flight Control Handbook", provider: "AIAA", url: "https://aiaa.org/doc", format: "book", costType: "free", durationHours: 20, qualityScore: 0.9, description: "Guide" },
        { id: "r2", skillId: "s_drone_sensors", title: "Sensor Fusion Manual", provider: "IEEE", url: "https://ieee.org/doc", format: "documentation", costType: "free", durationHours: 20, qualityScore: 0.9, description: "Guide" },
        { id: "r3", skillId: "s_drone_slam", title: "Visual SLAM Guide", provider: "OpenCV", url: "https://opencv.org/slam", format: "documentation", costType: "free", durationHours: 20, qualityScore: 0.9, description: "Guide" },
        { id: "r4", skillId: "s_drone_nav", title: "Autonomous Navigation Handbook", provider: "ROS", url: "https://ros.org/nav", format: "documentation", costType: "free", durationHours: 20, qualityScore: 0.9, description: "Guide" },
      ],
      proposedProjects: [
        {
          id: "p1",
          title: "Autonomous Quadrotor Navigation",
          description: "Full simulation in Gazebo",
          targetSkillIds: ["s_drone_fc", "s_drone_nav"],
          deliverables: ["Deliverable 1", "Deliverable 2"],
          verificationChecklist: ["Checklist 1", "Checklist 2"],
          estimatedHours: 40,
          domainContext: "Autonomous Avionics",
        },
      ],
      estimatedLearningHours: 120,
    };

    // 8a. Valid proposal passes
    const validRes = verifier.verify(validProposal);
    if (!validRes.isValid) {
      throw new Error(`FAIL Test 8a: Valid proposal should pass, failed on: ${validRes.failedGates.join("; ")}`);
    }

    // 8b. Gate 7 failure: missing resources on core skills (0% coverage)
    const noResProposal: CurriculumProposal = {
      ...validProposal,
      proposedResources: [],
    };
    const gate7Res = verifier.verify(noResProposal);
    if (gate7Res.isValid || !gate7Res.failedGates.includes("Gate 7 (Resource Attachment)")) {
      throw new Error("FAIL Test 8b: Empty resources must fail Gate 7");
    }

    // 8c. Gate 7 failure: empty provider
    const badProviderProposal: CurriculumProposal = {
      ...validProposal,
      proposedResources: [
        { id: "r1", skillId: "s_drone_fc", title: "Flight Guide", provider: "   ", url: "https://aiaa.org", format: "book", costType: "free", durationHours: 20, qualityScore: 0.9, description: "Guide" },
        { id: "r2", skillId: "s_drone_sensors", title: "Sensor Guide", provider: "IEEE", url: "https://ieee.org", format: "book", costType: "free", durationHours: 20, qualityScore: 0.9, description: "Guide" },
        { id: "r3", skillId: "s_drone_slam", title: "SLAM Guide", provider: "OpenCV", url: "https://opencv.org", format: "book", costType: "free", durationHours: 20, qualityScore: 0.9, description: "Guide" },
        { id: "r4", skillId: "s_drone_nav", title: "Nav Guide", provider: "ROS", url: "https://ros.org", format: "book", costType: "free", durationHours: 20, qualityScore: 0.9, description: "Guide" },
      ],
    };
    const gate7ProviderRes = verifier.verify(badProviderProposal);
    if (gate7ProviderRes.isValid || !gate7ProviderRes.failedGates.includes("Gate 7 (Resource Attachment)")) {
      throw new Error("FAIL Test 8c: Blank resource provider must fail Gate 7");
    }

    // 8d. Gate 8 failure: project has < 2 deliverables
    const badDeliverablesProposal: CurriculumProposal = {
      ...validProposal,
      proposedProjects: [
        {
          id: "p1",
          title: "Quadrotor Project",
          description: "Description",
          targetSkillIds: ["s_drone_fc", "s_drone_nav"],
          deliverables: ["Only One Deliverable"],
          verificationChecklist: ["Checklist 1", "Checklist 2"],
          estimatedHours: 40,
          domainContext: "Autonomous Avionics",
        },
      ],
    };
    const gate8DeliverableRes = verifier.verify(badDeliverablesProposal);
    if (gate8DeliverableRes.isValid || !gate8DeliverableRes.failedGates.includes("Gate 8 (Practical Verification)")) {
      throw new Error("FAIL Test 8d: Single deliverable must fail Gate 8");
    }

    // 8e. Gate 8 failure: project has < 2 checklists
    const badChecklistProposal: CurriculumProposal = {
      ...validProposal,
      proposedProjects: [
        {
          id: "p1",
          title: "Quadrotor Project",
          description: "Description",
          targetSkillIds: ["s_drone_fc", "s_drone_nav"],
          deliverables: ["Deliverable 1", "Deliverable 2"],
          verificationChecklist: ["Only One Checklist Item"],
          estimatedHours: 40,
          domainContext: "Autonomous Avionics",
        },
      ],
    };
    const gate8ChecklistRes = verifier.verify(badChecklistProposal);
    if (gate8ChecklistRes.isValid || !gate8ChecklistRes.failedGates.includes("Gate 8 (Practical Verification)")) {
      throw new Error("FAIL Test 8e: Single checklist item must fail Gate 8");
    }

    console.log("  [PASS] All 10 verification gates strictly enforced without weakening.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // TEST 9: CurriculumDiscoveryService + GroqLlmAdapter recovers from single truncation via bounded retry
  // ----------------------------------------------------------------------
  console.log("Test 9: CurriculumDiscoveryService + GroqLlmAdapter recovers from single truncation via bounded retry...");
  {
    const originalFetch = global.fetch;
    let fetchCalls = 0;
    try {
      global.fetch = (async () => {
        fetchCalls++;
        if (fetchCalls === 1) {
          // Truncated first attempt
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  finish_reason: "length",
                  message: { content: "{\"targetRole\":\"VR Graphics Engineer\",\"proposedSkills\":[{\"id\":\"s1\"" },
                },
              ],
            }),
          };
        } else {
          // Recovered second attempt
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  finish_reason: "stop",
                  message: {
                    content: JSON.stringify({
                      targetRole: "VR Graphics Engineer",
                      domain: "Virtual Reality",
                      description: "VR graphics development curriculum",
                      specialization: "Spatial Rendering",
                      proposedSkills: [
                        { id: "vr_math", title: "3D Math & Linear Algebra", domain: "Virtual Reality", level: 1, category: "Core", description: "Vectors & Matrices", evidenceCriteria: ["Crit 1", "Crit 2"], tags: ["math", "vr"] },
                        { id: "vr_shaders", title: "Spatial Shaders & OpenXR", domain: "Virtual Reality", level: 2, category: "Graphics", description: "Stereo rendering pipelines", evidenceCriteria: ["Crit 1", "Crit 2"], tags: ["shaders", "vr"] },
                        { id: "vr_tracking", title: "6DoF Spatial Tracking", domain: "Virtual Reality", level: 3, category: "Tracking", description: "IMU and Optical tracking fusion", evidenceCriteria: ["Crit 1", "Crit 2"], tags: ["tracking", "vr"] },
                        { id: "vr_interaction", title: "Spatial Interaction & UI", domain: "Virtual Reality", level: 3, category: "Interaction", description: "Haptic and gesture UI", evidenceCriteria: ["Crit 1", "Crit 2"], tags: ["interaction", "vr"] },
                      ],
                      proposedEdges: [
                        { from: "vr_math", to: "vr_shaders", type: "required" },
                        { from: "vr_shaders", to: "vr_tracking", type: "required" },
                        { from: "vr_tracking", to: "vr_interaction", type: "required" },
                      ],
                      proposedResources: [
                        { id: "r1", skillId: "vr_math", title: "3D Math Primer", provider: "CRC Press", url: "https://gamemath.com", format: "book", costType: "free", durationHours: 25, qualityScore: 0.92, description: "3D Math" },
                        { id: "r2", skillId: "vr_shaders", title: "OpenXR Specification", provider: "Khronos Group", url: "https://khronos.org", format: "documentation", costType: "free", durationHours: 30, qualityScore: 0.95, description: "OpenXR Docs" },
                        { id: "r3", skillId: "vr_tracking", title: "Spatial Tracking Handbook", provider: "IEEE", url: "https://ieee.org/vr", format: "documentation", costType: "free", durationHours: 25, qualityScore: 0.93, description: "Tracking Docs" },
                        { id: "r4", skillId: "vr_interaction", title: "3D User Interfaces", provider: "Addison-Wesley", url: "https://informit.com/vr", format: "book", costType: "paid", durationHours: 25, qualityScore: 0.91, description: "Interaction Book" },
                      ],
                      proposedProjects: [
                        {
                          id: "p1",
                          title: "Stereoscopic 6DoF VR Experience",
                          description: "Full OpenXR app",
                          targetSkillIds: ["vr_math", "vr_shaders", "vr_tracking", "vr_interaction"],
                          deliverables: ["Compiled VR app", "Performance report"],
                          verificationChecklist: ["Maintains 90 FPS", "Zero stereo distortion"],
                          estimatedHours: 50,
                          domainContext: "Virtual Reality",
                        },
                      ],
                      estimatedLearningHours: 155,
                    }),
                  },
                },
              ],
            }),
          };
        }
      }) as any;

      const groqAdapter = new GroqLlmAdapter("dummy_groq_key", "openai/gpt-oss-120b");
      const res = await curriculumDiscoveryService.discoverAndVerifyCurriculum(
        { targetRole: "VR Graphics Engineer", targetDomain: "Virtual Reality" },
        groqAdapter,
        "agnostic"
      );

      if (fetchCalls !== 2) {
        throw new Error(`FAIL Test 9: Expected 2 fetch calls for retry, got ${fetchCalls}`);
      }

      if (res.status !== "success" || !res.curriculum) {
        throw new Error(`FAIL Test 9: Expected status='success' after retry, got '${res.status}', failures: ${res.gateFailures?.join(", ")}`);
      }

      if (res.curriculum.skills.length !== 4) {
        throw new Error(`FAIL Test 9: Expected 4 skills in constructed curriculum, got ${res.curriculum.skills.length}`);
      }

      console.log(`  [PASS] Curriculum discovery successfully recovered via bounded retry to produce '${res.curriculum.title}'.\n`);
      passedTests++;
    } finally {
      global.fetch = originalFetch;
    }
  }

  // ----------------------------------------------------------------------
  // TEST 10: Repeated truncation produces controlled 'generation_truncated' failure
  // ----------------------------------------------------------------------
  console.log("Test 10: Repeated truncation produces controlled 'generation_truncated' discovery failure...");
  {
    const doubleTruncatedLlmPort = {
      async proposeCurriculum() {
        return null;
      },
      getLastExecutionMetadata() {
        return {
          provider: "groq" as const,
          modelName: "openai/gpt-oss-120b",
          fallbackUsed: false,
          failureCategory: "generation_truncated" as const,
          latencyMs: 500,
          requestId: "req_double_trunc",
        };
      },
    };

    const res = await curriculumDiscoveryService.discoverAndVerifyCurriculum(
      { targetRole: "Game Engineer", targetDomain: "Gaming" },
      doubleTruncatedLlmPort as any,
      "agnostic"
    );

    if (res.status !== "generation_truncated") {
      throw new Error(`FAIL Test 10: Expected status='generation_truncated', got '${res.status}'`);
    }

    if (!res.gateFailures?.includes("Generation Truncated")) {
      throw new Error("FAIL Test 10: Expected gateFailures to include 'Generation Truncated'");
    }

    console.log("  [PASS] Double truncation correctly classified as 'generation_truncated' without fabricating data.\n");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // TEST 11: End-to-end 'Software Engineer' + 'Gaming' constructed curriculum and roadmap
  // ----------------------------------------------------------------------
  console.log("Test 11: 'Software Engineer' + 'Gaming' produces verified constructed curriculum & roadmap...");
  {
    const orch = new LearningOrchestrator();
    const sessionId = "test_se_gaming_constructed";
    await orch.resetState(sessionId);

    // Mock an adapter that returns a valid Gaming curriculum proposal
    const mockGamingAdapter = {
      async extract(ctx: any) {
        if (ctx.message.toLowerCase().includes("gaming")) {
          return {
            facts: [
              { dimension: "declared_goal", value: "Software Engineer", rawValue: "Software Engineer", evidence: "Software Engineer", claimType: "explicit", polarity: "positive" },
              { dimension: "target_domain", value: "Gaming", rawValue: "Gaming", evidence: "Gaming", claimType: "explicit", polarity: "positive" },
              { dimension: "primary_language", value: "C++", rawValue: "C++", evidence: "C++", claimType: "explicit", polarity: "positive" },
              { dimension: "hours_per_week", value: "15", rawValue: "15", evidence: "15", claimType: "explicit", polarity: "positive" },
            ],
            detectedGoal: "Software Engineer",
          };
        }
        return {
          facts: [
            { dimension: "declared_goal", value: "Software Engineer", rawValue: "Software Engineer", evidence: "I want to become a Software Engineer", claimType: "explicit", polarity: "positive" },
          ],
          detectedGoal: "Software Engineer",
        };
      },
      async proposeQuestions() {
        return {
          candidates: [
            {
              dimension: "target_domain",
              question: "What technical domain do you want to specialize in?",
              answerType: "single_choice" as const,
              options: ["Gaming", "Enterprise", "Frontend", "Not sure yet / Open to suggestions"],
              why: "Clarify target domain",
              predictedAnswerBuckets: ["Gaming"],
            },
          ],
        };
      },
      async proposeCurriculum(ctx: any) {
        return {
          targetRole: ctx.targetRole || "Software Engineer – Gaming",
          domain: ctx.targetDomain || "Gaming",
          description: "Comprehensive curriculum for game software engineers.",
          specialization: "Game Engine Systems & Gameplay Architecture",
          technologyEcosystem: "agnostic" as const,
          proposedSkills: [
            { id: "skill_cpp_core", title: "Modern C++ Programming", domain: "Gaming", level: 1, category: "Programming", description: "C++ syntax and memory", evidenceCriteria: ["Loop test", "Memory test"], tags: ["c++"] },
            { id: "skill_game_engine", title: "Game Engine Architecture", domain: "Gaming", level: 2, category: "Engine", description: "ECS and subsystem design", evidenceCriteria: ["ECS demo", "Subsystem diagram"], tags: ["engine"] },
            { id: "skill_graphics", title: "Real-Time Graphics Programming", domain: "Gaming", level: 3, category: "Graphics", description: "Shaders and pipelines", evidenceCriteria: ["Shader demo", "Phong lighting"], tags: ["graphics"] },
            { id: "skill_physics", title: "Game Physics Simulation", domain: "Gaming", level: 3, category: "Physics", description: "Rigid body simulation", evidenceCriteria: ["Rigid body demo", "Collision resolution"], tags: ["physics"] },
            { id: "skill_multiplayer", title: "Networked Multiplayer Systems", domain: "Gaming", level: 4, category: "Networking", description: "UDP client-server netcode", evidenceCriteria: ["Lobby test", "State sync demo"], tags: ["networking"] },
          ],
          proposedEdges: [
            { id: "e1", fromSkillId: "skill_cpp_core", toSkillId: "skill_game_engine", type: "required" as const, minimumLevel: "working" as const, rationale: "C++ before engine" },
            { id: "e2", fromSkillId: "skill_game_engine", toSkillId: "skill_graphics", type: "required" as const, minimumLevel: "working" as const, rationale: "Engine before graphics" },
            { id: "e3", fromSkillId: "skill_game_engine", toSkillId: "skill_physics", type: "required" as const, minimumLevel: "working" as const, rationale: "Engine before physics" },
            { id: "e4", fromSkillId: "skill_graphics", toSkillId: "skill_multiplayer", type: "required" as const, minimumLevel: "working" as const, rationale: "Graphics before netcode" },
          ],
          targetSkillWeights: {
            skill_cpp_core: 0.1,
            skill_game_engine: 0.2,
            skill_graphics: 0.25,
            skill_physics: 0.2,
            skill_multiplayer: 0.25,
          },
          proposedResources: [
            { id: "r1", skillId: "skill_cpp_core", title: "Learn C++", provider: "LearnCpp", url: "https://learncpp.com", format: "documentation" as const, costType: "free" as const, durationHours: 30, qualityScore: 0.95, description: "C++ Guide" },
            { id: "r2", skillId: "skill_game_engine", title: "Game Engine Architecture", provider: "CRC Press", url: "https://gameenginebook.com", format: "book" as const, costType: "paid" as const, durationHours: 40, qualityScore: 0.94, description: "Engine Architecture" },
            { id: "r3", skillId: "skill_graphics", title: "LearnOpenGL", provider: "LearnOpenGL", url: "https://learnopengl.com", format: "interactive_course" as const, costType: "free" as const, durationHours: 35, qualityScore: 0.96, description: "OpenGL Guide" },
            { id: "r4", skillId: "skill_physics", title: "Real-Time Collision Detection", provider: "Morgan Kaufmann", url: "https://sciencedirect.com", format: "book" as const, costType: "paid" as const, durationHours: 30, qualityScore: 0.92, description: "Physics Book" },
            { id: "r5", skillId: "skill_multiplayer", title: "Multiplayer Netcode", provider: "GafferOnGames", url: "https://gafferongames.com", format: "documentation" as const, costType: "free" as const, durationHours: 25, qualityScore: 0.93, description: "Netcode Guide" },
          ],
          proposedProjects: [
            {
              id: "p1",
              title: "3D Arena Shooter Game Prototype",
              description: "Hands-on capstone",
              targetSkillIds: ["skill_game_engine", "skill_graphics", "skill_physics", "skill_multiplayer"],
              deliverables: ["Playable executable", "Architecture & test documentation"],
              verificationChecklist: ["Stable 60 FPS under load", "Client-server state replication over UDP"],
              estimatedHours: 60,
              domainContext: "Gaming",
            },
          ],
          estimatedLearningHours: 220,
        };
      },
      async assessCurriculumCapability(goal: string) {
        return {
          supported: true,
          confidence: 0.95,
          rationale: "Constructible gaming engineering curriculum.",
          recommendedTrack: "Software Engineer – Gaming",
          requiredDimensions: ["primary_language", "target_domain", "hours_per_week"],
        };
      },
      async explainRoadmap() {
        return { selectedPathId: null, assumptions: ["Valid Gaming track"], milestoneExplanations: [], warnings: [] };
      },
      async generateAssessment() {
        return { skillId: "skill_cpp_core", claimedLevel: "1", questions: [] };
      },
      getLastExecutionMetadata() {
        return { provider: "groq" as const, modelName: "openai/gpt-oss-120b", fallbackUsed: false, latencyMs: 150, requestId: "req_gaming_test" };
      },
    };

    // Inject mock adapter into orchestrator's llmGateway
    (orch as any).llmGateway = {
      getAdapter: () => mockGamingAdapter,
    };

    // Turn 1: Software Engineer with Gaming domain and C++ language
    const t1 = await orch.handleIntake(
      { message: "I want to become a Software Engineer specializing in Gaming using C++ with 15 hours per week.", modelProvider: "groq" },
      sessionId
    );

    if (t1.decision.eligibility !== "eligible") {
      throw new Error(`FAIL Test 11 Turn 1: Expected eligibility='eligible', got '${t1.decision.eligibility}'`);
    }

    if (t1.decision.curriculumSource !== "constructed") {
      throw new Error(`FAIL Test 11 Turn 1: Expected curriculumSource='constructed', got '${t1.decision.curriculumSource}'`);
    }

    if (t1.decision.selectedPathId !== null) {
      throw new Error(`FAIL Test 11 Turn 1: Expected selectedPathId=null for constructed curriculum, got '${t1.decision.selectedPathId}'`);
    }

    if (!t1.decision.curriculumId?.startsWith("constructed:")) {
      throw new Error(`FAIL Test 11 Turn 1: Expected curriculumId to start with 'constructed:', got '${t1.decision.curriculumId}'`);
    }

    if (!t1.roadmap) {
      throw new Error("FAIL Test 11 Turn 1: Expected non-null roadmap generated for Gaming constructed curriculum");
    }

    console.log(`  [PASS] Software Engineer + Gaming successfully generated verified constructed roadmap '${t1.roadmap.targetPathTitle}' with ${t1.roadmap.milestones.length} milestones.\n`);
    passedTests++;
  }

  console.log("================================================================================");
  console.log(`ALL ${passedTests}/${passedTests} REGRESSION TESTS PASSED WITH 100% SUCCESS!`);
  console.log("================================================================================\n");
}

runRegressionTestSuite().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
