import { z } from "zod";
import { countryForLocation, isCountryLocation, countryName } from '@jobhunt/shared/countries';
import { JOB_BOARDS, JOB_BOARD_LABELS, type JobBoard, type Profile } from "@jobhunt/shared/types";
import { searchJobs } from "../lib/adzuna";

export type DiscoveryJob = {
  id: string; title: string; company: { display_name: string }; location: { display_name: string };
  description: string; redirect_url: string; salary: string | null; contract_type?: string; board: JobBoard; published?: string | null; apply_url?: string;
};
export type SearchTarget = { title: string; location: string; country: string; remote: boolean; board: JobBoard };
export class SearchInputError extends Error {}
export class JobProviderError extends Error {}

const requestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("profile"), freshnessDays: z.union([z.literal(1),z.literal(3),z.literal(7),z.literal(14),z.literal(30)]).optional() }),
  z.object({ mode: z.literal("manual"), jobTitle: z.string().trim().min(1).max(200), location: z.string().trim().max(200), country: z.string().trim().refine(value => isCountryLocation(value), "Select a valid country.").optional(), freshnessDays: z.union([z.literal(1),z.literal(3),z.literal(7),z.literal(14),z.literal(30)]).optional() }),
]);
export function parseSearchRequest(body: unknown) {
  const compatible = typeof body === "object" && body !== null && !("mode" in body) ? { ...body, mode: "manual" } : body;
  const parsed = requestSchema.safeParse(compatible);
  if (!parsed.success) throw new SearchInputError("Enter a job title and a valid location, or search using your profile.");
  return parsed.data;
}

const adzunaCountries = new Set("gb us at au be br ca ch de es fr in it mx nl nz pl sg za".split(" "));
export { countryForLocation, isCountryLocation } from '@jobhunt/shared/countries';
function unique(values: string[]): string[] {
  return [...new Map(values.map((value) => [value.trim().toLowerCase(), value.trim()])).values()].filter(Boolean);
}
export type SearchProfile = Pick<Profile, "job_titles_seeking" | "current_title" | "preferred_locations" | "location" | "remote_preference" | "job_boards" | "career_urls" | "freshness_days">;
export function buildSearchPlan(body: ReturnType<typeof parseSearchRequest>, profile: SearchProfile) {
  const titles = unique(body.mode === "profile" ? (profile.job_titles_seeking?.length ? profile.job_titles_seeking : [profile.current_title ?? ""]) : [body.jobTitle]);
  if (!titles.length) throw new SearchInputError("Add a desired job title to your profile before searching.");
  let locations = unique(body.mode === "profile" ? (profile.preferred_locations?.length ? profile.preferred_locations : [profile.location ?? ""]) : [body.location]);
  if (body.mode === "manual" && body.country && !/^remote$/i.test(body.location)) {
    const name = countryName(countryForLocation(body.country));
    locations = [body.location.trim() ? `${body.location.trim()}, ${name}` : name];
  }
  // An explicit Remote tag adds a separate search; it never restricts geographic searches.
  const remoteOnly = body.mode === "profile" && profile.remote_preference === "Remote Only" && !locations.some((value) => /^remote$/i.test(value));
  if (remoteOnly) locations.splice(0, locations.length, "Remote");
  if (!locations.length) locations.push("");
  const boards = [...new Set(profile.job_boards ?? ["adzuna"])];
  if (!boards.length || boards.some((board) => !JOB_BOARDS.includes(board))) throw new SearchInputError("Choose at least one job board in your profile.");
  if (titles.length > 5 || locations.length > 10 || titles.length * locations.length * boards.length > 40) throw new SearchInputError("Search up to 5 roles and 10 locations at a time, with at most 40 role/location/board combinations.");
  const targets: SearchTarget[] = [];
  const warnings: string[] = [];
  const fallback = body.mode === "manual" && body.country ? countryForLocation(body.country) : countryForLocation(profile.location ?? "");
  for (const title of titles) for (const location of locations) for (const board of boards) {
    const remote = /^remote$/i.test(location);
    const country = remote ? fallback : countryForLocation(location, location ? "" : fallback);
    if (!country && board !== "direct") {
      warnings.push(`Choose a country for ${location || "this search"}; ${JOB_BOARD_LABELS[board]} was skipped instead of searching the US.`);
      continue;
    }
    if (board === "kariyer" && country !== "tr") {
      warnings.push(`Kariyer.net is a Turkey source; skipped for ${location || country}. Other selected sources continued.`);
      continue;
    }
    if (board === "adzuna" && !adzunaCountries.has(country)) {
      warnings.push(`Adzuna does not cover ${location || country}. Other selected sources continued. Enable company careers or a connected JSearch source for this country.`);
      continue;
    }
    targets.push({ title, location: remote ? "" : location, country, remote, board });
  }
  return { targets, warnings: [...new Set(warnings)], titles, locations, boards, eligibilityCountry: fallback };
}
export function ensureProvidersConfigured(targets: SearchTarget[]) {
  if (!targets.length) throw new SearchInputError("Your selected boards do not cover these locations. Choose another board in your profile.");
  if (targets.some((target) => target.board !== "adzuna") && !process.env.OPENWEBNINJA_API_KEY?.trim()) throw new SearchInputError("LinkedIn, Indeed and Kariyer.net imports need a JSearch connection. Ask the app administrator to configure it, or select Adzuna for now.");
  if (targets.some((target) => target.board === "adzuna") && (!process.env.ADZUNA_APP_ID?.trim() || !process.env.ADZUNA_APP_KEY?.trim())) throw new SearchInputError("Adzuna is not connected yet. Ask the app administrator to configure it or choose another connected board.");
}
const safeUrl = z.string().url().refine((value) => /^https?:\/\//i.test(value));
const jsearchJob = z.object({
  job_id: z.string(), job_title: z.string(), employer_name: z.string(), job_description: z.string().nullish(),
  job_apply_link: safeUrl.nullish(), job_publisher: z.string().nullish(), job_is_remote: z.boolean().nullish(),
  job_location: z.string().nullish(), job_city: z.string().nullish(), job_state: z.string().nullish(), job_country: z.string().nullish(),
  job_salary: z.string().nullish(), job_employment_type: z.string().nullish(), job_posted_at_datetime_utc: z.string().nullish(),
  apply_options: z.array(z.object({ publisher: z.string(), apply_link: safeUrl, is_direct: z.boolean().optional() })).nullish(),
});
const jsearchResponse = z.object({ status: z.literal("OK"), data: z.union([z.array(z.unknown()), z.object({ jobs: z.array(z.unknown()) })]) });
function publisherMatches(name: string, board: JobBoard) {
  const normalized = name.toLowerCase().replace(/[^a-z]/g, "");
  return board === "kariyer" ? normalized === "kariyer" || normalized === "kariyernet" : normalized === board;
}
export async function searchTarget(target: SearchTarget, signal?: AbortSignal): Promise<DiscoveryJob[]> {
  if (target.board === "adzuna") {
    const jobs = await searchJobs(target.remote ? `${target.title} remote` : target.title, target.location, target.country, signal);
    return jobs.filter((job) => !target.remote || (/\bremote\b/i.test(`${job.title} ${job.location.display_name} ${job.description}`) && !/\b(?:no|not|non[- ]?)\s*remote\b/i.test(job.description))).map((job) => ({
      ...job, id: `adzuna:${target.country}:${job.id}`, board: "adzuna", published: job.created, salary: job.salary_min == null ? null : `${currencyForCountry(target.country)} ${job.salary_min.toLocaleString("en-US")}${job.salary_max == null ? "" : ` – ${job.salary_max.toLocaleString("en-US")}`}`,
    }));
  }
  const publisher = JOB_BOARD_LABELS[target.board];
  const params = new URLSearchParams({ query: `${target.title} ${target.remote ? "remote worldwide" : target.location ? `in ${target.location}` : "jobs"} via ${publisher}`, country: target.country, language: target.country === "tr" ? "tr" : "en", work_from_home: String(target.remote) });
  const response = await fetch(`https://api.openwebninja.com/jsearch/search-v2?${params}`, { headers: { "x-api-key": process.env.OPENWEBNINJA_API_KEY! }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
  if (!response.ok) throw new JobProviderError(response.status === 429 ? "JSearch's request allowance has been reached. Try again later." : "JSearch could not complete this search. Check the connection and try again.");
  const parsed = jsearchResponse.safeParse(await response.json());
  if (!parsed.success) throw new JobProviderError("JSearch returned an unreadable response. Try again later.");
  const entries = Array.isArray(parsed.data.data) ? parsed.data.data : parsed.data.data.jobs;
  // Some API response versions wrap each page's jobs in a separate object.
  const records = entries.flatMap((entry) => typeof entry === "object" && entry !== null && "jobs" in entry && Array.isArray(entry.jobs) ? entry.jobs : [entry]);
  const jobs: DiscoveryJob[] = [];
  for (const record of records) {
    const parsedJob = jsearchJob.safeParse(record);
    if (!parsedJob.success) continue;
    const job = parsedJob.data;
    if (target.remote && job.job_is_remote !== true) continue;
    const option = job.apply_options?.find((option) => publisherMatches(option.publisher, target.board));
    const url = option?.apply_link ?? (publisherMatches(job.job_publisher ?? "", target.board) ? job.job_apply_link : null);
    if (!url) continue;
    let location = job.job_location ?? [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ");
    if (!countryForLocation(location) && job.job_country && countryForLocation(job.job_country)) location = [location, countryName(countryForLocation(job.job_country))].filter(Boolean).join(", ");
    jobs.push({ id: `jsearch:${job.job_id}`, title: job.job_title, company: { display_name: job.employer_name }, location: { display_name: `${job.job_is_remote ? "Remote · " : ""}${location || "Location not specified"}` }, description: job.job_description ?? "", redirect_url: url, apply_url: job.apply_options?.find(o=>o.is_direct)?.apply_link ?? url, published: job.job_posted_at_datetime_utc, salary: job.job_salary ?? null, contract_type: job.job_employment_type ?? undefined, board: target.board });
  }
  return jobs.slice(0, 10);
}
function currencyForCountry(country: string) {
  const currencies: Record<string, string> = { us: "USD", gb: "GBP", au: "AUD", br: "BRL", ca: "CAD", ch: "CHF", in: "INR", mx: "MXN", nz: "NZD", pl: "PLN", sg: "SGD", za: "ZAR" };
  return currencies[country] ?? "EUR";
}
export async function discoverJobs(targets: SearchTarget[]) {
  const jobs: DiscoveryJob[] = [];
  const warnings: string[] = [];
  let successes = 0;
  if (targets.some((target) => target.board === "adzuna" && target.remote)) warnings.push("Adzuna remote search uses US listings and remote keywords. Check each listing's work arrangement and eligibility.");
  if (targets.some((target) => target.board === "kariyer")) warnings.push("Kariyer.net coverage depends on indexed listings and may be limited.");
  // Bound external concurrency and request count; never retry paid provider calls automatically.
  for (let index = 0; index < targets.length; index += 3) {
    const batch = targets.slice(index, index + 3);
    const results = await Promise.allSettled(batch.map(target => searchTarget(target)));
    results.forEach((result, offset) => {
      if (result.status === "fulfilled") { successes++; jobs.push(...result.value); }
      else warnings.push(`${JOB_BOARD_LABELS[batch[offset].board]}: ${result.reason instanceof JobProviderError ? result.reason.message : "Search unavailable. Please try again later."}`);
    });
  }
  if (!successes) throw new JobProviderError(warnings[0] ?? "Job search is temporarily unavailable.");
  const seen = new Set<string>();
  const uniqueJobs = jobs.filter((job) => {
    const key = `${job.title.toLowerCase().trim()}|${job.company.display_name.toLowerCase().trim()}|${job.location.display_name.toLowerCase().trim()}`;
    if (seen.has(job.id) || seen.has(job.redirect_url) || seen.has(key)) return false;
    seen.add(job.id); seen.add(job.redirect_url); seen.add(key); return true;
  });
  if (uniqueJobs.length > 40) warnings.push("Showing the first 40 unique jobs from this search.");
  return { jobs: uniqueJobs.slice(0, 40), warnings: [...new Set(warnings)] };
}
