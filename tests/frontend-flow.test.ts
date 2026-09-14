import { orchestrator } from "../src/lib/application/orchestrator";

async function runTest() {
  console.log("==================================================");
  console.log("Testing Frontend / Web Intake & Question Flow...");
  console.log("==================================================");

  // 1. Initial intake message requesting frontend development
  const step1 = await orchestrator.handleIntake({
    message: "I want to become a frontend developer and build modern interactive web applications."
  }, "test_frontend_user_1");

  console.log("\nStep 1 (Intake):");
  console.log("- Status:", step1.confidence.status);
  console.log("- Top Path:", step1.profile.intent.hypotheses[0]?.pathTitle);
  console.log("- Posterior Probability:", `${((step1.profile.intent.hypotheses[0]?.posteriorProbability || 0) * 100).toFixed(1)}%`);
  console.log("- Extracted Facts Count:", step1.profile.facts.length);
  console.log("- First Question:", step1.activeQuestion?.selectedQuestion.question);

  if (step1.profile.intent.hypotheses[0]?.pathId !== "fullstack_software_engineer") {
    throw new Error(`Expected top path to be fullstack_software_engineer, got: ${step1.profile.intent.hypotheses[0]?.pathId}`);
  }

  // 2. Answer question 1: primary_language
  const step2 = await orchestrator.answerQuestion(
    "primary_language",
    "TypeScript / JavaScript (React, Next.js, Node.js)",
    "test_frontend_user_1"
  );
  console.log("\nStep 2 (Answered primary_language):");
  console.log("- Status:", step2.confidence.status);
  console.log("- Top Path:", step2.profile.intent.hypotheses[0]?.pathTitle);
  console.log("- Next Question Dimension:", step2.activeQuestion?.selectedQuestion?.dimension);

  // 3. Answer question 2: architecture_preference
  const step3 = await orchestrator.answerQuestion(
    "architecture_preference",
    "Full-Stack Component Systems & Modern Web SPAs",
    "test_frontend_user_1"
  );
  console.log("\nStep 3 (Answered architecture_preference):");
  console.log("- Status:", step3.confidence.status);
  console.log("- Next Question Dimension:", step3.activeQuestion?.selectedQuestion?.dimension);

  // 4. Answer question 3: hours_per_week
  const step4 = await orchestrator.answerQuestion(
    "hours_per_week",
    "10-12 hours/week",
    "test_frontend_user_1"
  );
  console.log("\nStep 4 (Answered hours_per_week -> System Evaluation & Roadmap):");
  console.log("- Status:", step4.confidence.status);
  console.log("- Declared Role:", step4.profile.declaredTargetRole);
  console.log("- Roadmap Generated:", Boolean(step4.roadmap));

  if (!step4.roadmap) {
    throw new Error("Roadmap was not generated upon reaching ready status!");
  }

  console.log(`- Roadmap Target: "${step4.roadmap.targetPathTitle}"`);
  console.log(`- Total Estimated Hours: ${step4.roadmap.totalEstimatedHours}h (${step4.roadmap.totalEstimatedWeeks} weeks)`);
  console.log(`- Milestones Count: ${step4.roadmap.milestones.length}`);
  step4.roadmap.milestones.forEach((m, idx) => {
    console.log(`  Phase ${idx + 1}: ${m.title}`);
    console.log(`    Project: ${m.project?.title}`);
    console.log(`    Resources: ${m.resources.map((r) => r.title).join(", ")}`);
  });
  console.log(`- Next Best Action: "${step4.roadmap.nextBestAction?.title}"`);

  console.log("\n==================================================");
  console.log("FRONTEND INTAKE & ROADMAP FLOW VERIFIED! (PASS)");
  console.log("==================================================");
}

runTest().catch((err) => {
  console.error("Test Failed:", err);
  process.exit(1);
});
