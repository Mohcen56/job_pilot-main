import { randomUUID } from "node:crypto";
import { getPool } from "./database/pool";
import type { BackendContext } from "./context";
import type { AIFailure } from "@jobhunt/shared/ai";

export class UsageLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number, message: string) { super(message); }
  failure(): AIFailure {
    return { success: false, code: "APP_LIMIT_REACHED", error: this.message, retryAfterSeconds: this.retryAfterSeconds };
  }
}
function setting(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid ${name}`);
  return value;
}

/** Shared across API endpoints and Server Actions, with atomic database reservations. */
export async function withUsageLimit<T>(context: BackendContext, work: () => Promise<T>): Promise<T> {
  if (!context.user) throw new Error("Unauthorized");
  const pool = getPool();
  const client = await pool.connect();
  const id = randomUUID();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(78419231)");
    await client.query("DELETE FROM usage_leases WHERE expires_at <= now()");
    await client.query("DELETE FROM usage_counters WHERE window_start < now()-interval '2 days'");
    const leases = await client.query("SELECT user_id FROM usage_leases");
    if (leases.rows.some((row) => row.user_id === context.user!.id)) {
      throw new UsageLimitError(30, "An AI task is already running for your account. Please wait for it to finish.");
    }
    if (leases.rows.length >= setting("AI_MAX_CONCURRENT", 3)) {
      throw new UsageLimitError(30, "The AI assistant is busy. Please try again in a moment.");
    }
    const windows = await client.query("SELECT date_trunc('hour',now()) AS hour, date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS day, now() AS current");
    const { hour, day, current } = windows.rows[0];
    const budgets = [
      { key: `user-hour:${context.user.id}`, start: hour, seconds: 3600, max: setting("AI_USER_HOURLY_LIMIT", 5) },
      { key: `user-day:${context.user.id}`, start: day, seconds: 86400, max: setting("AI_USER_DAILY_LIMIT", 20) },
      { key: "global-day", start: day, seconds: 86400, max: setting("AI_GLOBAL_DAILY_LIMIT", 200) },
    ];
    for (const budget of budgets) {
      const result = await client.query(`INSERT INTO usage_counters(key,window_start,used) VALUES($1,$2,1)
        ON CONFLICT(key,window_start) DO UPDATE SET used=usage_counters.used+1
        WHERE usage_counters.used < $3 RETURNING used`, [budget.key, budget.start, budget.max]);
      if (!result.rowCount) {
        const retry = Math.max(1, Math.ceil((new Date(budget.start).getTime()+budget.seconds*1000-new Date(current).getTime())/1000));
        throw new UsageLimitError(retry, "The AI usage allowance has been reached. Please try again after the allowance resets.");
      }
    }
    await client.query("INSERT INTO usage_leases(id,user_id,expires_at) VALUES($1,$2,now()+interval '10 minutes')", [id, context.user.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
  // Refresh the lease for long browser/PDF tasks; a crashed process expires automatically.
  const heartbeat = setInterval(() => {
    void pool.query("UPDATE usage_leases SET expires_at=now()+interval '10 minutes' WHERE id=$1", [id])
      .catch(() => console.error("[usage] Lease refresh failed"));
  }, 60000);
  heartbeat.unref();
  try { return await work(); }
  finally {
    clearInterval(heartbeat);
    await pool.query("DELETE FROM usage_leases WHERE id=$1", [id]).catch(() => console.error("[usage] Lease release failed"));
  }
}

export async function limitedResponse(context: BackendContext, work: () => Promise<Response>): Promise<Response> {
  if (!context.user) return work();
  try { return await withUsageLimit(context, work); }
  catch (error) {
    if (error instanceof UsageLimitError) return Response.json(error.failure(), { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    console.error("[usage] Task admission failed");
    return Response.json({ success: false, error: "The assistant is temporarily unavailable. Please try again later." }, { status: 503 });
  }
}
