import { CompetencyLevel, CompetencyRecord, SkillEdge, SkillNode, TechnologyEcosystem } from "../../contracts";
import { SkillGraph } from "./skill-graph";
import { isSkillCompatible } from "./technology-ecosystem";

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
   * Adapts target skill weights for adaptive paths (e.g. full-stack) based on the learner's chosen technology ecosystem.
   */
  public specializeTargetSkillWeights(
    pathId: string,
    baseWeights: Record<string, number>,
    ecosystem: TechnologyEcosystem = "agnostic"
  ): Record<string, number> {
    if (pathId === "fullstack_software_engineer") {
      const specialized = { ...baseWeights };
      if (ecosystem === "typescript_node") {
        specialized.nodejs_event_loop = 0.95;
        specialized.fastify_express = 0.9;
        specialized.prisma_drizzle_orm = 0.85;
      } else if (ecosystem === "java_spring") {
        specialized.java_core = 0.95;
        specialized.spring_boot_core = 0.95;
        specialized.spring_data_jpa = 0.85;
      } else if (ecosystem === "python_fastapi") {
        specialized.python_foundations = 0.95;
        specialized.fastapi_framework = 0.95;
        specialized.sqlalchemy_alembic = 0.85;
      }
      return specialized;
    }
    return baseWeights;
  }

  /**
   * Computes individual skill gaps and priorities with ecosystem compatibility isolation.
   * gap(s) = required_level(s, target) - verified_or_estimated_level(s)
   * priority(s) = target_weight(s) × gap(s) × centrality(s) × urgency(deadline)
   */
  public analyzeGaps(
    targetSkillWeights: Record<string, number>,
    competencies: CompetencyRecord[],
    deadlineMonths: number = 6,
    targetEcosystem: TechnologyEcosystem = "agnostic",
    customGraph?: SkillGraph | { skills: SkillNode[]; edges?: SkillEdge[] }
  ): SkillGapAnalysisResult[] {
    const graph =
      customGraph instanceof SkillGraph
        ? customGraph
        : customGraph
        ? new SkillGraph(customGraph.skills, customGraph.edges || [])
        : this.skillGraph;

    const competencyMap = new Map<string, CompetencyRecord>();
    for (const comp of competencies) {
      competencyMap.set(comp.skillId, comp);
    }

    const allRelevantSkillIds = graph.resolvePrerequisitesTopological(
      Object.keys(targetSkillWeights)
    );

    const results: SkillGapAnalysisResult[] = [];
    const urgency = Math.max(1.0, 12.0 / Math.max(1, deadlineMonths));

    for (const skillId of allRelevantSkillIds) {
      const skill = graph.getSkill(skillId);
      if (!skill) continue;

      // Filter out skills belonging to an incompatible technology ecosystem
      if (targetEcosystem !== "agnostic" && !isSkillCompatible(skill.ecosystem, targetEcosystem)) {
        continue;
      }

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

