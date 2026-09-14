import {
  LearnerPreferences,
  ProfileFact,
  TechnologyEcosystem,
} from "../../contracts";

export interface LearnerTechnologyContext {
  backendEcosystem: TechnologyEcosystem;
  frontendTechnology?: string;
  languages: string[];
  isExplicit: boolean;
  hasFrontendPreference: boolean;
}

/**
 * Normalizes a technology/framework/language string and maps it to a canonical TechnologyEcosystem.
 * Conservative and deterministic: distinguishes frontend frameworks from backend ecosystems.
 */
export function resolveTechnologyEcosystem(
  term: string | null | undefined
): TechnologyEcosystem {
  if (!term || typeof term !== "string") return "agnostic";

  const lower = term.toLowerCase().trim();

  // Explicit JavaScript / TypeScript / Node.js backend ecosystem
  if (
    lower.includes("typescript") ||
    lower.includes("javascript") ||
    lower.includes("node") ||
    lower.includes("fastify") ||
    lower.includes("express") ||
    lower.includes("prisma") ||
    lower.includes("drizzle") ||
    lower === "ts" ||
    lower === "js"
  ) {
    return "typescript_node";
  }

  // Explicit Java / Spring Boot ecosystem
  if (
    (lower.includes("java") && !lower.includes("javascript")) ||
    lower.includes("spring") ||
    lower.includes("spring boot") ||
    lower.includes("jvm") ||
    lower.includes("hibernate") ||
    lower.includes("jpa")
  ) {
    return "java_spring";
  }

  // Explicit Python / FastAPI / Data backend ecosystem
  if (
    lower.includes("python") ||
    lower.includes("fastapi") ||
    lower.includes("django") ||
    lower.includes("flask") ||
    lower.includes("asyncio") ||
    lower.includes("sqlalchemy") ||
    lower.includes("alembic")
  ) {
    return "python_fastapi";
  }

  // Explicit C++ Systems ecosystem
  if (
    lower.includes("c++") ||
    lower.includes("cpp") ||
    lower === "c / c++" ||
    lower === "c/c++"
  ) {
    return "cpp";
  }

  // Explicit Hardware HDL / VLSI / Chip Design ecosystem
  if (
    lower.includes("verilog") ||
    lower.includes("systemverilog") ||
    lower.includes("vhdl") ||
    lower.includes("chisel") ||
    lower.includes("hdl") ||
    lower.includes("fpga") ||
    lower.includes("rtl") ||
    lower.includes("asic") ||
    lower.includes("vlsi") ||
    lower.includes("chip design") ||
    lower.includes("digital logic") ||
    lower.includes("microarchitecture")
  ) {
    return "hardware_hdl";
  }

  return "agnostic";
}

/**
 * Checks if a given term is a frontend technology (e.g. React, Next.js, Vue).
 * Frontend technologies should not force a backend ecosystem if a separate backend is declared.
 */
export function isFrontendTechnology(term: string | null | undefined): boolean {
  if (!term || typeof term !== "string") return false;
  const lower = term.toLowerCase().trim();
  return (
    lower.includes("react") ||
    lower.includes("next.js") ||
    lower.includes("nextjs") ||
    lower.includes("vue") ||
    lower.includes("angular") ||
    lower.includes("svelte") ||
    lower.includes("html") ||
    lower.includes("css") ||
    lower.includes("tailwind")
  );
}

/**
 * Resolves the complete learner technology context from preferences and active profile facts.
 * Preserves multi-stack distinctions (e.g., React frontend + Java/Spring backend).
 */
export function resolveLearnerTechnologyContext(
  preferences: LearnerPreferences,
  facts: ProfileFact[] = []
): LearnerTechnologyContext {
  const activeFacts = facts.filter((f) => f.status === "active");

  const explicitLangFacts = activeFacts.filter(
    (f) =>
      f.dimension === "primary_language" ||
      f.dimension === "languages" ||
      f.dimension === "known_skills"
  );

  const rawValues: string[] = [];

  // Gather values from facts
  for (const fact of explicitLangFacts) {
    const val = fact.normalizedValue;
    if (typeof val === "string") {
      rawValues.push(val);
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === "string") rawValues.push(item);
      }
    }
  }

  // Gather values from preferences
  if (preferences.languages && Array.isArray(preferences.languages)) {
    for (const lang of preferences.languages) {
      if (typeof lang === "string") rawValues.push(lang);
    }
  }

  let frontendTech: string | undefined = undefined;
  let backendEcosystem: TechnologyEcosystem = "agnostic";
  let isExplicit = false;

  // 1. Check for explicit primary_language fact first (highest authority)
  const primaryLangFact = activeFacts.find(
    (f) => f.dimension === "primary_language"
  );
  if (primaryLangFact) {
    const val = String(primaryLangFact.normalizedValue);
    const eco = resolveTechnologyEcosystem(val);
    if (eco !== "agnostic") {
      backendEcosystem = eco;
      isExplicit = true;
    }
    if (isFrontendTechnology(val)) {
      frontendTech = val;
    }
  }

  // 2. Check if another fact explicitly specifies a backend or frontend technology
  for (const raw of rawValues) {
    if (isFrontendTechnology(raw)) {
      frontendTech = raw;
    }
    const eco = resolveTechnologyEcosystem(raw);
    if (eco !== "agnostic" && backendEcosystem === "agnostic") {
      backendEcosystem = eco;
      isExplicit = true;
    }
  }

  // 3. Fallback to preferences.languages
  if (backendEcosystem === "agnostic" && preferences.languages?.length > 0) {
    for (const lang of preferences.languages) {
      const eco = resolveTechnologyEcosystem(lang);
      if (eco !== "agnostic") {
        backendEcosystem = eco;
        isExplicit = true;
        break;
      }
    }
  }

  return {
    backendEcosystem,
    frontendTechnology: frontendTech,
    languages: Array.from(new Set(rawValues)),
    isExplicit,
    hasFrontendPreference: Boolean(frontendTech),
  };
}

/**
 * Checks whether a skill is compatible with the target technology ecosystem.
 */
export function isSkillCompatible(
  skillEcosystem: TechnologyEcosystem | undefined,
  targetEcosystem: TechnologyEcosystem
): boolean {
  if (!skillEcosystem || skillEcosystem === "agnostic") return true;
  if (targetEcosystem === "agnostic") return true;
  return skillEcosystem === targetEcosystem;
}

/**
 * Checks whether a learning resource is compatible with the target technology ecosystem.
 */
export function isResourceCompatible(
  resourceEcosystem: TechnologyEcosystem | undefined,
  targetEcosystem: TechnologyEcosystem
): boolean {
  if (!resourceEcosystem || resourceEcosystem === "agnostic") return true;
  if (targetEcosystem === "agnostic") return true;
  return resourceEcosystem === targetEcosystem;
}

/**
 * Checks whether a practical project is compatible with the target technology ecosystem.
 */
export function isProjectCompatible(
  projectEcosystem: TechnologyEcosystem | undefined,
  targetEcosystem: TechnologyEcosystem
): boolean {
  if (!projectEcosystem || projectEcosystem === "agnostic") return true;
  if (targetEcosystem === "agnostic") return true;
  return projectEcosystem === targetEcosystem;
}
