---
name: debug-pipeline
description: Traces and debugs the 11-stage audit generation pipeline. Use when investigating generation failures, debugging specific pipeline stages, understanding why a user got a degraded result, or optimizing pipeline performance.
allowed-tools: Read, Bash(grep:*), Bash(find:*), Bash(curl:*)
---

# Debug Audit Pipeline

## Context

The pipeline in `src/lib/services/audit-orchestrator.ts` has 11 stages. Issues surface as:
- "We couldn't generate personalized results" → degradation gate (≥30% fallback)
- Partial results → individual stage failures with soft fallback
- Slow generation → timeout budget exceeded, stages skipped
- Incorrect rewrites → generation guards not catching issues

## Debug Steps

1. **Identify the failure point.** Check error logs for codes:
   - `GENERATION_FAILED` / `STREAM_FAILED` → route-level
   - `PARSE_LINKEDIN_FAILED` / `PARSE_CV_FAILED` → Stage 2
   - `LLM_SCORING_TIMEOUT` → Stage 4
   - `LLM_REWRITE_TIMEOUT` → Stage 7
   - `CIRCUIT_BREAKER_OPEN` → Circuit breaker tripped
   - `DEGRADATION_GATE_TRIGGERED` → Stage 10

2. **Trace the specific stage:**
   - Stage 1 (Cache): `src/lib/services/result-cache.ts`
   - Stage 2 (Parsing): `src/lib/services/linkedin-parser.ts`
   - Stage 3 (Prompts): `src/lib/services/prompt-resolver.ts`
   - Stage 4 (Scoring): LLM response + Zod validation in `src/lib/schemas/llm-output.ts`
   - Stage 5-6 (Entries): `src/lib/services/linkedin-experience-archetype.ts`
   - Stage 7 (Rewrites): strategy selection, timeout budgets
   - Stage 8 (Descriptor): Haiku, rarely fails
   - Stage 9 (Cover Letter): plan-gated, Sonnet
   - Stage 10 (Locking): `src/lib/services/unlock-matrix.ts`
   - Stage 11 (Cache Storage): silent failures

3. **Check circuit breaker state:** `CIRCUIT_STATE_CHANGE` warn logs.
4. **Check rate limiter:** 429 responses in error logs.
5. **Reproduce** with admin panel prompt editor if prompt-related.
