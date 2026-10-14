const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");
const { createLoader } = require("../load-ts.cjs");
require("@next/env").loadEnvConfig(process.cwd(), true);

test("email-only signup, code verification, resend, and password sign-in", {
  timeout: 60000,
  skip: process.env.EMAIL_VERIFICATION_REQUIRED === "false" || (process.env.EMAIL_DELIVERY_ENABLED === "true" && Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)),
}, async () => {
  const base = process.env.TEST_APP_URL || process.env.APP_URL || "http://localhost:3000";
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const email = `auth-flow-${randomUUID()}@example.test`;
  const password = "owner-chosen-password-for-test";
  let id;
  const request = (endpoint, body) => fetch(base + "/api/auth/" + endpoint, {
    method: "POST", redirect: "manual", headers: { Origin: base, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const inbox = () => path.resolve("data/mail", `${id}.json`);
  const readCode = async () => JSON.parse(await fs.readFile(inbox(), "utf8")).text.match(/code is: (\d{8})/)[1];
  try {
    const signup = await request("register", { email });
    assert.equal(signup.status, 201);
    assert.deepEqual(await signup.json(), { success: true, data: { delivery: "local" } });
    assert.equal(signup.headers.get("set-cookie"), null);
    const user = (await pool.query("SELECT id,password_hash,email_verified FROM users WHERE email=$1", [email])).rows[0];
    id = user.id;
    assert.equal(user.password_hash, null); assert.equal(user.email_verified, false);
    const code = await readCode();
    const oldHashes = (await pool.query("SELECT token_hash FROM email_verifications WHERE user_id=$1", [id])).rows.map(row => row.token_hash);
    assert.equal(oldHashes.length, 2); assert.ok(!oldHashes.includes(code));
    assert.equal((await request("login", { email, password })).status, 400);
    assert.equal((await request("verify-email", { email: "other@example.test", code, password })).status, 400);
    assert.equal((await request("verify-email", { email, code, password: "short" })).status, 400);
    await pool.query("UPDATE email_verifications SET expires_at=now()-interval '1 second' WHERE user_id=$1", [id]);
    assert.equal((await request("verify-email", { email, code, password })).status, 400);
    assert.equal((await request("resend-verification", { email })).status, 200);
    const newCode = await readCode();
    const newHashes = (await pool.query("SELECT token_hash FROM email_verifications WHERE user_id=$1", [id])).rows.map(row => row.token_hash);
    assert.equal(newHashes.length, 2);
    assert.ok(!newHashes.includes(oldHashes[0])); // Old activation link is revoked too.
    const nextHash = createHash("sha256").update(`email-verification:${email}:${newCode}`).digest("hex");
    assert.ok(newHashes.includes(nextHash));
    // A failed delivery rolls back revocation, preserving the last working code.
    const before = { fetch: global.fetch, mode: process.env.NODE_ENV, key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM, enabled: process.env.EMAIL_DELIVERY_ENABLED };
    try {
      process.env.NODE_ENV = "production"; process.env.RESEND_API_KEY = "test-only"; process.env.EMAIL_FROM = "test@example.test";
      process.env.EMAIL_DELIVERY_ENABLED = "true";
      global.fetch = async () => new Response("", { status: 503 });
      const load = createLoader({ "@jobhunt/api/database/pool": { getPool: () => pool }, "@jobhunt/api/auth/service": { appUrl: () => base } });
      await assert.rejects(load("@jobhunt/api/auth/verification").sendVerification(email));
      assert.deepEqual((await pool.query("SELECT token_hash FROM email_verifications WHERE user_id=$1 ORDER BY token_hash", [id])).rows.map(row => row.token_hash), newHashes.sort());
    } finally {
      global.fetch = before.fetch;
      for (const [key, value] of [["NODE_ENV", before.mode], ["RESEND_API_KEY", before.key], ["EMAIL_FROM", before.from], ["EMAIL_DELIVERY_ENABLED", before.enabled]]) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
    const verified = await request("verify-email", { email, code: newCode, password });
    assert.equal(verified.status, 200); assert.deepEqual(await verified.json(), { success: true });
    assert.equal((await pool.query("SELECT 1 FROM email_verifications WHERE user_id=$1", [id])).rowCount, 0);
    assert.equal((await request("verify-email", { email, code: newCode, password })).status, 400);
    const login = await request("login", { email, password });
    assert.equal(login.status, 200); assert.deepEqual(await login.json(), { success: true, data: { redirect: "/profile" } });
    assert.ok(login.headers.getSetCookie().some(value => value.startsWith("jobhunt_session=")));
  } finally {
    await pool.query("DELETE FROM users WHERE email=$1", [email]);
    if (id) await fs.rm(inbox(), { force: true });
    await pool.end();
  }
});
