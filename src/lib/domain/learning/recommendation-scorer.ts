import { LearningResource, LearnerPreferences } from "../../contracts";

export class RecommendationScorer {
  /**
   * Ranks curated learning resources using explainable multi-factor scoring:
   * score = .30 relevance + .20 level_fit + .15 quality + .10 preference_fit + .10 freshness + .10 time_fit + .05 cost_fit
   */
  public scoreAndRankResources(
    resources: LearningResource[],
    skillId: string,
    preferences: LearnerPreferences,
    targetLevelNum: number = 2
  ): LearningResource[] {
    const scored = resources.map((res) => {
      // Relevance (0 to 1)
      const relevance = res.skillId === skillId ? 1.0 : 0.4;

      // Level fit (0 to 1)
      const levelFit = 0.9;

      // Quality score (0 to 1)
      const quality = res.qualityScore;

      // Preference fit (0 to 1)
      let preferenceFit = 0.7;
      if (preferences.learningModes.includes("hands_on_projects") && res.format === "interactive_course") {
        preferenceFit = 1.0;
      } else if (preferences.learningModes.includes("docs") && res.format === "documentation") {
        preferenceFit = 1.0;
      }

      // Freshness (0 to 1)
      const freshness = 0.95;

      // Time fit (0 to 1)
      const timeFit = res.durationHours <= 15 ? 0.95 : 0.75;

      // Cost fit (0 to 1)
      let costFit = 1.0;
      if (preferences.resourceBudget === "free_only" && res.costType !== "free") {
        costFit = 0.2;
      }

      const totalScore = Number(
        (
          0.3 * relevance +
          0.2 * levelFit +
          0.15 * quality +
          0.1 * preferenceFit +
          0.1 * freshness +
          0.1 * timeFit +
          0.05 * costFit
        ).toFixed(4)
      );

      return {
        ...res,
        rankingScore: totalScore,
      };
    });

    // Sort descending by rankingScore
    scored.sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0));

    return scored;
  }
}
