import { SEEDED_PATHS, SEEDED_SKILLS, SEEDED_EDGES, PathDefinition } from "../../persistence/seed-data";

export interface RoleReference {
  id: string;
  name: string;
  domain: string;
  description: string;
  capabilitiesRequired: string[];
  activitiesInvolved: string[];
  workCharacteristics: Record<string, any>;
  prerequisites: string[];
  typicalEvidenceSignals: string[];
}

export interface DecomposedDirection {
  name: string;
  isCatalogKnown: boolean;
  capabilities: string[];
  activities: string[];
  workCharacteristics: Record<string, any>;
  rationale: string;
}

export class DomainKnowledge {
  private roleCatalog: Map<string, RoleReference> = new Map();

  constructor(paths: PathDefinition[] = SEEDED_PATHS) {
    this.seedFromPaths(paths);
  }

  private seedFromPaths(paths: PathDefinition[]): void {
    for (const p of paths) {
      const capabilities = Object.keys(p.targetSkillWeights || {});
      const activities: string[] = [
        "System Architecture Design",
        "Implementation & Coding",
        "Automated Testing & Verification",
        "Deployment & Monitoring",
      ];

      this.roleCatalog.set(p.id, {
        id: p.id,
        name: p.title,
        domain: p.domain,
        description: p.description,
        capabilitiesRequired: capabilities,
        activitiesInvolved: activities,
        workCharacteristics: {
          technicalDepth: "high",
          autonomy: "moderate_to_high",
          ambiguity: "moderate",
        },
        prerequisites: p.requiredDimensions || [],
        typicalEvidenceSignals: [p.title, p.domain, ...(p.supportedRoles || []), ...(p.supportedDomains || [])],
      });
    }
  }

  /**
   * Looks up a known role in the reference catalogue.
   */
  public findRole(roleIdOrName: string): RoleReference | null {
    const key = roleIdOrName.toLowerCase().trim();
    for (const [id, ref] of this.roleCatalog.entries()) {
      if (id.toLowerCase() === key || ref.name.toLowerCase() === key) {
        return ref;
      }
    }
    return null;
  }

  /**
   * Retrieves all reference roles.
   */
  public getAllRoles(): RoleReference[] {
    return Array.from(this.roleCatalog.values());
  }

  /**
   * Resolves or decomposes any direction (known or unknown) into capabilities, activities, and work characteristics.
   * As specified: The reference catalogue constrains knowledge confidence, not possibility.
   * Unknown directions are decomposed into primitives without rejecting them.
   */
  public resolveOrDecomposeDirection(directionName: string): DecomposedDirection {
    const known = this.findRole(directionName);
    if (known) {
      return {
        name: known.name,
        isCatalogKnown: true,
        capabilities: known.capabilitiesRequired,
        activities: known.activitiesInvolved,
        workCharacteristics: known.workCharacteristics,
        rationale: `Grounding validated against reference knowledge layer (${known.name}).`,
      };
    }

    // Uncatalogued direction: decompose dynamically into primitive capabilities & activities
    const raw = directionName.toLowerCase().trim();
    const derivedCapabilities: string[] = [
      `Foundations for ${directionName}`,
      `Domain Core Competencies for ${directionName}`,
      `Practical Project Execution & Evaluation for ${directionName}`,
    ];
    const derivedActivities: string[] = [
      `Hands-on practical exploration in ${directionName}`,
      `Conceptual analysis & research in ${directionName}`,
      `End-to-end artifact creation for ${directionName}`,
    ];

    return {
      name: directionName,
      isCatalogKnown: false,
      capabilities: derivedCapabilities,
      activities: derivedActivities,
      workCharacteristics: {
        autonomy: "high",
        ambiguity: "high",
        technicalDepth: "moderate",
      },
      rationale: `Direction decomposed into capabilities and activities for uncatalogued adaptive planning.`,
    };
  }
}

export const domainKnowledge = new DomainKnowledge();
