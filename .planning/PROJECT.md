# ProfileScore.io

## What This Is

AI-powered LinkedIn profile & CV auditor SaaS for the Spanish-speaking LATAM market (with English support). Users paste LinkedIn text or upload a CV PDF, receive per-section scoring (0–100), AI-generated rewrites, and export the result as PDF/DOCX. Monetized via one-time Creala payments ($5 Starter, $10 Recommended).

## Core Value

Give Spanish-speaking LATAM job seekers an instant, expert-grade audit of their LinkedIn profile and CV, with concrete rewrites they can ship same-day — no recruiter coaching required.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — infer from existing code. -->

- ✓ LinkedIn paste + CV PDF upload flow — shipped in v1
- ✓ 11-stage audit orchestrator (Haiku scoring + Sonnet rewrites) — shipped in v1
- ✓ Per-section scoring with 0–100 scale + degradation handling — shipped in v1
- ✓ PDF/DOCX export with plan gating (unlock-matrix + export-gating) — shipped in v1
- ✓ Creala one-time payments (Starter $5, Recommended $10) with HMAC webhook — shipped in v1
- ✓ Bilingual EN/ES i18n (683+ keys each) — shipped in v1
- ✓ Admin console: prompts, analytics, feedback, errors, blog CRUD — shipped in v1
- ✓ Error logging system with admin dashboard — shipped in v1
- ✓ Rewrite Studio for user-editable sections — shipped in v1

### Active

<!-- Current scope — building toward these. -->

- [ ] **REQ-01**: Replace manual LinkedIn paste with automatic Apify-based profile scraping for richer, more accurate analysis
- [ ] **REQ-02**: Enhanced Claude analysis prompts that consume structured LinkedIn data (experience timeline, endorsement counts, recommendations, certifications)
- [ ] **REQ-03**: Updated UX flow — user enters LinkedIn URL → loading state → enhanced results, with CV upload preserved as alternative
- [ ] **REQ-04**: Apify usage tracking per user with tiered quotas (free: 1 scrape, paid: unlimited)

### Out of Scope

- Replacing the CV upload flow — keeping as alternative for users who prefer direct upload
- Touching Creala payment integration — working as-is, avoid risk
- Migration files for schema changes — `prisma db push` is the established pattern
- Mocking LLM outputs for degraded sections — zero-mock policy enforced

## Context

- **Codebase size**: ~36,900 LOC TypeScript, Next.js 15 App Router, React 19
- **Most complex file**: `src/lib/services/audit-orchestrator.ts` (3,687 lines, 11-stage pipeline)
- **Database**: PostgreSQL via Prisma 5.22 on Supabase (PgBouncer pooling). 9 models: User, Audit, Export, PromptRegistry, GenerationCache, Order, AnalyticsEvent, ErrorLog, BlogPost
- **LLM usage**: Anthropic Claude — Haiku 4.5 for scoring (fast, 25s budget), Sonnet 4 for rewrites (quality, 50s budget)
- **Deployment**: Vercel Hobby plan (10s Lambda default, 120s for stream route)
- **Prior work**: Error logging system, competitive differentiation pages, LinkedIn social presence, admin feedback dashboard all shipped recently
- **New capability**: Apify HarvestAPI (harvestapi/linkedin-profile-scraper) now available as MCP and npm package, $4/1,000 profiles

## Constraints

- **Tech stack**: Next.js 15, React 19, TypeScript 5.7+, Tailwind 4.0, Prisma 5.22, Zod 4 — no new frameworks
- **Schema workflow**: `prisma db push` only — NEVER migration files
- **i18n**: Every user-facing string must have both `en.json` AND `es.json` entries
- **Error handling**: All errors via `logError()` from `src/lib/services/error-logger.ts` (fire-and-forget)
- **Env hygiene**: Client-side env vars must be prefixed `NEXT_PUBLIC_`
- **Build gate**: `npm run build` must pass zero-errors before every commit
- **Vercel Lambda limits**: 10s default, 120s only for stream route — Apify scraping must fit within limits or use the stream route
- **CSS variables**: Use `var(--accent)`, `var(--surface-*)`, `var(--text-*)`, `var(--border-*)` — NOT raw Tailwind color classes
- **Admin routes**: Must use `assertAdmin()` + `adminHeaders()` pattern
- **Zero-mock**: Failed sections are omitted, never faked
- **Payments**: Do not touch Creala integration — working, risky to modify

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Haiku 4.5 for scoring, Sonnet 4 for rewrites | Cost/latency tradeoff — scoring needs speed, rewrites need quality | ✓ Good |
| `prisma db push` instead of migrations | Solo dev, rapid iteration, small schema | ✓ Good |
| Zero-mock policy for LLM outputs | Trust > fake data; degraded sections omit rather than fabricate | ✓ Good |
| DB-backed versioned prompts via PromptRegistry | Enables A/B testing and prompt hot-swap without deploy | ✓ Good |
| Apify HarvestAPI for LinkedIn scraping | Official scraper, $4/1k profiles, richer than manual paste | — Pending (this phase) |

---
*Last updated: 2026-04-11 after bootstrapping .planning/ for Phase 1 (Apify integration)*
