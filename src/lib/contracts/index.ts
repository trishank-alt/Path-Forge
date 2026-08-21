import { z } from "zod";

// ==========================================
// 1. FACT & PROVENANCE SCHEMAS
// ==========================================

export const FactSourceSchema = z.enum([
  "user_correction",
  "user_answer",
  "assessment_evidence",
  "linked_artifact",
  "self_report",
  "llm_inference",
]);
export type FactSource = z.infer<typeof FactSourceSchema>;

export const FactStatusSchema = z.enum(["active", "superseded", "revoked"]);
export type FactStatus = z.infer<typeof FactStatusSchema>;

export const ProfileFactSchema = z.object({
  id: z.string(),
  dimension: z.string(), // e.g., 'primary_language', 'target_domain', 'known_skills', 'hours_per_week', 'architecture_preference'
  normalizedValue: z.any(), // structured value
  rawValue: z.string(),
  source: FactSourceSchema,
  evidence: z.string(),
  reliability: z.number().min(0).max(1), // 0.0 to 1.0
  impact: z.enum(["low", "medium", "high"]).default("medium"),
  status: FactStatusSchema.default("active"),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProfileFact = z.infer<typeof ProfileFactSchema>;

// ==========================================
// 2. INTENT & CONFIDENCE SCHEMAS
// ==========================================

export const IntentStatusSchema = z.enum([
  "clarifying",
  "provisional",
  "ready",
  "confirmed",
]);
export type IntentStatus = z.infer<typeof IntentStatusSchema>;

export const PathHypothesisSchema = z.object({
  pathId: z.string(),
  pathTitle: z.string(),
  priorProbability: z.number().min(0).max(1),
  posteriorProbability: z.number().min(0).max(1),
  supportEvidenceCount: z.number().int().nonnegative(),
  rationale: z.string(),
});
export type PathHypothesis = z.infer<typeof PathHypothesisSchema>;

export const ContradictionSchema = z.object({
  id: z.string(),
  factIdA: z.string(),
  factIdB: z.string(),
  description: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  resolved: z.boolean(),
});
export type Contradiction = z.infer<typeof ContradictionSchema>;

export const ConfidenceBreakdownSchema = z.object({
  topProbability: z.number().min(0).max(1), // topPathPosterior
  coverageFactor: z.number().min(0).max(1), // coverage
  consistencyFactor: z.number().min(0).max(1), // consistency
  evidenceQualityFactor: z.number().min(0).max(1), // evidenceQuality
  finalScore: z.number().min(0).max(1), // overallIntentConfidence
  status: IntentStatusSchema,
  missingDimensions: z.array(z.string()),
  missingHighImpactDimensions: z.array(z.string()).default([]),
  assumptions: z.array(z.string()),
  contradictions: z.array(ContradictionSchema),
  explanation: z.string(),
});
export type ConfidenceBreakdown = z.infer<typeof ConfidenceBreakdownSchema>;

export const IntentStateSchema = z.object({
  hypotheses: z.array(PathHypothesisSchema),
  topPathId: z.string().nullable(),
  confidence: ConfidenceBreakdownSchema,
  unansweredDimensions: z.array(z.string()),
  status: IntentStatusSchema,
  questionCount: z.number().int().nonnegative(),
  maxQuestionBudget: z.number().int().default(6),
});
export type IntentState = z.infer<typeof IntentStateSchema>;

// ==========================================
// 3. QUESTION & DISCOVERY SCHEMAS
// ==========================================

export const AnswerTypeSchema = z.enum([
  "single_choice",
  "multi_choice",
  "free_text",
  "numeric_slider",
]);
export type AnswerType = z.infer<typeof AnswerTypeSchema>;

export const QuestionCandidateSchema = z.object({
  id: z.string(),
  dimension: z.string(),
  question: z.string(),
  answerType: AnswerTypeSchema,
  options: z.array(z.string()).optional(),
  why: z.string(), // "Why this question matters"
  informationGain: z.number(), // entropy reduction metric
  utilityScore: z.number(), // overall ranking score
  predictedAnswerBuckets: z.array(z.string()).optional(),
});
export type QuestionCandidate = z.infer<typeof QuestionCandidateSchema>;

export const QuestionDecisionSchema = z.object({
  selectedQuestion: QuestionCandidateSchema,
  consideredCandidates: z.array(QuestionCandidateSchema),
  decisionRationale: z.string(),
  selectionTimestamp: z.string(),
});
export type QuestionDecision = z.infer<typeof QuestionDecisionSchema>;

// ==========================================
// 4. SKILLS & PREREQUISITE GRAPH SCHEMAS
// ==========================================

export const CompetencyLevelSchema = z.enum([
  "none",
  "novice",
  "working",
  "proficient",
  "advanced",
]);
export type CompetencyLevel = z.infer<typeof CompetencyLevelSchema>;

export const CompetencyVerificationStatusSchema = z.enum([
  "unknown",
  "claimed",
  "assessed_diagnostic",
  "verified_artifact",
]);
export type CompetencyVerificationStatus = z.infer<
  typeof CompetencyVerificationStatusSchema
>;

export const SkillNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  domain: z.string(), // e.g., 'java_ecosystem', 'databases', 'security', 'architecture'
  description: z.string(),
  level: z.number().int().min(1).max(5), // 1 = Foundational, 5 = Staff/Arch
  category: z.string(),
  evidenceCriteria: z.array(z.string()),
  tags: z.array(z.string()),
});
export type SkillNode = z.infer<typeof SkillNodeSchema>;

export const EdgeTypeSchema = z.enum(["required", "recommended", "alternative"]);
export type EdgeType = z.infer<typeof EdgeTypeSchema>;

export const SkillEdgeSchema = z.object({
  id: z.string(),
  fromSkillId: z.string(), // Prerequisite
  toSkillId: z.string(), // Dependent
  type: EdgeTypeSchema,
  minimumLevel: CompetencyLevelSchema.default("working"),
  rationale: z.string(),
});
export type SkillEdge = z.infer<typeof SkillEdgeSchema>;

export const CompetencyRecordSchema = z.object({
  skillId: z.string(),
  skillTitle: z.string(),
  claimedLevel: CompetencyLevelSchema,
  verifiedLevel: CompetencyLevelSchema,
  status: CompetencyVerificationStatusSchema,
  confidence: z.number().min(0).max(1),
  evidenceNotes: z.array(z.string()),
  lastAssessedAt: z.string().nullable(),
});
export type CompetencyRecord = z.infer<typeof CompetencyRecordSchema>;

// ==========================================
// 5. RESOURCE, PROJECT & MILESTONE SCHEMAS
// ==========================================

export const ResourceFormatSchema = z.enum([
  "interactive_course",
  "documentation",
  "video_series",
  "book",
  "lab_environment",
  "code_repository",
]);
export type ResourceFormat = z.infer<typeof ResourceFormatSchema>;

export const LearningResourceSchema = z.object({
  id: z.string(),
  skillId: z.string(),
  title: z.string(),
  provider: z.string(),
  url: z.string(),
  format: ResourceFormatSchema,
  costType: z.enum(["free", "paid", "freemium"]),
  durationHours: z.number(),
  qualityScore: z.number().min(0).max(1),
  rankingScore: z.number().min(0).max(1).optional(),
  languageOrDomainMatch: z.string().optional(),
  description: z.string(),
});
export type LearningResource = z.infer<typeof LearningResourceSchema>;

export const PracticalProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  targetSkillIds: z.array(z.string()),
  deliverables: z.array(z.string()),
  verificationChecklist: z.array(z.string()),
  estimatedHours: z.number(),
  domainContext: z.string(), // e.g. "ERP Inventory State Machine", "Fintech Ledger"
});
export type PracticalProject = z.infer<typeof PracticalProjectSchema>;

export const MilestoneStatusSchema = z.enum([
  "locked",
  "unlocked",
  "in_progress",
  "completed",
  "skipped_proficient",
]);
export type MilestoneStatus = z.infer<typeof MilestoneStatusSchema>;

export const MilestoneSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  title: z.string(),
  description: z.string(),
  skillIds: z.array(z.string()),
  prerequisiteSkillIds: z.array(z.string()),
  status: MilestoneStatusSchema,
  isDiagnosticRequired: z.boolean(),
  diagnosticAssessmentId: z.string().optional(),
  estimatedHours: z.number(),
  estimatedWeeks: z.number(),
  resources: z.array(LearningResourceSchema),
  project: PracticalProjectSchema.nullable(),
  completionCriteria: z.array(z.string()),
  explanation: z.string(),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

// ==========================================
// 6. NEXT-BEST ACTION & ROADMAP SCHEMAS
// ==========================================

export const ActionTypeSchema = z.enum([
  "lesson",
  "assessment",
  "project_task",
  "revision",
  "clarification",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const NextBestActionSchema = z.object({
  id: z.string(),
  type: ActionTypeSchema,
  title: z.string(),
  description: z.string(),
  milestoneId: z.string().optional(),
  skillId: z.string().optional(),
  resourceId: z.string().optional(),
  estimatedMinutes: z.number(),
  expectedGapReduction: z.number().min(0).max(1),
  priorityScore: z.number(),
  whyNow: z.string(),
});
export type NextBestAction = z.infer<typeof NextBestActionSchema>;

export const RoadmapSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  profileId: z.string(),
  targetPathId: z.string(),
  targetPathTitle: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isStale: z.boolean().default(false),
  staleReason: z.string().optional(),
  totalEstimatedHours: z.number(),
  totalEstimatedWeeks: z.number(),
  weeklyPaceHours: z.number(),
  milestones: z.array(MilestoneSchema),
  nextBestAction: NextBestActionSchema.nullable(),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type Roadmap = z.infer<typeof RoadmapSchema>;

// ==========================================
// 7. WHAT-IF SCENARIO SCHEMAS
// ==========================================

export const ScenarioDiffSchema = z.object({
  addedSkillIds: z.array(z.string()),
  removedSkillIds: z.array(z.string()),
  hoursDelta: z.number(),
  weeksDelta: z.number(),
  confidenceDelta: z.number(),
  summary: z.string(),
  affectedMilestoneTitles: z.array(z.string()),
});
export type ScenarioDiff = z.infer<typeof ScenarioDiffSchema>;

export const ScenarioSchema = z.object({
  id: z.string(),
  baseRoadmapId: z.string(),
  name: z.string(),
  overrides: z.object({
    hoursPerWeek: z.number().optional(),
    targetDomain: z.string().optional(),
    primaryLanguage: z.string().optional(),
    targetRole: z.string().optional(),
    deadlineMonths: z.number().optional(),
  }),
  computedRoadmap: RoadmapSchema,
  diff: ScenarioDiffSchema,
  createdAt: z.string(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

// ==========================================
// 8. LEARNER PROFILE SCHEMAS
// ==========================================

export const LearnerPreferencesSchema = z.object({
  domains: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  learningModes: z.array(z.string()).default(["hands_on_projects", "docs"]),
  resourceBudget: z.enum(["free_only", "moderate", "unconstrained"]).default("free_only"),
});
export type LearnerPreferences = z.infer<typeof LearnerPreferencesSchema>;

export const LearnerConstraintsSchema = z.object({
  hoursPerWeek: z.number().min(1).max(80).default(8),
  deadlineMonths: z.number().min(1).max(36).default(6),
  timezone: z.string().default("UTC"),
  safetyScopeConfirmed: z.boolean().default(false), // for cybersecurity paths
});
export type LearnerConstraints = z.infer<typeof LearnerConstraintsSchema>;

export const LearnerProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  goalText: z.string(),
  declaredTargetRole: z.string().nullable(),
  selectedPathId: z.string().nullable(),
  facts: z.array(ProfileFactSchema),
  preferences: LearnerPreferencesSchema,
  constraints: LearnerConstraintsSchema,
  intent: IntentStateSchema,
  competencies: z.array(CompetencyRecordSchema),
  activeRoadmapId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LearnerProfile = z.infer<typeof LearnerProfileSchema>;

// ==========================================
// 9. LLM EXTRACTION & EXPLANATION CONTRACTS
// ==========================================

export const IntentExtractionResultSchema = z.object({
  facts: z.array(
    z.object({
      dimension: z.string(),
      value: z.any(),
      rawValue: z.string(),
      evidence: z.string(),
      reliability: z.number().min(0).max(1),
      impact: z.enum(["low", "medium", "high"]),
    })
  ),
  detectedGoal: z.string().optional(),
  targetRoleHint: z.string().optional(),
  unknownDimensions: z.array(z.string()),
  contradictions: z.array(
    z.object({
      factDescriptionA: z.string(),
      factDescriptionB: z.string(),
      reason: z.string(),
    })
  ),
  clarificationNeeded: z.boolean(),
});
export type IntentExtractionResult = z.infer<typeof IntentExtractionResultSchema>;

// Raw candidate evidence from LLM inference (before deterministic policy evaluation)
export const CandidateFactSchema = z.object({
  dimension: z.string(),
  value: z.any(),
  rawValue: z.string(),
  evidence: z.string(),
});
export type CandidateFact = z.infer<typeof CandidateFactSchema>;

export const CandidatePathHintSchema = z.object({
  pathId: z.string(),
  rationale: z.string(),
});
export type CandidatePathHint = z.infer<typeof CandidatePathHintSchema>;

export const GeminiExtractionResponseSchema = z.object({
  facts: z.array(CandidateFactSchema),
  detectedGoal: z.string().nullable().optional(),
  candidatePathHints: z.array(CandidatePathHintSchema).optional(),
});
export type GeminiExtractionResponse = z.infer<typeof GeminiExtractionResponseSchema>;

export const QuestionProposalResultSchema = z.object({
  candidates: z.array(
    z.object({
      dimension: z.string(),
      question: z.string(),
      answerType: AnswerTypeSchema,
      options: z.array(z.string()).optional(),
      why: z.string(),
      predictedAnswerBuckets: z.array(z.string()),
    })
  ),
});
export type QuestionProposalResult = z.infer<typeof QuestionProposalResultSchema>;

export const GeminiQuestionCandidateSchema = z.object({
  dimension: z.string(),
  question: z.string().min(5),
  answerType: AnswerTypeSchema,
  options: z.array(z.string()).optional(),
  why: z.string().min(5),
  predictedAnswerBuckets: z.array(z.string()).optional(),
});
export type GeminiQuestionCandidate = z.infer<typeof GeminiQuestionCandidateSchema>;

export const GeminiQuestionProposalResponseSchema = z.object({
  candidates: z.array(GeminiQuestionCandidateSchema),
});
export type GeminiQuestionProposalResponse = z.infer<typeof GeminiQuestionProposalResponseSchema>;

export const RoadmapExplanationResultSchema = z.object({
  selectedPathId: z.string(),
  assumptions: z.array(z.string()),
  milestoneExplanations: z.array(
    z.object({
      skillId: z.string(),
      why: z.string(),
    })
  ),
  warnings: z.array(z.string()),
});
export type RoadmapExplanationResult = z.infer<typeof RoadmapExplanationResultSchema>;

export interface LlmExecutionMetadata {
  provider: "gemini" | "deterministic" | "openai";
  modelName: string;
  fallbackUsed: boolean;
  failureCategory?:
    | "timeout"
    | "abort"
    | "rate_limit"
    | "auth_failure"
    | "blocked_content"
    | "malformed_response"
    | "invalid_json"
    | "invalid_schema"
    | "provider_error"
    | "unsupported_model";
  latencyMs: number;
  requestId: string;
}

// ==========================================
// 10. API REQUEST & RESPONSE SCHEMAS
// ==========================================

export const IntakeMessageRequestSchema = z.object({
  message: z.string().min(1),
  currentProfileId: z.string().optional(),
  modelProvider: z.enum(["gemini", "openai", "deterministic"]).optional(),
  apiKey: z.string().optional(),
  modelName: z.string().min(1).max(100).optional(),
});
export type IntakeMessageRequest = z.infer<typeof IntakeMessageRequestSchema>;

export const AnswerQuestionRequestSchema = z.object({
  questionId: z.string(),
  dimension: z.string(),
  answer: z.string().or(z.array(z.string())),
  modelProvider: z.enum(["gemini", "openai", "deterministic"]).optional(),
  apiKey: z.string().optional(),
  modelName: z.string().min(1).max(100).optional(),
});
export type AnswerQuestionRequest = z.infer<typeof AnswerQuestionRequestSchema>;

export const CorrectFactRequestSchema = z.object({
  dimension: z.string(),
  newValue: z.any(),
  reason: z.string().optional(),
});
export type CorrectFactRequest = z.infer<typeof CorrectFactRequestSchema>;

export const CreateScenarioRequestSchema = z.object({
  baseRoadmapId: z.string(),
  name: z.string(),
  overrides: z.object({
    hoursPerWeek: z.number().optional(),
    targetDomain: z.string().optional(),
    primaryLanguage: z.string().optional(),
    targetRole: z.string().optional(),
    deadlineMonths: z.number().optional(),
  }),
});
export type CreateScenarioRequest = z.infer<typeof CreateScenarioRequestSchema>;

export const AssessmentSubmissionRequestSchema = z.object({
  skillId: z.string(),
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  notes: z.string().optional(),
});
export type AssessmentSubmissionRequest = z.infer<typeof AssessmentSubmissionRequestSchema>;

export const FeedbackSubmissionRequestSchema = z.object({
  milestoneId: z.string(),
  difficulty: z.number().min(1).max(5),
  confidence: z.number().min(1).max(5),
  usefulness: z.number().min(1).max(5),
  blockers: z.string().optional(),
});
export type FeedbackSubmissionRequest = z.infer<typeof FeedbackSubmissionRequestSchema>;
