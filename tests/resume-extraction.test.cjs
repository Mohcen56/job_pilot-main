const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./load-ts.cjs");
const { makePDF } = require("./pdf-fixture.cjs");

const text = "Example Engineer with experience building TypeScript applications, designing APIs and testing reliable software.";
const profile = {
  full_name: "Example Engineer", phone: null, location: null, current_title: "Engineer", experience_level: "Mid-Level", years_experience: 3,
  skills: ["TypeScript"], industries: [], work_experience: [], education: { degree: null, field: null, institution: null, graduation_year: null },
  job_titles_seeking: [], linkedin_url: null, portfolio_url: null,
};
function extraction(bytes, completeAI) {
  let reservations = 0;
  const load = createLoader({
    "@jobhunt/api/ai/completions": { completeAI },
    "@jobhunt/api/usage": { withUsageLimit: async (_context, action) => { reservations++; return action(); }, UsageLimitError: class extends Error {} },
  });
  const context = { user: { id: "test-owner" }, storage: { from() { return this; }, async download() { return { data: new Blob([bytes]), error: null }; } } };
  return { load, reservations: () => reservations, run: () => load("@jobhunt/api/profile/service").extractProfile(context) };
}

test("valid PDF text reaches AI and yields a validated profile", async () => {
  let calls = 0;
  const { run } = extraction(makePDF(text), async input => {
    calls++; assert.ok(input.messages[1].content.includes(text)); return JSON.stringify(profile);
  });
  const result = await run(); assert.equal(result.success, true); assert.equal(result.data.full_name, profile.full_name); assert.equal(calls, 1);
});

test("broken and textless PDFs return actionable errors before calling AI", async () => {
  for (const [bytes, expected] of [[Buffer.from("%PDF-1.4\nbroken"), /couldn't read this PDF/], [makePDF(""), /selectable text/]]) {
    let calls = 0;
    const { run, reservations } = extraction(bytes, async () => { calls++; throw new Error("AI should not run"); });
    const result = await run(); assert.equal(result.success, false); assert.match(result.error, expected); assert.equal(calls, 0); assert.equal(reservations(), 0);
  }
});

test("AI provider errors remain distinct from PDF parsing errors", async () => {
  let failure;
  const { load, run } = extraction(makePDF(text), async () => { throw failure; });
  failure = new (load("@jobhunt/api/lib/ai-errors").AIServiceError)({ success: false, code: "AI_LIMIT_REACHED", provider: "gemini", error: "Usage limit reached", retryAfterSeconds: 15 }, 429);
  assert.deepEqual(await run(), failure.failure);
});
