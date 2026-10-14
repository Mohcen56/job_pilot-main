const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./load-ts.cjs");

test("host validation rejects attacker-controlled routing headers before Next", () => {
  const load = createLoader({ "@jobhunt/api/auth/service": { appUrl: () => "https://jobs.example" } });
  const { trustedHost } = load("@jobhunt/api/security");
  for (const headers of [{ host: "attacker.example" }, { host: "jobs.example", "x-forwarded-host": "attacker.example" }]) {
    let next = false, status;
    trustedHost({ headers }, { status: (value) => { status=value; return { send() {} }; } }, () => { next=true; });
    assert.equal(status, 400); assert.equal(next, false);
  }
  let accepted = false;
  trustedHost({ headers: { host: "jobs.example" } }, {}, () => { accepted=true; });
  assert.equal(accepted, true);
});

test("analytics initialization and shutdown failures cannot fail saved workflows", async () => {
  const previous = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "test-only";
  try {
    for (const constructorFailure of [false, true]) {
      const load = createLoader({ "posthog-node": { PostHog: class {
        constructor() { if (constructorFailure) throw new Error("init"); }
        capture() {}
        async shutdown() { throw new Error("timeout"); }
      } } });
      await assert.doesNotReject(load("@jobhunt/api/lib/posthog-server").trackPostHogEvent({ event: "profile_completed", properties: { userId: "test" } }));
    }
  } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY; else process.env.NEXT_PUBLIC_POSTHOG_KEY=previous; }
});

test("a valid password cannot authenticate an unverified account", async () => {
  const load = createLoader({
    "@jobhunt/api/database/pool": { getPool: () => ({ query: async () => ({ rows: [{ id: "pending", password_hash: "hash", email_verified: false }] }) }) },
    "@jobhunt/api/auth/password": { verifyPassword: async () => true },
    "@jobhunt/api/auth/verification": { sendVerification: async () => {} },
  });
  await assert.rejects(new (load("@jobhunt/api/auth/service").AuthService)().login({ email: "test@example.test", password: "test-password-long" }));
});

test("insert parameters begin at one without mixing in selection filters", async () => {
  let query;
  const load = createLoader({ "@jobhunt/api/database/pool": { getPool: () => ({ query: async (sql, values) => { query={sql,values}; return { rows: [] }; } }) } });
  const db = new (load("@jobhunt/api/database/database").ScopedDatabase)("owner");
  await db.from("jobs").insert([{ title: "Example", user_id: "attacker" }]).eq("id", "unused-filter");
  assert.deepEqual(query.values, ["Example", "owner"]);
  assert.ok(query.sql.includes("($1,$2)"));
});
