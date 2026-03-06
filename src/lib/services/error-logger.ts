import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

// ── Error codes ────────────────────────────────────────────
export type ErrorCode =
  | "GENERATION_FAILED"
  | "GENERATION_DEGRADED"
  | "STREAM_FAILED"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "CIRCUIT_OPEN"
  | "EXPORT_FAILED"
  | "PDF_PARSE_FAILED"
  | "LLM_TIMEOUT"
  | "LLM_RATE_LIMITED"
  | "LLM_SCHEMA_INVALID"
  | "UNKNOWN";

export type ErrorLevel = "error" | "warn" | "fatal";

export interface LogErrorInput {
  level?: ErrorLevel;
  source: string; // e.g. "api/audit/generate"
  message: string;
  error?: unknown; // the caught error object
  code?: ErrorCode;
  statusCode?: number;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  locale?: string;
  /** Sanitized input metadata — never include raw user text, only sizes/flags */
  inputMeta?: Record<string, unknown>;
}

/**
 * Fire-and-forget error logger that persists to the `error_logs` table.
 * Never throws — safe to call in catch blocks without affecting the response.
 *
 * Also logs to console for Vercel's built-in log viewer.
 */
export function logError(input: LogErrorInput): void {
  const {
    level = "error",
    source,
    message,
    error,
    code,
    statusCode,
    requestId,
    userId,
    ip,
    userAgent,
    locale,
    inputMeta,
  } = input;

  // Extract stack trace from error object
  const stack =
    error instanceof Error ? error.stack?.slice(0, 4000) : undefined;

  // Console log for Vercel (always synchronous, never fails)
  const tag = `[${level.toUpperCase()}]`;
  console.error(
    `${tag} ${source} | ${code ?? "UNKNOWN"} | ${message}` +
      (requestId ? ` | reqId=${requestId}` : "") +
      (statusCode ? ` | status=${statusCode}` : "")
  );
  if (stack) {
    console.error(stack);
  }

  // Persist to DB — fire-and-forget (don't await, don't throw)
  prisma.errorLog
    .create({
      data: {
        level,
        source,
        message: message.slice(0, 2000),
        stack: stack?.slice(0, 4000),
        code: code ?? "UNKNOWN",
        statusCode,
        requestId,
        userId,
        ip: ip?.slice(0, 45), // IPv6 max
        userAgent: userAgent?.slice(0, 500),
        locale,
        inputMeta: (inputMeta as Prisma.InputJsonValue) ?? undefined,
      },
    })
    .catch((dbErr) => {
      // Last resort: if DB write fails, at least the console.error above was emitted
      console.error("[ErrorLogger] Failed to persist error log:", dbErr);
    });
}

// ── Helper: extract request metadata ─────────────────────
export function extractRequestMeta(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? undefined;
  return { ip, userAgent };
}
