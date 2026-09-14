import {
  CurriculumDiscoveryContext,
  CurriculumDiscoveryResult,
  CurriculumProposal,
  TechnologyEcosystem,
} from "../../contracts";
import { CurriculumDiscoveryPort } from "../../llm/ports";
import { Curriculum, proposalToCurriculum } from "./curriculum-model";
import { CurriculumVerifier, curriculumVerifier } from "./curriculum-verifier";

export class CurriculumDiscoveryService {
  private verifier: CurriculumVerifier;

  constructor(verifier: CurriculumVerifier = curriculumVerifier) {
    this.verifier = verifier;
  }

  /**
   * Orchestrates controlled curriculum discovery:
   * 1. Calls single LLM port `proposeCurriculum`
   * 2. Runs proposal through 10 deterministic validation gates via CurriculumVerifier
   * 3. If valid, builds immutable scoped Curriculum snapshot
   * 4. If invalid or null, returns failure with diagnostic reasons
   */
  public async discoverAndVerifyCurriculum(
    context: CurriculumDiscoveryContext,
    llm: CurriculumDiscoveryPort,
    targetEcosystem?: TechnologyEcosystem
  ): Promise<CurriculumDiscoveryResult & { curriculum?: Curriculum }> {
    let proposal: CurriculumProposal | null = null;
    const initialMeta = (llm as any).getLastExecutionMetadata?.() || undefined;

    try {
      proposal = await llm.proposeCurriculum(context);
    } catch (err: any) {
      const execMeta = (llm as any).getLastExecutionMetadata?.() || initialMeta;
      return {
        status: "provider_error",
        failureCode: "DISCOVERY_API_FAILURE",
        failureReason: `LLM curriculum proposal failed: ${err.message || String(err)}`,
        gateFailures: ["LLM Port Error"],
        executionMetadata: execMeta,
      };
    }

    const execMeta = (llm as any).getLastExecutionMetadata?.() || initialMeta;

    if (!proposal) {
      if (execMeta?.failureCategory === "generation_truncated") {
        return {
          status: "generation_truncated",
          failureCode: "DISCOVERY_TOKEN_LIMIT",
          failureReason: `Curriculum proposal generation for '${context.targetRole}' was truncated by model token limits after bounded retry.`,
          gateFailures: ["Generation Truncated"],
          executionMetadata: execMeta,
        };
      }
      if (execMeta?.failureCategory === "provider_error" || execMeta?.failureCategory === "auth_failure" || execMeta?.failureCategory === "rate_limit") {
        return {
          status: "provider_error",
          failureCode: "DISCOVERY_API_FAILURE",
          failureReason: `Curriculum discovery encountered a provider API error for '${context.targetRole}'.`,
          gateFailures: ["Provider Error"],
          executionMetadata: execMeta,
        };
      }
      if (execMeta?.failureCategory === "invalid_json") {
        return {
          status: "generation_failed",
          failureCode: "DISCOVERY_INVALID_JSON",
          failureReason: `Curriculum discovery received malformed JSON for '${context.targetRole}'.`,
          gateFailures: ["Invalid JSON"],
          executionMetadata: execMeta,
        };
      }
      if (execMeta?.failureCategory === "invalid_schema") {
        return {
          status: "generation_failed",
          failureCode: "DISCOVERY_SCHEMA_FAILURE",
          failureReason: `Curriculum discovery proposal for '${context.targetRole}' failed structural schema validation.`,
          gateFailures: ["Invalid Schema"],
          executionMetadata: execMeta,
        };
      }
      return {
        status: "unsupported",
        failureCode: "DISCOVERY_UNSUPPORTED",
        failureReason: `The model could not generate a curriculum proposal for '${context.targetRole}'.`,
        gateFailures: ["Null Proposal"],
        executionMetadata: execMeta,
      };
    }

    // Run deterministic hard gates (all 10 gates preserved and enforced!)
    const verification = this.verifier.verify(proposal, targetEcosystem);

    if (!verification.isValid) {
      return {
        status: "failed_verification",
        failureCode: "DISCOVERY_VERIFICATION_FAILURE",
        failureReason: verification.explanation,
        gateFailures: verification.failedGates,
        executionMetadata: execMeta,
        verificationReport: verification,
      };
    }

    // Build immutable scoped snapshot
    const curriculum = proposalToCurriculum(proposal);

    return {
      status: "success",
      curriculum,
      executionMetadata: execMeta,
      verificationReport: verification,
    };
  }
}

export const curriculumDiscoveryService = new CurriculumDiscoveryService();
