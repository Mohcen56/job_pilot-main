import { randomBytes, randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getPool } from "../database/pool";
import { hashToken } from "./session";
import { hashPassword } from "./password";
import { appUrl } from "./service";
import { workspaceRoot } from "../paths";
import { AuthRequestError } from "./errors";
import { emailDeliveryConfigured } from "./email-delivery";

export function verificationCodeHash(email: string, code: string): string {
  return hashToken(`email-verification:${email.toLowerCase()}:${code}`);
}

export async function sendVerification(email: string): Promise<"email" | "local"> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const delivery = emailDeliveryConfigured() ? "email" : "local";
  if (delivery === "local" && process.env.NODE_ENV !== "development") {
    throw new AuthRequestError("Email verification is temporarily unavailable. Please try again later.", 503);
  }
  const token = randomBytes(32).toString("hex");
  const code = randomInt(0, 100000000).toString().padStart(8, "0");
  const hashes = [hashToken(token), verificationCodeHash(email, code)];
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Serialize resends so concurrent deliveries cannot invalidate each other.
    const user = await client.query("SELECT id FROM users WHERE email=$1 AND NOT email_verified FOR UPDATE", [email]);
    if (!user.rowCount) { await client.query("COMMIT"); return delivery; }
    const id: string = user.rows[0].id;
    await client.query("DELETE FROM email_verifications WHERE user_id=$1", [id]);
    for (const hash of hashes) {
      await client.query("INSERT INTO email_verifications(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')", [hash, id]);
    }
    const text = `Your JobHunt EZ verification code is: ${code}\n\nEnter this code and choose your password to activate your account. Or open: ${appUrl()}/verify-email?token=${token}\n\nThe code and link expire in 15 minutes. If you did not request this, ignore this email.`;
    if (delivery === "local") {
      // Private development inbox only; never expose codes through HTTP or logs.
      const directory = path.join(workspaceRoot, "data/mail");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(path.join(directory, `${id}.json`), JSON.stringify({ to: email, subject: "Verify your JobHunt EZ account", text }, null, 2), { mode: 0o600 });
    } else {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [email], subject: "Verify your JobHunt EZ account", text }),
      });
      if (!response.ok) throw new Error("Email delivery failed");
    }
    await client.query("COMMIT");
    return delivery;
  } catch {
    await client.query("ROLLBACK");
    throw new AuthRequestError("We couldn't send the verification email. Please try again shortly.", 503);
  } finally { client.release(); }
}

export async function activateAccount(input: unknown): Promise<void> {
  const data = z.object({
    token: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    email: z.email().max(254).transform(value => value.toLowerCase()).optional(),
    code: z.string().regex(/^\d{8}$/).optional(),
    password: z.string().min(12).max(256),
  }).refine(value => Boolean(value.token || (value.email && value.code))).parse(input);
  const hash = data.token ? hashToken(data.token) : verificationCodeHash(data.email!, data.code!);
  const password = await hashPassword(data.password);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`SELECT u.id FROM users u JOIN email_verifications v ON u.id=v.user_id
      WHERE v.token_hash=$1 AND v.expires_at>now() AND NOT u.email_verified FOR UPDATE OF u`, [hash]);
    if (!result.rowCount) throw new AuthRequestError("This code or link is invalid or expired. Request a new code and try again.");
    const id = result.rows[0].id;
    // The email owner chooses a fresh password, replacing any pre-registration password.
    await client.query("UPDATE users SET email_verified=true,password_hash=$2 WHERE id=$1", [id, password]);
    await client.query("DELETE FROM email_verifications WHERE user_id=$1", [id]);
    await client.query("DELETE FROM sessions WHERE user_id=$1", [id]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
