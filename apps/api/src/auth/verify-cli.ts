import "../env";
import { closePool, getPool } from "../database/pool";
import { z } from "zod";
async function verify(): Promise<void> {
  const email = z.email().parse(process.argv[2]?.trim().toLowerCase());
  const result = await getPool().query("UPDATE users SET email_verified=true WHERE email=$1 AND password_hash IS NOT NULL RETURNING id", [email]);
  if (!result.rowCount) throw new Error("Complete the verification code flow to choose your password first");
  await getPool().query("DELETE FROM email_verifications WHERE user_id=$1", [result.rows[0].id]);
  console.log("Account verified by the trusted operator.");
}
verify().catch(() => { console.error("Verification failed. Usage: pnpm auth:verify owner@example.com"); process.exitCode=1; }).finally(closePool);
