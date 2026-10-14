const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./load-ts.cjs");

const originalFetch = global.fetch;
const variables = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "GROQ_API_KEY",
  "GEMINI_MODEL",
  "OPENAI_MODEL",
  "GROQ_MODEL",
];
const originalEnv = Object.fromEntries(
  variables.map((key) => [key, process.env[key]]),
);
beforeEach(() => {
  for (const key of variables) delete process.env[key];
  for (const key of variables.filter((key) => key.endsWith("API_KEY")))
    process.env[key] = `test-${key}`;
});
afterEach(() => {
  global.fetch = originalFetch;
  for (const key of variables) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

const input = {
  messages: [{ role: "user", content: "Return JSON." }],
  temperature: 0.3,
  max_tokens: 4096,
};
const success = (content = '{"ok":true}', finish_reason = "stop") =>
  Response.json({ choices: [{ message: { content }, finish_reason }] });

for (const [provider, host, model] of [
  ["gemini", "generativelanguage.googleapis.com", "gemini-3.8-flash"],
  ["openai", "api.openai.com", "gpt-4o"],
  ["groq", "api.groq.com", "openai/gpt-oss-120b"],
]) {
  test(`saved ${provider} routes to its own endpoint, model, and key`, async () => {
    let calls = 0;
    global.fetch = async (url, options) => {
      calls++;
      assert.equal(new URL(String(url)).hostname, host);
      const body = JSON.parse(options.body);
      assert.equal(body.model, model);
      assert.equal(body.response_format.type, "json_object");
      assert.equal(
        new Headers(options.headers).get("authorization"),
        `Bearer test-${provider.toUpperCase()}_API_KEY`,
      );
      return success();
    };
    const load = createLoader({
      "@jobhunt/api/ai/settings": { getAISettings: async () => ({ provider }) },
    });
    assert.equal(await load("@jobhunt/api/ai/completions").completeAI(input), '{"ok":true}');
    assert.equal(calls, 1);
  });
}

test("429 is safe, carries retry timing, and neither retries nor falls back", async () => {
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return Response.json(
      {
        error: {
          message: "sensitive provider detail",
          code: "rate_limit_exceeded",
        },
      },
      { status: 429, headers: { "retry-after": "12" } },
    );
  };
  const load = createLoader({
    "@jobhunt/api/ai/settings": { getAISettings: async () => ({ provider: "groq" }) },
  });
  await assert.rejects(load("@jobhunt/api/ai/completions").completeAI(input), (error) => {
    assert.equal(error.failure.code, "AI_LIMIT_REACHED");
    assert.equal(error.failure.retryAfterSeconds, 12);
    assert.equal(error.failure.provider, "groq");
    assert.equal(error.status, 429);
    assert.ok(!error.message.includes("sensitive"));
    const response = load("@jobhunt/api/lib/ai-errors").aiFailureResponse(error);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "12");
    return true;
  });
  assert.equal(calls, 1);
});

test("quota exhaustion does not invent a retry time", () => {
  const { normalizeAIError } = createLoader()("@jobhunt/api/lib/ai-errors");
  const result = normalizeAIError(
    { status: 429, error: { code: "insufficient_quota" } },
    "openai",
  );
  assert.equal(result.failure.code, "AI_LIMIT_REACHED");
  assert.equal(result.failure.retryAfterSeconds, undefined);
  assert.match(result.message, /usage allowance/);
});

test("Gemini RetryInfo and nested Stagehand rate-limit errors are recognized", () => {
  const { normalizeAIError } = createLoader()("@jobhunt/api/lib/ai-errors");
  const error = {
    cause: {
      statusCode: 429,
      error: {
        status: "RESOURCE_EXHAUSTED",
        details: [{ retryDelay: "2.5s" }],
      },
    },
  };
  assert.equal(normalizeAIError(error, "gemini").failure.retryAfterSeconds, 3);
  assert.equal(
    normalizeAIError({ lastError: { statusCode: 429 } }, "groq").status,
    429,
  );
});

test("Retry-After accepts dates, rejects invalid/negative values", () => {
  const { parseRetryAfter } = createLoader()("@jobhunt/api/lib/ai-errors");
  assert.equal(
    parseRetryAfter(
      "Thu, 08 Oct 2026 12:01:00 GMT",
      Date.parse("2026-10-08T12:00:00Z"),
    ),
    60,
  );
  for (const value of ["", "-1", "nonsense", null])
    assert.equal(parseRetryAfter(value), undefined);
});

test("missing key fails before any network call and key status omits secrets", async () => {
  delete process.env.GEMINI_API_KEY;
  global.fetch = async () => {
    assert.fail("must not call provider");
  };
  const load = createLoader({
    "@jobhunt/api/ai/settings": {
      getAISettings: async () => ({ provider: "gemini" }),
    },
  });
  await assert.rejects(
    load("@jobhunt/api/ai/completions").completeAI(input),
    (error) => error.failure.code === "AI_NOT_CONFIGURED",
  );
  const statuses = load("@jobhunt/api/ai/config").getProviderStatuses();
  assert.equal(
    statuses.find((status) => status.id === "gemini").configured,
    false,
  );
  assert.ok(!JSON.stringify(statuses).includes("test-"));
});

test("truncated, empty, and invalid JSON cannot become successful AI results", async () => {
  const load = createLoader({
    "@jobhunt/api/ai/settings": {
      getAISettings: async () => ({ provider: "gemini" }),
    },
  });
  for (const [content, finish] of [
    ['{"ok":true}', "length"],
    [null, "stop"],
    ["not JSON", "stop"],
  ]) {
    global.fetch = async () => success(content, finish);
    await assert.rejects(
      load("@jobhunt/api/ai/completions").completeAI(input),
      (error) => error.failure.code === "AI_UNAVAILABLE",
    );
  }
});

test("authentication and network failures are not mislabeled as limits", async () => {
  const { normalizeAIError } = createLoader()("@jobhunt/api/lib/ai-errors");
  for (const status of [401, 403, 500, undefined]) {
    assert.equal(
      normalizeAIError({ status, message: "secret" }, "gemini").failure.code,
      "AI_UNAVAILABLE",
    );
  }
});

test("provider JSON must match the workflow data contract", () => {
  const { scoredJobsSchema, generatedResumeSchema, extractedProfileSchema } =
    createLoader()("@jobhunt/api/lib/ai-schemas");
  assert.equal(
    scoredJobsSchema.safeParse({
      results: [
        {
          jobId: "job",
          matchScore: 500,
          matchReason: "Wrong score",
          matchedSkills: [],
          missingSkills: [],
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    generatedResumeSchema.safeParse({
      summary: "Summary",
      work_experience: "not an array",
    }).success,
    false,
  );
  assert.equal(
    extractedProfileSchema.safeParse({ skills: null }).success,
    false,
  );
});

test("AI failures explain timeouts, rejected settings and outages without exposing provider details", () => {
  const { normalizeAIError } = createLoader()("@jobhunt/api/lib/ai-errors");
  for (const [details, expected] of [
    [{ name: "APIConnectionTimeoutError" }, /too long/],
    [{ name: "APIConnectionError" }, /internet connection/],
    [{ status: 401 }, /API key and permissions/],
    [{ status: 403 }, /API key and permissions/],
    [{ status: 404 }, /configured model/],
    [{ status: 400 }, /request settings/],
    [{ status: 503 }, /temporarily unavailable/],
  ]) {
    const error = normalizeAIError({ ...details, message: "secret-provider-payload", error: { message: "secret-api-key" } }, "gemini");
    assert.equal(error.failure.code, "AI_UNAVAILABLE");
    assert.match(error.failure.error, expected);
    assert.ok(!JSON.stringify(error.failure).includes("secret"));
  }
});

test("real SDK timeout and connection errors are recognized despite their inherited Error name", () => {
  const { createRequire } = require("node:module");
  const path = require("node:path");
  const { APIConnectionTimeoutError, APIConnectionError } = createRequire(path.resolve("apps/api/package.json"))("openai");
  const { normalizeAIError } = createLoader()("@jobhunt/api/lib/ai-errors");
  const timeout = new APIConnectionTimeoutError();
  assert.equal(timeout.name, "Error");
  assert.match(normalizeAIError(timeout, "gemini").message, /too long/);
  assert.match(normalizeAIError(new APIConnectionError({ message: "private network details" }), "gemini").message, /internet connection/);
});

test("Gemini gets a bounded two-minute request without adding retries or changing other providers", async () => {
  const options = [];
  class MockOpenAI {
    constructor(config) {
      options.push(config);
      this.chat = { completions: { create: async () => ({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }] }) } };
    }
  }
  const load = createLoader({ openai: { __esModule: true, default: MockOpenAI } });
  const { completeAI } = load("@jobhunt/api/ai/completions");
  for (const provider of ["gemini", "openai", "groq"]) await completeAI(input, provider);
  assert.deepEqual(options.map((option) => option.timeout), [120000, 60000, 60000]);
  assert.ok(options.every((option) => option.maxRetries === 0));
});


test("temporary Gemini server failure retries once on the same provider and recovers", async () => {
  let calls=0;
  global.fetch=async()=>++calls===1?Response.json({error:{message:'private detail'}},{status:503}):success();
  const load=createLoader({"@jobhunt/api/ai/settings":{getAISettings:async()=>({provider:'gemini'})}});
  assert.equal(await load('@jobhunt/api/ai/completions').completeAI(input),'{"ok":true}');
  assert.equal(calls,2);
});

test("persistent Gemini server failure is bounded and preserves safe diagnostics", async () => {
  let calls=0;const logs=[];const oldWarn=console.warn;
  console.warn=(...args)=>logs.push(args);
  global.fetch=async()=>{calls++;return Response.json({error:{message:'private-secret'}},{status:503});};
  try {
    const load=createLoader({"@jobhunt/api/ai/settings":{getAISettings:async()=>({provider:'gemini'})}});
    await assert.rejects(load('@jobhunt/api/ai/completions').completeAI(input),error=>error.failure.code==='AI_UNAVAILABLE');
    assert.equal(calls,2);
    assert.ok(logs.some(log=>log[1]?.httpStatus===503));
    assert.ok(!JSON.stringify(logs).includes('private-secret'));
  } finally {console.warn=oldWarn;}
});
