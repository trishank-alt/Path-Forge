import {
  LearnerConstraints,
  LearnerPreferences,
  Milestone,
  MilestoneStatus,
  Roadmap,
} from "../../contracts";
import {
  SEEDED_PROJECTS,
  SEEDED_RESOURCES,
  PathDefinition,
} from "../../persistence/seed-data";
import { RecommendationScorer } from "./recommendation-scorer";
import { SkillGapAnalysisResult } from "./skill-gap-service";

export class MilestonePlanner {
  private scorer: RecommendationScorer;

  constructor(scorer: RecommendationScorer = new RecommendationScorer()) {
    this.scorer = scorer;
  }

  /**
   * Returns path-tailored phase metadata for each milestone phase.
   */
  private getPhaseDetails(
    pathDef: PathDefinition,
    phaseNumber: number
  ): { title: string; desc: string } {
    if (pathDef.id === "devops_cloud_engineer") {
      if (phaseNumber === 1) {
        return {
          title: "Phase 1: Linux Networking & Container Infrastructure",
          desc: "Master Linux system administration, TCP/IP networking, and Docker containerization.",
        };
      } else if (phaseNumber === 2) {
        return {
          title: "Phase 2: Automated CI/CD Pipelines & Testing Workflows",
          desc: "Build automated GitHub Actions workflows, integration test suites, and container registries.",
        };
      } else {
        return {
          title: "Phase 3: Cloud Infrastructure as Code & Security Hardening",
          desc: "Deploy scalable cloud services on AWS/GCP with CIS security benchmarks and monitoring.",
        };
      }
    }

    if (pathDef.id === "fullstack_software_engineer") {
      if (phaseNumber === 1) {
        return {
          title: "Phase 1: Modern Web Frontend & TypeScript Foundations",
          desc: "Master responsive HTML5/CSS layouts, JavaScript event models, and strict TypeScript types.",
        };
      } else if (phaseNumber === 2) {
        return {
          title: "Phase 2: Full-Stack APIs & Relational Persistence",
          desc: "Build robust REST APIs, normalized SQL database schemas, and data validation layers.",
        };
      } else {
        return {
          title: "Phase 3: Production Deployment, Auth & End-to-End Integration",
          desc: "Implement JWT/OAuth2 security, containerized deployment, and full-stack integration tests.",
        };
      }
    }

    if (pathDef.id === "systems_cpp_engineer") {
      if (phaseNumber === 1) {
        return {
          title: "Phase 1: Modern C++ & Memory Safety Foundations",
          desc: "Master RAII, pointers/references, memory layouts, and modern C++ standard library.",
        };
      } else if (phaseNumber === 2) {
        return {
          title: "Phase 2: Algorithmic Complexity & Concurrent Systems",
          desc: "Implement cache-friendly data structures, multithreading, and low-latency algorithms.",
        };
      } else {
        return {
          title: "Phase 3: High-Throughput Systems Architecture & Benchmarking",
          desc: "Build production systems projects with automated testing, profiling, and OS-level optimizations.",
        };
      }
    }

    if (pathDef.id === "cybersecurity_defensive_redteam") {
      if (phaseNumber === 1) {
        return {
          title: "Phase 1: Ethical Security Scope, Linux & Network Inspection",
          desc: "Establish authorized sandbox lab boundaries, packet capture, and network analysis.",
        };
      } else if (phaseNumber === 2) {
        return {
          title: "Phase 2: Threat Modeling, OWASP Analysis & Secure Code Auditing",
          desc: "Analyze attack surfaces using STRIDE, review source code for vulnerabilities, and remediate flaws.",
        };
      } else {
        return {
          title: "Phase 3: Vulnerability Assessment, Defense-in-Depth & CTF Methodology",
          desc: "Conduct diagnostic scanning, implement security headers, and complete defensive CTF labs.",
        };
      }
    }

    if (pathDef.id === "backend_web_product_node") {
      if (phaseNumber === 1) {
        return {
          title: "Phase 1: TypeScript & Asynchronous Node.js Foundations",
          desc: "Master strict TypeScript type systems, event loop mechanics, and streaming data.",
        };
      } else if (phaseNumber === 2) {
        return {
          title: "Phase 2: Fastify API Architecture & Relational Persistence with Prisma",
          desc: "Build production REST APIs with schema validation and type-safe database migrations.",
        };
      } else {
        return {
          title: "Phase 3: Real-Time WebSockets, Redis Caching & Cloud Deployments",
          desc: "Implement bi-directional event streaming, distributed caching, and containerized deployment.",
        };
      }
    }

    if (pathDef.id === "backend_python_cloud") {
      if (phaseNumber === 1) {
        return {
          title: "Phase 1: Python Foundations & AsyncIO Concurrency Architecture",
          desc: "Master modern Python type hints, async event loops, and Pydantic V2 data validation.",
        };
      } else if (phaseNumber === 2) {
        return {
          title: "Phase 2: FastAPI Microservices & SQLAlchemy Persistence",
          desc: "Build high-throughput asynchronous APIs with relational database sessions and Alembic migrations.",
        };
      } else {
        return {
          title: "Phase 3: Distributed Task Queues, Redis Workers & Cloud Deployments",
          desc: "Implement background celery worker queues, resilient error retries, and cloud containerization.",
        };
      }
    }

    // Default: backend_enterprise_java
    if (phaseNumber === 1) {
      return {
        title: "Phase 1: Core Java Runtime & Relational Modeling Foundations",
        desc: "Master JVM memory mechanics, OOP design patterns, and 3NF SQL database modeling.",
      };
    } else if (phaseNumber === 2) {
      return {
        title: "Phase 2: Spring Boot Microservices & JPA Persistence Architecture",
        desc: "Build production-grade REST APIs with Spring Data JPA and automated Testcontainers suites.",
      };
    } else {
      return {
        title: "Phase 3: Enterprise Security, Distributed Caching & ERP State Machines",
        desc: "Implement OAuth2 role authorization, transactional workflows, and immutable audit logs.",
      };
    }
  }

  /**
   * Plans a dependency-safe sequence of milestones with effort estimates, resources, and practical projects.
   */
  public planMilestones(
    pathDef: PathDefinition,
    gapResults: SkillGapAnalysisResult[],
    preferences: LearnerPreferences,
    constraints: LearnerConstraints,
    profileId: string
  ): Roadmap {
    const weeklyHours = constraints.hoursPerWeek || 8;
    const activeGaps = gapResults.filter((g) => g.gap > 0 || g.status === "claimed_unverified");

    // Group gaps into 3-4 logical milestone phases
    const milestoneGroups: { title: string; desc: string; gaps: SkillGapAnalysisResult[] }[] = [];

    // Phase 1: Core Foundations & Framework Fundamentals (level 1-2)
    // Phase 1: Core Foundations & Framework Fundamentals (level 1-2)
    const phase1Gaps = activeGaps.filter((g) => g.skill.level <= 2);
    if (phase1Gaps.length > 0) {
      const meta = this.getPhaseDetails(pathDef, 1);
      milestoneGroups.push({
        title: meta.title,
        desc: meta.desc,
        gaps: phase1Gaps,
      });
    }

    // Phase 2: Persistence, Services, Threat Modeling & Framework Mastery (level 3 core)
    const phase2Gaps = activeGaps.filter(
      (g) =>
        g.skill.level === 3 &&
        (g.skill.domain === "databases" ||
          g.skill.domain.includes("ecosystem") ||
          g.skill.domain === "networking" ||
          g.skill.domain === "devops" ||
          g.skill.domain === "quality" ||
          (pathDef.id === "cybersecurity_defensive_redteam" &&
            (g.skillId === "threat_modeling_owasp" ||
              g.skillId === "secure_code_review" ||
              g.skillId === "web_security_mechanisms")))
    );
    if (phase2Gaps.length > 0) {
      const meta = this.getPhaseDetails(pathDef, 2);
      milestoneGroups.push({
        title: meta.title,
        desc: meta.desc,
        gaps: phase2Gaps,
      });
    }

    // Phase 3: Security, Enterprise Workflows & Hardening (level 3-4 advanced/specialized)
    const phase3Gaps = activeGaps.filter((g) => !phase1Gaps.includes(g) && !phase2Gaps.includes(g));
    if (phase3Gaps.length > 0) {
      const meta = this.getPhaseDetails(pathDef, 3);
      milestoneGroups.push({
        title: meta.title,
        desc: meta.desc,
        gaps: phase3Gaps,
      });
    }

    // If grouping was empty, create at least one milestone from active gaps
    if (milestoneGroups.length === 0 && activeGaps.length > 0) {
      const meta = this.getPhaseDetails(pathDef, 1);
      milestoneGroups.push({
        title: meta.title,
        desc: meta.desc,
        gaps: activeGaps,
      });
    }

    // Build Milestones
    let currentOrder = 1;
    let cumulativeHours = 0;
    const milestones: Milestone[] = [];

    for (const group of milestoneGroups) {
      const groupSkillIds = group.gaps.map((g) => g.skillId);
      const isDiagnosticRequired = group.gaps.some((g) => g.isDiagnosticNeeded);

      // Estimate hours: ~8-12h per skill gap
      const groupHours = Math.max(10, group.gaps.length * 10);
      cumulativeHours += groupHours;
      const groupWeeks = Number((groupHours / weeklyHours).toFixed(1));

      // Gather & rank resources
      let matchedResources = SEEDED_RESOURCES.filter((r) => groupSkillIds.includes(r.skillId));
      if (matchedResources.length === 0) {
        // Fallback: match by path title/domain
        matchedResources = SEEDED_RESOURCES.filter(
          (r) =>
            (r.languageOrDomainMatch &&
              pathDef.title.toLowerCase().includes(r.languageOrDomainMatch.toLowerCase())) ||
            (r.description && pathDef.domain.toLowerCase().includes(r.description.toLowerCase()))
        );
      }
      if (matchedResources.length === 0) {
        matchedResources = SEEDED_RESOURCES.filter((r) => groupSkillIds.includes(r.skillId));
      }

      const scoredResources = this.scorer.scoreAndRankResources(
        matchedResources,
        groupSkillIds[0] || pathDef.id,
        preferences
      );

      // Match practical project: Priority 1 - same domain & matching skill IDs
      let matchedProject = SEEDED_PROJECTS.find(
        (p) =>
          (p.domainContext.toLowerCase().includes(pathDef.domain.toLowerCase()) ||
            pathDef.domain.toLowerCase().includes(p.domainContext.toLowerCase()) ||
            pathDef.title.toLowerCase().includes(p.domainContext.toLowerCase()) ||
            p.domainContext.toLowerCase().includes(pathDef.title.toLowerCase())) &&
          p.targetSkillIds.some((s) => groupSkillIds.includes(s))
      );

      if (!matchedProject) {
        // Priority 2: Exact skill match across all projects
        matchedProject = SEEDED_PROJECTS.find((p) =>
          p.targetSkillIds.some((s) => groupSkillIds.includes(s))
        );
      }

      if (!matchedProject) {
        // Priority 3: Match by domainContext or path title
        matchedProject = SEEDED_PROJECTS.find(
          (p) =>
            p.domainContext.toLowerCase().includes(pathDef.domain.toLowerCase()) ||
            pathDef.title.toLowerCase().includes(p.domainContext.toLowerCase())
        );
      }

      if (!matchedProject) {
        matchedProject = SEEDED_PROJECTS[0];
      }

      const status: MilestoneStatus = currentOrder === 1 ? "in_progress" : "locked";

      milestones.push({
        id: `ms_${pathDef.id}_${currentOrder}`,
        order: currentOrder,
        title: group.title,
        description: group.desc,
        skillIds: groupSkillIds,
        prerequisiteSkillIds: currentOrder === 1 ? [] : milestones[currentOrder - 2].skillIds,
        status,
        isDiagnosticRequired,
        diagnosticAssessmentId: isDiagnosticRequired ? `diag_${groupSkillIds[0]}` : undefined,
        estimatedHours: groupHours,
        estimatedWeeks: groupWeeks,
        resources: scoredResources.slice(0, 3),
        project: matchedProject || null,
        completionCriteria: [
          `Complete hands-on module assignments for: ${group.gaps.map((g) => g.skill.title).join(", ")}.`,
          `Implement and verify practical project deliverables with automated tests.`,
          `Pass milestone verification criteria.`,
        ],
        explanation: `Targets ${group.gaps.length} competency gap(s). Prioritized by prerequisite dependencies and role requirements.`,
      });

      currentOrder++;
    }

    const totalWeeks = Number((cumulativeHours / weeklyHours).toFixed(1));

    return {
      id: `roadmap_${pathDef.id}_${Date.now()}`,
      version: 1,
      profileId,
      targetPathId: pathDef.id,
      targetPathTitle: pathDef.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isStale: false,
      totalEstimatedHours: cumulativeHours,
      totalEstimatedWeeks: totalWeeks,
      weeklyPaceHours: weeklyHours,
      milestones,
      nextBestAction: null, // Computed by NBA service
      assumptions: pathDef.defaultAssumptions,
      warnings:
        constraints.hoursPerWeek < 5
          ? ["Low weekly time budget (<5h/week) will substantially extend roadmap completion time."]
          : [],
    };
  }
}
