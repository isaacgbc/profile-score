/**
 * Circuit Breaker for LLM calls.
 *
 * States: CLOSED (normal) → OPEN (failing, auto-fallback) → HALF_OPEN (probing)
 *
 * When failure rate exceeds threshold within the window, the breaker opens
 * and all calls fall back to mock data for a cooldown period.
 * After cooldown, it enters HALF_OPEN and allows one probe call.
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerConfig {
  /** Number of recent calls to track */
  windowSize: number;
  /** Failure rate (0-1) to trigger OPEN */
  failureThreshold: number;
  /** How long to stay OPEN before probing (ms) */
  cooldownMs: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  windowSize: 20,
  failureThreshold: 0.5, // 50% failure rate → open
  cooldownMs: 60_000, // 1 minute cooldown
};

class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = "CLOSED";
  private results: boolean[] = []; // true = success, false = failure
  private openedAt: number = 0;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Current state */
  getState(): CircuitState {
    // Check if OPEN → HALF_OPEN transition is due
    if (this.state === "OPEN") {
      if (Date.now() - this.openedAt >= this.config.cooldownMs) {
        this.state = "HALF_OPEN";
      }
    }
    return this.state;
  }

  /** Whether calls should be allowed (CLOSED or HALF_OPEN) */
  allowRequest(): boolean {
    const state = this.getState();
    return state === "CLOSED" || state === "HALF_OPEN";
  }

  /** Record a successful call */
  recordSuccess(): void {
    this.results.push(true);
    this.trimWindow();

    if (this.state === "HALF_OPEN") {
      // Probe succeeded → close
      this.state = "CLOSED";
      console.log("[CircuitBreaker] HALF_OPEN → CLOSED (probe succeeded)");
    }
  }

  /** Record a failed call */
  recordFailure(): void {
    this.results.push(false);
    this.trimWindow();

    if (this.state === "HALF_OPEN") {
      // Probe failed → re-open
      this.state = "OPEN";
      this.openedAt = Date.now();
      console.error("[CircuitBreaker] HALF_OPEN → OPEN (probe failed)");
      return;
    }

    // Check if failure threshold is exceeded
    if (this.state === "CLOSED") {
      const failureRate = this.getFailureRate();
      if (
        this.results.length >= 5 && // Need at least 5 calls before tripping
        failureRate >= this.config.failureThreshold
      ) {
        this.state = "OPEN";
        this.openedAt = Date.now();
        console.error(
          `[CircuitBreaker] CLOSED → OPEN (failure rate: ${(failureRate * 100).toFixed(1)}%)`
        );
      }
    }
  }

  /** Current failure rate (0-1) */
  getFailureRate(): number {
    if (this.results.length === 0) return 0;
    const failures = this.results.filter((r) => !r).length;
    return failures / this.results.length;
  }

  /** Stats for monitoring */
  getStats(): {
    state: CircuitState;
    failureRate: number;
    totalCalls: number;
    cooldownRemainingMs: number;
  } {
    const state = this.getState();
    return {
      state,
      failureRate: this.getFailureRate(),
      totalCalls: this.results.length,
      cooldownRemainingMs:
        state === "OPEN"
          ? Math.max(0, this.config.cooldownMs - (Date.now() - this.openedAt))
          : 0,
    };
  }

  private trimWindow(): void {
    while (this.results.length > this.config.windowSize) {
      this.results.shift();
    }
  }
}

/** Singleton circuit breaker for LLM calls */
export const llmCircuitBreaker = new CircuitBreaker();
