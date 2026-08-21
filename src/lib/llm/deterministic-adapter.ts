import {
  IntentExtractionPort,
  QuestionProposalPort,
  RoadmapExplanationPort,
  IntakeContext,
  QuestionContext,
  ExplanationContext,
} from "./ports";
import {
  IntentExtractionResult,
  QuestionProposalResult,
  RoadmapExplanationResult,
} from "../contracts";

export class DeterministicLlmAdapter
  implements IntentExtractionPort, QuestionProposalPort, RoadmapExplanationPort
{
  /**
   * Deterministically extracts facts, unknown dimensions, and potential contradictions from natural language.
   */
  public async extract(context: IntakeContext): Promise<IntentExtractionResult> {
    const text = context.message.toLowerCase();
    const facts: IntentExtractionResult["facts"] = [];
    const unknownDimensions: string[] = [];
    let detectedGoal: string | undefined;
    let targetRoleHint: string | undefined;

    // 1. Goal Detection
    if (text.includes("devops") || text.includes("cloud") || text.includes("infrastructure") || text.includes("sre") || text.includes("kubernetes") || text.includes("docker")) {
      detectedGoal = "DevOps & Cloud Platform Infrastructure Engineer";
      facts.push({
        dimension: "declared_goal",
        value: "devops_cloud_engineer",
        rawValue: "DevOps & Cloud Platform Infrastructure Engineer",
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
      facts.push({
        dimension: "target_domain",
        value: "Cloud Infrastructure & DevOps CI/CD",
        rawValue: "Cloud Infrastructure",
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
      facts.push({
        dimension: "architecture_preference",
        value: "Container Orchestration & Cloud Infrastructure as Code",
        rawValue: "Cloud Infrastructure as Code",
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
    } else if (text.includes("fullstack") || text.includes("full stack") || text.includes("react")) {
      detectedGoal = "Full-Stack Web Software Engineer";
      facts.push({
        dimension: "declared_goal",
        value: "fullstack_software_engineer",
        rawValue: "Full-Stack Web Software Engineer",
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
    } else if (text.includes("c++") || text.includes("systems") || text.includes("embedded") || text.includes("game engine")) {
      detectedGoal = "Systems & High-Performance C++ Engineer";
      facts.push({
        dimension: "declared_goal",
        value: "systems_cpp_engineer",
        rawValue: "Systems & High-Performance C++ Engineer",
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
    } else if (text.includes("backend") || text.includes("back-end")) {
      detectedGoal = "Backend Software Engineering";
      facts.push({
        dimension: "declared_goal",
        value: "backend_engineering",
        rawValue: context.message,
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
    } else if (text.includes("red team") || text.includes("cybersecurity") || text.includes("security")) {
      detectedGoal = "Ethical Cybersecurity & Defensive Red-Teaming";
      facts.push({
        dimension: "declared_goal",
        value: "cybersecurity_defensive",
        rawValue: context.message,
        evidence: context.message,
        reliability: 0.95,
        impact: "high",
      });
    }

    // 2. Skill & Knowledge Extraction
    if (text.includes("http") || text.includes("rest")) {
      facts.push({
        dimension: "known_skills",
        value: { skill: "http_rest_protocols", level: "working" },
        rawValue: "HTTP & REST APIs",
        evidence: "Mentioned knowledge of HTTP/REST",
        reliability: 0.9,
        impact: "medium",
      });
    }

    // 3. Language Extraction
    if (text.includes("java") && !text.includes("javascript")) {
      facts.push({
        dimension: "primary_language",
        value: "Java",
        rawValue: "Java (Proficient / Stated)",
        evidence: "Explicitly specified Java as language",
        reliability: 0.98,
        impact: "high",
      });
    } else if (text.includes("typescript") || text.includes("javascript") || text.includes("node")) {
      facts.push({
        dimension: "primary_language",
        value: "TypeScript / Node.js",
        rawValue: "TypeScript / Node.js",
        evidence: "Specified TypeScript/Node.js",
        reliability: 0.98,
        impact: "high",
      });
    } else if (text.includes("python") || text.includes("fastapi")) {
      facts.push({
        dimension: "primary_language",
        value: "Python",
        rawValue: "Python",
        evidence: "Specified Python",
        reliability: 0.98,
        impact: "high",
      });
    }

    // 4. Domain & Specialization Extraction
    if (text.includes("erp") || text.includes("enterprise") || text.includes("banking") || text.includes("fintech")) {
      facts.push({
        dimension: "target_domain",
        value: "Enterprise Systems & ERP",
        rawValue: "Enterprise / ERP",
        evidence: "Specified Enterprise/ERP domain",
        reliability: 0.95,
        impact: "high",
      });
      targetRoleHint = "Enterprise Java Backend Engineer";
    } else if (text.includes("saas") || text.includes("web product") || text.includes("startup")) {
      facts.push({
        dimension: "target_domain",
        value: "SaaS Web Products",
        rawValue: "SaaS Web Products",
        evidence: "Specified SaaS/Web Product domain",
        reliability: 0.95,
        impact: "high",
      });
    }

    // 5. Architecture Preference
    if (text.includes("microservice") || text.includes("distributed")) {
      facts.push({
        dimension: "architecture_preference",
        value: "Microservices & Distributed Systems",
        rawValue: "Microservices",
        evidence: "Preference for distributed microservices",
        reliability: 0.9,
        impact: "medium",
      });
    } else if (text.includes("monolith") || text.includes("transactional")) {
      facts.push({
        dimension: "architecture_preference",
        value: "Transactional Enterprise Architecture",
        rawValue: "Enterprise Architecture",
        evidence: "Preference for transactional architectures",
        reliability: 0.9,
        impact: "medium",
      });
    }

    // 6. Time constraints
    const hoursMatch = text.match(/(\d+)\s*(hours|hrs)/i);
    if (hoursMatch) {
      const hrs = parseInt(hoursMatch[1], 10);
      facts.push({
        dimension: "hours_per_week",
        value: hrs,
        rawValue: `${hrs} hours/week`,
        evidence: `Mentioned ${hrs} hours per week`,
        reliability: 1.0,
        impact: "high",
      });
    }

    // 7. Cybersecurity Ethical Confirmation
    if (text.includes("authorized") || text.includes("ethical") || text.includes("lab only") || text.includes("defensive")) {
      facts.push({
        dimension: "ethical_scope_confirmed",
        value: "confirmed",
        rawValue: "Authorized Lab Scope Confirmed",
        evidence: "Learner explicitly confirmed authorized/defensive scope",
        reliability: 1.0,
        impact: "high",
      });
    }

    // Check what is still unknown
    const activeDims = new Set([
      ...context.existingFacts.map((f) => f.dimension.toLowerCase()),
      ...facts.map((f) => f.dimension.toLowerCase()),
    ]);

    if (!activeDims.has("primary_language")) unknownDimensions.push("primary_language");
    if (!activeDims.has("target_domain")) unknownDimensions.push("target_domain");
    if (!activeDims.has("architecture_preference")) unknownDimensions.push("architecture_preference");
    if (!activeDims.has("hours_per_week")) unknownDimensions.push("hours_per_week");

    return {
      facts,
      detectedGoal,
      targetRoleHint,
      unknownDimensions,
      contradictions: [],
      clarificationNeeded: unknownDimensions.length > 0,
    };
  }

  /**
   * Deterministically proposes candidate clarification questions based on missing dimensions.
   */
  public async proposeQuestions(context: QuestionContext): Promise<QuestionProposalResult> {
    const candidates: QuestionProposalResult["candidates"] = [];
    const unknown = context.unknownDimensions.map((d) => d.toLowerCase());

    const isSecurityTrack = context.currentHypotheses.some(
      (h) => h.pathId === "cybersecurity_defensive_redteam" && h.posteriorProbability > 0.4
    );

    if (isSecurityTrack) {
      if (unknown.includes("ethical_scope_confirmed") || !context.existingFacts.some((f) => f.dimension === "ethical_scope_confirmed")) {
        candidates.push({
          dimension: "ethical_scope_confirmed",
          question:
            "Do you confirm that all hands-on exercises and vulnerability assessments will strictly take place within authorized, isolated sandbox labs?",
          answerType: "single_choice",
          options: [
            "Yes, I confirm all practice will be in authorized defensive labs",
            "I need more information about lab requirements",
          ],
          why: "Safety and ethics compliance: We mandate isolated sandbox environments for all security training.",
          predictedAnswerBuckets: ["confirmed", "unconfirmed"],
        });
      }
      if (unknown.includes("prior_technical_experience")) {
        candidates.push({
          dimension: "prior_technical_experience",
          question: "What is your current background in Linux and computer networking?",
          answerType: "single_choice",
          options: [
            "Strong Linux and TCP/IP networking foundation",
            "Basic Linux command line, intermediate networking",
            "Beginner in both Linux and networking",
          ],
          why: "Determines whether foundational networking and packet inspection modules must precede threat modeling.",
          predictedAnswerBuckets: ["strong", "intermediate", "beginner"],
        });
      }
    }

    if (unknown.includes("primary_language")) {
      candidates.push({
        dimension: "primary_language",
        question: "Which programming languages are you already comfortable with?",
        answerType: "single_choice",
        options: [
          "Java (OOP, Streams, Collections)",
          "TypeScript / JavaScript (Node.js)",
          "Python (Modern async / type hints)",
          "C# / .NET",
          "Go (Golang)",
          "Not sure yet / Open to suggestions",
        ],
        why: "Language proficiency is the primary branching factor for backend career roadmaps.",
        predictedAnswerBuckets: ["java", "typescript", "python", "dotnet", "go", "unknown"],
      });
    }

    if (unknown.includes("target_domain")) {
      candidates.push({
        dimension: "target_domain",
        question: "Which industry or domain of backend engineering appeals to you most?",
        answerType: "single_choice",
        options: [
          "Enterprise Systems, ERP & Financial Workflows (High reliability & consistency)",
          "Modern SaaS Web Products & Consumer Platforms (Fast iteration)",
          "Cloud Data Pipelines, AI Backends & Async Services",
          "Infrastructure & Developer Tooling",
          "Not sure yet / Explore backend options",
        ],
        why: "Specialization determines whether your roadmap focuses on transactional ERP state machines, high-throughput web APIs, or data streaming.",
        predictedAnswerBuckets: ["enterprise_erp", "saas_web", "cloud_data", "infra", "unknown"],
      });
    }

    if (unknown.includes("architecture_preference")) {
      candidates.push({
        dimension: "architecture_preference",
        question: "What style of system architecture would you like to master?",
        answerType: "single_choice",
        options: [
          "Modular Monoliths & Robust Transactional Domain Models",
          "Microservices, Event-Driven Systems & Message Queues",
          "High-Throughput Serverless & Edge APIs",
          "Not sure yet / Start with fundamentals",
        ],
        why: "Shapes the architectural design patterns and hands-on capstone projects in your roadmap.",
        predictedAnswerBuckets: ["modular_monolith", "microservices", "serverless", "unknown"],
      });
    }

    if (unknown.includes("hours_per_week")) {
      candidates.push({
        dimension: "hours_per_week",
        question: "How many hours per week can you consistently commit to learning?",
        answerType: "single_choice",
        options: [
          "4-6 hours/week (Paced learning)",
          "8-12 hours/week (Standard recommendation)",
          "15-20+ hours/week (Accelerated bootcamp pace)",
          "Not sure yet / Flexible schedule",
        ],
        why: "Calibrates realistic milestone timelines and weekly deliverable pacing.",
        predictedAnswerBuckets: ["4_6_hours", "8_12_hours", "15_20_hours", "unknown"],
      });
    }

    if (unknown.includes("prior_technical_experience")) {
      candidates.push({
        dimension: "prior_technical_experience",
        question: "What is your current technical background and experience level?",
        answerType: "single_choice",
        options: [
          "Computer Science degree or professional developer experience",
          "Self-taught with several completed projects and basic git/CLI",
          "Complete beginner to programming and backend systems",
          "Not sure yet / Mixed background",
        ],
        why: "Determines whether foundational CS, data structures, and terminal concepts must precede framework learning.",
        predictedAnswerBuckets: ["professional", "intermediate", "beginner", "unknown"],
      });
    }

    // Default fallback candidate if no specific unknown dimension matched
    if (candidates.length === 0) {
      candidates.push({
        dimension: "primary_language",
        question: "Which primary programming language do you want to build on?",
        answerType: "single_choice",
        options: [
          "Java (Spring Boot / Enterprise)",
          "TypeScript / Node.js (Web APIs)",
          "Python (FastAPI / Cloud / AI Data)",
          "Go (Golang / High Throughput)",
        ],
        why: "Primary language is the core foundation for backend architecture and tooling.",
        predictedAnswerBuckets: ["java", "typescript", "python", "go"],
      });
      candidates.push({
        dimension: "target_domain",
        question: "Which industry or domain of systems engineering appeals to you most?",
        answerType: "single_choice",
        options: [
          "Enterprise Systems, ERP & Financial Workflows",
          "Modern SaaS Web Products & Consumer Platforms",
          "Cloud Data Pipelines, AI Backends & Async Services",
          "Defensive Cybersecurity & Penetration Testing Labs",
        ],
        why: "Specialization determines milestone architecture patterns and project deliverables.",
        predictedAnswerBuckets: ["enterprise_erp", "saas_web", "cloud_data", "security"],
      });
    }

    return { candidates };
  }

  /**
   * Generates a clear, explainable summary for the generated roadmap.
   */
  public async explainRoadmap(context: ExplanationContext): Promise<RoadmapExplanationResult> {
    const { roadmap } = context;
    return {
      selectedPathId: roadmap.targetPathId,
      assumptions: roadmap.assumptions,
      milestoneExplanations: roadmap.milestones.map((m) => ({
        skillId: m.skillIds[0] || "general",
        why: m.explanation,
      })),
      warnings: roadmap.warnings,
    };
  }
}
