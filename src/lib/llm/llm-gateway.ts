import {
  IntentExtractionPort,
  QuestionProposalPort,
  RoadmapExplanationPort,
  CapabilityAssessmentPort,
  CurriculumDiscoveryPort,
} from "./ports";
import { DeterministicLlmAdapter } from "./deterministic-adapter";
import { GeminiLlmAdapter } from "./gemini-adapter";
import { GroqLlmAdapter, DEFAULT_GROQ_MODEL } from "./groq-adapter";
import { OpenAiLlmAdapter } from "./openai-adapter";

export interface LlmGatewayConfig {
  provider?: "gemini" | "openai" | "deterministic" | "groq";
  apiKey?: string;
  modelName?: string;
}

export class LlmGateway {
  private deterministicAdapter: DeterministicLlmAdapter;

  constructor() {
    this.deterministicAdapter = new DeterministicLlmAdapter();
  }

  /**
   * Resolves the active LLM adapter based on dynamic configuration or process environment.
   */
  public getAdapter(
    config?: LlmGatewayConfig
  ): IntentExtractionPort &
    QuestionProposalPort &
    RoadmapExplanationPort &
    CapabilityAssessmentPort &
    CurriculumDiscoveryPort {
    let provider = config?.provider || (process.env.PATHFINDER_LLM_PROVIDER as LlmGatewayConfig["provider"]);
    if (!provider) {
      provider = this.detectDefaultProvider(config?.apiKey);
    }

    const apiKey =
      config?.apiKey ||
      (provider === "groq" ? process.env.GROQ_API_KEY : undefined) ||
      (provider === "gemini" ? (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) : undefined) ||
      (provider === "openai" ? process.env.OPENAI_API_KEY : undefined) ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.OPENAI_API_KEY;

    if (provider === "gemini" && apiKey) {
      return new GeminiLlmAdapter(apiKey, config?.modelName || process.env.PATHFINDER_LLM_MODEL || "gemini-2.5-flash", this.deterministicAdapter);
    }

    if (provider === "groq" && apiKey) {
      return new GroqLlmAdapter(apiKey, config?.modelName || process.env.PATHFINDER_LLM_MODEL || DEFAULT_GROQ_MODEL, this.deterministicAdapter);
    }

    if (provider === "openai" && apiKey) {
      return new OpenAiLlmAdapter(apiKey, config?.modelName || process.env.PATHFINDER_LLM_MODEL || "gpt-4o-mini", this.deterministicAdapter);
    }

    // Default to high-performance deterministic engine
    return this.deterministicAdapter;
  }

  private detectDefaultProvider(customKey?: string): "gemini" | "openai" | "deterministic" | "groq" {
    if (customKey) {
      if (customKey.startsWith("AIza")) return "gemini";
      if (customKey.startsWith("gsk_")) return "groq";
      if (customKey.startsWith("sk-")) return "openai";
    }
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
    if (process.env.GROQ_API_KEY) return "groq";
    if (process.env.OPENAI_API_KEY) return "openai";
    return "deterministic";
  }
}

