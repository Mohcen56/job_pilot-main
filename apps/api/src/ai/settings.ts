import { getPool } from "../database/pool";
import { AIServiceError } from "../lib/ai-errors";
import { isAIProvider, type AISettings } from "@jobhunt/shared/ai";
export async function getAISettings(): Promise<AISettings> {
  try {
    const { rows } = await getPool().query("SELECT provider,updated_at FROM ai_settings WHERE id='global'");
    const data = rows[0];
    if (!data || !isAIProvider(data.provider)) throw new Error("Invalid settings");
    return { provider: data.provider, updated_at: data.updated_at };
  } catch {
    throw new AIServiceError({ success: false, code: "AI_UNAVAILABLE", error: "AI settings are temporarily unavailable. Please try again shortly." });
  }
}
