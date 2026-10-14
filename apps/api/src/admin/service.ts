import type { BackendContext } from "../context";
import { isAdminUser } from "./authorization";


import { getProviderConfig } from "../ai/config";
import { AIServiceError } from "../lib/ai-errors";
import { isAIProvider, type AISettings } from "@jobhunt/shared/ai";

export async function saveAIProvider(
  provider: unknown,
  context: BackendContext,
): Promise<
  { success: true; data: AISettings } | { success: false; error: string }
> {
  try {
    const user = context.user;
    if (!user || !(await isAdminUser(context))) {
      return {
        success: false,
        error: "You do not have permission to change AI settings.",
      };
    }
    if (!isAIProvider(provider)) {
      return { success: false, error: "Choose Gemini, OpenAI, or Groq." };
    }
    getProviderConfig(provider);
    const backend = context;
    const { data, error } = await backend.database
      .from("ai_settings")
      .update({ provider, updated_by: user.id })
      .eq("id", "global")
      .select("provider,updated_at")
      .maybeSingle<AISettings>();
    if (error || !data) {
      return {
        success: false,
        error:
          "Settings could not be saved. Check the database setup and try again.",
      };
    }
    return { success: true, data };
  } catch (error) {
    if (error instanceof AIServiceError)
      return { success: false, error: error.message };
    console.error("[actions/ai-settings] Save failed");
    return {
      success: false,
      error: "Settings could not be saved. Please try again.",
    };
  }
}
