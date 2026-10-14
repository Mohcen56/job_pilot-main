

import {
  AI_PROVIDERS,
  AI_PROVIDER_LABELS,
  type AIProvider,
  type AIProviderStatus,
} from "@jobhunt/shared/ai";
import { AIServiceError } from "../lib/ai-errors";

const providerConfig = {
  gemini: {
    key: "GEMINI_API_KEY",
    model: "GEMINI_MODEL",
    defaultModel: "gemini-3.8-flash",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
  openai: {
    key: "OPENAI_API_KEY",
    model: "OPENAI_MODEL",
    defaultModel: "gpt-4o",
    baseURL: "https://api.openai.com/v1",
  },
  groq: {
    key: "GROQ_API_KEY",
    model: "GROQ_MODEL",
    defaultModel: "openai/gpt-oss-120b",
    baseURL: "https://api.groq.com/openai/v1",
  },
} satisfies Record<
  AIProvider,
  { key: string; model: string; defaultModel: string; baseURL: string }
>;

export function getProviderStatuses(): AIProviderStatus[] {
  return AI_PROVIDERS.map((id) => ({
    id,
    model:
      process.env[providerConfig[id].model]?.trim() ||
      providerConfig[id].defaultModel,
    configured: Boolean(process.env[providerConfig[id].key]?.trim()),
  }));
}

export function getProviderConfig(provider: AIProvider): {
  apiKey: string;
  model: string;
  baseURL: string;
} {
  const config = providerConfig[provider];
  const apiKey = process.env[config.key]?.trim();
  if (!apiKey) {
    throw new AIServiceError({
      success: false,
      code: "AI_NOT_CONFIGURED",
      provider,
      error: `${AI_PROVIDER_LABELS[provider]} is not configured yet. Ask an administrator to add its API key or choose another provider.`,
    });
  }
  return {
    apiKey,
    model: process.env[config.model]?.trim() || config.defaultModel,
    baseURL: config.baseURL,
  };
}
