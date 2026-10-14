import { createHash, randomBytes } from "node:crypto";
import { getPool } from "../database/pool";

export const SESSION_COOKIE = "jobhunt_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export type User = { id: string; email: string; profile: { name: string | null; avatar_url: string | null } };
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function cookieValue(header: string | null | undefined, name: string) {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="))?.slice(name.length + 1);
}
export async function resolveSession(token?: string): Promise<User | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await getPool().query(
    `SELECT u.id, u.email, u.name, u.avatar_url FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.email_verified`, [hashToken(token)],
  );
  const row = rows[0];
  return row ? { id: row.id, email: row.email, profile: { name: row.name, avatar_url: row.avatar_url } } : null;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await getPool().query("DELETE FROM sessions WHERE expires_at < now()");
  await getPool().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now() + interval '7 days')", [hashToken(token), userId]);
  return token;
}
export async function revokeSession(token?: string) {
  if (token) await getPool().query("DELETE FROM sessions WHERE token_hash=$1", [hashToken(token)]);
}
