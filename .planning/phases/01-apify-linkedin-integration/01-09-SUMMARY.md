---
phase: 01-apify-linkedin-integration
plan: 09
subsystem: ui
tags: [input-page, linkedin-url, apify, ui, i18n, progress, hook]

# Dependency graph
requires:
  - phase: 01-07
    provides: "POST /api/scrape-linkedin endpoint"
  - phase: 01-08
    provides: "orchestrator accepts preparsedLinkedinSections, ProgressStage includes scraping_profile"
provides:
  - "LinkedinUrlPrimaryInput component — URL field with inline Zod validation + error banner"
  - "useLinkedinScrape hook — POST /api/scrape-linkedin with 8 error codes mapped to i18n keys"
  - "Restructured /input page — URL primary, CV/paste secondary via <details> toggle"
  - "GenerationProgress scraping_profile step — first stage in stageMap"
affects: [01-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "URL-first input with <details> toggle for legacy paths (paste/upload)"
    - "Client-side Zod validation reusing server schema for UX consistency"
    - "sessionStorage bridge for preparsedLinkedinSections (Plan 01-10 will formalize in AppContext)"
    - "Error code -> i18n key static lookup with generic fallback"

key-files:
  created:
    - src/hooks/useLinkedinScrape.ts
    - src/components/input/LinkedinUrlPrimaryInput.tsx
  modified:
    - src/app/input/page.tsx
    - src/components/ui/GenerationProgress.tsx
    - src/lib/i18n/en.json
    - src/lib/i18n/es.json

key-decisions:
  - "Profile markdown stored as linkedinText for immediate compatibility with existing generateResults flow"
  - "preparsedLinkedinSections stored in sessionStorage as bridge until Plan 01-10 adds to AppContext"
  - "Auto-navigate to /results after scrape success only when name + email already filled"
  - "Error banner shows recovery actions contextually: retry always, switchToCv always, upgrade only for quota exceeded"

patterns-established:
  - "URL-first input pattern with fallback toggle for alternative input methods"

requirements-completed: [REQ-01, REQ-03]

# Metrics
duration: 7min
completed: 2026-04-12
---

# Phase 01 Plan 09: Input Page Redesign + Scrape Hook + Progress Step

**LinkedIn URL is now the primary input on /input, with useLinkedinScrape hook driving POST /api/scrape-linkedin, 8 error codes mapped to i18n keys, and scraping_profile as first progress stage.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-12T03:28:34Z
- **Completed:** 2026-04-12T03:35:42Z
- **Tasks:** 3 completed / 4 total (Task 4 is pending human-verify checkpoint)
- **Files created:** 2
- **Files modified:** 4

## Accomplishments

- **useLinkedinScrape hook** (`src/hooks/useLinkedinScrape.ts`): Client hook that calls `POST /api/scrape-linkedin`, maps all 8 `ApifyScrapeError` codes (APIFY_INVALID_URL, APIFY_PROFILE_PRIVATE, APIFY_RATE_LIMITED, APIFY_CIRCUIT_OPEN, APIFY_DOWNTIME, APIFY_QUOTA_EXCEEDED, APIFY_SCRAPE_FAILED, APIFY_DISABLED, APIFY_TOKEN_MISSING) to i18n keys via static lookup. Includes client-side Zod pre-validation using `scrapeLinkedinRequestSchema`.

- **LinkedinUrlPrimaryInput component** (`src/components/input/LinkedinUrlPrimaryInput.tsx`): URL input field with inline validation on blur, submit button with loading spinner, error banner with contextual recovery actions (retry, switch to CV, upgrade for quota exceeded). Uses CSS variables exclusively -- zero raw Tailwind color classes.

- **Input page restructured** (`src/app/input/page.tsx`): Primary UI is now the LinkedIn URL field. Existing LinkedIn paste + CV upload + Job Description sections demoted into a `<details>` toggle labeled via `input.useCvAlternativeTitle` i18n key. All three input paths remain fully functional. After successful scrape, profile is converted via `profileToMarkdown` to `linkedinText` and `profileToSectionRecord` to `sessionStorage` for Plan 01-10 AppContext integration.

- **GenerationProgress updated** (`src/components/ui/GenerationProgress.tsx`): `scraping_profile` added as first entry in `stageMap`, mapped to `progress.stageScraping` i18n key ("Analyzing your LinkedIn profile..." / "Analizando tu perfil de LinkedIn..."). All existing stages preserved unchanged.

- **i18n keys added**: `input.analyze` and `input.analyzing` added to both en.json and es.json. All other required keys (linkedinUrlPrimaryLabel, linkedinUrlHelp, linkedinUrlPlaceholder, useCvAlternativeTitle, progress.stageScraping, apify.error.*, apify.actions.*) were already present from Plan 01-01.

## Task Commits

1. **Task 1: Create useLinkedinScrape hook + LinkedinUrlPrimaryInput component** -- `55a0e2c` (feat)
2. **Task 2: Restructure /input page — URL primary, CV secondary toggle** -- `423773b` (feat)
3. **Task 3: Add scraping_profile step to GenerationProgress stageMap** -- `b23d683` (feat)

## Task 4: CHECKPOINT -- PENDING

**Status:** Awaiting manual UI smoke test by Isaac.

**What was built:** Tasks 1-3 built the primary URL input, the useLinkedinScrape hook, restructured the input page with CV/paste as secondary `<details>` toggle, and added the scraping_profile progress step.

**How to verify:**
1. `npm run dev` and visit http://localhost:3000/input
2. Confirm primary UI is LinkedIn URL field (not paste/upload)
3. Confirm `<details>` toggle shows "Prefer to upload your CV instead?" and expands to reveal existing CV upload
4. Enter invalid URL (`https://google.com/in/foo`) -- confirm inline validation error on blur
5. Enter valid URL (`https://linkedin.com/in/isaacgbc`) -- confirm submit button enables
6. Switch to ES locale -- confirm labels change (placeholder, helper text, details toggle)
7. Test error states: invalid URL, quota exceeded, private profile, downtime
8. Open `<details>`, upload a CV PDF -- confirm audit runs end-to-end (regression check)
9. Check browser devtools for console errors and CSS variable resolution

## Files Created/Modified

**Created:**
- `src/hooks/useLinkedinScrape.ts` -- Client hook: triggerScrape(url) + 8 error codes -> i18n mapping + quota state
- `src/components/input/LinkedinUrlPrimaryInput.tsx` -- URL input + validation + error banner + recovery actions

**Modified:**
- `src/app/input/page.tsx` -- Restructured: URL primary, existing inputs in `<details>` toggle
- `src/components/ui/GenerationProgress.tsx` -- scraping_profile added as first stageMap entry
- `src/lib/i18n/en.json` -- Added input.analyze, input.analyzing keys
- `src/lib/i18n/es.json` -- Added input.analyze ("Analizar"), input.analyzing ("Analizando...")

## Decisions Made

1. **Markdown bridge for existing flow**: After scrape succeeds, `profileToMarkdown(profile)` output is stored as `linkedinText` in AppContext via `setUserInput`. This ensures the existing `generateResults` flow works without AppContext modifications (which are Plan 01-10's scope).
2. **sessionStorage for preparsed sections**: `profileToSectionRecord(profile)` output stored in `sessionStorage` under `__ps_preparsedLinkedinSections`. Plan 01-10 will read this and wire it into the AppContext `generateResults` payload as `preparsedLinkedinSections`.
3. **Auto-navigate on scrape success**: Only when `hasName && hasEmail` are already satisfied. Otherwise, user fills remaining fields then clicks Continue normally.
4. **Contextual recovery actions**: Error banner shows "Try again" and "Upload CV instead" for all errors. "Upgrade plan" link to `/pricing` shown only for `APIFY_QUOTA_EXCEEDED`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] trackEvent payload type mismatch**
- **Found during:** Task 2 (build verification)
- **Issue:** `trackEvent("scrape_linkedin_success", { source: "apify" })` failed TypeScript -- `TrackPayload` does not have a `source` field.
- **Fix:** Changed to `trackEvent("scrape_linkedin_success", { sourceType: "linkedin", metadata: { profileSource: "apify" } })` using valid `TrackPayload` fields.
- **Files modified:** `src/app/input/page.tsx`
- **Committed in:** `423773b` (Task 2 commit)

**2. [Rule 2 - Missing critical functionality] i18n keys for analyze/analyzing buttons**
- **Found during:** Task 1 (component creation)
- **Issue:** The LinkedinUrlPrimaryInput submit button needs "Analyze" / "Analyzing..." labels, but these keys didn't exist in en.json/es.json.
- **Fix:** Added `input.analyze` ("Analyze" / "Analizar") and `input.analyzing` ("Analyzing..." / "Analizando...") to both locale files.
- **Files modified:** `src/lib/i18n/en.json`, `src/lib/i18n/es.json`
- **Committed in:** `55a0e2c` (Task 1 commit)

## Known Stubs

None. All changes are fully wired to production code paths. The sessionStorage bridge is intentional interim storage until Plan 01-10 formalizes AppContext state.

## Threat Flags

None. No new network endpoints created. Client-side Zod validation is UX-only (security enforcement at `/api/scrape-linkedin` server route per Plan 01-07). Error code lookup is a static map -- unknown codes fall through to generic. No `dangerouslySetInnerHTML` used on any scraped data.

## Self-Check: PASSED

All files exist, all 3 commits verified (55a0e2c, 423773b, b23d683), `npm run build` exits 0, all i18n keys present in both en.json and es.json, zero raw Tailwind color classes in new components.
