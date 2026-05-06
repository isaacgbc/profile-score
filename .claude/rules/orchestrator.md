---
paths:
  - "src/lib/services/audit-orchestrator.ts"
  - "src/lib/services/llm-client.ts"
  - "src/lib/services/circuit-breaker.ts"
  - "src/lib/services/generation-guards.ts"
---
# Orchestrator & LLM Pipeline Rules

- The orchestrator is 3,687 lines with an 11-stage pipeline. READ THE FULL FILE before making changes. Understand which stage you're modifying and its dependencies.
- Every LLM call must respect the timeout budget: Haiku 30s, Sonnet 60s. Use AbortSignal for parser timeouts.
- Circuit breaker only counts HARD failures (parse failure, auth error, system error). Transient failures (429, timeout, socket hang) trigger retry but NOT circuit breaker.
- Retry chain per section: Attempt 1 (normal) → Attempt 2 (+ explicit JSON instruction) → Attempt 3 (+ stricter constraints).
- Rewrite strategy: Full Sonnet (20s, 2 attempts, integrity check) vs Fast Haiku (8s, 1 attempt, no integrity check) vs Fast Headline (Haiku, 8s, high-confidence archetype only).
- Degradation gate: fallbackCount >= 30% of expected sections → degraded=true. When modifying this threshold, log the trigger event.
- Entry cap: 20 entries max in any single LLM call. Remaining entries pass through unchanged.
- Global orchestration budget: 45s. Non-essential stages are skipped if budget is exceeded.
- All stages must report to `logError()` with structured error codes and `inputMeta` (sanitized: input type, length, locale, hasJobDescription).
- NEVER fake results. Zero-mock policy: if scoring fails, the section is omitted.
- Cache uses SHA-256 hash that includes parser version (currently v3.7). Changing parser logic MUST bump the version.
