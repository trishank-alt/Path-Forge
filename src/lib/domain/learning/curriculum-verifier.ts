import { CurriculumProposal, TechnologyEcosystem } from "../../contracts";
import { SkillGraph } from "./skill-graph";

export interface GateResult {
  passed: boolean;
  message: string;
}

export interface CurriculumVerificationResult {
  isValid: boolean;
  failedGates: string[];
  gateResults: Record<string, GateResult>;
  explanation: string;
}

/**
 * Deterministically evaluates an untrusted CurriculumProposal against 10 hard validation gates.
 * Structural verification certifies internal consistency, DAG acyclicity, and policy compliance;
 * it does NOT claim that an LLM-generated curriculum is factually authoritative or an industry standard.
 */
export class CurriculumVerifier {
  public verify(
    proposal: CurriculumProposal,
    requiredEcosystem?: TechnologyEcosystem
  ): CurriculumVerificationResult {
    const gateResults: Record<string, GateResult> = {};
    const failedGates: string[] = [];

    // ----------------------------------------------------
    // Gate 1: Schema & Field Integrity Gate
    // ----------------------------------------------------
    {
      const hasTarget = Boolean(proposal.targetRole?.trim() && proposal.domain?.trim());
      const hasValidSkills = Array.isArray(proposal.proposedSkills) && proposal.proposedSkills.length > 0;
      const allSkillsHaveIds = hasValidSkills && proposal.proposedSkills.every((s) => s.id?.trim() && s.title?.trim());

      if (hasTarget && hasValidSkills && allSkillsHaveIds) {
        gateResults["Gate 1 (Schema Integrity)"] = { passed: true, message: "All required fields are present and valid." };
      } else {
        gateResults["Gate 1 (Schema Integrity)"] = { passed: false, message: "Missing required role, domain, or skill metadata." };
        failedGates.push("Gate 1 (Schema Integrity)");
      }
    }

    // ----------------------------------------------------
    // Gate 2: Structural Relevance & Scope Gate
    // ----------------------------------------------------
    {
      const roleTokens = `${proposal.targetRole} ${proposal.domain} ${proposal.specialization || ""}`
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2);

      const stopWords = new Set(["and", "the", "for", "with", "engineer", "engineering", "developer", "specialist"]);
      const keyDomainTokens = roleTokens.filter((t) => !stopWords.has(t));

      const matchingSkills = proposal.proposedSkills.filter((s) => {
        const skillText = `${s.id} ${s.title} ${s.domain} ${s.description} ${s.tags.join(" ")}`.toLowerCase();
        return keyDomainTokens.some((token) => skillText.includes(token));
      });

      const isPureGenericTools = proposal.proposedSkills.every((s) => {
        const id = s.id.toLowerCase();
        return id.includes("git") || id.includes("linux_basics") || id.includes("command_line");
      });

      if (matchingSkills.length >= 2 && !isPureGenericTools) {
        gateResults["Gate 2 (Intent Relevance)"] = {
          passed: true,
          message: `${matchingSkills.length} skills explicitly match domain objective tokens.`,
        };
      } else {
        gateResults["Gate 2 (Intent Relevance)"] = {
          passed: false,
          message: `Insufficient domain-specific skills matching '${proposal.targetRole}'. Found ${matchingSkills.length} matching skills.`,
        };
        failedGates.push("Gate 2 (Intent Relevance)");
      }
    }

    // ----------------------------------------------------
    // Gate 3: Skill Count & Level Distribution Gate
    // ----------------------------------------------------
    {
      const total = proposal.proposedSkills.length;
      const foundational = proposal.proposedSkills.filter((s) => s.level <= 2);
      const advanced = proposal.proposedSkills.filter((s) => s.level >= 3);

      if (total >= 4 && total <= 25 && foundational.length >= 1 && advanced.length >= 1) {
        gateResults["Gate 3 (Skill Distribution)"] = {
          passed: true,
          message: `Valid skill count (${total}) with foundational (${foundational.length}) and advanced (${advanced.length}) distribution.`,
        };
      } else {
        gateResults["Gate 3 (Skill Distribution)"] = {
          passed: false,
          message: `Invalid skill count or distribution: total=${total} (min 4, max 25), foundational=${foundational.length}, advanced=${advanced.length}.`,
        };
        failedGates.push("Gate 3 (Skill Distribution)");
      }
    }

    // ----------------------------------------------------
    // Gate 4: Edge Referential Integrity Gate
    // ----------------------------------------------------
    {
      const skillIds = new Set(proposal.proposedSkills.map((s) => s.id));
      let danglingEdges = 0;

      for (const edge of proposal.proposedEdges) {
        if (!skillIds.has(edge.fromSkillId) || !skillIds.has(edge.toSkillId)) {
          danglingEdges++;
        }
      }

      if (danglingEdges === 0) {
        gateResults["Gate 4 (Edge Integrity)"] = { passed: true, message: "All prerequisite edges reference valid proposed skills." };
      } else {
        gateResults["Gate 4 (Edge Integrity)"] = { passed: false, message: `Found ${danglingEdges} dangling prerequisite edge(s).` };
        failedGates.push("Gate 4 (Edge Integrity)");
      }
    }

    // ----------------------------------------------------
    // Gate 5: DAG Acyclicity Gate
    // ----------------------------------------------------
    {
      try {
        const dummyNodes = proposal.proposedSkills.map((s) => ({
          id: s.id,
          title: s.title,
          domain: s.domain,
          level: s.level,
          category: s.category,
          description: s.description,
          evidenceCriteria: s.evidenceCriteria,
          tags: s.tags,
        }));
        const dummyEdges = proposal.proposedEdges.map((e, i) => ({
          id: `e_${i}`,
          fromSkillId: e.fromSkillId,
          toSkillId: e.toSkillId,
          type: e.type,
          minimumLevel: "working" as const,
          rationale: e.rationale,
        }));

        const testGraph = new SkillGraph(dummyNodes, dummyEdges);
        const hasCycle = testGraph.detectCycles();

        if (!hasCycle) {
          gateResults["Gate 5 (DAG Acyclicity)"] = { passed: true, message: "Graph is a topologically valid directed acyclic graph (no cycles)." };
        } else {
          gateResults["Gate 5 (DAG Acyclicity)"] = { passed: false, message: "Cycle detected in proposed skill prerequisite graph." };
          failedGates.push("Gate 5 (DAG Acyclicity)");
        }
      } catch (err: any) {
        gateResults["Gate 5 (DAG Acyclicity)"] = { passed: false, message: `Cycle detected: ${err.message}` };
        failedGates.push("Gate 5 (DAG Acyclicity)");
      }
    }

    // ----------------------------------------------------
    // Gate 6: Prerequisite Level Inversion Gate
    // ----------------------------------------------------
    {
      const skillLevelMap = new Map(proposal.proposedSkills.map((s) => [s.id, s.level]));
      let invertedEdges = 0;

      for (const edge of proposal.proposedEdges) {
        const fromLevel = skillLevelMap.get(edge.fromSkillId) || 1;
        const toLevel = skillLevelMap.get(edge.toSkillId) || 1;
        if (fromLevel > toLevel) {
          invertedEdges++;
        }
      }

      if (invertedEdges === 0) {
        gateResults["Gate 6 (Level Inversion)"] = { passed: true, message: "No prerequisite level inversions detected." };
      } else {
        gateResults["Gate 6 (Level Inversion)"] = {
          passed: false,
          message: `Found ${invertedEdges} edge(s) where prerequisite level exceeds dependent level.`,
        };
        failedGates.push("Gate 6 (Level Inversion)");
      }
    }

    // ----------------------------------------------------
    // Gate 7: Syntactic Resource Attachment Gate
    // ----------------------------------------------------
    {
      const coreSkillIds = new Set(proposal.proposedSkills.filter((s) => s.level >= 2).map((s) => s.id));
      const resSkillIds = new Set(proposal.proposedResources.map((r) => r.skillId));

      const hasInvalidDuration = proposal.proposedResources.some((r) => r.durationHours <= 0);
      const hasEmptyTitleOrProvider = proposal.proposedResources.some(
        (r) => !r.title?.trim() || !r.provider?.trim()
      );

      const coveredCoreSkills = Array.from(coreSkillIds).filter((id) => resSkillIds.has(id));
      const coverageRatio = coreSkillIds.size > 0 ? coveredCoreSkills.length / coreSkillIds.size : 1.0;

      if (coverageRatio >= 0.5 && !hasInvalidDuration && !hasEmptyTitleOrProvider) {
        gateResults["Gate 7 (Resource Attachment)"] = {
          passed: true,
          message: `Resources attached with ${(coverageRatio * 100).toFixed(0)}% core coverage and valid format.`,
        };
      } else {
        gateResults["Gate 7 (Resource Attachment)"] = {
          passed: false,
          message: `Insufficient resource attachment (coverage=${(coverageRatio * 100).toFixed(0)}%, invalidDuration=${hasInvalidDuration}, emptyTitle=${hasEmptyTitleOrProvider}).`,
        };
        failedGates.push("Gate 7 (Resource Attachment)");
      }
    }

    // ----------------------------------------------------
    // Gate 8: Practical Verification Attachment Gate
    // ----------------------------------------------------
    {
      const projects = proposal.proposedProjects;
      const hasProjects = projects.length >= 1;
      const validDeliverables = projects.every(
        (p) => Array.isArray(p.deliverables) && p.deliverables.length >= 2
      );
      const validChecklists = projects.every(
        (p) => Array.isArray(p.verificationChecklist) && p.verificationChecklist.length >= 2
      );
      const validHours = projects.every((p) => p.estimatedHours > 0);

      if (hasProjects && validDeliverables && validChecklists && validHours) {
        gateResults["Gate 8 (Practical Verification)"] = {
          passed: true,
          message: `${projects.length} practical project(s) attached with verifiable deliverables and checklists.`,
        };
      } else {
        gateResults["Gate 8 (Practical Verification)"] = {
          passed: false,
          message: `Practical projects lack required deliverables (>=2), checklist (>=2), or positive hours.`,
        };
        failedGates.push("Gate 8 (Practical Verification)");
      }
    }

    // ----------------------------------------------------
    // Gate 9: Workload Bounds & Calculability Gate
    // ----------------------------------------------------
    {
      const hours = proposal.estimatedLearningHours || 0;
      if (hours >= 40 && hours <= 600) {
        gateResults["Gate 9 (Workload Bounds)"] = { passed: true, message: `Estimated hours (${hours}h) within realistic bounds (40h-600h).` };
      } else {
        gateResults["Gate 9 (Workload Bounds)"] = { passed: false, message: `Estimated hours (${hours}h) outside realistic bounds (40h-600h).` };
        failedGates.push("Gate 9 (Workload Bounds)");
      }
    }

    // ----------------------------------------------------
    // Gate 10: Ecosystem Isolation Gate
    // ----------------------------------------------------
    {
      let isEcosystemClean = true;
      let conflictReason = "";

      if (requiredEcosystem && requiredEcosystem !== "agnostic") {
        if (requiredEcosystem === "python_fastapi") {
          const hasJava = proposal.proposedSkills.some(
            (s) => s.id.includes("java") || s.title.toLowerCase().includes("spring boot")
          );
          if (hasJava) {
            isEcosystemClean = false;
            conflictReason = "Incompatible Java/Spring skills found in Python track proposal";
          }
        } else if (requiredEcosystem === "typescript_node") {
          const hasJava = proposal.proposedSkills.some(
            (s) => s.id.includes("java") || s.title.toLowerCase().includes("spring boot")
          );
          if (hasJava) {
            isEcosystemClean = false;
            conflictReason = "Incompatible Java/Spring skills found in TypeScript/Node track proposal";
          }
        }
      }

      if (isEcosystemClean) {
        gateResults["Gate 10 (Ecosystem Isolation)"] = { passed: true, message: "Secondary technology ecosystem constraints respected." };
      } else {
        gateResults["Gate 10 (Ecosystem Isolation)"] = { passed: false, message: conflictReason };
        failedGates.push("Gate 10 (Ecosystem Isolation)");
      }
    }

    const isValid = failedGates.length === 0;
    const explanation = isValid
      ? "Constructed curriculum successfully verified against all 10 deterministic structural and pedagogical gates."
      : `Curriculum proposal failed validation on: ${failedGates.join("; ")}`;

    return {
      isValid,
      failedGates,
      gateResults,
      explanation,
    };
  }
}

export const curriculumVerifier = new CurriculumVerifier();
