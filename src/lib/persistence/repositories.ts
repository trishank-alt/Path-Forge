import {
  LearnerProfile,
  Roadmap,
  Scenario,
  ProfileFact,
  CompetencyRecord,
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

  constructor() {
    this.createCleanProfile("demo_learner_1");
  }

  public createCleanProfile(profileId: string = "demo_learner_1"): LearnerProfile {
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
}
