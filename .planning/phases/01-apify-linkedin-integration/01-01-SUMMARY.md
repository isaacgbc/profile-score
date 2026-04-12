---
phase: 01-apify-linkedin-integration
plan: 01
subsystem: testing
tags: [vitest, zod, i18n, apify, harvestapi, fixtures, test-infra]

# Dependency graph
requires:
  - phase: 01-apify-linkedin-integration/01-02
    provides: "Prisma schema (LinkedInProfileCache, User.apifyScrapeQuota) — used later by Plans 01-04+ but not directly by this plan"
provides:
  - "vitest 2.1.9 + happy-dom + vite-tsconfig-paths test runner (phase test framework)"
  - "Zod schemas `scrapeLinkedinRequestSchema` + `harvestProfileSchema` with SSRF-hardening and drift tolerance"
  - "TypeScript types `ScrapeLinkedinRequest` + `HarvestProfile`"
  - "18 new i18n keys (apify.* / input.* / progress.*) in both EN and ES"
  - "EN↔ES parity test enforcer (41 assertions)"
  - "3 Apify response fixtures — real probe + empty + minimal"
  - "Resolved research assumptions A1, A2 (partial), A4 via live probe"
  - ".env.example documenting APIFY_API_TOKEN, APIFY_FINGERPRINT_SALT, APIFY_ENABLED + all project env vars"
affects: [01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10, 01-11]

# Tech tracking
tech-stack:
  added: [vitest@2.1.9, "@vitest/ui@2.1.9", happy-dom@15.11.7, vite-tsconfig-paths@5.1.4]
  patterns:
    - "Zod refinement error messages are i18n KEY STRINGS (e.g. `apify.error.invalidUrl`) so route handlers map issue.message → t() without a second lookup"
    - "All Apify response fields use `.nullish()` (not `.optional()`) — HarvestAPI emits explicit null for absent strings"
    - "Field-name aliases in a single Zod schema (`recommendations`+`receivedRecommendations`, `honors`+`honorsAndAwards`) to tolerate actor drift"
    - "Test fixtures stored under `src/lib/services/__tests__/fixtures/` as JSON; real probe data preferred over synthetic"
    - "vitest config as .mts (ESM) to load ESM-only vite-tsconfig-paths plugin"

key-files:
  created:
    - "vitest.config.mts"
    - "src/lib/schemas/linkedin-profile.ts"
    - "src/lib/schemas/__tests__/linkedin-profile.test.ts"
    - "src/lib/i18n/__tests__/apify-keys-parity.test.ts"
    - "src/lib/services/__tests__/fixtures/apify-profile-sample.json"
    - "src/lib/services/__tests__/fixtures/apify-profile-empty.json"
    - "src/lib/services/__tests__/fixtures/apify-profile-minimal.json"
    - ".env.example"
  modified:
    - "package.json (devDeps + 3 test scripts)"
    - "package-lock.json"
    - "src/lib/i18n/en.json (+18 keys, ~27 lines)"
    - "src/lib/i18n/es.json (+18 keys, ~27 lines)"

key-decisions:
  - "vitest config file uses .mts extension because vite-tsconfig-paths is ESM-only and the CJS loader fails"
  - "Removed resolve.alias from vitest config — tsconfigPaths() plugin handles @/* correctly without manual override (per plan-checker ISS-07)"
  - "Zod schema fields use `.nullish()` instead of `.optional()` based on real probe data showing explicit null for absent strings"
  - "Added field-name aliases (`receivedRecommendations`, `honorsAndAwards`) to accept both research-assumed and real actor key names"
  - "Real Apify probe used Bill Gates profile (williamhgates) — safest public figure; returned 10KB, 7s latency, rich shape"
  - "Actor input field is `queries: string[]` NOT `profileUrls` as research assumed — recorded in fixture _note for Plan 01-04"
  - "Actor requires `profileScraperMode` enum with value `\"Profile details no email ($4 per 1k)\"` — not in research; documented in fixture _note"

patterns-established:
  - "Pattern: i18n parity enforced by test — adding a key to one locale only will fail CI"
  - "Pattern: schema refinement messages are i18n keys for direct client mapping"
  - "Pattern: real probe data preferred over synthetic for downstream formatter tests"
  - "Pattern: ESM-only vite plugins require .mts config file"

requirements-completed: [REQ-01, REQ-03]

# Metrics
duration: 12min
completed: 2026-04-11
---

# Phase 01 Plan 01: Apify Schema Foundation & Test Infrastructure Summary

**vitest test runner installed, SSRF-hardened Zod schemas for Apify request/response with real-world drift tolerance, full EN↔ES i18n parity enforcement, and a live-probe fixture that resolved research assumptions A1/A2/A4 about the harvestapi/linkedin-profile-scraper actor.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-12T02:06:45Z
- **Completed:** 2026-04-12T02:18:15Z
- **Tasks:** 4 auto + 1 human-action checkpoint (auto-satisfied via orchestrator pre-provisioning)
- **Files created:** 8
- **Files modified:** 4
- **Commits:** 4 (+ this metadata commit)

## Accomplishments

- **Test infrastructure live**: vitest 2.1.9 + happy-dom + vite-tsconfig-paths installed with `npm test`, `npm run test:run`, `npm run test:ui` scripts. 59 tests passing on first green suite.
- **Zod schemas with SSRF hardening**: `scrapeLinkedinRequestSchema` rejects non-linkedin hosts, data:/javascript: URIs, protocol-relative URLs, host-spoofing attacks (`evil.com/linkedin.com/in/x`), URLs over 500 chars, and bare `/in/` paths. All failure messages use the i18n key `apify.error.invalidUrl` for direct client mapping.
- **Drift-tolerant response schema**: `harvestProfileSchema` uses `.passthrough()` + `.nullish()` for every field, with aliases for HarvestAPI's actual field names (`receivedRecommendations`, `honorsAndAwards`). Validated against real probe output + minimal + empty fixtures.
- **i18n parity locked**: 18 new keys (apify.error.*, apify.dashboard.*, apify.actions.*, input.linkedin*, progress.stageScraping) added to both en.json and es.json. Parity test has 41 assertions and will fail CI if any future key drifts.
- **Live Apify probe executed**: POSTed to `harvestapi~linkedin-profile-scraper` via `/run-sync-get-dataset-items` against `https://www.linkedin.com/in/williamhgates`, received 10KB response in 6.8s, saved as the canonical sample fixture.
- **Research assumptions resolved**: A1 (actor field name), A2 (partial — field-name drift discovered), A4 (sync latency well under 60s Hobby limit).

## Task Commits

1. **Task 1: Install vitest + configure test runner** — `e01261c` (chore)
2. **Task 2: Create Zod schemas for Apify request + HarvestAPI response (TDD)** — `ecf8bf2` (feat)
3. **Task 3: Add all 18 apify.* i18n keys to EN+ES with parity test** — `ac4c7cb` (feat)
4. **Task 4 + Task 5: Capture real Apify probe fixture + .env.example + schema drift fix** — `656d9f4` (feat)

Task 5 was a `checkpoint:human-action` gated by Apify account provisioning. Per the orchestrator prompt, Isaac had already provisioned Apify (token + salt + enabled flag in `.env.local` and Vercel env vars synced to production/preview/development). The executor ran the probe itself using native `https` + `.env.local` token extraction (bypassing the shell env parse error at line 37), so Task 5's verification criteria were satisfied inside Task 4's commit.

## Files Created/Modified

**Created:**
- `vitest.config.mts` — ESM config with happy-dom, tsconfigPaths plugin, exclude list for pre-existing tsx-script tests
- `src/lib/schemas/linkedin-profile.ts` — `scrapeLinkedinRequestSchema` + `harvestProfileSchema` + types (127 lines)
- `src/lib/schemas/__tests__/linkedin-profile.test.ts` — 18 vitest tests (12 required behaviors + null-drift + 3 fixture integration + host-spoofing + i18n key assertion)
- `src/lib/i18n/__tests__/apify-keys-parity.test.ts` — 41 parity assertions
- `src/lib/services/__tests__/fixtures/apify-profile-sample.json` — real 10KB probe data with _note metadata
- `src/lib/services/__tests__/fixtures/apify-profile-empty.json` — `[]`
- `src/lib/services/__tests__/fixtures/apify-profile-minimal.json` — synthetic headline + 1 experience entry, no about
- `.env.example` — all project env vars documented

**Modified:**
- `package.json` — added vitest@2.1.9, @vitest/ui, happy-dom, vite-tsconfig-paths + 3 test scripts
- `package-lock.json` — vitest dep tree
- `src/lib/i18n/en.json` — 18 new keys (4 input.*, 1 progress.*, 7 apify.error.*, 3 apify.dashboard.*, 3 apify.actions.*)
- `src/lib/i18n/es.json` — same 18 keys with Spanish translations

## Decisions Made

1. **.mts config over .ts**: `vite-tsconfig-paths` is ESM-only and the default CJS loader for `vitest.config.ts` fails. Renaming to `.mts` forces ESM resolution. (Rule 3 deviation — blocking; auto-fixed.)
2. **Removed manual `resolve.alias`**: The `tsconfigPaths()` plugin already resolves `@/*` from tsconfig.json. Manual `{ "@": "/src" }` alias was redundant and plan-checker flagged it as ISS-07.
3. **`.nullish()` over `.optional()` for all response string fields**: Real probe showed HarvestAPI emits explicit `null` for absent string fields (e.g. `duration: null` on Bill Gates's experience). `.optional()` rejects null; `.nullish()` accepts both undefined and null.
4. **Field-name aliases in the schema**: Actor returns `receivedRecommendations` and `honorsAndAwards`; research assumed `recommendations` and `honors`. Both spellings are now defined optional fields so the formatter (Plan 01-04) can read either key without schema bumps.
5. **Use `queries` not `profileUrls` in Plan 01-04**: The actor input field that works is `queries: string[]` + `profileScraperMode: "Profile details no email ($4 per 1k)"`. Documented in `apify-profile-sample.json` `_note`.
6. **Sample fixture sourced from williamhgates**: Safest public figure. His profile is sparse (empty skills/certifications/recommendations/projects) so Plan 01-04 may want to probe a denser profile for formatter tests — noted in fixture `_note.plan_01_04_note`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] vitest.config.ts failed with ESM-only plugin**
- **Found during:** Task 1 (first `npx vitest run`)
- **Issue:** `vite-tsconfig-paths` is ESM-only, and Vite's config loader uses CJS by default for `.ts` files, causing `Error: ... resolved to an ESM file. ESM file cannot be loaded by require`.
- **Fix:** Renamed `vitest.config.ts` → `vitest.config.mts`. Vite auto-detects `.mts` as ESM.
- **Files modified:** `vitest.config.mts` (renamed)
- **Verification:** `npx vitest run` exits cleanly (no test files found, but runner starts)
- **Committed in:** `e01261c` (Task 1 commit)

**2. [Rule 2 — Missing Critical] Pre-existing tsx-script tests failed under vitest**
- **Found during:** Task 1 verification
- **Issue:** Two pre-existing `*.test.ts` files (`export-module-card-states.test.ts`, `placeholder-detect.test.ts`) use home-grown `assert()` helpers from the tsx-script convention, not vitest's `describe/it`. They match vitest's default glob and cause false failures.
- **Fix:** Added both to `vitest.config.mts` exclude list alongside the 7 benchmark tsx-scripts the plan already named.
- **Files modified:** `vitest.config.mts`
- **Verification:** `npx vitest run` no longer reports those files
- **Committed in:** `e01261c`

**3. [Rule 1 — Bug] Zod schema rejected real actor response due to null string fields**
- **Found during:** Task 4 (fixture validation against schema)
- **Issue:** The research's example 3 Zod schema used `z.string().optional()` for experience fields, but the real HarvestAPI actor emits `duration: null` (explicit null) for Bill Gates's experience entries. `.optional()` rejects null, so a real-world profile would fail parsing at the safeParse boundary in `/api/scrape-linkedin`.
- **Fix:** Switched every string field to `z.string().nullish()`. Added Test 13 (null-drift tolerance) as a regression guard.
- **Files modified:** `src/lib/schemas/linkedin-profile.ts`, `src/lib/schemas/__tests__/linkedin-profile.test.ts`
- **Verification:** Fixture integration tests parse the real sample + minimal + empty fixtures green (18/18 schema tests pass)
- **Committed in:** `656d9f4` (Task 4 commit)

**4. [Rule 1 — Bug] Schema missing field-name aliases for actor drift**
- **Found during:** Task 4 (inspection of real probe output)
- **Issue:** Actor uses `receivedRecommendations` (not `recommendations`) and `honorsAndAwards` (not `honors`) — names that research example 3 got wrong. The formatter in Plan 01-04 needs to read from both.
- **Fix:** Added `receivedRecommendations` and `honorsAndAwards` as optional `.nullish()` array fields alongside the original names. Both coexist; formatter can check either.
- **Files modified:** `src/lib/schemas/linkedin-profile.ts`
- **Verification:** Real sample fixture parses cleanly with both fields preserved via passthrough
- **Committed in:** `656d9f4`

**5. [Rule 1 — Bug] `.env.local` APIFY_API_TOKEN had angle-bracket wrappers**
- **Found during:** Task 4 (initial probe attempt returned HTTP 401)
- **Issue:** Isaac's `.env.local` had `APIFY_API_TOKEN=<apify_api_...>` (copied literally from the plan template). The angle brackets are template placeholders, not valid token format. This would fail at runtime when the scraper client imports the token.
- **Fix:** Executor's probe script strips angle brackets as a fallback, BUT this needs to be fixed in `.env.local` itself — I cannot write to `.env.local` directly. **Action required by Isaac**: edit `.env.local` line `APIFY_API_TOKEN=<...>` to remove the `<` and `>` characters. See "Issues Encountered" below. Vercel env vars likely have the same issue and should be checked.
- **Files modified:** None (executor cannot edit .env.local). The Plan 01-04 scraper client should include a defensive `.replace(/^<|>$/g, "")` sanitizer in case the env var still has this wrapper.
- **Verification:** Cleaned-token probe succeeded (HTTP 201, 6.8s, 10KB response)
- **Committed in:** N/A — runtime env hygiene issue, flagged for Isaac to fix directly

**6. [Rule 2 — Missing Critical] `profileScraperMode` required by actor but absent from research**
- **Found during:** Task 4 (second probe attempt returned HTTP 400 `invalid-input`)
- **Issue:** Research docs and plan didn't mention that `harvestapi~linkedin-profile-scraper` REQUIRES a `profileScraperMode` enum field with exact value `"Profile details no email ($4 per 1k)"` or `"Profile details + email search ($10 per 1k)"`. Without it, every call fails with 400.
- **Fix:** Documented in `apify-profile-sample.json` `_note.actorInputSchema` for Plan 01-04's `apify-scraper-client.ts` to consume. Executor's probe used the $4 mode.
- **Files modified:** `src/lib/services/__tests__/fixtures/apify-profile-sample.json`
- **Verification:** Third probe attempt with both fields succeeded
- **Committed in:** `656d9f4`

---

**Total deviations:** 6 auto-fixed (2 blocking, 2 bugs, 2 missing critical functionality)
**Impact on plan:** All auto-fixes were essential for correctness. The schema drift fixes (#3, #4) would have caused every real production scrape to fail at the `harvestProfileSchema.safeParse()` boundary. Missing `profileScraperMode` (#6) would have caused every Apify call to return 400. The `.env.local` wrapper issue (#5) would have caused HTTP 401 on first real scrape in production.

## Authentication Gates

**1. Apify API token gate**
- **Task:** 4 (Apify probe scrape)
- **Needed:** Valid APIFY_API_TOKEN from https://console.apify.com/account/integrations
- **Outcome:** Token was provisioned in `.env.local` per orchestrator pre-work (Isaac's prior step). Executor extracted it from the file via `node fs.readFileSync('.env.local')` to bypass the shell env parse error at line 37. Angle-bracket wrapper was stripped in-script (see Deviation #5).

## Issues Encountered

1. **`.env.local` line 37 parse error** — Isaac's `.env.local` has a malformed line that breaks `source` and `dotenv` but not direct file reads. Executor used `fs.readFileSync` + manual line parsing to extract the APIFY_API_TOKEN.
2. **Angle-bracket token wrapper** — `APIFY_API_TOKEN=<apify_api_...>` in `.env.local` needs manual correction. Not fixed by this plan (no write access to .env.local). Plan 01-04's scraper client should include a defensive sanitizer.
3. **Working-tree staging hygiene** — Isaac's working tree had extensive pre-existing unstaged edits (84 modified files). Task 3's initial commit swept 82 lines of unrelated en.json/es.json changes into the staged diff. Fixed by `git checkout HEAD -- <files>`, re-applying only my additions to the HEAD-clean versions, committing the 27-line delta, then restoring Isaac's working-tree snapshot so his pending work is preserved for his own future commit. The committed version is clean; the working-tree version still contains Isaac's work on top.
4. **Real fixture sparseness** — Bill Gates's profile has empty skills/certifications/recommendations/projects arrays. Plan 01-04's formatter tests that assert against these slots will need either a richer synthetic fixture or a second probe against a denser public profile.

## Known Stubs

None. This plan delivers test infrastructure and data contracts only — no UI components, no runtime code paths. Nothing to stub.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes at trust boundaries introduced beyond what the plan's threat_model already covered (T-01-01 through T-01-04, all mitigated).

## User Setup Required

Apify account provisioning was completed by Isaac before this plan ran (per orchestrator `apify_already_provisioned` block). The only remaining manual action is:

**Fix `.env.local` line `APIFY_API_TOKEN`**: remove the `<` and `>` angle brackets from the token value. Verify with:
```bash
node -e "const t = require('fs').readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('APIFY_API_TOKEN=')).split('=').slice(1).join('=').trim(); console.log('valid:', t.startsWith('apify_api_') && t.length === 46)"
```
And verify the same in Vercel dashboard: Settings → Environment Variables → APIFY_API_TOKEN (all three scopes: production/preview/development).

## Next Phase Readiness

**Ready for Plan 01-03** (`01-apify-url-utils` — URL normalization + fingerprint hasher):
- Zod schemas importable from `@/lib/schemas/linkedin-profile` ✓
- Test runner ready for new `*.test.ts` files ✓
- i18n keys available for any error-path copy ✓
- `.env.example` documents the env vars URL-utils will read ✓

**Blockers for Plan 01-04 scraper client:**
- None formal. But the scraper client MUST use:
  - Input field name `queries` (not `profileUrls`)
  - Required field `profileScraperMode: "Profile details no email ($4 per 1k)"`
  - A defensive `.env` token sanitizer that strips `<...>` wrappers
  - The `.nullish()` drift-tolerant schema for parsing responses

**Ready for Plan 01-05+:**
- Parity test will block any i18n drift in future plans automatically
- Fixture files are the canonical test input for the formatter (Plan 01-04) and orchestrator integration (Plan 01-08)

## Self-Check: PASSED

Verification performed:
- `vitest.config.mts` exists ✓
- `src/lib/schemas/linkedin-profile.ts` exists and exports `scrapeLinkedinRequestSchema`, `harvestProfileSchema`, `HarvestProfile`, `ScrapeLinkedinRequest` ✓
- `src/lib/schemas/__tests__/linkedin-profile.test.ts` exists with 18 tests ✓
- `src/lib/i18n/__tests__/apify-keys-parity.test.ts` exists with 41 tests ✓
- All 3 fixture files exist and parse as valid JSON ✓
- `.env.example` exists and contains `APIFY_API_TOKEN`, `APIFY_FINGERPRINT_SALT`, `APIFY_ENABLED` ✓
- Commits `e01261c`, `ecf8bf2`, `ac4c7cb`, `656d9f4` exist in git log ✓
- `npx vitest run` passes 59/59 tests ✓
- `npm run build` passes with zero errors ✓

---
*Phase: 01-apify-linkedin-integration*
*Plan: 01 (apify-schema-foundation)*
*Completed: 2026-04-11*
