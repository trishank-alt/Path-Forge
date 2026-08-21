import { PathHypothesis, ProfileFact } from "../../contracts";
import { SEEDED_PATHS, PathDefinition } from "../../persistence/seed-data";

export interface HypothesisUpdateResult {
  hypotheses: PathHypothesis[];
  topPath: PathHypothesis;
}

export class HypothesisEngine {
  private paths: PathDefinition[];

  constructor(paths: PathDefinition[] = SEEDED_PATHS) {
    this.paths = paths;
  }

  /**
   * Recalculates posterior probabilities for all target path hypotheses using stored facts.
   * raw(h) = log(prior(h)) + Σ reliability(e) × relevance(e, h) × polarity(e, h)
   * Normalized via softmax.
   */
  public updateHypotheses(facts: ProfileFact[]): HypothesisUpdateResult {
    const activeFacts = facts.filter((f) => f.status === "active");
    const numPaths = this.paths.length;
    const defaultPrior = 1.0 / numPaths; // Uniform prior initially

    // 1. Calculate raw log-scores for each path
    const rawScores: { path: PathDefinition; rawScore: number; supportCount: number; rationales: string[] }[] = [];

    for (const path of this.paths) {
      let rawScore = Math.log(Math.max(defaultPrior, 0.0001));
      let supportCount = 0;
      const rationales: string[] = [];

      for (const fact of activeFacts) {
        const { relevance, polarity, explanation } = this.evaluateFactEvidence(fact, path);

        if (relevance > 0) {
          const evidenceDelta = fact.reliability * relevance * polarity;
          rawScore += evidenceDelta;

          if (polarity > 0) {
            supportCount++;
            if (explanation) rationales.push(explanation);
          } else if (polarity < 0) {
            if (explanation) rationales.push(`Contradiction: ${explanation}`);
          }
        }
      }

      rawScores.push({ path, rawScore, supportCount, rationales });
    }

    // 2. Softmax normalization to get calibrated posterior probabilities
    const maxRaw = Math.max(...rawScores.map((s) => s.rawScore));
    const expScores = rawScores.map((s) => ({
      ...s,
      expVal: Math.exp(s.rawScore - maxRaw), // Numerical stability shift
    }));
    const totalExp = expScores.reduce((sum, s) => sum + s.expVal, 0);

    // 3. Format PathHypothesis objects
    const hypotheses: PathHypothesis[] = expScores.map((s) => {
      const posterior = totalExp > 0 ? s.expVal / totalExp : 1 / numPaths;
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

    // Sort descending by posterior probability
    hypotheses.sort((a, b) => b.posteriorProbability - a.posteriorProbability);

    return {
      hypotheses,
      topPath: hypotheses[0],
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

      if (path.id === "backend_enterprise_java") {
        if (val.includes("java") && !val.includes("javascript")) {
          return { relevance: 2.2, polarity: 1.0, explanation: "Stated Java proficiency supports Enterprise Java." };
        } else if (val.includes("python") || val.includes("node") || val.includes("typescript") || val.includes("c++")) {
          return { relevance: 1.0, polarity: -0.3, explanation: "Focuses on alternative language ecosystem." };
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
      if (path.id === "systems_cpp_engineer") {
        if (val.includes("system") || val.includes("c++") || val.includes("performance") || val.includes("game") || val.includes("embedded") || val.includes("hardware")) {
          return { relevance: 2.8, polarity: 1.0, explanation: "Systems, performance, and low-level architecture domain." };
        }
      } else if (path.id === "fullstack_software_engineer") {
        if (val.includes("full") || val.includes("web") || val.includes("frontend") || val.includes("applications") || val.includes("saas")) {
          return { relevance: 2.8, polarity: 1.0, explanation: "Full-Stack Web and Product Applications domain." };
        }
      } else if (path.id === "devops_cloud_engineer") {
        if (val.includes("devops") || val.includes("infra") || val.includes("platform") || val.includes("sre") || val.includes("kubernetes")) {
          return { relevance: 2.8, polarity: 1.0, explanation: "DevOps Infrastructure and Cloud Platform domain." };
        }
      } else if (path.id === "backend_enterprise_java") {
        if (val.includes("erp") || val.includes("enterprise") || val.includes("banking") || val.includes("fintech") || val.includes("business")) {
          return { relevance: 2.5, polarity: 1.0, explanation: "Enterprise / ERP / Banking domain directly targets Java enterprise architecture." };
        }
      } else if (path.id === "backend_web_product_node") {
        if (val.includes("saas") || val.includes("web") || val.includes("product") || val.includes("startup") || val.includes("consumer")) {
          return { relevance: 2.5, polarity: 1.0, explanation: "SaaS / Web Product focus aligns with Node.js web services." };
        }
      } else if (path.id === "backend_python_cloud") {
        if (val.includes("cloud") || val.includes("data") || val.includes("ai") || val.includes("async") || val.includes("analytics")) {
          return { relevance: 2.5, polarity: 1.0, explanation: "Cloud / Data / AI domain targets Python backend services." };
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
      if (path.id === "backend_web_product_node" && (val.includes("microservices") || val.includes("api") || val.includes("realtime"))) {
        return { relevance: 1.8, polarity: 1.0, explanation: "Microservices / real-time API preference." };
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
      if (val.includes("software engineer") || val.includes("developer")) {
        if (path.id === "fullstack_software_engineer" || path.id === "systems_cpp_engineer" || path.id.startsWith("backend_")) {
          return { relevance: 1.0, polarity: 0.5, explanation: "Software Engineering career track." };
        }
      }
      if (val.includes("devops") || val.includes("cloud engineer")) {
        if (path.id === "devops_cloud_engineer") return { relevance: 2.5, polarity: 1.0, explanation: "DevOps & Cloud career goal declared." };
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
