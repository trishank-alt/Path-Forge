import {
  Contradiction,
  EvidenceItem,
  EvidenceSource,
  EvidenceStatus,
  ProfileFact,
  UserWorkModel,
} from "../../contracts";
import { UserWorkModelManager } from "./user-work-model";

const SOURCE_PRECEDENCE_WEIGHTS: Record<EvidenceSource, number> = {
  user_correction: 6.0,
  user_answer: 5.0,
  assessment_evidence: 4.0,
  experiment_observation: 3.5,
  reflection: 3.5,
  linked_artifact: 3.0,
  self_report: 2.0,
  llm_inference: 1.0,
};

export interface EvidenceProcessingResult {
  acceptedEvidence: EvidenceItem[];
  updatedWorkModel: UserWorkModel;
  detectedContradictions: Contradiction[];
  revokedOrSupersededIds: string[];
}

export class EvidenceEngine {
  /**
   * Deterministically processes raw incoming evidence, applies source precedence,
   * detects and records contradictions, preserves full provenance, and updates the UserWorkModel.
   */
  public processEvidence(
    existingEvidence: EvidenceItem[],
    incomingEvidence: (EvidenceItem | ProfileFact)[],
    currentWorkModel?: UserWorkModel
  ): EvidenceProcessingResult {
    const allEvidence: EvidenceItem[] = [...existingEvidence];
    const detectedContradictions: Contradiction[] = [];
    const revokedOrSupersededIds: string[] = [];

    const workModelManager = new UserWorkModelManager(currentWorkModel);

    for (const rawItem of incomingEvidence) {
      const normalizedItem = this.normalizeEvidence(rawItem);
      const incomingDim = normalizedItem.dimension.toLowerCase();

      // Find existing active evidence for this exact dimension
      const existingActiveIndex = allEvidence.findIndex(
        (e) => e.dimension.toLowerCase() === incomingDim && e.status === "active"
      );

      if (existingActiveIndex === -1) {
        // No conflicting active evidence -> ingest as active
        allEvidence.push(normalizedItem);
        workModelManager.applyEvidence(normalizedItem);
      } else {
        const existing = allEvidence[existingActiveIndex];
        const existingWeight = SOURCE_PRECEDENCE_WEIGHTS[existing.source] || 1.0;
        const incomingWeight = SOURCE_PRECEDENCE_WEIGHTS[normalizedItem.source] || 1.0;

        const isSameSignal =
          JSON.stringify(existing.signal) === JSON.stringify(normalizedItem.signal);

        if (isSameSignal) {
          // Strengthen existing evidence: boost confidence and preserve provenance
          existing.confidence = Math.min(
            1.0,
            Number((existing.confidence + 0.1 * normalizedItem.quality).toFixed(2))
          );
          existing.timestamp = normalizedItem.timestamp;
          workModelManager.applyEvidence(existing);
        } else if (incomingWeight >= existingWeight) {
          // Higher or equal precedence overrides the earlier signal.
          // CRITICAL REQUIREMENT: Do NOT silently delete the prior evidence!
          // Mark prior as superseded, record provenance link, and persist incoming.
          existing.status = "superseded";
          revokedOrSupersededIds.push(existing.id);

          normalizedItem.provenance = {
            ...normalizedItem.provenance,
            priorEvidenceId: existing.id,
            derivationRule: `Superseded ${existing.source} (precedence ${existingWeight}) with ${normalizedItem.source} (precedence ${incomingWeight})`,
          };

          allEvidence.push(normalizedItem);
          workModelManager.applyEvidence(normalizedItem);
        } else {
          // Incoming evidence has lower precedence than existing active evidence.
          // Preserve incoming as "contradicted" or "weakening", DO NOT discard!
          normalizedItem.status = "contradicted";
          allEvidence.push(normalizedItem);

          const contradiction: Contradiction = {
            id: `contra_${existing.id}_${normalizedItem.id}`,
            factIdA: existing.id,
            factIdB: normalizedItem.id,
            description: `Conflict on ${normalizedItem.dimension}: Higher-precedence established fact (${existing.source}: ${JSON.stringify(
              existing.signal
            )}) conflicts with new signal (${normalizedItem.source}: ${JSON.stringify(
              normalizedItem.signal
            )}).`,
            severity: normalizedItem.quality > 0.7 ? "high" : "medium",
            resolved: false,
          };
          detectedContradictions.push(contradiction);
        }
      }
    }

    return {
      acceptedEvidence: allEvidence,
      updatedWorkModel: workModelManager.getModel(),
      detectedContradictions,
      revokedOrSupersededIds,
    };
  }

  /**
   * Normalizes any incoming fact or evidence item into a canonical EvidenceItem.
   */
  public normalizeEvidence(raw: EvidenceItem | ProfileFact): EvidenceItem {
    const isFact = "rawValue" in raw && "normalizedValue" in raw;
    const now = new Date().toISOString();

    if (!isFact) {
      return {
        ...(raw as EvidenceItem),
        timestamp: (raw as EvidenceItem).timestamp || now,
        status: (raw as EvidenceItem).status || "active",
        supportedTargetIds: (raw as EvidenceItem).supportedTargetIds || [],
        contradictedTargetIds: (raw as EvidenceItem).contradictedTargetIds || [],
      };
    }

    const fact = raw as ProfileFact;
    const weight = SOURCE_PRECEDENCE_WEIGHTS[fact.source as EvidenceSource] || 1.0;
    const quality = Number((fact.reliability * (weight / 6.0)).toFixed(2));

    return {
      id: fact.id || `ev_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      dimension: fact.dimension,
      signal: fact.normalizedValue ?? fact.rawValue,
      confidence: fact.reliability,
      source: fact.source as EvidenceSource,
      quality: Math.min(1.0, Math.max(0.1, quality)),
      timestamp: fact.createdAt || now,
      status: (fact.status as EvidenceStatus) || "active",
      provenance: fact.provenance || {
        originalText: fact.evidence,
        derivationRule: `Extracted from fact source: ${fact.source}`,
      },
      supportedTargetIds: [],
      contradictedTargetIds: [],
      explanation: fact.evidence,
    };
  }
}

export const evidenceEngine = new EvidenceEngine();
