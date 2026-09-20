import { CandidateDirection, CandidateDirectionStatus, UserWorkModel } from "../../contracts";
import { DomainKnowledge, domainKnowledge } from "../knowledge/domain-knowledge";

export class CandidateGenerator {
  private knowledge: DomainKnowledge;

  constructor(knowledge: DomainKnowledge = domainKnowledge) {
    this.knowledge = knowledge;
  }

  /**
   * Derives a small set of plausible candidate directions from the current User Work Model.
   * As required:
   * - No arbitrary numerical fit percentages (e.g. 87% fit).
   * - Supporting evidence and conflicting evidence are explicitly linked.
   * - Uncatalogued directions are supported via knowledge decomposition.
   * - Directions are temporary, revisable planning hypotheses (not permanent identity).
   */
  public generateCandidates(
    workModel: UserWorkModel,
    explicitGoalHint?: string | null
  ): CandidateDirection[] {
    const candidates: CandidateDirection[] = [];
    const activeEvidenceIds = workModel.evidenceIds;
    const knownCapabilities = Object.values(workModel.capabilities);
    const negativeSignals = workModel.negativeSignals;

    // 1. If user declared an explicit goal/direction, ensure it is evaluated as a primary candidate
    if (explicitGoalHint && explicitGoalHint.trim().length > 0) {
      const decomp = this.knowledge.resolveOrDecomposeDirection(explicitGoalHint);
      const supporting: string[] = [];
      const conflicting: string[] = [];
      const unknowns: string[] = [];

      // Evaluate capability support
      for (const capName of decomp.capabilities) {
        const matchingCap = knownCapabilities.find(
          (c) => c.name.toLowerCase().includes(capName.toLowerCase()) || capName.toLowerCase().includes(c.name.toLowerCase())
        );
        if (matchingCap && matchingCap.confidence > 0.5) {
          supporting.push(...matchingCap.supportingEvidenceIds);
        } else {
          unknowns.push(`Proficiency in ${capName}`);
        }
      }

      // Check negative signals (dimension-specific check)
      for (const [dim, signals] of Object.entries(negativeSignals)) {
        if (decomp.name.toLowerCase().includes(dim.toLowerCase())) {
          conflicting.push(`Negative signal on ${dim}: ${signals.join(", ")}`);
        }
      }

      let status: CandidateDirectionStatus = "unexplored";
      if (conflicting.length > 0) {
        status = "weakening";
      } else if (supporting.length > 0) {
        status = "supported";
      } else if (unknowns.length > 0) {
        status = "uncertain";
      } else {
        status = "active";
      }

      candidates.push({
        id: `cand_${decomp.name.toLowerCase().replace(/\s+/g, "_")}`,
        name: decomp.name,
        status,
        rationale: decomp.rationale,
        supportingEvidence: Array.from(new Set(supporting)),
        conflictingEvidence: Array.from(new Set(conflicting)),
        unknowns,
        relevantCapabilities: decomp.capabilities,
        relevantActivities: decomp.activities,
        relevantWorkCharacteristics: Object.entries(decomp.workCharacteristics).map(([k, v]) => `${k}: ${v}`),
        suggestedNextExperiment: {
          objective: `Validate foundational practical interest and aptitude in ${decomp.name}`,
          activity: `Build a small targeted exercise focusing on ${decomp.capabilities[0] || decomp.name}`,
          expectedEvidence: `Evidence of problem-solving approach and voluntary engagement`,
        },
      });
    }

    // 2. Reference roles: evaluate plausible matches from DomainKnowledge based on preferences & capabilities
    const preferredDomains = (workModel.preferences.domains || []).map((d) => d.toLowerCase());
    const allRoles = this.knowledge.getAllRoles();

    for (const role of allRoles) {
      // Avoid duplicating the explicit candidate if already added
      if (candidates.some((c) => c.name.toLowerCase() === role.name.toLowerCase())) {
        continue;
      }

      const roleDomainLower = role.domain.toLowerCase();
      const domainMatches = preferredDomains.some(
        (pd) => roleDomainLower.includes(pd) || pd.includes(roleDomainLower)
      );

      const supporting: string[] = [];
      const conflicting: string[] = [];
      const unknowns: string[] = [];

      for (const capId of role.capabilitiesRequired) {
        const matchingCap = knownCapabilities.find(
          (c) => c.name.toLowerCase().includes(capId.toLowerCase()) || capId.toLowerCase().includes(c.name.toLowerCase())
        );
        if (matchingCap) {
          supporting.push(...matchingCap.supportingEvidenceIds);
        } else {
          unknowns.push(`Capability required: ${capId}`);
        }
      }

      // Check negative signals
      for (const [dim, signals] of Object.entries(negativeSignals)) {
        if (roleDomainLower.includes(dim.toLowerCase()) || role.name.toLowerCase().includes(dim.toLowerCase())) {
          conflicting.push(`Negative feedback on ${dim}`);
        }
      }

      // Only consider if there is domain alignment, capability overlap, or few candidates
      if (domainMatches || supporting.length > 0 || candidates.length < 2) {
        let status: CandidateDirectionStatus = "unexplored";
        if (conflicting.length > 0) {
          status = "weakening";
        } else if (supporting.length > 0 && domainMatches) {
          status = "supported";
        } else if (unknowns.length > 2) {
          status = "uncertain";
        } else {
          status = "active";
        }

        candidates.push({
          id: `cand_${role.id}`,
          name: role.name,
          status,
          rationale: role.description,
          supportingEvidence: Array.from(new Set(supporting)),
          conflictingEvidence: Array.from(new Set(conflicting)),
          unknowns: unknowns.slice(0, 4),
          relevantCapabilities: role.capabilitiesRequired,
          relevantActivities: role.activitiesInvolved,
          relevantWorkCharacteristics: Object.entries(role.workCharacteristics).map(([k, v]) => `${k}: ${v}`),
          suggestedNextExperiment: {
            objective: `Assess interest and aptitude for ${role.name}`,
            activity: `Practical assessment or exercise in ${role.activitiesInvolved[0] || "core work"}`,
            expectedEvidence: `Demonstrated technical capability and task satisfaction`,
          },
        });
      }
    }

    return candidates.slice(0, 4);
  }
}

export const candidateGenerator = new CandidateGenerator();
