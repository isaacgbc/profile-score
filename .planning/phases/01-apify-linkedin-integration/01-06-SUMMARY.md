---
phase: 01-apify-linkedin-integration
plan: 06
subsystem: services
tags: [apify, linkedin, quota, prisma, vitest, tdd]

requires:
  - phase: 01-apify-linkedin-integration
    provides: "01-02 Prisma models (User quota fields, AnonymousApifyUsage, ApifyUsageLog)"
  - phase: 01-apify-linkedin-integration
    provides: "01-03 Prisma mock with __test__ helpers, computeFingerprint"
provides:
  - "checkQuota — cache-hit bypass, 3-tier enforcement (paid/free-auth/free-anon), fail-closed"
  - "consumeQuota — Prisma atomic increment for User, upsert for AnonymousApifyUsage"
  - "getQuotaState — read-only remaining count + plan tier for dashboard display"
  - "logUsage — fire-and-forget append-only audit log to ApifyUsageLog"
  - "APIFY_FREE_QUOTA constant (1)"
  - "QuotaCallerContext type"
affects:
  - "01-07 (scrape route — orchestrates: fingerprint -> cache check -> checkQuota -> scrape -> consumeQuota -> logUsage)"

tech-stack:
  added: []
  patterns:
    - "Prisma { increment: 1 } atomic update for concurrent-safe counter increment"
    - "Prisma mock extended with increment-object detection for user.update and anon.upsert"
    - "Fail-closed quota default: unknown caller (no userId, no fingerprintHash) = denied"
    - "Cache-hit bypass: isCacheHit=true short-circuits with zero DB lookups"

key-files:
  created:
    - "src/lib/services/apify-quota.ts"
    - "src/lib/services/__tests__/apify-quota.test.ts"
  modified:
    - "src/lib/db/__mocks__/client.ts"

key-decisions:
  - "Used Prisma { increment: 1 } for atomic counter updates instead of fetch-then-write, to prevent race conditions under concurrent requests (T-06-04)"
  - "Extended Prisma mock to detect { increment: N } objects and resolve them to numeric addition, enabling realistic test behavior for both user.update and anonymousApifyUsage.upsert"
  - "getQuotaState maps activePlanId='recommended' to plan='recommended', all other paid users default to plan='starter' -- matches existing 2-tier Creala plan structure"

requirements-completed:
  - REQ-04

duration: 4min
completed: 2026-04-12
---

# Phase 01 Plan 06: Apify Quota Enforcement Service Summary

**3-tier quota enforcement (paid unlimited, free 1/user, anon 1/fingerprint) with cache-hit bypass, Prisma atomic increments, and fire-and-forget audit logging -- 22 passing tests.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-12T02:51:45Z
- **Completed:** 2026-04-12T02:55:21Z
- **Tasks:** 1 (TDD)
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- `apify-quota.ts`: Four exported functions centralizing all Apify quota logic:
  - `checkQuota`: cache-hit bypass (zero DB lookups), paid tier (`apifyScrapeQuota === null`) unlimited, free-auth check against User.apifyScrapeCount, free-anon check against AnonymousApifyUsage.scrapeCount, fail-closed on unknown caller (T-06-07)
  - `consumeQuota`: Prisma `{ increment: 1 }` atomic update for User.apifyScrapeCount, upsert for AnonymousApifyUsage with first/last scrape timestamps
  - `getQuotaState`: Read-only remaining count + plan tier for dashboard display; handles all 3 tiers + edge cases (missing user, missing anon record)
  - `logUsage`: Fire-and-forget append to ApifyUsageLog via try/catch (T-06-05), matches logError() pattern
- Updated Prisma mock (`__mocks__/client.ts`): Added `{ increment: N }` object detection in `user.update` and `anonymousApifyUsage.upsert` -- resolves increment objects to numeric addition against existing store values

## Task Commits

1. **Task 1: Create apify-quota.ts with TDD (22 tests)** -- `999bc77` (feat)

## Files Created/Modified

- `src/lib/services/apify-quota.ts` -- Quota enforcement service: `checkQuota`, `consumeQuota`, `getQuotaState`, `logUsage`, `APIFY_FREE_QUOTA`
- `src/lib/services/__tests__/apify-quota.test.ts` -- 22 tests covering all 3 tiers, cache bypass, fail-closed, audit log
- `src/lib/db/__mocks__/client.ts` -- Extended `user.update` and `anonymousApifyUsage.upsert` to handle Prisma `{ increment: N }` pattern

## Test Count: 22

| Test File | Tests | Status |
|-----------|-------|--------|
| apify-quota.test.ts | 22 | All passing |
| **Total** | **22** | **All passing** |

### Test Breakdown

| # | Category | Description | Status |
|---|----------|-------------|--------|
| 1 | checkQuota | isCacheHit=true bypasses DB | Pass |
| 2 | checkQuota | paid (quota=null) returns silently | Pass |
| 3 | checkQuota | quota=0, count=0 throws | Pass |
| 4 | checkQuota | quota=1, count=0 allows | Pass |
| 5 | checkQuota | quota=1, count=1 throws | Pass |
| 6 | checkQuota | user not found throws | Pass |
| 7 | checkQuota | anon no record allows | Pass |
| 8 | checkQuota | anon scrapeCount=1 throws | Pass |
| 9 | checkQuota | no userId no fingerprint throws | Pass |
| 10 | checkQuota | paid with high count still passes | Pass |
| 11 | consumeQuota | increments + sets firstScrapeAt | Pass |
| 12 | consumeQuota | preserves existing firstScrapeAt | Pass |
| 13 | consumeQuota | anon upsert increments | Pass |
| 14 | consumeQuota | first anon creates record | Pass |
| 15 | getQuotaState | paid returns null remaining | Pass |
| 16 | getQuotaState | free quota=1 count=0 | Pass |
| 17 | getQuotaState | free quota=1 count=1 | Pass |
| 18 | getQuotaState | anon no record returns 1 | Pass |
| 19 | getQuotaState | anon used returns 0 | Pass |
| 20 | getQuotaState | missing both returns 0 | Pass |
| 21 | logUsage | all fields logged | Pass |
| 22 | logUsage | nullable fields omitted | Pass |

## Prisma Mock Update

The mock required updates to support `{ increment: 1 }` syntax:
- **Before:** `user.update` did naive spread (`{ ...existing, ...data }`), which would set `apifyScrapeCount` to the object `{ increment: 1 }` instead of incrementing
- **After:** Both `user.update` and `anonymousApifyUsage.upsert` iterate update data entries, detect objects with an `increment` key, and resolve them as `existingValue + increment` -- matching real Prisma behavior
- Existing Plan 01-03 tests (24) confirmed still passing after mock update

## Decisions Made

- **Prisma atomic increment over fetch-then-write**: Used `{ increment: 1 }` pattern for concurrent safety, mitigating T-06-04 race condition risk
- **Mock increment detection**: Added generic increment-object resolution to the mock rather than hardcoding field-specific workarounds, making it reusable for any future Prisma atomic operations
- **getQuotaState plan mapping**: `activePlanId === "recommended"` maps to `plan: "recommended"`, all other non-null quota users default to `plan: "starter"` -- simple 2-tier logic matching existing Creala structure

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## Threat Model Compliance

All threat mitigations from the plan's threat model verified in tests:
- **T-06-04** (race condition): Prisma `{ increment: 1 }` atomic operation used
- **T-06-05** (logUsage crash): Wrapped in try/catch, fire-and-forget
- **T-06-07** (fail-closed): Test 9 verifies unknown caller is denied

## Next Phase Readiness

- **Plan 01-07 (scrape route) unblocked**: All 4 quota functions ready for route orchestration: `fingerprint -> cache check -> checkQuota -> scrape -> consumeQuota -> logUsage`
- **No blockers.**

## Self-Check: PASSED

**Files:**
- `src/lib/services/apify-quota.ts` -- FOUND
- `src/lib/services/__tests__/apify-quota.test.ts` -- FOUND
- `src/lib/db/__mocks__/client.ts` -- FOUND

**Commits:**
- `999bc77` -- FOUND

**Verification gates:**
- `npx vitest run` (137 total tests, 22 quota) -- PASSED
- `npm run build` exit 0 -- PASSED
- No `new PrismaClient` imports -- PASSED
- Singleton import `@/lib/db/client` -- PASSED
- All 8 acceptance criteria grep checks -- PASSED

---
*Phase: 01-apify-linkedin-integration*
*Completed: 2026-04-12*
