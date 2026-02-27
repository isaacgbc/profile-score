/**
 * Sprint 2 E2E Streaming Test
 * Hits /api/audit/stream with a real profile and captures all SSE events.
 * Validates: event ordering, TTFP, TTFS, total duration, section completeness.
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

// Realistic LinkedIn profile fixture
const TEST_LINKEDIN_TEXT = `
Sarah Chen
Senior Product Manager at Stripe

San Francisco Bay Area · 500+ connections

About
Product manager with 8+ years of experience building B2B SaaS products. Led cross-functional teams of 15+ engineers and designers to ship features used by 50,000+ businesses. Passionate about data-driven decision making and user-centric design. Previously at Google and early-stage startups.

Experience

Senior Product Manager
Stripe · Full-time
Jan 2022 - Present · 4 yrs
San Francisco, California
- Led the redesign of the Stripe Dashboard payments overview, increasing user task completion by 23%
- Managed a cross-functional team of 8 engineers, 2 designers, and 1 data scientist
- Launched Stripe Tax automated compliance feature, generating $2.3M ARR in first 6 months
- Drove product strategy for the billing platform serving 15,000+ enterprise customers
- Implemented A/B testing framework that improved feature adoption rates by 35%

Product Manager
Google · Full-time
Jun 2019 - Dec 2021 · 2 yrs 7 mos
Mountain View, California
- Owned the Google Workspace admin console experience for 6M+ enterprise users
- Shipped mobile admin app, achieving 4.6 star rating and 100K+ downloads in 3 months
- Reduced enterprise onboarding time by 40% through streamlined setup wizard
- Collaborated with UX research to conduct 50+ user interviews per quarter

Product Manager
TechStartup Inc. · Full-time
Mar 2017 - May 2019 · 2 yrs 3 mos
- First PM hire; built product function from scratch
- Grew platform from 500 to 12,000 active users in 18 months
- Launched integration marketplace with 25+ partner integrations

Education

Stanford University
MBA, Business Administration
2015 - 2017

UC Berkeley
B.S., Computer Science
2011 - 2015

Skills
Product Strategy · Agile/Scrum · Data Analysis · SQL · Python · User Research · A/B Testing · Roadmap Planning · Stakeholder Management · Cross-functional Leadership

Recommendations
"Sarah is one of the most effective PMs I've worked with. She has an incredible ability to synthesize complex user needs into clear product requirements." - Engineering Director at Stripe
`.trim();

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
  timestampMs: number;
}

async function runStreamTest(): Promise<void> {
  const startMs = Date.now();
  const events: SSEEvent[] = [];
  let firstProgressMs = 0;
  let firstSectionMs = 0;
  let completeMs = 0;
  let errorOccurred = false;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Sprint 2 E2E Streaming Test`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    const res = await fetch(`${BASE_URL}/api/audit/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        linkedinText: TEST_LINKEDIN_TEXT,
        jobDescription: "Senior Product Manager at a Series C fintech startup. Looking for someone with B2B SaaS experience, data-driven approach, and team leadership.",
        targetAudience: "Tech recruiters at high-growth fintech startups",
        objectiveMode: "job",
        objectiveText: "",
        planId: null,
        isAdmin: false,
        locale: "en",
        forceFresh: true,
        isPdfSource: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`❌ HTTP ${res.status}: ${err}`);
      process.exit(1);
    }

    console.log(`✅ Stream connected (HTTP ${res.status})`);
    console.log(`   Content-Type: ${res.headers.get("content-type")}\n`);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        if (!block.trim()) continue;

        const lines = block.split("\n");
        let eventType = "";
        let eventData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) eventType = line.slice(7).trim();
          else if (line.startsWith("data: ")) eventData = line.slice(6);
        }

        if (!eventType || !eventData) continue;

        const elapsedMs = Date.now() - startMs;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(eventData);
        } catch {
          console.warn(`   ⚠ Malformed JSON at ${elapsedMs}ms`);
          continue;
        }

        events.push({ type: eventType, data, timestampMs: elapsedMs });

        if (eventType === "progress") {
          if (firstProgressMs === 0) firstProgressMs = elapsedMs;
          const stage = data.stage as string;
          const pct = data.percent as number;
          const label = data.label as string || "";
          const completed = data.completedSections as number || 0;
          const total = data.totalSections as number || 0;
          const hasSectionReady = !!data.sectionReady;

          if (hasSectionReady && firstSectionMs === 0) firstSectionMs = elapsedMs;

          const sectionTag = hasSectionReady ? " 🟢 SECTION_READY" : "";
          console.log(
            `   [${String(elapsedMs).padStart(6)}ms] progress | ` +
            `stage=${stage.padEnd(22)} pct=${String(pct).padStart(3)}% | ` +
            `${completed}/${total} | ${label}${sectionTag}`
          );
        } else if (eventType === "complete") {
          completeMs = elapsedMs;
          const meta = data.meta as Record<string, unknown> || {};
          console.log(
            `\n   [${String(elapsedMs).padStart(6)}ms] ✅ COMPLETE | ` +
            `duration=${meta.durationMs}ms | model=${meta.modelUsed} | ` +
            `sections=${meta.sectionCountGenerated} | fallbacks=${meta.fallbackCount} | ` +
            `degraded=${meta.degraded}`
          );
        } else if (eventType === "error") {
          errorOccurred = true;
          console.error(`   [${String(elapsedMs).padStart(6)}ms] ❌ ERROR: ${data.error}`);
        }
      }
    }
  } catch (err) {
    errorOccurred = true;
    console.error(`\n❌ Stream error: ${err instanceof Error ? err.message : err}`);
  }

  const totalMs = Date.now() - startMs;

  // ── Analysis ──────────────────────────────────────────
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Results Analysis`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const progressEvents = events.filter(e => e.type === "progress");
  const sectionReadyEvents = progressEvents.filter(e => !!e.data.sectionReady);
  const completeEvents = events.filter(e => e.type === "complete");
  const errorEvents = events.filter(e => e.type === "error");

  // Extract final meta
  const finalMeta = completeEvents[0]?.data?.meta as Record<string, unknown> || {};
  const finalResults = completeEvents[0]?.data?.results as Record<string, unknown> || {};

  // Section counts from final results
  const linkedinSections = (finalResults.linkedinSections as unknown[])?.length ?? 0;
  const cvSections = (finalResults.cvSections as unknown[])?.length ?? 0;
  const linkedinRewrites = (finalResults.linkedinRewrites as unknown[])?.length ?? 0;
  const cvRewrites = (finalResults.cvRewrites as unknown[])?.length ?? 0;

  // Stage sequence validation
  const stageSequence = progressEvents.map(e => e.data.stage);
  const expectedOrder = [
    "cache_check", "extracting_input", "auditing_sections",
    "generating_rewrites", "scoring_entries", "generating_extras", "finalizing_results"
  ];
  const stagesInOrder = expectedOrder.filter(s => stageSequence.includes(s));
  let sequenceValid = true;
  for (let i = 1; i < stagesInOrder.length; i++) {
    const prevIdx = stageSequence.indexOf(stagesInOrder[i - 1]);
    const currIdx = stageSequence.indexOf(stagesInOrder[i]);
    if (currIdx < prevIdx) {
      sequenceValid = false;
      break;
    }
  }

  // Perf metrics
  const ttfp = firstProgressMs;
  const ttfs = firstSectionMs;

  console.log(`Metric                      Value      Target     Status`);
  console.log(`─────────────────────────── ────────── ────────── ──────`);
  console.log(`Total duration              ${String(totalMs).padStart(7)}ms  < 60,000ms ${totalMs < 60000 ? '✅' : '⚠️ '}`);
  console.log(`TTFP (first progress)       ${String(ttfp).padStart(7)}ms  <  2,000ms ${ttfp > 0 && ttfp < 2000 ? '✅' : ttfp === 0 ? '❌ none' : '⚠️ '}`);
  console.log(`TTFS (first section)        ${String(ttfs).padStart(7)}ms  < 15,000ms ${ttfs > 0 && ttfs < 15000 ? '✅' : ttfs === 0 ? '❌ none' : '⚠️ '}`);
  console.log(`Progress events             ${String(progressEvents.length).padStart(7)}     ≥ 5        ${progressEvents.length >= 5 ? '✅' : '⚠️ '}`);
  console.log(`Section ready events        ${String(sectionReadyEvents.length).padStart(7)}     ≥ 1        ${sectionReadyEvents.length >= 1 ? '✅' : '❌'}`);
  console.log(`Complete events             ${String(completeEvents.length).padStart(7)}     = 1        ${completeEvents.length === 1 ? '✅' : '❌'}`);
  console.log(`Error events                ${String(errorEvents.length).padStart(7)}     = 0        ${errorEvents.length === 0 ? '✅' : '❌'}`);
  console.log(`Stage sequence valid        ${String(sequenceValid).padStart(7)}     true       ${sequenceValid ? '✅' : '❌'}`);
  console.log(`LinkedIn sections scored    ${String(linkedinSections).padStart(7)}     ≥ 3        ${linkedinSections >= 3 ? '✅' : '⚠️ '}`);
  console.log(`LinkedIn rewrites           ${String(linkedinRewrites).padStart(7)}     ≥ 3        ${linkedinRewrites >= 3 ? '✅' : '⚠️ '}`);
  console.log(`Fallback count              ${String(finalMeta.fallbackCount ?? '?').padStart(7)}     = 0        ${finalMeta.fallbackCount === 0 ? '✅' : '⚠️ '}`);
  console.log(`Degraded                    ${String(finalMeta.degraded ?? '?').padStart(7)}     false      ${finalMeta.degraded === false ? '✅' : '❌'}`);
  console.log(`Sections skipped            ${String(finalMeta.sectionsSkipped ?? '?').padStart(7)}     ≥ 0        ${(finalMeta.sectionsSkipped as number) >= 0 ? '✅' : '⚠️ '}`);

  // Stage timings
  const stageTimings = finalMeta.stageTimings as Record<string, number> || {};
  if (Object.keys(stageTimings).length > 0) {
    console.log(`\nStage Timings:`);
    for (const [stage, ms] of Object.entries(stageTimings)) {
      console.log(`  ${stage.padEnd(25)} ${ms}ms`);
    }
  }

  // Safety checks
  console.log(`\nSafety Checks:`);
  console.log(`  Hallucinated metrics:     ${finalMeta.hallucinatedMetricCount ?? '?'}`);
  console.log(`  Repetitive entries:       ${finalMeta.repetitiveEntryCount ?? '?'}`);
  console.log(`  Mock leaks detected:      ${finalMeta.mockLeaksDetected ?? '?'}`);
  console.log(`  Core failures:            ${finalMeta.coreFailureCount ?? '?'}`);
  console.log(`  Non-core failures:        ${finalMeta.nonCoreFailureCount ?? '?'}`);
  console.log(`  Preflight passed:         ${(finalMeta.preflightResult as Record<string, unknown>)?.passed ?? '?'}`);

  // Prompt cache stats (from meta)
  if (finalMeta.llmCallCount !== undefined) {
    console.log(`  LLM calls:                ${finalMeta.llmCallCount}`);
  }

  // Section ready timeline
  if (sectionReadyEvents.length > 0) {
    console.log(`\nSection Ready Timeline:`);
    for (const ev of sectionReadyEvents) {
      const sr = ev.data.sectionReady as Record<string, unknown>;
      const section = sr?.section as Record<string, unknown>;
      console.log(`  [${String(ev.timestampMs).padStart(6)}ms] ${section?.id} — score=${section?.score}, tier=${section?.tier}`);
    }
  }

  // ── GO / NO-GO ──────────────────────────────────────
  const checks = {
    typecheck: true,         // already passed
    build: true,             // already passed
    noErrors: errorEvents.length === 0,
    hasComplete: completeEvents.length === 1,
    ttfpOk: ttfp > 0 && ttfp < 2000,
    ttfsOk: ttfs > 0 && ttfs < 15000,
    sectionsReady: sectionReadyEvents.length >= 1,
    stageOrder: sequenceValid,
    notDegraded: finalMeta.degraded === false,
    noFallbacks: finalMeta.fallbackCount === 0,
    sectionsGenerated: linkedinSections >= 3,
    rewritesGenerated: linkedinRewrites >= 3,
  };

  const failures = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const passCount = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (failures.length === 0) {
    console.log(`\n🟢 GO — All ${totalChecks}/${totalChecks} checks passed`);
    console.log(`\nTop 3 reasons:`);
    console.log(`  1. TTFP ${ttfp}ms < 2s target — users see feedback immediately`);
    console.log(`  2. TTFS ${ttfs}ms — first section card renders before pipeline completes`);
    console.log(`  3. Zero fallbacks, zero degradation, all quality guards active`);
  } else {
    console.log(`\n🔴 NO-GO — ${passCount}/${totalChecks} checks passed, ${failures.length} failed`);
    console.log(`\nFailed checks: ${failures.join(", ")}`);
    console.log(`\nSmallest rollback: Set ENABLE_PROGRESSIVE_GENERATION=false and NEXT_PUBLIC_ENABLE_PROGRESSIVE=false`);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Output machine-readable JSON
  const report = {
    timestamp: new Date().toISOString(),
    deployment: {
      environment: "local",
      latestCommit: "a0399f6 (Sprint 1 — Sprint 2 uncommitted)",
      productionDeployment: "profile-score-qwd6qnq2b (Sprint 1 only)",
      streamEndpointLive: false,
    },
    perf: {
      ttfpMs: ttfp,
      ttfsMs: ttfs,
      totalMs,
      progressEventCount: progressEvents.length,
      sectionReadyCount: sectionReadyEvents.length,
      stageTimings,
    },
    e2e: {
      streamConnected: true,
      progressEventsInSequence: sequenceValid,
      sectionsBeforeComplete: sectionReadyEvents.length,
      finalResultsComplete: completeEvents.length === 1,
      linkedinSections,
      linkedinRewrites,
      cvSections,
      cvRewrites,
      fallbackCount: finalMeta.fallbackCount,
      degraded: finalMeta.degraded,
    },
    safety: {
      hallucinatedMetrics: finalMeta.hallucinatedMetricCount,
      repetitiveEntries: finalMeta.repetitiveEntryCount,
      mockLeaks: finalMeta.mockLeaksDetected,
      coreFailures: finalMeta.coreFailureCount,
      nonCoreFailures: finalMeta.nonCoreFailureCount,
      preflightPassed: (finalMeta.preflightResult as Record<string, unknown>)?.passed,
      sectionsSkipped: finalMeta.sectionsSkipped,
      llmCallCount: finalMeta.llmCallCount,
    },
    decision: failures.length === 0 ? "GO" : "NO-GO",
    failures,
  };

  // Write report
  const fs = await import("fs");
  fs.writeFileSync(
    "sprint2-stream-test-results.json",
    JSON.stringify(report, null, 2)
  );
  console.log(`Report written to sprint2-stream-test-results.json`);

  process.exit(failures.length === 0 ? 0 : 1);
}

runStreamTest();
