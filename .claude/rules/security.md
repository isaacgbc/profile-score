---
paths:
  - "src/app/api/**"
  - "src/lib/services/admin-guard.ts"
  - "src/lib/services/admin-session.ts"
  - "src/lib/services/rate-limiter.ts"
  - "src/app/api/webhooks/**"
---
# Security Rules

- NEVER expose server-only env vars client-side. Only `NEXT_PUBLIC_*` vars are safe for the browser.
- Admin auth has two paths: header token (`x-admin-token`) and signed cookie (`ps_admin_session` HMAC-SHA256). Both checked by `assertAdmin()`.
- Creala webhook verification: ALWAYS verify HMAC-SHA256 signature before processing. Reject with 401 if invalid.
- Rate limiter is in-memory (single Lambda instance). 3 tiers: burst (5/1min), hourly (20/1hr), daily (50/24hr). Additional limiters for exports (10/min), regenerate (3/min), admin verify (3/min).
- Supabase Auth middleware refreshes session on every request. Session check via `createServerClient` in server components/actions.
- Owner allowlist (`ADMIN_ALLOWLIST_EMAILS`): auto-promotes plan to "recommended". Used for testing.
- NEVER log full user input to ErrorLog. Use `inputMeta` (sanitized: type, length, locale, flags).
- NEVER store raw API keys, passwords, or PII in any log or analytics event.
