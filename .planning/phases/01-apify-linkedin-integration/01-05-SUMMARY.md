---
phase: 01-apify-linkedin-integration
plan: 05
subsystem: services
tags: [formatter, apify, harvestapi, linkedin, markdown, typescript, pure-function]

# Dependency graph
requires:
  - phase: 01-apify-linkedin-integration/01-01
    provides: "HarvestProfile Zod schema, real Bill Gates fixture, minimal fixture"
provides:
  - "profileToSectionRecord() — converts HarvestProfile to Record<string, string> matching orchestrator Stage 2 section keys"
  - "profileToMarkdown() — produces compact Markdown for Claude prompt injection (D-17, D-18)"
  - "HarvestProfile + ScrapeLinkedinRequest re-exported from types/index.ts"
  - "ApifyScrapeError, LinkedinProfileSource, ApifyQuotaState types in types/index.ts"
affects: [01-08, 01-09, 01-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure TypeScript formatter pattern — no DB, no server-only imports, importable from client components"
    - "Field drift tolerance via `pick()` helper that checks multiple field name aliases in priority order"
    - "Recommendation capping via MAX_RECOMMENDATIONS constant (D-18 compliance)"
    - "Section omission pattern — missing/empty sections excluded from record, not set to empty string"

key-files:
  created:
    - "src/lib/services/linkedin-profile-formatter.ts"
    - "src/lib/services/__tests__/linkedin-profile-formatter.test.ts"
  modified:
    - "src/lib/types/index.ts (appended Apify type re-exports)"

key-decisions:
  - "Section record keys match LINKEDIN_SECTION_IDS from linkedin-parser.ts (headline, summary, experience, skills, education, featured, recommendations, certifications) plus extended sections (projects, publications, honors, volunteer) from the parser's header regex mapping"
  - "Field `about` maps to key `summary` to match orchestrator's existing section ID contract"
  - "Field `volunteering` maps to key `volunteer` to match parser's header regex ID"
  - "Education period field ' - ' (empty date range) is filtered out to avoid showing '(-)' in formatted output"
  - "topSkills array elements cast to unknown before type narrowing to work around Zod's passthrough object type narrowing"

patterns-established:
  - "Pattern: pick() helper for actor field drift — checks multiple aliases in priority order, trims whitespace, returns empty string on miss"
  - "Pattern: getRecommendations/getHonors helpers for cross-field-name resolution (recommendations vs receivedRecommendations, honors vs honorsAndAwards)"

requirements-completed: [REQ-02]

# Metrics
duration: 7min
completed: 2026-04-12
---

# Phase 01 Plan 05: LinkedIn Profile Formatter Summary

**Pure TypeScript formatter converting Apify HarvestProfile JSON into orchestrator-compatible section records and compact Markdown for Claude prompt injection, with field drift tolerance and D-18 recommendation capping.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-12T02:41:00Z
- **Completed:** 2026-04-12T02:48:00Z
- **Tasks:** 2 (1 TDD auto + 1 auto)
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- **profileToSectionRecord()**: Converts HarvestProfile to `Record<string, string>` with keys matching the orchestrator's Stage 2 section ID contract. Enables Strategy A — bypass regex parsing AND LLM structuring entirely for Apify-sourced profiles.
- **profileToMarkdown()**: Produces compact Markdown representation with `# headline`, `## About`, `## Experience` with `### title -- company (dateRange)` sub-headers, plus education, skills (with endorsement counts), certifications, recommendations (first 3), projects, publications, honors, and volunteering sections.
- **Field drift tolerance**: `pick()` helper function checks multiple field name aliases in priority order (position/title, company/companyName, dateRange/duration) and trims whitespace.
- **Type re-exports**: HarvestProfile, ScrapeLinkedinRequest, ApifyScrapeError, LinkedinProfileSource, and ApifyQuotaState all available from `@/lib/types`.

## Section IDs Used as Keys in profileToSectionRecord

From `LINKEDIN_SECTION_IDS` in `linkedin-parser.ts` (line 289):
- `headline`, `summary`, `experience`, `skills`, `education`, `featured`, `recommendations`, `certifications`

Extended sections (from parser's header regex mapping, lines 37-40):
- `projects`, `publications`, `honors`, `volunteer`

Key mapping notes:
- Apify `about` field maps to `summary` key
- Apify `volunteering` field maps to `volunteer` key
- Apify `receivedRecommendations` field is checked alongside `recommendations`
- Apify `honorsAndAwards` field is checked alongside `honors`

## Task Commits

1. **Task 1: Create linkedin-profile-formatter.ts with both functions (TDD)** -- `177b6b9` (feat)
2. **Task 2: Re-export HarvestProfile from types/index.ts** -- `3bfdc97` (feat)

## Files Created/Modified

**Created:**
- `src/lib/services/linkedin-profile-formatter.ts` -- profileToSectionRecord + profileToMarkdown with 10 private helper functions (~350 lines)
- `src/lib/services/__tests__/linkedin-profile-formatter.test.ts` -- 15 vitest tests covering full/minimal/empty profiles and field drift

**Modified:**
- `src/lib/types/index.ts` -- Appended Apify type re-exports (HarvestProfile, ScrapeLinkedinRequest, ApifyScrapeError, LinkedinProfileSource, ApifyQuotaState)

## Decisions Made

1. **Extended section keys beyond LINKEDIN_SECTION_IDS**: The `LINKEDIN_SECTION_IDS` constant only has 8 entries, but the parser's header regex mapping (lines 37-40) also recognizes projects, publications, honors, and volunteer. The formatter includes all 12 keys so Apify-sourced profiles can provide richer data than paste-text profiles.
2. **Education period " - " filtering**: The real Bill Gates fixture has `period: " - "` for Lakeside School (no dates). After `pick()` trims this to `"-"`, we filter it out to avoid showing `(-)` in formatted output.
3. **topSkills type narrowing**: The Zod schema types `topSkills` elements as `z.object({}).passthrough()` (type `{}`), which prevents TypeScript from narrowing via `typeof s === "string"`. Solved by assigning to `unknown` before type checking.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Trailing whitespace in fixture company names broke toContain assertions**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** The Bill Gates fixture has `"companyName": "Breakthrough Energy "` with a trailing space. The formatter's `pick()` correctly trims this, but the test assertions used raw fixture values for `toContain` checks, causing false failures.
- **Fix:** Updated tests 4 and 10 to `.trim()` expected values from fixture entries before asserting.
- **Files modified:** `src/lib/services/__tests__/linkedin-profile-formatter.test.ts`
- **Verification:** All 15 tests pass
- **Committed in:** `177b6b9` (Task 1 commit)

**2. [Rule 1 - Bug] TypeScript type error: topSkills `{}` type cannot narrow to string**
- **Found during:** Task 1 (build verification)
- **Issue:** `npm run build` failed with `Property 'trim' does not exist on type 'never'`. The Zod schema's `.passthrough()` object types narrows to `never` after a `typeof === "string"` check because `{}` doesn't include `string`.
- **Fix:** Cast each `topSkills` element to `unknown` before type narrowing: `const s: unknown = rawSkill;`
- **Files modified:** `src/lib/services/linkedin-profile-formatter.ts`
- **Verification:** `npm run build` exits 0
- **Committed in:** `177b6b9` (Task 1 commit)

**3. [Rule 1 - Bug] Education date range " - " renders as "(-)" in formatted output**
- **Found during:** Task 1 (visual inspection of markdown output)
- **Issue:** Lakeside School in the fixture has `period: " - "` (empty date range). After trimming to `"-"`, the condition `dateRange !== " - "` no longer catches it, resulting in `Lakeside School (-)` in the output.
- **Fix:** Added `dateRange !== "-"` to the filter condition alongside the existing `dateRange !== " - "` check.
- **Files modified:** `src/lib/services/linkedin-profile-formatter.ts`
- **Verification:** Education output for Lakeside School shows `Lakeside School` without the `(-)` suffix
- **Committed in:** `177b6b9` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All fixes necessary for correctness. No scope creep. The trailing-space and type-narrowing issues are fixture/schema quirks; the education filter is a real-world data quality guard.

## Field Drift Quirks Discovered in Sample Fixture

1. **`position` not `title`**: Bill Gates fixture uses `position` for role names (e.g., `"position": "Co-chair"`). The `title` field is absent.
2. **`companyName` not `company`**: Fixture uses `companyName` (e.g., `"companyName": "Gates Foundation"`). The `company` field is absent.
3. **`duration: null`**: All experience entries have `duration: null` (explicit null, not undefined).
4. **Trailing whitespace**: `"companyName": "Breakthrough Energy "` has a trailing space.
5. **`period` for education dates**: Education uses `period` (e.g., `"period": "1973 - 1975"`) not `dateRange`.
6. **Empty-date period**: `"period": " - "` for institutions without dates.
7. **`receivedRecommendations` not `recommendations`**: Actor uses different field name for recommendations (empty array in this fixture).
8. **`honorsAndAwards` not `honors`**: Actor uses different field name for honors (empty array in this fixture).
9. **`featured: null`**: Featured is null, not an empty array.
10. **`topSkills: null`**: topSkills is null, not an empty array.

## Issues Encountered

- **Working-tree staging hygiene**: Isaac's working tree has extensive pre-existing uncommitted edits in `src/lib/types/index.ts`. Task 2 used the checkout-clean-append-restore pattern (same as Plan 01-01 Task 3) to commit only the Apify type additions without sweeping Isaac's unrelated changes into the commit.

## Known Stubs

None. The formatter is a pure data transformation layer with no UI rendering or placeholder data.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes at trust boundaries. The formatter is a pure function operating on in-memory data only. T-05-02 (malformed actor output) is mitigated by optional chaining and empty-return guards throughout all helpers. T-05-04 (recommendation PII) is mitigated by MAX_RECOMMENDATIONS = 3.

## Next Phase Readiness

**Ready for Plan 01-08** (Orchestrator Integration):
- `profileToSectionRecord()` ready to feed `preparsedLinkedinSections` in orchestrator Stage 2
- `profileToMarkdown()` ready to feed new `audit.linkedin.system.apify` prompt
- Section keys verified against `LINKEDIN_SECTION_IDS` + extended parser sections

**Ready for Plan 01-09+:**
- HarvestProfile and Apify error types importable from `@/lib/types`
- LinkedinProfileSource type available for orchestrator's source tracking

## Self-Check: PASSED

Verification performed:
- `src/lib/services/linkedin-profile-formatter.ts` exists and exports `profileToSectionRecord` + `profileToMarkdown`
- `src/lib/services/__tests__/linkedin-profile-formatter.test.ts` exists with 15 tests
- `src/lib/types/index.ts` contains HarvestProfile re-export + ApifyScrapeError + LinkedinProfileSource + ApifyQuotaState
- Commits `177b6b9` (Task 1) and `3bfdc97` (Task 2) exist in git log
- `npx vitest run` passes 15/15 tests
- `npm run build` passes with zero errors

---
*Phase: 01-apify-linkedin-integration*
*Plan: 05 (linkedin-profile-formatter)*
*Completed: 2026-04-12*
