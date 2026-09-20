import { Contradiction, FactSource, ProfileFact } from "../../contracts";

const SOURCE_PRECEDENCE: Record<FactSource, number> = {
  user_correction: 6,
  user_answer: 5,
  assessment_evidence: 4,
  experiment_observation: 3.5,
  reflection: 3.5,
  linked_artifact: 3,
  self_report: 2,
  llm_inference: 1,
};

export interface FactMergeResult {
  updatedFacts: ProfileFact[];
  contradictions: Contradiction[];
  revokedFactIds: string[];
}

export class FactPrecedenceEngine {
  /**
   * Merges incoming facts with existing facts according to deterministic source precedence rules.
   */
  public mergeFacts(existingFacts: ProfileFact[], incomingFacts: ProfileFact[]): FactMergeResult {
    const updatedFacts = [...existingFacts];
    const revokedFactIds: string[] = [];
    const contradictions: Contradiction[] = [];

    for (const incoming of incomingFacts) {
      const incomingDim = (incoming?.dimension || "").toLowerCase();
      const existingActiveIndex = updatedFacts.findIndex(
        (f) => (f?.dimension || "").toLowerCase() === incomingDim && f.status === "active"
      );

      if (existingActiveIndex === -1) {
        // No existing active fact for this dimension -> Add as active
        updatedFacts.push({ ...incoming, status: "active" });
      } else {
        const existing = updatedFacts[existingActiveIndex];
        const existingScore = SOURCE_PRECEDENCE[existing.source] || 0;
        const incomingScore = SOURCE_PRECEDENCE[incoming.source] || 0;

        if (incomingScore >= existingScore) {
          // Incoming fact supersedes existing fact
          updatedFacts[existingActiveIndex] = {
            ...existing,
            status: "superseded",
            updatedAt: new Date().toISOString(),
          };
          revokedFactIds.push(existing.id);
          updatedFacts.push({ ...incoming, status: "active" });
        } else {
          // Incoming fact has lower precedence than existing active fact
          // Check for high-impact contradiction
          if (JSON.stringify(existing.normalizedValue) !== JSON.stringify(incoming.normalizedValue)) {
            contradictions.push({
              id: `contra_${existing.id}_${incoming.id}`,
              factIdA: existing.id,
              factIdB: incoming.id,
              description: `Conflict on ${incoming.dimension}: Higher-precedence established fact (${existing.source}: ${JSON.stringify(
                existing.normalizedValue
              )}) conflicts with new signal (${incoming.source}: ${JSON.stringify(incoming.normalizedValue)}).`,
              severity: incoming.impact === "high" || existing.impact === "high" ? "high" : "medium",
              resolved: false,
            });
          }
        }
      }
    }

    return {
      updatedFacts,
      contradictions,
      revokedFactIds,
    };
  }

  /**
   * Explicitly corrects or revokes an existing fact by user action.
   */
  public correctFact(
    facts: ProfileFact[],
    factId: string,
    correction: { newValue?: any; revoke?: boolean; reason?: string }
  ): ProfileFact[] {
    const now = new Date().toISOString();
    return facts.map((fact) => {
      if (fact.id === factId) {
        if (correction.revoke) {
          return {
            ...fact,
            status: "revoked",
            evidence: correction.reason ? `Revoked by user: ${correction.reason}` : "Revoked by user",
            updatedAt: now,
          };
        } else if (correction.newValue !== undefined) {
          return {
            ...fact,
            normalizedValue: correction.newValue,
            rawValue: String(correction.newValue),
            source: "user_correction",
            reliability: 1.0,
            evidence: correction.reason ? `User correction: ${correction.reason}` : "User explicit correction",
            updatedAt: now,
          };
        }
      }
      return fact;
    });
  }
}
