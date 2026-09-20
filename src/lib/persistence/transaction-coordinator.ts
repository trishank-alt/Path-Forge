import { PlanningDecision, RoadmapPhase } from "../contracts";
import {
  dataStore,
  decisionRepository,
  phaseRepository,
  DecisionRepository,
  PhaseRepository,
} from "./repositories";

export interface PlanningTransitionParams {
  profileId: string;
  decision: PlanningDecision;
  activePhaseTransition?: {
    phaseId: string;
    toStatus: "completed" | "superseded";
    reason?: string;
    timestamp?: string;
  } | null;
  newPhase?: RoadmapPhase | null;
}

/**
 * Unit of Work / Transaction Coordinator for adaptive planning transitions.
 * Coordinates writes across DecisionRepository and PhaseRepository,
 * ensuring all-or-nothing rollback semantics.
 */
export class PlanningTransactionCoordinator {
  private decisionRepo: DecisionRepository;
  private phaseRepo: PhaseRepository;

  constructor(
    decisionRepo: DecisionRepository = decisionRepository,
    phaseRepo: PhaseRepository = phaseRepository
  ) {
    this.decisionRepo = decisionRepo;
    this.phaseRepo = phaseRepo;
  }

  /**
   * Atomically executes:
   * 1. Active phase transition (if requested)
   * 2. New active phase creation (if requested)
   * 3. Decision persistence
   *
   * On failure of any step, all mutations are rolled back.
   */
  public async executePlanningTransition(params: PlanningTransitionParams): Promise<void> {
    const { profileId, decision, activePhaseTransition, newPhase } = params;

    // Snapshot state for atomic rollback in memory
    const prevPhases = JSON.parse(JSON.stringify(dataStore.phases.get(profileId) || []));
    const prevDecisions = JSON.parse(JSON.stringify(dataStore.decisions.get(profileId) || []));

    try {
      // 1. Transition active phase if requested
      if (activePhaseTransition) {
        await this.phaseRepo.transitionPhase(profileId, activePhaseTransition.phaseId, {
          toStatus: activePhaseTransition.toStatus,
          decisionId: decision.id,
          reason: activePhaseTransition.reason,
          timestamp: activePhaseTransition.timestamp,
        });
      }

      // 2. Create new phase if requested
      if (newPhase) {
        await this.phaseRepo.createPhase(profileId, newPhase);
      }

      // 3. Persist the complete PlanningDecision
      await this.decisionRepo.saveDecision(decision);
    } catch (err) {
      // Rollback on any failure
      dataStore.phases.set(profileId, prevPhases);
      dataStore.decisions.set(profileId, prevDecisions);
      throw err;
    }
  }
}

export const planningTransactionCoordinator = new PlanningTransactionCoordinator();
