# Roadmap: ProfileScore.io

## Overview

ProfileScore.io v1 shipped with LinkedIn-paste and CV-upload audit flows, full Creala payment integration, PDF/DOCX exports, bilingual i18n, and an admin console. The current milestone (v1.1) is a single large phase that replaces manual LinkedIn paste with automatic Apify-based scraping, enabling far richer analysis by feeding structured profile data to Claude instead of user-pasted text.

## Milestone: v1.1 — Apify LinkedIn Integration

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Apify LinkedIn Integration** - Replace manual LinkedIn paste with Apify-scraped structured profile data, enhanced analysis, new UX, and tiered cost tracking

## Phase Details

### Phase 1: Apify LinkedIn Integration
**Goal**: Replace the "paste your LinkedIn URL" manual flow with automatic Apify-driven LinkedIn scraping, feed structured profile data to Claude for richer analysis, update the UX to show a scraping loading state, and track usage per user against free/paid tier quotas.

**Depends on**: Nothing (first GSD-tracked phase; builds on existing v1 codebase)

**Requirements**: REQ-01, REQ-02, REQ-03, REQ-04

**Success Criteria** (what must be TRUE):
  1. A user can enter their LinkedIn URL on the landing page and the system automatically scrapes the profile via Apify (no manual paste required)
  2. The structured profile data (experience, education, skills, recommendations, headline, about, certifications) is fed to Claude and produces a visibly richer audit than the v1 paste flow
  3. The existing CV upload flow remains functional and selectable as an alternative
  4. Scraped profiles are cached in the database with a 24-hour TTL — identical URLs within 24h do not re-scrape
  5. Free-tier users get 1 Apify scrape; Starter ($5) and Recommended ($10) users get unlimited scrapes; remaining scrape count is visible on the user dashboard
  6. Failure modes (private profile, invalid URL, Apify rate limit, Apify downtime) show localized (EN/ES) error messages and never silently produce fake data
  7. Output of the audit remains bilingual (EN/ES) and matches the user's detected locale
  8. `npm run build` passes with zero errors and no new TypeScript warnings
  9. Creala payment integration is untouched

**Workstreams** (subagents from the original brief):
  - **WS1 — Apify Integration**: install `apify-client`, create `/api/scrape-linkedin` route, structured JSON output, error handling, 24h Supabase cache
  - **WS2 — Enhanced Analysis Prompts**: update prompt-registry prompts to consume structured LinkedIn data, richer report output, keep Spanish output
  - **WS3 — UX Flow Update**: landing page URL input, "Analizando tu perfil de LinkedIn..." loading state, enhanced results page, CV upload preserved as alternative
  - **WS4 — Cost Management**: per-user Apify usage tracking in Supabase, tier-based quotas, dashboard remaining-scrapes display

**Plans**: 11 plans across 7 waves

Plans:
- [x] 01-01-PLAN.md (wave 0) — Test infra (vitest) + Zod schemas + i18n keys EN/ES + 3 fixtures + env vars
- [x] 01-02-PLAN.md (wave 0) — Prisma schema: 3 new models (LinkedInProfileCache, AnonymousApifyUsage, ApifyUsageLog) + 3 User fields + BLOCKING db push
- [x] 01-03-PLAN.md (wave 1) — URL normalizer + cache service (24h TTL) + fingerprint hasher + Prisma mock
- [x] 01-04-PLAN.md (wave 1) — apify-client install + scraper service with circuit breaker + dedicated rate limiter (3/min)
- [x] 01-05-PLAN.md (wave 1) — LinkedIn profile formatter (JSON → section record + markdown) + HarvestProfile type re-export
- [x] 01-06-PLAN.md (wave 2) — Apify quota service: free/paid/anon checks + consume + getQuotaState + usage log
- [x] 01-08-PLAN.md (wave 2) — Orchestrator Stage 2 bypass (preparsedLinkedinSections) + preflight apify prompt variants + seed 4 new PromptRegistry rows
- [x] 01-07-PLAN.md (wave 3) — POST /api/scrape-linkedin route (maxDuration=60) + Creala webhook 1-line quota reset + regression tests
- [x] 01-09-PLAN.md (wave 4) — LinkedinUrlPrimaryInput component + /input page redesign + GenerationProgress scraping step + useLinkedinScrape hook
- [x] 01-10-PLAN.md (wave 5) — AppContext apify state + ApifyQuotaChip component on /results
- [x] 01-11-PLAN.md (wave 6) — End-to-end integration test + manual smoke checkpoint covering all 9 success criteria
