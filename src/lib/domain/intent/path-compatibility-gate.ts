import { ProfileFact, TechnologyEcosystem } from "../../contracts";
import { PathDefinition, SEEDED_PATHS } from "../../persistence/seed-data";
import { resolveLearnerTechnologyContext } from "../learning/technology-ecosystem";

export interface PathCompatibilityResult {
  pathId: string;
  pathTitle: string;
  compatible: boolean;
  hardConflicts: string[];
  matchedSignals: string[];
  unsupportedIntent: boolean;
  explanation: string;
}

export interface IntentCompatibilityEvaluation {
  isIntentSupported: boolean;
  isCatalogMatch: boolean;
  unsupportedReason?: string;
  evaluatedGoal?: string;
  evaluatedDomain?: string;
  results: PathCompatibilityResult[];
  eligiblePaths: PathDefinition[]; // Compatible catalog paths
}

export function isNonCommittalAnswer(text: string): boolean {
  if (!text) return true;
  const t = text.toLowerCase().trim();
  return (
    t.includes("not sure") ||
    t.includes("don't know") ||
    t.includes("dont know") ||
    t.includes("open to suggestion") ||
    t.includes("open to suggestions") ||
    t.includes("no preference") ||
    t.includes("whatever is best") ||
    t.includes("which one would you recommend") ||
    t.includes("recommend") ||
    t.includes("help me choose") ||
    t.includes("explore options") ||
    t === "unresolved" ||
    t === "delegated_to_system"
  );
}

export class PathCompatibilityGate {
  /**
   * Deterministically evaluates the compatibility of active learner facts against catalog paths.
   * Enforces a hard catalog eligibility boundary:
   * 1. Detects whether the learner's explicit career goal matches a catalog path.
   * 2. Priority hierarchy: Role/Goal > Domain > Specialization > Technology > Other Preferences.
   * 3. Rejects candidate paths that have hard role/domain conflicts.
   * 4. Rejects candidate paths that have hard technology ecosystem conflicts.
   * 5. Returns eligible catalog paths without declaring uncatalogued careers unsupported.
   */
  public evaluateIntentCompatibility(
    facts: ProfileFact[],
    paths: PathDefinition[] = SEEDED_PATHS
  ): IntentCompatibilityEvaluation {
    const activeFacts = facts.filter((f) => f.status === "active");

    // 1. Separate Career Intent Facts by Dimension
    const goalFacts = activeFacts.filter(
      (f) => f.dimension === "declared_goal" || f.dimension === "goal" || f.dimension === "target_role"
    );
    const domainFacts = activeFacts.filter(
      (f) => (f.dimension === "target_domain" || f.dimension === "domain" || f.dimension === "industry") &&
             !isNonCommittalAnswer(String(f.normalizedValue || f.rawValue || ""))
    );
    const specializationFacts = activeFacts.filter(
      (f) => (f.dimension === "specialization_focus" || f.dimension === "specialization") &&
             !isNonCommittalAnswer(String(f.normalizedValue || f.rawValue || ""))
    );
    const architectureFacts = activeFacts.filter(
      (f) => f.dimension === "architecture_preference" &&
             !isNonCommittalAnswer(String(f.normalizedValue || f.rawValue || ""))
    );

    const goalRaw = goalFacts.map((f) => `${f.normalizedValue || ""} ${f.rawValue || ""}`).join(" ").toLowerCase().trim();
    const domainRaw = domainFacts.map((f) => `${f.normalizedValue || ""} ${f.rawValue || ""}`).join(" ").toLowerCase().trim();
    const specRaw = specializationFacts.map((f) => `${f.normalizedValue || ""} ${f.rawValue || ""}`).join(" ").toLowerCase().trim();
    const archRaw = architectureFacts.map((f) => `${f.normalizedValue || ""} ${f.rawValue || ""}`).join(" ").toLowerCase().trim();

    // 2. Resolve explicit technology context (secondary constraint signal)
    const techContext = resolveLearnerTechnologyContext(
      { domains: [], languages: [], learningModes: [], resourceBudget: "free_only" },
      activeFacts
    );
    const learnerEcosystem = techContext.backendEcosystem;

    // 3. Classify Career Role Family
    const isDevOps =
      goalRaw.includes("devops") ||
      goalRaw.includes("cloud platform") ||
      goalRaw.includes("infrastructure engineer") ||
      goalRaw.includes("sre") ||
      goalRaw.includes("site reliability");
    const isCybersecurity =
      goalRaw.includes("cybersecurity") ||
      goalRaw.includes("security") ||
      goalRaw.includes("red team") ||
      goalRaw.includes("red-team") ||
      goalRaw.includes("penetration test") ||
      goalRaw.includes("infosec");
    const isAerospaceOrNiche =
      goalRaw.includes("aerospace") ||
      goalRaw.includes("avionics") ||
      goalRaw.includes("flight control") ||
      goalRaw.includes("marine") ||
      goalRaw.includes("sonar") ||
      goalRaw.includes("archaeology");

    const isSystems =
      !isAerospaceOrNiche &&
      (goalRaw.includes("systems_cpp_engineer") ||
        goalRaw.includes("systems engineer") ||
        goalRaw.includes("systems developer") ||
        goalRaw.includes("systems software") ||
        goalRaw.includes("systems programming") ||
        (goalRaw.includes("systems") && goalRaw.includes("c++")) ||
        goalRaw.includes("c++ developer") ||
        goalRaw.includes("c++ engineer") ||
        goalRaw.includes("c++ programmer") ||
        goalRaw.includes("low-level") ||
        goalRaw.includes("game engine") ||
        goalRaw.includes("embedded systems software"));
    const isFullStack =
      goalRaw.includes("full stack") ||
      goalRaw.includes("fullstack") ||
      goalRaw.includes("frontend") ||
      goalRaw.includes("front-end");
    const isVLSI =
      goalRaw.includes("vlsi") ||
      goalRaw.includes("chip design") ||
      goalRaw.includes("asic") ||
      goalRaw.includes("fpga") ||
      goalRaw.includes("digital ic") ||
      goalRaw.includes("rtl") ||
      goalRaw.includes("semiconductor") ||
      (goalRaw.includes("hardware") &&
        (goalRaw.includes("chip") ||
          goalRaw.includes("circuit") ||
          goalRaw.includes("ic") ||
          goalRaw.includes("verilog") ||
          goalRaw.includes("vhdl") ||
          goalRaw.includes("silicon")));
    const isBackend =
      goalRaw.includes("backend") ||
      goalRaw.includes("back-end") ||
      goalRaw.includes("api") ||
      goalRaw.includes("server") ||
      goalRaw.includes("saas") ||
      goalRaw.includes("microservices");
    const isMobile =
      goalRaw.includes("mobile") ||
      goalRaw.includes("ios") ||
      goalRaw.includes("android") ||
      goalRaw.includes("flutter") ||
      goalRaw.includes("react native");
    const isGeneralSoftware =
      !isMobile &&
      (goalRaw.includes("software engineer") ||
        goalRaw.includes("software developer") ||
        goalRaw.includes("software engineering") ||
        goalRaw.includes("programmer") ||
        goalRaw.includes("developer") ||
        goalRaw.includes("coder") ||
        goalRaw.includes("general software") ||
        /\b(software\s*(?:engineer|engineering|developer)|developer|programmer|coder)\b/i.test(goalRaw));

    const isCatalogRole =
      !goalRaw ||
      isDevOps ||
      isCybersecurity ||
      isSystems ||
      isFullStack ||
      isVLSI ||
      isBackend ||
      isGeneralSoftware;

    const isSystemsDomain =
      (domainRaw.includes("systems") || domainRaw.includes("embedded") || domainRaw.includes("low-level")) &&
      !domainRaw.includes("flight") &&
      !domainRaw.includes("avionics") &&
      !domainRaw.includes("aerospace");

    const isCatalogDomain =
      !domainRaw ||
      domainRaw.includes("erp") ||
      domainRaw.includes("enterprise") ||
      domainRaw.includes("banking") ||
      domainRaw.includes("fintech") ||
      domainRaw.includes("saas") ||
      domainRaw.includes("web") ||
      domainRaw.includes("cloud") ||
      domainRaw.includes("data") ||
      isSystemsDomain ||
      domainRaw.includes("vlsi") ||
      domainRaw.includes("hardware") ||
      domainRaw.includes("semiconductor") ||
      domainRaw.includes("asic") ||
      domainRaw.includes("fpga") ||
      domainRaw.includes("devops") ||
      domainRaw.includes("platform") ||
      domainRaw.includes("infrastructure") ||
      domainRaw.includes("security") ||
      domainRaw.includes("cyber");

    // 4. Evaluate compatibility for each candidate path
    const results: PathCompatibilityResult[] = [];
    const eligiblePaths: PathDefinition[] = [];

    for (const path of paths) {
      const hardConflicts: string[] = [];
      const matchedSignals: string[] = [];

      // A. Career Role & Goal Compatibility (Priority 1)
      if (goalRaw.length > 0) {
        if (!isCatalogRole) {
          // Explicit non-catalog career role (e.g. Aerospace, Robotics, Bioinformatics, etc.)
          hardConflicts.push(`Incompatible with explicit '${goalFacts[0]?.rawValue || goalRaw}' career goal`);
        } else if (isDevOps) {
          if (path.id === "devops_cloud_engineer") {
            matchedSignals.push("Explicit DevOps & Cloud Platform career goal alignment");
          } else {
            hardConflicts.push("Incompatible with explicit DevOps & Cloud Infrastructure career goal");
          }
        } else if (isCybersecurity) {
          if (path.id === "cybersecurity_defensive_redteam") {
            matchedSignals.push("Explicit Ethical Cybersecurity career goal alignment");
          } else {
            hardConflicts.push("Incompatible with explicit Ethical Cybersecurity career goal");
          }
        } else if (isSystems) {
          if (path.id === "systems_cpp_engineer") {
            matchedSignals.push("Explicit Systems & Low-Level C++ career goal alignment");
          } else {
            hardConflicts.push("Incompatible with explicit Systems & Low-Level Engineering career goal");
          }
        } else if (isFullStack) {
          if (path.id === "fullstack_software_engineer") {
            matchedSignals.push("Explicit Full-Stack Web career goal alignment");
          } else if (
            path.id === "cybersecurity_defensive_redteam" ||
            path.id === "systems_cpp_engineer" ||
            path.id === "vlsi_design_engineer"
          ) {
            hardConflicts.push("Incompatible with explicit Full-Stack Web development career goal");
          }
        } else if (isVLSI) {
          if (path.id === "vlsi_design_engineer") {
            matchedSignals.push("Explicit VLSI & Semiconductor Hardware career goal alignment");
          } else {
            hardConflicts.push("Incompatible with explicit VLSI & Hardware Design career goal");
          }
        } else if (isBackend && !isFullStack) {
          if (
            path.id === "devops_cloud_engineer" ||
            path.id === "cybersecurity_defensive_redteam" ||
            path.id === "systems_cpp_engineer" ||
            path.id === "vlsi_design_engineer" ||
            path.id === "fullstack_software_engineer"
          ) {
            hardConflicts.push("Incompatible with explicit Backend software development career goal");
          } else {
            matchedSignals.push("Backend software development career goal alignment");
          }
        } else if (isGeneralSoftware) {
          if (
            path.id === "cybersecurity_defensive_redteam" ||
            path.id === "vlsi_design_engineer"
          ) {
            hardConflicts.push("Incompatible with General Software Engineering career goal");
          } else {
            matchedSignals.push("Software engineering career goal alignment");
          }
        }
      }

      // B. Domain Compatibility (Priority 2)
      if (domainRaw.length > 0) {
        if (!isCatalogDomain) {
          hardConflicts.push(`Incompatible with explicit '${domainFacts[0]?.rawValue || domainRaw}' domain goal`);
        } else if (
          domainRaw.includes("erp") ||
          domainRaw.includes("enterprise") ||
          domainRaw.includes("banking") ||
          domainRaw.includes("fintech")
        ) {
          if (
            path.id === "backend_enterprise_java" ||
            path.id === "backend_web_product_node" ||
            path.id === "backend_python_cloud" ||
            path.id === "fullstack_software_engineer"
          ) {
            matchedSignals.push("Enterprise / Business software domain match");
          } else if (path.id === "cybersecurity_defensive_redteam" || path.id === "vlsi_design_engineer") {
            hardConflicts.push("Incompatible with Enterprise software domain goal");
          }
        } else if (isSystemsDomain) {
          if (path.id === "systems_cpp_engineer") {
            matchedSignals.push("Systems & Low-Level domain match");
          } else if (path.id === "cybersecurity_defensive_redteam") {
            hardConflicts.push("Incompatible with Systems domain goal");
          }
        } else if (
          domainRaw.includes("vlsi") ||
          domainRaw.includes("hardware") ||
          domainRaw.includes("semiconductor") ||
          domainRaw.includes("asic") ||
          domainRaw.includes("fpga")
        ) {
          if (path.id === "vlsi_design_engineer") {
            matchedSignals.push("Hardware & Semiconductor domain match");
          } else {
            hardConflicts.push("Incompatible with Hardware & Semiconductor domain goal");
          }
        } else if (
          domainRaw.includes("devops") ||
          domainRaw.includes("cloud infrastructure") ||
          domainRaw.includes("platform")
        ) {
          if (path.id === "devops_cloud_engineer") {
            matchedSignals.push("DevOps & Cloud Infrastructure domain match");
          } else if (path.id === "systems_cpp_engineer" || path.id === "vlsi_design_engineer") {
            hardConflicts.push("Incompatible with Cloud Infrastructure domain goal");
          }
        }
      }

      // C. Specialization Compatibility (Priority 3)
      if (specRaw.length > 0) {
        if (specRaw.includes("threat") || specRaw.includes("red team") || specRaw.includes("penetration")) {
          if (path.id === "cybersecurity_defensive_redteam") {
            matchedSignals.push("Security specialization match");
          } else {
            hardConflicts.push("Incompatible with Cybersecurity specialization");
          }
        } else if (
          specRaw.includes("rtl") ||
          specRaw.includes("asic") ||
          specRaw.includes("fpga") ||
          specRaw.includes("uvm") ||
          specRaw.includes("mixed-signal") ||
          specRaw.includes("mixed signal")
        ) {
          if (path.id === "vlsi_design_engineer") {
            matchedSignals.push("VLSI / RTL design specialization match");
          } else {
            hardConflicts.push("Incompatible with VLSI / RTL specialization");
          }
        } else if (specRaw.includes("low-level") || specRaw.includes("memory management") || specRaw.includes("concurrency")) {
          if (path.id === "systems_cpp_engineer") {
            matchedSignals.push("Systems concurrency/memory specialization match");
          }
        }
      }

      // D. Technology Ecosystem Compatibility (Hard boundary for tech-specific paths)
      if (learnerEcosystem !== "agnostic" && path.technologyEcosystem && path.technologyEcosystem !== "agnostic") {
        if (path.technologyEcosystem === learnerEcosystem) {
          matchedSignals.push(`Preferred technology ecosystem match (${learnerEcosystem})`);
        } else {
          hardConflicts.push(
            `Incompatible technology ecosystem: path requires ${path.technologyEcosystem}, learner preferred ${learnerEcosystem}`
          );
        }
      }

      const isCompatible = hardConflicts.length === 0;

      if (isCompatible) {
        eligiblePaths.push(path);
      }

      results.push({
        pathId: path.id,
        pathTitle: path.title,
        compatible: isCompatible,
        hardConflicts,
        matchedSignals,
        unsupportedIntent: false,
        explanation: isCompatible
          ? matchedSignals.length > 0
            ? matchedSignals.join("; ")
            : "Compatible with general software engineering criteria"
          : hardConflicts.join("; "),
      });
    }

    const isCatalogMatch = eligiblePaths.length > 0;
    return {
      isIntentSupported: true,
      isCatalogMatch,
      unsupportedReason: isCatalogMatch
        ? undefined
        : `Requested career track '${goalFacts[0]?.rawValue || "requested career"}' is not currently covered in the pre-verified catalog. Curriculum discovery required.`,
      evaluatedGoal: goalFacts[0]?.rawValue || undefined,
      evaluatedDomain: domainFacts[0]?.rawValue || undefined,
      results,
      eligiblePaths,
    };
  }
}

export const pathCompatibilityGate = new PathCompatibilityGate();
