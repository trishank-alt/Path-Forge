import { LearningOrchestrator } from "../src/lib/application/orchestrator";

async function verifyDevOpsRoadmap() {
  console.log("==================================================");
  console.log("Verifying DevOps Roadmap Milestones & Projects...");
  console.log("==================================================\n");

  const orchestrator = new LearningOrchestrator();
  await orchestrator.resetState("test_devops_learner");

  // Step 1: Send DevOps goal
  const r1 = await orchestrator.handleIntake(
    {
      message:
        "I want to become a DevOps & Cloud Platform Infrastructure Engineer. I have experience with Linux and Python.",
      modelProvider: "deterministic",
    },
    "test_devops_learner"
  );

  console.log("Step 1 Intake Result:");
  console.log("- Status:", r1.confidence.status);
  console.log("- Top Path:", r1.profile.intent.hypotheses[0]?.pathTitle);

  // Step 2: Answer remaining dimensions
  const r2 = await orchestrator.answerQuestion(
    "architecture_preference",
    "Container Orchestration & Cloud Infrastructure as Code",
    "test_devops_learner"
  );

  const r3 = await orchestrator.answerQuestion(
    "hours_per_week",
    "10 hours/week",
    "test_devops_learner"
  );

  console.log("\nFinal DevOps State:");
  console.log("- Status:", r3.confidence.status);
  console.log("- Selected Path ID:", r3.profile.selectedPathId);
  console.log("- Roadmap Target Title:", r3.roadmap?.targetPathTitle);

  if (!r3.roadmap) {
    throw new Error("Roadmap was not generated!");
  }

  console.log("\nGenerated Milestones:");
  for (const m of r3.roadmap.milestones) {
    console.log(`\n[${m.title}]`);
    console.log(`- Description: ${m.description}`);
    console.log(`- Project Title: ${m.project?.title}`);
    console.log(`- Project Domain Context: ${m.project?.domainContext}`);
    console.log(`- Curated Resources:`);
    for (const res of m.resources) {
      console.log(`  * ${res.title} (${res.provider})`);
    }
  }

  // Assertions
  const hasDevOpsMilestone = r3.roadmap.milestones.some((m) =>
    m.title.toLowerCase().includes("linux") || m.title.toLowerCase().includes("ci/cd") || m.title.toLowerCase().includes("cloud")
  );
  const hasDevOpsProject = r3.roadmap.milestones.some((m) =>
    m.project?.title.toLowerCase().includes("ci/cd") || m.project?.title.toLowerCase().includes("infrastructure")
  );
  const hasNoJavaMilestoneInDevops = !r3.roadmap.milestones.some((m) =>
    m.title.toLowerCase().includes("java") || m.project?.title.toLowerCase().includes("spring boot inventory")
  );

  if (hasDevOpsMilestone && hasDevOpsProject && hasNoJavaMilestoneInDevops) {
    console.log("\n[PASS] DevOps Roadmap is 100% verified and free of Java artifacts!");
  } else {
    throw new Error("DevOps verification failed: Roadmap contained unexpected artifacts.");
  }
}

verifyDevOpsRoadmap().catch((err) => {
  console.error("DevOps roadmap verification failed:", err);
  process.exit(1);
});
