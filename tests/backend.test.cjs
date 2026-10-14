const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createLoader } = require("./load-ts.cjs");

test("passwords use unique salts and reject wrong passwords", async () => {
  const { hashPassword, verifyPassword } = createLoader()("@jobhunt/api/auth/password");
  const password = "test-only-strong-password";
  const first = await hashPassword(password);
  assert.notEqual(first, await hashPassword(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong", first), false);
  assert.equal(await verifyPassword(password, null), false);
  assert.ok(!first.includes(password));
});
test("session lookup rejects malformed tokens and only queries token hashes", async () => {
  const token = "ab".repeat(32);
  const calls = [];
  const load = createLoader({ "@jobhunt/api/database/pool": { getPool: () => ({ query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; } }) } });
  const { resolveSession, hashToken, cookieValue } = load("@jobhunt/api/auth/session");
  assert.equal(await resolveSession("invalid"), null);
  assert.equal(calls.length, 0);
  assert.equal(await resolveSession(token), null);
  assert.deepEqual(calls[0].values, [hashToken(token)]);
  assert.ok(calls[0].sql.includes("expires_at > now()"));
  assert.equal(cookieValue("other=1; jobhunt_session=" + token, "jobhunt_session"), token);
});
test("personal queries always enforce ownership and parameterize search input", async () => {
  const calls = [];
  const load = createLoader({ "@jobhunt/api/database/pool": { getPool: () => ({ query: async (sql, values) => { calls.push({ sql, values }); return { rows: [], rowCount: 0 }; } }) } });
  const { ScopedDatabase } = load("@jobhunt/api/database/database");
  const db = new ScopedDatabase("owner");
  await db.from("jobs").select().eq("user_id", "other").searchText(["title", "company"], "x' OR true --");
  assert.ok(calls[0].sql.includes('"user_id" = $1'));
  assert.equal(calls[0].values[0], "owner");
  assert.ok(!calls[0].sql.includes("OR true --"));
  assert.ok(calls[0].values.includes("%x' OR true --%"));
  await db.from("profiles").update({ full_name: "Name" });
  assert.ok(calls[1].sql.includes('WHERE "id" = $1'));
});
test("repository blocks admin provisioning and ownership changes, and checks admin membership on settings writes", async () => {
  const calls = [];
  const load = createLoader({ "@jobhunt/api/database/pool": { getPool: () => ({ query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; } }) } });
  const db = new (load("@jobhunt/api/database/database").ScopedDatabase)("owner");
  assert.ok((await db.from("app_admins").insert([{ user_id: "owner" }])).error);
  assert.ok((await db.from("profiles").update({ id: "other" })).error);
  assert.equal(calls.length, 0);
  await db.from("ai_settings").update({ provider: "groq", updated_by: "spoofed" });
  assert.ok(calls[0].sql.includes("EXISTS (SELECT 1 FROM app_admins"));
  assert.ok(!calls[0].values.includes("spoofed"));
});
test("private resume storage denies foreign paths and preserves a valid PDF on invalid replacement", async () => {
  const original = process.env.STORAGE_DIR;
  const originalDirectory = process.cwd();
  const directory = path.resolve(".verification/backend-storage");
  process.env.STORAGE_DIR = ".verification/backend-storage";
  process.chdir(path.join(originalDirectory, "apps/api"));
  const userId = randomUUID();
  const storage = new (createLoader()("@jobhunt/api/storage/storage").ResumeStorage)(userId);
  const key = userId + "/resume.pdf";
  try {
    assert.ok((await storage.upload("../resume.pdf", new Blob(["%PDF-1.4\ntest"]))).error);
    assert.ok((await storage.upload(randomUUID()+"/resume.pdf", new Blob(["%PDF-1.4\ntest"]))).error);
    assert.equal((await storage.upload(key, new Blob(["%PDF-1.4\ntest"]))).error, null);
    assert.equal(await fs.readFile(path.join(directory, userId, "resume.pdf"), "utf8"), "%PDF-1.4\ntest");
    assert.ok((await storage.upload(key, new Blob(["invalid PDF"]))).error);
    const result = await storage.download(key);
    assert.equal(await result.data.text(), "%PDF-1.4\ntest");
    assert.ok((await storage.download(randomUUID()+"/resume.pdf")).error);
  } finally {
    process.chdir(originalDirectory);
    await fs.rm(path.join(directory, userId, "resume.pdf"), { force: true });
    await fs.rmdir(path.join(directory, userId)).catch(() => {});
    if (original === undefined) delete process.env.STORAGE_DIR; else process.env.STORAGE_DIR = original;
  }
});
test("profile validation rejects oversized or malformed personal data", () => {
  const { profileFormSchema } = createLoader()("@jobhunt/api/profile/validation");
  assert.equal(profileFormSchema.safeParse({ fullName: "A" }).success, false);
  assert.equal(profileFormSchema.safeParse(null).success, false);
});
test("OAuth binds random state to the browser, hashes stored state, and requests PKCE", async () => {
  const names = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];
  const previous = names.map((name) => process.env[name]);
  names.forEach((name) => { process.env[name] = "verification-only"; });
  const calls = [];
  const load = createLoader({ "@jobhunt/api/database/pool": { getPool: () => ({ query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; } }) } });
  try {
    const service = new (load("@jobhunt/api/auth/service").AuthService)();
    const flow = await service.startOAuth("google");
    const url = new URL(flow.url);
    assert.equal(url.searchParams.get("state"), flow.state);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.ok(url.searchParams.get("code_challenge"));
    assert.ok(!flow.url.includes("client_secret"));
    assert.notEqual(calls[1].values[0], flow.state);
    const before = calls.length;
    await assert.rejects(service.finishOAuth("google", flow.state, "code", "different-browser"));
    assert.equal(calls.length, before);
    await assert.rejects(service.finishOAuth("google", flow.state, "code", flow.state));
    assert.ok(calls.at(-1).sql.startsWith("DELETE FROM oauth_states"));
  } finally {
    names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; });
  }
});
