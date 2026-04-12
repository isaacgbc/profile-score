---
phase: 01-apify-linkedin-integration
plan: 02
subsystem: database
tags: [prisma, postgres, supabase, schema, apify, linkedin, cache, quota]

requires:
  - phase: 01-apify-linkedin-integration
    provides: "01-01 research baseline + locked decisions D-08..D-12 on schema shape"
provides:
  - "LinkedInProfileCache model (24h TTL cache for scraped profiles, keyed on unique normalized URL)"
  - "AnonymousApifyUsage model (fingerprint-keyed free-tier quota tracker)"
  - "ApifyUsageLog model (append-only cost + error audit log)"
  - "User model extended with apifyScrapeCount, apifyScrapeQuota (null = unlimited), apifyFirstScrapeAt"
  - "Database in sync with Supabase; regenerated Prisma client exposing linkedInProfileCache, anonymousApifyUsage, apifyUsageLog delegates"
affects:
  - "01-03 (apify cache service — consumes LinkedInProfileCache delegate)"
  - "01-04 (apify quota service — consumes User quota fields + AnonymousApifyUsage)"
  - "01-05 (apify scraper client — writes ApifyUsageLog entries)"
  - "01-06 (/api/scrape-linkedin route — depends on all 3 new models)"
  - "01-07 (orchestrator integration — reads cache, increments counters)"
  - "All downstream Wave 1 plans (schema types are the compile-time contract)"

tech-stack:
  added: []
  patterns:
    - "Decimal(10,6) precision for sub-cent cost accounting (vs Float pattern used by Order.price)"
    - "Append-only audit log pattern (ApifyUsageLog) — no updates, only inserts"
    - "Nullable quota semantics: null = unlimited, integer = remaining allotment"

key-files:
  created: []
  modified:
    - "prisma/schema.prisma — +3 models, +3 User fields, +45 LOC net"

key-decisions:
  - "Decimal(10,6) for costUsd instead of Float — sub-cent precision across thousands of scrapes"
  - "No foreign key from User → AnonymousApifyUsage/ApifyUsageLog — anonymous tracking decoupled from user identity"
  - "urlHash (SHA-256) indexed separately from url unique constraint — fast equality lookups without string comparison overhead"
  - "expiresAt field + index on LinkedInProfileCache — application-layer 24h TTL enforcement (no Postgres TTL)"

patterns-established:
  - "Decimal precision for cost accounting: @db.Decimal(10, 6)"
  - "Append-only audit log: status/error columns, no updatedAt, indexed on userId/createdAt/errorCode"
  - "Fingerprint-as-primary-key pattern for anonymous quota tracking"

requirements-completed:
  - REQ-01
  - REQ-04

duration: ~2min
completed: 2026-04-11
---

# Phase 01 Plan 02: Apify Schema Foundation Summary

**3 new Prisma models (LinkedInProfileCache, AnonymousApifyUsage, ApifyUsageLog) + 3 User quota fields, synced to Supabase with regenerated typed client — unblocks all of Wave 1.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-12T01:59:21Z
- **Completed:** 2026-04-12T02:01:26Z
- **Tasks:** 2
- **Files modified:** 1 (prisma/schema.prisma)

## Accomplishments

- `LinkedInProfileCache` table created: id, url (unique), urlHash, profileData (Json), scrapedAt, expiresAt, apifyRunId, costUsd (Decimal 10,6 default 0.004). Indexed on urlHash + expiresAt.
- `AnonymousApifyUsage` table created: id, fingerprintHash (unique), scrapeCount, firstScrapeAt, lastScrapeAt, createdAt, updatedAt.
- `ApifyUsageLog` table created: id, userId, fingerprintHash, url, urlHash, cacheHit, apifyRunId, costUsd, success, errorCode, durationMs, createdAt. Indexed on userId, createdAt, cacheHit, success, errorCode.
- `User` model extended with `apifyScrapeCount Int @default(0)`, `apifyScrapeQuota Int?` (null = unlimited), `apifyFirstScrapeAt DateTime?`.
- Database synced via `npm run db:push` — purely additive, no drops, no data loss.
- Prisma client regenerated; `prisma.linkedInProfileCache`, `prisma.anonymousApifyUsage`, `prisma.apifyUsageLog` delegates confirmed present.
- Full `npm run build` green (48 routes, zero TS errors) — types are usable across the codebase.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend User model + append 3 new models to schema.prisma** — `be09533` (feat)
2. **Task 2: [BLOCKING] Push schema to database + regenerate Prisma client** — `f78cf38` (chore)

## Files Created/Modified

- `prisma/schema.prisma` — Added 3 models (LinkedInProfileCache, AnonymousApifyUsage, ApifyUsageLog) + 3 User fields (apifyScrapeCount, apifyScrapeQuota, apifyFirstScrapeAt). Existing models untouched except whitespace reformatting by `prisma format`.

## Command Output (db:push)

```
> profile-score@0.1.0 db:push
> npx dotenv-cli -e .env.local --override -- prisma db push

Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-1-us-east-2.pooler.supabase.com:5432"

🚀  Your database is now in sync with your Prisma schema. Done in 9.81s

Running generate... (Use --skip-generate to skip the generators)
✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 42ms
```

No data-loss warnings. No "will be lost" or "drop the" lines. All changes additive.

## Delegate Verification

```
$ node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); \
  console.log('Delegates:', Object.keys(p).filter(k => k.toLowerCase().includes('apify') || k.toLowerCase().includes('linkedin'))); \
  console.log('All present:', !!p.linkedInProfileCache && !!p.anonymousApifyUsage && !!p.apifyUsageLog);"
Delegates: [ 'linkedInProfileCache', 'anonymousApifyUsage', 'apifyUsageLog' ]
All present: true
```

TypeScript `.d.ts` check (grep on `node_modules/.prisma/client/index.d.ts`):

- `apifyScrapeCount: number | null` — present
- `apifyScrapeQuota: number | null` — present
- `apifyFirstScrapeAt: Date | null` — present

## Decisions Made

- **Kept Decimal(10,6) for cost fields** rather than switching to the existing `Float` pattern used by `Order.price` — sub-cent precision matters when aggregating thousands of scrapes for cost reporting (per D-08/D-12 + research §Pattern 3).
- **No foreign key relations** from User to the new anonymous/log tables — keeps anonymous tracking decoupled from user identity (aligns with D-11 fingerprint-based free-tier model).
- **`updatedAt` added to AnonymousApifyUsage** (not explicitly in CONTEXT D-11 but implied by research §Pattern 3) — lets the quota service use upsert semantics cleanly.
- **`durationMs` added to ApifyUsageLog** — not explicitly in D-12 but present in research §Pattern 3; useful for latency observability on Apify p95 tracking.

## Deviations from Plan

None — plan executed exactly as written. `prisma format` applied whitespace normalization to 3 pre-existing models (Audit, Order, ErrorLog) as a side effect of the format step invoked by the verify pipeline. This is semantically inert (no field/type changes) and is the expected behavior of the Prisma formatter.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required for this plan. Downstream plans will need `APIFY_API_TOKEN` set in `.env.local` before the scraper client can run, but that's Plan 01-05's concern.

## Next Phase Readiness

- **Wave 1 unblocked:** Plans 01-03 (apify-cache service), 01-04 (apify-quota service), 01-05 (apify-scraper-client), 01-06 (/api/scrape-linkedin route), and 01-07 (orchestrator integration) can now compile and run against the regenerated Prisma client.
- **Schema is frozen for this phase:** No further changes to `prisma/schema.prisma` are planned in 01-*. Any downstream need for schema tweaks requires a new plan.
- **No blockers.**

## Self-Check: PASSED

**Files:**
- `prisma/schema.prisma` — FOUND (includes apifyScrapeCount, apifyScrapeQuota, apifyFirstScrapeAt, model LinkedInProfileCache, model AnonymousApifyUsage, model ApifyUsageLog)
- `.planning/phases/01-apify-linkedin-integration/01-02-SUMMARY.md` — FOUND (this file)

**Commits:**
- `be09533` — FOUND (feat(01-02): add Apify LinkedIn schema models + User quota fields)
- `f78cf38` — FOUND (chore(01-02): sync Apify schema to Supabase + regenerate Prisma client)

**Verification gates:**
- `npx prisma format` exit 0 — PASSED
- `npx prisma validate` exit 0 — PASSED
- `npm run db:push` exit 0, "in sync" confirmed — PASSED
- Prisma delegate existence check — PASSED
- `npm run build` exit 0 (48 routes, zero TS errors) — PASSED

---
*Phase: 01-apify-linkedin-integration*
*Completed: 2026-04-11*
