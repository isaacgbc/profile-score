---
phase: 01-apify-linkedin-integration
plan: 03
subsystem: services
tags: [apify, linkedin, cache, fingerprint, sha256, prisma, vitest, tdd]

requires:
  - phase: 01-apify-linkedin-integration
    provides: "01-01 Zod schemas (linkedin-profile.ts) + 01-02 Prisma models (LinkedInProfileCache, AnonymousApifyUsage, ApifyUsageLog, User quota fields)"
provides:
  - "normalizeLinkedinUrl — canonical URL normalization (strips www/m/country subdomains, trailing slashes, query params, sub-routes)"
  - "hashUrl — SHA-256 hex digest for URL hashing"
  - "readCache / writeCache — Prisma-backed cache with 24h TTL enforcement"
  - "computeFingerprint — deterministic SHA-256 fingerprint from IP + UA + salt"
  - "APIFY_CACHE_TTL_MS constant (86400000ms)"
  - "Prisma client mock (src/lib/db/__mocks__/client.ts) — reusable for all Apify service tests"
affects:
  - "01-04 (apify-quota service — uses computeFingerprint + Prisma mock)"
  - "01-05 (apify-scraper-client — uses readCache/writeCache)"
  - "01-06 (/api/scrape-linkedin route — uses normalizeLinkedinUrl, readCache, writeCache, computeFingerprint)"
  - "01-07 (orchestrator integration — uses readCache for cache hits)"

tech-stack:
  added: []
  patterns:
    - "TDD RED-GREEN for pure service functions — write tests first, then implementation"
    - "Prisma in-memory mock with vi.fn() + Map-backed stores and __test__ reset helper"
    - "Salt read inside function body (not module-level) for env var isolation in tests"
    - "URL normalization as single source of truth for cache key canonical form"

key-files:
  created:
    - "src/lib/services/apify-cache.ts"
    - "src/lib/services/apify-fingerprint.ts"
    - "src/lib/services/__tests__/apify-cache.test.ts"
    - "src/lib/services/__tests__/apify-fingerprint.test.ts"
    - "src/lib/db/__mocks__/client.ts"
  modified: []

key-decisions:
  - "Salt read inside computeFingerprint body instead of module-level const — enables test isolation without module re-import"
  - "Prisma mock uses Map-backed stores with typed rows — provides realistic findUnique/upsert semantics without DB"
  - "normalizeLinkedinUrl wraps new URL() in try/catch and throws APIFY_INVALID_URL — matches error code convention used by route handlers"
  - "Split null and undefined UA into separate tests (8 tests instead of 7) — both verified to produce identical hashes"

patterns-established:
  - "vi.mock('@/lib/db/client', () => import('@/lib/db/__mocks__/client')) — standard mock import for Apify service tests"
  - "beforeEach(() => { (prisma as any).__test__.reset(); }) — state isolation between tests"
  - "APIFY_INVALID_URL error code — static string, no user input interpolation (safe for logError)"

requirements-completed:
  - REQ-01
  - REQ-04

duration: 5min
completed: 2026-04-12
---

# Phase 01 Plan 03: Apify Cache + Fingerprint Services Summary

**URL normalization (6 edge cases), 24h TTL cache read/write via Prisma, and deterministic SHA-256 fingerprinting -- 24 passing tests with reusable Prisma mock for downstream plans.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-12T02:22:43Z
- **Completed:** 2026-04-12T02:27:54Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments

- `apify-cache.ts`: URL normalization handles www/m/country subdomains, trailing slashes, query params, sub-routes after slug -- deterministic canonical form `https://linkedin.com/in/{slug}`. Cache read enforces 24h TTL at application layer. Cache write upserts with computed `expiresAt`.
- `apify-fingerprint.ts`: SHA-256 hash of `IP\nUA\nsalt` with env-var salt (`APIFY_FINGERPRINT_SALT`) read inside function body for test isolation. Default fallback `"ps-apify-v1"`.
- `src/lib/db/__mocks__/client.ts`: In-memory Prisma mock covering `linkedInProfileCache`, `anonymousApifyUsage`, `user`, `apifyUsageLog` with `__test__` helpers (`reset`, `seedUser`, `seedCache`, `logStore`, `cacheStore`, `anonStore`, `userStore`). Reusable by Plans 01-04 through 01-07.
- All 24 tests green, build clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma mock + fingerprint service** -- `907c1b9` (feat)
2. **Task 2: Cache service with URL normalization + 24h TTL** -- `389b5bc` (feat)

## Files Created/Modified

- `src/lib/db/__mocks__/client.ts` -- In-memory Prisma mock with Map-backed stores for 4 models + `__test__` reset/seed helpers
- `src/lib/services/apify-fingerprint.ts` -- `computeFingerprint(ip, userAgent?)` producing 64-char hex SHA-256
- `src/lib/services/__tests__/apify-fingerprint.test.ts` -- 8 tests: hex format, determinism, different IPs, different UAs, null/undefined UA, salt rotation, default fallback
- `src/lib/services/apify-cache.ts` -- `normalizeLinkedinUrl`, `hashUrl`, `readCache`, `writeCache`, `APIFY_CACHE_TTL_MS`
- `src/lib/services/__tests__/apify-cache.test.ts` -- 16 tests: 6 normalization edge cases, 3 invalid URL rejections, hash format + determinism, cache miss/expired/fresh reads, upsert verification, TTL constant

## Test Count: 24

| Test File | Tests | Status |
|-----------|-------|--------|
| apify-fingerprint.test.ts | 8 | All passing |
| apify-cache.test.ts | 16 | All passing |
| **Total** | **24** | **All passing** |

## Prisma Mock Shape (for downstream reference)

```typescript
prisma.linkedInProfileCache.findUnique({ where: { url } })
prisma.linkedInProfileCache.upsert({ where: { url }, create, update })
prisma.linkedInProfileCache.delete({ where: { url } })
prisma.anonymousApifyUsage.findUnique({ where: { fingerprintHash } })
prisma.anonymousApifyUsage.upsert({ where: { fingerprintHash }, create, update })
prisma.user.findUnique({ where: { id } })
prisma.user.update({ where: { id }, data })
prisma.apifyUsageLog.create({ data })
prisma.apifyUsageLog.count()
prisma.__test__.reset()
prisma.__test__.seedUser({ id, email, ...optional })
prisma.__test__.seedCache(CacheRow)
prisma.__test__.logStore / cacheStore / anonStore / userStore
```

## Decisions Made

- **Salt inside function body**: Plan example showed module-level `const SALT = process.env...` but the plan action explicitly required reading inside the function body for test isolation. Followed the action spec.
- **8 fingerprint tests instead of 7**: Plan specified 7 behaviors but "Missing user agent (null or undefined)" was split into two tests (null and undefined separately) with a cross-check assertion verifying they produce identical hashes. More thorough, no downside.
- **normalizeLinkedinUrl try/catch**: The `new URL()` constructor throws on invalid input. Wrapped in try/catch to convert to `APIFY_INVALID_URL` error code rather than leaking a `TypeError`.

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None -- no external service configuration required for this plan. The `APIFY_FINGERPRINT_SALT` env var is optional (defaults to `"ps-apify-v1"` for development).

## Next Phase Readiness

- **Plans 01-04 (quota service) and 01-06 (scrape route) unblocked**: Both `computeFingerprint` and `readCache`/`writeCache` are ready for consumption.
- **Prisma mock reusable**: `src/lib/db/__mocks__/client.ts` covers all 4 models needed by downstream service tests.
- **No blockers.**

## Self-Check: PASSED

**Files:**
- `src/lib/services/apify-fingerprint.ts` -- FOUND
- `src/lib/services/apify-cache.ts` -- FOUND
- `src/lib/services/__tests__/apify-fingerprint.test.ts` -- FOUND
- `src/lib/services/__tests__/apify-cache.test.ts` -- FOUND
- `src/lib/db/__mocks__/client.ts` -- FOUND

**Commits:**
- `907c1b9` -- FOUND
- `389b5bc` -- FOUND

**Verification gates:**
- `npx vitest run` (24 tests) -- PASSED
- `npm run build` exit 0 -- PASSED
- No `new PrismaClient` imports -- PASSED
- Singleton import `@/lib/db/client` -- PASSED

---
*Phase: 01-apify-linkedin-integration*
*Completed: 2026-04-12*
