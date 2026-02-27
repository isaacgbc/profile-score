/**
 * Sprint 1: Before/After Benchmark Runner
 *
 * Runs the sprint1-eval harness twice:
 *   1. "before" — with current (old) prompts active
 *   2. "after"  — with new Sprint 1 prompts activated
 *
 * Produces a diff report comparing composite quality, per-dimension scores,
 * guard diagnostics, and Go/Hold recommendation.
 *
 * Reproducibility guarantees:
 * - Same 15 fixtures used in both runs
 * - forceFresh: true (no DB cache)
 * - Same LLM model targets (controlled by prompt registry modelTarget field)
 * - Pinned config snapshot logged at start
 *
 * Usage:
 *   npx tsx scripts/sprint1-benchmark.ts
 *
 * Outputs results to: sprint1-benchmark-results.json
 */

// Load environment variables
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

interface BenchmarkReport {
  timestamp: string;
  config: {
    fixtureCount: number;
    nodeVersion: string;
    anthropicKeySet: boolean;
  };
  before: BenchmarkPhase | null;
  after: BenchmarkPhase | null;
  diff: BenchmarkDiff | null;
  recommendation: string;
}

interface BenchmarkPhase {
  avgCompositeQuality: number;
  avgDimensions: Record<string, number>;
  avgOverallScore: number;
  avgDurationMs: number;
  totalFallbacks: number;
  invalidJsonCount: number;
  avgHallucinatedMetrics: number;
  avgBuzzwords: number;
  cvWordCountInRangeRate: number;
  goHold: { recommendation: string; reasons: string[] };
}

interface BenchmarkDiff {
  compositeQualityDelta: number;
  dimensionDeltas: Record<string, number>;
  overallScoreDelta: number;
  durationDelta: number;
  hallucinatedMetricsDelta: number;
  buzzwordsDelta: number;
}

/**
 * Extract JSON object from mixed stdout (dotenv injection, [diag] logs, etc.)
 * Finds the first `{` that starts a valid JSON block and parses it.
 */
function extractJson(output: string): unknown {
  // Find the first line that starts with `{` (the JSON report)
  const lines = output.split("\n");
  let jsonStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("{")) {
      jsonStart = i;
      break;
    }
  }
  if (jsonStart === -1) {
    throw new Error("No JSON object found in output");
  }
  // Take everything from the JSON start to the end
  const jsonStr = lines.slice(jsonStart).join("\n");
  return JSON.parse(jsonStr);
}

function runEvalHarness(): BenchmarkPhase | null {
  try {
    // Run eval harness; stderr (diagnostics) is discarded, only stdout captured
    const output = execSync(
      "npx tsx --tsconfig tsconfig.json src/lib/eval/sprint1-eval.ts --json 2>/dev/null",
      {
        encoding: "utf-8",
        timeout: 1_200_000, // 20 minutes
        env: { ...process.env },
        cwd: process.cwd(),
      }
    );

    const report = extractJson(output) as Record<string, any>;
    return {
      avgCompositeQuality: report.aggregates.avgCompositeQuality,
      avgDimensions: report.aggregates.avgDimensions,
      avgOverallScore: report.aggregates.avgOverallScore,
      avgDurationMs: report.aggregates.avgDurationMs,
      totalFallbacks: report.aggregates.totalFallbacks,
      invalidJsonCount: report.aggregates.invalidJsonCount,
      avgHallucinatedMetrics: report.aggregates.avgHallucinatedMetrics,
      avgBuzzwords: report.aggregates.avgBuzzwords,
      cvWordCountInRangeRate: report.aggregates.cvWordCountInRangeRate,
      goHold: report.goHold,
    };
  } catch (err) {
    console.error("Eval harness failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function getActivePromptVersions(): Promise<Record<string, number>> {
  const activePrompts = await prisma.promptRegistry.findMany({
    where: { status: "active", locale: "en" },
    select: { promptKey: true, version: true },
    orderBy: { version: "desc" },
  });

  const versions: Record<string, number> = {};
  for (const p of activePrompts) {
    // Highest version wins (in case both old and new are active)
    if (!versions[p.promptKey] || p.version > versions[p.promptKey]) {
      versions[p.promptKey] = p.version;
    }
  }
  return versions;
}

async function main() {
  console.log("=".repeat(70));
  console.log("  Sprint 1: Before/After Benchmark");
  console.log("=".repeat(70));

  // Config snapshot
  const configSnapshot = {
    fixtureCount: 15,
    nodeVersion: process.version,
    anthropicKeySet: !!process.env.ANTHROPIC_API_KEY,
  };
  console.log("\n  Config:");
  console.log(`    Fixtures: ${configSnapshot.fixtureCount}`);
  console.log(`    Node: ${configSnapshot.nodeVersion}`);
  console.log(`    API key set: ${configSnapshot.anthropicKeySet}`);

  // ── Phase 1: BEFORE (current prompts) ──
  console.log("\n" + "-".repeat(70));
  console.log("  PHASE 1: BEFORE (current prompts)");
  console.log("-".repeat(70));

  const beforeVersions = await getActivePromptVersions();
  console.log("  Active prompt versions:", JSON.stringify(beforeVersions, null, 2));

  console.log("  Running eval harness (this takes several minutes)...\n");
  const before = runEvalHarness();

  if (before) {
    console.log(`  Composite quality: ${before.avgCompositeQuality}`);
    console.log(`  Overall score avg: ${before.avgOverallScore}`);
    console.log(`  Go/Hold: ${before.goHold.recommendation}`);
  } else {
    console.log("  BEFORE phase failed — continuing to AFTER phase...");
  }

  // ── Activate Sprint 1 prompts ──
  console.log("\n  Activating Sprint 1 prompts...");
  try {
    execSync("npx tsx scripts/sprint1-activate-prompts.ts --activate-only", {
      encoding: "utf-8",
      cwd: process.cwd(),
    });
    console.log("  Sprint 1 prompts activated.");
  } catch (err) {
    console.error("  Failed to activate Sprint 1 prompts:", err);
    process.exit(1);
  }

  // ── Phase 2: AFTER (Sprint 1 prompts) ──
  console.log("\n" + "-".repeat(70));
  console.log("  PHASE 2: AFTER (Sprint 1 prompts)");
  console.log("-".repeat(70));

  const afterVersions = await getActivePromptVersions();
  console.log("  Active prompt versions:", JSON.stringify(afterVersions, null, 2));

  console.log("  Running eval harness (this takes several minutes)...\n");
  const after = runEvalHarness();

  if (after) {
    console.log(`  Composite quality: ${after.avgCompositeQuality}`);
    console.log(`  Overall score avg: ${after.avgOverallScore}`);
    console.log(`  Go/Hold: ${after.goHold.recommendation}`);
  } else {
    console.log("  AFTER phase failed.");
  }

  // ── Diff ──
  let diff: BenchmarkDiff | null = null;
  if (before && after) {
    diff = {
      compositeQualityDelta: Math.round((after.avgCompositeQuality - before.avgCompositeQuality) * 10) / 10,
      dimensionDeltas: {},
      overallScoreDelta: Math.round((after.avgOverallScore - before.avgOverallScore) * 10) / 10,
      durationDelta: after.avgDurationMs - before.avgDurationMs,
      hallucinatedMetricsDelta: Math.round((after.avgHallucinatedMetrics - before.avgHallucinatedMetrics) * 10) / 10,
      buzzwordsDelta: Math.round((after.avgBuzzwords - before.avgBuzzwords) * 10) / 10,
    };

    for (const dim of Object.keys(before.avgDimensions)) {
      diff.dimensionDeltas[dim] = Math.round(
        ((after.avgDimensions[dim] ?? 0) - (before.avgDimensions[dim] ?? 0)) * 10
      ) / 10;
    }
  }

  // ── Recommendation ──
  let recommendation = "UNKNOWN";
  if (after?.goHold.recommendation === "GO" && diff && diff.compositeQualityDelta >= 0) {
    recommendation = "GO — Run: npx tsx scripts/sprint1-activate-prompts.ts --finalize";
  } else if (after?.goHold.recommendation === "HOLD") {
    recommendation = "HOLD — Run: npx tsx scripts/sprint1-activate-prompts.ts --rollback";
  } else if (diff && diff.compositeQualityDelta < 0) {
    recommendation = "HOLD — Quality regressed. Run: npx tsx scripts/sprint1-activate-prompts.ts --rollback";
  }

  // ── Report ──
  const report: BenchmarkReport = {
    timestamp: new Date().toISOString(),
    config: configSnapshot,
    before,
    after,
    diff,
    recommendation,
  };

  // Save JSON
  const outputPath = "sprint1-benchmark-results.json";
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n  Results saved to: ${outputPath}`);

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("  BENCHMARK SUMMARY");
  console.log("=".repeat(70));

  if (before && after && diff) {
    const delta = (v: number) => (v >= 0 ? `+${v}` : `${v}`);

    console.log("\n  Metric                     Before    After     Delta");
    console.log("  " + "-".repeat(58));
    console.log(
      `  Composite Quality          ${String(before.avgCompositeQuality).padStart(6)}    ${String(after.avgCompositeQuality).padStart(6)}    ${delta(diff.compositeQualityDelta).padStart(6)}`
    );
    console.log(
      `  Overall Score              ${String(before.avgOverallScore).padStart(6)}    ${String(after.avgOverallScore).padStart(6)}    ${delta(diff.overallScoreDelta).padStart(6)}`
    );
    console.log(
      `  Avg Duration (ms)          ${String(before.avgDurationMs).padStart(6)}    ${String(after.avgDurationMs).padStart(6)}    ${delta(diff.durationDelta).padStart(6)}`
    );
    console.log(
      `  Avg Hallucinated Metrics   ${String(before.avgHallucinatedMetrics).padStart(6)}    ${String(after.avgHallucinatedMetrics).padStart(6)}    ${delta(diff.hallucinatedMetricsDelta).padStart(6)}`
    );
    console.log(
      `  Avg Buzzwords              ${String(before.avgBuzzwords).padStart(6)}    ${String(after.avgBuzzwords).padStart(6)}    ${delta(diff.buzzwordsDelta).padStart(6)}`
    );

    console.log("\n  Per-dimension deltas:");
    for (const [dim, d] of Object.entries(diff.dimensionDeltas)) {
      console.log(`    ${dim.padEnd(22)} ${delta(d)}`);
    }

    console.log(
      `\n  Invalid JSON: before=${before.invalidJsonCount}, after=${after.invalidJsonCount}`
    );
    console.log(
      `  Fallbacks: before=${before.totalFallbacks}, after=${after.totalFallbacks}`
    );
  }

  console.log(`\n  RECOMMENDATION: ${recommendation}`);
  console.log("=".repeat(70));
}

main()
  .catch((e) => {
    console.error("Benchmark failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
