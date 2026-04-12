---
phase: 01
slug: apify-linkedin-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `01-RESEARCH.md` §Validation Architecture (lines 869-944).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (install in Wave 0 — not yet present; existing `*.test.ts` files are standalone tsx scripts with home-grown `assert()` helpers) |
| **Config file** | `vitest.config.ts` — create in Wave 0 |
| **Quick run command** | `npx vitest run <file>` — narrow-scope test for a single task |
| **Full suite command** | `npx vitest run && npm run build` — full Nyquist gate |
| **Estimated runtime** | ~30 seconds (unit+integration tests), ~90 seconds with build |

**Decision rationale:** Research recommends vitest over continuing the tsx-script convention. Phase adds 5+ new services with well-defined inputs/outputs (URL normalizer, fingerprint, formatter, Zod schema, quota logic). Proper test runner benefits outweigh the Wave 0 install cost for a Next.js 15 + TS project.

---

## Sampling Rate

- **After every task commit:** Run the specific test file(s) the task modified: `npx vitest run path/to/test.ts`
- **After every plan wave:** Run full suite: `npx vitest run && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green + manual smoke test of input → results flow in both EN and ES (LATAM market requires ES validation)
- **Max feedback latency:** <30 seconds for narrow-scope test; <120 seconds for full suite

---

## Per-Task Verification Map

This map defines how each phase requirement and success criterion is validated. Task IDs will be assigned by the planner in PLAN.md files; this table is the per-test reference the planner maps to.

| Criterion | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Fixture File | Status |
|-----------|-------------|------------|-----------------|-----------|-------------------|--------------|--------|
| SC-1 (URL triggers scrape) | REQ-01 | T-01 (IDOR), T-09 (SSRF) | Only `linkedin.com/in/...` URLs accepted, no internal redirects | integration | `npx vitest run src/app/api/scrape-linkedin/__tests__/route.test.ts` | ❌ W0 | ⬜ pending |
| SC-1 (URL validation) | REQ-01 | T-09 (SSRF), T-01 (IDOR) | Zod schema rejects non-linkedin hosts, protocol-relative URLs, data URIs | unit | `npx vitest run src/lib/schemas/__tests__/linkedin-profile.test.ts` | ❌ W0 | ⬜ pending |
| SC-1 (URL normalization) | REQ-01 | — | Same canonical form for `/in/name`, `/in/name/`, `/in/name?trk=...` | unit | `npx vitest run src/lib/services/__tests__/apify-cache.test.ts` | ❌ W0 | ⬜ pending |
| SC-2 (formatter slots) | REQ-02 | — | All required markdown sections produced from fixture | unit | `npx vitest run src/lib/services/__tests__/linkedin-profile-formatter.test.ts` | `fixtures/apify-profile-sample.json` ❌ W0 | ⬜ pending |
| SC-2 (orchestrator stage 2 bypass) | REQ-02 | — | When `preparsedLinkedinSections` is set, stage 2 parser is not invoked | integration (LLM mocked) | `npx vitest run src/lib/services/__tests__/orchestrator-apify-path.test.ts` | ❌ W0 | ⬜ pending |
| SC-3 (CV upload preserved) | REQ-03 | — | Existing CV flow completes end-to-end | manual-only | Manual smoke: upload sample CV PDF, verify audit runs | — | ⬜ pending |
| SC-4 (cache hit) | REQ-01 | T-12 (cost abuse) | Cache hit skips Apify call AND does not decrement quota | unit | `npx vitest run src/lib/services/__tests__/apify-cache.test.ts` (hit branch) | ❌ W0 | ⬜ pending |
| SC-4 (cache TTL) | REQ-01 | — | Entry older than 24h is treated as miss | unit (time-mocked) | Same file, time-mocked branch | ❌ W0 | ⬜ pending |
| SC-5 (free quota enforced) | REQ-04 | T-11 (quota bypass), T-12 (cost abuse) | 2nd scrape returns 402 | integration | `npx vitest run src/lib/services/__tests__/apify-quota.test.ts` (free path) | ❌ W0 | ⬜ pending |
| SC-5 (paid unlimited) | REQ-04 | — | starter/recommended users bypass quota check | integration | Same file, paid fixture | ❌ W0 | ⬜ pending |
| SC-5 (dashboard chip) | REQ-04 | — | Component renders correct remaining count | component | `npx vitest run src/components/results/__tests__/ApifyQuotaChip.test.tsx` (jsdom env) | ❌ W0 | ⬜ pending |
| SC-6 (private profile error) | REQ-01, REQ-03 | T-02 (PII exposure) | Apify returns empty items → 422 with localized key | integration | Mock Apify empty response in route.test.ts | ❌ W0 | ⬜ pending |
| SC-6 (invalid URL error) | REQ-01 | T-09 (SSRF) | Zod rejection → 400 with localized key | unit | Schema test | ❌ W0 | ⬜ pending |
| SC-6 (rate limit error) | REQ-01 | T-04 (rate-limit bypass) | Rate limiter trip → 429 with localized key | unit | `npx vitest run src/lib/services/__tests__/apify-rate-limit.test.ts` | ❌ W0 | ⬜ pending |
| SC-6 (circuit breaker open) | REQ-01 | T-06 (cascading failure) | Breaker OPEN → 503 with localized key | unit | Force breaker state, assert throw | ❌ W0 | ⬜ pending |
| SC-6 (i18n parity for errors) | REQ-01, REQ-03 | — | All 4 error keys exist in BOTH en.json and es.json | unit | `npx vitest run src/lib/i18n/__tests__/apify-keys-parity.test.ts` | ❌ W0 | ⬜ pending |
| SC-7 (bilingual output) | REQ-02, REQ-03 | — | Language detector output unchanged for EN vs ES profiles | integration | Orchestrator test with fixture variants | Reuse existing language-detect coverage | ⬜ pending |
| SC-8 (build passes) | all | — | Zero TS errors, zero new warnings | build gate | `npm run build` | — | ⬜ pending |
| SC-9 (Creala untouched) | REQ-04 | T-08 (auth bypass) | Webhook HMAC verification unchanged; only `apifyScrapeQuota: null` added to plan-update branches | regression | `npx vitest run src/app/api/webhooks/creala/__tests__/route.test.ts` | ❌ W0 (handler has no test today) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

### Test infrastructure install
- [ ] `npm install -D vitest @vitest/ui @vitejs/plugin-react happy-dom` (happy-dom for component tests)
- [ ] Create `vitest.config.ts` with paths, jsdom/happy-dom env, and module resolution matching `tsconfig.json`
- [ ] Add `"test": "vitest"` and `"test:run": "vitest run"` scripts to `package.json`
- [ ] Verify: `npx vitest run --help` exits 0

### Test fixtures (resolve A1–A4 from research assumptions log)
- [ ] `src/lib/services/__tests__/fixtures/apify-profile-sample.json` — captured from a real probe scrape of Isaac's LinkedIn profile (or a public test profile). **Isaac action**: run ONE manual probe scrape in Wave 0 and commit the JSON output.
- [ ] `src/lib/services/__tests__/fixtures/apify-profile-empty.json` — Apify empty-items response (private profile case)
- [ ] `src/lib/services/__tests__/fixtures/apify-profile-minimal.json` — profile with only headline + first experience (sparse data)

### New test files (stubs written in Wave 0, filled as work progresses)
- [ ] `src/lib/schemas/__tests__/linkedin-profile.test.ts` — Zod schema round-trip + URL validation
- [ ] `src/lib/services/__tests__/apify-cache.test.ts` — URL normalization + cache hit/miss + TTL expiry
- [ ] `src/lib/services/__tests__/apify-fingerprint.test.ts` — hash determinism + salt usage
- [ ] `src/lib/services/__tests__/linkedin-profile-formatter.test.ts` — fixture → section record + markdown
- [ ] `src/lib/services/__tests__/apify-quota.test.ts` — free/paid paths + anon tracking (Prisma mocked)
- [ ] `src/lib/services/__tests__/apify-scraper-client.test.ts` — circuit breaker + mocked ApifyClient
- [ ] `src/lib/services/__tests__/apify-rate-limit.test.ts` — rate limiter trip + 429 response
- [ ] `src/lib/services/__tests__/orchestrator-apify-path.test.ts` — preparsedLinkedinSections shortcut (LLM mocked)
- [ ] `src/app/api/scrape-linkedin/__tests__/route.test.ts` — full route integration with mocked client
- [ ] `src/app/api/webhooks/creala/__tests__/route.test.ts` — regression for the 1-line quota reset
- [ ] `src/lib/i18n/__tests__/apify-keys-parity.test.ts` — diff EN vs ES keys to enforce parity

### Supporting infra
- [ ] `src/lib/db/__mocks__/client.ts` — Prisma mock for unit tests (avoid real DB round-trip in unit tests)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CV upload flow still works | REQ-03 | End-to-end flow with real file upload + LLM calls — not cost-effective to run per commit | Upload `docs/sample-cv.pdf` on `/input`, select CV option, verify results page shows audit |
| Bilingual UX smoke | REQ-02, REQ-03 | Visual/tone checks that humans catch better than assertions | Submit a LinkedIn URL with `?lang=es` then `?lang=en`, compare dashboard copy + error messages + loading state |
| Paid tier quota (real Creala webhook) | REQ-04 | Exercises real payment webhook signing in a staging environment | Trigger a Creala test webhook; verify `User.apifyScrapeQuota` becomes `null` and dashboard flips to "Escaneos ilimitados" |
| Vercel Hobby 60s ceiling | SC-8 | Requires deployment to Vercel to validate Lambda timeout behavior | Deploy to staging, submit a real LinkedIn URL, confirm p95 Apify scrape latency stays under 60s |

---

## Validation Sign-Off

- [ ] All phase tasks have `<automated>` verify command or Wave 0 dependency listed
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (vitest install + fixtures + 11 test file stubs)
- [ ] No watch-mode flags in commands (must be `vitest run`, not `vitest`)
- [ ] Feedback latency < 30s for per-task runs, < 120s for full suite
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 completes and all test stubs exist

**Approval:** pending — will transition to approved once Wave 0 tasks ship
