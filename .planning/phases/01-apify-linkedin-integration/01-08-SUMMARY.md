---
phase: 01-apify-linkedin-integration
plan: 08
subsystem: orchestrator
tags: [orchestrator, apify, stage2-bypass, prompt-registry, integration, cache-key]

# Dependency graph
requires:
  - phase: 01-apify-linkedin-integration/01-02
    provides: "Prisma schema with Apify models"
  - phase: 01-apify-linkedin-integration/01-05
    provides: "profileToSectionRecord + profileToMarkdown formatter"
provides:
  - "AuditInput.preparsedLinkedinSections field — orchestrator accepts pre-parsed sections"
  - "AuditInput.linkedinProfileSource field — tracks paste/apify/pdf source"
  - "ProgressStage.scraping_profile — new progress stage for UI (Plan 01-09)"
  - "Stage 2 bypass — skips regex parser + LLM structurer when preparsed sections provided"
  - "Preflight apify prompt selection with graceful fallback to base keys"
  - "Cache key fingerprint includes preparsed section content"
  - "4 new PromptRegistry rows (audit.linkedin.system.apify + rewrite.linkedin.section.apify, EN+ES)"
  - "GenerateAuditInput Zod schema extended for API route passthrough"
affects: [01-09, 01-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strategy A bypass: preparsedLinkedinSections short-circuits Stage 2 entirely"
    - "Graceful prompt fallback: apify variant -> base key if apify not in registry"
    - "Cache key composition: sorted JSON serialization of preparsed sections for deterministic hashing"

key-files:
  created:
    - "src/lib/services/__tests__/orchestrator-apify-path.test.ts"
  modified:
    - "src/lib/services/audit-orchestrator.ts"
    - "src/app/api/audit/generate/shared.ts"
    - "src/app/api/audit/generate/route.ts"
    - "src/app/api/audit/stream/route.ts"
    - "prisma/seed.ts"

key-decisions:
  - "Stage 2 bypass uses if/else-if chain (not separate function) to minimize diff and maintain variable scope"
  - "Cache key uses sorted JSON serialization of preparsed sections rather than a separate hash field"
  - "Preflight fallback is inline in the for-loop (not a separate helper) for simplicity"
  - "hasLinkedinInput coerced to boolean explicitly to satisfy validateSectionCompleteness type constraint"
  - "hasPreparsed check added to shared.ts minimum input validation so apify path works with empty linkedinText"

patterns-established:
  - "Pattern: apify prompt key naming convention — base key + '.apify' suffix"
  - "Pattern: graceful prompt fallback via .replace(/\\.apify$/, '') in preflight loop"

requirements-completed: [REQ-01, REQ-02]

# Metrics
duration: 11min
completed: 2026-04-12
---

# Phase 01 Plan 08: Orchestrator Apify Integration Summary

**Strategy A Stage 2 bypass wired into 11-stage orchestrator with cache key fingerprinting, apify prompt variant selection with graceful fallback, and 4 new PromptRegistry rows seeded for structured LinkedIn analysis.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-04-12T02:59:54Z
- **Completed:** 2026-04-12T03:11:10Z
- **Tasks:** 4 (3 auto + 1 TDD auto)
- **Files created:** 1
- **Files modified:** 5

## Accomplishments

- **AuditInput extended**: Added `preparsedLinkedinSections?: Record<string, string>` (line 276) and `linkedinProfileSource?: "paste" | "apify" | "pdf"` (line 278) to the orchestrator's input interface.
- **ProgressStage extended**: Added `"scraping_profile"` to the union (line 203), positioned first conceptually since it runs before Stage 2.
- **GenerateAuditInput Zod schema**: Extended with `preparsedLinkedinSections` (z.record) and `linkedinProfileSource` (z.enum) optional fields in shared.ts.
- **Route passthrough**: Both `/api/audit/generate` and `/api/audit/stream` routes now pass the new fields through to `generateAuditResults()`.
- **Minimum input validation**: Added `hasPreparsed` check in shared.ts so the apify path works when `linkedinText` is empty.
- **Stage 2 bypass** (lines 2558-2568): When `preparsedLinkedinSections` is provided with at least one key, the orchestrator uses those sections directly, setting `structuringUsed=true` and `structuringDurationMs=0`. The existing paste-text path (regex + optional LLM structuring) is completely preserved in the `else if` branch.
- **Cache key fingerprint** (lines 2390-2401): When preparsed sections are present, their content is serialized as sorted JSON key-value pairs and used as the `linkedinText` input to `computeInputHash()`. This ensures different profiles produce different cache keys.
- **Preflight prompt selection** (lines 2488-2521): When `linkedinProfileSource === "apify"`, the preflight checks `audit.linkedin.system.apify` and `rewrite.linkedin.section.apify` first. If the apify variant returns null from the prompt resolver, it falls back to the base key (e.g., `audit.linkedin.system`). This fallback is logged for diagnostics.
- **4 PromptRegistry rows seeded**: `audit.linkedin.system.apify` (EN+ES) and `rewrite.linkedin.section.apify` (EN+ES), all version 1, status=active. These leverage endorsement counts, recommendation tone, certification details, and full experience timeline.

## Patch Locations in audit-orchestrator.ts

| Patch | Lines | Description |
|-------|-------|-------------|
| ProgressStage | 203 | Added `"scraping_profile"` to union |
| AuditInput | 276-278 | Added `preparsedLinkedinSections` + `linkedinProfileSource` |
| Cache key | 2390-2401 | Sorted JSON serialization of preparsed sections for hash |
| hasLinkedinInput | 2479-2484 | Now includes preparsed sections check |
| Preflight | 2488-2521 | Apify prompt variant selection with fallback |
| Stage 2 bypass | 2558-2568 | Preparsed sections branch before existing paste path |

## Task Commits

1. **Task 1: Extend AuditInput + shared.ts + routes** -- `d210313` (feat)
2. **Task 2: Stage 2 bypass + cache key + preflight** -- `e9057d6` (feat)
3. **Task 3: Integration tests (6 tests)** -- `a2aa7b6` (test)
4. **Task 4: Seed 4 PromptRegistry rows** -- `2b2e975` (feat)

## Files Created/Modified

**Created:**
- `src/lib/services/__tests__/orchestrator-apify-path.test.ts` -- 6 vitest integration tests (~416 lines)

**Modified:**
- `src/lib/services/audit-orchestrator.ts` -- Stage 2 bypass, cache key, preflight, AuditInput, ProgressStage
- `src/app/api/audit/generate/shared.ts` -- Zod schema + hasPreparsed validation
- `src/app/api/audit/generate/route.ts` -- Passthrough of new fields
- `src/app/api/audit/stream/route.ts` -- Passthrough of new fields
- `prisma/seed.ts` -- 4 new prompt entries

## Decisions Made

1. **Stage 2 bypass as if/else-if chain**: The bypass is implemented as a new `if` branch preceding the existing `else if (input.linkedinText.trim())`, preserving all local variable names and scope. This is the minimal-diff approach per Strategy A.
2. **Cache key composition**: Used sorted JSON serialization of preparsed sections as the `linkedinText` parameter to `computeInputHash()` rather than adding a new field to the hash function. This avoids modifying `result-cache.ts`.
3. **Inline preflight fallback**: The apify-to-base-key fallback is handled inline in the preflight for-loop using `key.replace(/\.apify$/, '')`. No separate helper function was needed.
4. **hasLinkedinInput type annotation**: Added explicit `: boolean` type annotation to fix TypeScript error where `undefined | boolean` was not assignable to `boolean` parameter of `validateSectionCompleteness`.
5. **hasPreparsed check in shared.ts**: Added to the minimum input validation so the apify path doesn't reject requests where `linkedinText` is empty but `preparsedLinkedinSections` has content.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] hasLinkedinInput type error: boolean | undefined not assignable to boolean**
- **Found during:** Task 2 (build verification)
- **Issue:** `npm run build` failed with TypeScript error at line 2876: `validateSectionCompleteness` expects `boolean` but `hasLinkedinInput` was `boolean | undefined` due to `&&` short-circuit evaluation.
- **Fix:** Added `!!()` wrapper and explicit `: boolean` type annotation.
- **Files modified:** `src/lib/services/audit-orchestrator.ts`
- **Verification:** `npm run build` exits 0
- **Committed in:** `e9057d6` (Task 2 commit)

**2. [Rule 2 - Missing critical functionality] Stream route missing new field passthrough**
- **Found during:** Task 1 (code review)
- **Issue:** The plan only mentioned `route.ts` but `stream/route.ts` also calls `generateAuditResults()` with the same input shape. Without the passthrough, the streaming endpoint would silently drop `preparsedLinkedinSections` and `linkedinProfileSource`.
- **Fix:** Added the same two field passthroughs to `src/app/api/audit/stream/route.ts`.
- **Files modified:** `src/app/api/audit/stream/route.ts`
- **Verification:** `npm run build` exits 0
- **Committed in:** `d210313` (Task 1 commit)

**3. [Rule 2 - Missing critical functionality] Minimum input validation rejects apify-only requests**
- **Found during:** Task 1 (code review)
- **Issue:** `shared.ts` validates that either `linkedinText` or `cvText` meets minimum input threshold. For the apify path, `linkedinText` is empty (sections come via `preparsedLinkedinSections`), so the request would be rejected with 400.
- **Fix:** Added `hasPreparsed` check: when `preparsedLinkedinSections` has keys, bypass the minimum text length requirement.
- **Files modified:** `src/app/api/audit/generate/shared.ts`
- **Verification:** `npm run build` exits 0
- **Committed in:** `d210313` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing critical functionality)
**Impact on plan:** All fixes necessary for correctness. The stream route and input validation fixes prevent the apify path from failing at runtime.

## Stages 3-11 Diff Verification

Confirmed zero changes to stages 3-11. The diff is limited to:
- Lines 173-278 (types/interfaces at file top)
- Lines 2390-2401 (cache key computation)
- Lines 2477-2521 (preflight prompt selection)
- Lines 2554-2568 (Stage 2 bypass branch)

All scoring, rewriting, entry parsing, cover letter, plan locking, and cache storage logic is byte-identical to pre-patch state.

## Test Results

- **6 orchestrator integration tests**: All passing
- **143 total tests**: All passing across 9 test files
- **Test coverage**: Stage 2 bypass, structuringUsed metadata, paste regression, apify prompt resolution, prompt fallback, cache key differentiation

## Known Stubs

None. All changes are fully wired to production code paths.

## Threat Flags

None. No new network endpoints created. The preparsedLinkedinSections field is server-side trusted data (produced by our own formatter from Apify scrape results). Cache key fingerprinting mitigates T-08-02 (cache poisoning). Prompt fallback mitigates T-08-04 (cascading failure when apify prompt missing).

## Self-Check: PASSED

Verification performed:
- `src/lib/services/__tests__/orchestrator-apify-path.test.ts` exists with 6 tests
- `grep -c "preparsedLinkedinSections" src/lib/services/audit-orchestrator.ts` returns 10
- `grep -q "audit.linkedin.system.apify" src/lib/services/audit-orchestrator.ts` succeeds
- `grep -q "audit.linkedin.system.apify" prisma/seed.ts` succeeds
- Commits d210313, e9057d6, a2aa7b6, 2b2e975 exist in git log
- `npx vitest run` passes 143/143 tests
- `npm run build` passes with zero errors
- `npm run db:seed` exits 0 with 4 new rows created

---
*Phase: 01-apify-linkedin-integration*
*Plan: 08 (orchestrator-apify-integration)*
*Completed: 2026-04-12*
