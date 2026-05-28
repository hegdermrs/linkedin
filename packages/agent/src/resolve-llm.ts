import type { LlmConfig } from "./llm.js";

export const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";

export interface AgencyLlmSettings {
  llmProvider: string;
  llmModel: string;
  temperature?: number;
  maxTokens?: number;
}

/** API key for the configured provider (DeepSeek is the default for this project). */
export function resolveLlmApiKey(provider: string): string {
  const deepseek =
    process.env.DEEPSEEK_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";

  switch (provider) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY?.trim() ?? "";
    case "openai":
      return process.env.OPENAI_API_KEY?.trim() || deepseek;
    case "deepseek":
    default:
      return deepseek;
  }
}

export function resolveLlmBaseUrl(provider: string): string | undefined {
  switch (provider) {
    case "deepseek":
      return (
        process.env.DEEPSEEK_BASE_URL?.trim() || DEEPSEEK_DEFAULT_BASE_URL
      );
    case "openai":
      return process.env.OPENAI_BASE_URL?.trim() || undefined;
    default:
      return undefined;
  }
}

export function defaultLlmProvider(): string {
  return process.env.DEFAULT_LLM_PROVIDER?.trim() || "deepseek";
}

export function defaultLlmModel(): string {
  return process.env.DEFAULT_LLM_MODEL?.trim() || DEEPSEEK_DEFAULT_MODEL;
}

export function resolveLlmConfig(agency: AgencyLlmSettings): LlmConfig {
  const provider = agency.llmProvider || defaultLlmProvider();
  return {
    provider,
    model: agency.llmModel || defaultLlmModel(),
    apiKey: resolveLlmApiKey(provider),
    baseURL: resolveLlmBaseUrl(provider),
    temperature: agency.temperature,
    maxTokens: agency.maxTokens,
  };
}
