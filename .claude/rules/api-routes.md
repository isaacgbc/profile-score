---
paths:
  - "src/app/api/**"
---
# API Route Conventions

- Every API route exports named HTTP method handlers: GET, POST, PATCH, DELETE.
- Every route wraps its handler body in try/catch and calls `logError()` in the catch block with a structured error code.
- Error codes follow the pattern: `RESOURCE_ACTION_FAILED` (e.g., `GENERATION_FAILED`, `EXPORT_FAILED`, `WEBHOOK_INVALID`).
- Always extract request metadata with `extractRequestMeta(request)` and pass to `logError()`.
- Return `NextResponse.json()` with appropriate status codes. Never throw unhandled.
- Admin routes must call `assertAdmin(request)` from `src/lib/services/admin-guard.ts` as the first line.
- Validate request bodies with Zod schemas from `src/lib/schemas/` before processing.
- Rate-limited routes call the appropriate limiter from `src/lib/services/rate-limiter.ts` early.
- Dynamic route params in Next.js 15: `{ params }: { params: Promise<{ id: string }> }` — always await params.
