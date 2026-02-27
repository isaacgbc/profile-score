/**
 * Sprint 2.2 E2E Test: Poll-based progress on /api/audit/generate
 *
 * Tests:
 * 1. POST /api/audit/generate with progressRequestId
 * 2. Poll /api/audit/progress/:requestId every 1.5s
 * 3. Verify progress events arrive (stage, percent, label, sectionReady)
 * 4. Verify final results from POST match progress store completion
 *
 * Usage: ANTHROPIC_API_KEY=sk-... npx tsx scripts/sprint22-poll-test.ts
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const SAMPLE_LINKEDIN = `
Isaac García – Product Designer & Frontend Engineer
Headline: Building AI-powered tools for professionals

About:
Full-stack product designer with 8+ years of experience building enterprise SaaS products.
I specialize in design systems, frontend architecture, and AI-assisted workflows.
Previously at Google, Shopify, and two YC startups.

Experience:
• Senior Product Designer at TechCorp (2021-2024)
  Led design for the analytics dashboard serving 50K+ daily active users.
  Redesigned onboarding flow, increasing activation by 34%.
  Built and maintained the company's design system (60+ components).

• Product Designer at StartupXYZ (2019-2021)
  First design hire. Built the product from 0 to 1.
  Designed the core workflow that drove $2M ARR.

Education:
• BSc Computer Science, University of Toronto (2016)
  Dean's list, graduated with honors.

Skills:
Figma, React, TypeScript, Next.js, Tailwind CSS, Design Systems, User Research

Certifications:
• Google UX Design Professional Certificate (2022)
`;

interface ProgressSnapshot {
  timestamp: number;
  found: boolean;
  stage: string | null;
  percent: number;
  label: string;
  completedSections: number;
  totalSections: number;
  isComplete: boolean;
  error: string | null;
}

async function pollProgress(requestId: string): Promise<ProgressSnapshot> {
  const res = await fetch(`${BASE}/api/audit/progress/${requestId}`);
  const data = await res.json();
  return {
    timestamp: Date.now(),
    found: data.found ?? false,
    stage: data.stage ?? null,
    percent: data.percent ?? 0,
    label: data.label ?? "",
    completedSections: data.completedSections?.length ?? 0,
    totalSections: data.totalSections ?? 0,
    isComplete: data.isComplete ?? false,
    error: data.error ?? null,
  };
}

async function main() {
  console.log("=" .repeat(60));
  console.log("Sprint 2.2 E2E Test: Poll-Based Progress");
  console.log("=" .repeat(60));
  console.log(`Target: ${BASE}`);
  console.log();

  // 1. Generate requestId client-side
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[1] Generated requestId: ${requestId}`);

  // 2. Fire the POST (async — don't await yet)
  const startTime = Date.now();
  console.log(`[2] Firing POST /api/audit/generate with progressRequestId...`);

  const postPromise = fetch(`${BASE}/api/audit/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      linkedinText: SAMPLE_LINKEDIN,
      cvText: "",
      jobDescription: "Senior Product Designer at a fast-growing AI startup",
      targetAudience: "Tech hiring managers and recruiters",
      objectiveMode: "job",
      objectiveText: "",
      planId: "coach",
      isAdmin: true,
      locale: "en",
      forceFresh: true,
      isPdfSource: false,
      progressRequestId: requestId,
    }),
  });

  // 3. Start polling immediately
  console.log(`[3] Starting progress polling every 1.5s...\n`);

  const snapshots: ProgressSnapshot[] = [];
  let pollCount = 0;
  let firstProgressMs = 0;
  let firstSectionMs = 0;

  const pollInterval = setInterval(async () => {
    pollCount++;
    const snap = await pollProgress(requestId);
    snapshots.push(snap);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (snap.found) {
      if (firstProgressMs === 0 && snap.stage) {
        firstProgressMs = Date.now() - startTime;
      }
      if (firstSectionMs === 0 && snap.completedSections > 0) {
        firstSectionMs = Date.now() - startTime;
      }

      console.log(
        `  [poll #${pollCount}] ${elapsed}s | ` +
        `stage=${snap.stage ?? "—"} | ` +
        `${snap.percent}% | ` +
        `sections=${snap.completedSections}/${snap.totalSections} | ` +
        `${snap.label || "—"}`
      );
    } else {
      console.log(`  [poll #${pollCount}] ${elapsed}s | not found yet`);
    }
  }, 1500);

  // 4. Await POST completion
  let postResult: { results?: unknown; meta?: Record<string, unknown>; requestId?: string } | null = null;
  let postError: string | null = null;

  try {
    const res = await postPromise;
    if (res.ok) {
      postResult = await res.json();
    } else {
      const errData = await res.json().catch(() => ({}));
      postError = errData.error || `HTTP ${res.status}`;
    }
  } catch (err) {
    postError = err instanceof Error ? err.message : "Unknown error";
  }

  clearInterval(pollInterval);

  const totalMs = Date.now() - startTime;
  console.log();
  console.log("─".repeat(60));
  console.log("RESULTS");
  console.log("─".repeat(60));
  console.log();

  // 5. Analyze results
  const checks: { name: string; pass: boolean; detail: string }[] = [];

  // POST returned successfully
  checks.push({
    name: "postSuccess",
    pass: postResult !== null && !postError,
    detail: postError ?? "OK",
  });

  // POST returned requestId
  checks.push({
    name: "postReturnedRequestId",
    pass: postResult?.requestId === requestId,
    detail: `expected=${requestId} got=${postResult?.requestId ?? "none"}`,
  });

  // Progress was found during polling
  const foundSnapshots = snapshots.filter((s) => s.found);
  checks.push({
    name: "progressFound",
    pass: foundSnapshots.length > 0,
    detail: `${foundSnapshots.length} found out of ${snapshots.length} polls`,
  });

  // First progress visible < 3s
  checks.push({
    name: "ttfpOk",
    pass: firstProgressMs > 0 && firstProgressMs < 3000,
    detail: `${firstProgressMs}ms (target < 3000ms)`,
  });

  // Stages observed
  const stages = new Set(foundSnapshots.map((s) => s.stage).filter(Boolean));
  checks.push({
    name: "multipleStages",
    pass: stages.size >= 2,
    detail: `[${[...stages].join(", ")}]`,
  });

  // Section delivery
  const maxSections = Math.max(
    ...foundSnapshots.map((s) => s.completedSections),
    0
  );
  checks.push({
    name: "sectionsDelivered",
    pass: maxSections > 0,
    detail: `${maxSections} sections seen during polling`,
  });

  // First section visible < 25s
  checks.push({
    name: "ttfsOk",
    pass: firstSectionMs > 0 && firstSectionMs < 25000,
    detail: `${firstSectionMs}ms (target < 25000ms)`,
  });

  // No errors in polling
  const errors = snapshots.filter((s) => s.error);
  checks.push({
    name: "noErrors",
    pass: errors.length === 0,
    detail: errors.length > 0 ? errors[0].error ?? "" : "clean",
  });

  // Final results complete
  checks.push({
    name: "finalResultsComplete",
    pass: postResult?.results !== undefined,
    detail: postResult?.results ? "has results" : "no results",
  });

  // Print results
  let passCount = 0;
  let failCount = 0;
  for (const c of checks) {
    const icon = c.pass ? "✅" : "❌";
    console.log(`  ${icon} ${c.name}: ${c.detail}`);
    if (c.pass) passCount++;
    else failCount++;
  }

  console.log();
  console.log("─".repeat(60));
  console.log("SUMMARY");
  console.log("─".repeat(60));
  console.log(`  Total time: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`  Poll count: ${pollCount}`);
  console.log(`  TTFP (first progress): ${firstProgressMs}ms`);
  console.log(`  TTFS (first section): ${firstSectionMs}ms`);
  console.log(`  Stages seen: ${[...stages].join(", ")}`);
  console.log(`  Max sections during poll: ${maxSections}`);
  console.log(`  Checks: ${passCount}/${passCount + failCount} passed`);
  console.log();

  const decision = failCount === 0 ? "GO ✅" : "NO-GO ❌";
  console.log(`  Decision: ${decision}`);
  console.log();

  // Write results to JSON
  const output = {
    timestamp: new Date().toISOString(),
    totalMs,
    pollCount,
    ttfpMs: firstProgressMs,
    ttfsMs: firstSectionMs,
    stagesSeen: [...stages],
    maxSectionsPolled: maxSections,
    checks: checks.map((c) => ({ ...c })),
    decision: failCount === 0 ? "GO" : "NO-GO",
    failures: checks.filter((c) => !c.pass).map((c) => c.name),
  };

  const fs = await import("fs");
  fs.writeFileSync(
    "sprint22-poll-test-results.json",
    JSON.stringify(output, null, 2)
  );
  console.log("  Results written to sprint22-poll-test-results.json");

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test script error:", err);
  process.exit(1);
});
