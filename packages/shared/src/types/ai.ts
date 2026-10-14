export const AI_PROVIDERS = ["gemini", "openai", "groq"] as const;

export type AIProvider = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  groq: "Groq",
};

export type AIFailure = {
  success: false;
  error: string;
  code?: "AI_LIMIT_REACHED" | "APP_LIMIT_REACHED" | "AI_UNAVAILABLE" | "AI_NOT_CONFIGURED";
  provider?: AIProvider;
  retryAfterSeconds?: number;
};

export type AISettings = {
  provider: AIProvider;
  updated_at: string | null;
};

export type AIProviderStatus = {
  id: AIProvider;
  model: string;
  configured: boolean;
};

export function isAIProvider(value: unknown): value is AIProvider {
  return value === "gemini" || value === "openai" || value === "groq";
}
