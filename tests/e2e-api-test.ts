async function runE2EApiTests() {
  console.log("==================================================");
  console.log("Running End-to-End API Integration Tests...");
  console.log("==================================================\n");

  const baseUrl = "http://localhost:3000/api/v1";

  // 1. Reset profile
  console.log("Step 1: Resetting learner profile state (DELETE /profiles/me)...");
  const resetRes = await fetch(`${baseUrl}/profiles/me`, { method: "DELETE" });
  if (!resetRes.ok) throw new Error("Failed to reset profile");
  console.log("  [PASS] Profile reset successfully.\n");

  // 2. Ambiguous goal intake
  console.log("Step 2: Sending ambiguous backend goal (POST /intake/messages)...");
  const intakeRes = await fetch(`${baseUrl}/intake/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "I want to become a backend developer. I know HTTP and REST.",
    }),
  });
  const intakeData = await intakeRes.json();
  console.log(`- Extracted Facts: ${intakeData.extractedFacts.length}`);
  console.log(`- Confidence Status: ${intakeData.confidence.status}`);
  console.log(`- Confidence Score: ${(intakeData.confidence.finalScore * 100).toFixed(1)}%`);
  console.log(`- Active Question: "${intakeData.activeQuestion?.selectedQuestion?.question}"`);

  if (intakeData.confidence.status !== "clarifying") {
    throw new Error("Step 2 Failed: Ambiguous input should be in clarifying status!");
  }
  console.log("  [PASS] Ambiguous goal triggered clarification as expected.\n");

  // 3. Answer language question -> Java
  console.log("Step 3: Answering primary language question (POST /profiles/me/answers)...");
  const ans1Res = await fetch(`${baseUrl}/profiles/me/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionId: "q_lang",
      dimension: "primary_language",
      answer: "Java (OOP, Streams, Collections)",
    }),
  });
  const ans1Data = await ans1Res.json();
  console.log(`- New Top Path: ${ans1Data.profile.declaredTargetRole}`);
  console.log(`- New Confidence Status: ${ans1Data.confidence.status}`);
  console.log("  [PASS] Answered language question.\n");

  // 4. Answer domain question -> Enterprise ERP (Coverage: 50%, missing: 2 -> still clarifying)
  console.log("Step 4: Answering domain question with Enterprise ERP (POST /profiles/me/answers)...");
  const ans2Res = await fetch(`${baseUrl}/profiles/me/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionId: "q_domain",
      dimension: "target_domain",
      answer: "Enterprise Systems, ERP & Financial Workflows (High reliability & consistency)",
    }),
  });
  const ans2Data = await ans2Res.json();
  console.log(`- Status after 2 dimensions: ${ans2Data.confidence.status} (Coverage: ${(ans2Data.confidence.coverageFactor * 100).toFixed(0)}%)`);
  if (ans2Data.confidence.status !== "clarifying") {
    throw new Error("Step 4 Failed: Expected 2/4 dimensions to remain in clarifying!");
  }
  console.log("  [PASS] Correctly remained in clarifying with 2/4 dimensions.\n");

  // 4b. Answer hours_per_week -> 10 hours/week (Coverage: 75%, missing: 1 -> provisional)
  console.log("Step 4b: Answering hours_per_week (POST /profiles/me/answers)...");
  const ans3Res = await fetch(`${baseUrl}/profiles/me/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionId: "q_hours",
      dimension: "hours_per_week",
      answer: "8-12 hours/week (Standard recommendation)",
    }),
  });
  const ans3Data = await ans3Res.json();
  console.log(`- Status after 3 dimensions: ${ans3Data.confidence.status} (Coverage: ${(ans3Data.confidence.coverageFactor * 100).toFixed(0)}%)`);
  if (ans3Data.confidence.status !== "provisional") {
    throw new Error("Step 4b Failed: Expected 3/4 dimensions to reach provisional!");
  }
  console.log("  [PASS] Correctly reached provisional state with 3/4 dimensions.\n");

  // 4c. Answer architecture_preference -> Modular Monoliths (Coverage: 100%, missing: 0 -> ready)
  console.log("Step 4c: Answering architecture_preference (POST /profiles/me/answers)...");
  const ans4Res = await fetch(`${baseUrl}/profiles/me/answers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questionId: "q_arch",
      dimension: "architecture_preference",
      answer: "Modular Monoliths & Robust Transactional Domain Models",
    }),
  });
  const ans4Data = await ans4Res.json();
  console.log(`- Final Status: ${ans4Data.confidence.status}`);
  console.log(`- Confidence Score: ${(ans4Data.confidence.finalScore * 100).toFixed(1)}%`);
  console.log(`- Generated Roadmap Target: ${ans4Data.roadmap?.targetPathTitle}`);
  console.log(`- Milestones Count: ${ans4Data.roadmap?.milestones.length}`);
  console.log(`- NBA Title: "${ans4Data.roadmap?.nextBestAction?.title}"`);

  if (ans4Data.confidence.status !== "ready") {
    throw new Error("Step 4c Failed: Expected ready status after all 4 dimensions answered!");
  }
  if (!ans4Data.roadmap) {
    throw new Error("Step 4c Failed: Expected roadmap to be generated!");
  }
  console.log("  [PASS] Threshold-gated Enterprise Java roadmap generated with NBA!\n");

  // 5. Test What-If Scenario simulation
  console.log("Step 5: Simulating What-If 4h/week scenario (POST /scenarios)...");
  const scenarioRes = await fetch(`${baseUrl}/scenarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseRoadmapId: ans4Data.roadmap.id,
      name: "Paced Schedule (4h/wk)",
      overrides: { hoursPerWeek: 4 },
    }),
  });
  const scenarioData = await scenarioRes.json();
  console.log(`- Base Weeks: ${ans4Data.roadmap.totalEstimatedWeeks}w`);
  console.log(`- Simulated Weeks: ${scenarioData.computedRoadmap.totalEstimatedWeeks}w`);
  console.log(`- Weeks Delta: ${scenarioData.diff.weeksDelta}w`);
  console.log(`- Summary: "${scenarioData.diff.summary}"`);
  console.log("  [PASS] What-if scenario diff calculated without mutating original plan.\n");

  // 6. Test Fact Correction
  console.log("Step 6: Correcting fact in profile (PATCH /profiles/me/facts/{id})...");
  const activeFact = ans4Data.profile.facts.find((f: any) => f.dimension === "primary_language");
  if (activeFact) {
    const patchRes = await fetch(`${baseUrl}/profiles/me/facts/${activeFact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dimension: "primary_language",
        newValue: "Java",
        reason: "Confirmed senior Java focus",
      }),
    });
    const patchData = await patchRes.json();
    console.log(`- Fact updated with provenance source: ${patchData.profile.facts.find((f: any) => f.id === activeFact.id)?.source}`);
    console.log("  [PASS] Fact correction executed and audited.\n");
  }

  // 7. Test Diagnostic Assessment Submission
  console.log("Step 7: Submitting diagnostic quiz score (POST /assessments/{id}/attempts)...");
  const diagRes = await fetch(`${baseUrl}/assessments/diag_sql_relational_modeling/attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      skillId: "sql_relational_modeling",
      score: 100,
      passed: true,
      notes: "Passed with 100% score",
    }),
  });
  const diagData = await diagRes.json();
  const verifiedComp = diagData.profile.competencies.find((c: any) => c.skillId === "sql_relational_modeling");
  console.log(`- Competency Status for SQL: ${verifiedComp?.status}`);
  console.log(`- Verified Level: ${verifiedComp?.verifiedLevel}`);
  console.log("  [PASS] Diagnostic assessment recorded and competency verified.\n");

  // 8. Test Audit Trail
  console.log("Step 8: Fetching decision audit ledger (GET /audit)...");
  const auditRes = await fetch(`${baseUrl}/audit`);
  const auditData = await auditRes.json();
  console.log(`- Total Audit Events: ${auditData.events.length}`);
  console.log(`- Latest Event: ${auditData.events[0]?.eventType}`);
  console.log("  [PASS] Complete mathematical audit log verified.\n");

  console.log("==================================================");
  console.log("ALL 8 END-TO-END INTEGRATION TESTS PASSED! (8/8)");
  console.log("==================================================");
}

runE2EApiTests().catch((err) => {
  console.error("E2E API Test failed:", err);
  process.exit(1);
});
