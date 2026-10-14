import { providerDiagnostic } from '../lib/provider-diagnostics';

import OpenAI from "openai";

import { getAISettings } from "./settings";
import { getProviderConfig } from "./config";
import { AIServiceError, normalizeAIError } from "../lib/ai-errors";
import type { AIProvider } from "@jobhunt/shared/ai";

type CompletionInput = {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature: number;
  max_tokens: number;
};

export async function completeAI(
  input: CompletionInput,
  selectedProvider?: AIProvider,
): Promise<string> {
  const provider = selectedProvider ?? (await getAISettings()).provider;
  const { apiKey, baseURL, model } = getProviderConfig(provider);
  try {
    // Surface quota failures promptly instead of silently retrying or billing another provider.
    const client = new OpenAI({
      apiKey,
      baseURL,
      maxRetries: 0,
      // Gemini's reasoning + multi-job structured output can exceed one minute.
      timeout: provider === "gemini" ? 120_000 : 60_000,
    });
    const request = {
      ...input,
      model,
      response_format: { type: "json_object" as const },
      ...(provider === "gemini"
        ? {
            reasoning_effort: "low" as const,
            max_tokens: Math.max(input.max_tokens, 8192),
          }
        : {}),
    };
    const send = () => client.chat.completions.create(request);
    let response;
    try { response = await send(); }
    catch (error) {
      const diagnostic = providerDiagnostic(error);
      // Retry only explicit temporary server failures, once, on the same provider.
      // Authentication, quotas, timeouts and ambiguous connection failures are never retried.
      if (![502,503,504].includes(diagnostic.httpStatus ?? 0)) throw error;
      console.warn('[ai] Temporary failure; retrying once', {provider,model,...diagnostic});
      await new Promise(resolve=>setTimeout(resolve,1000));
      response = await send();
    }
    const choice = response.choices[0];
    if (!choice?.message.content || choice.finish_reason !== "stop") {
      throw new AIServiceError({
        success: false,
        code: "AI_UNAVAILABLE",
        provider,
        error: choice?.finish_reason === "length"
          ? "The AI response reached its output limit. Please try a smaller search."
          : choice?.finish_reason === "content_filter"
            ? "The AI provider declined this content. Try a different search."
            : "The AI response was incomplete. Please try again.",
      });
    }
    try { JSON.parse(choice.message.content); }
    catch {
      throw new AIServiceError({ success: false, code: "AI_UNAVAILABLE", provider, error: "The AI returned an unreadable response. Please try again." });
    }
    return choice.message.content;
  } catch (error) {
    console.warn('[ai] Completion failed', {provider,model,...providerDiagnostic(error)});
    throw normalizeAIError(error, provider);
  }
}
