# Architecture

[Project overview](../README.md) | [Setup guide](setup.md)

JobHunt EZ is a modular monolith in a pnpm workspace. A single NestJS HTTP server hosts the Next.js frontend and all API endpoints on one port. PostgreSQL and private resume storage persist application data.

```text
apps/
  web/                  Next.js frontend
    src/app/            Pages, layouts and styles
    src/components/     UI components
    src/actions/        Thin Server Actions
    src/lib/            Session adapters and presentation helpers
    public/             Public assets
  api/                  NestJS server
    src/main.ts         Single HTTP server and Next.js host
    src/app.module.ts   Module registration and page delegation
    src/auth/           Authentication, verification and sessions
    src/admin/          Admin authorization and AI settings
    src/ai/             Provider configuration and completions
    src/jobs/           Discovery, scoring and queries
    src/research/       Company research and browser integration
    src/profile/        Profile validation and workflows
    src/resumes/        PDF generation and downloads
    src/database/       Scoped repository and migrations
    src/storage/        Private PDF storage
    src/lib/            Server integrations and AI response schemas
packages/shared/        Framework-independent contracts and profile completion
scripts/                Development and production build entry points
tests/                  Unit and real database/HTTP integration tests
docs/                   Public architecture and setup documentation
data/resumes/           Private runtime files, ignored by Git
```

## Boundaries

- `apps/web` owns rendering and user interactions. Its `@/` alias resolves only to `apps/web/src`.
- `apps/api` owns authentication, authorization, database access, storage and business workflows. Internal imports are relative.
- `packages/shared` contains types and pure logic used by both apps. It cannot import either app or server libraries.
- Web Server Components and Server Actions access only the API package's explicit internal service exports. The request-scoped session adapter is marked `server-only`. Browser components use `/api/*` or Server Actions; no keys or database clients enter browser bundles.
- This is one deployment, not independently deployed frontend/backend services. NestJS delegates page requests to Next.js with an explicit `apps/web` directory. No second HTTP server, CORS workaround or self-directed HTTP request is needed.

## Runtime and data

Development exception: EMAIL_VERIFICATION_REQUIRED=false allows direct signup with a password and creates a session without email-code entry. Production always requires verified email ownership. Pending development accounts can finish signup in place, retaining their profiles; active accounts cannot have credentials replaced by registration. Both frontend and backend use the same server-side mode function via an explicit API export and a server-only web adapter.

Root `.env.local` takes precedence over root `.env` for development, build and production. `STORAGE_DIR` is resolved relative to the workspace, so existing private files remain accessible regardless of the command's working directory. Database migrations live only in `apps/api/src/database/migrations`.

`pnpm dev` checks PostgreSQL, starts the included local Compose database if unavailable, applies pending migrations, and starts the custom server with tsx watch. Remote/custom databases must already be reachable. Next.js handles frontend HMR; tsx watches backend and imported shared source. Production uses `pnpm build` followed by `pnpm start`; the build script loads root environment settings before invoking Next.js.

Database sessions are opaque, hashed and expiring. Password accounts require verified email ownership. Scoped queries enforce user ownership, and admin writes check membership in SQL. All paid workflows reserve shared database-backed allowances. API mutations require the configured origin, and host/proxy checks apply to all requests. Resumes remain private and are downloaded through authenticated routes.

Authentication UI has separate login, signup and verification forms. Signup accepts email first; activation accepts an email-bound eight-digit code or a legacy random link token and a fresh password. Both are hashed, expire after 15 minutes, and are consumed together. Resends serialize on the pending account and revoke earlier challenges only after successful delivery. Auth attempts are limited per IP and email. In development only, missing delivery credentials route emails to private Git-ignored data/mail files; production requires configured Resend delivery. No inbox route or code-logging endpoint is provided.

The custom server requires a persistent Node host. Standard Next.js serverless hosting and standalone output do not apply. Back up PostgreSQL and private storage together.

Job discovery is orchestrated by apps/api/src/jobs/discovery.ts, with isolated public ATS adapters and typed search/discovery adapters under jobs/providers. Existing aggregator behavior lives in legacy-discovery.ts behind Adzuna/JSearch adapters. Shared normalized job contracts are framework independent. Per-user PostgreSQL source caches reuse known career URLs and 30-minute role-specific snapshots; last-used ordering rotates sources without changing actual last-fetch times. Generic HTTP crawling pins public DNS, validates redirects and bounds pages/depth/body size. Browserbase CDP rendering is optional and does not use AI.

jobs/find.ts exposes reusable runJobSearch. Separate discovery admission bounds external collection independently from AI allowances. Only validated listings are saved, using a short per-user transaction/advisory lock for concurrent deduplication. Employer metadata takes precedence while tailoring/research and original discovery time are preserved. AI matching runs after persistence under the existing shared allowance; failures/limits/invalid output leave null scores and pending status. Profile hash and changed descriptions invalidate outdated scores. Publication dates, workplace, remote eligibility evidence and discovery route are independent metadata. Local and Remote targets remain a union; unknown eligibility remains explicit. No Redis, scheduler, notifications or new dependency is introduced.


Worldwide routing (2026-10-13): shared countries.ts supplies the 249 ISO-region choices, aliases and location parsing to UI/API. Preferred country/city targets reuse the existing string array; manual requests optionally carry a validated country. Unknown locations no longer default to the US. Jooble connections are resolved per target from JOOBLE_REGIONS or a single explicitly configured legacy region/host; regional IDs cannot collide. Company discovery cache query keys include destinations as well as roles. Safe error diagnostics omit raw messages and secrets. Explicit HTTP 502/503/504 failures get one bounded GET/AI retry on the same provider; no automatic provider switch.
