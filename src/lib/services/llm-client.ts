import Anthropic from "@anthropic-ai/sdk";
import { llmCircuitBreaker } from "./circuit-breaker";
import { trackServerEvent } from "@/lib/analytics/server-tracker";

// ── Model configuration (env-configurable with safe fallbacks) ──
export const LLM_MODEL_FAST =
  process.env.LLM_MODEL_FAST ?? "claude-haiku-4-5-20251001";
export const LLM_MODEL_QUALITY =
  process.env.LLM_MODEL_QUALITY ?? "claude-sonnet-4-20250514";

// ── Timeouts per model tier ──
const TIMEOUT_FAST_MS = 30_000;
const TIMEOUT_QUALITY_MS = 60_000;

// ── Singleton client ──
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ── Public interface ──
export interface LLMCallParams {
  model: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  /** External abort signal — e.g. for parser timeout (10 s) */
  signal?: AbortSignal;
}

export interface LLMCallResult {
  text: string;
  modelUsed: string;
  durationMs: number;
}

/**
 * Call Anthropic Claude with a system prompt and user message.
 * Returns the text response, the model used, and duration in ms.
 *
 * Integrates with circuit breaker:
 * - If breaker is OPEN → throws immediately (caller falls back to mock)
 * - Records success/failure for breaker state transitions
 */
export async function callLLM(params: LLMCallParams): Promise<LLMCallResult> {
  const { model, systemPrompt, userMessage, maxTokens = 2048, signal: externalSignal } = params;

  // ── Circuit breaker check ──
  if (!llmCircuitBreaker.allowRequest()) {
    const stats = llmCircuitBreaker.getStats();
    console.warn(
      `[LLM] Circuit breaker OPEN — skipping call. Cooldown: ${stats.cooldownRemainingMs}ms`
    );
    // Fire-and-forget alert event
    trackServerEvent("llm_circuit_breaker_open", {
      metadata: {
        model,
        failureRate: stats.failureRate,
        cooldownRemainingMs: stats.cooldownRemainingMs,
      },
    });
    throw new Error("LLM circuit breaker is open — auto-fallback active");
  }

  const client = getClient();

  const timeoutMs =
    model === LLM_MODEL_FAST ? TIMEOUT_FAST_MS : TIMEOUT_QUALITY_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // If an external signal is provided (e.g. parser 10 s timeout), propagate abort
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  const start = Date.now();

  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      },
      { signal: controller.signal }
    );

    const durationMs = Date.now() - start;
    console.log(`LLM call: ${model} ${durationMs}ms`);

    // Extract text from response
    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "";

    // ── Record success with circuit breaker ──
    llmCircuitBreaker.recordSuccess();

    return { text, modelUsed: model, durationMs };
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    // Sanitize error — never log API key
    const message =
      err instanceof Error ? err.message.replace(/sk-ant-[^\s"']*/g, "[REDACTED]") : "Unknown LLM error";
    console.error(`LLM call failed: ${model} ${durationMs}ms — ${message}`);

    // ── Record failure with circuit breaker ──
    llmCircuitBreaker.recordFailure();

    throw new Error(`LLM call failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}
