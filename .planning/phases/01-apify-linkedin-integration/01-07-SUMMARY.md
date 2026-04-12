---
phase: 01-apify-linkedin-integration
plan: 07
subsystem: api
tags: [apify, linkedin, scraping, webhook, creala, vitest, rate-limiting, quota]

# Dependency graph
requires:
  - phase: 01-03
    provides: "apify-cache (normalizeLinkedinUrl, readCache, writeCache, hashUrl)"
  - phase: 01-04
    provides: "apify-scraper-client (scrapeLinkedinProfile), scrapeRateLimiter"
  - phase: 01-05
    provides: "apify-fingerprint (computeFingerprint)"
  - phase: 01-06
    provides: "apify-quota (checkQuota, consumeQuota, getQuotaState, logUsage)"
provides:
  - "POST /api/scrape-linkedin endpoint orchestrating full scrape pipeline"
  - "Creala webhook apifyScrapeQuota:null on plan upgrade (paid users get unlimited scrapes)"
  - "14 route integration tests + 4 Creala regression tests (18 total)"
affects: [01-08, 01-09, 01-10, 01-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full pipeline orchestration route: validate -> rate-limit -> fingerprint -> cache -> quota -> scrape -> respond"
    - "logUsage in finally block for append-only audit trail on every request"
    - "classifyError/statusForError functions for APIFY error code -> HTTP status mapping"

key-files:
  created:
    - src/app/api/scrape-linkedin/route.ts
    - src/app/api/scrape-linkedin/__tests__/route.test.ts
    - src/app/api/webhooks/creala/__tests__/route.test.ts
  modified:
    - src/app/api/webhooks/creala/route.ts

key-decisions:
  - "Supabase auth import path: @/lib/supabase/server (createClient)"
  - "Single user.update site in Creala webhook modified (new_sale and new_subscription share one case branch)"
  - "HMAC verify function unchanged at 27 lines (lines 75-101)"

patterns-established:
  - "Creala webhook regression test pattern: compute real HMAC in test, mock Prisma stores, validate both security and business logic"

requirements-completed: [REQ-01, REQ-04]

# Metrics
duration: 4min
completed: 2026-04-12
---

# Plan 07: /api/scrape-linkedin POST Route + Creala Webhook Quota Reset

**Full scrape pipeline route with 7 error codes, cache-aware quota gating, and Creala webhook apifyScrapeQuota:null on plan upgrade**

## Performance

- **Duration:** ~4 min (continuation -- Tasks 1-2 completed in prior session)
- **Started:** 2026-04-12T00:18:00Z (continuation)
- **Completed:** 2026-04-12T00:22:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- POST /api/scrape-linkedin orchestrates full pipeline: validate, rate-limit, fingerprint, normalize, cache-read, quota-check, Apify call, cache-write, quota-consume, usage-log
- 7 typed error codes (APIFY_INVALID_URL, APIFY_QUOTA_EXCEEDED, APIFY_PROFILE_PRIVATE, APIFY_RATE_LIMITED, APIFY_DOWNTIME, APIFY_CIRCUIT_OPEN, APIFY_DISABLED) with correct HTTP statuses
- Creala webhook updated with surgical 2-line addition for apifyScrapeQuota:null on plan upgrade
- 18 total tests: 14 route integration tests + 4 Creala regression tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /api/scrape-linkedin POST route** - `5694ba5` (feat)
2. **Task 2: Integration tests for /api/scrape-linkedin** - `fadfa79` (test)
3. **Task 3: Creala webhook apifyScrapeQuota:null + regression tests** - `60b5b3b` (feat)

## Files Created/Modified
- `src/app/api/scrape-linkedin/route.ts` - POST handler: full pipeline orchestration with runtime=nodejs, maxDuration=60
- `src/app/api/scrape-linkedin/__tests__/route.test.ts` - 14 integration tests covering all error/success paths
- `src/app/api/webhooks/creala/route.ts` - Added apifyScrapeQuota:null to new_sale/new_subscription data object
- `src/app/api/webhooks/creala/__tests__/route.test.ts` - 4 regression tests: quota reset, HMAC rejection, plan update preservation

## Decisions Made
- Supabase server auth imported via `@/lib/supabase/server` (createClient), consistent with existing routes
- Only 1 prisma.user.update site needed modification (new_sale and new_subscription share a single case branch in the switch)
- HMAC verifySignature function line count unchanged (27 lines, lines 75-101)
- Total test count: 18 (14 route + 4 Creala regression)

## Deviations from Plan

None - plan executed exactly as written. The webhook edit was surgical (2 lines: 1 comment + 1 property), HMAC verification untouched, all tests pass.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Route endpoint ready for Plan 01-08 (orchestrator integration) to wire scrape data into the audit pipeline
- Creala webhook quota reset ensures paid users get unlimited scrapes immediately after payment
- All 18 tests passing, build clean

## Self-Check: PASSED

All 4 files exist, all 3 commits verified, apifyScrapeQuota:null present in webhook, Plan 01-07 comment present, verifySignature untouched.

---
*Phase: 01-apify-linkedin-integration*
*Plan: 07*
*Completed: 2026-04-12*
