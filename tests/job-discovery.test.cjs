const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./load-ts.cjs");
const profile = { job_titles_seeking: ["Engineer"], current_title: "Developer", preferred_locations: ["Germany", "Remote"], location: "Turkey", remote_preference: "Any", job_boards: ["linkedin", "indeed", "kariyer"] };

test("profile search unions every country and Remote, without restricting local jobs", () => {
  const { buildSearchPlan, parseSearchRequest } = createLoader()("@jobhunt/api/jobs/discovery");
  for (const location of ["Turkey", "Germany", "Canada", "Japan", "France"]) {
    const plan = buildSearchPlan(parseSearchRequest({ mode: "profile" }), { ...profile, preferred_locations: [location, "remote"], remote_preference: "Remote Only" });
    assert.equal(plan.targets.length, location === "Turkey" ? 6 : 5);
    assert.equal(plan.targets.filter((target) => target.remote).length, 3);
    assert.equal(plan.targets.filter((target) => !target.remote).length, location === "Turkey" ? 3 : 2);
    assert.ok(plan.targets.filter((target) => !target.remote).every((target) => target.location === location));
  }
});

test("profile roles fall back to current title; empty roles and excessive searches are rejected", () => {
  const { buildSearchPlan, parseSearchRequest } = createLoader()("@jobhunt/api/jobs/discovery");
  const body = parseSearchRequest({ mode: "profile" });
  assert.deepEqual(buildSearchPlan(body, { ...profile, job_titles_seeking: [] }).titles, ["Developer"]);
  assert.throws(() => buildSearchPlan(body, { ...profile, job_titles_seeking: [], current_title: "" }), /desired job title/);
  assert.throws(() => buildSearchPlan(body, { ...profile, job_titles_seeking: Array.from({ length: 6 }, (_, index) => `Role ${index}`) }), /5 roles/);
  assert.throws(() => parseSearchRequest({ mode: "manual", jobTitle: 123, location: "" }));
  assert.throws(() => parseSearchRequest(null));
  assert.equal(parseSearchRequest({ jobTitle: "Engineer", location: "Remote" }).mode, "manual");
});

test("country routing supports country codes, countries and city/country pairs; unsupported Adzuna locations warn", () => {
  const { countryForLocation, buildSearchPlan } = createLoader()("@jobhunt/api/jobs/discovery");
  for (const [location, code] of [["Türkiye", "tr"], ["Berlin", "de"], ["Lyon, France", "fr"], ["Canada", "ca"], ["UK", "gb"], ["Japan", "jp"], ["TR", "tr"]]) assert.equal(countryForLocation(location), code);
  const plan = buildSearchPlan({ mode: "profile" }, { ...profile, preferred_locations: ["Turkey", "Remote"], job_boards: ["adzuna"] });
  assert.equal(plan.targets.length, 0);
  assert.match(plan.warnings[0], /does not cover Turkey/);
});

test("missing connection disables only its provider", () => {
  const previous = process.env.OPENWEBNINJA_API_KEY;
  delete process.env.OPENWEBNINJA_API_KEY;
  try {
    const { ensureProvidersConfigured } = createLoader()("@jobhunt/api/jobs/discovery");
    assert.match(ensureProvidersConfigured([{ board: "linkedin" }])[0], /JSearch is disabled/);
  } finally { if (previous !== undefined) process.env.OPENWEBNINJA_API_KEY = previous; }
});

test("JSearch imports only selected publishers and remote jobs; retains country restrictions and safe links", async () => {
  const original = global.fetch;
  const calls = [];
  const job = { job_id: "job1", job_title: "Engineer", employer_name: "Company", job_description: "Example", job_apply_link: "https://www.linkedin.com/jobs/view/1", job_publisher: "LinkedIn", job_is_remote: true, job_location: "Europe", job_salary: "EUR 50000" };
  global.fetch = async (url, options) => { calls.push({ url: new URL(url), options }); return Response.json({ status: "OK", data: [job, { ...job, job_id: "other", job_publisher: "Glassdoor" }, { ...job, job_id: "onsite", job_is_remote: false }, { ...job, job_id: "unsafe", job_apply_link: "javascript:alert(1)" }] }); };
  try {
    const { searchTarget } = createLoader()("@jobhunt/api/jobs/discovery");
    const jobs = await searchTarget({ title: "Engineer", location: "", country: "us", remote: true, board: "linkedin" });
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].location.display_name, "Remote · Europe");
    assert.equal(jobs[0].salary, "EUR 50000");
    assert.equal(calls[0].url.searchParams.get("work_from_home"), "true");
    assert.match(calls[0].url.searchParams.get("query"), /remote worldwide via LinkedIn/);
    assert.equal(calls[0].url.pathname, "/jsearch/search-v2");
    await searchTarget({ title: "Engineer", location: "Turkey", country: "tr", remote: false, board: "linkedin" });
    assert.equal(calls[1].url.searchParams.get("work_from_home"), "false");
    assert.equal(calls[1].url.searchParams.get("country"), "tr");
  } finally { global.fetch = original; }
});

test("discovery combines local and remote results, deduplicates, and preserves partial failures", async () => {
  const key = process.env.OPENWEBNINJA_API_KEY;
  process.env.OPENWEBNINJA_API_KEY = "test-only";
  const original = global.fetch;
  global.fetch = async (url) => {
    const query = new URL(url).searchParams.get("query");
    if (query.includes("Indeed")) return new Response("", { status: 429 });
    return Response.json({ status: "OK", data: { jobs: [{ job_id: "shared", job_title: "Engineer", employer_name: "Company", job_publisher: "LinkedIn", job_apply_link: "https://linkedin.com/jobs/view/1", job_is_remote: true, job_location: "Germany" }] } });
  };
  try {
    const { discoverJobs } = createLoader()("@jobhunt/api/jobs/discovery");
    const target = { title: "Engineer", location: "Germany", country: "de", remote: false, board: "linkedin" };
    const result = await discoverJobs([target, { ...target, remote: true }, { ...target, board: "indeed" }]);
    assert.equal(result.jobs.length, 1);
    assert.match(result.warnings[0], /source unavailable/);
    assert.equal((await discoverJobs([{ ...target, board: "indeed" }])).jobs.length, 0);
  } finally { global.fetch = original; if(key === undefined) delete process.env.OPENWEBNINJA_API_KEY; else process.env.OPENWEBNINJA_API_KEY=key; }
});

test("profile-search endpoint reads saved preferences, uses one allowance and saves board provenance", async () => {
  const saved = [];
  let admitted = 0;
  let plan;
  const newJob = { externalId: "example", title: "Engineer", company: "Example", location: "Germany", description: "Engineering role", sourceUrl: "https://indeed.com/viewjob?jk=1", applyUrl: "https://indeed.com/viewjob?jk=1", salary: "EUR 60000", source: "jsearch", sourceBoard: "indeed" };
  const db = { from(table) {
    let operation = "select";
    const query = {
      select() { return query; }, eq() { return query; },
      insert(records) { operation = "insert"; if (table === "jobs") saved.push(...records); return query; },
      update() { return query; },
      async maybeSingle() { return { data: { ...profile, skills: ["TypeScript"], industries: [], experience_level: "Senior" } }; },
      async single() { return { data: { id: "run" } }; },
      async rows() { return { data: operation === "insert" ? saved.map((row, index) => ({ ...row, id: `saved${index}` })) : [] }; },
      then(resolve) { return Promise.resolve({ data: [] }).then(resolve); },
    }; return query;
  } };
  const load = createLoader({
    "@jobhunt/api/jobs/admission": { async withDiscoveryLimit(_context,work) { return work(); }, DiscoveryLimitError:class extends Error {} },
    "@jobhunt/api/jobs/discovery": {
      ...createLoader()("@jobhunt/api/jobs/discovery"),
      ensureProvidersConfigured() {},
      async discoverJobs(targets) { plan = targets; return { jobs: [newJob], warnings: [] }; },
    },
    "@jobhunt/api/jobs/persistence": { async saveDiscoveredJobs(_context, jobs) { saved.push(...jobs.map(j=>({id:"saved0",title:j.title,company:j.company,about_role:j.description,source_board:j.sourceBoard,user_id:"owner",match_score:null,match_status:"pending"}))); return {jobs:saved,inserted:saved.length,updated:0}; } },
    "@jobhunt/api/usage": { async withUsageLimit(_context, work) { admitted++; return work(); }, UsageLimitError:class extends Error {} },
    "@jobhunt/api/ai/completions": { async completeAI() { return JSON.stringify({ results: [{ jobId: "saved0", matchScore: 90, matchReason: "Good fit", matchedSkills: ["TypeScript"], missingSkills: [] }] }); } },
    "@jobhunt/api/lib/posthog-server": { async trackPostHogEvent() {} },
  });
  const { POST } = load("@jobhunt/api/jobs/find");
  const response = await POST(new Request("http://localhost/api/agent/find", { method: "POST", body: JSON.stringify({ mode: "profile" }) }), { user: { id: "owner" }, database: db });
  assert.equal(response.status, 200);
  assert.equal(admitted, 1);
  assert.equal(plan.length, 5);
  assert.equal(saved[0].source_board, "indeed");
  assert.equal(saved[0].user_id, "owner");
  assert.equal(saved[0].match_score, 90);
  const invalid = await POST(new Request("http://localhost/api/agent/find", { method: "POST", body: JSON.stringify({ mode: "manual", jobTitle: "", location: "" }) }), { user: { id: "owner" }, database: db });
  assert.equal(invalid.status, 400);
  assert.equal(admitted, 1);
});
