import { PathHypothesis, ProfileFact } from "../../contracts";
import { SEEDED_PATHS, PathDefinition } from "../../persistence/seed-data";
import { pathCompatibilityGate } from "./path-compatibility-gate";

export interface HypothesisUpdateResult {
  hypotheses: PathHypothesis[];
  topPath: PathHypothesis | null;
}

export class HypothesisEngine {
  private paths: PathDefinition[];

  constructor(paths: PathDefinition[] = SEEDED_PATHS) {
    this.paths = paths;
  }

  /**
   * Recalculates posterior probabilities for all target path hypotheses using stored facts.
   * Enforces a hard eligibility boundary via PathCompatibilityGate:
   * 1. Rejects incompatible / unsupported candidates.
   * 2. Ranks remaining eligible candidates using Bayesian evidence scoring.
   * 3. Normalizes via softmax among eligible paths.
   */
  public updateHypotheses(facts: ProfileFact[]): HypothesisUpdateResult {
    const activeFacts = facts.filter((f) => f.status === "active");
    const numPaths = this.paths.length;
    const defaultPrior = 1.0 / numPaths;

    // 1. Evaluate hard eligibility gate
    const compatibilityEval = pathCompatibilityGate.evaluateIntentCompatibility(activeFacts, this.paths);
    const eligiblePathIds = new Set(compatibilityEval.eligiblePaths.map((p) => p.id));
    const compatResultMap = new Map(compatibilityEval.results.map((r) => [r.pathId, r]));

    // 2. If intent is completely unsupported, no path can be eligible -> topPath = null
    if (!compatibilityEval.isIntentSupported || compatibilityEval.eligiblePaths.length === 0) {
      const unsupportedReason =
        compatibilityEval.unsupportedReason || "Requested career track is not currently supported in the catalog.";

      const hypotheses: PathHypothesis[] = this.paths.map((path) => ({
        pathId: path.id,
        pathTitle: path.title,
        priorProbability: defaultPrior,
        posteriorProbability: 0.0,
        supportEvidenceCount: 0,
        rationale: `Unsupported: ${unsupportedReason}`,
      }));

      return {
        hypotheses,
        topPath: null,
      };
    }

    // 3. Calculate raw log-scores ONLY for eligible paths
    const rawScores: { path: PathDefinition; rawScore: number; supportCount: number; rationales: string[] }[] = [];

    for (const path of compatibilityEval.eligiblePaths) {
      let rawScore = Math.log(Math.max(defaultPrior, 0.0001));
      let supportCount = 0;
      const rationales: string[] = [];

      const compat = compatResultMap.get(path.id);
      if (compat && compat.matchedSignals.length > 0) {
        rationales.push(...compat.matchedSignals);
      }

      for (const fact of activeFacts) {
        const { relevance, polarity, explanation } = this.evaluateFactEvidence(fact, path);

        if (relevance > 0) {
          const evidenceDelta = fact.reliability * relevance * polarity;
          rawScore += evidenceDelta;

          if (polarity > 0) {
            supportCount++;
            if (explanation && !rationales.includes(explanation)) rationales.push(explanation);
          } else if (polarity < 0) {
            if (explanation) rationales.push(`Contradiction: ${explanation}`);
          }
        }
      }

      rawScores.push({ path, rawScore, supportCount, rationales });
    }

    // 4. Softmax normalization across eligible paths only
    const maxRaw = Math.max(...rawScores.map((s) => s.rawScore));
    const expScores = rawScores.map((s) => ({
      ...s,
      expVal: Math.exp(s.rawScore - maxRaw),
    }));
    const totalExp = expScores.reduce((sum, s) => sum + s.expVal, 0);

    const eligibleHypotheses: PathHypothesis[] = expScores.map((s) => {
      const posterior = totalExp > 0 ? s.expVal / totalExp : 1 / rawScores.length;
      return {
        pathId: s.path.id,
        pathTitle: s.path.title,
        priorProbability: defaultPrior,
        posteriorProbability: Number(posterior.toFixed(4)),
        supportEvidenceCount: s.supportCount,
        rationale:
          s.rationales.length > 0
            ? s.rationales.slice(0, 3).join("; ")
            : s.path.description,
      };
    });

    // Format ineligible paths with 0 posterior probability
    const ineligibleHypotheses: PathHypothesis[] = this.paths
      .filter((p) => !eligiblePathIds.has(p.id))
      .map((path) => {
        const compat = compatResultMap.get(path.id);
        return {
          pathId: path.id,
          pathTitle: path.title,
          priorProbability: defaultPrior,
          posteriorProbability: 0.0,
          supportEvidenceCount: 0,
          rationale: compat?.hardConflicts.join("; ") || "Incompatible with learner intent",
        };
      });

    // Combine and sort descending by posterior probability
    const allHypotheses = [...eligibleHypotheses, ...ineligibleHypotheses];
    allHypotheses.sort((a, b) => b.posteriorProbability - a.posteriorProbability);

    return {
      hypotheses: allHypotheses,
      topPath: eligibleHypotheses.length > 0 ? allHypotheses[0] : null,
    };
  }

  /**
   * Computes relevance and polarity (-1 to +1) of a fact relative to a specific path hypothesis.
   */
  private evaluateFactEvidence(
    fact: ProfileFact,
    path: PathDefinition
  ): { relevance: number; polarity: number; explanation?: string } {
    const dim = fact.dimension.toLowerCase();
    const val = typeof fact.normalizedValue === "string" ? fact.normalizedValue.toLowerCase() : JSON.stringify(fact.normalizedValue).toLowerCase();

    // Language & Known Skills evaluation
    if (
      dim === "primary_language" ||
      dim === "languages" ||
      dim === "known_skills" ||
      dim === "skills" ||
      dim === "technical_background"
    ) {
      if (path.id === "systems_cpp_engineer") {
        if (val.includes("c++") || val.includes("cpp") || val.includes("c / c++") || val.includes("c language") || val.includes("rust")) {
          return { relevance: 3.0, polarity: 1.0, explanation: "Stated C++ / Systems proficiency strongly supports C++ Systems Engineering." };
        }
      }

      if (path.id === "fullstack_software_engineer") {
        if (
          val.includes("html") ||
          val.includes("css") ||
          val.includes("javascript") ||
          val.includes("typescript") ||
          val.includes("react") ||
          val.includes("web") ||
          val.includes("full stack") ||
          val.includes("fullstack")
        ) {
          return { relevance: 2.5, polarity: 1.0, explanation: "Web skills (HTML/CSS/JS/TS) align directly with Full-Stack Engineering." };
        }
      }

      if (path.id === "vlsi_design_engineer") {
        if (
          val.includes("verilog") ||
          val.includes("systemverilog") ||
          val.includes("vhdl") ||
          val.includes("chisel") ||
          val.includes("hdl") ||
          val.includes("fpga") ||
          val.includes("asic") ||
          val.includes("rtl") ||
          val.includes("sta") ||
          val.includes("uvm")
        ) {
          return { relevance: 3.0, polarity: 1.0, explanation: "Stated HDL / VLSI skills directly align with Digital IC & VLSI Design." };
        }
      }

      if (path.id === "backend_enterprise_java") {
        if (val.includes("java") && !val.includes("javascript")) {
          return { relevance: 2.2, polarity: 1.0, explanation: "Stated Java proficiency supports Enterprise Java." };
        } else if (val.includes("python") || val.includes("node") || val.includes("typescript") || val.includes("c++")) {
          return { relevance: 2.0, polarity: -1.0, explanation: "Focuses on non-Java ecosystem." };
        }
      } else if (path.id === "backend_web_product_node") {
        if (val.includes("javascript") || val.includes("typescript") || val.includes("node")) {
          return { relevance: 2.2, polarity: 1.0, explanation: "TypeScript/JavaScript proficiency aligns with Node.js path." };
        }
      } else if (path.id === "backend_python_cloud") {
        if (val.includes("python")) {
          return { relevance: 2.2, polarity: 1.0, explanation: "Python proficiency aligns with Python Cloud path." };
        }
      } else if (path.id === "devops_cloud_engineer") {
        if (val.includes("docker") || val.includes("kubernetes") || val.includes("linux") || val.includes("cloud") || val.includes("devops") || val.includes("ci/cd")) {
          return { relevance: 2.5, polarity: 1.0, explanation: "DevOps & Cloud competencies match Platform Infrastructure track." };
        }
      }
    }

    // Domain evaluation
    if (dim === "target_domain" || dim === "domain" || dim === "industry" || dim === "specialization_focus") {
      if (path.id === "vlsi_design_engineer") {
        if (
          val.includes("vlsi") ||
          val.includes("semiconductor") ||
          val.includes("chip") ||
          val.includes("hardware") ||
          val.includes("asic") ||
          val.includes("fpga") ||
          val.includes("rtl") ||
          val.includes("digital logic") ||
          val.includes("microarchitecture")
        ) {
          return { relevance: 3.0, polarity: 1.0, explanation: "VLSI, ASIC, FPGA, and Semiconductor Hardware domain." };
        }
      } else if (path.id === "systems_cpp_engineer") {
        if (val.includes("system") || val.includes("c++") || val.includes("performance") || val.includes("game") || val.includes("embedded") || val.includes("hardware")) {
          return { relevance: 2.8, polarity: 1.0, explanation: "Systems, performance, and low-level architecture domain." };
        }
      } else if (path.id === "fullstack_software_engineer") {
        if (val.includes("full") || val.includes("web") || val.includes("frontend") || val.includes("applications") || val.includes("saas") || val.includes("enterprise")) {
          return { relevance: 2.8, polarity: 1.0, explanation: "Full-Stack Web and Product Applications domain." };
        }
      } else if (path.id === "devops_cloud_engineer") {
        if (val.includes("devops") || val.includes("infra") || val.includes("platform") || val.includes("sre") || val.includes("kubernetes")) {
          return { relevance: 2.8, polarity: 1.0, explanation: "DevOps Infrastructure and Cloud Platform domain." };
        }
      } else if (path.id === "backend_enterprise_java") {
        if (val.includes("erp") || val.includes("enterprise") || val.includes("banking") || val.includes("fintech") || val.includes("business")) {
          return { relevance: 2.5, polarity: 1.0, explanation: "Enterprise / ERP / Banking domain targets enterprise software architecture." };
        }
      } else if (path.id === "backend_web_product_node") {
        if (val.includes("saas") || val.includes("web") || val.includes("product") || val.includes("startup") || val.includes("consumer") || val.includes("enterprise")) {
          return { relevance: 2.5, polarity: 1.0, explanation: "SaaS / Web Product / Enterprise focus aligns with Node.js web services." };
        }
      } else if (path.id === "backend_python_cloud") {
        if (val.includes("cloud") || val.includes("data") || val.includes("ai") || val.includes("async") || val.includes("analytics") || val.includes("enterprise")) {
          return { relevance: 2.5, polarity: 1.0, explanation: "Cloud / Data / Enterprise domain targets Python backend services." };
        }
      } else if (path.id === "cybersecurity_defensive_redteam") {
        if (val.includes("security") || val.includes("cyber") || val.includes("red team") || val.includes("defensive") || val.includes("penetration") || val.includes("ethical")) {
          return { relevance: 3.0, polarity: 1.0, explanation: "Explicit cybersecurity / security interest matches defensive security track." };
        }
      }
    }

    // Architecture preference
    if (dim === "architecture_preference") {
      if (path.id === "devops_cloud_engineer" && (val.includes("infra") || val.includes("container") || val.includes("cloud") || val.includes("orchestration") || val.includes("ci/cd") || val.includes("devops"))) {
        return { relevance: 2.2, polarity: 1.0, explanation: "Cloud Infrastructure as Code & Container Orchestration architecture preference." };
      }
      if (path.id === "systems_cpp_engineer" && (val.includes("systems") || val.includes("low-level") || val.includes("memory") || val.includes("concurrency"))) {
        return { relevance: 2.2, polarity: 1.0, explanation: "Low-level Systems & Concurrency architecture preference." };
      }
      if (path.id === "backend_enterprise_java" && (val.includes("enterprise") || val.includes("monolith") || val.includes("transactional"))) {
        return { relevance: 1.8, polarity: 1.0, explanation: "Transactional enterprise architecture preference." };
      }
      if (path.id === "backend_web_product_node" && (val.includes("microservices") || val.includes("api") || val.includes("realtime") || val.includes("monolith"))) {
        return { relevance: 1.8, polarity: 1.0, explanation: "Microservices / API architecture preference." };
      }
      if (path.id === "fullstack_software_engineer" && (val.includes("full") || val.includes("client-server") || val.includes("spa") || val.includes("monorepo"))) {
        return { relevance: 1.8, polarity: 1.0, explanation: "End-to-end full stack architecture preference." };
      }
    }

    // Goal text keyword hints
    if (dim === "goal" || dim === "declared_goal") {
      if (val.includes("red team") || val.includes("security") || val.includes("ethical hack")) {
        if (path.id === "cybersecurity_defensive_redteam") return { relevance: 2.5, polarity: 1.0, explanation: "Security goal declared." };
        return { relevance: 1.5, polarity: -0.8 };
      }
      if (val.includes("devops") || val.includes("cloud engineer") || val.includes("infrastructure engineer")) {
        if (path.id === "devops_cloud_engineer") return { relevance: 2.5, polarity: 1.0, explanation: "DevOps & Cloud career goal declared." };
        return { relevance: 1.5, polarity: -0.8 };
      }
      if (val.includes("software engineer") || val.includes("developer")) {
        if (path.id === "fullstack_software_engineer" || path.id === "systems_cpp_engineer" || path.id.startsWith("backend_")) {
          return { relevance: 1.0, polarity: 0.5, explanation: "Software Engineering career track." };
        }
      }
      if (val.includes("full stack") || val.includes("fullstack")) {
        if (path.id === "fullstack_software_engineer") return { relevance: 2.5, polarity: 1.0, explanation: "Full-Stack career goal declared." };
      }
      if (val.includes("backend")) {
        if (path.id.startsWith("backend_")) return { relevance: 1.2, polarity: 0.6, explanation: "General backend goal." };
      }
    }

    // Ethical scope confirmed (for cybersecurity)
    if (dim === "ethical_scope_confirmed") {
      if (path.id === "cybersecurity_defensive_redteam") {
        const isConfirmed = val === "true" || val === "yes" || val === "confirmed";
        return {
          relevance: 2.5,
          polarity: isConfirmed ? 1.0 : -1.0,
          explanation: isConfirmed ? "Authorized ethical lab scope confirmed." : "Ethical scope unconfirmed.",
        };
      }
    }

    return { relevance: 0, polarity: 0 };
  }
}

