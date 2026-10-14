const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");
const { createLoader } = require("../load-ts.cjs");
const { makePDF } = require("../pdf-fixture.cjs");
require("@next/env").loadEnvConfig(process.cwd(), true);

test("NestJS/Next.js monolith works with PostgreSQL and private storage", { timeout: 240000 }, async (t) => {
  const base = process.env.TEST_APP_URL || process.env.APP_URL || "http://localhost:3000";
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const emails = [1,2].map(() => `integration-${randomUUID()}@example.test`);
  const password = "verification-only-strong-password";
  const users = [];
  const originalSettings = (await pool.query("SELECT provider,updated_by,updated_at FROM ai_settings WHERE id='global'")).rows[0];
  const request = (endpoint, options = {}) => fetch(base + endpoint, { redirect: "manual", ...options, headers: { Origin: base, ...options.headers } });
  const form = (email) => new URLSearchParams({ email, password });
  const cookie = (response) => response.headers.getSetCookie().find((value) => value.startsWith("jobhunt_session="))?.split(";")[0];
  try {
    await t.test("health, authentication, and same-origin checks", async () => {
      assert.equal((await request("/api/health/ready")).status, 200);
      assert.equal((await request("/api/jobs")).status, 401);
      assert.equal((await request("/api/auth/register", { method: "POST", body: form(emails[0]), headers: { Origin: "https://untrusted.example" } })).status, 403);
      for (const email of emails) {
        const response = await request("/api/auth/register", { method: "POST", body: form(email) });
        assert.equal(response.status, 303);
        const directSignup = response.headers.get("location") === "/profile";
        if (directSignup) assert.ok(cookie(response));
        else {
          assert.equal(response.headers.get("location"), `/verify-email?email=${encodeURIComponent(email)}`);
          assert.equal(cookie(response), undefined);
        }
        const { rows } = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
        assert.ok(rows[0]); users.push({ id: rows[0].id, email });
        if (!directSignup) {
        assert.equal((await request("/api/auth/login", { method: "POST", body: form(email) })).headers.get("location"), "/login?error=credentials");
        const token = randomBytes(32).toString("hex");
        await pool.query("INSERT INTO email_verifications(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [createHash("sha256").update(token).digest("hex"), rows[0].id]);
        const activation = new URLSearchParams({ token, password });
        assert.equal((await request("/api/auth/verify-email", { method: "POST", body: activation })).headers.get("location"), "/login?error=verified");
        assert.equal((await request("/api/auth/verify-email", { method: "POST", body: activation })).headers.get("location"), "/verify-email?error=verification");
        }
        users.at(-1).cookie = cookie(await request("/api/auth/login", { method: "POST", body: form(email) }));
        assert.ok(users.at(-1).cookie);
      }
    });
    await t.test("sign-in rotates and logout invalidates database sessions", async () => {
      const previous = users[0].cookie;
      const login = await request("/api/auth/login", { method: "POST", body: form(users[0].email), headers: { Cookie: previous } });
      users[0].cookie = cookie(login); assert.ok(users[0].cookie);
      assert.notEqual(users[0].cookie, previous);
      assert.equal((await request("/api/jobs", { headers: { Cookie: previous } })).status, 401);
      await request("/api/auth/logout", { method: "POST", headers: { Cookie: users[0].cookie } });
      assert.equal((await request("/api/jobs", { headers: { Cookie: users[0].cookie } })).status, 401);
      users[0].cookie = cookie(await request("/api/auth/login", { method: "POST", body: form(users[0].email) }));
      assert.ok(users[0].cookie);
    });
    await t.test("jobs remain user-scoped with search, score filters, and pagination", async () => {
      for (const user of users) await pool.query("INSERT INTO jobs(user_id,source,title,company,match_score) VALUES($1,'search',$2,'Example',85)", [user.id, user === users[0] ? "TypeScript, Engineer" : "Other user's private job"]);
      const response = await request("/api/jobs?search=TypeScript%2C&matchFilter=high&page=invalid", { headers: { Cookie: users[0].cookie } });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.data.page, 1);
      assert.equal(body.data.totalCount, 1);
      assert.equal(body.data.jobs[0].user_id, users[0].id);
      assert.equal((await (await request("/api/jobs?search='OR%20true--", { headers: { Cookie: users[0].cookie } })).json()).data.totalCount, 0);
    });
    await t.test("profile saves validate fields and preserve account ownership", async () => {
      const fields = { fullName: "Integration Person", phone: "123456789", location: "Paris", linkedinUrl: "", portfolioUrl: "", workAuth: "citizen", currentTitle: "Engineer", experienceLevel: "Senior", yearsExperience: "5", skills: ["TypeScript"], industries: [], workEntries: [{ company: "Example", title: "Engineer", start_date: "2020-01", end_date: "", is_current: true, responsibilities: "Build applications" }], degree: "BSc", fieldOfStudy: "Computer Science", institution: "Example University", graduationYear: "2020", jobTitlesSeeking: ["Engineer"], remotePreference: "remote", salaryExpectation: "", preferredLocations: ["Germany", "Remote"], jobBoards: ["linkedin", "indeed", "kariyer"], coverLetterTone: "formal", id: users[1].id };
      const response = await request("/api/profile", { method: "POST", headers: { Cookie: users[0].cookie, "Content-Type": "application/json" }, body: JSON.stringify(fields) });
      assert.equal(response.status, 200);
      const result = await pool.query("SELECT id,full_name,is_complete,job_boards,preferred_locations FROM profiles WHERE id=ANY($1::uuid[]) ORDER BY full_name NULLS LAST", [users.map((user) => user.id)]);
      assert.equal(result.rows[0].id, users[0].id); assert.equal(result.rows[0].is_complete, true); assert.equal(result.rows[1].full_name, null);
      assert.deepEqual(result.rows[0].job_boards, ["linkedin", "indeed", "kariyer"]);
      assert.deepEqual(result.rows[0].preferred_locations, ["Germany", "Remote"]);
      assert.equal((await request("/api/profile", { method: "POST", headers: { Cookie: users[0].cookie, "Content-Type": "application/json" }, body: "null" })).status, 400);
    });
    await t.test("repository inserts force ownership and database foreign keys reject another user's run", async () => {
      const load = createLoader({ "@jobhunt/api/database/pool": { getPool: () => pool } });
      const { ScopedDatabase } = load("@jobhunt/api/database/database");
      const owner = new ScopedDatabase(users[0].id);
      const other = new ScopedDatabase(users[1].id);
      const ownRun = await owner.from("agent_runs").insert([{ user_id: users[1].id, status: "running" }]).single();
      assert.equal(ownRun.error, null); assert.equal(ownRun.data.user_id, users[0].id);
      const otherRun = await other.from("agent_runs").insert([{ status: "running" }]).single();
      const ownJob = await owner.from("jobs").insert([{ user_id: users[1].id, run_id: ownRun.data.id, source: "search", title: "Scoped insert" }]).single();
      assert.equal(ownJob.error, null); assert.equal(ownJob.data.user_id, users[0].id);
      const denied = await owner.from("jobs").insert([{ run_id: otherRun.data.id, source: "search" }]);
      assert.equal(denied.error.code, "23503");
    });
    await t.test("private resume upload, download, and invalid replacement", async () => {
      const bytes = "%PDF-1.4\nverification PDF";
      const upload = new FormData(); upload.set("resume", new Blob([bytes], { type: "application/pdf" }), "resume.pdf");
      assert.equal((await request("/api/profile/resume", { method: "POST", headers: { Cookie: users[0].cookie }, body: upload })).status, 200);
      const download = await request("/api/resume/download", { headers: { Cookie: users[0].cookie } });
      assert.equal(download.status, 200); assert.equal(download.headers.get("cache-control"), "no-store"); assert.equal(await download.text(), bytes);
      assert.equal((await request("/api/resume/download?userId=" + users[0].id, { headers: { Cookie: users[1].cookie } })).status, 404);
      const invalid = new FormData(); invalid.set("resume", new Blob(["invalid"], { type: "application/pdf" }), "resume.pdf");
      assert.equal((await request("/api/profile/resume", { method: "POST", headers: { Cookie: users[0].cookie }, body: invalid })).status, 400);
      assert.equal(await (await request("/api/resume/download", { headers: { Cookie: users[0].cookie } })).text(), bytes);
    });
    await t.test("migrated resume generation renders a real PDF and propagates quota errors without replacing it", async () => {
      let quota = false;
      let failure;
      const load = createLoader({
        "@jobhunt/api/database/pool": { getPool: () => pool },
        "@jobhunt/api/ai/completions": { completeAI: async () => {
          if (quota) throw failure;
          return JSON.stringify({ summary: "An experienced engineer building useful software with TypeScript and modern web technologies.", work_experience: [{ company: "Example", title: "Engineer", start_date: "2020-01", end_date: null, is_current: true, bullets: ["Built useful software"] }] });
        } },
      });
      const user = { id: users[0].id, email: users[0].email, profile: { name: null, avatar_url: null } };
      const context = load("@jobhunt/api/context").contextForUser(user);
      const generate = load("@jobhunt/api/resumes/generate").POST;
      assert.equal((await generate(new Request(base + "/api/resume/generate", { method: "POST" }), context)).status, 200);
      const before = await (await context.storage.download(user.id + "/resume.pdf")).data.arrayBuffer();
      assert.equal(Buffer.from(before).subarray(0,5).toString(), "%PDF-");
      failure = new (load("@jobhunt/api/lib/ai-errors").AIServiceError)({ success: false, code: "AI_LIMIT_REACHED", provider: "gemini", error: "Usage limit reached", retryAfterSeconds: 20 }, 429);
      quota = true;
      const response = await generate(new Request(base + "/api/resume/generate", { method: "POST" }), context);
      assert.equal(response.status, 429); assert.equal(response.headers.get("retry-after"), "20");
      const after = await (await context.storage.download(user.id + "/resume.pdf")).data.arrayBuffer();
      assert.deepEqual(Buffer.from(after), Buffer.from(before));
    });
    await t.test("AI task reservations reject overlap, release on failure, and enforce shared quotas", async () => {
      const load = createLoader({ "@jobhunt/api/database/pool": { getPool: () => pool } });
      const { withUsageLimit, UsageLimitError } = load("@jobhunt/api/usage");
      const context = { user: { id: users[1].id } };
      let ready, release;
      const started = new Promise((resolve) => { ready=resolve; });
      const running = withUsageLimit(context, async () => { ready(); await new Promise((resolve) => { release=resolve; }); });
      await started;
      try {
        await assert.rejects(withUsageLimit(context, async () => assert.fail("overlapping work ran")), UsageLimitError);
      } finally { release(); await running; }
      await assert.rejects(withUsageLimit(context, async () => { throw new Error("work failure"); }), /work failure/);
      assert.equal((await pool.query("SELECT 1 FROM usage_leases WHERE user_id=$1", [users[1].id])).rowCount, 0);
      await pool.query("UPDATE usage_counters SET used=100000 WHERE key=$1", [`user-hour:${users[1].id}`]);
      const limited = await request("/api/resume/generate", { method: "POST", headers: { Cookie: users[1].cookie } });
      assert.equal(limited.status, 429);
      assert.ok(Number(limited.headers.get("retry-after"))>0);
      assert.equal((await limited.json()).code, "APP_LIMIT_REACHED");
      const resume = new FormData();
      resume.set("resume", new Blob([new Uint8Array(makePDF("Example Engineer building TypeScript software, APIs and reliable applications with automated testing."))], { type: "application/pdf" }), "resume.pdf");
      assert.equal((await request("/api/profile/resume", { method: "POST", headers: { Cookie: users[1].cookie }, body: resume })).status, 200);
      const extraction = await request("/api/profile/extract", { method: "POST", headers: { Cookie: users[1].cookie } });
      assert.equal(extraction.status, 429);
    });
    await t.test("verified OAuth claims pending email without preserving attacker credentials or deleting profile data", async () => {
      const email = `pending-${randomUUID()}@example.test`; emails.push(email);
      const pending = (await pool.query("INSERT INTO users(email,password_hash) VALUES($1,'untrusted-hash') RETURNING id", [email])).rows[0].id;
      await pool.query("INSERT INTO profiles(id,email,location) VALUES($1,$2,'Preserved location')", [pending,email]);
      await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')", [createHash('sha256').update(randomBytes(32)).digest('hex'),pending]);
      const fetchBefore = global.fetch;
      const variables = ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'];
      const before = variables.map((key) => process.env[key]);
      variables.forEach((key) => { process.env[key]='test-only'; });
      global.fetch = async (url) => Response.json(String(url).includes('userinfo') ? { email, email_verified: true, sub: randomUUID(), name: 'Verified Owner' } : { access_token: 'test-only-token' });
      try {
        const load = createLoader({ "@jobhunt/api/database/pool": { getPool: () => pool } });
        const auth = new (load("@jobhunt/api/auth/service").AuthService)();
        const flow = await auth.startOAuth('google');
        assert.equal(await auth.finishOAuth('google', flow.state, 'test-code', flow.state), pending);
        const owner = (await pool.query("SELECT email_verified,password_hash FROM users WHERE id=$1", [pending])).rows[0];
        assert.equal(owner.email_verified,true); assert.equal(owner.password_hash,null);
        assert.equal((await pool.query("SELECT 1 FROM sessions WHERE user_id=$1", [pending])).rowCount,0);
        assert.equal((await pool.query("SELECT location FROM profiles WHERE id=$1", [pending])).rows[0].location,'Preserved location');
      } finally {
        global.fetch=fetchBefore;
        variables.forEach((key,index) => { if (before[index]===undefined) delete process.env[key]; else process.env[key]=before[index]; });
      }
    });
    await t.test("host headers cannot steer requests into Next's forwarding paths", async () => {
      assert.equal((await request("/login", { headers: { "X-Forwarded-Host": "attacker.example" } })).status, 400);
    });
    await t.test("admin membership, provider persistence, and key privacy", async () => {
      assert.equal((await request("/api/admin/ai-settings", { headers: { Cookie: users[0].cookie } })).status, 403);
      assert.equal((await request("/api/admin/ai-settings", { method: "POST", headers: { Cookie: users[0].cookie, "Content-Type": "application/json" }, body: JSON.stringify({ provider: "groq", isAdmin: true }) })).status, 403);
      await pool.query("INSERT INTO app_admins(user_id) VALUES($1)", [users[0].id]);
      const settings = await (await request("/api/admin/ai-settings", { headers: { Cookie: users[0].cookie } })).json();
      assert.equal(settings.data.settings.provider, originalSettings.provider);
      assert.ok(!JSON.stringify(settings).includes("verification-only-key"));
      const update = await request("/api/admin/ai-settings", { method: "POST", headers: { Cookie: users[0].cookie, "Content-Type": "application/json" }, body: JSON.stringify({ provider: "groq" }) });
      const configured = settings.data.providers.find((provider) => provider.id === "groq").configured;
      assert.equal(update.status, configured ? 200 : 400);
      if (configured) {
        assert.equal((await pool.query("SELECT provider,updated_by FROM ai_settings")).rows[0].updated_by, users[0].id);
        assert.equal((await (await request("/api/admin/ai-settings", { headers: { Cookie: users[0].cookie } })).json()).data.settings.provider, "groq");
      }
      assert.equal((await request("/api/admin/ai-settings", { method: "POST", headers: { Cookie: users[0].cookie, "Content-Type": "application/json" }, body: JSON.stringify({ provider: "invalid" }) })).status, 400);
    });
    await t.test("Next.js renders authenticated pages within the same server", async () => {
      const login = await request("/login"); assert.equal(login.status, 200); assert.ok((await login.text()).includes('name="email"'));
      const profile = await request("/profile", { headers: { Cookie: users[0].cookie } }); assert.equal(profile.status, 200); assert.ok((await profile.text()).includes("Integration Person"));
      assert.equal((await request("/dashboard", { headers: { Cookie: users[0].cookie } })).status, 200);
      assert.equal((await request("/find-jobs", { headers: { Cookie: users[0].cookie } })).status, 200);
      const admin = await request("/admin", { headers: { Cookie: users[0].cookie } }); assert.equal(admin.status, 200); assert.ok((await admin.text()).includes("Groq"));
      assert.equal((await request("/admin", { headers: { Cookie: users[1].cookie } })).status, 404);
    });
  } finally {
    await pool.query("UPDATE ai_settings SET provider=$1,updated_by=$2 WHERE id='global' AND updated_by=ANY($3::uuid[])", [originalSettings.provider, originalSettings.updated_by, users.map((user) => user.id)]).catch(() => {});
    await pool.query("DELETE FROM users WHERE email=ANY($1::text[])", [emails]);
    await pool.query("DELETE FROM usage_counters WHERE key=ANY($1::text[])", [users.flatMap((user) => [`user-hour:${user.id}`,`user-day:${user.id}`])]);
    await pool.end();
    for (const user of users) {
      await fs.rm(path.resolve("data/mail", `${user.id}.json`), { force: true });
      const directory = path.resolve(process.env.STORAGE_DIR || "./data/resumes", user.id);
      await fs.rm(path.join(directory, "resume.pdf"), { force: true });
      await fs.rmdir(directory).catch(() => {});
    }
  }
});
