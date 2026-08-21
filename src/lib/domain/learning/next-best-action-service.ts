import { NextBestAction, Roadmap } from "../../contracts";

export class NextBestActionService {
  /**
   * Evaluates and selects the single most impactful immediate action for the learner.
   */
  public selectNextBestAction(roadmap: Roadmap): NextBestAction {
    const activeMilestone =
      roadmap.milestones.find((m) => m.status === "in_progress") || roadmap.milestones[0];

    if (!activeMilestone) {
      return {
        id: "nba_default",
        type: "clarification",
        title: "Review Career Profile & Path Selection",
        description: "Verify your profile facts and explore path options.",
        estimatedMinutes: 10,
        expectedGapReduction: 0.1,
        priorityScore: 1.0,
        whyNow: "No active milestone found; establish initial goal.",
      };
    }

    // 1. If active milestone requires diagnostic assessment
    if (activeMilestone.isDiagnosticRequired) {
      return {
        id: `nba_diag_${activeMilestone.id}`,
        type: "assessment",
        title: `Take 5-min Diagnostic: Verify Prior Knowledge`,
        description: `Verify claimed prerequisite knowledge for ${activeMilestone.title} to skip unnecessary lessons.`,
        milestoneId: activeMilestone.id,
        estimatedMinutes: 15,
        expectedGapReduction: 0.8,
        priorityScore: 9.5,
        whyNow: "High prerequisite leverage: passing this diagnostic allows skipping foundational modules directly.",
      };
    }

    // 2. Core learning resource action
    const topResource = activeMilestone.resources[0];
    if (topResource) {
      return {
        id: `nba_res_${topResource.id}`,
        type: "lesson",
        title: `Start: ${topResource.title}`,
        description: `Complete the curated guide by ${topResource.provider} (${topResource.durationHours}h estimated).`,
        milestoneId: activeMilestone.id,
        resourceId: topResource.id,
        skillId: activeMilestone.skillIds[0],
        estimatedMinutes: Math.min(60, topResource.durationHours * 60),
        expectedGapReduction: 0.6,
        priorityScore: 8.8,
        whyNow: `Directly bridges key competency requirement for ${activeMilestone.title}.`,
      };
    }

    // 3. Project task action
    if (activeMilestone.project) {
      return {
        id: `nba_proj_${activeMilestone.project.id}`,
        type: "project_task",
        title: `Hands-on Project: ${activeMilestone.project.title}`,
        description: activeMilestone.project.deliverables[0] || "Begin practical project implementation.",
        milestoneId: activeMilestone.id,
        estimatedMinutes: 90,
        expectedGapReduction: 0.9,
        priorityScore: 8.5,
        whyNow: "Produces concrete verified code evidence for your portfolio.",
      };
    }

    return {
      id: `nba_milestone_${activeMilestone.id}`,
      type: "lesson",
      title: `Progress on ${activeMilestone.title}`,
      description: activeMilestone.description,
      milestoneId: activeMilestone.id,
      estimatedMinutes: 45,
      expectedGapReduction: 0.5,
      priorityScore: 7.0,
      whyNow: "Active milestone in progress.",
    };
  }
}
