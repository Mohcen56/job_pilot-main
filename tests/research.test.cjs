const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./load-ts.cjs");

const envKeys = [
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "OPENAI_API_KEY",
  "BROWSERBASE_API_KEY",
  "BROWSERBASE_PROJECT_ID",
];
const original = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
);
beforeEach(() => {
  for (const key of envKeys) process.env[key] = "test-only";
});
afterEach(() => {
  for (const key of envKeys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

const job = {
  id: "job",
  title: "Engineer",
  company: "Example",
  source_url: null,
  external_apply_url: null,
  about_role: "Engineering role",
  matched_skills: ["TypeScript"],
  missing_skills: [],
};
const profile = {
  current_title: "Engineer",
  experience_level: "Senior",
  years_experience: 5,
  skills: ["TypeScript"],
  work_experience: [],
};

function setup({
  provider = "gemini",
  extractError = null,
  constructorError = false,
} = {}) {
  const calls = [];
  class Stagehand {
    constructor(options) {
      calls.push(["model", options.model]);
      if (constructorError) throw new Error("Initialization failed");
    }
    async init() {}
    context = {
      activePage: () => ({
        goto: async () => {},
        waitForTimeout: async () => {},
      }),
    };
    async extract() {
      if (extractError) throw extractError;
      return {
        oneLiner: "Example builds developer tools",
        productSummary: "Developer tools",
        signals: [],
        pageLinks: [],
      };
    }
    async close() {
      calls.push(["close"]);
    }
  }
  const load = createLoader({
    "@browserbasehq/stagehand": { Stagehand },
    "@jobhunt/api/ai/settings": { getAISettings: async () => ({ provider }) },
    "@jobhunt/api/ai/completions": {
      completeAI: async (_input, selected) => {
        calls.push(["complete", selected]);
        return JSON.stringify({
          companyOverview: "Developer tools company",
          whyThisRole: "Expand their product",
        });
      },
    },
    "@jobhunt/api/research/browserbase": {
      getBrowserbase: () => ({
        sessions: {
          create: async () => {
            calls.push(["create"]);
            return { id: "session-id" };
          },
          update: async (id, body) => {
            calls.push(["release", id, body.status]);
          },
        },
      }),
    },
  });
  return {
    run: () => load("@jobhunt/api/research/research").researchCompany({ job, profile }),
    calls,
  };
}

test("Gemini-only configuration can research without an OpenAI or Browserbase key", async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.BROWSERBASE_API_KEY;
  const { run, calls } = setup();
  assert.equal((await run()).success, true);
  assert.deepEqual(calls, [["complete", "gemini"]]);
});

test("browser extraction and synthesis both use the selected provider", async () => {
  for (const [provider, prefix] of [
    ["gemini", "google/"],
    ["openai", "openai/"],
    ["groq", "groq/"],
  ]) {
    const { run, calls } = setup({ provider });
    assert.equal((await run()).success, true);
    assert.ok(
      calls.find(([kind]) => kind === "model")[1].modelName.startsWith(prefix),
    );
    assert.ok(
      calls.some(
        ([kind, selected]) => kind === "complete" && selected === provider,
      ),
    );
    assert.ok(calls.some(([kind]) => kind === "close"));
  }
});

test("browser AI limit closes the session and does not become a successful fallback dossier", async () => {
  const { run, calls } = setup({
    extractError: { statusCode: 429, responseHeaders: { "retry-after": "6" } },
  });
  const result = await run();
  assert.equal(result.success, false);
  assert.equal(result.code, "AI_LIMIT_REACHED");
  assert.equal(result.retryAfterSeconds, 6);
  assert.ok(calls.some(([kind]) => kind === "close"));
  assert.ok(!calls.some(([kind]) => kind === "complete"));
});

test("a browser constructor failure releases the allocated session", async () => {
  const { run, calls } = setup({ constructorError: true });
  assert.equal((await run()).success, true);
  assert.ok(
    calls.some(
      ([kind, id, status]) =>
        kind === "release" &&
        id === "session-id" &&
        status === "REQUEST_RELEASE",
    ),
  );
});

test("optional Browserbase client can be imported without a key", () => {
  delete process.env.BROWSERBASE_API_KEY;
  assert.equal(
    typeof createLoader()("@jobhunt/api/research/browserbase").getBrowserbase,
    "function",
  );
});
