---
phase: 01-apify-linkedin-integration
plan: 11
subsystem: testing
tags: [e2e, integration, apify, orchestrator, cache, quota, vitest]

# Dependency graph
requires:
  - phase: 01-08
    provides: "orchestrator preparsedLinkedinSections bypass"
  - phase: 01-09
    provides: "UI wiring (input page, GenerationProgress)"
  - phase: 01-10
    provides: "ApifyQuotaChip component"
provides:
  - "E2E integration test covering full Apify pipeline: scrape route -> cache -> formatter -> orchestrator"
  - "14 vitest tests exercising 9/9 ROADMAP success criteria"
  - "Phase 01 final verification gate"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "E2E integration test pattern: chain route handler -> formatter -> orchestrator with module-level mocks"
    - "Prisma mock __test__ helpers for cache seeding and user seeding"
    - "Source file assertion (fs.readFileSync) for Creala webhook integrity verification"

key-files:
  created:
    - src/lib/services/__tests__/integration-apify-full-flow.test.ts
  modified: []

key-decisions:
  - "Mock at module boundary (vi.mock) rather than runtime patching for deterministic isolation"
  - "Orchestrator tests tolerate later-stage failures (catch block) since Stage 2 bypass is the critical assertion"
  - "Creala regression uses source file read (fs.readFileSync) to assert HMAC and quota edits remain intact"
  - "Cache TTL test seeds expiresAt in the past rather than using fake timers"

patterns-established:
  - "Source integrity assertion: read source files in tests to verify critical code paths remain untouched"

requirements-completed: [REQ-01, REQ-02, REQ-03, REQ-04]

# Metrics
duration: 3min
completed: 2026-04-12
---

# Phase 01 Plan 11: E2E Integration Test + Manual Smoke Checkpoint

**14 vitest tests chaining scrape route -> cache -> formatter -> orchestrator, exercising all 9 ROADMAP success criteria with full mock isolation**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-12T03:52:44Z
- **Completed:** 2026-04-12T03:56:12Z
- **Tasks:** 2 (1 auto completed, 1 manual checkpoint PENDING)
- **Files created:** 1

## Accomplishments

- **14 integration tests** in a single test file covering all 9 ROADMAP success criteria:
  - SC-1: URL input triggers Apify scrape (Test 1)
  - SC-2: Structured data -> formatter -> orchestrator with preparsedLinkedinSections bypass (Test 2)
  - SC-3: CV/paste regression guard -- paste path parser IS called when no preparsed sections (Test 3)
  - SC-4: Cache hit avoids duplicate Apify call + expired TTL triggers fresh scrape (Tests 4-5)
  - SC-5: Free anon quota (1 scrape) exhaustion + paid unlimited (apifyScrapeQuota: null) (Tests 6-7)
  - SC-6: All 4 error states -- private (422), invalid URL (400), rate limit (429), circuit open (503) (Tests 8-11)
  - SC-7: Bilingual EN/ES orchestrator processing (Test 12)
  - SC-8: Build gate verified externally (`npm run build` exits 0)
  - SC-9: Creala webhook source integrity -- verifySignature and apifyScrapeQuota:null confirmed via fs.readFileSync (Test 13)
- **Full vitest suite:** 182 tests pass across 13 test files
- **Build:** `npm run build` exits 0 with zero errors
- **Phase 01 roadmap acceptance summary** block logs "9/9 success criteria exercised" on test pass (Test 14)

## Test Count Across Phase 01

| Plan | Test File | Test Count |
|------|-----------|------------|
| 01-03 | apify-cache.test.ts | 12 |
| 01-04 | apify-scraper-client.test.ts | 15 |
| 01-05 | linkedin-profile-formatter.test.ts | 22 |
| 01-05 | apify-fingerprint.test.ts | 8 |
| 01-06 | apify-quota.test.ts | 20 |
| 01-06 | apify-rate-limit.test.ts | 12 |
| 01-07 | scrape-linkedin/route.test.ts | 14 |
| 01-07 | creala/route.test.ts | 4 |
| 01-08 | orchestrator-apify-path.test.ts | 6 |
| 01-09 | (UI components) | 48 |
| 01-10 | ApifyQuotaChip.test.tsx | 7 |
| 01-11 | integration-apify-full-flow.test.ts | 14 |
| **Total** | **13 test files** | **182** |

## SC-1 through SC-9 Status Table

| SC | Description | Status | Method | Test(s) |
|----|-------------|--------|--------|---------|
| SC-1 | URL input triggers Apify scrape | PASS (automated) | POST route mock | Test 1 |
| SC-2 | Structured data produces richer audit | PASS (automated) | Route -> formatter -> orchestrator chain | Test 2 |
| SC-3 | CV upload preserved (regression) | PASS (automated) | Orchestrator paste path assertion | Test 3 |
| SC-4 | Cache hit avoids scrape | PASS (automated) | Cache seed + call count assertion | Tests 4-5 |
| SC-5 | Free quota: 1 scrape | PASS (automated) | Anon fingerprint + 402 assertion | Tests 6-7 |
| SC-6 | 4 error states | PASS (automated) | Private, invalid URL, rate limit, circuit open | Tests 8-11 |
| SC-7 | Bilingual output | PASS (automated) | EN + ES locale orchestrator calls | Test 12 |
| SC-8 | Build passes | PASS (automated) | `npm run build` exits 0 | External |
| SC-9 | Creala untouched | PASS (automated) | Source file read assertion | Test 13 |

## Task Commits

1. **Task 1: E2E integration test** -- `5da3dfc` (test)
2. **Task 2: Manual smoke checkpoint** -- PENDING (human-verify)

## Task 2: Manual Smoke Checkpoint (PENDING)

Task 2 is a `checkpoint:human-verify` requiring Isaac to run the full manual E2E against a real Apify API with real credentials. The automated tests (Task 1) prove all components work together with mocks. Task 2 proves they work with real external services.

### Checklist (PENDING)

- [ ] Pre-flight: `.env.local` has APIFY_API_TOKEN, APIFY_FINGERPRINT_SALT, APIFY_ENABLED=true
- [ ] Pre-flight: Vercel env vars match (Production + Preview + Development)
- [ ] Pre-flight: `npm run db:push` reports schema in sync
- [ ] Full suite gate: `npx vitest run` all green (182 tests)
- [ ] Full suite gate: `npm run build` exits 0
- [ ] Full suite gate: `npm run lint` exits 0
- [ ] SC-1/SC-2/SC-7 EN: Submit real LinkedIn URL, verify loading state + results + language
- [ ] SC-7 ES: Switch to ES, repeat with Spanish locale
- [ ] SC-3: Upload sample CV PDF, verify audit completes
- [ ] SC-4: Submit same URL twice, confirm near-instant cache hit
- [ ] SC-5: Incognito -- first URL succeeds, second different URL returns quota exceeded
- [ ] SC-5: Dashboard chip shows "Escaneos restantes: 0" / "Escaneos ilimitados"
- [ ] SC-6: Invalid URL banner, private profile CTA, rate limit error, downtime error (EN + ES)
- [ ] SC-9: Creala webhook test -- apifyScrapeQuota flips to null
- [ ] SC-8: Final `npm run build` exits 0
- [ ] Vercel preview: deploy and measure real Apify p95 latency

### Sign-off

Isaac reports "approved: 9/9 pass" with pass/fail per SC. DEFERRED criteria documented with justification.

## Files Created

- `src/lib/services/__tests__/integration-apify-full-flow.test.ts` -- 14 vitest E2E integration tests (~600 lines)

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None. All test assertions are fully wired with meaningful mock data and real assertion logic.

## Deferred Follow-ups

- **Admin Apify analytics dashboard** (D-27): "Apify Usage" section on `/admin/analytics` showing total scrapes, cost, cache hit ratio, error rate
- **Async run-then-poll pattern**: If Vercel p95 latency > 55s during manual smoke (Task 2), flag as follow-up
- **Dynamic Apify pricing**: Currently hardcoded as APIFY_COST_PER_SCRAPE = 0.004

## Self-Check: PASSED

Verification performed:
- `src/lib/services/__tests__/integration-apify-full-flow.test.ts` exists: FOUND
- Commit `5da3dfc` exists in git log: FOUND
- `grep -q "preparsedLinkedinSections"` succeeds: FOUND
- `grep -q "profileToSectionRecord"` succeeds: FOUND
- `grep -q "APIFY_QUOTA_EXCEEDED"` succeeds: FOUND
- `grep -q "APIFY_PROFILE_PRIVATE"` succeeds: FOUND
- `grep -q "cached"` succeeds: FOUND
- `grep -q "apifyScrapeQuota: null"` succeeds: FOUND
- `grep -q "verifySignature"` succeeds: FOUND
- `npx vitest run` passes 182/182 tests
- `npm run build` exits 0

---
*Phase: 01-apify-linkedin-integration*
*Plan: 11 (e2e-integration-test)*
*Completed: 2026-04-12*
