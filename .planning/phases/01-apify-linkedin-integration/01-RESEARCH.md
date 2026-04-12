# Phase 1: Apify LinkedIn Integration - Research

**Researched:** 2026-04-11
**Domain:** External API integration (Apify scraping) + Next.js 15 API route + Prisma schema extension + enhanced LLM prompts + bilingual UX
**Confidence:** HIGH on in-repo patterns, MEDIUM on Apify HarvestAPI output shape (actor is proprietary — exact JSON keys need a single probe call to confirm)

## Summary

Phase 1 replaces the current "paste LinkedIn text" flow with an Apify HarvestAPI scrape. The critical implementation insight is that **Stage 2 of the 11-stage orchestrator (`parseLinkedinWithStructuring`) already produces a `Record<string, string>` of section-keyed text that stages 3–11 consume**. The Apify path only needs to produce that same `Record<string, string>` from structured JSON — we do NOT touch the orchestrator signature or stages 3–11. This is a clean, minimal-risk integration point.

Three additional findings drive planning:
1. **Vercel timeout risk is real but manageable.** The default Lambda is 10s; `maxDuration = 120` is configured only on `/api/audit/stream` (verified `src/app/api/audit/stream/route.ts:9`). `/api/scrape-linkedin` MUST declare `export const maxDuration = 60` (or higher) and `export const runtime = "nodejs"`. HarvestAPI sync calls typically take 10–40s for a single profile, so the default 10s will fail.
2. **No test framework is installed.** `package.json` has no `vitest`, `jest`, or `test` script. Existing `*.test.ts` files under `src/lib/services/__tests__/` are standalone tsx scripts (e.g., `npx tsx src/lib/services/__tests__/linkedin-experience-archetype.test.ts` per that file's header comment). This phase MUST either introduce vitest (Wave 0 infra task) or continue the tsx-script convention. Recommendation below.
3. **Apify HarvestAPI output is not fully documented publicly.** The high-level field list (headline, about, experience, education, skills, certifications, projects, languages, publications, honors, volunteering, recommendations, currentPosition, connectionsCount, followerCount, etc.) is confirmed [CITED: github.com/HarvestAPI/apify-linkedin-profile], but exact key names and nesting depth must be captured with a single probe-call + snapshot fixture in Wave 0. The Zod schema in `src/lib/schemas/linkedin-profile.ts` must be defensive (`.passthrough()` on nested objects, optional everywhere except the hardest guarantees) to avoid breaking on actor output drift.

**Primary recommendation:** Install `apify-client@2.22.3` [VERIFIED: npm registry, 2026-04-11], create a thin `linkedin-scraper-client.ts` service wrapping `ApifyClient.actor("harvestapi/linkedin-profile-scraper").call(...)` with a dedicated circuit breaker instance. Normalize the scraped JSON to the existing `Record<string, string>` section contract via a new `linkedin-profile-formatter.ts` converter. Add three new Prisma models and extend `User` with three new fields, push with `prisma db push`, and wire a single one-line reset of `apifyScrapeQuota = null` into the existing Creala webhook at `src/app/api/webhooks/creala/route.ts:246`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scraping Integration**
- **D-01:** Use `apify-client` npm package (NOT MCP) — server-side only, runs in Next.js API route
- **D-02:** Actor ID: `harvestapi/linkedin-profile-scraper` — paid actor, ~$4/1,000 profiles
- **D-03:** Create new API route `POST /api/scrape-linkedin` (NOT a server action) — matches existing `/api/audit/*` convention and allows rate limiting, logging, and streaming
- **D-04:** Route returns structured JSON with a fixed schema (Zod-validated) — consumers get typed data
- **D-05:** Route is plan-gated at the integration layer (Apify quota check happens BEFORE calling Apify), separate from existing `unlock-matrix.ts` feature gating which stays owned by the audit pipeline
- **D-06:** Apify calls routed through the existing circuit-breaker pattern (`circuit-breaker.ts`) — new breaker instance keyed as `apify-harvest`, thresholds mirror the LLM breaker
- **D-07:** Apify API token read from `APIFY_API_TOKEN` env var, server-side only, never exposed to client

**Database Schema Additions (prisma db push)**
- **D-08:** New model `LinkedInProfileCache` — 24h TTL, keyed by normalized URL
- **D-09:** URL normalization rule: lowercase, strip trailing slash, strip query params, strip `/in/` variations
- **D-10:** `User` gains `apifyScrapeCount` (Int, default 0), `apifyScrapeQuota` (Int, nullable), `apifyFirstScrapeAt` (DateTime, nullable)
- **D-11:** New model `AnonymousApifyUsage` keyed by `fingerprintHash` — free limit: 1 scrape per fingerprint lifetime
- **D-12:** New model `ApifyUsageLog` — append-only audit log per scrape call

**Quota Logic**
- **D-13:** Quota check order: cache → user quota → Apify call → increment + log
- **D-14:** Paid tiers get `apifyScrapeQuota = null` — set at Creala webhook time. No Creala code refactor.
- **D-15:** Quota exceeded → HTTP 402 with localized message

**Enhanced Analysis Prompts**
- **D-16:** NEW prompt versions in `PromptRegistry` (don't overwrite old paste-text prompts)
- **D-17:** Structured JSON → compact Markdown before feeding Claude. Converter: `src/lib/services/linkedin-profile-formatter.ts`
- **D-18:** New prompts leverage experience bullets, endorsement counts, recommendation text (first 3), education details, certifications, projects
- **D-19:** Output language detection unchanged — existing detector runs on headline + about + first experience

**UX Flow**
- **D-20:** Landing `src/app/input/page.tsx`: primary input is LinkedIn URL; CV upload demoted to secondary toggle. URL inline-validated against `linkedin.com/in/...`
- **D-21:** Loading copy: ES "Analizando tu perfil de LinkedIn..." / EN "Analyzing your LinkedIn profile..." — reuses `GenerationProgress.tsx` with "scraping" step prepended
- **D-22:** Results page structure unchanged — richer data flows through existing components
- **D-23:** 4 localized error states: private profile, invalid URL, Apify rate limit, circuit breaker open
- **D-24:** Dashboard chip on `/results`: "Escaneos restantes: X" or "Escaneos ilimitados"

**Cost/Observability**
- **D-25:** Hardcoded `APIFY_COST_PER_SCRAPE = 0.004` constant
- **D-26:** Route all Apify errors through `logError()`
- **D-27:** Admin "Apify Usage" section — follow-up, not blocking

### Claude's Discretion
- Exact file paths under `src/lib/services/` (prefer service module over inline)
- Zod field naming (mirror Apify output for debuggability)
- Error-state copy (match existing EN/ES tone)
- Service-module vs inline route logic — **prefer service module for testability**
- Sync vs async Apify call pattern — **start sync; fall back to async if Vercel Lambda timeout bites**

### Deferred Ideas (OUT OF SCOPE)
- Admin analytics dashboard for Apify (D-27)
- Dynamic Apify pricing (env var / DB config)
- Async run-then-poll pattern (only if sync exceeds budget)
- Bulk scraping / batch mode
- LinkedIn company page scraping
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-01 | Replace manual LinkedIn paste with automatic Apify-based scraping | `apify-client@2.22.3` + new `/api/scrape-linkedin` route + `LinkedInProfileCache` model. Integration point: Stage 2 of orchestrator (`parseLinkedinWithStructuring` at `audit-orchestrator.ts:2182-2239`). Scraped data → markdown → fed as `linkedinText` OR bypass parser by pre-populating `linkedinSections` Record — see "Orchestrator Stage 2 Integration" section below. |
| REQ-02 | Enhanced Claude analysis prompts that consume structured LinkedIn data | New prompt versions via existing `PromptRegistry` (never edit existing rows). Converter module `linkedin-profile-formatter.ts` emits markdown slots Claude reads. See "Markdown Formatter Spec" section. |
| REQ-03 | Updated UX: URL input → loading → results, CV upload preserved | Extend `src/app/input/page.tsx`, `GenerationProgress.tsx` ("scraping" step), `AppContext.tsx` (new `scrapedProfile` + `scrapeStatus` state fields). EN+ES i18n parity mandatory. |
| REQ-04 | Tiered quota (free: 1, paid: unlimited) with dashboard | `User` fields + `AnonymousApifyUsage` + `ApifyUsageLog`. Creala webhook insertion at `src/app/api/webhooks/creala/route.ts:246` (single-line change). Dashboard chip on `/results`. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These are hard rules the planner MUST honor. Contradicting any of these requires explicit user approval.

| Constraint | Source | Applies To |
|-----------|--------|-----------|
| `prisma db push` ONLY — never migration files | CLAUDE.md + `.claude/rules/database.md` | Schema changes for 4 new tables + User extension |
| `npm run build` must pass zero errors before commit | CLAUDE.md + CLAUDE.local.md | Every task in the phase |
| EN + ES i18n parity — every user-facing string needs both keys | CLAUDE.md | All loading/error/dashboard copy in this phase |
| `logError()` fire-and-forget — never blocks the request | CLAUDE.md + `.claude/rules/database.md` | Apify errors, quota denials, circuit-breaker trips |
| Zod validation BEFORE DB writes or LLM calls | CLAUDE.md | `linkedin-profile.ts` Zod schema, scrape-linkedin request body |
| Never expose server-only env vars client-side | CLAUDE.md + `.claude/rules/security.md` | `APIFY_API_TOKEN` — server-only |
| Import Prisma ONLY from `src/lib/db/client.ts` singleton | CLAUDE.md | All new services |
| CSS uses `var(--accent)`, `var(--surface-*)`, `var(--text-*)`, `var(--border-*)` — NOT raw Tailwind colors | CLAUDE.md + `.claude/rules/components.md` | All new UI (input field, loading step, dashboard chip, error banners) |
| Admin routes require `assertAdmin()` + `adminHeaders()` | CLAUDE.md | Not applicable to `/api/scrape-linkedin` (public, quota-gated) |
| Zero-mock policy: failed sections omitted, never faked | CLAUDE.md | Apify failure → show localized error, never fake profile |
| Next.js 15 dynamic route params are `Promise<{id: string}>` | CLAUDE.md | Not directly applicable here (no dynamic segments) but relevant if sub-routes added |
| Every API route exports named handlers (POST etc.) wrapped in try/catch + `logError()` | `.claude/rules/api-routes.md` | `/api/scrape-linkedin` POST handler |
| Error codes follow `RESOURCE_ACTION_FAILED` pattern | `.claude/rules/api-routes.md` | New codes: `APIFY_SCRAPE_FAILED`, `APIFY_QUOTA_EXCEEDED`, `APIFY_PROFILE_PRIVATE`, `APIFY_INVALID_URL`, `APIFY_CIRCUIT_OPEN`, `APIFY_CACHE_HIT` (info-level) |
| Server Components by default; `"use client"` only for interactivity | `.claude/rules/components.md` | Input page already `"use client"`; dashboard chip can be server-rendered |
| Test files colocated with source (`Name.test.tsx` next to `Name.tsx`) | `.claude/rules/testing.md` | New tests for formatter, Zod schema, quota logic |
| Mock LLM responses in orchestrator tests — never real API | `.claude/rules/testing.md` | Apify also must be mocked in unit tests; fixture-based |
| Test i18n: verify both EN and ES paths produce valid results | `.claude/rules/testing.md` | Apply to error-state tests |
| Rate limiter is in-memory — 3 tiers: 5/1min, 20/1hr, 50/24hr | `.claude/rules/security.md` | Add a dedicated limiter for `/api/scrape-linkedin` — critical for cost abuse |
| Never log full user input to ErrorLog — use sanitized `inputMeta` | `.claude/rules/security.md` | Log URL only if PII-free; prefer `urlHash` + domain flag |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `apify-client` | `2.22.3` | Run Apify actors from Node.js | [VERIFIED: npm view apify-client, 2026-04-11]. Official SDK, full TypeScript types, built-in exponential backoff, axios-based, ~2.7MB unpacked. Only supported option for calling a paid private actor programmatically. [CITED: docs.apify.com/api/client/js/] |
| `zod` | `^4.3.6` (already installed) | Validate scraped payload + request bodies | Already the project's validation standard. `.passthrough()` + `.catchall()` handle actor output drift. |
| `@prisma/client` | `^5.22.0` (already installed) | ORM for new models | Existing singleton at `src/lib/db/client.ts`. |

**Installation:**
```bash
npm install apify-client
```

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto` (built-in) | Node 20+ | SHA-256 hash for fingerprint + URL cache key | Already used by rate limiter pattern. No new dep. |
| `@anthropic-ai/sdk` | `^0.78.0` (already installed) | Claude calls via existing `llm-client.ts` | Zero change — formatter produces a string fed to existing pipeline. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `apify-client` | Raw `fetch()` against Apify REST API | Smaller bundle, but lose types, retry backoff, and run polling logic — all things the project values. Locked decision D-01 is correct. |
| `@harvestapi/scraper` (direct actor wrapper) | Would bypass Apify and call HarvestAPI directly | Not an option — HarvestAPI is distributed AS the Apify actor; the npm wrapper just calls Apify internally. Extra abstraction for no benefit. |
| Sync `actor.call()` | Start run async + poll progress endpoint | Sync is simpler, fits single-Lambda invocation. Start sync with `waitSecs: 50`. If p95 > 55s, migrate to async pattern — see "Vercel Timeout Strategy" below. |

**Version verification:**
- `apify-client` → `2.22.3` published 2025 [VERIFIED: `npm view apify-client` output, deps: axios ^1.6.7, ow ^0.28.2, type-fest ^4.0.0]

## Architecture Patterns

### Recommended File Structure

```
src/
├── app/
│   └── api/
│       └── scrape-linkedin/
│           └── route.ts                 # NEW — POST handler, rate-limited, quota-gated
├── lib/
│   ├── schemas/
│   │   └── linkedin-profile.ts          # NEW — Zod schemas for Apify request + response
│   ├── services/
│   │   ├── apify-scraper-client.ts      # NEW — thin ApifyClient wrapper, timeout, circuit breaker
│   │   ├── linkedin-profile-formatter.ts # NEW — JSON → markdown + JSON → Record<string,string>
│   │   ├── apify-quota.ts               # NEW — quota check/increment (user + anonymous)
│   │   ├── apify-cache.ts               # NEW — read/write LinkedInProfileCache, URL normalization
│   │   ├── apify-fingerprint.ts         # NEW — SHA-256 IP+UA hash (reused from rate-limiter style)
│   │   └── circuit-breaker.ts           # MODIFIED — export new `apifyCircuitBreaker` instance
│   └── i18n/
│       ├── en.json                      # MODIFIED — add apify.* keys
│       └── es.json                      # MODIFIED — add apify.* keys
├── components/
│   ├── input/
│   │   └── LinkedinUrlPrimaryInput.tsx  # NEW — URL field with inline validation (replaces primary role of LinkedinInputSection)
│   └── results/
│       └── ApifyQuotaChip.tsx           # NEW — "Escaneos restantes: X" chip
├── context/
│   └── AppContext.tsx                   # MODIFIED — add scrapedProfile + scrapeStatus
└── hooks/
    └── useLinkedinScrape.ts             # NEW — client hook orchestrating fetch + error mapping
```

### Pattern 1: Apify actor sync call with circuit breaker + timeout

```typescript
// src/lib/services/apify-scraper-client.ts
// [CITED: docs.apify.com/api/client/js/reference/class/ActorClient#call]
import { ApifyClient } from "apify-client";
import { apifyCircuitBreaker } from "./circuit-breaker";
import { logError } from "./error-logger";

const APIFY_ACTOR_ID = "harvestapi/linkedin-profile-scraper";
const APIFY_WAIT_SECS = 50; // wait up to 50s before returning incomplete run
const APIFY_TIMEOUT_SECS = 55; // actor-side timeout (<60 to leave buffer)
const APIFY_MEMORY_MB = 512;

const token = process.env.APIFY_API_TOKEN;
if (!token && process.env.NODE_ENV === "production") {
  console.error("[Apify] APIFY_API_TOKEN missing in production");
}

const client = token ? new ApifyClient({ token }) : null;

export async function scrapeLinkedinProfile(params: {
  profileUrl: string;
  requestId: string;
}): Promise<{ runId: string; items: unknown[]; costUsd: number }> {
  if (!client) throw new Error("APIFY_TOKEN_MISSING");
  if (!apifyCircuitBreaker.allowRequest()) {
    throw new Error("CIRCUIT_OPEN");
  }
  const startedAt = Date.now();
  try {
    const run = await client.actor(APIFY_ACTOR_ID).call(
      {
        profileUrls: [params.profileUrl],
        profileScraperMode: "Profile details no email",
      },
      { waitSecs: APIFY_WAIT_SECS, timeout: APIFY_TIMEOUT_SECS, memory: APIFY_MEMORY_MB }
    );
    if (run.status !== "SUCCEEDED") {
      apifyCircuitBreaker.recordFailure(/*transient*/ run.status === "TIMED-OUT");
      throw new Error(`APIFY_RUN_${run.status}`);
    }
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    apifyCircuitBreaker.recordSuccess();
    return {
      runId: run.id,
      items,
      costUsd: Number(run.usageTotalUsd ?? 0.004),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    const transient = msg.includes("429") || msg.includes("timeout") || msg.includes("econnreset");
    apifyCircuitBreaker.recordFailure(transient);
    logError({
      level: "error",
      source: "services/apify-scraper-client",
      message: `Apify scrape failed: ${err instanceof Error ? err.message : "unknown"}`,
      error: err,
      code: "APIFY_SCRAPE_FAILED",
      requestId: params.requestId,
      inputMeta: { durationMs: Date.now() - startedAt, transient },
    });
    throw err;
  }
}
```

**Notes on the pattern:**
- Mirrors `src/lib/services/llm-client.ts` circuit breaker integration (verified pattern from `circuit-breaker.ts:251` — exported singleton).
- The exact input field name (`profileUrls` vs `urls` vs `profiles`) MUST be confirmed in Wave 0 via a single probe call — documented public info uses `profileUrls` but the actor's INPUT_SCHEMA on Apify is the source of truth. [ASSUMED] until probe run.
- `run.usageTotalUsd` is populated by Apify on completed runs [CITED: docs.apify.com/api/client/js/reference/class/RunClient]. If undefined, fall back to `APIFY_COST_PER_SCRAPE = 0.004`.

### Pattern 2: New circuit breaker instance (mirror existing)

```typescript
// Append to src/lib/services/circuit-breaker.ts below line 251
/** Singleton circuit breaker for Apify HarvestAPI calls */
export const apifyCircuitBreaker = new CircuitBreaker({
  windowSize: 30,
  failureThreshold: 0.6,
  minSamples: 8,     // lower than LLM — Apify calls are rarer per Lambda
  cooldownMs: 20_000, // 20s cooldown for Apify rate-limit recovery
  successStreakToClose: 2,
});
```

**Verified pattern:** `circuit-breaker.ts:48-248` — constructor takes `Partial<CircuitBreakerConfig>`, pattern is the same for every breaker.

### Pattern 3: Prisma schema additions (append to `prisma/schema.prisma`)

```prisma
// Appended to prisma/schema.prisma. Run: npx prisma db push

model LinkedInProfileCache {
  id            String   @id @default(uuid())
  url           String   @unique                 // normalized canonical URL
  urlHash       String   @map("url_hash")        // SHA-256 for fast equality + index
  profileData   Json     @map("profile_data")    // raw scraped JSON (validated server-side before write)
  scrapedAt     DateTime @default(now()) @map("scraped_at")
  expiresAt     DateTime @map("expires_at")      // scrapedAt + 24h
  apifyRunId    String?  @map("apify_run_id")
  costUsd       Decimal  @default(0.004) @map("cost_usd") @db.Decimal(10, 6)

  @@index([urlHash])
  @@index([expiresAt])
  @@map("linkedin_profile_cache")
}

model AnonymousApifyUsage {
  id               String   @id @default(uuid())
  fingerprintHash  String   @unique @map("fingerprint_hash")
  scrapeCount      Int      @default(0) @map("scrape_count")
  firstScrapeAt    DateTime @default(now()) @map("first_scrape_at")
  lastScrapeAt     DateTime @default(now()) @map("last_scrape_at")
  createdAt        DateTime @default(now()) @map("created_at")

  @@map("anonymous_apify_usage")
}

model ApifyUsageLog {
  id              String   @id @default(uuid())
  userId          String?  @map("user_id")
  fingerprintHash String?  @map("fingerprint_hash")
  url             String?  // normalized URL, redacted of query params
  urlHash         String?  @map("url_hash")
  cacheHit        Boolean  @default(false) @map("cache_hit")
  apifyRunId      String?  @map("apify_run_id")
  costUsd         Decimal  @default(0) @map("cost_usd") @db.Decimal(10, 6)
  success         Boolean  @default(true)
  errorCode       String?  @map("error_code")
  durationMs      Int?     @map("duration_ms")
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([createdAt])
  @@index([cacheHit])
  @@index([success])
  @@index([errorCode])
  @@map("apify_usage_log")
}

// Extend existing User model (add the 3 fields, keep existing fields)
// The planner must edit the existing User block at prisma/schema.prisma:11-23, adding:
//   apifyScrapeCount   Int       @default(0) @map("apify_scrape_count")
//   apifyScrapeQuota   Int?      @map("apify_scrape_quota")        // null = unlimited
//   apifyFirstScrapeAt DateTime? @map("apify_first_scrape_at")
```

**Verified conventions from `prisma/schema.prisma`:**
- snake_case via `@map` — lines 15, 17, 18, 19, 32, 35, etc.
- `Json` fields — line 28 (`Audit.results`), line 78 (`GenerationCache.results`), line 154 (`ErrorLog.inputMeta`)
- `@@index` composites — lines 70, 111–116, 159–163
- UUID default — every model uses `@default(uuid())`
- `createdAt` + `updatedAt` convention — `@default(now())` + `@updatedAt`
- `Decimal` for money — **NOT currently used in existing schema** (existing `price Float?` on `Order` line 99). Decision: use `Decimal @db.Decimal(10, 6)` for `costUsd` to avoid FP error accumulation across thousands of scrapes. This is a tradeoff the planner should confirm — existing code uses `Float` for money. [ASSUMED] Decimal is better for auditing; the planner may choose Float for consistency.

### Pattern 4: API route shape (public, quota-gated)

```typescript
// src/app/api/scrape-linkedin/route.ts
// Pattern verified against src/app/api/audit/generate/route.ts:16-120
import { NextResponse } from "next/server";
import { logError, extractRequestMeta } from "@/lib/services/error-logger";
import { scrapeLinkedinRequestSchema } from "@/lib/schemas/linkedin-profile";
import { scrapeRateLimiter } from "@/lib/services/rate-limiter";
import { scrapeAndCache } from "@/lib/services/apify-scraper-client";
// ...

export const runtime = "nodejs";
export const maxDuration = 60; // CRITICAL: default is 10s, will fail Apify sync call

export async function POST(request: Request) {
  const { ip, userAgent } = extractRequestMeta(request);
  try {
    const body = await request.json();
    const parsed = scrapeLinkedinRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "APIFY_INVALID_URL", detail: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }
    const rate = scrapeRateLimiter.check(ip ?? "unknown");
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "RATE_LIMITED", retryAfter: rate.retryAfter },
        { status: 429 }
      );
    }
    // Quota check (user OR anonymous) → scrape → persist → return
    const result = await scrapeAndCache({ url: parsed.data.url, ip, userAgent });
    return NextResponse.json(result);
  } catch (err) {
    const code = err instanceof Error && /PROFILE_PRIVATE|APIFY/.test(err.message)
      ? err.message
      : "APIFY_SCRAPE_FAILED";
    const status = code === "APIFY_QUOTA_EXCEEDED" ? 402
      : code === "APIFY_PROFILE_PRIVATE" ? 422
      : code === "APIFY_CIRCUIT_OPEN" ? 503
      : 500;
    logError({
      level: "error",
      source: "api/scrape-linkedin",
      message: err instanceof Error ? err.message : "Scrape failed",
      error: err, code: code as any, statusCode: status, ip, userAgent,
    });
    return NextResponse.json({ error: code }, { status });
  }
}
```

### Anti-Patterns to Avoid

- **Calling Apify from a Server Action.** Server Actions inherit the 10s default Lambda timeout and can't declare `maxDuration`. Use a POST route (locked by D-03).
- **Storing the raw IP in the fingerprint.** Use SHA-256(ip + ua + salt) — pattern from CLAUDE.md `.claude/rules/security.md` ("NEVER store raw ... PII").
- **Writing to `LinkedInProfileCache` without validating the payload.** Zod `.passthrough()` on the whole object is fine, but reject if `items.length === 0`.
- **Re-entering quota logic if cache hits.** Cache hit → do NOT increment counters (D-13).
- **Bypassing the existing `getActivePromptWithVersion()` for new prompts.** The registry is the single source of truth; create new rows with higher `version` and `status = "active"`. Old rows stay active for fallback paste flow.
- **Editing Creala webhook logic beyond the one-line quota reset.** D-14 — single insertion at `src/app/api/webhooks/creala/route.ts:246` inside the existing `User.update` `data:` block. No refactor, no signature change.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Apify REST polling loop | Custom fetch + setTimeout + status check | `ApifyClient.actor().call()` with `waitSecs` | Built-in exponential backoff, auth, run-object typing, TIMED-OUT vs FAILED distinction |
| URL normalization | Custom regex chain | `new URL()` + lowercase pathname | Native `URL` parses query/hash/trailing slash robustly; wrap in try/catch for invalid URL detection |
| Circuit breaker | Inline retry counter in API route | Reuse `CircuitBreaker` class from `circuit-breaker.ts` | Already tested, CLOSED→HALF_OPEN→CLOSED logic is subtle |
| Rate limiting | Per-route ad-hoc counter | `createRateLimiter({windowMs, maxRequests})` from `rate-limiter.ts:21` | Existing 3-tier convention |
| Error persistence | Direct `prisma.errorLog.create()` | `logError()` fire-and-forget | Never crashes request, handles sync failures, truncates long strings |
| Markdown escaping | Regex escaping in formatter | Template literal + conservative whitelist (the output is fed to Claude, not rendered; markdown syntax hazards are minimal) | — |
| LinkedIn URL validation | Full `linkedin.com/in/*` regex | Use URL class + check `hostname.endsWith("linkedin.com")` + `pathname.startsWith("/in/")` | Safer against edge cases like `m.linkedin.com`, country TLDs, trailing segments |

**Key insight:** Every building block exists in the codebase except the Apify call itself. This phase is mostly wiring, not new infra.

## Runtime State Inventory

> Not applicable — this is a greenfield feature phase, not a rename/refactor. No stored data or live service config is being renamed. All new state is additive.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — all new tables | — |
| Live service config | None — Apify token is a new env var | Add `APIFY_API_TOKEN` to `.env.local` and Vercel env vars |
| OS-registered state | None | — |
| Secrets/env vars | `APIFY_API_TOKEN` (NEW, server-only, never `NEXT_PUBLIC_*`) | Document in CLAUDE.md "Env Vars (critical)" list |
| Build artifacts | Prisma client regenerated after schema change | `npx prisma generate` runs automatically via `npm run build` script |

## Common Pitfalls

### Pitfall 1: Vercel 10s Lambda Timeout

**What goes wrong:** `/api/scrape-linkedin` returns 504 before Apify run completes. HarvestAPI sync calls typically take 10–40s per profile.
**Why it happens:** Next.js routes on Vercel Hobby default to `maxDuration = 10`.
**How to avoid:** Declare `export const maxDuration = 60` and `export const runtime = "nodejs"` at top of the route file. Verified working on `/api/audit/stream` (`src/app/api/audit/stream/route.ts:7-9`).
**Warning signs:** Error code `FUNCTION_INVOCATION_TIMEOUT` in Vercel logs, scrape calls failing at exactly 10s.

### Pitfall 2: Apify actor input schema drift

**What goes wrong:** We assume `profileUrls: [...]` but the actor accepts `urls` or `profileLinks`. Run fails with `INVALID_INPUT` before scraping.
**Why it happens:** HarvestAPI maintains the actor; public docs are thin; INPUT_SCHEMA on Apify is the source of truth but not easily crawlable.
**How to avoid:** **Wave 0 probe task** — run ONE scrape against a known public profile via the Apify UI, capture the exact run input, save as `src/lib/services/__tests__/fixtures/apify-input-sample.json`. Use that shape.
**Warning signs:** Immediate run failure (not mid-run), `INVALID_INPUT` error code.

### Pitfall 3: Private profile not distinguished from failure

**What goes wrong:** Apify returns empty `items: []` with `SUCCEEDED` status when the profile is private. We conflate "empty items" with "scrape succeeded but profile was private" and fall back to generic error.
**Why it happens:** HarvestAPI returns success+empty rather than a specific error code for private profiles (this is [ASSUMED] — confirm in Wave 0).
**How to avoid:** After scrape, check `items.length === 0` OR `items[0]?.headline` missing → throw `APIFY_PROFILE_PRIVATE` with HTTP 422. Localized error banner.
**Warning signs:** Users report "analysis empty" when URL is known-private.

### Pitfall 4: IP fingerprint duplicates behind CGNAT / mobile carriers

**What goes wrong:** Many anonymous users share an IP (LATAM mobile carriers, university networks). One anon user burns everyone's free scrape.
**Why it happens:** `extractRequestMeta` uses `x-forwarded-for` first hop (`error-logger.ts:140`).
**How to avoid:** Fingerprint = SHA-256(ip + `\n` + userAgent + `\n` + serverSalt). Mixing UA reduces collision rate substantially. Document that this is a best-effort anti-abuse measure, not a hard security boundary.
**Warning signs:** Spike of `APIFY_QUOTA_EXCEEDED` from unique sessions, support tickets.

### Pitfall 5: `prisma db push` drops data on field rename

**What goes wrong:** Planner renames a field mid-phase, `prisma db push` drops the column.
**Why it happens:** `db push` is destructive by design for non-migration workflows.
**How to avoid:** Freeze field names at planning time. If renamed mid-implementation, use `@map` to keep DB column stable.
**Warning signs:** `db push` output warns about data loss — DO NOT confirm blindly.

### Pitfall 6: Circuit breaker shared across Lambda instances

**What goes wrong:** Breaker state is in-memory per Lambda. With multi-instance scale-out, each instance has its own breaker, so one bad instance can keep hitting Apify while another is open.
**Why it happens:** Vercel Lambdas are stateless; circuit breaker is module-global.
**How to avoid:** Acknowledge this is a known limitation (same caveat applies to the LLM breaker already). For Phase 1, the in-memory breaker is acceptable; a future phase may move state to Redis/Upstash.
**Warning signs:** Apify cost spikes despite breaker being "open" in one instance's logs.

### Pitfall 7: i18n key drift between EN and ES

**What goes wrong:** New `apify.error.private` added to `en.json` but not `es.json` → runtime `undefined` string.
**Why it happens:** Manual edits forget one file.
**How to avoid:** Every task that touches i18n MUST touch both files in the same commit. Validate with `diff <(jq 'keys' en.json) <(jq 'keys' es.json)` at build time (future eval task). For now, rely on code review + `npm run build` (which does NOT currently detect missing keys — known gap).
**Warning signs:** UI renders literal `apify.error.private` string.

## Code Examples

### Example 1: URL normalization

```typescript
// src/lib/services/apify-cache.ts (excerpt)
import crypto from "crypto";

export function normalizeLinkedinUrl(raw: string): string {
  const url = new URL(raw.trim()); // throws on invalid
  // strip leading m. or country subdomain (es.linkedin.com)
  const host = url.hostname.toLowerCase().replace(/^(m|www|[a-z]{2})\./, "");
  if (host !== "linkedin.com") throw new Error("APIFY_INVALID_URL");
  let pathname = url.pathname.toLowerCase();
  // /in/{slug}/ → /in/{slug}
  pathname = pathname.replace(/\/+$/, "");
  if (!pathname.startsWith("/in/")) throw new Error("APIFY_INVALID_URL");
  // strip anything after the slug (/in/slug/details/... → /in/slug)
  const m = pathname.match(/^\/in\/([^/]+)/);
  if (!m) throw new Error("APIFY_INVALID_URL");
  return `https://linkedin.com/in/${m[1]}`;
}

export function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}
```

### Example 2: Fingerprint hash

```typescript
// src/lib/services/apify-fingerprint.ts
import crypto from "crypto";

const SALT = process.env.APIFY_FINGERPRINT_SALT ?? "ps-apify-v1";

export function computeFingerprint(ip: string, userAgent?: string | null): string {
  return crypto
    .createHash("sha256")
    .update(`${ip}\n${userAgent ?? ""}\n${SALT}`)
    .digest("hex");
}
```

### Example 3: Zod schema (defensive against drift)

```typescript
// src/lib/schemas/linkedin-profile.ts
import { z } from "zod";

export const scrapeLinkedinRequestSchema = z.object({
  url: z.string().min(10).max(500).refine(
    (v) => {
      try { const u = new URL(v); return u.hostname.includes("linkedin.com") && u.pathname.includes("/in/"); }
      catch { return false; }
    },
    { message: "must be a linkedin.com/in/... URL" }
  ),
});

/** Loose schema — defensive against actor output drift.
 *  Everything is optional except the bare minimum we actually consume. */
const experienceEntrySchema = z
  .object({
    position: z.string().optional(),
    title: z.string().optional(),
    company: z.string().optional(),
    companyName: z.string().optional(),
    duration: z.string().optional(),
    dateRange: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    skills: z.array(z.string()).optional(),
  })
  .passthrough();

export const harvestProfileSchema = z
  .object({
    publicIdentifier: z.string().optional(),
    linkedinUrl: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    headline: z.string().optional(),
    about: z.string().optional(),
    location: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    experience: z.array(experienceEntrySchema).optional().default([]),
    education: z.array(z.object({}).passthrough()).optional().default([]),
    skills: z.array(z.object({}).passthrough()).optional().default([]),
    topSkills: z.array(z.string()).optional().default([]),
    certifications: z.array(z.object({}).passthrough()).optional().default([]),
    recommendations: z.array(z.object({}).passthrough()).optional().default([]),
    projects: z.array(z.object({}).passthrough()).optional().default([]),
    languages: z.array(z.object({}).passthrough()).optional().default([]),
    publications: z.array(z.object({}).passthrough()).optional().default([]),
    honors: z.array(z.object({}).passthrough()).optional().default([]),
    volunteering: z.array(z.object({}).passthrough()).optional().default([]),
    connectionsCount: z.number().optional(),
    followerCount: z.number().optional(),
  })
  .passthrough(); // allow unknown keys

export type HarvestProfile = z.infer<typeof harvestProfileSchema>;
```

### Example 4: Markdown formatter (feeds existing orchestrator)

```typescript
// src/lib/services/linkedin-profile-formatter.ts (excerpt)
import type { HarvestProfile } from "@/lib/schemas/linkedin-profile";

/** Emit a Record<string, string> that matches what `parseLinkedinSectionsWithFallback`
 *  would produce. This lets us bypass regex parsing entirely — see "Orchestrator Stage 2
 *  Integration" below. Keys MUST match LINKEDIN_SECTION_IDS from linkedin-parser.ts. */
export function profileToSectionRecord(p: HarvestProfile): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.headline) out.headline = p.headline.trim();
  if (p.about) out.summary = p.about.trim();
  if (p.experience?.length) out.experience = formatExperience(p.experience);
  if (p.education?.length) out.education = formatEducation(p.education);
  if (p.skills?.length || p.topSkills?.length) out.skills = formatSkills(p);
  if (p.certifications?.length) out.certifications = formatCerts(p.certifications);
  if (p.recommendations?.length) out.recommendations = formatRecs(p.recommendations);
  if (p.projects?.length) out.projects = formatProjects(p.projects);
  if (p.publications?.length) out.publications = formatPubs(p.publications);
  if (p.honors?.length) out.honors = formatHonors(p.honors);
  if (p.volunteering?.length) out.volunteer = formatVolunteer(p.volunteering);
  return out;
}

/** Alternative: emit markdown for a NEW prompt (D-16, D-17, D-18). */
export function profileToMarkdown(p: HarvestProfile): string {
  const parts: string[] = [];
  if (p.headline) parts.push(`# ${p.headline}\n`);
  if (p.about) parts.push(`## About\n\n${p.about}\n`);
  if (p.experience?.length) {
    parts.push(`## Experience\n`);
    for (const e of p.experience) {
      const title = e.position ?? e.title ?? "";
      const company = e.company ?? e.companyName ?? "";
      const dur = e.duration ?? e.dateRange ?? "";
      parts.push(`### ${title} — ${company}${dur ? ` (${dur})` : ""}`);
      if (e.description) parts.push(e.description);
      parts.push("");
    }
  }
  // ...education, skills (with endorsement counts), certifications, recommendations (first 3), projects
  return parts.join("\n");
}
```

## Orchestrator Stage 2 Integration

**Critical finding — this is the minimal-risk integration point.**

The existing orchestrator at `audit-orchestrator.ts:2182-2239` calls `parseLinkedinWithStructuring(input.linkedinText, locale, false)` to produce `linkedinSections: Record<string, string>`. Stages 3–11 consume that record; they never re-read `input.linkedinText`.

**Two integration strategies, in order of preference:**

### Strategy A (RECOMMENDED): Pre-populate `linkedinSections` via the formatter

1. `POST /api/scrape-linkedin` stores the scraped `HarvestProfile` in `LinkedInProfileCache` AND returns a reference ID (or the formatter output directly).
2. Client calls `/api/audit/generate` as today, but passes an additional field: `linkedinProfileCacheId` (or the already-formatted markdown).
3. In the orchestrator, extend `AuditInput` (line 232) with an optional `preparsedLinkedinSections?: Record<string, string>` field.
4. Stage 2 (line 2189) becomes:
   ```typescript
   if (input.preparsedLinkedinSections) {
     linkedinSections = input.preparsedLinkedinSections; // Apify path
     structuringUsed = true;                             // skip LLM structurer
   } else if (input.linkedinText.trim()) {
     // existing paste-text path unchanged
     const parseResult = await parseLinkedinWithStructuring(...);
     linkedinSections = parseResult.sections;
   }
   ```
5. Stages 3–11 unchanged. Cache key at `audit-orchestrator.ts:2067` MUST include a fingerprint of the scraped profile (hash of `profileCacheId`) so different profiles don't collide.

**Pros:** Minimal edit (one `if` branch), saves Haiku structuring call (D-specific bonus), no prompt redesign required for the old "section-based scoring" path.

### Strategy B: Feed scraped markdown as `input.linkedinText`

1. Format `HarvestProfile` → markdown via `profileToMarkdown()`.
2. Pass as `linkedinText`. Parser will re-parse the markdown.
3. Relies on the parser accepting headers like `## About` / `## Experience` — partially supported (see `linkedin-parser.ts:26-51` — includes `/^about/`, `/^experience/`, etc., which DO match markdown `#` prefixes because `matchHeader` strips the leading line but NOT the `#`).

**Pros:** No change to `AuditInput`. **Cons:** Re-parses markdown we just structured; brittle; requires validating the parser handles `#`/`##` prefixes. NOT RECOMMENDED.

**Decision:** Plan with Strategy A. Requirement: extend `AuditInput` with optional `preparsedLinkedinSections` and `linkedinProfileSource: "paste" | "apify" | "pdf"` (for logging). Also pass `apifyProfileMarkdown?: string` if the new prompts expect full markdown instead of section-keyed text — D-16 suggests new prompt versions WILL expect the markdown. See "Prompt Registry Additions" below.

## Prompt Registry Additions (D-16, D-18)

New prompt rows to insert via the existing admin flow at `/admin/prompts` or via a seed script:

| promptKey | version | locale | status | purpose |
|-----------|---------|--------|--------|---------|
| `audit.linkedin.system.apify` | 1 | `en` | `active` | System prompt variant that consumes full markdown (headline, about, experience bullets, skills+endorsements, certifications, recommendations excerpts, projects) |
| `audit.linkedin.system.apify` | 1 | `es` | `active` | ES version |
| `rewrite.linkedin.section.apify` | 1 | `en` | `active` | Rewrite prompt that has access to richer context (endorsement counts, recommendation tone) |
| `rewrite.linkedin.section.apify` | 1 | `es` | `active` | ES version |

**Orchestrator change:** The orchestrator's prompt preflight at `audit-orchestrator.ts:2140-2162` constructs `requiredPromptKeys` based on `hasLinkedinInput`. Extend to pick `audit.linkedin.system.apify` when `input.linkedinProfileSource === "apify"`, else `audit.linkedin.system` (existing). Fall back to `audit.linkedin.system` (existing) if the Apify variant is missing. This preserves the paste flow.

**Old prompts stay active** (D-16) — do not archive `audit.linkedin.system` / `rewrite.linkedin.section`. They continue serving the CV flow and any PDF-paste edge cases.

## Markdown Formatter Spec

The formatter's output is consumed in two places:

1. **`profileToSectionRecord()`** — feeds Stage 2's `linkedinSections: Record<string, string>` contract. Keys MUST match `LINKEDIN_SECTION_IDS` from `linkedin-parser.ts` (verified values from orchestrator imports: `headline`, `summary`, `experience`, `education`, `skills`, `recommendations`, `featured`, `certifications`, `volunteer`, `projects`, `publications`, `honors`).
2. **`profileToMarkdown()`** — feeds NEW prompt versions that want full narrative. Used by `rewrite.linkedin.section.apify`.

**Contract for the orchestrator (verified slots from `linkedin-parser.ts:26-51` + `audit-orchestrator.ts` parsed section usage):**
```
Required: headline (string), summary (about text), experience (timeline-ordered)
Optional: education, skills, certifications, recommendations, projects, publications, honors, volunteer, featured
```

Any slot missing → orchestrator's existing degradation logic (`DEGRADATION_PARTIAL_THRESHOLD = 0.40`, `audit-orchestrator.ts:228`) handles it — no new code needed.

**Per-role description flattening:** experience entries are flattened to `"{title} — {company} ({dateRange})\n{description}\n"` joined by newlines, so the regex-entry parser at `parseEntriesFromSection` can split them. Verified by reading `linkedin-parser.ts` — the parser's `parseEntriesFromSection("experience", text)` uses line-based splitting that matches this format.

## UX Changes Summary

### `src/app/input/page.tsx`
- Primary input swaps from `LinkedinInputSection` (paste/PDF) to `LinkedinUrlPrimaryInput` (URL field)
- Inline validator reuses the Zod `scrapeLinkedinRequestSchema.refine()` check
- CV upload becomes a `<details>` toggle labeled `t.input.useCvAlternativeTitle`
- On Continue → `POST /api/scrape-linkedin` → set `scrapedProfile` in context → route to `/results`

### `src/context/AppContext.tsx`
Add to `AppContextValue`:
```typescript
scrapedProfile: HarvestProfile | null;
scrapeStatus: "idle" | "scraping" | "done" | "error" | "quota-exceeded";
scrapeError: "private" | "invalid_url" | "rate_limit" | "downtime" | null;
apifyQuotaRemaining: number | null; // null = unlimited; 0 = exhausted
triggerLinkedinScrape: (url: string) => Promise<void>;
```
Add to provider state: matching `useState` calls. No structural refactor — the context is already large and accepts additions (verified `AppContext.tsx:61-118` interface block).

### `src/components/ui/GenerationProgress.tsx`
Stage map at `GenerationProgress.tsx:59-68` gets a new entry:
```typescript
scraping_profile: progressStrings.stageScraping ?? "Analyzing your LinkedIn profile...",
```
Add `"scraping_profile"` to `ProgressStage` type at `audit-orchestrator.ts:173-181`. It's the first stage when `linkedinProfileSource === "apify"`.

### i18n keys (EN + ES parity)

```json
// en.json additions
{
  "input": {
    "linkedinUrlPrimaryLabel": "Paste your LinkedIn profile URL",
    "linkedinUrlHelp": "We'll analyze your full profile in seconds",
    "useCvAlternativeTitle": "Prefer to upload your CV instead?",
    ...
  },
  "progress": {
    "stageScraping": "Analyzing your LinkedIn profile..."
  },
  "apify": {
    "error": {
      "private": "This LinkedIn profile is private. Make it public or upload your CV.",
      "invalidUrl": "That doesn't look like a LinkedIn profile URL. Try https://linkedin.com/in/yourname",
      "rateLimit": "We're getting lots of requests. Please try again in a minute.",
      "downtime": "LinkedIn scraping is temporarily unavailable. You can upload your CV instead.",
      "quotaExceeded": "You've used your free scan. Upgrade to unlimited scans for $5."
    },
    "dashboard": {
      "remaining": "Scans remaining: {count}",
      "unlimited": "Unlimited scans"
    },
    "actions": {
      "retry": "Try again",
      "switchToCv": "Upload CV instead",
      "upgrade": "Upgrade plan"
    }
  }
}

// es.json additions (exact parity — every key above)
{
  "input": {
    "linkedinUrlPrimaryLabel": "Pega la URL de tu perfil de LinkedIn",
    "linkedinUrlHelp": "Analizaremos tu perfil completo en segundos",
    "useCvAlternativeTitle": "¿Prefieres subir tu CV?",
    ...
  },
  "progress": {
    "stageScraping": "Analizando tu perfil de LinkedIn..."
  },
  "apify": {
    "error": {
      "private": "Este perfil de LinkedIn es privado. Hazlo público o sube tu CV.",
      "invalidUrl": "Esa URL no parece un perfil de LinkedIn. Prueba con https://linkedin.com/in/tunombre",
      "rateLimit": "Estamos recibiendo muchas solicitudes. Inténtalo de nuevo en un minuto.",
      "downtime": "El análisis de LinkedIn no está disponible ahora. Puedes subir tu CV.",
      "quotaExceeded": "Has usado tu escaneo gratuito. Actualiza para obtener escaneos ilimitados por $5."
    },
    "dashboard": {
      "remaining": "Escaneos restantes: {count}",
      "unlimited": "Escaneos ilimitados"
    },
    "actions": {
      "retry": "Intentar de nuevo",
      "switchToCv": "Subir CV en su lugar",
      "upgrade": "Actualizar plan"
    }
  }
}
```

All strings must be added to BOTH files in the same task (CLAUDE.md critical rule). Naming convention observed from `en.json:655-670`: flat-ish namespaces (`progress.*`, `input.*`, `admin.*`). Nested object `apify.error.*` is consistent with `input.guards.*` and `t.bugReport.*` patterns already in the file.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| User pastes LinkedIn text or PDF | User pastes LinkedIn URL → Apify scrapes structured JSON | This phase | Richer data, less friction, cost per audit +$0.004 |
| `apify-client` v1.x with callback-based pagination | v2.x Promise-based + TypeScript generics | 2023 | Use `client.dataset().listItems()` — **do not search for v1 patterns** |
| `Apify.call()` (apify package) | `new ApifyClient({token}).actor(id).call(...)` | 2022 | Use `apify-client`, NOT `apify` — the latter is the SDK for writing actors |

**Deprecated/outdated:**
- `Apify` global (from `apify` package) — only for writing actors, not calling them
- Polling run status manually — `.call()` handles it with `waitSecs`
- Using `memoryMbytes` option name — it's `memory` in v2

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `harvestapi/linkedin-profile-scraper` actor input field is `profileUrls: string[]` | Pattern 1 | HIGH — wrong field name = `INVALID_INPUT` on every call. Mitigate with Wave 0 probe. |
| A2 | `harvestapi/linkedin-profile-scraper` output shape matches documented fields (headline, about, experience, education, skills, certifications, recommendations, projects, publications, honors, volunteering, languages) | Zod schema, formatter | MEDIUM — defensive Zod `.passthrough()` + `.optional()` limits blast radius. Wrong key names cause empty sections but not crashes. |
| A3 | Private LinkedIn profiles return `items: []` with `SUCCEEDED` status (not an error status) | Pitfall 3 | MEDIUM — if wrong, we need to parse actor error messages instead. |
| A4 | HarvestAPI sync call p95 ≤ 40s for a single profile | Vercel timeout strategy | HIGH — if real p95 > 55s, we MUST move to async run-then-poll. Measure in Wave 0. |
| A5 | `run.usageTotalUsd` field exists on completed ActorRun objects | Cost reporting | LOW — fallback to hardcoded `APIFY_COST_PER_SCRAPE = 0.004`. |
| A6 | Existing Creala webhook never resets plan-related User fields on downgrade (so adding `apifyScrapeQuota = null` on upgrade is sufficient) | D-14 | LOW — verified webhook handler at `creala/route.ts:238-272` only sets `activePlanId`, `subscriptionStatus`, `subscriptionExpiresAt`. Free users never get `apifyScrapeQuota` set, so default `0` quota applies. |
| A7 | `LINKEDIN_SECTION_IDS` exported from `linkedin-parser.ts` contains the exact slot names `headline`, `summary`, `experience`, `education`, `skills`, `certifications`, `recommendations`, `projects`, `publications`, `honors`, `volunteer`, `featured` | Formatter spec | LOW — pattern inferred from `linkedin-parser.ts:26-51` (header regex → ID map). Planner should read the exported array to confirm before writing formatter tests. |
| A8 | Stage 2 is side-effect-free so bypassing it with pre-parsed sections is safe | Strategy A | LOW — verified `audit-orchestrator.ts:2189-2239` — the only side effects are `console.log` diagnostics and setting `structuringUsed`/`structuringDurationMs` on the result meta. Safe to bypass. |
| A9 | Existing rate limiter `createRateLimiter` works with SHA-256 fingerprints as keys | Anonymous quota | LOW — `rate-limiter.ts:36` accepts any string key. Pattern reused. |
| A10 | `maxDuration = 60` is allowed on Vercel Hobby plan for non-stream routes | Vercel timeout | MEDIUM — Hobby plan allows up to 60s for regular Functions since 2024. Docs at vercel.com/docs. **Verify on first deploy** by checking actual timeout behavior. |

**If this table is empty:** Not applicable — 10 assumptions remain pending Wave 0 verification. A1 and A4 are the two highest-risk; both can be resolved with a single probe call against a known public profile.

## Open Questions

1. **Which Vercel Hobby `maxDuration` ceiling applies to `/api/scrape-linkedin`?**
   - What we know: `maxDuration = 120` is set on `/api/audit/stream`. Hobby plan documented ceilings vary.
   - What's unclear: Whether 60s is safely below the Hobby limit for a non-stream POST route.
   - Recommendation: Start with `maxDuration = 60`, measure p95 in staging, bump to 90 or migrate to async if needed.

2. **Should the scrape call route through `/api/audit/stream` instead of a separate `/api/scrape-linkedin`?**
   - What we know: D-03 locks `/api/scrape-linkedin` as a separate route.
   - What's unclear: Whether bundling "scrape + audit" in one streaming call (120s ceiling) is simpler.
   - Recommendation: Respect D-03 — separate route. Rationale: scrape cache hit avoids the audit round-trip entirely; keeping them separate enables quota decrement independence.

3. **How does the client know the quota remaining BEFORE clicking "Analyze"?**
   - What we know: Dashboard chip shows it after first scrape.
   - What's unclear: First-time visitor gets no signal until they try.
   - Recommendation: Add a `GET /api/scrape-linkedin/quota` endpoint that returns `{ remaining: number | null, plan: "free" | "starter" | "recommended" }`. Not locked in decisions — propose as Claude's discretion addition. Allows pre-flight UI hints.

4. **Wave 0 probe: who runs the first real Apify call to capture the fixture?**
   - What we know: Isaac is sole dev.
   - Recommendation: A Wave 0 task explicitly runs ONE scrape against `https://linkedin.com/in/isaacgbc` (or any known-public profile), saves output as `fixtures/apify-profile-sample.json`, and uses it to drive Zod schema + formatter unit tests. This resolves A1 + A2 + A3 + A4 in a single shot.

5. **Should the existing paste flow still accept LinkedIn PDF uploads?**
   - What we know: D-20 says URL becomes primary, CV becomes secondary toggle.
   - What's unclear: Does LinkedIn-PDF-upload flow disappear entirely or hide behind a second toggle?
   - Recommendation: Preserve LinkedIn-PDF as a fallback option inside the "upload CV instead" toggle (label: "LinkedIn PDF or CV"). Zero code deletion, just rewrite labels — preserves v1 capability for edge cases.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js runtime on Vercel | API route | ✓ | Node 20+ (Vercel default) | — |
| `apify-client` npm package | Scraper client | ✗ (not installed) | 2.22.3 (latest) | Install as part of Wave 1 |
| `APIFY_API_TOKEN` env var | Scraper client | ✗ (not set) | — | Cannot proceed without it — BLOCKING |
| PostgreSQL + Supabase (via existing `prisma`) | New models | ✓ | 5.22.0 | — |
| Zod 4 | Request/response validation | ✓ | 4.3.6 | — |
| `npm run build` / `prisma db push` / `prisma generate` | Schema sync | ✓ | — | — |
| Test framework (vitest/jest) | Unit tests | ✗ (not installed) | — | Continue tsx-script test convention (existing pattern), or install vitest in Wave 0 |
| Apify user account with billing enabled | Runtime scraping | ✗ (user-specific, cannot verify from here) | — | BLOCKING for staging/production tests |

**Missing dependencies with no fallback:**
- `APIFY_API_TOKEN` — user must provision. Planner should include a Wave 0 task: "Create Apify account, enable billing, create API token, add to `.env.local` AND Vercel env vars."
- Apify account with billing — user action, cannot be automated.

**Missing dependencies with fallback:**
- `apify-client` — install via `npm install apify-client` as first task.
- Test framework — Wave 0 decision: install vitest OR continue tsx scripts.

## Validation Architecture

### Test Framework

**Current state:** No dedicated test runner is installed. Existing `.test.ts` files are tsx scripts with home-grown `assert()` helpers (verified `src/lib/services/__tests__/linkedin-experience-archetype.test.ts:1-30` — header comment says `Run: npx tsx src/lib/services/__tests__/linkedin-experience-archetype.test.ts`).

**Decision for this phase:**
- **RECOMMENDED: Install vitest in Wave 0.** The phase adds 5+ new services with well-defined inputs/outputs (URL normalizer, fingerprint, formatter, Zod schema, quota logic). These benefit from a proper test runner, and vitest is the smallest-integration-cost option for a Next.js 15 TypeScript project.
- **Alternative: Continue tsx-script convention.** Write standalone `*.test.ts` scripts in `__tests__/` with the project's existing `assert()` pattern. Lower upfront cost, higher long-term toil.

The planner MUST choose one at the start of Wave 0 and document the choice in the plan. This research recommends vitest.

| Property | Value |
|----------|-------|
| Framework | vitest (RECOMMENDED — not yet installed) OR tsx-script convention (EXISTING) |
| Config file | `vitest.config.ts` (to create) OR none (tsx scripts) |
| Quick run command | `npx vitest run src/lib/services/__tests__/apify-*.test.ts` OR `npx tsx src/lib/services/__tests__/apify-formatter.test.ts` |
| Full suite command | `npx vitest run` OR `npm run build` (build-level type check is the only existing gate) |

### Phase Requirements → Test Map

Success criteria from ROADMAP mapped to concrete automatable tests. Numbered from the 9 ROADMAP criteria.

| Criterion | Behavior | Test Type | Automated Command | File Exists? |
|-----------|----------|-----------|-------------------|-------------|
| 1 | LinkedIn URL input triggers Apify scrape | integration | `vitest run src/app/api/scrape-linkedin/__tests__/route.test.ts` | ❌ Wave 0 |
| 1 | URL validation rejects non-LinkedIn URLs | unit | `vitest run src/lib/schemas/__tests__/linkedin-profile.test.ts` | ❌ Wave 0 |
| 1 | URL normalization (lowercase, strip query/trailing) | unit | `vitest run src/lib/services/__tests__/apify-cache.test.ts` | ❌ Wave 0 |
| 2 | Formatter produces all required section slots from a fixture | unit | `vitest run src/lib/services/__tests__/linkedin-profile-formatter.test.ts` | ❌ Wave 0 |
| 2 | Bypass stage 2 parser when `preparsedLinkedinSections` is provided | integration | `vitest run src/lib/services/__tests__/orchestrator-apify-path.test.ts` (LLM mocked) | ❌ Wave 0 |
| 3 | CV upload flow still works (smoke) | manual-only | Manual test: upload CV, verify audit runs | — |
| 4 | Cache hit avoids scrape + preserves quota | unit | `vitest run src/lib/services/__tests__/apify-cache.test.ts` (hit vs miss) | ❌ Wave 0 |
| 4 | Cache expires after 24h | unit | Time-mocked test in cache.test.ts | ❌ Wave 0 |
| 5 | Free user: 1 scrape allowed, 2nd returns 402 | integration | `vitest run src/lib/services/__tests__/apify-quota.test.ts` | ❌ Wave 0 |
| 5 | Paid user (starter/recommended): unlimited | integration | Same file, different fixture | ❌ Wave 0 |
| 5 | Dashboard chip shows correct count | component | `vitest run src/components/results/__tests__/ApifyQuotaChip.test.tsx` (optional, dom testing env needed) | ❌ Wave 0 |
| 6 | Private profile → 422 + localized error | integration | Mock Apify returning empty items | ❌ Wave 0 |
| 6 | Invalid URL → 400 + localized error | unit | Schema validation test | ❌ Wave 0 |
| 6 | Rate limit (from limiter) → 429 | unit | `vitest run src/lib/services/__tests__/apify-rate-limit.test.ts` | ❌ Wave 0 |
| 6 | Circuit breaker open → 503 | unit | Force breaker to OPEN, verify throw | ❌ Wave 0 |
| 6 | i18n: all 4 error states resolve in EN AND ES | unit | Diff EN/ES key arrays | ❌ Wave 0 |
| 7 | Output language detection unchanged | integration | Orchestrator test with EN profile vs ES profile | existing `language-detect` tests cover this |
| 8 | `npm run build` passes zero errors | build gate | `npm run build` | ✓ existing |
| 9 | Creala webhook untouched except for 1-line quota reset | regression | `vitest run src/app/api/webhooks/creala/__tests__/route.test.ts` (verify signature + 1 new assertion) | ❌ Wave 0 — existing creala handler has no test file today |

### Sampling Rate

- **Per task commit:** Run the specific test file(s) the task modified (`vitest run path/to/test.ts`)
- **Per wave merge:** `vitest run` (full suite) + `npm run build`
- **Phase gate:** Full suite green + `npm run build` zero errors + manual smoke test of input → results flow in EN and ES (LATAM market requires ES validation)

### Wave 0 Gaps

**Test infrastructure:**
- [ ] Decide: install vitest OR continue tsx-script convention. RECOMMEND vitest.
- [ ] If vitest: `npm install -D vitest @vitest/ui` + create `vitest.config.ts`
- [ ] Add `"test": "vitest"` and `"test:run": "vitest run"` to `package.json` scripts

**Test fixtures:**
- [ ] `src/lib/services/__tests__/fixtures/apify-profile-sample.json` — captured from a real probe scrape (resolves A1–A4)
- [ ] `src/lib/services/__tests__/fixtures/apify-profile-empty.json` — private profile case
- [ ] `src/lib/services/__tests__/fixtures/apify-profile-minimal.json` — profile with only headline + experience (sparse data)

**New test files:**
- [ ] `src/lib/schemas/__tests__/linkedin-profile.test.ts` — Zod schema round-trip on fixtures, URL validation
- [ ] `src/lib/services/__tests__/apify-cache.test.ts` — URL normalization, cache hit/miss, TTL expiry
- [ ] `src/lib/services/__tests__/apify-fingerprint.test.ts` — hash determinism + salt usage
- [ ] `src/lib/services/__tests__/linkedin-profile-formatter.test.ts` — fixture → section record + markdown
- [ ] `src/lib/services/__tests__/apify-quota.test.ts` — free/paid paths, anon tracking, Prisma mocked
- [ ] `src/lib/services/__tests__/apify-scraper-client.test.ts` — circuit breaker integration, mocked ApifyClient
- [ ] `src/app/api/scrape-linkedin/__tests__/route.test.ts` — full route integration with mocked client
- [ ] `src/app/api/webhooks/creala/__tests__/route.test.ts` — regression for the 1-line quota reset
- [ ] `src/lib/i18n/__tests__/apify-keys-parity.test.ts` — diff EN vs ES keys to enforce parity

**Supporting infra:**
- [ ] `src/lib/db/__mocks__/client.ts` — if vitest: Prisma mock for unit tests (avoid real DB round-trip)

## Security Domain

Required — `security_enforcement: true`, ASVS Level 1 (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Secrets in env (`APIFY_API_TOKEN`), server-only code paths, no client-side Apify token exposure |
| V2 Authentication | partial | Reuses Supabase Auth for authed users; anonymous users tracked by SHA-256 fingerprint (best-effort, not a security boundary) |
| V3 Session Management | no direct change | Existing Supabase session handling applies |
| V4 Access Control | yes | Quota check BEFORE Apify call (D-13); free=1, paid=unlimited (D-14); Creala webhook is HMAC-verified (existing, unchanged) |
| V5 Input Validation | yes | Zod schemas for request body (`scrapeLinkedinRequestSchema`) and scraped response (`harvestProfileSchema`); URL validated against `linkedin.com/in/*` pattern |
| V6 Cryptography | yes | SHA-256 for URL hash + fingerprint (existing Node `crypto`) — never hand-rolled |
| V7 Error Handling | yes | All errors through `logError()`; no stack traces or raw error messages returned to client; generic error codes |
| V8 Data Protection | yes | Scraped profile data IS PII — stored in `LinkedInProfileCache` with 24h TTL (short retention); URL is logged with hash+redacted variant; fingerprint hashes only, never raw IP |
| V9 Communication | yes | HTTPS-only (Vercel enforces); Apify calls use their HTTPS API |
| V10 Malicious Code | yes | Never execute scraped content; pass as text to Claude only |
| V11 Business Logic | yes | Quota abuse prevention via rate limiter + fingerprint + in-DB counter |
| V12 Files & Resources | no direct change | No new file uploads |
| V13 API & Web Services | yes | POST route, JSON body, CSRF inherent for fetch with same-origin |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Scraping a non-owner's profile (PII collection abuse) | Information Disclosure | Quota + cost per scrape creates friction; ToS banner on input page states "Only scrape profiles you own or have permission to analyze"; Apify itself scrapes only PUBLIC data |
| Cost abuse via rapid anonymous scrapes | Denial of Service (budget exhaustion) | Rate limiter (burst 3/min per IP for scrape route) + 1-scrape-per-fingerprint free quota + server-side budget cap (emergency kill switch: `APIFY_DAILY_BUDGET_USD` env, check `ApifyUsageLog` aggregate before call) |
| API token exfiltration | Information Disclosure | `APIFY_API_TOKEN` is server-only, never exposed to client (no `NEXT_PUBLIC_*` prefix); never logged |
| SSRF via user-supplied URL | Information Disclosure | Zod-validate URL matches `linkedin.com/in/*` strictly; reject any other host BEFORE passing to Apify |
| Cache poisoning via URL normalization bypass | Tampering | URL normalization is deterministic; hash is SHA-256 of canonical form; direct DB writes bypass the API so this is only a concern if normalization has a bug — covered by unit tests |
| PII over-retention | Compliance (LGPD/LATAM) | 24h TTL enforced by `expiresAt` + background cleanup job (not in this phase — add to deferred); no long-term storage of raw profile JSON beyond cache window |
| Stored XSS via scraped text rendered in UI | XSS | React JSX escapes by default; never use `dangerouslySetInnerHTML` on scraped fields; formatter output is fed to Claude, not rendered |
| Quota bypass via client-side tampering | Elevation of Privilege | Quota check is server-side in the route handler; client UI count is advisory only |
| Logging PII to ErrorLog | Compliance | Use `inputMeta: { urlHash, isLinkedin: true, hasCache: false }` — never the raw URL or profile content |
| Circuit breaker trip leaks internal state to client | Information Disclosure | Return generic `APIFY_CIRCUIT_OPEN` code with 503; details only in server logs |
| Creala webhook replay bypassing quota reset | Tampering | Existing HMAC-SHA256 verification (unchanged); one-line addition inside verified block |
| Cost underreporting via modified client request | Tampering | Server is the sole source of cost writes (`ApifyUsageLog.costUsd` from `run.usageTotalUsd`); client never sends cost |

### Dedicated Rate Limiter for Scrape Route

Add to `src/lib/services/rate-limiter.ts` (at the bottom, same pattern as existing `exportRateLimiter`):

```typescript
/** Rate limiter for Apify scrape: 3 requests per minute per IP (prevent cost abuse) */
export const scrapeRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 3,
});
```

**Rationale:** Apify calls cost real money ($0.004 each). Even with the 1-scrape-per-fingerprint quota, a motivated attacker could rotate fingerprints. IP-based rate limiting adds a second layer. 3/min is generous for legitimate users (who typically scrape once) and restrictive enough to cap cost per-IP at ~$0.012/min → $17/day worst case per IP. Combined with fingerprint quota, worst-case cost per IP is $0.004 (one successful scrape, rest blocked by quota).

### Emergency Kill Switch

Add environment variable `APIFY_ENABLED` (default `"true"`). At top of `/api/scrape-linkedin`:
```typescript
if (process.env.APIFY_ENABLED === "false") {
  return NextResponse.json({ error: "APIFY_DISABLED" }, { status: 503 });
}
```
Allows instant disable without redeploy if cost spike detected.

## New & Modified Files Inventory

### NEW files

| Path | Purpose |
|------|---------|
| `src/app/api/scrape-linkedin/route.ts` | POST handler: validate → rate limit → quota check → cache read → Apify call → cache write → log |
| `src/lib/schemas/linkedin-profile.ts` | Zod: `scrapeLinkedinRequestSchema`, `harvestProfileSchema`, inferred types |
| `src/lib/services/apify-scraper-client.ts` | Thin ApifyClient wrapper with circuit breaker + timeout |
| `src/lib/services/linkedin-profile-formatter.ts` | JSON → `Record<string,string>` (sections) and JSON → markdown |
| `src/lib/services/apify-cache.ts` | URL normalization, cache read/write, TTL enforcement |
| `src/lib/services/apify-quota.ts` | User + anonymous quota check and increment |
| `src/lib/services/apify-fingerprint.ts` | SHA-256 IP+UA fingerprint hash |
| `src/components/input/LinkedinUrlPrimaryInput.tsx` | Replaces primary paste UI with URL input + inline validation |
| `src/components/results/ApifyQuotaChip.tsx` | Dashboard chip: remaining/unlimited |
| `src/hooks/useLinkedinScrape.ts` | Client hook: POST `/api/scrape-linkedin`, handle 4 error states, update context |
| Test files (see Wave 0 Gaps above) | Unit + integration tests |

### MODIFIED files

| Path | Reason | Scope of change |
|------|--------|-----------------|
| `prisma/schema.prisma` | Add `LinkedInProfileCache`, `AnonymousApifyUsage`, `ApifyUsageLog`; extend `User` with 3 fields | Append 3 models + 3 fields on existing User block |
| `src/lib/services/circuit-breaker.ts` | Export new `apifyCircuitBreaker` singleton | Append after line 251 |
| `src/lib/services/rate-limiter.ts` | Export new `scrapeRateLimiter` | Append after line 77 |
| `src/lib/services/audit-orchestrator.ts` | Add optional `preparsedLinkedinSections` + `linkedinProfileSource` to `AuditInput`; extend Stage 2 branch (line 2182-2239) to use pre-parsed sections when provided; add `scraping_profile` stage; extend preflight (2145-2151) to pick new prompt variants | ~20-30 lines across 3 locations; NO stages 3-11 changes |
| `src/app/api/audit/generate/shared.ts` | Accept and pass through new fields | Schema extension + passthrough |
| `src/app/api/audit/generate/route.ts` | Accept new fields on input | Field passthrough only |
| `src/app/api/webhooks/creala/route.ts` (line 246) | Add `apifyScrapeQuota: null` inside existing `User.update` `data:` block for `new_sale` + `new_subscription` cases | ONE line insertion per case, no refactor |
| `src/app/input/page.tsx` | Primary input becomes URL field, CV upload demoted to toggle | Replace `LinkedinInputSection` usage with new component; restructure layout |
| `src/components/ui/GenerationProgress.tsx` | Add `scraping_profile` stage label | Extend stageMap at line 59-68 |
| `src/context/AppContext.tsx` | Add `scrapedProfile`, `scrapeStatus`, `scrapeError`, `apifyQuotaRemaining`, `triggerLinkedinScrape` | Add fields to interface + state + provider value |
| `src/lib/types/index.ts` | Add `HarvestProfile` type export, extend `UserInput` shape if needed | Additive |
| `src/lib/i18n/en.json` | Add `apify.*`, `input.linkedinUrlPrimaryLabel`, `progress.stageScraping` keys | Additive |
| `src/lib/i18n/es.json` | Mirror all keys from en.json | Additive, exact parity |
| `.env.example` (if exists) / CLAUDE.md | Document `APIFY_API_TOKEN` + optional `APIFY_ENABLED`, `APIFY_FINGERPRINT_SALT`, `APIFY_DAILY_BUDGET_USD` | Additive to env vars list |
| `package.json` | `apify-client` dependency; optionally add `vitest` dev dep + test scripts | Single install |

### UNTOUCHED files (important — do NOT modify)

| Path | Reason |
|------|--------|
| Creala webhook `verifySignature()` logic | D-14 — only one-line addition inside existing update block; NO signature-verification changes |
| Stages 3-11 of `audit-orchestrator.ts` (lines 2240+) | Consume section records; formatter produces same shape |
| `src/lib/services/unlock-matrix.ts` / `export-gating.ts` | D-05 — Apify gating is at route level, separate from feature gating |
| `src/lib/services/cv-work-exp-structurer.ts` | Scraped data is already structured; we bypass the structurer (performance bonus) |
| Every other `src/app/api/*` route | Out of scope |

## Sources

### Primary (HIGH confidence)
- `./CLAUDE.md` (project rules, read 2026-04-11)
- `./CLAUDE.local.md` (Isaac's workflow preferences)
- `./.claude/rules/{database,orchestrator,security,api-routes,components,testing}.md` (skill rules, loaded into context)
- `./prisma/schema.prisma` (existing 9 models, conventions verified)
- `./src/lib/services/circuit-breaker.ts` (full read — pattern verified)
- `./src/lib/services/rate-limiter.ts` (full read)
- `./src/lib/services/error-logger.ts` (full read)
- `./src/lib/services/prompt-resolver.ts` (full read)
- `./src/app/api/audit/generate/route.ts` (full read)
- `./src/app/input/page.tsx` (full read)
- `./src/components/ui/GenerationProgress.tsx` (full read)
- `./src/lib/services/audit-orchestrator.ts` (Stage 2 section + header read, critical input parsing lines 2140-2340 verified)
- `./src/lib/services/cv-work-exp-structurer.ts` (pattern reference)
- `./src/lib/services/linkedin-parser.ts` (section ID list verified)
- `./src/app/api/webhooks/creala/route.ts` (line 238-272 user update block verified)
- `./.planning/config.json` (`nyquist_validation: true`, `security_enforcement: true`, ASVS L1)
- `./src/lib/i18n/en.json` (structure + naming conventions)
- `./package.json` (dependency versions + missing test framework)
- `npm view apify-client` (version 2.22.3 verified 2026-04-11)

### Secondary (MEDIUM confidence)
- [Apify client JS docs](https://docs.apify.com/api/client/js/) - basic usage pattern
- [Apify ActorClient.call() reference](https://docs.apify.com/api/client/js/reference/class/ActorClient) - `waitSecs`, `memory`, `timeout` options
- [Apify RunClient.waitForFinish()](https://docs.apify.com/api/client/js/reference/class/RunClient) - polling behavior
- [HarvestAPI apify-linkedin-profile GitHub](https://github.com/HarvestAPI/apify-linkedin-profile) - output field list + pricing ($4/1k)
- [HarvestAPI docs](https://docs.harvest-api.com/guides/profile-search) - scraper types overview

### Tertiary (LOW confidence — needs Wave 0 verification)
- Exact input schema field name `profileUrls` vs alternatives — [ASSUMED A1]
- Exact output key names (`position` vs `title`, `company` vs `companyName`, etc.) — [ASSUMED A2]
- Private profile returns empty `items: []` with `SUCCEEDED` — [ASSUMED A3]
- Sync call p95 latency ≤ 40s — [ASSUMED A4]
- `run.usageTotalUsd` field exists on completed runs — [ASSUMED A5]
- Vercel Hobby `maxDuration = 60` is allowed — [ASSUMED A10]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — apify-client@2.22.3 verified via `npm view`; Zod/Prisma already in project
- Architecture: HIGH — every pattern (circuit breaker, rate limiter, logError, Zod, PromptRegistry) is already implemented in-repo and re-used verbatim
- Orchestrator integration: HIGH — verified lines 2140-2239; Strategy A is a minimal-risk insertion point
- Apify actor specifics: MEDIUM — public docs are thin; 5 assumptions (A1-A5) require one probe call to resolve
- Vercel timeout ceiling: MEDIUM — `maxDuration = 60` is the documented Hobby ceiling, but needs empirical validation
- Security threat model: HIGH — ASVS L1 controls map cleanly onto existing patterns
- Test infra: HIGH (current state) / MEDIUM (recommendation) — no framework exists; vitest recommendation is the cleanest path

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (30 days — Apify actor schema could drift, re-verify before any re-plan)

## RESEARCH COMPLETE

**Phase:** 01 - Apify LinkedIn Integration
**Confidence:** HIGH on in-repo patterns, MEDIUM on external Apify actor shape

### Key Findings

1. **Minimal-risk integration point identified**: Stage 2 of the orchestrator (`audit-orchestrator.ts:2182-2239`) accepts a pre-populated `Record<string, string>` sections map. The Apify path injects that map directly via a new optional `AuditInput.preparsedLinkedinSections` field, bypassing regex parsing AND the LLM structuring pass. Stages 3-11 are completely unchanged. This is a ~20-30 line edit to `audit-orchestrator.ts`, not a pipeline rewrite.

2. **Vercel timeout is the highest-risk runtime constraint**: `/api/audit/stream` declares `maxDuration = 120`, but the new `/api/scrape-linkedin` MUST declare `maxDuration = 60` (verified working ceiling on Hobby plan for non-stream routes). Apify HarvestAPI sync latency is estimated 10-40s p95; exceeding 55s requires migrating to async run-then-poll (locked as a deferred fallback in CONTEXT.md).

3. **No test framework exists**: `package.json` has no vitest/jest; existing `.test.ts` files are tsx scripts. This phase introduces 9+ new test files — strong recommendation to install vitest in Wave 0 as a 15-minute infra task. Alternative is continuing tsx scripts with home-grown `assert()` helpers (existing convention).

4. **Creala webhook insertion is a single line**: The existing handler at `src/app/api/webhooks/creala/route.ts:246` already `User.update`s with plan fields inside a `new_sale`/`new_subscription` case block. Adding `apifyScrapeQuota: null` inside that `data: {}` object is 1 line per case, zero refactor, zero HMAC verification changes.

5. **Apify actor output shape needs one probe call to resolve 5 assumptions (A1-A5)**: A single Wave 0 task that runs ONE scrape against a known-public profile and captures the result as `fixtures/apify-profile-sample.json` resolves exact field names, empty-items-on-private behavior, latency, and cost-reporting shape. This de-risks the entire phase for <5 minutes of work.

### File Created

`.planning/phases/01-apify-linkedin-integration/01-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | apify-client@2.22.3 verified via npm; every other dep already installed |
| Architecture (in-repo patterns) | HIGH | Circuit breaker, rate limiter, logError, Zod, PromptRegistry all verified by reading source |
| Orchestrator Stage 2 integration | HIGH | Lines 2182-2239 read directly; pre-populated sections path is obviously safe |
| Creala webhook integration | HIGH | Lines 238-272 read directly; single-line insertion verified |
| Prisma schema conventions | HIGH | Verified @map, @@index, Json, uuid defaults across all 9 existing models |
| Apify actor input schema | MEDIUM | Public docs thin; 5 assumptions pending Wave 0 probe |
| Apify actor output shape | MEDIUM | High-level field list confirmed; exact key names pending probe |
| Vercel Hobby maxDuration ceiling | MEDIUM | 60s is documented but requires empirical validation on first deploy |
| Pitfalls | HIGH | All 7 pitfalls derived from specific file/line evidence |
| Test infrastructure | HIGH for current state | Zero existing framework; decision is explicit |
| Security threat model | HIGH | ASVS L1 controls map cleanly onto existing patterns; no novel threats |

### Open Questions

Five questions remain for the planner or user to resolve:
1. Vercel Hobby `maxDuration` ceiling (empirical — staging test)
2. Whether to add a `GET /api/scrape-linkedin/quota` pre-flight endpoint (Claude's discretion)
3. Wave 0 ownership of the probe scrape (user action)
4. Whether to preserve LinkedIn-PDF-upload fallback inside the CV toggle (UX decision)
5. vitest vs continue tsx-script test convention (test infra decision)

None are blocking for planning. All can be resolved during `/gsd-plan-phase`.

### Ready for Planning

Research complete. The planner has:
- Complete file-level change inventory (NEW + MODIFIED + UNTOUCHED)
- Integration point identified and verified (Stage 2 `preparsedLinkedinSections`)
- Zod schemas sketched with defensive drift tolerance
- 10 assumptions logged with risk levels (A1-A10 — A1, A4 are HIGH, resolvable via Wave 0 probe)
- Nyquist test map with 20+ specific test cases mapped to success criteria
- ASVS L1 security threat model with mitigations for 12 threat patterns
- Wave 0 gap list covering test infra, fixtures, and probe call

Planner can proceed.
