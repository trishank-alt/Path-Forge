import {
  LearnerProfile,
  Roadmap,
  Scenario,
  EvidenceItem,
  PlanningDecision,
  RoadmapPhase,
  UserWorkModel,
} from "../contracts";
import { SEEDED_PATHS } from "./seed-data";

export interface DecisionAuditEvent {
  id: string;
  profileId: string;
  eventType: string; // 'intake_extracted', 'confidence_evaluated', 'question_selected', 'roadmap_generated', 'fact_corrected', 'scenario_created'
  timestamp: string;
  details: any;
}

// In-Memory Repository Singletons for state management
class InMemoryDataStore {
  public profiles: Map<string, LearnerProfile> = new Map();
  public roadmaps: Map<string, Roadmap> = new Map();
  public savedRoadmaps: Map<string, Roadmap[]> = new Map(); // profileId -> historical Roadmap[]
  public scenarios: Map<string, Scenario[]> = new Map(); // profileId -> Scenario[]
  public auditEvents: DecisionAuditEvent[] = [];
  public evidence: Map<string, EvidenceItem[]> = new Map(); // profileId -> EvidenceItem[]
  public decisions: Map<string, PlanningDecision[]> = new Map(); // profileId -> PlanningDecision[]
  public phases: Map<string, RoadmapPhase[]> = new Map(); // profileId -> RoadmapPhase[]
  public workModels: Map<string, UserWorkModel> = new Map(); // profileId -> UserWorkModel

  constructor() {
    this.createCleanProfile("demo_learner_1");
  }

  public createCleanProfile(profileId: string = "demo_learner_1"): LearnerProfile {
    this.evidence.delete(profileId);
    this.decisions.delete(profileId);
    this.phases.delete(profileId);
    this.workModels.delete(profileId);

    const numPaths = SEEDED_PATHS.length;
    const uniformPrior = Number((1.0 / numPaths).toFixed(4));

    const cleanProfile: LearnerProfile = {
      id: profileId,
      userId: `user_${profileId}`,
      goalText: "",
      declaredTargetRole: null,
      selectedPathId: null,
      facts: [],
      preferences: {
        domains: [],
        languages: [],
        learningModes: ["hands_on_projects", "docs"],
        resourceBudget: "free_only",
      },
      constraints: {
        hoursPerWeek: 8,
        deadlineMonths: 6,
        timezone: "UTC",
        safetyScopeConfirmed: false,
      },
      intent: {
        hypotheses: SEEDED_PATHS.map((p) => ({
          pathId: p.id,
          pathTitle: p.title,
          priorProbability: uniformPrior,
          posteriorProbability: uniformPrior,
          supportEvidenceCount: 0,
          rationale: p.description,
        })),
        topPathId: null,
        confidence: {
          topProbability: uniformPrior,
          coverageFactor: 0.0,
          consistencyFactor: 1.0,
          evidenceQualityFactor: 0.7,
          finalScore: 0.0,
          status: "clarifying",
          missingDimensions: ["primary_language", "target_domain", "architecture_preference", "hours_per_week"],
          missingHighImpactDimensions: ["primary_language", "target_domain", "architecture_preference", "hours_per_week"],
          missingMaterialDimensions: ["primary_language", "target_domain", "architecture_preference"],
          assumptions: [],
          contradictions: [],
          explanation: "Initial state. Please declare a learning goal.",
        },
        unansweredDimensions: ["primary_language", "target_domain", "architecture_preference", "hours_per_week"],
        status: "clarifying",
        questionCount: 0,
        maxQuestionBudget: 6,
      },
      competencies: [],
      activeRoadmapId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.profiles.set(profileId, cleanProfile);
    return cleanProfile;
  }
}

const dataStore = new InMemoryDataStore();

export class ProfileRepository {
  public async getProfile(profileId: string = "demo_learner_1"): Promise<LearnerProfile> {
    let profile = dataStore.profiles.get(profileId);
    if (!profile) {
      profile = dataStore.createCleanProfile(profileId);
    }
    return JSON.parse(JSON.stringify(profile));
  }

  public async saveProfile(profile: LearnerProfile): Promise<void> {
    profile.updatedAt = new Date().toISOString();
    dataStore.profiles.set(profile.id, JSON.parse(JSON.stringify(profile)));
  }

  public async resetProfile(profileId: string = "demo_learner_1"): Promise<LearnerProfile> {
    // 1. Archive current active roadmap to history before clearing
    const current = dataStore.profiles.get(profileId);
    if (current && current.activeRoadmapId) {
      const activeRm = dataStore.roadmaps.get(current.activeRoadmapId);
      if (activeRm) {
        const history = dataStore.savedRoadmaps.get(profileId) || [];
        if (!history.some((r) => r.id === activeRm.id)) {
          history.unshift(JSON.parse(JSON.stringify(activeRm)));
          dataStore.savedRoadmaps.set(profileId, history);
        }
      }
    }

    // 2. Re-create clean profile
    const fresh = dataStore.createCleanProfile(profileId);
    return JSON.parse(JSON.stringify(fresh));
  }
}

export class RoadmapRepository {
  public async saveRoadmap(roadmap: Roadmap): Promise<void> {
    dataStore.roadmaps.set(roadmap.id, JSON.parse(JSON.stringify(roadmap)));
    // Also record in profile history
    const history = dataStore.savedRoadmaps.get(roadmap.profileId) || [];
    const existingIdx = history.findIndex((r) => r.id === roadmap.id);
    if (existingIdx >= 0) {
      history[existingIdx] = JSON.parse(JSON.stringify(roadmap));
    } else {
      history.unshift(JSON.parse(JSON.stringify(roadmap)));
    }
    dataStore.savedRoadmaps.set(roadmap.profileId, history);
  }

  public async getRoadmap(roadmapId: string): Promise<Roadmap | null> {
    const rm = dataStore.roadmaps.get(roadmapId);
    return rm ? JSON.parse(JSON.stringify(rm)) : null;
  }

  public async getSavedRoadmapsForProfile(profileId: string): Promise<Roadmap[]> {
    const history = dataStore.savedRoadmaps.get(profileId) || [];
    return JSON.parse(JSON.stringify(history));
  }
}

export class ScenarioRepository {
  public async saveScenario(profileId: string, scenario: Scenario): Promise<void> {
    const list = dataStore.scenarios.get(profileId) || [];
    list.push(scenario);
    dataStore.scenarios.set(profileId, list);
  }

  public async getScenariosForProfile(profileId: string): Promise<Scenario[]> {
    const list = dataStore.scenarios.get(profileId) || [];
    return JSON.parse(JSON.stringify(list));
  }
}

export class AuditRepository {
  public async recordEvent(event: Omit<DecisionAuditEvent, "id" | "timestamp">): Promise<void> {
    const fullEvent: DecisionAuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    dataStore.auditEvents.unshift(fullEvent);
    if (dataStore.auditEvents.length > 200) {
      dataStore.auditEvents.pop();
    }
  }

  public async getRecentEvents(limit: number = 50): Promise<DecisionAuditEvent[]> {
    return JSON.parse(JSON.stringify(dataStore.auditEvents.slice(0, limit)));
  }

  public async getAuditEvents(profileId: string): Promise<DecisionAuditEvent[]> {
    return dataStore.auditEvents.filter((e) => e.profileId === profileId);
  }
}

// ==========================================
// ADAPTIVE PLANNING REPOSITORIES (POSTGRESQL-ALIGNED)
// ==========================================

export class EvidenceRepository {
  public async saveEvidence(profileId: string, items: EvidenceItem[]): Promise<void> {
    dataStore.evidence.set(profileId, JSON.parse(JSON.stringify(items)));
  }

  public async getEvidence(profileId: string): Promise<EvidenceItem[]> {
    const items = dataStore.evidence.get(profileId) || [];
    return JSON.parse(JSON.stringify(items));
  }
}

export class DecisionRepository {
  public async saveDecision(decision: PlanningDecision): Promise<void> {
    const list = dataStore.decisions.get(decision.profileId) || [];
    list.push(JSON.parse(JSON.stringify(decision)));
    dataStore.decisions.set(decision.profileId, list);
  }

  public async getDecisions(profileId: string): Promise<PlanningDecision[]> {
    const list = dataStore.decisions.get(profileId) || [];
    return JSON.parse(JSON.stringify(list));
  }
}

export class PhaseRepository {
  public async savePhase(profileId: string, phase: RoadmapPhase): Promise<void> {
    const list = dataStore.phases.get(profileId) || [];
    const existingIdx = list.findIndex(
      (p) => p.id === phase.id || (p.phaseNumber === phase.phaseNumber && p.status !== "completed")
    );
    if (existingIdx >= 0) {
      list[existingIdx] = JSON.parse(JSON.stringify(phase));
    } else {
      list.push(JSON.parse(JSON.stringify(phase)));
    }
    dataStore.phases.set(profileId, list);
  }

  public async getPhases(profileId: string): Promise<RoadmapPhase[]> {
    const list = dataStore.phases.get(profileId) || [];
    return JSON.parse(JSON.stringify(list));
  }

  public async getActivePhase(profileId: string): Promise<RoadmapPhase | null> {
    const list = dataStore.phases.get(profileId) || [];
    const active = list.find((p) => p.status === "in_progress" || p.status === "planned");
    return active ? JSON.parse(JSON.stringify(active)) : null;
  }
}

export class UserWorkModelRepository {
  public async saveWorkModel(profileId: string, model: UserWorkModel): Promise<void> {
    dataStore.workModels.set(profileId, JSON.parse(JSON.stringify(model)));
  }

  public async getWorkModel(profileId: string): Promise<UserWorkModel | null> {
    const model = dataStore.workModels.get(profileId);
    return model ? JSON.parse(JSON.stringify(model)) : null;
  }
}

export interface ReasoningHistory {
  profileId: string;
  evidence: EvidenceItem[];
  decisions: PlanningDecision[];
  phases: RoadmapPhase[];
  reconstructedWorkModel: UserWorkModel;
  narrative: {
    whatWeKnew: string[];
    whyWeBelievedIt: string[];
    whatWeDecided: string[];
    whatHappenedAfterward: string[];
  };
}

export class ProvenanceRepository {
  private evidenceRepo = new EvidenceRepository();
  private decisionRepo = new DecisionRepository();
  private phaseRepo = new PhaseRepository();

  /**
   * Reconstructs the full historical reasoning chain:
   * What did we know? When did we know it? Why did we believe it?
   * What happened afterward? How did that change the next decision?
   */
  public async reconstructReasoningHistory(profileId: string): Promise<ReasoningHistory> {
    const evidence = await this.evidenceRepo.getEvidence(profileId);
    const decisions = await this.decisionRepo.getDecisions(profileId);
    const phases = await this.phaseRepo.getPhases(profileId);

    const { UserWorkModelManager } = await import("../domain/evidence/user-work-model");
    const reconstructedWorkModel = UserWorkModelManager.reconstructFromEvidence(evidence);

    const whatWeKnew = evidence.map(
      (e) => `[${e.timestamp}] Dimension '${e.dimension}' recorded signal: ${JSON.stringify(e.signal)} (Status: ${e.status})`
    );

    const whyWeBelievedIt = evidence.map(
      (e) => `Dimension '${e.dimension}' derived from source '${e.source}' with confidence ${(e.confidence * 100).toFixed(0)}% and quality ${(e.quality * 100).toFixed(0)}% (Provenance: ${JSON.stringify(e.provenance || {})})`
    );

    const whatWeDecided = decisions.map(
      (d) => `[${d.timestamp}] Mode: '${d.mode.toUpperCase()}', Objective: '${d.primaryObjective}' (Rationale: ${d.rationale})`
    );

    const whatHappenedAfterward = phases.map(
      (p) => `Phase ${p.phaseNumber} ('${p.objective}'): Status '${p.status}', Workload: ${p.duration.totalHours}h over ${p.duration.estimatedWeeks}w`
    );

    return {
      profileId,
      evidence,
      decisions,
      phases,
      reconstructedWorkModel,
      narrative: {
        whatWeKnew,
        whyWeBelievedIt,
        whatWeDecided,
        whatHappenedAfterward,
      },
    };
  }
}

export const evidenceRepository = new EvidenceRepository();
export const decisionRepository = new DecisionRepository();
export const phaseRepository = new PhaseRepository();
export const userWorkModelRepository = new UserWorkModelRepository();
export const provenanceRepository = new ProvenanceRepository();
