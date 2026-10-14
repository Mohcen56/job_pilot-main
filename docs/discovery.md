# Job discovery design

[Project overview](../README.md) | [Architecture](architecture.md) | [Setup](setup.md)

JobHunt EZ saves validated listings before asking AI to score them. Provider outages, usage limits, and invalid AI output leave those listings available with **Match pending**.

## Discovery flow

1. Authenticate the user and validate roles, locations, and source preferences.
2. Reserve an independent discovery allowance. An exhausted AI allowance does not block job collection.
3. Read known employer career sources and cached role-specific snapshots. Optional Brave Search discovers career URLs, not job records.
4. Fetch public employer feeds and configured fallback providers under bounded deadlines and concurrency.
5. Normalize listings, filter by location and publication date, and deduplicate with employer metadata preferred.
6. Save jobs in a user-scoped transaction. Preserve discovery time, tailoring, and research when listings are refreshed.
7. Score saved jobs in batches using the configured AI provider and shared allowance. Changed profiles or descriptions invalidate stale scores.
8. Display source provenance, publication/discovery dates, workplace and eligibility evidence, and pending or scored matches.

## Sources

| Source | Connection |
| --- | --- |
| Greenhouse | Public job-board API |
| Lever | Public postings API, global and EU hosts |
| Ashby | Public job-board API |
| SmartRecruiters | Public posting search and details |
| Workable | Public account/widget data |
| Company career pages | Structured JobPosting records and supported ATS links |
| JSearch | Optional OpenWeb Ninja connection for indexed publisher listings |
| Adzuna | Optional credentials and supported country endpoints |
| Jooble | Optional credentials scoped to their registered region |

Known career URLs can be saved in Profile. Generic HTML without trustworthy structured listing data is skipped. Optional Browserbase rendering is explicitly enabled with `CAREER_BROWSER_FALLBACK=true`; it does not use AI to invent job records or bypass access controls.

## Data integrity

- Provider identity, canonical application URLs, and normalized company/title/location help detect duplicates.
- Employer metadata takes precedence over aggregator metadata.
- Publication dates are separate from discovery dates. Unknown publication dates remain unknown and are excluded by publication-date filters.
- Geographic locations and Remote are independent search targets. Explicit remote restrictions are checked; unclear eligibility remains visible for manual review.
- Sources and cache snapshots are scoped to each user. Role-specific snapshots are reused for 30 minutes, and destinations participate in cache queries.
- Optional provider failures are isolated. One explicit temporary HTTP 502/503/504 failure may retry on the same provider; authentication failures and quotas do not trigger AI retries or provider switching.

## Boundaries and verification

Orchestration and provider adapters live in `apps/api/src/jobs/`. Framework-independent contracts live in `packages/shared`. The UI receives saved metadata and never provider credentials.

Unit tests cover provider normalization, source detection, safe URLs, deduplication, local/remote unions, freshness, geographic restrictions, cache behavior, and persistence when scoring fails. PostgreSQL integration tests cover ownership, concurrent imports, metadata preservation, date filtering, and lease cleanup. See `tests/direct-discovery.test.cjs`, `tests/worldwide-search.test.cjs`, and `tests/integration/discovery.test.cjs`.

## Limits

Discovery uses a 45-second deadline, bounded source/page budgets, and limited concurrency. Coverage depends on the provider and employer; selecting a region does not guarantee listings. Remote eligibility is a practical interpretation of listing evidence, not a work-permit determination. Browser fallback remains optional and needs live verification in the intended deployment. No scheduler, exhaustive crawler, notifications, or automatic application submission is included.
