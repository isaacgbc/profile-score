/**
 * Evaluation harness — runs all test fixtures through the audit orchestrator.
 *
 * Usage: npx tsx --tsconfig tsconfig.json src/lib/eval/run-eval.ts
 *
 * Checks:
 * - Score within expected range
 * - Tier matches expected
 * - All LinkedIn sections present
 * - Zod validation passes
 * - Average generation time
 * - Fallback count
 */

import { EVAL_FIXTURES, type EvalFixture } from "./fixtures";
import { generateAuditResults, type GenerationResult } from "../services/audit-orchestrator";
import { AuditSectionOutput } from "../schemas/llm-output";

// ── Result type ─────────────────────────────────────────
interface FixtureResult {
  name: string;
  passed: boolean;
  overallScore: number;
  tier: string;
  sectionCount: number;
  durationMs: number;
  fallbackCount: number;
  errors: string[];
}

// ── Run a single fixture ─────────────────────────────────
async function runFixture(fixture: EvalFixture): Promise<FixtureResult> {
  const errors: string[] = [];

  let genResult: GenerationResult;
  try {
    genResult = await generateAuditResults(
      {
        linkedinText: fixture.linkedinText,
        cvText: fixture.cvText,
        jobDescription: fixture.jobDescription,
        targetAudience: fixture.targetAudience,
        objectiveMode: "job",
        objectiveText: "",
        planId: "coach", // Unlock everything for eval
        isAdmin: true,
      },
      "en"
    );
  } catch (err) {
    return {
      name: fixture.name,
      passed: false,
      overallScore: 0,
      tier: "error",
      sectionCount: 0,
      durationMs: 0,
      fallbackCount: 0,
      errors: [`Generation error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const { results, meta } = genResult;

  // Check score range
  const [minScore, maxScore] = fixture.expectedScoreRange;
  if (results.overallScore < minScore || results.overallScore > maxScore) {
    errors.push(
      `Score ${results.overallScore} outside expected range [${minScore}, ${maxScore}]`
    );
  }

  // Check tier
  if (!fixture.expectedTiers.includes(results.tier)) {
    errors.push(
      `Tier "${results.tier}" not in expected [${fixture.expectedTiers.join(", ")}]`
    );
  }

  // Check sections present
  if (results.linkedinSections.length === 0 && fixture.linkedinText.trim().length > 50) {
    errors.push("No LinkedIn sections generated despite having input text");
  }

  // Validate each section with Zod
  for (const section of [...results.linkedinSections, ...results.cvSections]) {
    const validation = AuditSectionOutput.safeParse({
      score: section.score,
      tier: section.tier === "fair" ? "needs-work" : section.tier, // reverse normalize for validation
      explanation: section.explanation,
      suggestions: section.improvementSuggestions,
    });
    if (!validation.success) {
      errors.push(`Section "${section.id}" failed Zod validation: ${validation.error.message}`);
    }
  }

  // Check for rewrites
  if (results.linkedinRewrites.length === 0 && results.linkedinSections.length > 0) {
    errors.push("No LinkedIn rewrites generated despite having scored sections");
  }

  return {
    name: fixture.name,
    passed: errors.length === 0,
    overallScore: results.overallScore,
    tier: results.tier,
    sectionCount: results.linkedinSections.length + results.cvSections.length,
    durationMs: meta.durationMs,
    fallbackCount: meta.fallbackCount,
    errors,
  };
}

// ── Main runner ──────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("  Profile Score — LLM Evaluation Harness");
  console.log("=".repeat(60));
  console.log(`Running ${EVAL_FIXTURES.length} fixtures...\n`);

  const fixtureResults: FixtureResult[] = [];
  let totalPassed = 0;
  let totalDuration = 0;
  let totalFallbacks = 0;

  for (const fixture of EVAL_FIXTURES) {
    process.stdout.write(`  Running: ${fixture.name}... `);
    const result = await runFixture(fixture);
    fixtureResults.push(result);

    if (result.passed) {
      totalPassed++;
      console.log(`PASS (score: ${result.overallScore}, ${result.durationMs}ms)`);
    } else {
      console.log(`FAIL (score: ${result.overallScore}, ${result.durationMs}ms)`);
      for (const err of result.errors) {
        console.log(`    ❌ ${err}`);
      }
    }

    totalDuration += result.durationMs;
    totalFallbacks += result.fallbackCount;
  }

  // ── Summary Report ─────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  EVALUATION REPORT");
  console.log("=".repeat(60));
  console.log(
    `\n  Passed: ${totalPassed}/${EVAL_FIXTURES.length} (${Math.round((totalPassed / EVAL_FIXTURES.length) * 100)}%)`
  );
  console.log(
    `  Average duration: ${Math.round(totalDuration / EVAL_FIXTURES.length)}ms`
  );
  console.log(`  Total duration: ${Math.round(totalDuration / 1000)}s`);
  console.log(`  Total fallbacks: ${totalFallbacks}`);

  // Score distribution
  console.log("\n  Score Distribution:");
  const strong = fixtureResults.filter((r) => r.overallScore >= 70);
  const average = fixtureResults.filter(
    (r) => r.overallScore >= 40 && r.overallScore < 70
  );
  const weak = fixtureResults.filter((r) => r.overallScore < 40);
  console.log(`    Strong (70+):  ${strong.length} fixtures`);
  console.log(`    Average (40-69): ${average.length} fixtures`);
  console.log(`    Weak (<40):    ${weak.length} fixtures`);

  // Per-fixture table
  console.log("\n  Details:");
  console.log(
    "  " + "-".repeat(76)
  );
  console.log(
    `  ${"Name".padEnd(40)} ${"Score".padStart(5)} ${"Tier".padEnd(10)} ${"Time".padStart(7)} ${"Status".padEnd(6)}`
  );
  console.log(
    "  " + "-".repeat(76)
  );
  for (const r of fixtureResults) {
    const status = r.passed ? "PASS" : "FAIL";
    console.log(
      `  ${r.name.padEnd(40)} ${String(r.overallScore).padStart(5)} ${r.tier.padEnd(10)} ${(r.durationMs + "ms").padStart(7)} ${status}`
    );
  }
  console.log(
    "  " + "-".repeat(76)
  );

  // Exit code for CI
  const exitCode = totalPassed === EVAL_FIXTURES.length ? 0 : 1;
  console.log(
    `\n  ${exitCode === 0 ? "ALL TESTS PASSED" : "SOME TESTS FAILED"}`
  );
  console.log("=".repeat(60));

  process.exit(exitCode);
}

main().catch((err) => {
  console.error("Eval runner failed:", err);
  process.exit(2);
});
