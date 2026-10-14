# Setup, configuration and deployment

[Back to project overview](../README.md)

## Local setup

Requires Node.js 22.12+, pnpm 10 (the workspace pins 10.34.6), and PostgreSQL 17, or Docker Desktop for the included database configuration.

1. Install dependencies:

~~~sh
pnpm install
~~~

2. Copy .env.example to .env.local, or add its settings to your existing .env. Next.js and NestJS share the same environment loading and precedence; .env.local takes priority over .env.

3. Start the entire application:

~~~sh
pnpm dev
~~~

This checks the database, starts the included Compose database when needed, applies pending migrations, and runs Next.js and NestJS on one port. Start Docker Desktop first if you use the included local database. A custom/remote DATABASE_URL must already be reachable. Development startup does not reset or seed your data.

The local database listens on localhost:15432. DATABASE_URL must match POSTGRES_PASSWORD and POSTGRES_PORT. Root .env.local takes priority over .env, including for Compose started by the development script. Existing configured databases are reused.

For manual database maintenance, use `pnpm db:up` and `pnpm db:migrate`. If running Docker Compose directly with settings in .env.local, pass `--env-file .env.local`.

Open http://localhost:3000/register. The default local setting `EMAIL_VERIFICATION_REQUIRED=false` skips email verification: enter your email, password (at least 12 characters), and password confirmation to create your account and sign in directly. Existing pending development signups can finish through this form; activated accounts must sign in and their passwords cannot be overwritten by signup. `/verify-email` redirects to signup while this local mode is active.

To test the email-code flow locally, set `EMAIL_VERIFICATION_REQUIRED=true` and restart `pnpm dev`. Signup then accepts email first and switches to verification; enter the eight-digit code and choose your password. Production always requires email verification regardless of this development setting.

Without email credentials, `pnpm dev` saves development emails to private, Git-ignored `data/mail/<user-id>.json` files. Open the file whose `to` field matches your email and read the code or activation link. These files are never served over HTTP. This local inbox is available only in development; no email is sent to your real inbox.

Outbound emails are paused by default. To enable real email delivery later, set EMAIL_DELIVERY_ENABLED=true and configure RESEND_API_KEY and EMAIL_FROM with a verified sender. Production signup requires these settings. Codes and links expire after 15 minutes and are consumed together on activation. Resending replaces earlier codes and links; failed delivery preserves the previous working code. The verification screen includes resend, change-email, and clear error messages. Google/GitHub sign-in buttons appear only when configured.

Existing password accounts still need verified email ownership. The trusted `pnpm auth:verify you@example.com` command can verify an existing account that already has a password; new email-only signups must use the code flow to choose a password. Use the trusted command only for an account whose ownership you have checked.

## Environment variables

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | Required PostgreSQL connection string |
| APP_URL | Application origin; defaults to http://localhost:3000. Must match the address used in your browser |
| PORT | HTTP port, default 3000 |
| STORAGE_DIR | Private resume directory, default ./data/resumes |
| RESEND_API_KEY / EMAIL_FROM | Required for production password registration and verification email delivery |
| TRUSTED_PROXIES | Comma-separated IPs/subnets of your actual reverse proxies; empty means direct connections |
| AI_USER_HOURLY_LIMIT / AI_USER_DAILY_LIMIT | Shared AI task allowance per account, defaults 5/hour and 20/day |
| AI_GLOBAL_DAILY_LIMIT / AI_MAX_CONCURRENT | Deployment allowance and concurrent AI tasks, defaults 200/day and 3 tasks |
| GEMINI_API_KEY | AI key for the initial default provider |
| OPENAI_API_KEY / GROQ_API_KEY | Optional alternative AI providers |
| GEMINI_MODEL / OPENAI_MODEL / GROQ_MODEL | Optional model overrides; choose models supported by your account |
| ADZUNA_APP_ID / ADZUNA_APP_KEY | Optional Adzuna fallback; public employer ATS sources need no API key |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | Optional Google sign-in |
| GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET | Optional GitHub sign-in |
| BROWSERBASE_API_KEY / BROWSERBASE_PROJECT_ID | Optional website browsing for company research |
| NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_HOST | Optional analytics |

InsForge URL and anon-key variables are no longer used. All AI, OAuth, and database credentials stay on the server. Keep .env and .env.local out of GitHub.

## OAuth setup

Register OAuth applications with the providers and use these callback URLs locally:

- Google: http://localhost:3000/api/auth/callback/google
- GitHub: http://localhost:3000/api/auth/callback/github

For deployment, replace the origin with APP_URL. Authentication uses expiring database sessions, httpOnly cookies, OAuth state validation, and PKCE. Different sign-in methods are not automatically linked by matching email addresses; continue with the method used to create the account.

## Admin access

Create your account first, then run:

~~~sh
pnpm admin:grant you@example.com
~~~

Sign in and open /admin. Admin membership is provisioned through this trusted local command. Users cannot promote themselves. The page lets you select a provider only when its server-side key is configured. It is an AI settings page, not a general database administration dashboard.

The selected provider is saved globally in PostgreSQL and applies to matching, extraction, resume generation, and company research. A usage limit produces a notice; the app does not automatically switch providers or spend another provider's credits.

## Architecture

~~~text
Browser -> one NestJS HTTP server
             |-- /api/* -> auth, jobs, research, profiles, resumes, admin
             |-- page requests -> Next.js UI
             |-- PostgreSQL -> users, sessions, profiles, jobs, AI settings
             |-- private disk -> authenticated resumes
~~~

```text
apps/
  web/                 Next.js frontend, public assets and UI config
    src/{app,components,actions,lib}/
  api/                 NestJS server and business modules
    src/{auth,admin,ai,jobs,research,profile,resumes,database,storage}/
packages/shared/       Shared types and pure profile helpers
scripts/               Root development and build runners
tests/                 Unit and database/HTTP integration tests
docs/                  Architecture, discovery design and setup guidance
```

Each app declares its dependencies. The pnpm workspace links them locally; the frontend uses explicit internal API exports only from server code. Database queries, authorization and business workflows stay in `apps/api`. The old root backend, Next API handlers and compatibility wrappers have been removed.

Database migrations live in `apps/api/src/database/migrations/`. The application does not import former InsForge accounts/files automatically. Existing local PostgreSQL data and private resumes remain in place.

## Build and checks

~~~sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm start
~~~

With a dedicated local test database and the monolith running, `pnpm test:integration` checks real sign-in, data isolation, profile writes, storage, admin permissions, and page rendering. It creates and removes temporary accounts. Use test-only provider keys to exercise successful provider switching; it makes no AI calls.

pnpm start launches the same monolith in production mode. Use a persistent Node host or container, a PostgreSQL database, HTTPS, and a persistent disk mounted at STORAGE_DIR. Set APP_URL to your HTTPS origin. The custom NestJS/Next.js server requires a running Node process; standard Next.js serverless deployment and standalone output are not the deployment mode for this application. Back up both PostgreSQL and the resume directory.

GET /api/health checks process health. GET /api/health/ready checks database/schema availability. Restart the server after changing environment variables. API mutations require an Origin header matching APP_URL. Every request must use the Host from APP_URL. Configure your HTTPS proxy to preserve that host and overwrite forwarded headers; list only that proxy's addresses in TRUSTED_PROXIES.

AI allowances cover all paid workflows, including Server Actions. Reservations are atomic across processes; each account can run one task at a time. Allowances count admitted attempts, including failures. Daily limits reset at midnight UTC. Limit responses include Retry-After and use the existing accessible notice.

The 2MB PDF limit is enforced in the UI and backend; Server Actions permit 3MB to include multipart overhead. Analytics delivery failures never change a saved operation's result.

Run `pnpm audit --prod` to check current production dependency advisories and `pnpm audit` for development tools. Tailwind stays pinned to 3.4.19; assess advisories individually rather than forcing major upgrades.

Next.js reloads frontend edits during development. The API watcher restarts the monolith after backend or imported shared-code changes. Root environment files are shared by development, build and production. Relative STORAGE_DIR paths resolve from the workspace root. Restart after changing environment variables.

## Documentation

- [NestJS](https://docs.nestjs.com/)
- [Next.js custom servers](https://nextjs.org/docs/app/guides/custom-server)
- [PostgreSQL client](https://node-postgres.com/features/queries)
- [Gemini compatibility](https://ai.google.dev/gemini-api/docs/openai)
- [Groq compatibility](https://console.groq.com/docs/openai)
- [OpenAI API](https://developers.openai.com/api/docs/)
- [Adzuna API](https://developer.adzuna.com/)

### Saved job search preferences

In Profile, save desired job titles, preferred locations and job boards. Use **+ Add Remote** to search remote jobs alongside geographic locations. A Remote tag is an additional search target: Germany plus Remote returns jobs in Germany (including onsite) and a separate remote search. City locations outside the US should include the country, for example `Lyon, France`. With no desired titles, profile search falls back to the current title; with no preferred locations, it falls back to the profile location. The legacy Remote Only selection applies when no explicit Remote tag is present.

Click **Search using my profile** on Find Jobs. Manual searches also use saved sources. Company careers / ATS is enabled by default; existing Adzuna and JSearch choices remain available. Searches import up to 40 validated, unique jobs. Missing keys or failed sources produce warnings while other sources continue. AI matching uses one shared admission and batches of ten after valid listings are saved. Outages, invalid AI output and exhausted AI allowances leave scores null and show **Match pending**; rerun the search to retry. Changed profile data or job descriptions invalidate outdated scores. Tailoring and research are preserved when listing metadata is refreshed.

Adzuna uses its configured credentials and supported country endpoints. Its remote search queries US listings with remote keywords, so check work arrangements and geographic eligibility. Unsupported countries display a coverage notice rather than searching the US silently.

For LinkedIn, Indeed and indexed Kariyer.net listings, configure `OPENWEBNINJA_API_KEY` server-side in the root environment and restart. Get the key from [OpenWeb Ninja JSearch](https://www.openwebninja.com/api/jsearch). The existing `/jsearch/search-v2` integration requests publisher-specific searches and retains publisher provenance. Direct application options are preferred when provided. This is an aggregate of indexed jobs, not an account connection or direct scraping of LinkedIn/Indeed/StepStone. Kariyer.net coverage is not guaranteed. Explicit temporary HTTP 502/503/504 failures allow one bounded same-provider retry; quotas, authentication failures and ambiguous timeouts do not trigger AI retries.

Migration `003_job_preferences.sql` adds saved boards (default Adzuna) and optional job source provenance without changing accounts, resumes or other profile values. Root development startup applies migrations; deployments should run the normal migration command before startup.

### Direct employer discovery

Public ATS adapters support [Greenhouse](https://docs.greenhouse.io/job-board.html), [Lever global/EU](https://github.com/lever/postings-api), [Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api), [SmartRecruiters](https://developers.smartrecruiters.com/docs/endpoints), and [Workable](https://workable.readme.io/reference/jobs-1). Public listing reads need no employer credentials. Workable's documented endpoint currently redirects to its public widget host; only its two official hosts are allowed. Company identifiers/URLs are necessary: these APIs are company boards, not global search engines.

Add official **Company career URLs** to Profile. Optionally configure `SEARCH_API_KEY` with a [Brave Search token](https://api-dashboard.search.brave.com/app/documentation/web-search) to discover new companies. Search results identify sources only; snippets are never saved as jobs. Known sources, provider identifiers, discovery route, last fetched/used times and normalized snapshots are stored per user in PostgreSQL. Snapshots are reused for 30 minutes for the same roles, with old sources rotated. Publication dates remain those reported by the listing provider.

Generic pages use HTTP first: JobPosting JSON-LD, embedded JSON containing JobPosting records, career/detail links, and recognizable ATS URLs in serialized page data. Only genuine structured listings with title, company, provider/id and valid job/application URLs are persisted. Pages without trustworthy listing data are skipped. Optional JavaScript rendering uses the existing Browserbase SDK and deterministic CDP when `CAREER_BROWSER_FALLBACK=true` and both Browserbase credentials exist. It uses no LLM and does not bypass authentication/CAPTCHA. It is opt-in because browser sessions cost money.

Requests have a 45-second discovery deadline, bounded response sizes, three company tasks and three fallback tasks in parallel, at most 12 initial company sources plus bounded ATS hops, six Brave queries, 18 fallback targets, and five generic pages per source at depth two. Generic HTTP requests pin public DNS addresses, validate redirects, respect obvious robots/access restrictions, enforce domain spacing, and retry a transient public GET at most once. Direct scraping of LinkedIn, Indeed and StepStone is excluded. Independent PostgreSQL admission allows 20 discoveries per user/hour and three concurrent discoveries deployment-wide, so discovery remains available when AI matching is unavailable.

Optional `JOOBLE_API_KEY` enables Jooble as a fallback; `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` retain Adzuna. All credentials stay server-side. `.env.local` takes precedence over `.env`; restart after changes. No credentials are added to either file by this feature.

Deduplication compares provider/id, canonical application URLs (tracking removed), and normalized company/title/location. Employer ATS/company metadata wins over aggregators, including on later imports. Publication dates are separate from `found_at` discovery time: Greenhouse detail `first_published`, Ashby `publishedAt`, SmartRecruiters `releasedDate`, Workable `published_on`, JSearch posted datetime, and Adzuna's publication field. Lever creation timestamps and Jooble update timestamps are deliberately not treated as publication dates. Freshness options are 24h/3d/7d/14d/30d; unknown dates are visible and excluded when a date filter is active.

Remote eligibility recognizes explicit country restrictions, worldwide, Europe, EU and EMEA. Explicit incompatibilities are excluded; unknown eligibility is labeled and remains unverified. Region coverage is a practical heuristic, not a work-permit determination. Junior/intern/graduate/associate and years requirements produce strong/stretch/poor/unknown seniority indicators; two years can be a stretch for a new grad. AI matching considers semantic required/preferred skills, experience, education, recorded work/projects, geographic evidence and authorization. It never downloads portfolio pages or invents projects.

`runJobSearch` is reusable for future scheduling. No scheduler or notifications are installed. Migrations 004–007 add metadata, per-user source cache/rotation, discovery limits and profile-aware scoring without replacing accounts, resumes or jobs. See [the discovery design](discovery.md) for live verification, limitations and a test plan.


### Searching across countries

Choose Country in Find Jobs, optionally enter a city (or Remote). In Profile, use Country + optional City and Add location to save multiple destinations. All 249 ISO regions can be selected. Country-specific provider coverage still applies: Kariyer.net is Turkey-only and Adzuna is skipped outside its supported markets. Company careers/ATS sources and connected JSearch sources can be selected for other markets. Unknown typed cities require a country for aggregator routing; they never default to the US.

Jooble keys are regional. Keep a single key with `JOOBLE_API_KEY`, `JOOBLE_COUNTRY` and `JOOBLE_HOST`, or configure several regions with server-only `JOOBLE_REGIONS`:

```dotenv
JOOBLE_REGIONS='{"tr":{"apiKey":"YOUR_TR_KEY","host":"tr.jooble.org"},"gb":{"apiKey":"YOUR_UK_KEY","host":"uk.jooble.org"}}'
```

Use the regional domain from your Jooble API registration. A missing regional connection skips that country only. Existing `JOOBLE_API_KEY` defaults to the US; it is never reused for other countries. No regional configuration was added to your private environment automatically.

Public GET feeds and AI completions retry explicit temporary HTTP 502/503/504 failures once on the same provider. Authentication, quota and ambiguous connection failures do not trigger AI retries or provider switching. Failed company feeds show actionable notices; server logs record provider/board, safe category and HTTP status, omitting keys, request URLs, response bodies and prompts. Valid jobs remain saved as Match pending if scoring fails.
