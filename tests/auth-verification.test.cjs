const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./load-ts.cjs");

test("production without email delivery rejects registration before touching the database", async () => {
  const variables = ["NODE_ENV", "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_DELIVERY_ENABLED", "EMAIL_VERIFICATION_REQUIRED"];
  const previous = variables.map(key => process.env[key]);
  process.env.NODE_ENV = "production"; delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM;
  process.env.EMAIL_VERIFICATION_REQUIRED = "false";
  let databaseTouched = false;
  const load = createLoader({ "@jobhunt/api/database/pool": { getPool: () => { databaseTouched = true; throw new Error("Database must not be reached"); } } });
  try {
    await assert.rejects(new (load("@jobhunt/api/auth/service").AuthService)().register({ email: "test@example.test" }), error => error.status === 503);
    await assert.rejects(load("@jobhunt/api/auth/verification").sendVerification("test@example.test"), error => error.status === 503);
    process.env.RESEND_API_KEY = "test-only";
    process.env.EMAIL_FROM = "test@example.test";
    process.env.EMAIL_DELIVERY_ENABLED = "false";
    await assert.rejects(new (load("@jobhunt/api/auth/service").AuthService)().register({ email: "test@example.test" }), error => error.status === 503);
    await assert.rejects(load("@jobhunt/api/auth/verification").sendVerification("test@example.test"), error => error.status === 503);
    assert.equal(databaseTouched, false);
  } finally {
    variables.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});
