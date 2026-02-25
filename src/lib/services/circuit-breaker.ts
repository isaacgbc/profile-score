/**
 * Circuit Breaker v2 for LLM calls.
 *
 * States: CLOSED (normal) → OPEN (failing, auto-fallback) → HALF_OPEN (probing)
 *
 * v2 changes (production hotfix):
 * - Transient failures (429, timeout) tracked separately — do NOT open the breaker
 * - Only hard failures (parse errors, system errors, auth failures) count
 * - Larger window (50) and minimum samples (15) prevent false-positive trips
 * - Shorter cooldown (15s instead of 60s) for faster recovery
 * - Success streak in HALF_OPEN closes after 3 consecutive successes
 * - Rich diagnostic logging on every state transition
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerConfig {
  /** Number of recent calls to track */
  windowSize: number;
  /** Hard failure rate (0-1) to trigger OPEN */
  failureThreshold: number;
  /** Minimum calls in window before breaker can trip */
  minSamples: number;
  /** How long to stay OPEN before probing (ms) */
  cooldownMs: number;
  /** Consecutive successes in HALF_OPEN to fully close */
  successStreakToClose: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  windowSize: 50,
  failureThreshold: 0.6, // 60% hard failure rate → open
  minSamples: 15, // Need 15+ calls before tripping (one full request)
  cooldownMs: 15_000, // 15 seconds cooldown (was 60s)
  successStreakToClose: 3, // 3 successes in HALF_OPEN → close
};

/** Entry in the sliding window */
interface CallRecord {
  success: boolean;
  /** Transient = 429/timeout (retryable). Hard = parse/system/auth. */
  transient: boolean;
  timestamp: number;
}

class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = "CLOSED";
  private records: CallRecord[] = [];
  private openedAt: number = 0;
  private halfOpenSuccessStreak: number = 0;
  /** Reason the breaker last opened (for diagnostics) */
  private lastOpenReason: string = "";
  /** Breakdown of failure types when breaker opened */
  private lastOpenBreakdown: { hard: number; transient: number; total: number } = {
    hard: 0,
    transient: 0,
    total: 0,
  };

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Current state (handles OPEN → HALF_OPEN transition) */
  getState(): CircuitState {
    if (this.state === "OPEN") {
      if (Date.now() - this.openedAt >= this.config.cooldownMs) {
        this.state = "HALF_OPEN";
        this.halfOpenSuccessStreak = 0;
        console.log(
          `[CircuitBreaker] OPEN → HALF_OPEN (cooldown elapsed, probing)`
        );
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
    this.records.push({ success: true, transient: false, timestamp: Date.now() });
    this.trimWindow();

    if (this.state === "HALF_OPEN") {
      this.halfOpenSuccessStreak++;
      if (this.halfOpenSuccessStreak >= this.config.successStreakToClose) {
        this.state = "CLOSED";
        console.log(
          `[CircuitBreaker] HALF_OPEN → CLOSED (${this.halfOpenSuccessStreak} consecutive successes)`
        );
        this.halfOpenSuccessStreak = 0;
      }
    }
  }

  /**
   * Record a failed call.
   * @param transient - true for 429/timeout (retryable), false for hard failures
   */
  recordFailure(transient: boolean = false): void {
    this.records.push({ success: false, transient, timestamp: Date.now() });
    this.trimWindow();

    if (this.state === "HALF_OPEN") {
      // Any failure in HALF_OPEN → re-open (but with short cooldown)
      this.state = "OPEN";
      this.openedAt = Date.now();
      this.halfOpenSuccessStreak = 0;
      this.lastOpenReason = `probe_failed(transient=${transient})`;
      console.error(
        `[CircuitBreaker] HALF_OPEN → OPEN (probe failed, transient=${transient})`
      );
      return;
    }

    // In CLOSED state: only hard failures can trip the breaker
    if (this.state === "CLOSED" && !transient) {
      const stats = this.computeStats();
      if (
        stats.totalCalls >= this.config.minSamples &&
        stats.hardFailureRate >= this.config.failureThreshold
      ) {
        this.state = "OPEN";
        this.openedAt = Date.now();
        this.lastOpenReason = `hard_failure_rate=${(stats.hardFailureRate * 100).toFixed(1)}%`;
        this.lastOpenBreakdown = {
          hard: stats.hardFailures,
          transient: stats.transientFailures,
          total: stats.totalCalls,
        };
        console.error(
          `[CircuitBreaker] CLOSED → OPEN | ` +
            `hardFailures=${stats.hardFailures}/${stats.totalCalls} ` +
            `(${(stats.hardFailureRate * 100).toFixed(1)}%) | ` +
            `transientFailures=${stats.transientFailures} (not counted) | ` +
            `threshold=${(this.config.failureThreshold * 100).toFixed(0)}% | ` +
            `minSamples=${this.config.minSamples}`
        );
      }
    }
  }

  /** Compute detailed stats from the current window */
  private computeStats() {
    const totalCalls = this.records.length;
    let successes = 0;
    let hardFailures = 0;
    let transientFailures = 0;

    for (const r of this.records) {
      if (r.success) {
        successes++;
      } else if (r.transient) {
        transientFailures++;
      } else {
        hardFailures++;
      }
    }

    // Hard failure rate = hard failures / total calls (transients excluded from numerator)
    const hardFailureRate = totalCalls > 0 ? hardFailures / totalCalls : 0;

    return {
      totalCalls,
      successes,
      hardFailures,
      transientFailures,
      hardFailureRate,
    };
  }

  /** Public stats for monitoring and logging */
  getStats(): {
    state: CircuitState;
    totalCalls: number;
    successes: number;
    hardFailures: number;
    transientFailures: number;
    hardFailureRate: number;
    cooldownRemainingMs: number;
    lastOpenReason: string;
    lastOpenBreakdown: { hard: number; transient: number; total: number };
  } {
    const state = this.getState();
    const stats = this.computeStats();
    return {
      state,
      ...stats,
      cooldownRemainingMs:
        state === "OPEN"
          ? Math.max(0, this.config.cooldownMs - (Date.now() - this.openedAt))
          : 0,
      lastOpenReason: this.lastOpenReason,
      lastOpenBreakdown: this.lastOpenBreakdown,
    };
  }

  /** Legacy compat: failure rate (hard failures only) */
  getFailureRate(): number {
    return this.computeStats().hardFailureRate;
  }

  private trimWindow(): void {
    while (this.records.length > this.config.windowSize) {
      this.records.shift();
    }
  }
}

/** Singleton circuit breaker for LLM calls */
export const llmCircuitBreaker = new CircuitBreaker();
