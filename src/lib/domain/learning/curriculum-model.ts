import {
  CurriculumProposal,
  CurriculumSource,
  LearningResource,
  PracticalProject,
  ResourceProvenance,
  SkillEdge,
  SkillNode,
  TechnologyEcosystem,
} from "../../contracts";
import {
  PathDefinition,
  SEEDED_EDGES,
  SEEDED_PROJECTS,
  SEEDED_RESOURCES,
  SEEDED_SKILLS,
} from "../../persistence/seed-data";
import { SkillGraph } from "./skill-graph";

export interface Curriculum {
  id: string; // "catalog:<pathId>" or "constructed:<uuid>"
  source: CurriculumSource;
  title: string;
  domain: string;
  targetRole: string;
  specialization?: string;
  description: string;
  targetSkillWeights: Record<string, number>;
  defaultAssumptions: string[];
  requiredDimensions: string[];
  technologyEcosystem?: TechnologyEcosystem;
  skills: SkillNode[];
  edges: SkillEdge[];
  resources: LearningResource[];
  projects: PracticalProject[];
  estimatedTotalHours: number;
  provenance: ResourceProvenance;
}

export function toCurriculum(
  target: Curriculum | PathDefinition,
  ecosystem: TechnologyEcosystem = "agnostic"
): Curriculum {
  if ("source" in target && (target.source === "catalog" || target.source === "constructed")) {
    return target;
  }
  return catalogPathToCurriculum(target as PathDefinition, ecosystem);
}

/**
 * Adapts a predefined catalog PathDefinition into the unified Curriculum representation.
 * Zero LLM calls. References static catalog data pools without mutation.
 */
export function catalogPathToCurriculum(
  pathDef: PathDefinition,
  targetEcosystem: TechnologyEcosystem = pathDef.technologyEcosystem || "agnostic"
): Curriculum {
  const targetSkillIds = Object.keys(pathDef.targetSkillWeights);
  const catalogGraph = new SkillGraph(SEEDED_SKILLS, SEEDED_EDGES);
  const relevantSkillIds = new Set(catalogGraph.resolvePrerequisitesTopological(targetSkillIds));

  const scopedSkills = SEEDED_SKILLS.filter((s) => relevantSkillIds.has(s.id));
  const scopedEdges = SEEDED_EDGES.filter(
    (e) => relevantSkillIds.has(e.fromSkillId) && relevantSkillIds.has(e.toSkillId)
  );

  const scopedResources: LearningResource[] = SEEDED_RESOURCES.filter((r) =>
    relevantSkillIds.has(r.skillId)
  ).map((r) => ({
    ...r,
    provenance: "catalog_verified",
  }));

  const scopedProjects: PracticalProject[] = SEEDED_PROJECTS.filter((p) =>
    p.targetSkillIds.some((s) => relevantSkillIds.has(s))
  );

  return {
    id: `catalog:${pathDef.id}`,
    source: "catalog",
    title: pathDef.title,
    domain: pathDef.domain,
    targetRole: pathDef.supportedRoles?.[0] || pathDef.title,
    specialization: pathDef.supportedSpecializations?.[0],
    description: pathDef.description,
    targetSkillWeights: { ...pathDef.targetSkillWeights },
    defaultAssumptions: [...pathDef.defaultAssumptions],
    requiredDimensions: [...pathDef.requiredDimensions],
    technologyEcosystem: targetEcosystem,
    skills: scopedSkills,
    edges: scopedEdges,
    resources: scopedResources,
    projects: scopedProjects,
    estimatedTotalHours: 120,
    provenance: "catalog_verified",
  };
}

/**
 * Transforms an accepted CurriculumProposal into an immutable scoped Curriculum snapshot.
 * Preserves strict isolation: this curriculum snapshot is NEVER pushed to SEEDED_* arrays.
 */
export function proposalToCurriculum(
  proposal: CurriculumProposal,
  instanceId?: string
): Curriculum {
  const curriculumId = instanceId || `constructed:c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Convert proposed skills to SkillNode entities
  const skills: SkillNode[] = proposal.proposedSkills.map((s) => ({
    id: s.id,
    title: s.title,
    domain: s.domain,
    level: s.level,
    category: s.category,
    description: s.description,
    evidenceCriteria: s.evidenceCriteria,
    tags: s.tags,
    ecosystem: s.ecosystem || proposal.technologyEcosystem || "agnostic",
  }));

  // Convert proposed edges to SkillEdge entities
  const edges: SkillEdge[] = proposal.proposedEdges.map((e, idx) => ({
    id: `edge_${curriculumId.replace(/[^a-zA-Z0-9_]/g, "_")}_${idx}`,
    fromSkillId: e.fromSkillId,
    toSkillId: e.toSkillId,
    type: e.type,
    minimumLevel: "working",
    rationale: e.rationale,
  }));

  // Convert proposed resources with explicit synthetic provenance
  const resources: LearningResource[] = proposal.proposedResources.map((r, idx) => ({
    id: `res_${curriculumId.replace(/[^a-zA-Z0-9_]/g, "_")}_${idx}`,
    skillId: r.skillId,
    title: r.title,
    provider: r.provider,
    url: r.url,
    format: r.format,
    costType: "free",
    durationHours: r.durationHours,
    qualityScore: 0.85,
    description: r.description,
    ecosystem: r.ecosystem || proposal.technologyEcosystem || "agnostic",
    provenance: "synthetic_unverified_external",
  }));

  // Convert proposed projects
  const projects: PracticalProject[] = proposal.proposedProjects.map((p, idx) => ({
    id: `proj_${curriculumId.replace(/[^a-zA-Z0-9_]/g, "_")}_${idx}`,
    title: p.title,
    description: p.description,
    targetSkillIds: p.targetSkillIds,
    deliverables: p.deliverables,
    verificationChecklist: p.verificationChecklist,
    estimatedHours: p.estimatedHours,
    domainContext: p.domainContext,
    ecosystem: p.ecosystem || proposal.technologyEcosystem || "agnostic",
  }));

  // Construct target skill weights based on skill levels
  const targetSkillWeights: Record<string, number> = {};
  for (const s of skills) {
    if (s.level >= 4) {
      targetSkillWeights[s.id] = 1.0;
    } else if (s.level === 3) {
      targetSkillWeights[s.id] = 0.9;
    } else if (s.level === 2) {
      targetSkillWeights[s.id] = 0.8;
    } else {
      targetSkillWeights[s.id] = 0.65;
    }
  }

  return {
    id: curriculumId,
    source: "constructed",
    title: `${proposal.targetRole}${proposal.specialization ? ` (${proposal.specialization})` : ""}`,
    domain: proposal.domain,
    targetRole: proposal.targetRole,
    specialization: proposal.specialization,
    description: proposal.description || `Constructed learning curriculum for ${proposal.targetRole}`,
    targetSkillWeights,
    defaultAssumptions: [
      ...(proposal.defaultAssumptions || proposal.assumptions || []),
      "Constructed curriculum generated via controlled discovery; verified against deterministic structural and pedagogical gates.",
      "Resources are unverified external suggestions based on model knowledge.",
    ],
    requiredDimensions: ["primary_language", "hours_per_week"],
    technologyEcosystem: proposal.technologyEcosystem || "agnostic",
    skills,
    edges,
    resources,
    projects,
    estimatedTotalHours: proposal.estimatedLearningHours || 120,
    provenance: "synthetic_unverified_external",
  };
}
