import { LearningOrchestrator } from "../src/lib/application/orchestrator";
import { CurriculumProposal, ProfileFact } from "../src/lib/contracts";
import {
  catalogPathToCurriculum,
  proposalToCurriculum,
} from "../src/lib/domain/learning/curriculum-model";
import {
  CurriculumVerifier,
  curriculumVerifier,
} from "../src/lib/domain/learning/curriculum-verifier";
import {
  SEEDED_EDGES,
  SEEDED_PATHS,
  SEEDED_PROJECTS,
  SEEDED_RESOURCES,
  SEEDED_SKILLS,
} from "../src/lib/persistence/seed-data";

async function runGeneralRoadmapEngineTestSuite() {
  console.log("================================================================================");
  console.log("RUNNING GENERAL ROADMAP ENGINE ARCHITECTURAL VERIFICATION SUITE");
  console.log("================================================================================");

  let passedTests = 0;
  const initialPathsCount = SEEDED_PATHS.length;
  const initialSkillsCount = SEEDED_SKILLS.length;
  const initialEdgesCount = SEEDED_EDGES.length;
  const initialResourcesCount = SEEDED_RESOURCES.length;
  const initialProjectsCount = SEEDED_PROJECTS.length;

  // ----------------------------------------------------------------------
  // SCENARIO 1: Pre-seeded Catalog Path Match (TypeScript Backend)
  // ----------------------------------------------------------------------
  console.log("\nScenario 1: Pre-seeded Catalog Path Match (TypeScript Backend)...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("scen1_ts_catalog");

    await orch.handleIntake(
      {
        message: "I want to be a TypeScript and Node.js backend developer building SaaS APIs with Fastify and PostgreSQL.",
        modelProvider: "deterministic",
      },
      "scen1_ts_catalog"
    );
    await orch.answerQuestion("architecture_preference", "Microservices & REST APIs", "scen1_ts_catalog");
    const res = await orch.answerQuestion("hours_per_week", "15 hours/week", "scen1_ts_catalog");

    if (res.decision.eligibility !== "eligible") {
      throw new Error(`FAIL Scenario 1: Expected eligible, got ${res.decision.eligibility}`);
    }
    if (res.decision.curriculumSource !== "catalog") {
      throw new Error(`FAIL Scenario 1: Expected curriculumSource='catalog', got ${res.decision.curriculumSource}`);
    }
    if (res.decision.selectedPathId !== "backend_web_product_node") {
      throw new Error(`FAIL Scenario 1: Expected selectedPathId='backend_web_product_node', got ${res.decision.selectedPathId}`);
    }
    if (res.decision.curriculumId !== "catalog:backend_web_product_node") {
      throw new Error(`FAIL Scenario 1: Expected curriculumId='catalog:backend_web_product_node', got ${res.decision.curriculumId}`);
    }
    if (!res.roadmap) {
      throw new Error("FAIL Scenario 1: Roadmap was not generated!");
    }
    if (res.roadmap.targetPathId !== "backend_web_product_node") {
      throw new Error(`FAIL Scenario 1: Expected roadmap.targetPathId='backend_web_product_node', got ${res.roadmap.targetPathId}`);
    }
    if (res.roadmap.curriculumSource !== "catalog") {
      throw new Error(`FAIL Scenario 1: Expected roadmap.curriculumSource='catalog', got ${res.roadmap.curriculumSource}`);
    }

    console.log("  [PASS] Catalog match accurately produced catalog-scoped decision and roadmap.");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // SCENARIO 2: Pre-seeded Catalog Path Match (Enterprise Java Backend)
  // ----------------------------------------------------------------------
  console.log("\nScenario 2: Pre-seeded Catalog Path Match (Enterprise Java Backend)...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("scen2_java_catalog");

    await orch.handleIntake(
      {
        message: "I want to be an Enterprise Java Developer building ERP backend systems using Spring Boot and relational SQL databases.",
        modelProvider: "deterministic",
      },
      "scen2_java_catalog"
    );
    await orch.answerQuestion("architecture_preference", "Modular Monolith", "scen2_java_catalog");
    const res = await orch.answerQuestion("hours_per_week", "20 hours/week", "scen2_java_catalog");

    if (res.decision.eligibility !== "eligible") {
      throw new Error(`FAIL Scenario 2: Expected eligible, got ${res.decision.eligibility}`);
    }
    if (res.decision.selectedPathId !== "backend_enterprise_java") {
      throw new Error(`FAIL Scenario 2: Expected selectedPathId='backend_enterprise_java', got ${res.decision.selectedPathId}`);
    }
    if (res.decision.curriculumSource !== "catalog") {
      throw new Error(`FAIL Scenario 2: Expected curriculumSource='catalog', got ${res.decision.curriculumSource}`);
    }

    console.log("  [PASS] Enterprise Java catalog path matched with zero ambiguity.");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // SCENARIO 3: Material Uncertainty (Vague Goal)
  // ----------------------------------------------------------------------
  console.log("\nScenario 3: Material Uncertainty (Vague Goal Triggering Active Question)...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("scen3_uncertainty");

    const res = await orch.handleIntake(
      {
        message: "I want to build backend software and APIs.",
        modelProvider: "deterministic",
      },
      "scen3_uncertainty"
    );

    if (res.decision.eligibility !== "material_uncertainty") {
      throw new Error(`FAIL Scenario 3: Expected material_uncertainty, got ${res.decision.eligibility}`);
    }
    if (res.decision.selectedPathId !== null) {
      throw new Error(`FAIL Scenario 3: selectedPathId must be null for material_uncertainty, got ${res.decision.selectedPathId}`);
    }
    if (res.roadmap !== null) {
      throw new Error("FAIL Scenario 3: roadmap must be null during material_uncertainty!");
    }
    if (res.decision.activeQuestion === null) {
      throw new Error("FAIL Scenario 3: activeQuestion MUST be present for material_uncertainty!");
    }

    console.log(`  Clarification Question: "${res.decision.activeQuestion.selectedQuestion.question}" (Dimension: ${res.decision.activeQuestion.selectedQuestion.dimension})`);
    console.log("  [PASS] Ambiguous goal correctly halted at material_uncertainty with targeted question.");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // SCENARIO 4: Constructed Curriculum (Mechanical Engineer Specializing in Robotics)
  // ----------------------------------------------------------------------
  console.log("\nScenario 4: Constructed Curriculum (Mechanical Engineer Specializing in Robotics)...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("scen4_robotics");

    const intakeRes = await orch.handleIntake(
      {
        message: "I am a mechanical engineer transitioning to autonomous robotics and control systems using ROS 2, C++, and kinematics.",
        modelProvider: "deterministic",
      },
      "scen4_robotics"
    );

    console.log("  Intake Eligibility:", intakeRes.decision.eligibility);
    console.log("  Intake Curriculum ID:", intakeRes.decision.curriculumId);
    console.log("  Intake Curriculum Source:", intakeRes.decision.curriculumSource);
    console.log("  Intake Selected Path ID:", intakeRes.decision.selectedPathId);

    // Answer workload constraints to make it fully feasible
    const res = await orch.answerQuestion("hours_per_week", "15 hours/week", "scen4_robotics");

    if (res.decision.eligibility !== "eligible") {
      throw new Error(`FAIL Scenario 4: Expected eligibility='eligible', got ${res.decision.eligibility} (${res.decision.explanation})`);
    }
    if (res.decision.curriculumSource !== "constructed") {
      throw new Error(`FAIL Scenario 4: Expected curriculumSource='constructed', got ${res.decision.curriculumSource}`);
    }
    if (res.decision.selectedPathId !== null) {
      throw new Error(`FAIL Scenario 4: selectedPathId must be strictly null for constructed curricula, got ${res.decision.selectedPathId}`);
    }
    if (!res.decision.curriculumId || !res.decision.curriculumId.startsWith("constructed:")) {
      throw new Error(`FAIL Scenario 4: Expected curriculumId starting with 'constructed:', got ${res.decision.curriculumId}`);
    }
    if (!res.roadmap) {
      throw new Error("FAIL Scenario 4: Roadmap was not generated for eligible constructed curriculum!");
    }
    if (res.roadmap.targetPathId !== null) {
      throw new Error(`FAIL Scenario 4: roadmap.targetPathId must be null for constructed curricula, got ${res.roadmap.targetPathId}`);
    }
    if (res.roadmap.curriculumSource !== "constructed") {
      throw new Error(`FAIL Scenario 4: roadmap.curriculumSource must be 'constructed', got ${res.roadmap.curriculumSource}`);
    }
    if (!res.roadmap.curriculumId || !res.roadmap.curriculumId.startsWith("constructed:")) {
      throw new Error(`FAIL Scenario 4: Expected roadmap.curriculumId starting with 'constructed:', got ${res.roadmap.curriculumId}`);
    }

    // Verify roadmap content is robotics-specific
    const allSkillIds = res.roadmap.milestones.flatMap((m) => m.skillIds);
    const hasRoboticsSkills = allSkillIds.some(
      (id) => id.includes("robotics") || id.includes("ros2") || id.includes("kinematics")
    );
    if (!hasRoboticsSkills) {
      throw new Error(`FAIL Scenario 4: Roadmap milestones lack robotics skills. Found: ${JSON.stringify(allSkillIds)}`);
    }

    // Verify resource provenance is synthetic_unverified_external
    const allResources = res.roadmap.milestones.flatMap((m) => m.resources);
    const hasSyntheticProvenance = allResources.every(
      (r) => r.provenance === "synthetic_unverified_external"
    );
    if (!hasSyntheticProvenance) {
      throw new Error("FAIL Scenario 4: Constructed resources must have provenance='synthetic_unverified_external'");
    }

    // Verify projects exist with deliverables
    const allProjects = res.roadmap.milestones.map((m) => m.project).filter(Boolean);
    if (allProjects.length === 0) {
      throw new Error("FAIL Scenario 4: No practical projects attached to constructed roadmap!");
    }

    // ZERO SEED DATA POLLUTION CHECK
    if (SEEDED_PATHS.length !== initialPathsCount) {
      throw new Error(`[CATALOG POLLUTION] SEEDED_PATHS mutated! Was ${initialPathsCount}, now ${SEEDED_PATHS.length}`);
    }
    if (SEEDED_SKILLS.length !== initialSkillsCount) {
      throw new Error(`[CATALOG POLLUTION] SEEDED_SKILLS mutated! Was ${initialSkillsCount}, now ${SEEDED_SKILLS.length}`);
    }
    if (SEEDED_EDGES.length !== initialEdgesCount) {
      throw new Error(`[CATALOG POLLUTION] SEEDED_EDGES mutated! Was ${initialEdgesCount}, now ${SEEDED_EDGES.length}`);
    }
    if (SEEDED_RESOURCES.length !== initialResourcesCount) {
      throw new Error(`[CATALOG POLLUTION] SEEDED_RESOURCES mutated! Was ${initialResourcesCount}, now ${SEEDED_RESOURCES.length}`);
    }
    if (SEEDED_PROJECTS.length !== initialProjectsCount) {
      throw new Error(`[CATALOG POLLUTION] SEEDED_PROJECTS mutated! Was ${initialProjectsCount}, now ${SEEDED_PROJECTS.length}`);
    }

    console.log(`  Generated Robotics Milestones: ${res.roadmap.milestones.length}`);
    console.log(`  Constructed Curriculum ID: ${res.roadmap.curriculumId}`);
    console.log("  Catalog Pool Invariant: 0 items added to global seed arrays (isolated scoped snapshot).");
    console.log("  [PASS] Controlled discovery constructed and verified robotics curriculum successfully.");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // SCENARIO 5: Unsupported Niche / Verifier Gate Failure
  // ----------------------------------------------------------------------
  console.log("\nScenario 5: Unsupported Niche (Model returns null proposal or gate fails)...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("scen5_unsupported");

    const res = await orch.handleIntake(
      {
        message: "I want to specialize in underwater marine archaeology sonar mapping algorithms.",
        modelProvider: "deterministic",
      },
      "scen5_unsupported"
    );

    if (res.decision.eligibility !== "unsupported_intent") {
      throw new Error(`FAIL Scenario 5: Expected unsupported_intent, got ${res.decision.eligibility}`);
    }
    if (res.decision.selectedPathId !== null) {
      throw new Error(`FAIL Scenario 5: selectedPathId must be null for unsupported_intent, got ${res.decision.selectedPathId}`);
    }
    if (res.decision.curriculumId !== null) {
      throw new Error(`FAIL Scenario 5: curriculumId must be null for unsupported_intent, got ${res.decision.curriculumId}`);
    }
    if (res.roadmap !== null) {
      throw new Error("FAIL Scenario 5: roadmap must be null for unsupported_intent!");
    }
    if (res.decision.activeQuestion !== null) {
      throw new Error("FAIL Scenario 5: activeQuestion must be null for unsupported_intent!");
    }
    if (!res.decision.declaredTargetRole) {
      throw new Error("FAIL Scenario 5: declaredTargetRole MUST be preserved on unsupported intent!");
    }

    console.log(`  Preserved Learner Objective: "${res.decision.declaredTargetRole}"`);
    console.log(`  Diagnostic Explanation: "${res.decision.explanation}"`);
    console.log("  [PASS] Unsupported niche safely produced unsupported_intent with null roadmap and preserved role.");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // SCENARIO 6: Infeasible Workload on Constructed Curriculum
  // ----------------------------------------------------------------------
  console.log("\nScenario 6: Infeasible Workload on Constructed Curriculum (1h/week in 1 month)...");
  {
    const orch = new LearningOrchestrator();
    await orch.resetState("scen6_infeasible_robotics");

    await orch.handleIntake(
      {
        message: "I am a mechanical engineer transitioning to robotics using ROS 2.",
        modelProvider: "deterministic",
      },
      "scen6_infeasible_robotics"
    );

    await orch.answerQuestion("deadline_months", "1 month", "scen6_infeasible_robotics");
    const res = await orch.answerQuestion("hours_per_week", "1 hour/week", "scen6_infeasible_robotics");

    if (res.decision.eligibility !== "infeasible") {
      throw new Error(`FAIL Scenario 6: Expected infeasible, got ${res.decision.eligibility}`);
    }
    if (res.roadmap !== null) {
      throw new Error("FAIL Scenario 6: Roadmap must be null for infeasible workload!");
    }
    if (res.decision.selectedPathId !== null) {
      throw new Error(`FAIL Scenario 6: selectedPathId must be null for constructed infeasible curriculum, got ${res.decision.selectedPathId}`);
    }
    if (!res.decision.curriculumId || !res.decision.curriculumId.startsWith("constructed:")) {
      throw new Error(`FAIL Scenario 6: Expected curriculumId starting with 'constructed:', got ${res.decision.curriculumId}`);
    }
    if (!res.decision.feasibility || res.decision.feasibility.status !== "infeasible") {
      throw new Error("FAIL Scenario 6: Feasibility status must be 'infeasible'!");
    }

    console.log(`  Infeasibility Ratio: ${(res.decision.feasibility.capacityRatio * 100).toFixed(1)}% (Available: ${res.decision.feasibility.availableHours}h vs Required: ${res.decision.feasibility.requiredHours}h)`);
    console.log(`  Advisory Alternatives: Suggested Deadline=${res.decision.feasibility.alternative?.suggestedDeadlineMonths}mo, Suggested Hours=${res.decision.feasibility.alternative?.suggestedHoursPerWeek}h/wk`);
    console.log("  [PASS] Constructed curriculum strictly obeyed feasibility boundaries.");
    passedTests++;
  }

  // ----------------------------------------------------------------------
  // SCENARIO 7: CurriculumVerifier 10 Hard Gates Unit Testing
  // ----------------------------------------------------------------------
  console.log("\nScenario 7: CurriculumVerifier Hard Validation Gates Unit Tests...");
  {
    const verifier = new CurriculumVerifier();

    const validProposal: CurriculumProposal = {
      targetRole: "Autonomous Drone Systems Engineer",
      domain: "Robotics & Aerial Systems",
      specialization: "UAV Flight Control & Autonomous Navigation",
      description: "Comprehensive curriculum for UAV flight control systems and computer vision navigation.",
      targetSkillWeights: {
        uav_aerodynamics_basics: 0.25,
        uav_flight_controller_firmware: 0.25,
        uav_autonomous_path_planning: 0.25,
        uav_fleet_telemetry_cloud: 0.25,
      },
      proposedSkills: [
        {
          id: "uav_aerodynamics_basics",
          title: "UAV Aerodynamics & Flight Physics",
          domain: "Robotics & Aerial Systems",
          level: 1,
          category: "Domain Knowledge",
          description: "Principles of multicopter and fixed-wing flight dynamics.",
          evidenceCriteria: ["Explain lift and thrust"],
          tags: ["drone", "uav", "aerodynamics"],
        },
        {
          id: "uav_flight_controller_firmware",
          title: "Flight Controller Firmware Architecture",
          domain: "Robotics & Aerial Systems",
          level: 2,
          category: "Embedded Systems",
          description: "PID loop tuning and sensor fusion filters.",
          evidenceCriteria: ["Implement PID loop"],
          tags: ["drone", "pid", "sensors"],
        },
        {
          id: "uav_autonomous_path_planning",
          title: "Autonomous 3D Path Planning & SLAM",
          domain: "Robotics & Aerial Systems",
          level: 3,
          category: "Autonomous Systems",
          description: "Occupancy grid mapping, A*, and Visual SLAM for indoor UAV navigation.",
          evidenceCriteria: ["Run V-SLAM algorithm"],
          tags: ["drone", "slam", "navigation"],
        },
        {
          id: "uav_fleet_telemetry_cloud",
          title: "UAV Fleet Telemetry & Mission Control Systems",
          domain: "Robotics & Aerial Systems",
          level: 4,
          category: "Cloud Infrastructure",
          description: "MAVLink messaging protocols, telemetry dashboards, and failsafe return-to-home.",
          evidenceCriteria: ["Design telemetry server"],
          tags: ["drone", "mavlink", "telemetry"],
        },
      ],
      proposedEdges: [
        {
          id: "e1",
          fromSkillId: "uav_aerodynamics_basics",
          toSkillId: "uav_flight_controller_firmware",
          type: "required",
          minimumLevel: "working",
          rationale: "Physics precedes firmware tuning",
        },
        {
          id: "e2",
          fromSkillId: "uav_flight_controller_firmware",
          toSkillId: "uav_autonomous_path_planning",
          type: "required",
          minimumLevel: "working",
          rationale: "Stabilization precedes autonomous navigation",
        },
        {
          id: "e3",
          fromSkillId: "uav_autonomous_path_planning",
          toSkillId: "uav_fleet_telemetry_cloud",
          type: "required",
          minimumLevel: "working",
          rationale: "Local autonomy precedes multi-drone fleet telemetry",
        },
      ],
      proposedResources: [
        {
          id: "r1",
          skillId: "uav_flight_controller_firmware",
          title: "PX4 Autopilot Software Architecture Guide",
          provider: "PX4 Open Source Autopilot",
          url: "https://docs.px4.io",
          format: "documentation",
          costType: "free",
          durationHours: 25,
          qualityScore: 0.9,
          description: "Official guide to PX4 architectural modules and PID controllers.",
        },
        {
          id: "r2",
          skillId: "uav_autonomous_path_planning",
          title: "Visual SLAM for Autonomous Aerial Robotics",
          provider: "Robotics Open Courseware",
          url: "https://rpg.ifi.uzh.ch",
          format: "interactive_course",
          costType: "free",
          durationHours: 35,
          qualityScore: 0.85,
          description: "Visual SLAM algorithms and trajectory optimization.",
        },
        {
          id: "r3",
          skillId: "uav_fleet_telemetry_cloud",
          title: "MAVLink Protocol & Ground Station Integration",
          provider: "Dronecode Foundation",
          url: "https://mavlink.io",
          format: "documentation",
          costType: "free",
          durationHours: 20,
          qualityScore: 0.88,
          description: "Micro Air Vehicle Communication Protocol.",
        },
      ],
      proposedProjects: [
        {
          id: "p1",
          title: "Simulated Autonomous UAV Search and Rescue Mission",
          description: "Build an autonomous ROS 2 flight mission in Gazebo simulator.",
          targetSkillIds: ["uav_flight_controller_firmware", "uav_autonomous_path_planning"],
          deliverables: [
            "Gazebo simulation world with obstacle obstacles",
            "ROS 2 path planner node implementing 3D A* trajectory",
            "Offboard flight control script commanding PX4 SITL drone",
          ],
          verificationChecklist: [
            "Drone successfully takes off and reaches 10m waypoint without crash",
            "V-SLAM node estimates local position with < 5% drift",
          ],
          estimatedHours: 40,
          domainContext: "Robotics & Aerial Systems Simulation",
        },
      ],
      estimatedLearningHours: 120,
      assumptions: ["Basic linear algebra and C++ proficiency"],
    };

    // Valid proposal test
    const validResult = verifier.verify(validProposal);
    if (!validResult.isValid) {
      throw new Error(`FAIL Scenario 7 (Valid): Expected valid, failed on: ${validResult.failedGates.join(", ")}`);
    }
    console.log("  [PASS] Valid drone proposal passed all 10 gates.");

    // Gate 4 Test: Dangling Edge Detection
    const danglingProposal = {
      ...validProposal,
      proposedEdges: [
        ...validProposal.proposedEdges,
        {
          id: "e_dangling",
          fromSkillId: "non_existent_skill",
          toSkillId: "uav_flight_controller_firmware",
          type: "required" as const,
          minimumLevel: "working" as const,
          rationale: "Invalid edge",
        },
      ],
    };
    const danglingResult = verifier.verify(danglingProposal);
    if (danglingResult.isValid || !danglingResult.failedGates.includes("Gate 4 (Edge Integrity)")) {
      throw new Error("FAIL Scenario 7 (Gate 4): Failed to catch dangling edge!");
    }
    console.log("  [PASS] Gate 4 correctly caught dangling prerequisite edge.");

    // Gate 5 Test: Cycle Detection
    const cyclicProposal = {
      ...validProposal,
      proposedEdges: [
        ...validProposal.proposedEdges,
        {
          id: "e_cycle",
          fromSkillId: "uav_fleet_telemetry_cloud",
          toSkillId: "uav_aerodynamics_basics",
          type: "required" as const,
          minimumLevel: "working" as const,
          rationale: "Introduces cycle",
        },
      ],
    };
    const cycleResult = verifier.verify(cyclicProposal);
    if (cycleResult.isValid || !cycleResult.failedGates.includes("Gate 5 (DAG Acyclicity)")) {
      throw new Error("FAIL Scenario 7 (Gate 5): Failed to catch cycle in skill graph!");
    }
    console.log("  [PASS] Gate 5 correctly caught cycle in DAG.");

    // Gate 6 Test: Prerequisite Level Inversion
    const invertedProposal = {
      ...validProposal,
      proposedEdges: [
        {
          id: "e_inv",
          fromSkillId: "uav_fleet_telemetry_cloud", // Level 4
          toSkillId: "uav_flight_controller_firmware", // Level 2
          type: "required" as const,
          minimumLevel: "working" as const,
          rationale: "Inverted edge",
        },
      ],
    };
    const invertedResult = verifier.verify(invertedProposal);
    if (invertedResult.isValid || !invertedResult.failedGates.includes("Gate 6 (Level Inversion)")) {
      throw new Error("FAIL Scenario 7 (Gate 6): Failed to catch level inversion!");
    }
    console.log("  [PASS] Gate 6 correctly caught prerequisite level inversion.");

    // Gate 9 Test: Workload Bounds
    const outOfBoundsProposal = {
      ...validProposal,
      estimatedLearningHours: 1500, // Exceeds 600h bound
    };
    const boundsResult = verifier.verify(outOfBoundsProposal);
    if (boundsResult.isValid || !boundsResult.failedGates.includes("Gate 9 (Workload Bounds)")) {
      throw new Error("FAIL Scenario 7 (Gate 9): Failed to catch out-of-bounds hours!");
    }
    console.log("  [PASS] Gate 9 correctly caught unrealistic workload bounds.");

    passedTests++;
  }

  // ----------------------------------------------------------------------
  // Summary
  // ----------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`ALL ${passedTests}/7 SCENARIOS IN GENERAL ROADMAP SUITE PASSED WITH 100% SUCCESS!`);
  console.log("================================================================================");
}

runGeneralRoadmapEngineTestSuite().catch((err) => {
  console.error("\nTEST SUITE FAILED:", err);
  process.exit(1);
});
