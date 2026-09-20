import {
  EvidenceItem,
  ProfileFact,
  UserActivityAffinity,
  UserCapabilityLevel,
  UserCapabilityState,
  UserCharacteristicState,
  UserUncertainty,
  UserWorkModel,
} from "../../contracts";

/**
 * UserWorkModelManager encapsulates access, mutation, and deterministic reconstruction
 * of the UserWorkModel from underlying historical evidence.
 */
export class UserWorkModelManager {
  private model: UserWorkModel;

  constructor(initialModel?: Partial<UserWorkModel>) {
    this.model = {
      capabilities: initialModel?.capabilities || {},
      activities: initialModel?.activities || {},
      workCharacteristics: initialModel?.workCharacteristics || {},
      preferences: initialModel?.preferences || {
        domains: [],
        languages: [],
        learningModes: ["hands_on_projects", "docs"],
        resourceBudget: "free_only",
      },
      constraints: initialModel?.constraints || {
        hoursPerWeek: 8,
        deadlineMonths: 6,
        timezone: "UTC",
        safetyScopeConfirmed: false,
      },
      uncertainties: initialModel?.uncertainties || [],
      negativeSignals: initialModel?.negativeSignals || {},
      evidenceIds: initialModel?.evidenceIds || [],
      lastUpdatedAt: initialModel?.lastUpdatedAt || new Date().toISOString(),
    };
  }

  public getModel(): UserWorkModel {
    return JSON.parse(JSON.stringify(this.model));
  }

  /**
   * Deterministically applies an evidence item to the User Work Model.
   * Enforces dimension-specificity: evidence on dimension X only touches dimension X.
   */
  public applyEvidence(evidence: EvidenceItem | ProfileFact): void {
    const dim = (evidence.dimension || "").toLowerCase();
    const id = evidence.id;
    if (!this.model.evidenceIds.includes(id)) {
      this.model.evidenceIds.push(id);
    }

    const val = "normalizedValue" in evidence ? evidence.normalizedValue : (evidence as EvidenceItem).signal;
    const valStr = typeof val === "string" ? val : JSON.stringify(val);
    const reliability = "reliability" in evidence ? evidence.reliability : (evidence as EvidenceItem).confidence ?? 0.8;
    const isNegative =
      evidence.status === "weakening" ||
      evidence.status === "contradicted" ||
      valStr.toLowerCase().includes("dislike") ||
      valStr.toLowerCase().includes("hate") ||
      valStr.toLowerCase().includes("avoid") ||
      valStr.toLowerCase().includes("not interested");

    // 1. Track negative signals strictly per dimension
    if (isNegative) {
      if (!this.model.negativeSignals[dim]) {
        this.model.negativeSignals[dim] = [];
      }
      if (!this.model.negativeSignals[dim].includes(valStr)) {
        this.model.negativeSignals[dim].push(valStr);
      }
    }

    // 2. Capability dimensions
    if (
      dim.startsWith("capability:") ||
      dim === "known_skills" ||
      dim === "skills" ||
      dim === "primary_language" ||
      dim === "languages"
    ) {
      const capName = dim.startsWith("capability:") ? dim.replace("capability:", "") : valStr;
      const capKey = capName.toLowerCase().trim();
      const existing = this.model.capabilities[capKey] || {
        id: `cap_${capKey}`,
        name: capName,
        level: "novice" as UserCapabilityLevel,
        status: "inferred" as const,
        confidence: reliability,
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        lastAssessedAt: null,
      };

      if (isNegative) {
        if (!existing.contradictingEvidenceIds.includes(id)) {
          existing.contradictingEvidenceIds.push(id);
        }
        existing.confidence = Math.max(0.1, Number((existing.confidence * 0.8).toFixed(2)));
      } else {
        if (!existing.supportingEvidenceIds.includes(id)) {
          existing.supportingEvidenceIds.push(id);
        }
        existing.confidence = Math.min(1.0, Number((existing.confidence + 0.15 * reliability).toFixed(2)));
        if (evidence.source === "assessment_evidence" || evidence.source === "experiment_observation") {
          existing.status = "demonstrated";
          existing.lastAssessedAt = new Date().toISOString();
        }
      }
      this.model.capabilities[capKey] = existing;
    }

    // 3. Activity dimensions
    else if (dim.startsWith("activity:") || dim === "activities" || dim === "work_type") {
      const actName = dim.startsWith("activity:") ? dim.replace("activity:", "") : valStr;
      const actKey = actName.toLowerCase().trim();
      const existing = this.model.activities[actKey] || {
        id: `act_${actKey}`,
        name: actName,
        affinity: "neutral" as UserActivityAffinity,
        engagementLevel: "moderate" as const,
        evidenceIds: [],
      };

      if (!existing.evidenceIds.includes(id)) {
        existing.evidenceIds.push(id);
      }

      if (isNegative) {
        existing.affinity = "disliked";
      } else if (valStr.toLowerCase().includes("love") || valStr.toLowerCase().includes("enjoy")) {
        existing.affinity = "preferred";
      }
      this.model.activities[actKey] = existing;
    }

    // 4. Work characteristic dimensions
    else if (
      dim.startsWith("characteristic:") ||
      dim === "autonomy" ||
      dim === "ambiguity" ||
      dim === "technical_depth" ||
      dim === "feedback_speed" ||
      dim === "collaboration"
    ) {
      const charName = dim.startsWith("characteristic:") ? dim.replace("characteristic:", "") : dim;
      const charKey = charName.toLowerCase().trim();
      const existing = this.model.workCharacteristics[charKey] || {
        id: `char_${charKey}`,
        dimension: charName,
        signal: val,
        confidence: reliability,
        evidenceIds: [],
      };

      if (!existing.evidenceIds.includes(id)) {
        existing.evidenceIds.push(id);
      }
      existing.signal = val;
      existing.confidence = Math.min(1.0, Number((existing.confidence * 0.5 + reliability * 0.5).toFixed(2)));
      this.model.workCharacteristics[charKey] = existing;
    }

    // 5. Constraints
    else if (dim === "hours_per_week" || dim === "hours") {
      const num = typeof val === "number" ? val : parseInt(String(val).replace(/\D/g, ""), 10) || 8;
      this.model.constraints.hoursPerWeek = Math.max(1, Math.min(80, num));
    } else if (dim === "deadline_months" || dim === "deadline") {
      const num = typeof val === "number" ? val : parseInt(String(val).replace(/\D/g, ""), 10) || 6;
      this.model.constraints.deadlineMonths = Math.max(1, Math.min(36, num));
    }

    // 6. Preferences
    else if (dim === "target_domain" || dim === "domain") {
      if (!this.model.preferences.domains.includes(valStr)) {
        this.model.preferences.domains.push(valStr);
      }
    } else if (dim === "learning_mode") {
      if (!this.model.preferences.learningModes.includes(valStr)) {
        this.model.preferences.learningModes.push(valStr);
      }
    }

    // Remove resolved uncertainties
    this.model.uncertainties = this.model.uncertainties.filter((u) => u.dimension.toLowerCase() !== dim);

    this.model.lastUpdatedAt = new Date().toISOString();
  }

  /**
   * Registers an explicit uncertainty in the model.
   */
  public registerUncertainty(uncertainty: UserUncertainty): void {
    const exists = this.model.uncertainties.some((u) => u.id === uncertainty.id || u.dimension === uncertainty.dimension);
    if (!exists) {
      this.model.uncertainties.push(uncertainty);
      this.model.lastUpdatedAt = new Date().toISOString();
    }
  }

  /**
   * Rebuilds the entire UserWorkModel from an ordered list of historical evidence.
   * This guarantees that the User Work Model is a rebuildable, derived view of evidence.
   */
  public static reconstructFromEvidence(evidenceList: (EvidenceItem | ProfileFact)[]): UserWorkModel {
    const manager = new UserWorkModelManager();
    // Sort by timestamp if available to replay accurately
    const sorted = [...evidenceList].sort((a, b) => {
      const tA = new Date((a as any).timestamp || (a as any).createdAt || 0).getTime();
      const tB = new Date((b as any).timestamp || (b as any).createdAt || 0).getTime();
      return tA - tB;
    });

    for (const item of sorted) {
      if (item.status !== "revoked" && item.status !== "superseded") {
        manager.applyEvidence(item);
      }
    }
    return manager.getModel();
  }
}
