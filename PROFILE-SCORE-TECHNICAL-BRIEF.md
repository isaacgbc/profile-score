# ProfileScore.io — Technical Architecture Brief

> **Purpose:** Context document for an AI orchestrator/planner session. Contains the full technical state of the ProfileScore codebase as of March 2026.
> **Codebase:** `/Users/isaacgbc/Applications/Claude Code Apps/profile-score/`
> **Total LOC:** ~36,900 lines TypeScript/TSX
> **Live URL:** https://profilescore.io

---

## 1. What Is ProfileScore

ProfileScore is a **Next.js 15 SaaS** that audits LinkedIn profiles and CVs using Claude AI. Users paste their LinkedIn text or upload a CV PDF, optionally add a job description, and get:

1. **Per-section scoring** (0-100 scale, 4 tiers: poor/fair/good/excellent)
2. **AI-powered rewrites** of every section (headline, about, experience, education, etc.)
3. **Per-entry rewrites** for experience/education (individual job entries rewritten)
4. **Cover letter generation** (job-targeted, plan-gated)
5. **Export modules** (PDF/DOCX: results summary, full audit, updated CV, cover letter, LinkedIn updates)

Revenue model: 2-tier plans via **Crea.la** payment platform (Starter $5 one-time, Recommended $10 one-time). Free preview shows locked scores + partial rewrites.

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.5.12 |
| Runtime | React | 19.0.0 |
| Language | TypeScript | 5.7+ |
| Database | PostgreSQL (Supabase) | via Prisma 5.22.0 |
| Auth | Supabase Auth | @supabase/ssr 0.8.0 |
| Storage | Supabase Storage | exports bucket |
| LLM | Anthropic Claude | @anthropic-ai/sdk 0.78.0 |
| Validation | Zod | 4.3.6 |
| PDF gen | pdf-lib | 1.17.1 |
| PDF parse | pdfjs-dist | 5.4.624 |
| DOCX gen | docx | 9.6.0 |
| Styling | Tailwind CSS | 4.0.0 |
| Hosting | Vercel | Hobby plan (Lambda) |
| Payments | Crea.la | Webhook HMAC-SHA256 |

---

## 3. Project Structure

```
profile-score/
├── prisma/
│   └── schema.prisma              # 9 models, 188 lines
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── page.tsx               # Landing (server component → LandingClient)
│   │   ├── layout.tsx             # Root layout + providers
│   │   ├── globals.css            # Tailwind + custom animations
│   │   ├── providers.tsx          # AppContext + I18nContext + BugReportOverlay
│   │   ├── middleware.ts          # Supabase session refresh
│   │   ├── robots.ts / sitemap.ts # SEO
│   │   ├── input/page.tsx         # Profile/CV upload + job description
│   │   ├── features/page.tsx      # Feature showcase
│   │   ├── pricing/page.tsx       # Plan comparison
│   │   ├── results/page.tsx       # Score display (free preview + locked)
│   │   ├── rewrite-studio/page.tsx# Rewrite editor
│   │   ├── checkout/page.tsx      # Payment flow + export generation
│   │   ├── compare/page.tsx       # Side-by-side comparison
│   │   ├── freelancers/page.tsx   # Use case marketing page
│   │   ├── why-profilescore/page.tsx # Competitive differentiation
│   │   ├── blog/page.tsx          # Blog listing
│   │   ├── blog/[slug]/page.tsx   # Blog article
│   │   ├── auth/login/page.tsx    # Supabase Auth UI
│   │   ├── admin/                 # Admin panel (5 pages)
│   │   │   ├── layout.tsx         # Auth gate + nav bar
│   │   │   ├── prompts/page.tsx   # Prompt editor
│   │   │   ├── analytics/page.tsx # Funnel metrics
│   │   │   ├── feedback/page.tsx  # User feedback
│   │   │   ├── errors/page.tsx    # Error log triage dashboard
│   │   │   └── blog/page.tsx      # Blog CRUD
│   │   └── api/                   # API routes (19 endpoints)
│   │       ├── audit/generate/route.ts   # Main generation (sync)
│   │       ├── audit/stream/route.ts     # SSE streaming generation
│   │       ├── audit/progress/[requestId]/route.ts # Poll progress
│   │       ├── audit/regenerate-rewrite/route.ts   # Single section regen
│   │       ├── audits/route.ts           # List audits
│   │       ├── audits/[id]/route.ts      # Single audit
│   │       ├── exports/create/route.ts   # Create export job
│   │       ├── exports/[id]/route.ts     # Get export record
│   │       ├── exports/audit/[auditId]/route.ts # List exports by audit
│   │       ├── webhooks/creala/route.ts  # Payment webhook
│   │       ├── user/me/route.ts          # Current user + plan
│   │       ├── analytics/track/route.ts  # Client events
│   │       ├── analytics/funnel/route.ts # Funnel metrics
│   │       ├── blog/route.ts             # Public blog list
│   │       ├── blog/[slug]/route.ts      # Public blog post
│   │       ├── prompts/route.ts          # Prompt CRUD
│   │       ├── prompts/[id]/route.ts     # Single prompt
│   │       ├── admin/verify/route.ts     # Admin login
│   │       ├── admin/verify-owner/route.ts # Owner login
│   │       ├── admin/blog/route.ts       # Admin blog CRUD
│   │       ├── admin/blog/[id]/route.ts  # Admin blog single
│   │       ├── admin/feedback/route.ts   # Feedback list
│   │       ├── admin/errors/route.ts     # Error logs API
│   │       ├── admin/errors/[id]/route.ts # Error log update/delete
│   │       └── admin/eval-quality/route.ts # Quality metrics
│   ├── components/                # 13 directories
│   │   ├── ui/                    # Button, Card, Badge, Icons, BrandLogo, etc.
│   │   ├── layout/                # Header, Footer, StepIndicator, Sidebar
│   │   ├── landing/               # LandingClient, HeroSection, FAQSection, etc.
│   │   ├── input/                 # LinkedinInput, CvUpload, JobDescriptionInput
│   │   ├── features/              # FeatureGrid, FeatureCard
│   │   ├── pricing/               # PricingModal, PlanCard
│   │   ├── results/               # ScoreCard, SectionCard, OverallScore
│   │   ├── studio/                # RewriteEditor, EntryEditor, ExportPanel
│   │   ├── checkout/              # CheckoutFlow, ExportCard, DownloadButton
│   │   ├── blog/                  # BlogPostCard, BlogArticle
│   │   ├── admin/                 # Admin panels
│   │   └── feedback/              # FeedbackForm, BugReportOverlay
│   ├── context/
│   │   ├── AppContext.tsx          # Central state (1,171 lines)
│   │   └── I18nContext.tsx         # Locale management
│   ├── hooks/
│   │   ├── useGenerationStream.ts # SSE progressive generation
│   │   ├── useProgressPolling.ts  # Poll-based progress
│   │   ├── useExport.ts           # Export generation UX
│   │   ├── usePrompts.ts          # Active prompts
│   │   └── useStudioPersistence.ts # LocalStorage edits
│   └── lib/
│       ├── services/              # Core business logic (see §5)
│       ├── schemas/               # Zod validation (audit, export, analytics, llm-output, prompt)
│       ├── types/index.ts         # All domain types (249 lines)
│       ├── db/client.ts           # Prisma singleton
│       ├── db/storage.ts          # Supabase Storage wrapper
│       ├── supabase/client.ts     # Browser Supabase client
│       ├── supabase/server.ts     # Server Supabase client
│       ├── analytics/             # Client + server event tracking
│       ├── i18n/                  # en.json + es.json (683 lines each)
│       ├── blog/posts.ts          # Blog content (TypeScript array)
│       ├── eval/                  # Quality evaluation harness
│       ├── mock/                  # Mock data (plans, features, results)
│       ├── utils/                 # PDF extract, language detect, entry ID, etc.
│       ├── feature-flags.ts       # Runtime toggles
│       └── section-labels.ts      # i18n section name mapping
```

---

## 4. Database Models (Prisma)

**9 models**, all mapped to snake_case tables:

| Model | Table | Purpose | Key Fields |
|-------|-------|---------|------------|
| **User** | `users` | Supabase auth sync | id (UUID=auth.users.id), email, activePlanId, subscriptionStatus |
| **Audit** | `audits` | Generation results | userId?, results (JSON: ProfileResult), planId, modelUsed, promptVersions |
| **Export** | `exports` | Export job queue | auditId, exportType, format, language, status, fileUrl, planId |
| **PromptRegistry** | `prompt_registry` | Versioned prompts | promptKey, version, locale, content, status (draft/active/archived) |
| **GenerationCache** | `generation_cache` | Input hash → results | inputHash (unique), results, expiresAt (1hr TTL) |
| **Order** | `orders` | Crea.la payments | saleId (unique), event, customerEmail, planId, reconciliationStatus |
| **AnalyticsEvent** | `analytics_events` | Event tracking | eventName, sessionId, userId, metadata (JSON) |
| **ErrorLog** | `error_logs` | Error persistence | level, source, message, stack, code, resolved, notes |
| **BlogPost** | `blog_posts` | Blog content | slug (unique), title/Es, content/Es, published, tags |

---

## 5. Core Services (src/lib/services/)

### 5.1 Audit Orchestrator (`audit-orchestrator.ts` — 3,687 lines)

The heart of the product. **11-stage pipeline:**

```
Stage 1:  Cache Check → SHA-256 hash of input (includes parser version v3.7)
Stage 2:  Input Parsing → LinkedIn sections (regex + optional LLM structuring) + CV sections
Stage 3:  Prompt Preflight → Verify all required prompt keys are active before spending LLM budget
Stage 4:  Audit Scoring → Per-section scoring (Haiku, 25s budget, 3 retries per section)
Stage 5:  Entry Parsing → Experience/education entries via archetype parser
Stage 6:  Entry Scoring → Optional per-entry scores (Haiku, soft fail)
Stage 7:  Rewrite Generation → Per-section rewrites (Sonnet 50s budget or Haiku 8s fast path)
Stage 8:  Overall Descriptor → Holistic profile summary (Haiku)
Stage 9:  Cover Letter → Job-targeted (Sonnet, plan-gated to "recommended")
Stage 10: Plan Locking → Lock/unlock sections based on planId
Stage 11: Cache Storage → Upsert to GenerationCache (1hr TTL)
```

**Rewrite Strategy Selection:**
- **Full Sonnet** (`rewriteSectionWithEntries`): 20s timeout, 2 attempts, 20 entries max, attachment integrity check
- **Fast Haiku** (`fastSectionRewriteWithEntries`): 8s timeout, 1 attempt, no integrity check
- **Fast Headline** (`fastRewriteSection`): Haiku, 8s, for headline/summary when archetype is high-confidence

**Failure Classification:**
- **Transient**: 429, timeout, socket hang → retry, don't trip circuit breaker
- **Hard**: parse failure, auth error, system error → trip circuit breaker

**Degradation Rule:** If `fallbackCount >= 30%` of expected sections → `degraded=true` → UI restricts editing/export

### 5.2 LLM Client (`llm-client.ts`)

```typescript
LLM_MODEL_FAST    = "claude-haiku-4-5-20251001"   // scoring, fast rewrites
LLM_MODEL_QUALITY = "claude-sonnet-4-20250514"    // quality rewrites, cover letter
```

- Singleton `@anthropic-ai/sdk` client
- Per-model timeouts (30s fast, 60s quality)
- Circuit breaker integration (auto-reject when OPEN)
- External abort signal support for parser timeouts
- Error classification reports to circuit breaker

### 5.3 Circuit Breaker (`circuit-breaker.ts`)

State machine: **CLOSED → OPEN → HALF_OPEN → CLOSED**

| Parameter | Value |
|-----------|-------|
| Window | 50 calls |
| Hard failure threshold | 60% |
| Min samples before trip | 15 |
| Cooldown (OPEN → HALF_OPEN) | 15 seconds |
| Success streak to close | 3 consecutive in HALF_OPEN |

Only **hard** failures count. Transient (429, timeout) are excluded.

### 5.4 Rate Limiter (`rate-limiter.ts`)

**3-tier sliding window** (per IP, in-memory):
1. Burst: 5 req / 1 min
2. Hourly: 20 req / 1 hr
3. Daily: 50 req / 24 hr

Additional limiters: exports (10/min), regenerate (3/min), admin verify (3/min).

### 5.5 Prompt Resolver (`prompt-resolver.ts`)

- Queries `PromptRegistry` for `status="active"` + given `promptKey` + `locale`
- 5-minute in-memory TTL cache
- Cascade: exact locale → fallback "en"
- `interpolatePrompt()` replaces `{{variable}}` placeholders
- Version tracking for traceability in generation meta

### 5.6 Generation Guards (`generation-guards.ts`)

| Guard | What It Catches |
|-------|-----------------|
| Placeholder detection | ~15 known mock fingerprints from `mock/results.ts` |
| Input overlap | Output must reference ≥5% of user's significant words |
| Section completeness | Core sections (headline, about, experience, education) must exist |
| Language drift | Output language must match input language |
| Attachment integrity | Similarity score ≥0.15 between rewritten entry and original |
| Buzzword inflation | Flags low-value jargon |

### 5.7 Export Generator (`export-generator.ts`)

**5 export modules:**

| Module | Formats | Plan |
|--------|---------|------|
| results-summary | PDF | Starter+ |
| full-audit | PDF | Recommended |
| updated-cv | PDF, DOCX | Recommended |
| cover-letter | PDF | Recommended |
| linkedin-updates | PDF | Recommended |

Pipeline: apply polish pass (Haiku refinement) → sanitize → generate PDF/DOCX → upload to Supabase Storage → return signed URL.

### 5.8 Other Services

| Service | Purpose |
|---------|---------|
| `linkedin-parser.ts` | Extracts sections from raw profile text (regex + LLM fallback) |
| `linkedin-experience-archetype.ts` | Deterministic date-anchor state machine for experience entries |
| `linkedin-pdf-cleaner.ts` | Cleans PDF-extracted LinkedIn text |
| `cv-work-exp-structurer.ts` | AI-assisted CV work experience structuring |
| `profile-structurer.ts` | LLM-based profile text structuring pass |
| `result-cache.ts` | SHA-256 hash → cached results (1hr TTL, Web Crypto API) |
| `progress-store.ts` | In-memory progress tracking (15min TTL, cleanup every 60s) |
| `unlock-matrix.ts` | Plan-based feature gating (single source of truth) |
| `export-gating.ts` | Plan → export module access checks |
| `error-logger.ts` | Fire-and-forget DB persistence (never throws) |
| `admin-guard.ts` | `assertAdmin()` via x-admin-token header or ps_admin_session cookie |
| `admin-session.ts` | HMAC-SHA256 signed cookie generation/validation |
| `owner-allowlist.ts` | Email-based admin allowlist (auto-promotes plan) |

---

## 6. Authentication & Authorization

### User Auth (Supabase)
- Supabase Auth with JWT cookies (`sb_*`)
- Middleware refreshes session on every request
- Only `/account` and `/saved-audits` require login (future pages)
- All other pages fully accessible without auth (free funnel)

### Admin Auth (Custom)
Two paths:
1. **Header token:** `x-admin-token: {ADMIN_SECRET}` (from sessionStorage)
2. **Signed cookie:** `ps_admin_session` (HMAC-SHA256, set by `/api/admin/verify`)

Owner allowlist: `ADMIN_ALLOWLIST_EMAILS` env var → auto-promotes to "recommended" plan.

---

## 7. Payment System (Crea.la)

### Webhook (`/api/webhooks/creala`)
1. Verify HMAC-SHA256 signature
2. Map event → action:
   - `new_sale` → Create Order + assign planId
   - `subscription_renewal` → Extend expiry
   - `subscription_cancellation` → Mark cancelled
   - `payment_failed` → Track event
3. Map `customerEmail` → `userId` (email lookup)
4. Update `User.activePlanId` + `subscriptionStatus`
5. Track analytics event

### Plans
| Plan | Price | ID | Unlocks |
|------|-------|----|---------|
| Starter | $5 one-time | `starter` | All section scores + rewrites, results-summary export |
| Recommended | $10 one-time | `recommended` | Everything + cover letter + all 5 export modules |

Legacy plan IDs (`pro`, `coach`) auto-migrate to `recommended`.

---

## 8. Client State Management

### AppContext (`context/AppContext.tsx` — 1,171 lines)

Central state for the entire user journey:

```typescript
// Core state
currentStep: JourneyStep         // landing → input → features → results → rewrite-studio → checkout
userInput: UserInput             // LinkedIn text, CV text, job description, objectives
results: ProfileResult | null    // Generated scores + rewrites
auditId: string | null

// Edit layers (3-tier priority: optimized > rewritten > improvements)
userImprovements: Record<string, string>   // Section-level suggestions
userOptimized: Record<string, string>      // Highest-priority user edits
deletedEntryIds: Set<string>               // Removed entries
manualSections: Record<string, string>     // HOTFIX-4: user-added sections

// Generation state
isGenerating: boolean
generationMeta: GenerationMetaClient | null
progressSections: SectionReadyEvent[]      // Progressive rendering
progressPercent: number
progressStage: string

// Plan/payment
selectedPlan: PlanId | null
selectedFeatures: FeatureId[]
```

**Key methods:**
- `generateResults()` → calls `/api/audit/generate` or `/api/audit/stream`
- `regenerateSection(sectionId, source)` → calls `/api/audit/regenerate-rewrite`
- `setUserOptimized(key, text)` → highest-priority edit override
- `resetSection(sectionId)` → clears all edit layers for section

### I18nContext
- Detects browser language → "es" or "en"
- `t: TranslationKeys` (type-safe translation object)
- 683 keys per locale

---

## 9. Key Types (`src/lib/types/index.ts`)

```typescript
type Locale = "en" | "es"
type PlanId = "starter" | "recommended"
type JourneyStep = "landing" | "input" | "features" | "results" | "rewrite-studio" | "checkout"
type ExportModuleId = "results-summary" | "full-audit" | "updated-cv" | "cover-letter" | "linkedin-updates"
type ScoreTier = "poor" | "fair" | "good" | "excellent"

interface ProfileResult {
  overallScore: number
  maxScore: number
  tier: ScoreTier
  overallDescriptor?: string
  linkedinSections: ScoreSection[]
  cvSections: ScoreSection[]
  linkedinRewrites: RewritePreview[]
  cvRewrites: RewritePreview[]
  coverLetter: CoverLetterResult | null
}

interface ScoreSection {
  id: string
  score: number
  maxScore: number
  tier: ScoreTier
  locked: boolean
  source: "linkedin" | "cv"
  explanation: string
  improvementSuggestions: string[]
  entryScores?: EntryScore[]
}

interface RewritePreview {
  sectionId: string
  source: "linkedin" | "cv"
  original: string
  improvements: string
  missingSuggestions: string[]
  rewritten: string
  locked: boolean
  entries?: RewriteEntry[]
}

interface RewriteEntry {
  entryIndex: number
  entryTitle: string
  organization?: string
  title?: string
  dateRange?: string
  original: string
  improvements: string
  missingSuggestions: string[]
  rewritten: string
}
```

---

## 10. Feature Flags & Environment Variables

### Feature Flags (`src/lib/feature-flags.ts`)
```
NEXT_PUBLIC_PAYMENTS_ENABLED    # Enable payment UI
NEXT_PUBLIC_ADMIN_BYPASS        # Admin mode in client
ENABLE_PROGRESSIVE_GENERATION   # SSE streaming (needs Vercel Pro)
NEXT_PUBLIC_ENABLE_PROGRESSIVE  # Client progressive rendering
ENABLE_PROGRESS_REGISTRY        # Poll-based progress store
NEXT_PUBLIC_USE_POLL_PROGRESS   # Client uses polling vs SSE
ENABLE_ENTRY_SCORING            # Per-entry scores
ENABLE_STRUCTURING_PASS         # LLM LinkedIn text structuring
```

### Critical Env Vars
```
DATABASE_URL                    # PostgreSQL (Supabase pooler)
DIRECT_URL                      # PostgreSQL (direct, no pooler)
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY       # Supabase admin key (server only)
ANTHROPIC_API_KEY               # Claude API key
LLM_MODEL_FAST                  # claude-haiku-4-5-20251001
LLM_MODEL_QUALITY               # claude-sonnet-4-20250514
ADMIN_SECRET                    # Admin login secret
ADMIN_ALLOWLIST_EMAILS          # Comma-separated owner emails
CREALA_WEBHOOK_SECRET           # Crea.la HMAC signing key
NEXT_PUBLIC_SITE_URL            # Production URL
```

---

## 11. SEO/GEO Infrastructure

- `robots.ts` — Allow `/`, `/blog/*`, `/features`, `/pricing`. Disallow admin/api/auth routes.
- `sitemap.ts` — Static + dynamic blog slugs with `lastModified` (GEO freshness signal).
- Root `layout.tsx` — `metadataBase`, `title.template`, keywords array.
- JSON-LD: `SoftwareApplication`, `Organization`, `WebSite` schemas in landing page.
- `FAQPage` schema in FAQ section.
- `Article` schema on each blog post page.
- Blog posts include "Last updated" dates for GEO freshness.

---

## 12. Resilience & Quality Architecture

### Retry Chain (Per Section)
```
Attempt 1: Normal scoring prompt
Attempt 2: + explicit JSON instruction
Attempt 3: + stricter constraints (1-sentence suggestions, max 180 chars, max 3)
```

### Fallback Chain
```
Scoring fails    → Section skipped (zero-mock policy)
Rewrite fails    → Pass-through (original text returned)
Entry fails      → Pass-through per-entry
Export polish     → Emoji-stripped raw text
Circuit breaker   → Immediate throw, caller handles
Cache error       → Silent, generation continues
Analytics error   → Silent, never blocks
ErrorLog write    → Console.error fallback
```

### Performance Optimizations
- **Fast-path rewriting:** High-confidence archetype → Haiku 8s instead of Sonnet 20s
- **Time budget:** 45s global orchestration limit, skips non-essential stages if exceeded
- **Parallel execution:** `Promise.allSettled()` for independent sections
- **Entry cap:** 20 entries max in LLM call, rest pass-through
- **Cache:** 1-hour TTL prevents duplicate expensive generations

---

## 13. Commit History Pattern

The project follows a sprint/hotfix pattern:

```
feat:  → New features (landing overhaul, blog, SEO, payments, error logging)
fix:   → Hotfixes (HOTFIX-6 through HOTFIX-9d for fidelity/export bugs)
perf:  → Performance (PERF-HOTFIX, PERF-HOTFIX-2 for fast rewrite paths)
```

Total commits: 25+ (recent history shows rapid iteration with numbered hotfix cycles).

---

## 14. Known Design Decisions & Constraints

| Decision | Why |
|----------|-----|
| No migration files | Uses `prisma db push` (prototyping speed) |
| In-memory rate limiter | Single Vercel Lambda instance, no Redis needed |
| In-memory progress store | Polling-based (Vercel Hobby can't stream SSE reliably) |
| In-memory circuit breaker | Fast fault detection, no external state store |
| Fire-and-forget analytics | Never block UX for telemetry |
| Zero-mock policy | Sections that fail scoring are omitted, never faked |
| Monorepo (no packages) | Tight frontend/backend coupling, simple deployment |
| `prisma db push` vs migrations | Faster iteration, acceptable for single-developer product |
| Crea.la (not Stripe) | LATAM-friendly, simpler integration for LATAM audience |
| No Redis/Bull/background jobs | Vercel Hobby constraint — everything runs in Lambda |
| CSS variables (not Tailwind tokens) | Custom design system: `--accent`, `--surface-*`, `--text-*`, `--border-*` |

---

## 15. Deployment

- **Platform:** Vercel (Hobby plan)
- **Build:** `prisma generate && next build`
- **Lambda constraints:** 10s default (extended to 120s for stream route)
- **Cold starts:** Mitigated by warm Lambda reuse during generation window
- **DB:** Supabase PostgreSQL with PgBouncer connection pooling
- **Storage:** Supabase Storage (exports bucket, signed URLs)
- **DNS:** Custom domain via Vercel

---

## 16. Active Development Areas

### Recently Completed
- Error logging system (ErrorLog model + admin dashboard + API wiring)
- Competitive differentiation pages (/why-profilescore, /compare)
- Blog system (DB-backed, multilingual)
- Admin feedback dashboard
- Logo update + LinkedIn social presence

### Plan Document (Pending)
A plan exists at `.claude/plans/tingly-wiggling-beaver.md` covering:
- Phase 2: Landing page overhaul (modularize into section components, add FAQ, stats, expert quotes)
- Phase 3: Blog infrastructure (already partially done)
- Phase 4: Feedback form + bug report overlay
- Phase 5: Footer expansion

### Known Issues to Watch
- Users reported errors on CV upload ("We couldn't generate personalized results") → caused by degradation gate (≥30% fallback sections)
- LinkedIn upload errors → likely PDF parsing or input validation stage
- Both now tracked by the new ErrorLog system

---

## 17. Instructions for Orchestrator

When planning work for this codebase:

1. **Always check `prisma/schema.prisma`** before DB changes — use `prisma db push`, not migrations.
2. **The orchestrator file is 3,687 lines** — `audit-orchestrator.ts` is the most complex file. Changes there require understanding the 11-stage pipeline.
3. **i18n is mandatory** — Every user-facing string needs both `en.json` and `es.json` entries.
4. **Plan gating is centralized** in `unlock-matrix.ts` and `export-gating.ts`.
5. **Admin pages** follow a consistent pattern: `assertAdmin()` + `adminHeaders()` from sessionStorage.
6. **The build command is `npm run build`** (`prisma generate && next build`). Always verify with this.
7. **Next.js 15 requires `Promise<{ id: string }>` for dynamic route params** — not plain `{ id: string }`.
8. **CSS uses variables** (`var(--accent)`, `var(--text-primary)`, etc.), not raw Tailwind colors.
9. **All API routes wire through `logError()`** for error tracking — new routes should too.
10. **Zod 4** is in use — schemas use `z.object()` / `z.string()` etc.
