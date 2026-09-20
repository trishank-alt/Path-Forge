import { EvidenceItem, ReflectionSubmission } from "../../contracts";

export class ReflectionService {
  /**
   * Translates a post-phase or post-experiment reflection submission into candidate EvidenceItems.
   * Enforces dimension-specific extraction:
   * - Enjoyment/dislike maps to activity affinity or domain preference.
   * - Difficulty maps to capability confidence or required scaffolding.
   * - Exhaustion/energy maps to work characteristics (pace, autonomy, depth).
   * - Voluntary exploration maps to emerging interests.
   * All items retain provenance pointing to the reflection event.
   */
  public extractEvidenceFromReflection(
    profileId: string,
    submission: ReflectionSubmission
  ): EvidenceItem[] {
    const items: EvidenceItem[] = [];
    const now = new Date().toISOString();
    const eventId = `refl_${Date.now()}`;

    // 1. Enjoyed signals (Positive Activity / Domain Evidence)
    if (submission.enjoyed && submission.enjoyed.trim().length > 0) {
      items.push({
        id: `ev_refl_enjoy_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        dimension: `activity:enjoyed`,
        signal: submission.enjoyed.trim(),
        confidence: 0.9,
        source: "reflection",
        quality: 0.85,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
          originalText: submission.enjoyed,
          derivationRule: "User explicit post-work reflection on enjoyed activities",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `User explicitly enjoyed: "${submission.enjoyed.trim()}"`,
      });
    }

    // 2. Disliked signals (Dimension-Specific Negative Evidence — strictly isolated)
    if (submission.disliked && submission.disliked.trim().length > 0) {
      items.push({
        id: `ev_refl_dislike_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        dimension: `activity:disliked`,
        signal: submission.disliked.trim(),
        confidence: 0.9,
        source: "reflection",
        quality: 0.85,
        timestamp: now,
        status: "weakening",
        provenance: {
          sourceEventId: eventId,
          originalText: submission.disliked,
          derivationRule: "User explicit post-work reflection on disliked activities (strictly isolated dimension)",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `User explicitly disliked: "${submission.disliked.trim()}"`,
      });
    }

    // 3. Voluntarily Explored (Strong Affinity & Autonomy Evidence)
    if (submission.voluntarilyExplored && submission.voluntarilyExplored.trim().length > 0) {
      items.push({
        id: `ev_refl_vol_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        dimension: `activity:voluntary_exploration`,
        signal: submission.voluntarilyExplored.trim(),
        confidence: 0.95,
        source: "reflection",
        quality: 0.9,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
          originalText: submission.voluntarilyExplored,
          derivationRule: "Voluntary self-directed exploration beyond required milestone scope",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `User voluntarily explored: "${submission.voluntarilyExplored.trim()}"`,
      });
    }

    // 4. Energy & Exhaustion (Work Characteristics: Pace, Cognitive Load, Autonomy)
    if (submission.energizing && submission.energizing.trim().length > 0) {
      items.push({
        id: `ev_refl_energy_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        dimension: `characteristic:energizing_factors`,
        signal: submission.energizing.trim(),
        confidence: 0.85,
        source: "reflection",
        quality: 0.8,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
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
        id: `ev_refl_exhaust_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        dimension: `characteristic:exhausting_factors`,
        signal: submission.exhausting.trim(),
        confidence: 0.85,
        source: "reflection",
        quality: 0.8,
        timestamp: now,
        status: "weakening",
        provenance: {
          sourceEventId: eventId,
          originalText: submission.exhausting,
          derivationRule: "Work characteristic reflection on cognitive fatigue sources",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `Exhausting work characteristic: "${submission.exhausting.trim()}"`,
      });
    }

    // 5. Harder version willingness (Aptitude & Growth signal)
    if (submission.attemptHarder !== undefined) {
      items.push({
        id: `ev_refl_harder_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        dimension: `characteristic:challenge_tolerance`,
        signal: submission.attemptHarder ? "willing_to_attempt_harder" : "prefers_consolidation_first",
        confidence: 0.85,
        source: "reflection",
        quality: 0.8,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
          derivationRule: "Direct response on willingness to attempt higher difficulty",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: submission.attemptHarder
          ? "User voluntarily opted to attempt a higher difficulty milestone."
          : "User prefers consolidation at current difficulty before advancing.",
      });
    }

    // 6. Next preferred work type
    if (submission.preferNext && submission.preferNext.trim().length > 0) {
      items.push({
        id: `ev_refl_next_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        dimension: `preference:next_work_type`,
        signal: submission.preferNext.trim(),
        confidence: 0.9,
        source: "reflection",
        quality: 0.85,
        timestamp: now,
        status: "active",
        provenance: {
          sourceEventId: eventId,
          originalText: submission.preferNext,
          derivationRule: "Learner preference for subsequent phase focus",
        },
        supportedTargetIds: [],
        contradictedTargetIds: [],
        explanation: `User prefers next: "${submission.preferNext.trim()}"`,
      });
    }

    return items;
  }
}

export const reflectionService = new ReflectionService();
