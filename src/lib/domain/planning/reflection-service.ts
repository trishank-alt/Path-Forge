import { EvidenceItem, ReflectionSubmission } from "../../contracts";

export class ReflectionService {
  /**
   * Translates a post-phase or post-experiment reflection submission into candidate EvidenceItems.
   * Enforces dimension-specific extraction:
   * - Enjoyment/dislike maps to activity affinity or domain preference.
   * - Difficulty maps to capability confidence or required scaffolding.
   * - Exhaustion/energy maps to work characteristics (pace, autonomy, depth).
   * - Voluntary exploration maps to emerging interests.
   * - Direction continuity maps to continuation vs pivot signals.
   * All items retain provenance pointing to the reflection event and phaseId.
   */
  public extractEvidenceFromReflection(
    profileId: string,
    submission: ReflectionSubmission
  ): EvidenceItem[] {
    const items: EvidenceItem[] = [];
    const now = new Date().toISOString();
    const eventId = `refl_${Date.now()}`;
    const phaseId = submission.phaseId;

    // 1. Overall Experience
    if (submission.overallExperience) {
      items.push({
        id: `ev_refl_exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "reflection:overall_experience",
        signal: submission.overallExperience,
        confidence: 0.9,
        source: "phase_reflection",
        quality: 0.85,
        timestamp: now,
        status: submission.overallExperience === "negative" ? "weakening" : "active",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          originalText: submission.overallExperience,
          derivationRule: "User explicit post-work reflection on overall experience",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `Overall experience reported as ${submission.overallExperience}.`,
      });
    }

    // 2. Enjoyed signals (Positive Activity / Domain Evidence)
    if (submission.enjoyed && submission.enjoyed.trim().length > 0) {
      items.push({
        id: `ev_refl_enjoy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "activity:enjoyed",
        signal: submission.enjoyed.trim(),
        confidence: 0.9,
        source: "phase_reflection",
        quality: 0.85,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          originalText: submission.enjoyed,
          derivationRule: "User explicit post-work reflection on enjoyed activities",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `User explicitly enjoyed: "${submission.enjoyed.trim()}"`,
      });
    }

    // 3. Disliked signals (Dimension-Specific Negative Evidence — strictly isolated)
    if (submission.disliked && submission.disliked.trim().length > 0) {
      items.push({
        id: `ev_refl_dislike_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "activity:disliked",
        signal: submission.disliked.trim(),
        confidence: 0.9,
        source: "phase_reflection",
        quality: 0.85,
        timestamp: now,
        status: "weakening",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          originalText: submission.disliked,
          derivationRule: "User explicit post-work reflection on disliked activities (strictly isolated dimension)",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `User explicitly disliked: "${submission.disliked.trim()}"`,
      });
    }

    // 4. Desired Activities (Want More Of)
    if (submission.wantMoreOf && submission.wantMoreOf.trim().length > 0) {
      items.push({
        id: `ev_refl_more_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "activity:desired",
        signal: submission.wantMoreOf.trim(),
        confidence: 0.9,
        source: "phase_reflection",
        quality: 0.85,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          originalText: submission.wantMoreOf,
          derivationRule: "User explicit post-work reflection on activities desired in future phases",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `User wants more of: "${submission.wantMoreOf.trim()}"`,
      });
    }

    // 5. Avoid Activities (Want To Avoid)
    if (submission.wantToAvoid && submission.wantToAvoid.trim().length > 0) {
      items.push({
        id: `ev_refl_avoid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "activity:avoided",
        signal: submission.wantToAvoid.trim(),
        confidence: 0.9,
        source: "phase_reflection",
        quality: 0.85,
        timestamp: now,
        status: "weakening",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          originalText: submission.wantToAvoid,
          derivationRule: "User explicit post-work reflection on activities to avoid in future phases",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `User explicitly wants to avoid: "${submission.wantToAvoid.trim()}"`,
      });
    }

    // 6. Matched Expectations
    if (submission.matchedExpectations !== undefined) {
      items.push({
        id: `ev_refl_expect_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "reflection:matched_expectations",
        signal: submission.matchedExpectations,
        confidence: 0.85,
        source: "phase_reflection",
        quality: 0.8,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          derivationRule: "User evaluation of whether actual phase work matched prior expectations",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: submission.matchedExpectations
          ? "Phase deliverables matched user expectations."
          : "Phase deliverables differed from what user expected.",
      });
    }

    // 7. Self Discovery
    if (submission.selfDiscovery && submission.selfDiscovery.trim().length > 0) {
      items.push({
        id: `ev_refl_disc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "reflection:self_discovery",
        signal: submission.selfDiscovery.trim(),
        confidence: 0.85,
        source: "phase_reflection",
        quality: 0.8,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          originalText: submission.selfDiscovery,
          derivationRule: "User qualitative self-discovery during milestone execution",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `Self-discovery: "${submission.selfDiscovery.trim()}"`,
      });
    }

    // 8. Would Change
    if (submission.wouldChange && submission.wouldChange.trim().length > 0) {
      items.push({
        id: `ev_refl_change_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "reflection:would_change",
        signal: submission.wouldChange.trim(),
        confidence: 0.85,
        source: "phase_reflection",
        quality: 0.8,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          originalText: submission.wouldChange,
          derivationRule: "User reflection on what they would alter about their learning approach",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `Desired change: "${submission.wouldChange.trim()}"`,
      });
    }

    // 9. Direction Continuity (continue vs pivot vs explore_alternatives)
    if (submission.continueDirection) {
      const isPivot = submission.continueDirection !== "continue";
      items.push({
        id: `ev_refl_dir_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "direction:continuity",
        signal: submission.continueDirection,
        confidence: 0.95,
        source: "phase_reflection",
        quality: 0.9,
        timestamp: now,
        status: isPivot ? "weakening" : "active",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          originalText: submission.continueDirection,
          derivationRule: "User directional intent regarding continuing or pivoting from current track",
        },
        supportedTargetIds: [],
        contradictedTargetIds: isPivot && phaseId ? [phaseId] : [],
        explanation: `Directional intent: ${submission.continueDirection}.`,
      });
    }

    // 10. Voluntarily Explored
    if (submission.voluntarilyExplored && submission.voluntarilyExplored.trim().length > 0) {
      items.push({
        id: `ev_refl_vol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "activity:voluntary_exploration",
        signal: submission.voluntarilyExplored.trim(),
        confidence: 0.95,
        source: "phase_reflection",
        quality: 0.9,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          originalText: submission.voluntarilyExplored,
          derivationRule: "Voluntary self-directed exploration beyond required milestone scope",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `User voluntarily explored: "${submission.voluntarilyExplored.trim()}"`,
      });
    }

    // 11. Energy & Exhaustion
    if (submission.energizing && submission.energizing.trim().length > 0) {
      items.push({
        id: `ev_refl_energy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "characteristic:energizing_factors",
        signal: submission.energizing.trim(),
        confidence: 0.85,
        source: "phase_reflection",
        quality: 0.8,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          originalText: submission.energizing,
          derivationRule: "Work characteristic reflection on energizing conditions",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `Energizing work characteristic: "${submission.energizing.trim()}"`,
      });
    }

    if (submission.exhausting && submission.exhausting.trim().length > 0) {
      items.push({
        id: `ev_refl_exhaust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "characteristic:exhausting_factors",
        signal: submission.exhausting.trim(),
        confidence: 0.85,
        source: "phase_reflection",
        quality: 0.8,
        timestamp: now,
        status: "weakening",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          originalText: submission.exhausting,
          derivationRule: "Work characteristic reflection on cognitive fatigue sources",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `Exhausting work characteristic: "${submission.exhausting.trim()}"`,
      });
    }

    // 12. Challenge Tolerance / Harder Version
    if (submission.attemptHarder !== undefined) {
      items.push({
        id: `ev_refl_harder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "characteristic:challenge_tolerance",
        signal: submission.attemptHarder ? "willing_to_attempt_harder" : "prefers_consolidation_first",
        confidence: 0.85,
        source: "phase_reflection",
        quality: 0.8,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          derivationRule: "Direct response on willingness to attempt higher difficulty",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: submission.attemptHarder
          ? "User voluntarily opted to attempt a higher difficulty milestone."
          : "User prefers consolidation at current difficulty before advancing.",
      });
    }

    // 13. Free Text / Comments
    if (submission.freeText && submission.freeText.trim().length > 0) {
      items.push({
        id: `ev_refl_text_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dimension: "reflection:free_text",
        signal: submission.freeText.trim(),
        confidence: 0.8,
        source: "phase_reflection",
        quality: 0.75,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
          phaseId,
          originalText: submission.freeText,
          derivationRule: "Qualitative learner comments on phase execution",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `Learner reflection notes: "${submission.freeText.trim()}"`,
      });
    }

    return items;
  }
}

export const reflectionService = new ReflectionService();
