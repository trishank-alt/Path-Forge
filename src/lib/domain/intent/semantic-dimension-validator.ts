import { ALLOWED_QUESTION_DIMENSIONS, AllowedQuestionDimension } from "../../contracts";

export interface CareerRoleDetectionResult {
  isRole: boolean;
  roleName?: string;
  isExplicitChangeIntent: boolean;
}

export interface DimensionValidationResult {
  status: "valid" | "role_mismatch" | "explicit_goal_change" | "invalid_dimension" | "unknown";
  normalizedValue?: string | number | string[];
  proposedGoal?: string;
  reason?: string;
}

/**
 * Standard list of recognizable career roles to catch obvious cross-dimension mismatches.
 */
const KNOWN_CAREER_ROLE_PATTERNS: { pattern: RegExp; roleName: string }[] = [
  { pattern: /\b(mobile\s*app\s*developer|mobile\s*developer|mobile\s*engineer)\b/i, roleName: "Mobile App Developer" },
  { pattern: /\b(android\s*developer|android\s*engineer)\b/i, roleName: "Android Developer" },
  { pattern: /\b(ios\s*developer|ios\s*engineer)\b/i, roleName: "iOS Developer" },
  { pattern: /\b(flutter\s*developer|flutter\s*engineer)\b/i, roleName: "Flutter Developer" },
  { pattern: /\b(react\s*native\s*developer|react\s*native\s*engineer)\b/i, roleName: "React Native Developer" },
  { pattern: /\b(full[\s-]*stack\s*(?:software\s*)?(?:engineer|developer))\b/i, roleName: "Full-Stack Software Engineer" },
  { pattern: /\b(frontend\s*(?:software\s*)?(?:engineer|developer)|front[\s-]*end\s*(?:engineer|developer))\b/i, roleName: "Frontend Engineer" },
  { pattern: /\b(backend\s*(?:software\s*)?(?:engineer|developer)|back[\s-]*end\s*(?:engineer|developer))\b/i, roleName: "Backend Engineer" },
  { pattern: /\b(software\s*engineer|software\s*developer)\b/i, roleName: "Software Engineer" },
  { pattern: /\b(devops\s*(?:engineer|specialist)|site\s*reliability\s*engineer|sre|cloud\s*platform\s*engineer|cloud\s*engineer)\b/i, roleName: "DevOps & Cloud Platform Engineer" },
  { pattern: /\b(cybersecurity\s*(?:engineer|analyst)|security\s*engineer|penetration\s*tester|red[\s-]*team(?:er)?|ethical\s*hacker)\b/i, roleName: "Cybersecurity Engineer" },
  { pattern: /\b(data\s*scientist|machine\s*learning\s*engineer|ml\s*engineer|ai\s*engineer|mlops\s*engineer|deep\s*learning\s*engineer)\b/i, roleName: "Data Scientist & ML Engineer" },
  { pattern: /\b(game\s*(?:engine\s*)?(?:developer|engineer)|game\s*programmer|unity\s*developer|unreal\s*developer)\b/i, roleName: "Game Developer" },
  { pattern: /\b(vlsi\s*(?:design\s*)?engineer|chip\s*design\s*engineer|asic\s*engineer|fpga\s*engineer|semiconductor\s*engineer)\b/i, roleName: "VLSI Design Engineer" },
  { pattern: /\b(systems\s*(?:software\s*)?engineer|systems\s*programmer|embedded\s*systems\s*engineer|firmware\s*engineer)\b/i, roleName: "Systems & Low-Level Engineer" },
  { pattern: /\b(robotics\s*(?:software\s*)?engineer|autonomous\s*systems\s*engineer)\b/i, roleName: "Robotics Engineer" },
  { pattern: /\b(bioinformatics\s*(?:scientist|engineer)|computational\s*biologist)\b/i, roleName: "Bioinformatics Scientist" },
  { pattern: /\b(quantum\s*(?:software|hardware)\s*engineer)\b/i, roleName: "Quantum Engineer" },
  { pattern: /\b(aerospace\s*avionics\s*engineer|avionics\s*engineer)\b/i, roleName: "Aerospace Avionics Engineer" },
];

/**
 * Phrases indicating explicit user intent to change/switch their target career goal.
 */
const EXPLICIT_GOAL_CHANGE_PATTERNS = [
  /^(?:actually,?\s*)?(?:i\s*(?:want\s*to|would\s*like\s*to)\s*(?:become|be|switch\s*to|change\s*to|pursue))\s+(?:an?\s+)?(.+)$/i,
  /^(?:change|switch|update|reset)\s+(?:my\s+)?(?:career\s+)?(?:goal|target|role|path)\s+(?:to|for)\s+(?:an?\s+)?(.+)$/i,
  /^(?:i\s*changed\s*my\s*mind,?)\s*(?:i\s*(?:want\s*to|would\s*like\s*to)\s*(?:become|be|pursue))?\s*(?:an?\s+)?(.+)$/i,
  /^(?:my\s+(?:new\s+)?(?:goal|role|target)\s+is\s+(?:now\s+)?(?:an?\s+)?)(.+)$/i,
  /^(?:instead,?\s*)(?:i\s*(?:want\s*to|would\s*like\s*to)\s*(?:become|be|pursue))\s+(?:an?\s+)?(.+)$/i,
];

/**
 * Common known domains/industries.
 */
const KNOWN_DOMAINS = [
  "enterprise",
  "erp",
  "fintech",
  "banking",
  "saas",
  "web product",
  "web products",
  "web application",
  "web applications",
  "cloud",
  "cloud services",
  "data services",
  "async api",
  "ai backends",
  "systems",
  "systems engineering",
  "low-level",
  "high performance",
  "embedded",
  "vlsi",
  "hardware",
  "semiconductor",
  "cybersecurity",
  "security",
  "red team",
  "infrastructure",
  "devops",
  "platform",
  "gaming",
  "game engine",
  "game development",
  "robotics",
  "autonomous",
  "e-commerce",
  "healthcare",
  "bioinformatics",
  "aerospace",
  "quantum",
  "fullstack",
  "web",
];

/**
 * Common known programming languages.
 */
const KNOWN_LANGUAGES = [
  "typescript",
  "javascript",
  "node",
  "nodejs",
  "python",
  "java",
  "c++",
  "cpp",
  "c#",
  "csharp",
  "dotnet",
  ".net",
  "go",
  "golang",
  "rust",
  "kotlin",
  "swift",
  "systemverilog",
  "verilog",
  "vhdl",
  "c",
  "ruby",
  "php",
  "scala",
  "dart",
  "r",
  "html",
  "css",
  "sql",
];

/**
 * Common known architecture preferences.
 */
const KNOWN_ARCHITECTURES = [
  "microservices",
  "microservice",
  "modular monolith",
  "monolith",
  "monolithic",
  "serverless",
  "event-driven",
  "event driven",
  "rest api",
  "rest apis",
  "graphql",
  "grpc",
  "transactional",
  "client-server",
  "spa",
  "cloud iac",
  "containers",
  "kubernetes",
];

export class SemanticDimensionValidator {
  /**
   * Detects whether input text strongly matches a career role or explicit goal-change statement.
   */
  public detectCareerRole(text: string): CareerRoleDetectionResult {
    if (!text || typeof text !== "string") {
      return { isRole: false, isExplicitChangeIntent: false };
    }

    const trimmed = text.trim();

    // Check for explicit goal change statements first
    for (const pattern of EXPLICIT_GOAL_CHANGE_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        const extracted = match[1].replace(/[.!?,]+$/, "").trim();
        const detectedRole = this.findRoleTitle(extracted) || extracted;
        return {
          isRole: true,
          roleName: detectedRole,
          isExplicitChangeIntent: true,
        };
      }
    }

    // Check for direct career role matches
    const roleTitle = this.findRoleTitle(trimmed);
    if (roleTitle) {
      return {
        isRole: true,
        roleName: roleTitle,
        isExplicitChangeIntent: false,
      };
    }

    // Check generic "I want to become X" or "I want to work as X"
    const genericRoleMatch = trimmed.match(/^I want to (?:be|become|work as an?|work in|pursue|specialize as an?)\s+(?:an?\s+)?([^.,;]+)/i);
    if (genericRoleMatch && genericRoleMatch[1]) {
      const extracted = genericRoleMatch[1].trim();
      return {
        isRole: true,
        roleName: extracted,
        isExplicitChangeIntent: true,
      };
    }

    return { isRole: false, isExplicitChangeIntent: false };
  }

  /**
   * Helper to match against known career role patterns.
   */
  private findRoleTitle(text: string): string | null {
    const clean = text.toLowerCase().trim();
    for (const item of KNOWN_CAREER_ROLE_PATTERNS) {
      if (item.pattern.test(clean)) {
        return item.roleName;
      }
    }
    return null;
  }

  /**
   * Validates whether user-supplied answer semantically fits the expected dimension,
   * catching destructive mismatches (e.g. supplying "Mobile App Developer" when asked for target_domain).
   */
  public validateDimensionAnswer(
    dimension: string,
    answerText: string,
    currentGoal?: string | null
  ): DimensionValidationResult {
    const raw = (answerText || "").trim();
    const clean = raw.toLowerCase();

    if (!raw) {
      return { status: "unknown", reason: "Empty answer text" };
    }

    const targetDim = dimension.toLowerCase();

    // 1. Detect if this is an explicit goal-change statement or a career role
    const roleDetection = this.detectCareerRole(raw);

    // If dimension is NOT declared_goal, but user provided an explicit goal change statement
    if (targetDim !== "declared_goal" && roleDetection.isExplicitChangeIntent && roleDetection.roleName) {
      return {
        status: "explicit_goal_change",
        proposedGoal: roleDetection.roleName,
        reason: `User explicitly stated intent to change goal to '${roleDetection.roleName}'`,
      };
    }

    // If dimension is NOT declared_goal, but user provided a career role title
    if (targetDim !== "declared_goal" && targetDim !== "confirm_goal_change" && roleDetection.isRole && roleDetection.roleName) {
      // Check if it might also be a legitimate domain specialization (e.g. "Game Developer" could be domain "Gaming", but if it specifies a role it should be validated)
      // Check if the current goal is already this role
      const currentGoalLower = (currentGoal || "").toLowerCase().trim();
      const proposedLower = roleDetection.roleName.toLowerCase().trim();

      if (currentGoalLower && currentGoalLower !== proposedLower) {
        return {
          status: "role_mismatch",
          proposedGoal: roleDetection.roleName,
          reason: `'${raw}' represents a career role rather than a '${dimension}' answer.`,
        };
      }
    }

    // 2. Validate by target dimension
    switch (targetDim) {
      case "target_domain":
      case "domain":
      case "specialization_focus": {
        // Any domain string is valid unless it's a mismatched career role
        return {
          status: "valid",
          normalizedValue: raw,
        };
      }

      case "primary_language":
      case "language": {
        // If user typed something that matches known language, it's valid
        return {
          status: "valid",
          normalizedValue: raw,
        };
      }

      case "architecture_preference":
      case "architecture": {
        return {
          status: "valid",
          normalizedValue: raw,
        };
      }

      case "hours_per_week": {
        const match = clean.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > 0 && num <= 168) {
            return { status: "valid", normalizedValue: num };
          }
        }
        return { status: "unknown", normalizedValue: raw };
      }

      case "deadline_months": {
        const match = clean.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > 0 && num <= 120) {
            return { status: "valid", normalizedValue: num };
          }
        }
        return { status: "unknown", normalizedValue: raw };
      }

      case "confirm_goal_change": {
        const isConfirm = clean.startsWith("yes") || clean.includes("confirm") || clean.includes("change my goal");
        const isReject = clean.startsWith("no") || clean.includes("keep") || clean.includes("reject") || clean.includes("stay");
        return {
          status: "valid",
          normalizedValue: isConfirm ? "confirmed" : isReject ? "rejected" : raw,
        };
      }

      default: {
        return {
          status: "valid",
          normalizedValue: raw,
        };
      }
    }
  }
}

export const semanticDimensionValidator = new SemanticDimensionValidator();
