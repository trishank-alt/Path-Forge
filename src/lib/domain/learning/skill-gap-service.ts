import { CompetencyLevel, CompetencyRecord, SkillNode } from "../../contracts";
import { SkillGraph } from "./skill-graph";

export interface SkillGapAnalysisResult {
  skillId: string;
  skill: SkillNode;
  requiredLevel: CompetencyLevel;
  currentLevel: CompetencyLevel;
  gap: number; // numeric gap (0 to 4)
  priorityScore: number;
  isDiagnosticNeeded: boolean;
  status: "verified" | "claimed_unverified" | "gap_missing";
}

const LEVEL_NUMERIC: Record<CompetencyLevel, number> = {
  none: 0,
  novice: 1,
  working: 2,
  proficient: 3,
  advanced: 4,
};

export class SkillGapService {
  private skillGraph: SkillGraph;

  constructor(skillGraph: SkillGraph = new SkillGraph()) {
    this.skillGraph = skillGraph;
  }

  /**
   * Computes individual skill gaps and priorities.
   * gap(s) = required_level(s, target) - verified_or_estimated_level(s)
   * priority(s) = target_weight(s) × gap(s) × centrality(s) × urgency(deadline)
   */
  public analyzeGaps(
    targetSkillWeights: Record<string, number>,
    competencies: CompetencyRecord[],
    deadlineMonths: number = 6
  ): SkillGapAnalysisResult[] {
    const competencyMap = new Map<string, CompetencyRecord>();
    for (const comp of competencies) {
      competencyMap.set(comp.skillId, comp);
    }

    const allRelevantSkillIds = this.skillGraph.resolvePrerequisitesTopological(
      Object.keys(targetSkillWeights)
    );

    const results: SkillGapAnalysisResult[] = [];
    const urgency = Math.max(1.0, 12.0 / Math.max(1, deadlineMonths));

    for (const skillId of allRelevantSkillIds) {
      const skill = this.skillGraph.getSkill(skillId);
      if (!skill) continue;

      const targetWeight = targetSkillWeights[skillId] || 0.6; // baseline for prerequisite
      const record = competencyMap.get(skillId);

      const verifiedLevel = record ? record.verifiedLevel : "none";
      const claimedLevel = record ? record.claimedLevel : "none";
      const recordConfidence = record ? record.confidence : 0;

      const requiredLevel: CompetencyLevel = targetWeight >= 0.9 ? "proficient" : "working";
      const requiredNum = LEVEL_NUMERIC[requiredLevel];

      // Effective current level: verified counts fully; claimed counts only if confidence is high
      let effectiveNum = LEVEL_NUMERIC[verifiedLevel];
      if (effectiveNum === 0 && LEVEL_NUMERIC[claimedLevel] > 0) {
        if (recordConfidence >= 0.8) {
          effectiveNum = LEVEL_NUMERIC[claimedLevel];
        } else {
          // Discount unverified claim
          effectiveNum = Math.max(0, LEVEL_NUMERIC[claimedLevel] - 1);
        }
      }

      const numericGap = Math.max(0, requiredNum - effectiveNum);

      // Centrality: dependent count in graph
      const dependents = this.skillGraph.getDependents(skillId);
      const centrality = 1.0 + dependents.length * 0.25;

      const priorityScore = Number((targetWeight * numericGap * centrality * urgency).toFixed(4));

      // Diagnostic assessment is needed if user claimed knowledge but it's not verified
      const isClaimedUnverified =
        LEVEL_NUMERIC[claimedLevel] >= 2 && LEVEL_NUMERIC[verifiedLevel] < 2 && recordConfidence < 0.8;

      let status: "verified" | "claimed_unverified" | "gap_missing" = "gap_missing";
      if (numericGap === 0 && LEVEL_NUMERIC[verifiedLevel] >= requiredNum) {
        status = "verified";
      } else if (isClaimedUnverified) {
        status = "claimed_unverified";
      }

      results.push({
        skillId,
        skill,
        requiredLevel,
        currentLevel: LEVEL_NUMERIC[verifiedLevel] > 0 ? verifiedLevel : claimedLevel,
        gap: numericGap,
        priorityScore,
        isDiagnosticNeeded: isClaimedUnverified && centrality >= 1.5,
        status,
      });
    }

    return results;
  }
}
