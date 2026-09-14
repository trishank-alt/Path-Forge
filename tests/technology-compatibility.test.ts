import { LearningOrchestrator } from "../src/lib/application/orchestrator";
import {
  resolveTechnologyEcosystem,
  resolveLearnerTechnologyContext,
  isFrontendTechnology,
  isSkillCompatible,
  isResourceCompatible,
  isProjectCompatible,
} from "../src/lib/domain/learning/technology-ecosystem";
import { SEEDED_PATHS, SEEDED_SKILLS, SEEDED_RESOURCES, SEEDED_PROJECTS } from "../src/lib/persistence/seed-data";

async function runTechnologyCompatibilityTests() {
  console.log("==================================================");
  console.log("Running Technology Ecosystem Compatibility Tests");
  console.log("==================================================\n");

  let passedTests = 0;
  const totalTests = 7;

  // ------------------------------------------------------------
  // Test 1: Unit resolver & multi-stack technology classification
  // ------------------------------------------------------------
  console.log("Test 1: Technology ecosystem resolver classification...");
  {
    if (resolveTechnologyEcosystem("typescript") !== "typescript_node") throw new Error("typescript must resolve to typescript_node");
    if (resolveTechnologyEcosystem("node.js") !== "typescript_node") throw new Error("node.js must resolve to typescript_node");
    if (resolveTechnologyEcosystem("java") !== "java_spring") throw new Error("java must resolve to java_spring");
    if (resolveTechnologyEcosystem("spring boot") !== "java_spring") throw new Error("spring boot must resolve to java_spring");
    if (resolveTechnologyEcosystem("python") !== "python_fastapi") throw new Error("python must resolve to python_fastapi");
    if (resolveTechnologyEcosystem("fastapi") !== "python_fastapi") throw new Error("fastapi must resolve to python_fastapi");
    if (resolveTechnologyEcosystem("c++") !== "cpp") throw new Error("c++ must resolve to cpp");
    if (resolveTechnologyEcosystem("rust") !== "agnostic") throw new Error("rust must not resolve to cpp");

    if (!isFrontendTechnology("react")) throw new Error("react must be identified as frontend");
    if (!isFrontendTechnology("next.js")) throw new Error("next.js must be identified as frontend");
    if (isFrontendTechnology("java")) throw new Error("java is not frontend");

    // Multi-stack: React frontend + Java backend
    const context = resolveLearnerTechnologyContext(
      {
        languages: ["React", "Java"],
        domains: ["enterprise"],
        learningModes: ["hands_on_projects"],
        resourceBudget: "free_only",
      },
      []
    );
    if (context.frontendTechnology?.toLowerCase() !== "react") throw new Error(`Expected frontend technology react, got ${context.frontendTechnology}`);
    if (context.backendEcosystem !== "java_spring") throw new Error(`Expected backend ecosystem java_spring, got ${context.backendEcosystem}`);

    console.log("  [PASS] Unit resolvers correctly classify single and multi-stack preferences.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // Test 2: TypeScript / JavaScript Learner + Enterprise Domain
  // ------------------------------------------------------------
  console.log("\nTest 2: Explicit TypeScript/JavaScript + Enterprise domain generates Node/TS roadmap without Java...");
  {
    const orchestrator = new LearningOrchestrator();
    await orchestrator.resetState("test_ts_enterprise");

    const r1 = await orchestrator.handleIntake(
      {
        message: "I want to build enterprise software and backend APIs using TypeScript and Node.js.",
        modelProvider: "deterministic",
      },
      "test_ts_enterprise"
    );

    await orchestrator.answerQuestion("target_domain", "Enterprise Software", "test_ts_enterprise");
    await orchestrator.answerQuestion("architecture_preference", "Microservices & REST APIs", "test_ts_enterprise");
    const rFinal = await orchestrator.answerQuestion("hours_per_week", "10 hours/week", "test_ts_enterprise");

    if (!rFinal.roadmap) throw new Error("Roadmap was not generated for TS enterprise learner!");

    console.log(`- Selected Path ID: ${rFinal.profile.selectedPathId}`);
    console.log(`- Target Path Title: ${rFinal.roadmap.targetPathTitle}`);

    if (rFinal.profile.selectedPathId === "backend_enterprise_java") {
      throw new Error("FAIL: Explicit TypeScript learner was given backend_enterprise_java!");
    }

    // Verify roadmap contents
    for (const milestone of rFinal.roadmap.milestones) {
      console.log(`  * Milestone: ${milestone.title}`);
      if (milestone.title.toLowerCase().includes("java") || milestone.description.toLowerCase().includes("jvm") || milestone.description.toLowerCase().includes("spring boot")) {
        throw new Error(`FAIL: Milestone phase contains Java text: ${milestone.title}`);
      }

      // Check skill IDs
      for (const skillId of milestone.skillIds) {
        if (skillId.includes("java") || skillId.includes("spring")) {
          throw new Error(`FAIL: Incompatible Java skill found in TS roadmap: ${skillId}`);
        }
      }

      // Check resources
      for (const res of milestone.resources) {
        if (res.title.toLowerCase().includes("java") || res.title.toLowerCase().includes("spring boot") || res.title.toLowerCase().includes("jpa")) {
          throw new Error(`FAIL: Incompatible Java resource recommended to TS learner: ${res.title}`);
        }
      }

      // Check project
      if (milestone.project) {
        console.log(`    Project: ${milestone.project.title}`);
        if (milestone.project.title.toLowerCase().includes("spring boot") || milestone.project.id.includes("java")) {
          throw new Error(`FAIL: Incompatible Java project assigned to TS learner: ${milestone.project.title}`);
        }
      }
    }

    console.log("  [PASS] TypeScript enterprise learner received 100% Java-free roadmap.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // Test 3: Explicit Java Learner + Enterprise Domain
  // ------------------------------------------------------------
  console.log("\nTest 3: Explicit Java + Enterprise domain correctly generates Java/Spring Boot roadmap...");
  {
    const orchestrator = new LearningOrchestrator();
    await orchestrator.resetState("test_java_enterprise");

    await orchestrator.handleIntake(
      {
        message: "I want to be an Enterprise Java and Spring Boot architect for ERP systems.",
        modelProvider: "deterministic",
      },
      "test_java_enterprise"
    );

    await orchestrator.answerQuestion("architecture_preference", "Modular Monolith & Transactional Workflows", "test_java_enterprise");
    const rFinal = await orchestrator.answerQuestion("hours_per_week", "12 hours/week", "test_java_enterprise");

    if (!rFinal.roadmap) throw new Error("Roadmap was not generated for Java enterprise learner!");

    console.log(`- Selected Path ID: ${rFinal.profile.selectedPathId}`);
    if (rFinal.profile.selectedPathId !== "backend_enterprise_java") {
      throw new Error(`FAIL: Expected backend_enterprise_java, got ${rFinal.profile.selectedPathId}`);
    }

    const hasSpringBootSkill = rFinal.roadmap.milestones.some((m) => m.skillIds.includes("spring_boot_core"));
    if (!hasSpringBootSkill) throw new Error("FAIL: Java roadmap missing spring_boot_core skill!");

    console.log("  [PASS] Java enterprise learner received expected Spring Boot & Java architecture roadmap.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // Test 4: Explicit Python + Cloud Domain
  // ------------------------------------------------------------
  console.log("\nTest 4: Explicit Python + Cloud domain generates Python/FastAPI roadmap without Java...");
  {
    const orchestrator = new LearningOrchestrator();
    await orchestrator.resetState("test_python_cloud");

    await orchestrator.handleIntake(
      {
        message: "I want to build cloud data services and async APIs with Python and FastAPI.",
        modelProvider: "deterministic",
      },
      "test_python_cloud"
    );

    await orchestrator.answerQuestion("architecture_preference", "Microservices & Event Streams", "test_python_cloud");
    const rFinal = await orchestrator.answerQuestion("hours_per_week", "10 hours/week", "test_python_cloud");

    if (!rFinal.roadmap) throw new Error("Roadmap was not generated for Python learner!");

    console.log(`- Selected Path ID: ${rFinal.profile.selectedPathId}`);
    if (rFinal.profile.selectedPathId !== "backend_python_cloud") {
      throw new Error(`FAIL: Expected backend_python_cloud, got ${rFinal.profile.selectedPathId}`);
    }

    for (const milestone of rFinal.roadmap.milestones) {
      for (const skillId of milestone.skillIds) {
        if (skillId.includes("java") || skillId.includes("spring")) {
          throw new Error(`FAIL: Java skill in Python roadmap: ${skillId}`);
        }
      }
    }

    console.log("  [PASS] Python cloud learner received 100% Java-free Python/FastAPI roadmap.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // Test 5: Explicit C++ + Systems Domain
  // ------------------------------------------------------------
  console.log("\nTest 5: Explicit C++ + Systems domain generates C++ Systems roadmap without Java...");
  {
    const orchestrator = new LearningOrchestrator();
    await orchestrator.resetState("test_cpp_systems");

    await orchestrator.handleIntake(
      {
        message: "I want to master high-performance systems engineering with modern C++.",
        modelProvider: "deterministic",
      },
      "test_cpp_systems"
    );

    await orchestrator.answerQuestion("architecture_preference", "Low-level Systems & Concurrency", "test_cpp_systems");
    const rFinal = await orchestrator.answerQuestion("hours_per_week", "15 hours/week", "test_cpp_systems");

    if (!rFinal.roadmap) throw new Error("Roadmap was not generated for C++ learner!");

    console.log(`- Selected Path ID: ${rFinal.profile.selectedPathId}`);
    if (rFinal.profile.selectedPathId !== "systems_cpp_engineer") {
      throw new Error(`FAIL: Expected systems_cpp_engineer, got ${rFinal.profile.selectedPathId}`);
    }

    const hasCppSkill = rFinal.roadmap.milestones.some((m) => m.skillIds.includes("cpp_core_memory_management"));
    if (!hasCppSkill) throw new Error("FAIL: C++ roadmap missing cpp_core_memory_management!");

    console.log("  [PASS] C++ systems learner received expected C++ roadmap.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // Test 6: React Frontend + Java Backend (Multi-Stack)
  // ------------------------------------------------------------
  console.log("\nTest 6: Multi-stack (React Frontend + Java Backend) does not force Node.js...");
  {
    const orchestrator = new LearningOrchestrator();
    await orchestrator.resetState("test_multistack");

    await orchestrator.handleIntake(
      {
        message: "I want to build full stack web apps with React frontend and Java Spring Boot backend.",
        modelProvider: "deterministic",
      },
      "test_multistack"
    );

    await orchestrator.answerQuestion("architecture_preference", "Client-Server Full Stack", "test_multistack");
    const rFinal = await orchestrator.answerQuestion("hours_per_week", "10 hours/week", "test_multistack");

    if (!rFinal.roadmap) throw new Error("Roadmap was not generated for multi-stack learner!");

    console.log(`- Selected Path ID: ${rFinal.profile.selectedPathId}`);
    console.log(`- Roadmap Title: ${rFinal.roadmap.targetPathTitle}`);

    // Verify backend is Java/Spring and not forced to Node
    const hasJavaSkills = rFinal.roadmap.milestones.some((m) =>
      m.skillIds.some((s) => s.includes("java") || s.includes("spring"))
    );
    const hasNodeSkills = rFinal.roadmap.milestones.some((m) =>
      m.skillIds.some((s) => s.includes("nodejs") || s.includes("fastify"))
    );

    if (hasNodeSkills) {
      throw new Error("FAIL: Multi-stack React + Java learner was incorrectly assigned Node.js backend skills!");
    }

    console.log("  [PASS] Multi-stack React + Java respected backend Java preference without forcing Node.");
    passedTests++;
  }

  // ------------------------------------------------------------
  // Test 7: Fact Correction from TypeScript to Java
  // ------------------------------------------------------------
  console.log("\nTest 7: Fact correction from TypeScript to Java re-plans roadmap cleanly...");
  {
    const orchestrator = new LearningOrchestrator();
    await orchestrator.resetState("test_correction_flow");

    // 1. Initial intake with TypeScript
    await orchestrator.handleIntake(
      {
        message: "I am learning backend development with TypeScript.",
        modelProvider: "deterministic",
      },
      "test_correction_flow"
    );
    await orchestrator.answerQuestion("target_domain", "Enterprise", "test_correction_flow");
    await orchestrator.answerQuestion("architecture_preference", "REST APIs", "test_correction_flow");
    const r1 = await orchestrator.answerQuestion("hours_per_week", "10 hours/week", "test_correction_flow");

    console.log(`  Initial Path: ${r1.profile.selectedPathId}`);
    if (r1.profile.selectedPathId === "backend_enterprise_java") {
      throw new Error("FAIL: Initial TS profile had Java path!");
    }

    // 2. Find primary_language fact and correct it to Java
    const langFact = r1.profile.facts.find((f) => f.dimension === "primary_language");
    if (!langFact) throw new Error("primary_language fact not found");

    const corrected = await orchestrator.correctFact(
      langFact.id,
      { newValue: "Java", reason: "Switched career focus to Enterprise Java" },
      "test_correction_flow"
    );

    if (!corrected.roadmapStale) throw new Error("Roadmap should be marked stale after language change");

    // 3. Re-evaluate / generate roadmap
    const r2 = await orchestrator.generateRoadmap("test_correction_flow");
    console.log(`  Corrected Path: ${r2.targetPathId}`);

    if (r2.targetPathId !== "backend_enterprise_java") {
      throw new Error(`FAIL: Expected backend_enterprise_java after correction, got ${r2.targetPathId}`);
    }

    console.log("  [PASS] Fact correction dynamically updated roadmap and invalidated stale recommendations.");
    passedTests++;
  }

  console.log("\n==================================================");
  console.log(`ALL ${passedTests}/${totalTests} TECHNOLOGY COMPATIBILITY TESTS PASSED!`);
  console.log("==================================================");
}

runTechnologyCompatibilityTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
