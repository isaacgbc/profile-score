---
paths:
  - "prisma/**"
  - "src/lib/db/**"
  - "src/lib/services/error-logger.ts"
---
# Database & Prisma Rules

- NEVER create migration files. ALWAYS use `npx prisma db push` to sync schema changes.
- Import Prisma client ONLY from `src/lib/db/client.ts` (singleton pattern). Never `new PrismaClient()`.
- All models use `@map("snake_case")` for table names and `@map("snake_case")` for field names.
- Add appropriate indexes for fields used in WHERE clauses and ORDER BY.
- Supabase Storage for file uploads — use `src/lib/db/storage.ts` wrapper for signed URLs.
- ErrorLog writes are fire-and-forget via `logError()`. NEVER let a logging failure crash the request.
- Analytics events are fire-and-forget. NEVER block the user flow for telemetry.
- GenerationCache uses SHA-256 inputHash with 1hr TTL. The hash includes parser version.
- PromptRegistry: always query with `status="active"`. Prompts cascade: exact locale → fallback "en".
- After ANY schema.prisma change: run `npx prisma generate` then `npx prisma db push` then verify with `npm run build`.
