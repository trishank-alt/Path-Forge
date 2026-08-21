import {
  IntentExtractionPort,
  QuestionProposalPort,
  RoadmapExplanationPort,
} from "./ports";
import { DeterministicLlmAdapter } from "./deterministic-adapter";
import { GeminiLlmAdapter } from "./gemini-adapter";
import { OpenAiLlmAdapter } from "./openai-adapter";

export interface LlmGatewayConfig {
  provider?: "gemini" | "openai" | "deterministic";
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
  public getAdapter(config?: LlmGatewayConfig): IntentExtractionPort & QuestionProposalPort & RoadmapExplanationPort {
    const apiKey =
      config?.apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.OPENAI_API_KEY;

    let provider = config?.provider || (process.env.PATHFINDER_LLM_PROVIDER as LlmGatewayConfig["provider"]);
    if (!provider) {
      provider = this.detectDefaultProvider(config?.apiKey);
    }

    if (provider === "gemini" && apiKey) {
      return new GeminiLlmAdapter(apiKey, config?.modelName || process.env.PATHFINDER_LLM_MODEL || "gemini-2.5-flash", this.deterministicAdapter);
    }

    if (provider === "openai" && apiKey) {
      return new OpenAiLlmAdapter(apiKey, config?.modelName || process.env.PATHFINDER_LLM_MODEL || "gpt-4o-mini", this.deterministicAdapter);
    }

    // Default to high-performance deterministic engine
    return this.deterministicAdapter;
  }

  private detectDefaultProvider(customKey?: string): "gemini" | "openai" | "deterministic" {
    if (customKey) {
      if (customKey.startsWith("AIza")) return "gemini";
      if (customKey.startsWith("sk-")) return "openai";
    }
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
    if (process.env.OPENAI_API_KEY) return "openai";
    return "deterministic";
  }
}
