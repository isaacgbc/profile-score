---
phase: 01-apify-linkedin-integration
plan: 04
subsystem: services
tags: [apify, apify-client, circuit-breaker, rate-limiter, scraper, linkedin, tests]

requires:
  - phase: 01-apify-linkedin-integration/01-01
    provides: "vitest test runner, harvestProfileSchema, fixtures"
  - phase: 01-apify-linkedin-integration/01-02
    provides: "Prisma schema (LinkedInProfileCache, ApifyUsageLog)"
provides:
  - "apify-client@^2.22.3 installed as production dependency"
  - "scrapeLinkedinProfile() function — typed Apify gateway with circuit breaker, error classification, cost tracking"
  - "apifyCircuitBreaker singleton (windowSize:30, failureThreshold:0.6, minSamples:8, cooldownMs:20000, successStreakToClose:2)"
  - "scrapeRateLimiter singleton (3 req/min per key, 60s window)"
  - "APIFY_ACTOR_ID and APIFY_COST_PER_SCRAPE exported constants"
  - "Typed error codes: APIFY_CIRCUIT_OPEN, APIFY_RUN_*, APIFY_PROFILE_PRIVATE, APIFY_TOKEN_MISSING, APIFY_SCRAPE_FAILED"
  - "APIFY_SCRAPE_FAILED added to ErrorCode union in error-logger.ts"
affects:
  - "01-07 (API route — imports scrapeLinkedinProfile, scrapeRateLimiter)"
  - "01-08 (orchestrator integration — consumes scrapeLinkedinProfile results)"
  - "All plans that use circuit-breaker.ts or rate-limiter.ts (append-only, no breaking changes)"

tech-stack:
  added: [apify-client@^2.22.3]
  patterns:
    - "Per-call token read (not module-level) for testability and CI safety"
    - "Per-call ApifyClient construction (cheap constructor, enables vi.mock without singleton reset issues)"
    - "SHA-256 URL hashing for safe logging (never log raw profile URLs)"
    - "Typed error codes matching APIFY_* prefix for route-level error mapping"
    - "Actor input uses `queries` field (not `profileUrls`) and requires `profileScraperMode` enum"

key-files:
  created:
    - "src/lib/services/apify-scraper-client.ts"
    - "src/lib/services/__tests__/apify-scraper-client.test.ts"
    - "src/lib/services/__tests__/apify-rate-limit.test.ts"
  modified:
    - "package.json (apify-client added to dependencies)"
    - "package-lock.json"
    - "src/lib/services/circuit-breaker.ts (appended apifyCircuitBreaker singleton)"
    - "src/lib/services/rate-limiter.ts (appended scrapeRateLimiter singleton)"
    - "src/lib/services/error-logger.ts (added APIFY_SCRAPE_FAILED to ErrorCode)"

key-decisions:
  - "Token read at call time (inside function body), not module load — allows tests to set env in beforeEach, CI builds don't need real token"
  - "ApifyClient constructed per-call rather than as singleton — constructor is cheap, avoids test isolation issues with mocked singletons"
  - "Used `queries` field (not `profileUrls`) per 01-01-SUMMARY probe findings that resolved research assumption A1"
  - "Used `profileScraperMode: 'Profile details no email ($4 per 1k)'` — exact enum value required by actor, discovered during 01-01 probe"
  - "Private profile detection checks both empty items AND missing headline field — covers both empty-array and sparse-object cases"
  - "Schema validation is defensive (log warning on failure, still return items) — passthrough tolerance prevents blocking on actor field drift"
  - "Circuit breaker reset in tests via direct property manipulation rather than vi.resetModules() — simpler and avoids re-import overhead"

patterns-established:
  - "Apify service module pattern: token check -> circuit breaker check -> API call -> status check -> dataset fetch -> schema validation -> success record"
  - "Error classification: typed APIFY_* error codes for route-level mapping to i18n keys"
  - "Cost tracking: run.usageTotalUsd ?? APIFY_COST_PER_SCRAPE constant"

requirements-completed:
  - REQ-01

duration: ~7min
completed: 2026-04-12
---

# Phase 01 Plan 04: Apify Scraper Client Summary

**apify-client@^2.22.3 installed, scrapeLinkedinProfile() gateway with dedicated circuit breaker (apifyCircuitBreaker), rate limiter (scrapeRateLimiter at 3/min), typed error classification for 6 failure modes, cost tracking via usageTotalUsd fallback, and 17 tests across two test files.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-12T02:30:40Z
- **Completed:** 2026-04-12T02:37:48Z
- **Tasks:** 3
- **Files created:** 3
- **Files modified:** 5
- **Commits:** 3 (+ this metadata commit)

## Accomplishments

- **apify-client installed**: v2.22.3+ as production dependency (NOT devDependency). 39 transitive packages added.
- **apifyCircuitBreaker singleton**: Appended to circuit-breaker.ts with config tuned for Apify call frequency (windowSize:30, minSamples:8, cooldownMs:20000, successStreakToClose:2). Existing llmCircuitBreaker untouched.
- **scrapeRateLimiter singleton**: Appended to rate-limiter.ts at 3 req/min per key. Existing exportRateLimiter and regenerateRateLimiter untouched.
- **scrapeLinkedinProfile()**: Full Apify gateway with 6 typed error paths (APIFY_CIRCUIT_OPEN, APIFY_RUN_FAILED, APIFY_RUN_TIMED-OUT, APIFY_PROFILE_PRIVATE, APIFY_TOKEN_MISSING, APIFY_SCRAPE_FAILED), circuit breaker integration, cost tracking, schema validation, and sanitized error logging.
- **Token security**: APIFY_API_TOKEN read at call time (not module load), never logged, never exposed to callers. URL hashed with SHA-256 for log inputMeta.
- **12 scraper client tests**: All error paths, success path, cost fallback, circuit breaker state, token validation, exported constants, schema validation.
- **5 rate limiter tests**: 3/min allowance, 4th-request blocking, key independence, window reset with fake timers, retryAfter convention.

## Task Commits

1. **Task 1: Install apify-client + add circuit breaker + rate limiter singletons** -- `eccd96e` (chore)
2. **Task 2: Create apify-scraper-client.ts with all error classification** -- `c649503` (feat)
3. **Task 3: Rate limiter tests for scrapeRateLimiter** -- `ff69cf3` (test)

## Files Created/Modified

**Created:**
- `src/lib/services/apify-scraper-client.ts` -- scrapeLinkedinProfile(), APIFY_ACTOR_ID, APIFY_COST_PER_SCRAPE exports (~170 lines)
- `src/lib/services/__tests__/apify-scraper-client.test.ts` -- 12 tests with mocked ApifyClient (~210 lines)
- `src/lib/services/__tests__/apify-rate-limit.test.ts` -- 5 tests with fake timers (~110 lines)

**Modified:**
- `package.json` -- added `apify-client: "^2.22.3"` to dependencies
- `package-lock.json` -- 39 new packages
- `src/lib/services/circuit-breaker.ts` -- appended apifyCircuitBreaker singleton (7 lines)
- `src/lib/services/rate-limiter.ts` -- appended scrapeRateLimiter singleton (5 lines)
- `src/lib/services/error-logger.ts` -- added APIFY_SCRAPE_FAILED to ErrorCode union

## Decisions Made

1. **Token at call time, not module load**: process.env.APIFY_API_TOKEN is read inside scrapeLinkedinProfile(), not at module scope. This means CI/build never needs the real token, and tests can set/unset it freely in beforeEach.
2. **Per-call client construction**: ApifyClient is instantiated on each call rather than as a module-level singleton. The constructor is trivial (just stores the token), and this approach avoids mock-reset complexity in tests.
3. **Actor input field `queries` (not `profileUrls`)**: Per 01-01-SUMMARY deviation #6, the real actor uses `queries: string[]` as the input field name. Research assumed `profileUrls` but the live probe proved otherwise.
4. **profileScraperMode enum value**: The exact string `"Profile details no email ($4 per 1k)"` is required by the actor. This was undocumented in research but discovered during the 01-01 probe.
5. **Circuit breaker reset in tests via property manipulation**: Rather than vi.resetModules() (which would require re-importing all dependencies), tests directly set breaker.state/records/etc. This is simpler and faster.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] APIFY_SCRAPE_FAILED error code not in ErrorCode union**
- **Found during:** Task 2
- **Issue:** The scraper client uses `code: "APIFY_SCRAPE_FAILED"` in logError calls, but this code was not in the ErrorCode union type in error-logger.ts, causing a TypeScript type error.
- **Fix:** Added `"APIFY_SCRAPE_FAILED"` to the ErrorCode union in error-logger.ts.
- **Files modified:** src/lib/services/error-logger.ts
- **Commit:** c649503

**2. [Rule 1 - Bug] Research pattern used `profileUrls` but actor requires `queries`**
- **Found during:** Task 2 (known from 01-01-SUMMARY)
- **Issue:** Research Pattern 1 (lines 184-246) used `profileUrls: [params.profileUrl]` as the actor input field. The 01-01 live probe discovered the actor actually uses `queries: string[]`.
- **Fix:** Used `queries: [params.profileUrl]` in the actor.call() input.
- **Files modified:** src/lib/services/apify-scraper-client.ts
- **Commit:** c649503

**3. [Rule 1 - Bug] Research pattern missing profileScraperMode**
- **Found during:** Task 2 (known from 01-01-SUMMARY)
- **Issue:** Research Pattern 1 used `profileScraperMode: "Profile details no email"` but the actor requires the full pricing string `"Profile details no email ($4 per 1k)"`.
- **Fix:** Used the exact enum value discovered by the 01-01 probe.
- **Files modified:** src/lib/services/apify-scraper-client.ts
- **Commit:** c649503

## Known Stubs

None. All exports are fully functional. No placeholder data or TODO markers.

## Threat Flags

None. All surfaces covered by the plan's threat model (T-04-01 through T-04-06) are mitigated:
- T-04-01 (token exposure): Token read at call time, never logged, never in inputMeta
- T-04-02 (cascading failure): apifyCircuitBreaker with 60% threshold, 20s cooldown
- T-04-03 (log injection): Only urlHash (16-char SHA-256 prefix) in inputMeta, no raw strings
- T-04-04 (cost abuse): scrapeRateLimiter at 3/min per key
- T-04-05 (PII in logs): No response payload or scraped items in logError inputMeta
- T-04-06 (empty items): Private profile detection via empty items OR missing headline

## Self-Check: PASSED

Verification performed:
- `src/lib/services/apify-scraper-client.ts` exists and exports scrapeLinkedinProfile, APIFY_ACTOR_ID, APIFY_COST_PER_SCRAPE
- `src/lib/services/__tests__/apify-scraper-client.test.ts` exists with 12 tests
- `src/lib/services/__tests__/apify-rate-limit.test.ts` exists with 5 tests
- `src/lib/services/circuit-breaker.ts` contains apifyCircuitBreaker export
- `src/lib/services/rate-limiter.ts` contains scrapeRateLimiter export
- `src/lib/services/error-logger.ts` contains APIFY_SCRAPE_FAILED code
- Commits eccd96e, c649503, ff69cf3 exist in git log
- `npx vitest run` passes 17/17 tests across both files
- `npm run build` passes with zero errors

---
*Phase: 01-apify-linkedin-integration*
*Plan: 04 (apify-scraper-client)*
*Completed: 2026-04-12*
