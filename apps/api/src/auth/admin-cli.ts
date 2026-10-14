import "../env";
import { closePool, getPool } from "../database/pool";

async function provision() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Usage: pnpm admin:grant you@example.com");
  const result = await getPool().query(
    "INSERT INTO app_admins(user_id) SELECT id FROM users WHERE email=$1 AND email_verified ON CONFLICT DO NOTHING RETURNING user_id", [email],
  );
  const exists = await getPool().query("SELECT 1 FROM app_admins a JOIN users u ON u.id=a.user_id WHERE u.email=$1 AND u.email_verified", [email]);
  if (!exists.rowCount) throw new Error("Create and verify your account first, then run this command again.");
  console.log(result.rowCount ? "Admin access granted." : "Account already has admin access.");
}
provision().catch((error: Error) => { console.error(error.message); process.exitCode = 1; }).finally(closePool);
