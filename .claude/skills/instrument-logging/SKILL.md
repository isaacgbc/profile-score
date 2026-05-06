---
name: instrument-logging
description: Adds structured error logging to any service file, API route, or pipeline stage. Use when instrumenting the orchestrator, adding observability, wiring error tracking into new or existing code, or when asked to improve error handling or monitoring.
argument-hint: <file-path> e.g. "src/lib/services/linkedin-parser.ts"
allowed-tools: Read, Write, Edit, Bash(grep:*), Bash(find:*)
---

# Instrument Error Logging

When adding logging to `$ARGUMENTS`:

## Steps

1. **Read the target file** fully to understand its error handling patterns.

2. **Read the error logger** at `src/lib/services/error-logger.ts` for the `logError()` signature and `extractRequestMeta()` helper.

3. **Read existing instrumented files** for patterns:
   - `src/app/api/audit/generate/route.ts` → `GENERATION_FAILED`
   - `src/app/api/audit/stream/route.ts` → `STREAM_FAILED`
   - `src/app/api/exports/create/route.ts` → `EXPORT_FAILED`

4. **Define structured error codes** for the target file:
   - Format: `RESOURCE_ACTION_FAILED` or `RESOURCE_ACTION_ERROR`
   - Examples: `PARSE_LINKEDIN_FAILED`, `LLM_SCORING_TIMEOUT`, `CIRCUIT_BREAKER_OPEN`

5. **Add logError() calls** at every catch block and error branch:
   ```typescript
   import { logError } from "@/lib/services/error-logger";

   logError({
     level: "error",
     source: "service-name",
     code: "ERROR_CODE",
     message: error instanceof Error ? error.message : "Unknown error",
     stack: error instanceof Error ? error.stack : undefined,
     inputMeta: {
       inputType: "linkedin" | "cv",
       inputLength: input?.length,
       locale: locale,
       hasJobDescription: !!jobDescription,
     },
   });
   ```

6. **For services without Request object**, omit `requestId`, `userId`, `ip`, `userAgent` fields.

7. **For circuit breaker state transitions**, log as "warn" level:
   ```typescript
   logError({ level: "warn", source: "circuit-breaker", code: "CIRCUIT_STATE_CHANGE", message: `State: ${oldState} → ${newState}` });
   ```

8. **Verify:** Run `npm run build` to confirm no type errors.
9. **Verify logging works:** Check that `logError()` is fire-and-forget (no await, no try/catch wrapping the log call itself).
