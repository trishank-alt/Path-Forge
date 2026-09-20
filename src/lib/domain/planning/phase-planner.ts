import {
  LearningResource,
  PracticalProject,
  RoadmapPhase,
  UserWorkModel,
  TechnologyEcosystem,
} from "../../contracts";
import { SkillGapAnalysisResult } from "../learning/skill-gap-service";
import { Curriculum, toCurriculum } from "../learning/curriculum-model";
import { PathDefinition, SEEDED_PROJECTS, SEEDED_RESOURCES } from "../../persistence/seed-data";
import { isProjectCompatible } from "../learning/technology-ecosystem";
import { DomainKnowledge, domainKnowledge } from "../knowledge/domain-knowledge";

export interface PhasePlanInput {
  directionName: string;
  workModel: UserWorkModel;
  completedPhases?: RoadmapPhase[];
  customObjective?: string;
  curriculum?: Curriculum | PathDefinition;
  gapResults?: SkillGapAnalysisResult[];
  targetEcosystem?: TechnologyEcosystem;
}

export class PhasePlanner {
  private knowledge: DomainKnowledge;

  constructor(knowledge: DomainKnowledge = domainKnowledge) {
    this.knowledge = knowledge;
  }

  /**
   * Generates the NEXT PHASE ONLY.
   * A single planning operation creates at most one new phase.
   * Does NOT generate Phase 1, Phase 2, Phase 3 upfront.
   *
   * Capacity adaptation:
   * Available hours/week and timeline scale the duration and scope rather than blocking.
   */
  public generateNextPhase(input: PhasePlanInput): RoadmapPhase {
    const {
      directionName,
      workModel,
      completedPhases = [],
      customObjective,
      curriculum: targetCurriculum,
      gapResults = [],
      targetEcosystem,
    } = input;

    const phaseNumber = completedPhases.length + 1;

    // 1. Capacity constraints adapt phase scope and pacing
    const hoursPerWeek = Math.max(2, Math.min(60, workModel.constraints.hoursPerWeek || 8));

    // Resolve curriculum if provided
    let curriculum: Curriculum | null = null;
    const ecosystem =
      targetEcosystem ||
      (targetCurriculum as any)?.technologyEcosystem ||
      "agnostic";

    if (targetCurriculum) {
      curriculum = toCurriculum(targetCurriculum, ecosystem);
    }

    const activeGaps = gapResults.filter(
      (g) => g.gap > 0 || g.status === "claimed_unverified"
    );

    // 2. Determine capability/skill targets for THIS specific phase
    let selectedCaps: string[] = [];
    let phaseTitlePrefix = `Phase ${phaseNumber}`;

    if (curriculum && activeGaps.length > 0) {
      if (phaseNumber === 1) {
        const p1Gaps = activeGaps.filter((g) => g.skill.level <= 2);
        selectedCaps = (p1Gaps.length > 0 ? p1Gaps : activeGaps.slice(0, 3)).map(
          (g) => g.skillId
        );
        phaseTitlePrefix = `Phase 1: Core Fundamentals & Foundations for ${curriculum.title}`;
      } else if (phaseNumber === 2) {
        const p2Gaps = activeGaps.filter((g) => g.skill.level === 3);
        selectedCaps = (p2Gaps.length > 0 ? p2Gaps : activeGaps.slice(0, 3)).map(
          (g) => g.skillId
        );
        phaseTitlePrefix = `Phase 2: Architecture, Persistence & System Integration for ${curriculum.title}`;
      } else {
        const p3Gaps = activeGaps.filter((g) => g.skill.level >= 3);
        selectedCaps = (p3Gaps.length > 0 ? p3Gaps : activeGaps.slice(0, 3)).map(
          (g) => g.skillId
        );
        phaseTitlePrefix = `Phase ${phaseNumber}: Production Hardening, Security & Advanced Systems for ${curriculum.title}`;
      }
    } else {
      // Grounded decomposition for uncatalogued/novel directions
      const decomp = this.knowledge.resolveOrDecomposeDirection(directionName);
      const allCaps = decomp.capabilities;
      const startIndex = (phaseNumber - 1) % allCaps.length;
      selectedCaps = allCaps.slice(startIndex, startIndex + 2);
      if (selectedCaps.length === 0) {
        selectedCaps.push(allCaps[0] || `${directionName} Advanced Practice`);
      }
      phaseTitlePrefix = `Phase ${phaseNumber}: ${selectedCaps.join(" & ")}`;
    }

    // Adapt workload: 2-4 weeks per phase depending on weekly capacity
    const targetWeeks = hoursPerWeek < 6 ? 4 : 3;
    const totalHours = hoursPerWeek * targetWeeks;

    // 3. Concrete practical activities
    const activities = [
      {
        id: `act_${phaseNumber}_1`,
        title: `Core Conceptual Foundations & Architecture in ${selectedCaps[0]}`,
        type: "concept_and_study",
        description: `Study fundamental patterns, design principles, and core syntax for ${selectedCaps[0]}.`,
        estimatedHours: Math.max(2, Math.round(totalHours * 0.35)),
      },
      {
        id: `act_${phaseNumber}_2`,
        title: `Practical Implementation & Hands-on Exercises`,
        type: "practical_implementation",
        description: `Implement modular components with tests demonstrating capability in ${selectedCaps.join(" & ")}.`,
        estimatedHours: Math.max(2, Math.round(totalHours * 0.35)),
      },
      {
        id: `act_${phaseNumber}_3`,
        title: `Project Milestone Deliverable & Code Review`,
        type: "project_deliverable",
        description: `Assemble artifacts into a coherent functional deliverable ready for evaluation and reflection.`,
        estimatedHours: Math.max(2, Math.round(totalHours * 0.3)),
      },
    ];

    // 4. Match or synthesize practical project
    let project: PracticalProject | null = null;
    const projectPool =
      curriculum?.source === "constructed"
        ? curriculum.projects
        : SEEDED_PROJECTS;

    const candidateProjects = projectPool.filter((p) =>
      isProjectCompatible(p.ecosystem, ecosystem)
    );

    let matchedProject = candidateProjects.find(
      (p) =>
        curriculum &&
        (p.domainContext.toLowerCase().includes(curriculum.domain.toLowerCase()) ||
          curriculum.domain.toLowerCase().includes(p.domainContext.toLowerCase()) ||
          curriculum.title.toLowerCase().includes(p.domainContext.toLowerCase())) &&
        p.targetSkillIds.some((s) => selectedCaps.includes(s))
    );

    if (!matchedProject) {
      matchedProject = candidateProjects.find((p) =>
        p.targetSkillIds.some((s) => selectedCaps.includes(s))
      );
    }

    if (matchedProject) {
      project = {
        ...matchedProject,
        id: `proj_phase_${phaseNumber}_${matchedProject.id}`,
        estimatedHours: Math.max(4, Math.round(totalHours * 0.4)),
      };
    } else {
      project = {
        id: `proj_phase_${phaseNumber}`,
        title: `${directionName} Practical Deliverable ${phaseNumber}`,
        description: `Build a functional, tested application deliverable demonstrating capability in ${selectedCaps.join(", ")}.`,
        targetSkillIds: selectedCaps,
        deliverables: [
          `Working repository with clean commit history`,
          `Automated test suite verifying core workflows`,
          `Architecture overview documentation`,
        ],
        verificationChecklist: [
          `Handles core user scenarios without errors`,
          `Follows modular design and separation of concerns`,
          `Demonstrates applied competency in ${selectedCaps[0]}`,
        ],
        estimatedHours: Math.max(4, Math.round(totalHours * 0.4)),
        domainContext: `${directionName} Practical Implementation`,
      };
    }

    // 5. Gather & rank resources
    const resourcePool =
      curriculum?.source === "constructed"
        ? curriculum.resources
        : SEEDED_RESOURCES;

    let matchedResources = resourcePool.filter((r) =>
      selectedCaps.includes(r.skillId)
    );

    if (matchedResources.length === 0) {
      matchedResources = [
        {
          id: `res_phase_${phaseNumber}_1`,
          skillId: selectedCaps[0],
          title: `Practical Guide to ${selectedCaps[0]}`,
          provider: "PathForge Curated Reference",
          url: `https://docs.pathforge.dev/topics/${encodeURIComponent(selectedCaps[0])}`,
          format: "documentation",
          costType: "free",
          durationHours: Math.max(1, Math.round(totalHours * 0.2)),
          qualityScore: 0.95,
          description: `Authoritative technical documentation and patterns for ${selectedCaps[0]}.`,
        },
      ];
    }

    // 6. Evidence measurement targets
    const evidenceTargets = [
      {
        dimension: `capability:${selectedCaps[0].toLowerCase().replace(/\s+/g, "_")}`,
        expectedSignal: `Demonstrated working capability in ${selectedCaps[0]} through verified deliverable`,
        measurementCriteria: "Successful execution of test cases and clean code review",
      },
      {
        dimension: `activity:implementation_pace`,
        expectedSignal: "Pacing and time investment relative to declared capacity",
        measurementCriteria: `Target pace of ${hoursPerWeek}h/week`,
      },
      {
        dimension: `work_characteristic:autonomy`,
        expectedSignal: "Self-directed problem-solving and voluntary exploration",
        measurementCriteria: "Post-phase reflection signals on problem-solving enjoyment and friction",
      },
    ];

    // 7. Decision point
    const decisionPoint = {
      condition: `Upon completion of Phase ${phaseNumber} deliverables and reflection submission`,
      possibleOutcomes: [
        `If demonstration is strong and energizing: Decision Engine evaluates COMMIT to Phase ${phaseNumber + 1}`,
        `If core concepts show friction or fatigue: Decision Engine adapts pacing or introduces targeted DISAMBIGUATION`,
        `If voluntary exploration revealed adjacent interest: Decision Engine initiates exploratory probe (EXPLORE)`,
      ],
    };

    const objective =
      customObjective ||
      (curriculum
        ? `${phaseTitlePrefix}: Master ${selectedCaps.join(" & ")} through guided study and practical implementation.`
        : `Develop demonstrated capability in ${selectedCaps.join(" and ")} while measuring practical task affinity and problem-solving pace.`);

    return {
      id: `phase_${phaseNumber}_${Date.now()}`,
      phaseNumber,
      objective,
      duration: {
        estimatedWeeks: targetWeeks,
        totalHours,
        weeklyHours: hoursPerWeek,
      },
      capabilityTargets: selectedCaps,
      activities,
      project,
      evidenceTargets,
      decisionPoint,
      resources: matchedResources.slice(0, 3),
      status: "in_progress",
      explanation: `Phase ${phaseNumber} scoped specifically for ${hoursPerWeek}h/week to develop core capabilities while gathering observational evidence for subsequent planning.`,
    };
  }

  /**
   * Estimates total curriculum hours for feasibility calculation.
   */
  public calculateRequiredHours(
    target: Curriculum | PathDefinition,
    gapResults: SkillGapAnalysisResult[]
  ): number {
    const activeGaps = gapResults.filter(
      (g) => g.gap > 0 || g.status === "claimed_unverified"
    );
    if (activeGaps.length === 0) return 40;

    const rawId =
      "source" in target && target.source === "catalog"
        ? target.id.replace("catalog:", "")
        : "id" in target
        ? target.id
        : "";
    const phase1Gaps = activeGaps.filter((g) => g.skill.level <= 2);
    const phase2Gaps = activeGaps.filter(
      (g) =>
        g.skill.level === 3 &&
        (g.skill.domain === "databases" ||
          g.skill.domain.includes("ecosystem") ||
          g.skill.domain === "networking" ||
          g.skill.domain === "devops" ||
          g.skill.domain === "quality" ||
          (rawId === "cybersecurity_defensive_redteam" &&
            (g.skillId === "threat_modeling_owasp" ||
              g.skillId === "secure_code_review" ||
              g.skillId === "web_security_mechanisms")))
    );
    const phase3Gaps = activeGaps.filter(
      (g) => !phase1Gaps.includes(g) && !phase2Gaps.includes(g)
    );

    const milestoneGroups: { gaps: SkillGapAnalysisResult[] }[] = [];
    if (phase1Gaps.length > 0) milestoneGroups.push({ gaps: phase1Gaps });
    if (phase2Gaps.length > 0) milestoneGroups.push({ gaps: phase2Gaps });
    if (phase3Gaps.length > 0) milestoneGroups.push({ gaps: phase3Gaps });

    if (milestoneGroups.length === 0 && activeGaps.length > 0) {
      milestoneGroups.push({ gaps: activeGaps });
    }

    let cumulativeHours = 0;
    for (const group of milestoneGroups) {
      cumulativeHours += Math.max(10, group.gaps.length * 10);
    }
    return cumulativeHours || 120;
  }
}

export const phasePlanner = new PhasePlanner();
