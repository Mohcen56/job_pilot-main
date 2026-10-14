import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getPool } from "../database/pool";
import { hashPassword, verifyPassword } from "./password";
import { hashToken } from "./session";
import { sendVerification } from "./verification";
import { AuthRequestError } from "./errors";
import { emailDeliveryConfigured, skipEmailVerification } from "./email-delivery";
export type OAuthProvider = "google" | "github";
export function appUrl() {
  const url = new URL(process.env.APP_URL || "http://localhost:3000");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Production APP_URL must use HTTPS");
  return url.origin;
}
function providerConfig(provider: OAuthProvider) {
  const prefix = provider.toUpperCase();
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) throw new Error("OAuth provider is not configured");
  return { clientId, clientSecret, redirectUri: `${appUrl()}/api/auth/callback/${provider}` };
}
const credentials = z.object({ email: z.email().max(254).transform((value) => value.toLowerCase()), password: z.string().min(12).max(256) });
async function fetchJson(url: string, options: RequestInit) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("OAuth request failed");
  return response.json();
}
@Injectable()
export class AuthService {
  async limit(ip: string, email?: unknown) {
    await getPool().query("DELETE FROM auth_limits WHERE expires_at < now()-interval '1 day'");
    const keys = [{ key: hashToken(`auth:${ip}`), max: 100 }];
    if (typeof email === "string") keys.push({ key: hashToken(`auth-email:${email.trim().toLowerCase().slice(0,254)}`), max: 20 });
    for (const { key, max } of keys) {
      const { rows } = await getPool().query(`INSERT INTO auth_limits(key,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes')
        ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_limits.expires_at<=now() THEN 1 ELSE auth_limits.attempts+1 END,
        expires_at=CASE WHEN auth_limits.expires_at<=now() THEN now()+interval '15 minutes' ELSE auth_limits.expires_at END RETURNING attempts`, [key]);
      if (rows[0].attempts > max) throw new AuthRequestError("Too many attempts. Please wait 15 minutes before trying again.", 429);
    }
  }
  async register(input: unknown): Promise<{ userId: string } | { delivery: "email" | "local" }> {
    const skipVerification = skipEmailVerification();
    const data = (skipVerification ? credentials : credentials.extend({ password: z.string().min(12).max(256).optional() })).parse(input);
    if (process.env.NODE_ENV === "production" && !emailDeliveryConfigured()) throw new AuthRequestError("Email verification is temporarily unavailable. Please try again later.", 503);
    const password = data.password ? await hashPassword(data.password) : null;
    const client = await getPool().connect();
    let userId: string | undefined;
    try {
      await client.query("BEGIN");
      const sql = skipVerification
        ? `INSERT INTO users(email,password_hash,email_verified) VALUES($1,$2,true)
           ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,email_verified=true
           WHERE NOT users.email_verified RETURNING id`
        : "INSERT INTO users(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING RETURNING id";
      const { rows } = await client.query(sql, [data.email, password]);
      userId = rows[0]?.id;
      if (skipVerification && !userId) throw new AuthRequestError("This account already exists. Please sign in.");
      if (userId) await client.query("INSERT INTO profiles(id,email) VALUES($1,$2) ON CONFLICT(id) DO NOTHING", [userId, data.email]);
      if (skipVerification) {
        await client.query("DELETE FROM email_verifications WHERE user_id=$1", [userId]);
        await client.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    if (skipVerification && userId) return { userId };
    return { delivery: await sendVerification(data.email) };
  }
  async login(input: unknown) {
    const data = credentials.parse(input);
    const { rows } = await getPool().query("SELECT id,password_hash,email_verified FROM users WHERE email=$1", [data.email]);
    if (!await verifyPassword(data.password, rows[0]?.password_hash ?? null) || !rows[0]?.email_verified) throw new Error("Invalid credentials");
    return rows[0].id as string;
  }
  async startOAuth(provider: OAuthProvider) {
    const config = providerConfig(provider);
    const state = randomBytes(32).toString("hex");
    const verifier = randomBytes(32).toString("base64url");
    await getPool().query("DELETE FROM oauth_states WHERE expires_at < now()");
    await getPool().query("INSERT INTO oauth_states(state_hash,provider,verifier,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')", [hashToken(state), provider, verifier]);
    const url = new URL(provider === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: provider === "google" ? "openid email profile" : "read:user user:email", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
    return { state, url: url.toString() };
  }
  async finishOAuth(provider: OAuthProvider, state: string, code: string, cookieState?: string) {
    if (!/^[a-f0-9]{64}$/.test(state) || state !== cookieState || !code || code.length > 2048) throw new Error("Invalid OAuth state");
    const config = providerConfig(provider);
    const { rows } = await getPool().query("DELETE FROM oauth_states WHERE state_hash=$1 AND provider=$2 AND expires_at>now() RETURNING verifier", [hashToken(state), provider]);
    if (!rows[0]) throw new Error("Expired OAuth state");
    const token = await fetchJson(provider === "google" ? "https://oauth2.googleapis.com/token" : "https://github.com/login/oauth/access_token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, code, code_verifier: rows[0].verifier, grant_type: "authorization_code" }),
    });
    if (typeof token.access_token !== "string") throw new Error("OAuth exchange failed");
    const headers = { Authorization: `Bearer ${token.access_token}`, Accept: "application/json", "User-Agent": "JobHunt-EZ" };
    let subject: string, email: string, name: string | null, avatar: string | null;
    if (provider === "google") {
      const profile = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", { headers });
      if (profile.email_verified !== true || typeof profile.sub !== "string") throw new Error("Verified email required");
      subject = profile.sub; email = z.email().parse(profile.email).toLowerCase(); name = profile.name ?? null; avatar = profile.picture ?? null;
    } else {
      const profile = await fetchJson("https://api.github.com/user", { headers });
      const emails = await fetchJson("https://api.github.com/user/emails", { headers });
      const primary = z.array(z.object({ email: z.email(), verified: z.boolean(), primary: z.boolean() })).parse(emails).find((item) => item.verified && item.primary);
      if (!primary || typeof profile.id !== "number") throw new Error("Verified email required");
      subject = String(profile.id); email = primary.email.toLowerCase(); name = profile.name ?? profile.login; avatar = profile.avatar_url ?? null;
    }
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${provider}:${subject}`]);
      const existing = await client.query("SELECT user_id FROM oauth_accounts WHERE provider=$1 AND subject=$2", [provider, subject]);
      let userId = existing.rows[0]?.user_id as string | undefined;
      if (!userId) {
        // A verified provider can claim a pending signup, never an activated account.
        const claimed = await client.query("UPDATE users SET email_verified=true,password_hash=NULL,name=$2,avatar_url=$3 WHERE email=$1 AND NOT email_verified RETURNING id", [email, name, avatar]);
        if (claimed.rows[0]) {
          userId = claimed.rows[0].id;
          await client.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
          await client.query("DELETE FROM email_verifications WHERE user_id=$1", [userId]);
        } else {
          const created = await client.query("INSERT INTO users(email,name,avatar_url,email_verified) VALUES($1,$2,$3,true) RETURNING id", [email, name, avatar]);
          userId = created.rows[0].id;
        }
        await client.query("INSERT INTO oauth_accounts(provider,subject,user_id) VALUES($1,$2,$3)", [provider, subject, userId]);
        await client.query("INSERT INTO profiles(id,email,full_name) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,full_name=EXCLUDED.full_name", [userId, email, name]);
      }
      await client.query("COMMIT");
      return userId!;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
