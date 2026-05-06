import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { llmCircuitBreaker } from "@/lib/services/circuit-breaker";
import { logError } from "@/lib/services/error-logger";

type HealthStatus = "healthy" | "degraded" | "unhealthy";

export async function GET(request: Request) {
  const timestamp = new Date().toISOString();
  const uptimeSeconds = Math.floor(process.uptime());

  // ── Database check ──
  let dbStatus: "ok" | "error" = "ok";
  let dbLatencyMs = 0;
  let dbError: string | undefined;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (err) {
    dbStatus = "error";
    dbLatencyMs = -1;
    dbError = err instanceof Error ? err.message : "Unknown DB error";
  }

  // ── Circuit breaker check ──
  const circuitState = llmCircuitBreaker.getState();

  // ── Compute overall status ──
  let status: HealthStatus;
  if (dbStatus === "error") {
    status = "unhealthy";
  } else if (circuitState !== "CLOSED") {
    status = "degraded";
  } else {
    status = "healthy";
  }

  // Log only unhealthy state
  if (status === "unhealthy") {
    logError({
      level: "error",
      source: "api/health",
      message: `Health check failed: db=${dbStatus}${dbError ? ` (${dbError})` : ""}, circuit=${circuitState}`,
      code: "HEALTH_CHECK_FAILED",
      inputMeta: { dbStatus, dbLatencyMs, circuitState },
    });
  }

  // ── Temporary test: verify logError DB writes are working ──
  // TODO: Remove after confirming error_logs table receives entries
  const url = new URL(request.url);
  if (url.searchParams.get("testLog") === "1") {
    logError({
      level: "info",
      source: "api/health/test",
      message: "Test error log entry — verifying DB persistence",
      code: "HEALTH_CHECK_FAILED",
      inputMeta: { test: true, timestamp },
    });
  }

  const body = {
    status,
    timestamp,
    uptimeSeconds,
    checks: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        ...(dbError ? { error: dbError } : {}),
      },
      circuitBreaker: { state: circuitState },
    },
  };

  return NextResponse.json(body, {
    status: status === "unhealthy" ? 503 : 200,
  });
}
