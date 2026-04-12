# Phase 1: Apify LinkedIn Integration - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Hand-written from detailed brief (prompt-driven, discuss phase skipped)

<domain>
## Phase Boundary

Replace the current manual "paste your LinkedIn text" audit flow with an automated Apify-driven LinkedIn profile scraping flow. User provides a LinkedIn URL, the system scrapes the full structured profile (experience, education, skills, recommendations, headline, about, certifications) via Apify HarvestAPI, feeds the structured data to Claude for a visibly richer audit, caches results for 24 hours, and tracks usage per user against tier-based quotas. The existing CV-upload flow remains untouched and available as an alternative entry point.

**Out of scope for this phase:**
- Replacing or modifying the CV upload flow (must continue working)
- Any change to Creala payment integration (locked — working, risky)
- Migration files (we use `prisma db push`)
- Changing the 11-stage orchestrator pipeline structure (we integrate into Stage 2: Input Parsing)

</domain>

<decisions>
## Implementation Decisions

### Scraping Integration
- **D-01:** Use `apify-client` npm package (NOT MCP) — server-side only, runs in Next.js API route
- **D-02:** Actor ID: `harvestapi/linkedin-profile-scraper` — paid actor, ~$4/1,000 profiles
- **D-03:** Create new API route `POST /api/scrape-linkedin` (NOT a server action) — matches existing `/api/audit/*` convention and allows rate limiting, logging, and streaming
- **D-04:** Route returns structured JSON with a fixed schema (Zod-validated) — consumers get typed data
- **D-05:** Route is plan-gated at the integration layer (Apify quota check happens BEFORE calling Apify), separate from existing `unlock-matrix.ts` feature gating which stays owned by the audit pipeline
- **D-06:** Apify calls routed through the existing circuit-breaker pattern (`circuit-breaker.ts`) — new breaker instance keyed as `apify-harvest`, thresholds mirror the LLM breaker
- **D-07:** Apify API token read from `APIFY_API_TOKEN` env var, server-side only, never exposed to client

### Database Schema Additions (prisma db push)
- **D-08:** New model: `LinkedInProfileCache` — stores scraped profile JSON keyed by URL (normalized), 24h TTL enforced by `expiresAt` column. Fields: `id`, `url` (unique indexed), `profileData` (Json), `scrapedAt`, `expiresAt`, `apifyRunId`, `costUsd` (Decimal). Cache hit → return stored data, cache miss → scrape + store.
- **D-09:** URL normalization rule: lowercase, strip trailing slash, strip query params, strip `/in/` variations — one canonical form per profile.
- **D-10:** New fields on existing `User` model: `apifyScrapeCount` (Int, default 0), `apifyScrapeQuota` (Int, nullable — null = unlimited for paid tiers), `apifyFirstScrapeAt` (DateTime, nullable)
- **D-11:** Free-tier anonymous users tracked by IP+UA hash → new model `AnonymousApifyUsage` with `fingerprintHash` (unique indexed), `scrapeCount`, `firstScrapeAt`. Free limit: 1 scrape per fingerprint lifetime. Same pattern as existing rate limiter's IP tracking.
- **D-12:** New model: `ApifyUsageLog` — append-only usage audit log per scrape call. Fields: `id`, `userId` (nullable), `fingerprintHash` (nullable), `url`, `cacheHit` (Boolean), `apifyRunId` (nullable), `costUsd` (Decimal), `success` (Boolean), `errorCode` (nullable), `createdAt`. Used for cost accounting + admin analytics.

### Quota Logic
- **D-13:** Quota check order: (1) check `LinkedInProfileCache` for fresh entry → cache hit = no quota consumed, (2) if miss → check user quota (authed: User.apifyScrapeQuota; anon: AnonymousApifyUsage.scrapeCount < 1) → (3) if within quota → call Apify → (4) on success: increment counter + append to ApifyUsageLog
- **D-14:** Paid tiers (`starter` $5 and `recommended` $10) get `apifyScrapeQuota = null` (unlimited) — set on User record at payment webhook processing time. No Creala code change needed — the webhook already updates `User.plan`, we just add a one-line quota reset in the same handler.
- **D-15:** When quota exceeded, return HTTP 402 with localized error message ("Has usado tu escaneo gratuito..." / "You've used your free scan...") — frontend handles display + CTA to upgrade

### Enhanced Analysis Prompts
- **D-16:** NEW prompt versions in `PromptRegistry` (don't overwrite old paste-text prompts) — keeps paste flow working for CV/manual fallback
- **D-17:** Structured LinkedIn JSON is converted to a compact Markdown representation before feeding to Claude (not raw JSON) — Claude produces better output from structured markdown than from JSON. Converter lives at `src/lib/services/linkedin-profile-formatter.ts`
- **D-18:** New prompts leverage full richness: experience timeline with bullets, skill endorsement counts, recommendation text (first 3), education details, certifications, projects. Old prompts only had about + experience.
- **D-19:** Output language detection unchanged — existing language detector (`src/lib/utils/language-detect.ts`) runs against a representative slice of the profile (headline + about + first experience)

### UX Flow
- **D-20:** Landing page input page (`src/app/input/page.tsx`): primary input becomes a LinkedIn URL field, CV upload becomes a secondary "prefer to upload your CV?" toggle. URL field has inline validation (must be `linkedin.com/in/...` pattern).
- **D-21:** Loading state copy: ES "Analizando tu perfil de LinkedIn..." / EN "Analyzing your LinkedIn profile..." — shown during both scrape + audit generation (reuses existing `GenerationProgress.tsx` component with a new "scraping" step prepended)
- **D-22:** Results page unchanged structurally — just consumes richer data through existing `ScoreCardGrid.tsx` and `AppContext` state
- **D-23:** Error handling: 4 distinct localized error states — private profile, invalid URL, Apify rate limit, Apify downtime (circuit breaker open). Each gets a specific copy + recovery action (retry, try CV upload, upgrade plan).
- **D-24:** User dashboard (new small component on `/results` and existing account UI): show "Escaneos restantes: X" for free users, "Escaneos ilimitados" for paid users

### Cost Management / Observability
- **D-25:** Track cost per scrape in `ApifyUsageLog.costUsd` — at $4/1,000, each scrape = $0.004. Hardcoded in a `APIFY_COST_PER_SCRAPE` constant until we build dynamic pricing.
- **D-26:** Wire all Apify errors through existing `logError()` from `error-logger.ts` — fire-and-forget, matches existing convention
- **D-27:** Admin analytics: extend the existing `/admin/analytics` dashboard with a new "Apify Usage" section showing total scrapes, total cost, cache hit ratio, error rate (follow-up — not blocking this phase)

### Claude's Discretion
- Exact file paths for new services (`linkedin-scraper-client.ts`, `linkedin-profile-formatter.ts`, etc.) — follow `src/lib/services/` convention
- Exact Zod schema field naming for scraped profile data — should mirror Apify output where possible for debuggability
- Specific copywriting for the error states + dashboard labels — follow existing EN/ES tone
- Whether to put the scraping call inline in `/api/scrape-linkedin` or refactor into a standalone service module — prefer service module for testability
- Choice between calling Apify in sync (wait for result) vs async (run-then-poll) — start sync if latency allows; fall back to async if Vercel Lambda timeout bites

</decisions>

<specifics>
## Specific Ideas

- Brief explicitly names the Apify actor: `harvestapi/linkedin-profile-scraper`
- Brief explicitly names the Spanish loading state copy: "Analizando tu perfil de LinkedIn..."
- Brief explicitly names the two paid tiers: Starter ($5), Recommended ($10) — matches existing `plan` enum
- Brief explicitly names the free tier allotment: 1 scrape
- The 11-stage audit orchestrator already has "Stage 2: Input Parsing" which currently regex-parses pasted LinkedIn text. The new scraper output (structured JSON → markdown) feeds that same stage, producing a richer internal representation that flows through stages 3-11 unchanged.
- The existing LLM-based input structurer (`cv-work-exp-structurer.ts`) can be bypassed for Apify input (data is already structured) — save Haiku calls.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project rules and architecture
- `CLAUDE.md` — project-wide rules (prisma db push, i18n parity, logError, zero-mock)
- `CLAUDE.local.md` — Isaac's workflow preferences (solo dev, commit-to-main, verify with `npm run build`)
- `prisma/schema.prisma` — existing 9 models (User, Audit, Export, PromptRegistry, GenerationCache, Order, AnalyticsEvent, ErrorLog, BlogPost)
- `src/lib/services/audit-orchestrator.ts` — 11-stage pipeline, THE most complex file, 3687 lines — read FULLY before editing
- `src/lib/services/circuit-breaker.ts` — pattern to mirror for Apify circuit breaker
- `src/lib/services/rate-limiter.ts` — IP-fingerprint pattern to mirror for anonymous quota tracking
- `src/lib/services/error-logger.ts` — `logError()` fire-and-forget pattern
- `src/lib/services/prompt-resolver.ts` — DB-backed versioned prompts with 5min cache
- `src/lib/schemas/` — Zod schema directory pattern
- `src/lib/i18n/en.json` + `src/lib/i18n/es.json` — 683+ keys each, must stay in parity
- `src/lib/utils/language-detect.ts` — existing language detector
- `src/app/api/audit/generate/route.ts` — existing audit entry point, shows API route conventions
- `src/app/input/page.tsx` — current URL/paste input UI
- `src/components/ui/GenerationProgress.tsx` — loading state component to extend
- `src/context/AppContext.tsx` — central state (1171 lines) — new scraping state lives here

### External references
- Apify HarvestAPI actor: `harvestapi/linkedin-profile-scraper` (user has this working as MCP + npm package)
- Apify client npm: `apify-client`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Circuit breaker pattern** (`circuit-breaker.ts`): CLOSED→OPEN→HALF_OPEN→CLOSED — new instance `apify-harvest` mirrors LLM breaker config
- **Rate limiter** (`rate-limiter.ts`): 3-tier sliding window in-memory per IP — anonymous Apify quota can piggyback on this IP fingerprint technique
- **Error logger** (`error-logger.ts`): fire-and-forget logging to ErrorLog table — wire all Apify errors through this
- **Prompt registry** (`PromptRegistry` model + `prompt-resolver.ts`): versioned prompts with 5min cache — create new versions for enhanced analysis, don't edit in place
- **Zod schemas** (`src/lib/schemas/`): established validation pattern — new `linkedin-profile.ts` schema mirrors Apify output
- **Generation progress** (`GenerationProgress.tsx`): streaming progress UI — prepend "scraping" step
- **App context** (`AppContext.tsx`): already holds audit state, add `scrapedProfile` + `scrapeStatus`
- **Plan gating** (`unlock-matrix.ts` + `export-gating.ts`): feature unlock logic — add a new `apifyScrape` capability entry

### Established Patterns
- **API route structure**: admin routes use `assertAdmin()` + `adminHeaders()`; public routes use `runWithRateLimit()` + Zod validation. New `/api/scrape-linkedin` is public (gated by quota, not admin).
- **DB singleton**: `src/lib/db/client.ts` — NEVER import PrismaClient directly
- **Schema changes**: `prisma db push` ONLY, never migration files
- **i18n**: every user-facing string MUST have both en.json AND es.json entries, exact key parity
- **CSS variables**: use `var(--accent)`, `var(--surface-*)`, `var(--text-*)`, `var(--border-*)` — NEVER raw Tailwind color classes
- **Dynamic route params**: Next.js 15 params are `Promise<{id: string}>`, not plain objects
- **Zero-mock**: failed sections are omitted, never faked

### Integration Points
- **`/api/scrape-linkedin` → `/api/audit/generate`**: scrape first, pass scraped data via request body or server-side cache reference
- **New `LinkedInProfileCache` model**: Prisma schema addition via `npx prisma db push`
- **`User` model additions**: `apifyScrapeCount`, `apifyScrapeQuota`, `apifyFirstScrapeAt`
- **Creala webhook handler** (existing, DO NOT refactor): add single line to reset `apifyScrapeQuota = null` when plan upgrades
- **`input/page.tsx`**: primary input becomes LinkedIn URL field
- **`AppContext.tsx`**: add scraping state + dispatcher
- **`en.json` + `es.json`**: new keys for loading state, errors, dashboard labels
- **`GenerationProgress.tsx`**: new "scraping" progress step

</code_context>

<deferred>
## Deferred Ideas

- **Admin analytics dashboard for Apify** (D-27): new "Apify Usage" section on `/admin/analytics` showing total scrapes, cost, cache hit ratio, error rate. Not blocking this phase — add in a follow-up.
- **Dynamic Apify pricing**: currently hardcoded as `APIFY_COST_PER_SCRAPE = 0.004`. When Apify announces tier discounts or we negotiate pricing, move to env var or DB config.
- **Async scrape pattern**: if Apify sync latency consistently exceeds 10s and causes Vercel timeouts, switch to run-then-poll. Start sync, monitor p95.
- **Bulk scraping / batch mode**: no plan to support scraping multiple profiles at once in this phase.
- **LinkedIn company page scraping**: out of scope — only profile scraping.

</deferred>

---

*Phase: 01-apify-linkedin-integration*
*Context gathered: 2026-04-11*
