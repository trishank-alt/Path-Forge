import {
  IntentExtractionResult,
  QuestionProposalResult,
  RoadmapExplanationResult,
  ProfileFact,
  PathHypothesis,
  Roadmap,
} from "../contracts";

export interface IntakeContext {
  message: string;
  existingFacts: ProfileFact[];
  currentHypotheses: PathHypothesis[];
}

export interface QuestionContext {
  goalText: string;
  existingFacts: ProfileFact[];
  currentHypotheses: PathHypothesis[];
  unknownDimensions: string[];
}

export interface ExplanationContext {
  roadmap: Roadmap;
  facts: ProfileFact[];
}

export interface IntentExtractionPort {
  extract(context: IntakeContext): Promise<IntentExtractionResult>;
}

export interface QuestionProposalPort {
  proposeQuestions(context: QuestionContext): Promise<QuestionProposalResult>;
}

export interface RoadmapExplanationPort {
  explainRoadmap(context: ExplanationContext): Promise<RoadmapExplanationResult>;
}
