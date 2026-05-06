# ProfileScore.io

AI-powered LinkedIn profile & CV auditor. Next.js 15 App Router SaaS, ~36,900 LOC TypeScript.
Users paste LinkedIn text or upload CV PDF → get per-section scoring (0-100) → AI rewrites → export PDF/DOCX.
Revenue: Starter ($5) and Recommended ($10) one-time plans via Creala.
Markets: Spanish-speaking LATAM + English. Bilingual (en/es) throughout.

## Commands

```bash
npm run dev          # Local dev server
npm run build        # prisma generate && next build — ALWAYS run before committing
npm run lint         # ESLint
npx prisma db push   # Sync schema to DB (NO migration files — we use db push)
npx prisma studio    # Visual DB browser
npx prisma generate  # Regenerate Prisma client after schema changes
```

## Tech Stack

- Next.js 15.5.12 (App Router, Server Components)
- React 19, TypeScript 5.7+, Tailwind CSS 4.0
- PostgreSQL via Prisma 5.22.0 on Supabase (PgBouncer pooling)
- Supabase Auth (@supabase/ssr), Supabase Storage (exports bucket)
- Anthropic Claude API: Haiku 4.5 (fast/scoring) + Sonnet 4 (quality/rewrites)
- Zod 4 for validation, pdf-lib + docx for exports
- Vercel Hobby plan deployment (10s Lambda default, 120s for stream route)
- Creala for payments (webhook HMAC-SHA256)

## Critical Architecture

- **Orchestrator** (`src/lib/services/audit-orchestrator.ts`, 3687 lines): 11-stage pipeline. THE most complex file. Read fully before editing.
- **Circuit breaker** (`circuit-breaker.ts`): CLOSED→OPEN→HALF_OPEN→CLOSED. Only hard failures count.
- **Rate limiter** (`rate-limiter.ts`): 3-tier sliding window per IP, in-memory.
- **Prompt resolver** (`prompt-resolver.ts`): DB-backed versioned prompts with 5min TTL cache.
- **Plan gating**: `unlock-matrix.ts` (features) + `export-gating.ts` (exports). Single source of truth.
- **Generation guards** (`generation-guards.ts`): Placeholder detection, input overlap, language drift, attachment integrity.
- **LLM client** (`llm-client.ts`): Singleton, per-model timeouts (30s fast, 60s quality), circuit breaker integration.

## Critical Rules

- NEVER use migration files. ALWAYS `prisma db push` for schema changes.
- ALWAYS run `npm run build` to verify zero errors before any commit.
- ALWAYS add both `en.json` AND `es.json` entries for user-facing strings (683+ keys each in `src/lib/i18n/`).
- ALWAYS wire errors through `logError()` from `src/lib/services/error-logger.ts` — fire-and-forget, never blocks.
- ALWAYS validate with Zod schemas (in `src/lib/schemas/`) before DB writes or LLM calls.
- NEVER expose env vars client-side except those prefixed `NEXT_PUBLIC_`.
- NEVER import PrismaClient directly — use singleton from `src/lib/db/client.ts`.
- Next.js 15 dynamic route params are `Promise<{ id: string }>`, not plain objects.
- CSS uses custom variables (`var(--accent)`, `var(--surface-*)`, `var(--text-*)`, `var(--border-*)`), NOT raw Tailwind color classes.
- Admin routes require `assertAdmin()` + `adminHeaders()` pattern.
- Zero-mock policy: sections that fail scoring are omitted, never faked.

## Project Structure (key paths)

```
src/app/                    # Pages + API routes (25 endpoints)
src/app/api/audit/          # Main generation endpoints (generate, stream, progress, regenerate)
src/app/api/admin/          # Admin CRUD (verify, blog, feedback, errors, eval-quality)
src/app/admin/              # Admin UI (prompts, analytics, feedback, errors, blog)
src/components/             # 12 directories (ui, layout, landing, input, results, studio, checkout, etc.)
src/context/AppContext.tsx   # Central state (1,171 lines) — journey, results, edits, generation
src/context/I18nContext.tsx  # Locale detection + t() translations
src/hooks/                  # useGenerationStream, useProgressPolling, useExport, usePrompts, useStudioPersistence
src/lib/services/           # Core business logic (orchestrator, llm-client, circuit-breaker, rate-limiter, etc.)
src/lib/schemas/            # Zod schemas (audit, export, analytics, llm-output, prompt)
src/lib/types/index.ts      # All domain types (248 lines)
src/lib/i18n/               # en.json + es.json
src/lib/utils/              # PDF extract, language detect, entry ID, etc.
src/lib/feature-flags.ts    # Runtime toggles
prisma/schema.prisma        # 9 models, 187 lines
```

## Database Models

9 Prisma models: User, Audit, Export, PromptRegistry, GenerationCache, Order, AnalyticsEvent, ErrorLog, BlogPost.
See `prisma/schema.prisma` for full definitions. All mapped to snake_case tables.

## Orchestrator Pipeline (11 stages)

1. Cache Check (SHA-256 hash)
2. Input Parsing (regex + optional LLM structuring)
3. Prompt Preflight (verify active prompts before spending LLM budget)
4. Audit Scoring (Haiku, 25s budget, 3 retries/section)
5. Entry Parsing (archetype parser)
6. Entry Scoring (optional, Haiku, soft fail)
7. Rewrite Generation (Sonnet 50s or Haiku 8s fast path)
8. Overall Descriptor (Haiku)
9. Cover Letter (Sonnet, plan-gated to "recommended")
10. Plan Locking (lock/unlock per planId)
11. Cache Storage (1hr TTL)

Degradation rule: fallbackCount >= 30% of sections → degraded=true → UI restricts editing/export.

## Env Vars (critical)

DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, LLM_MODEL_FAST, LLM_MODEL_QUALITY,
ADMIN_SECRET, ADMIN_ALLOWLIST_EMAILS, CREALA_WEBHOOK_SECRET, NEXT_PUBLIC_SITE_URL

## Feature Flags

NEXT_PUBLIC_PAYMENTS_ENABLED, NEXT_PUBLIC_ADMIN_BYPASS, ENABLE_PROGRESSIVE_GENERATION,
NEXT_PUBLIC_ENABLE_PROGRESSIVE, ENABLE_PROGRESS_REGISTRY, NEXT_PUBLIC_USE_POLL_PROGRESS,
ENABLE_ENTRY_SCORING, ENABLE_STRUCTURING_PASS

## Additional Scripts

```bash
npm run db:push      # Sync schema with dotenv-cli override (.env.local)
npm run db:studio    # Visual DB browser with dotenv-cli override
npm run db:seed      # Seed database (tsx prisma/seed.ts)
npm run eval         # Run LLM output quality evaluation harness
```
