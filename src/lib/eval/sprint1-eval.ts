/**
 * Sprint 1: Quality Evaluation Harness
 *
 * Runs all 15 fixtures through the audit orchestrator and computes
 * per-section quality dimension scores (6 dimensions + composite).
 *
 * Outputs:
 * - Per-fixture composite score
 * - Per-dimension averages across all fixtures
 * - Guard diagnostics (buzzwords, hallucinated metrics, word count)
 * - Go/Hold recommendation
 *
 * Usage: npx tsx --tsconfig tsconfig.json src/lib/eval/sprint1-eval.ts
 *        npx tsx --tsconfig tsconfig.json src/lib/eval/sprint1-eval.ts --json
 *
 * The --json flag outputs machine-readable results for benchmark diffing.
 */

// Load environment variables from .env.local
import { config } from "dotenv";
config({ path: ".env.local", override: true });

// When --json flag is set, redirect console.log to stderr so only
// the final JSON report goes to stdout (clean for JSON.parse in benchmark).
const isJsonMode = process.argv.includes("--json");
if (isJsonMode) {
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    // All orchestrator [diag] logs and other chatter go to stderr
    process.stderr.write(args.map(String).join(" ") + "\n");
  };
  // We'll use process.stdout.write for the final JSON output
  (globalThis as any).__sprint1EvalStdout = (s: string) => process.stdout.write(s);
} else {
  (globalThis as any).__sprint1EvalStdout = (s: string) => process.stdout.write(s);
}

import { EVAL_FIXTURES, type EvalFixture } from "./fixtures";
import { generateAuditResults, type GenerationResult } from "../services/audit-orchestrator";
import {
  scoreAllDimensions,
  type CompositeDimensionResult,
} from "./quality-dimensions";
import {
  detectBuzzwords,
  detectHallucinatedMetrics,
  checkCvDocumentWordCount,
  countMetricTags,
} from "../services/generation-guards";

// ── Types ───────────────────────────────────────────────

interface SectionQuality {
  sectionId: string;
  source: "linkedin" | "cv";
  dimensions: CompositeDimensionResult;
}

interface GuardDiagnostics {
  buzzwordsDetected: string[];
  hallucinatedMetricCount: number;
  hallucinatedMetrics: string[];
  hallucinationSeverity: string;
  addMetricTags: number;
  needsVerificationTags: number;
  cvWordCount: number | null;
  cvWordCountInRange: boolean | null;
}

interface FixtureEvalResult {
  name: string;
  overallScore: number;
  tier: string;
  compositeQuality: number; // 0-100
  dimensionAverages: Record<string, number>;
  sectionQualities: SectionQuality[];
  guards: GuardDiagnostics;
  durationMs: number;
  fallbackCount: number;
  invalidJson: boolean;
  errors: string[];
}

export interface Sprint1EvalReport {
  timestamp: string;
  fixtureCount: number;
  results: FixtureEvalResult[];
  aggregates: {
    avgCompositeQuality: number;
    avgDimensions: Record<string, number>;
    avgOverallScore: number;
    avgDurationMs: number;
    totalFallbacks: number;
    invalidJsonCount: number;
    avgHallucinatedMetrics: number;
    avgBuzzwords: number;
    cvWordCountInRangeRate: number;
  };
  goHold: {
    recommendation: "GO" | "HOLD";
    reasons: string[];
  };
}

// ── Dimension names ─────────────────────────────────────

const DIMENSION_NAMES = [
  "factuality",
  "specificity",
  "actionability",
  "objectiveAlignment",
  "readability",
  "atsSafety",
] as const;

// ── Run a single fixture ────────────────────────────────

async function evalFixture(fixture: EvalFixture): Promise<FixtureEvalResult> {
  const errors: string[] = [];
  let invalidJson = false;

  const objectiveContext =
    (fixture.objectiveMode ?? "job") === "job"
      ? fixture.jobDescription
      : fixture.objectiveText ?? "";

  let genResult: GenerationResult;
  try {
    genResult = await generateAuditResults(
      {
        linkedinText: fixture.linkedinText,
        cvText: fixture.cvText,
        jobDescription: fixture.jobDescription,
        targetAudience: fixture.targetAudience,
        objectiveMode: fixture.objectiveMode ?? "job",
        objectiveText: fixture.objectiveText ?? "",
        planId: "coach",
        isAdmin: true,
        forceFresh: true, // Reproducibility: never use cache
      },
      "en"
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("JSON") || msg.includes("parse")) invalidJson = true;
    return {
      name: fixture.name,
      overallScore: 0,
      tier: "error",
      compositeQuality: 0,
      dimensionAverages: {},
      sectionQualities: [],
      guards: {
        buzzwordsDetected: [],
        hallucinatedMetricCount: 0,
        hallucinatedMetrics: [],
        hallucinationSeverity: "none",
        addMetricTags: 0,
        needsVerificationTags: 0,
        cvWordCount: null,
        cvWordCountInRange: null,
      },
      durationMs: 0,
      fallbackCount: 0,
      invalidJson,
      errors: [`Generation error: ${msg}`],
    };
  }

  const { results, meta } = genResult;

  // ── Score each section's quality ──
  const sectionQualities: SectionQuality[] = [];
  const allRewrites = [...results.linkedinRewrites, ...results.cvRewrites];
  const allSections = [...results.linkedinSections, ...results.cvSections];

  for (const section of allSections) {
    const rewrite = allRewrites.find((r) => r.sectionId === section.id);
    if (!rewrite) continue;

    const isCv = results.cvSections.some((s) => s.id === section.id);
    const dims = scoreAllDimensions(
      rewrite.original,
      rewrite.rewritten,
      section.explanation,
      section.improvementSuggestions,
      objectiveContext,
      isCv
    );

    sectionQualities.push({
      sectionId: section.id,
      source: isCv ? "cv" : "linkedin",
      dimensions: dims,
    });
  }

  // ── Compute dimension averages ──
  const dimensionAverages: Record<string, number> = {};
  for (const dim of DIMENSION_NAMES) {
    const scores = sectionQualities.map((sq) => sq.dimensions[dim].score);
    dimensionAverages[dim] =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : 0;
  }

  const compositeScores = sectionQualities.map((sq) => sq.dimensions.composite);
  const compositeQuality =
    compositeScores.length > 0
      ? Math.round(compositeScores.reduce((a, b) => a + b, 0) / compositeScores.length)
      : 0;

  // ── Guard diagnostics ──
  const allRewriteTexts = allRewrites.map((r) => r.rewritten);
  const combinedRewriteText = allRewriteTexts.join(" ");

  const buzzwordsDetected = detectBuzzwords(combinedRewriteText);

  let totalHallucinated = 0;
  const allHallucinatedMetrics: string[] = [];
  let worstSeverity: "none" | "low" | "high" = "none";
  for (const rewrite of allRewrites) {
    const h = detectHallucinatedMetrics(rewrite.original, rewrite.rewritten);
    totalHallucinated += h.count;
    allHallucinatedMetrics.push(...h.metrics);
    if (h.severity === "high") worstSeverity = "high";
    else if (h.severity === "low" && worstSeverity === "none") worstSeverity = "low";
  }

  const metricTags = countMetricTags(combinedRewriteText);

  // CV word count
  const cvRewriteTexts = results.cvRewrites.map((r) => r.rewritten);
  let cvWordCount: number | null = null;
  let cvWordCountInRange: boolean | null = null;
  if (cvRewriteTexts.length > 0) {
    const wc = checkCvDocumentWordCount(cvRewriteTexts);
    cvWordCount = wc.wordCount;
    cvWordCountInRange = wc.inRange;
  }

  return {
    name: fixture.name,
    overallScore: results.overallScore,
    tier: results.tier,
    compositeQuality,
    dimensionAverages,
    sectionQualities,
    guards: {
      buzzwordsDetected,
      hallucinatedMetricCount: totalHallucinated,
      hallucinatedMetrics: allHallucinatedMetrics,
      hallucinationSeverity: worstSeverity,
      addMetricTags: metricTags.addMetric,
      needsVerificationTags: metricTags.needsVerification,
      cvWordCount,
      cvWordCountInRange,
    },
    durationMs: meta.durationMs,
    fallbackCount: meta.fallbackCount,
    invalidJson,
    errors,
  };
}

// ── Go/Hold logic ───────────────────────────────────────

function computeGoHold(
  results: FixtureEvalResult[],
  baselineComposite?: number,
  baselineInvalidJson?: number,
  baselineHallucinatedAvg?: number
): { recommendation: "GO" | "HOLD"; reasons: string[] } {
  const reasons: string[] = [];
  let hold = false;

  // 1. Composite quality must be > baseline (or > 55 absolute if no baseline)
  const avgComposite =
    results.reduce((s, r) => s + r.compositeQuality, 0) / results.length;

  if (baselineComposite !== undefined) {
    if (avgComposite < baselineComposite) {
      hold = true;
      reasons.push(
        `Composite quality ${avgComposite.toFixed(1)} is below baseline ${baselineComposite.toFixed(1)}`
      );
    } else {
      reasons.push(
        `Composite quality ${avgComposite.toFixed(1)} >= baseline ${baselineComposite.toFixed(1)}`
      );
    }
  } else {
    if (avgComposite < 55) {
      hold = true;
      reasons.push(`Composite quality ${avgComposite.toFixed(1)} is below 55 threshold`);
    }
  }

  // 2. Per-dimension minimums (each must average >= 4.0)
  const dimTotals: Record<string, number[]> = {};
  for (const r of results) {
    for (const [dim, val] of Object.entries(r.dimensionAverages)) {
      if (!dimTotals[dim]) dimTotals[dim] = [];
      dimTotals[dim].push(val);
    }
  }
  for (const [dim, vals] of Object.entries(dimTotals)) {
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (avg < 4.0) {
      hold = true;
      reasons.push(`${dim} avg ${avg.toFixed(1)} is below 4.0 minimum`);
    }
  }

  // 3. invalid_json rate
  const invalidJsonCount = results.filter((r) => r.invalidJson).length;
  const invalidJsonRate = invalidJsonCount / results.length;
  if (baselineInvalidJson !== undefined) {
    if (invalidJsonRate > baselineInvalidJson) {
      hold = true;
      reasons.push(
        `invalid_json rate ${(invalidJsonRate * 100).toFixed(1)}% increased vs baseline ${(baselineInvalidJson * 100).toFixed(1)}%`
      );
    }
  } else if (invalidJsonRate > 0.1) {
    hold = true;
    reasons.push(`invalid_json rate ${(invalidJsonRate * 100).toFixed(1)}% exceeds 10%`);
  }

  // 4. hallucinatedMetricCount average
  const avgHallucinated =
    results.reduce((s, r) => s + r.guards.hallucinatedMetricCount, 0) / results.length;
  if (baselineHallucinatedAvg !== undefined) {
    if (avgHallucinated > baselineHallucinatedAvg * 1.2) {
      hold = true;
      reasons.push(
        `Avg hallucinated metrics ${avgHallucinated.toFixed(1)} > 120% of baseline ${baselineHallucinatedAvg.toFixed(1)}`
      );
    }
  } else if (avgHallucinated > 3.0) {
    hold = true;
    reasons.push(`Avg hallucinated metrics ${avgHallucinated.toFixed(1)} exceeds 3.0`);
  }

  if (!hold) {
    reasons.push("All thresholds met");
  }

  return { recommendation: hold ? "HOLD" : "GO", reasons };
}

// ── Main runner ─────────────────────────────────────────

async function main() {
  const isJson = process.argv.includes("--json");

  if (!isJson) {
    console.log("=".repeat(70));
    console.log("  Sprint 1: Quality Evaluation Harness");
    console.log("=".repeat(70));
    console.log(`Running ${EVAL_FIXTURES.length} fixtures...\n`);
  }

  const evalResults: FixtureEvalResult[] = [];

  for (const fixture of EVAL_FIXTURES) {
    if (!isJson) {
      process.stdout.write(`  Running: ${fixture.name}... `);
    }

    const result = await evalFixture(fixture);
    evalResults.push(result);

    if (!isJson) {
      if (result.errors.length === 0) {
        console.log(
          `DONE (score: ${result.overallScore}, quality: ${result.compositeQuality}, ${result.durationMs}ms)`
        );
      } else {
        console.log(`ERROR (${result.durationMs}ms)`);
        for (const err of result.errors) {
          console.log(`    -> ${err}`);
        }
      }
    }
  }

  // ── Aggregates ──
  const avgComposite =
    evalResults.reduce((s, r) => s + r.compositeQuality, 0) / evalResults.length;

  const avgDimensions: Record<string, number> = {};
  for (const dim of DIMENSION_NAMES) {
    const vals = evalResults
      .flatMap((r) => Object.entries(r.dimensionAverages))
      .filter(([d]) => d === dim)
      .map(([, v]) => v);
    avgDimensions[dim] =
      vals.length > 0
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : 0;
  }

  const avgOverallScore =
    Math.round(
      (evalResults.reduce((s, r) => s + r.overallScore, 0) / evalResults.length) * 10
    ) / 10;

  const avgDurationMs = Math.round(
    evalResults.reduce((s, r) => s + r.durationMs, 0) / evalResults.length
  );

  const totalFallbacks = evalResults.reduce((s, r) => s + r.fallbackCount, 0);
  const invalidJsonCount = evalResults.filter((r) => r.invalidJson).length;
  const avgHallucinatedMetrics =
    Math.round(
      (evalResults.reduce((s, r) => s + r.guards.hallucinatedMetricCount, 0) /
        evalResults.length) *
        10
    ) / 10;

  const avgBuzzwords =
    Math.round(
      (evalResults.reduce((s, r) => s + r.guards.buzzwordsDetected.length, 0) /
        evalResults.length) *
        10
    ) / 10;

  const cvFixtures = evalResults.filter((r) => r.guards.cvWordCount !== null);
  const cvWordCountInRangeRate =
    cvFixtures.length > 0
      ? cvFixtures.filter((r) => r.guards.cvWordCountInRange === true).length /
        cvFixtures.length
      : 0;

  const goHold = computeGoHold(evalResults);

  const report: Sprint1EvalReport = {
    timestamp: new Date().toISOString(),
    fixtureCount: evalResults.length,
    results: evalResults,
    aggregates: {
      avgCompositeQuality: Math.round(avgComposite * 10) / 10,
      avgDimensions,
      avgOverallScore,
      avgDurationMs,
      totalFallbacks,
      invalidJsonCount,
      avgHallucinatedMetrics,
      avgBuzzwords,
      cvWordCountInRangeRate: Math.round(cvWordCountInRangeRate * 100),
    },
    goHold,
  };

  if (isJson) {
    // Write JSON directly to stdout (console.log is redirected to stderr in --json mode)
    (globalThis as any).__sprint1EvalStdout(JSON.stringify(report, null, 2) + "\n");
    return;
  }

  // ── Human-readable report ──
  console.log("\n" + "=".repeat(70));
  console.log("  QUALITY REPORT");
  console.log("=".repeat(70));

  console.log(`\n  Average composite quality: ${avgComposite.toFixed(1)} / 100`);
  console.log(`  Average overall score: ${avgOverallScore}`);
  console.log(`  Average duration: ${avgDurationMs}ms`);
  console.log(`  Total fallbacks: ${totalFallbacks}`);
  console.log(`  Invalid JSON errors: ${invalidJsonCount}`);

  console.log("\n  Per-dimension averages:");
  for (const [dim, avg] of Object.entries(avgDimensions)) {
    const bar = "█".repeat(Math.round(avg)) + "░".repeat(10 - Math.round(avg));
    console.log(`    ${dim.padEnd(22)} ${bar} ${avg.toFixed(1)}/10`);
  }

  console.log("\n  Guard diagnostics:");
  console.log(`    Avg hallucinated metrics:  ${avgHallucinatedMetrics}`);
  console.log(`    Avg buzzwords per fixture: ${avgBuzzwords}`);
  console.log(`    CV word count in range:    ${Math.round(cvWordCountInRangeRate * 100)}%`);

  // Per-fixture table
  console.log("\n  Per-fixture results:");
  console.log("  " + "-".repeat(66));
  console.log(
    `  ${"Fixture".padEnd(38)} ${"Score".padStart(5)} ${"Quality".padStart(7)} ${"Time".padStart(7)} ${"Halluc".padStart(6)}`
  );
  console.log("  " + "-".repeat(66));
  for (const r of evalResults) {
    const name = r.name.length > 37 ? r.name.slice(0, 34) + "..." : r.name;
    console.log(
      `  ${name.padEnd(38)} ${String(r.overallScore).padStart(5)} ${String(r.compositeQuality).padStart(7)} ${(r.durationMs + "ms").padStart(7)} ${String(r.guards.hallucinatedMetricCount).padStart(6)}`
    );
  }
  console.log("  " + "-".repeat(66));

  // Go/Hold
  console.log("\n  GO/HOLD RECOMMENDATION:");
  console.log(`    ${goHold.recommendation === "GO" ? "GO" : "HOLD"}`);
  for (const reason of goHold.reasons) {
    console.log(`    - ${reason}`);
  }

  console.log("\n" + "=".repeat(70));
}

main().catch((err) => {
  console.error("Sprint1 eval failed:", err);
  process.exit(2);
});
