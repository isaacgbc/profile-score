---
name: create-api-route
description: Scaffolds a new Next.js 15 API route with error logging, rate limiting, Zod validation, and admin auth (if needed). Use when creating new API endpoints, adding new backend functionality, or building new webhook handlers.
argument-hint: <path> e.g. "api/user/preferences"
allowed-tools: Read, Write, Edit, Bash(grep:*), Bash(find:*)
---

# Create API Route

When creating a new API route at `src/app/$ARGUMENTS/route.ts`:

## Steps

1. **Read existing patterns first:**
   - Read `src/app/api/audit/generate/route.ts` for generation route pattern
   - Read `src/app/api/admin/errors/route.ts` for admin route pattern
   - Read `src/app/api/webhooks/creala/route.ts` for webhook pattern

2. **Create the route file** with this structure:
   ```typescript
   import { NextRequest, NextResponse } from "next/server";
   import { prisma } from "@/lib/db/client";
   import { logError, extractRequestMeta } from "@/lib/services/error-logger";
   // Add Zod schema import if validating body
   // Add assertAdmin if admin route
   // Add rate limiter if public route
   ```

3. **Every handler MUST include:**
   - try/catch wrapping the entire body
   - `logError()` in catch with structured error code (`RESOURCE_ACTION_FAILED`)
   - `extractRequestMeta(request)` passed to logError
   - Appropriate HTTP status codes
   - Zod validation for request bodies

4. **For admin routes, add:**
   - `assertAdmin(request)` as first line
   - Import from `@/lib/services/admin-guard`

5. **For rate-limited routes, add:**
   - Rate limiter call before business logic
   - Import from `@/lib/services/rate-limiter`

6. **For dynamic params (Next.js 15):**
   ```typescript
   export async function GET(
     request: NextRequest,
     { params }: { params: Promise<{ id: string }> }
   ) {
     const { id } = await params;
   ```

7. **Verify:** Run `npm run build` to confirm no type errors.
