const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
require("@next/env").loadEnvConfig(process.cwd(), true);

test("local signup skips codes, preserves pending profile data and cannot replace active credentials", {
  timeout: 60000, skip: process.env.EMAIL_VERIFICATION_REQUIRED !== "false",
}, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const base = process.env.TEST_APP_URL || process.env.APP_URL || "http://localhost:3000";
  const emails = [1, 2].map(() => `direct-signup-${randomUUID()}@example.test`);
  const password = "local-owner-password-test";
  const request = (endpoint, body) => fetch(`${base}/api/auth/${endpoint}`, { method: "POST", redirect: "manual", headers: { Origin: base, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    const pending = (await pool.query("INSERT INTO users(email) VALUES($1) RETURNING id", [emails[1]])).rows[0].id;
    await pool.query("INSERT INTO profiles(id,email,location) VALUES($1,$2,'Existing location')", [pending, emails[1]]);
    for (const email of emails) {
      assert.equal((await request("register", { email })).status, 400);
      const signup = await request("register", { email, password });
      assert.equal(signup.status, 201); assert.deepEqual(await signup.json(), { success: true, data: { redirect: "/profile" } });
      const cookie = signup.headers.getSetCookie().find(value => value.startsWith("jobhunt_session="))?.split(";")[0];
      assert.ok(cookie);
      assert.equal((await fetch(`${base}/api/profile`, { headers: { Cookie: cookie } })).status, 200);
      const user = (await pool.query("SELECT id,email_verified,password_hash FROM users WHERE email=$1", [email])).rows[0];
      assert.equal(user.email_verified, true); assert.ok(user.password_hash);
      assert.equal((await pool.query("SELECT 1 FROM email_verifications WHERE user_id=$1", [user.id])).rowCount, 0);
      assert.equal((await request("register", { email, password: "replacement-password-test" })).status, 400);
      assert.equal((await request("login", { email, password })).status, 200);
      assert.equal((await request("login", { email, password: "replacement-password-test" })).status, 400);
    }
    const profile = (await pool.query("SELECT location FROM profiles WHERE id=$1", [pending])).rows[0];
    assert.equal(profile.location, "Existing location");
  } finally { await pool.query("DELETE FROM users WHERE email=ANY($1::text[])", [emails]); await pool.end(); }
});
