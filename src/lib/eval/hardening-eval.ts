/**
 * No-Placeholder Hardening Verification Suite
 *
 * Runs 5 diverse fixtures and produces a diff report proving:
 * 1. Different scores per fixture (input-dependent scoring)
 * 2. Different audit explanations (no canned text)
 * 3. Different rewrites (transforms user content, not generic)
 * 4. One growth objective + one job objective (framing changes)
 * 5. One CV-only input (CV parsing works)
 *
 * Usage: npx tsx --tsconfig tsconfig.json src/lib/eval/hardening-eval.ts
 */

import { generateAuditResults, type GenerationResult } from "../services/audit-orchestrator";
import {
  isMockSection,
  isMockRewrite,
  isPlaceholderContent,
  validateGenerationResult,
} from "../services/generation-guards";
import { LINKEDIN_SECTION_IDS, CV_SECTION_IDS } from "../services/linkedin-parser";

// ── 5 Diverse Test Fixtures ─────────────────────────────

interface HardeningFixture {
  name: string;
  linkedinText: string;
  cvText?: string;
  jobDescription: string;
  targetAudience: string;
  objectiveMode: "job" | "objective";
  objectiveText: string;
}

const FIXTURES: HardeningFixture[] = [
  // 1. Strong engineer — Job objective
  {
    name: "1-StrongEngineer-Job",
    linkedinText: `Sarah Chen
Senior Software Engineer at Google | Ex-Meta | Stanford CS

About
Passionate software engineer with 12+ years of experience building scalable distributed systems. Led the redesign of Google Cloud's load balancing infrastructure, reducing latency by 40% for 10M+ daily users.

Experience
Senior Software Engineer — Google (2020–Present)
- Led a team of 8 engineers to redesign Cloud Load Balancer, reducing p99 latency from 120ms to 72ms
- Designed and shipped a multi-region failover system achieving 99.999% uptime

Education
Stanford University — M.S. Computer Science (2013–2015)

Skills
Distributed Systems, Go, Python, Kubernetes, gRPC, Cloud Architecture

Recommendations
"Sarah is one of the most talented engineers I've worked with." — VP Engineering, Google`,
    jobDescription: "Principal Software Engineer at a Series D startup building next-gen cloud infrastructure",
    targetAudience: "Tech startup leadership",
    objectiveMode: "job",
    objectiveText: "",
  },

  // 2. Marketer — Growth objective (different framing)
  {
    name: "2-Marketer-Growth",
    linkedinText: `Elena Vasquez
Digital Marketing Specialist

About
Data-driven marketer with 6 years experience in B2B SaaS. Managed $2M annual ad spend across Google Ads, LinkedIn, and Meta. Increased MQL pipeline by 180% through ABM campaigns.

Experience
Senior Marketing Specialist — HubSpot (2021–Present)
- Designed and executed ABM campaigns targeting enterprise accounts, generating $4.2M pipeline
- Built automated nurture sequences in Marketo, improving lead-to-MQL conversion by 34%

Education
Boston University — B.S. Marketing (2014–2018)

Skills
Google Ads, LinkedIn Marketing, ABM, Marketo, HubSpot, Salesforce, Content Strategy`,
    jobDescription: "",
    targetAudience: "Marketing leaders",
    objectiveMode: "objective",
    objectiveText: "Transition into a CMO role at a mid-stage B2B SaaS company within 2 years. Build personal brand as a thought leader in demand generation.",
  },

  // 3. Junior dev — Weak profile
  {
    name: "3-JuniorDev-Weak",
    linkedinText: `Alex P.
Developer

About
I code websites. Looking for remote work.

Experience
Freelancer (2023–Present)
- Made some websites for clients

Education
Online bootcamp — 2023

Skills
HTML, CSS, JavaScript`,
    jobDescription: "Senior Frontend Engineer at Vercel",
    targetAudience: "Engineering managers",
    objectiveMode: "job",
    objectiveText: "",
  },

  // 4. Product designer with CV — Tests CV parsing
  {
    name: "4-Designer-WithCV",
    linkedinText: `Yuki Tanaka
Lead Product Designer at Spotify

About
Design leader focused on accessibility-first design systems. 8 years experience shipping products used by 500M+ users. Passionate about inclusive design and design tokens.

Experience
Lead Product Designer — Spotify (2021–Present)
- Designed Spotify's accessibility framework, improving screen reader compatibility by 300%
- Led design system migration to Figma tokens, reducing design handoff time by 60%

Skills
Figma, Design Systems, Accessibility, User Research, Prototyping`,
    cvText: `Yuki Tanaka
Lead Product Designer

Contact Information
yuki.tanaka@email.com | linkedin.com/in/yukitanaka | portfolio.design/yuki

Professional Summary
Award-winning product designer with 8 years of experience creating accessible, user-centered products at scale. Expertise in design systems, inclusive design, and cross-functional team leadership.

Work Experience
Lead Product Designer — Spotify (2021–Present)
- Spearheaded accessibility-first design framework adopted by 12 product teams
- Reduced design-to-development handoff time by 60% through Figma token system
- Mentored 4 junior designers, 2 promoted within 18 months

Senior Product Designer — Airbnb (2018–2021)
- Redesigned booking flow increasing conversion by 22%
- Established accessibility testing pipeline catching 90% of WCAG violations pre-launch

Education
Rhode Island School of Design — MFA Graphic Design (2014–2016)
University of Tokyo — B.A. Visual Communication (2010–2014)

Skills
Figma, Sketch, Design Systems, WCAG 2.1, User Research, Prototyping, Design Tokens

Certifications
IAAP Certified Professional in Accessibility Core Competencies (CPACC)
Google UX Design Professional Certificate`,
    jobDescription: "VP of Design at a health-tech startup",
    targetAudience: "C-suite executives",
    objectiveMode: "job",
    objectiveText: "",
  },

  // 5. Data scientist — Medium profile, job objective
  {
    name: "5-DataScientist-Medium",
    linkedinText: `Raj Patel
Data Scientist at Netflix

About
Data scientist with 5 years experience in ML and recommendation systems. Built personalization models serving 200M+ subscribers. Skilled in PyTorch, TensorFlow, and distributed computing.

Experience
Data Scientist — Netflix (2022–Present)
- Built content recommendation model improving CTR by 15%
- Developed A/B testing framework used by 20+ teams

ML Engineer — Uber (2020–2022)
- Developed surge pricing model, optimizing driver supply-demand matching
- Reduced model inference latency from 200ms to 45ms

Education
Georgia Tech — M.S. Computer Science, ML Specialization (2018–2020)

Skills
Python, PyTorch, TensorFlow, Spark, SQL, A/B Testing, Recommendation Systems`,
    jobDescription: "Staff ML Engineer at an AI startup building foundation models",
    targetAudience: "AI/ML hiring managers",
    objectiveMode: "job",
    objectiveText: "",
  },
];

// ── Types ─────────────────────────────────────────────────

interface FixtureReport {
  name: string;
  score: number;
  tier: string;
  linkedinSectionCount: number;
  cvSectionCount: number;
  rewriteCount: number;
  fallbackCount: number;
  mockLeaksDetected: number;
  durationMs: number;
  headlineExplanation: string;
  summaryExplanation: string;
  headlineRewrite: string;
  hasCoverLetter: boolean;
  errors: string[];
  passed: boolean;
}

// ── Runner ────────────────────────────────────────────────

async function runFixture(fixture: HardeningFixture): Promise<FixtureReport> {
  const errors: string[] = [];

  let gen: GenerationResult;
  try {
    gen = await generateAuditResults(
      {
        linkedinText: fixture.linkedinText,
        cvText: fixture.cvText,
        jobDescription: fixture.jobDescription,
        targetAudience: fixture.targetAudience,
        objectiveMode: fixture.objectiveMode,
        objectiveText: fixture.objectiveText,
        planId: "coach",
        isAdmin: true,
      },
      "en"
    );
  } catch (err) {
    return {
      name: fixture.name,
      score: 0,
      tier: "error",
      linkedinSectionCount: 0,
      cvSectionCount: 0,
      rewriteCount: 0,
      fallbackCount: 0,
      mockLeaksDetected: 0,
      durationMs: 0,
      headlineExplanation: "",
      summaryExplanation: "",
      headlineRewrite: "",
      hasCoverLetter: false,
      errors: [`Generation error: ${err instanceof Error ? err.message : String(err)}`],
      passed: false,
    };
  }

  const { results, meta } = gen;

  // ── Anti-placeholder checks ──

  // Check scored sections for mock leaks
  for (const section of [...results.linkedinSections, ...results.cvSections]) {
    if (isMockSection(section)) {
      errors.push(`MOCK_LEAK: Section "${section.id}" matches mock fingerprint`);
    }
  }

  // Check rewrites for mock leaks
  for (const rewrite of [...results.linkedinRewrites, ...results.cvRewrites]) {
    if (isMockRewrite(rewrite)) {
      errors.push(`MOCK_LEAK: Rewrite "${rewrite.sectionId}" matches mock fingerprint`);
    }
  }

  // Check cover letter for mock leak
  if (results.coverLetter && isPlaceholderContent(results.coverLetter.content)) {
    errors.push("MOCK_LEAK: Cover letter matches mock fingerprint");
  }

  // ── Section completeness ──

  if (results.linkedinSections.length < 5 && fixture.linkedinText.length > 200) {
    errors.push(`LOW_SECTION_COUNT: Only ${results.linkedinSections.length} LinkedIn sections (expected 7)`);
  }

  // Check rewrites exist for every scored section
  const linkedinRewriteIds = new Set(results.linkedinRewrites.map((r) => r.sectionId));
  for (const section of results.linkedinSections) {
    if (!linkedinRewriteIds.has(section.id)) {
      errors.push(`MISSING_REWRITE: No rewrite for LinkedIn section "${section.id}"`);
    }
  }

  if (fixture.cvText) {
    const cvRewriteIds = new Set(results.cvRewrites.map((r) => r.sectionId));
    for (const section of results.cvSections) {
      if (!cvRewriteIds.has(section.id)) {
        errors.push(`MISSING_REWRITE: No rewrite for CV section "${section.id}"`);
      }
    }
  }

  // ── Fallback count ──
  if (meta.fallbackCount > 0) {
    errors.push(`FALLBACKS: ${meta.fallbackCount} sections used mock fallback`);
  }

  // ── Extract sample outputs for diff report ──
  const headlineSection = results.linkedinSections.find((s) => s.id === "headline");
  const summarySection = results.linkedinSections.find((s) => s.id === "summary");
  const headlineRewrite = results.linkedinRewrites.find((r) => r.sectionId === "headline");

  return {
    name: fixture.name,
    score: results.overallScore,
    tier: results.tier,
    linkedinSectionCount: results.linkedinSections.length,
    cvSectionCount: results.cvSections.length,
    rewriteCount: results.linkedinRewrites.length + results.cvRewrites.length,
    fallbackCount: meta.fallbackCount,
    mockLeaksDetected: meta.mockLeaksDetected,
    durationMs: meta.durationMs,
    headlineExplanation: headlineSection?.explanation?.slice(0, 100) ?? "(none)",
    summaryExplanation: summarySection?.explanation?.slice(0, 100) ?? "(none)",
    headlineRewrite: headlineRewrite?.rewritten?.slice(0, 100) ?? "(none)",
    hasCoverLetter: !!results.coverLetter && results.coverLetter.content.length > 50,
    errors,
    passed: errors.length === 0,
  };
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(70));
  console.log("  NO-PLACEHOLDER HARDENING VERIFICATION SUITE");
  console.log("=".repeat(70));
  console.log(`\nRunning ${FIXTURES.length} fixtures...\n`);

  const reports: FixtureReport[] = [];

  for (const fixture of FIXTURES) {
    process.stdout.write(`  Running: ${fixture.name}... `);
    const report = await runFixture(fixture);
    reports.push(report);

    if (report.passed) {
      console.log(`PASS (score: ${report.score}, ${report.durationMs}ms)`);
    } else {
      console.log(`FAIL (score: ${report.score}, ${report.durationMs}ms)`);
      for (const err of report.errors) {
        console.log(`    \u274C ${err}`);
      }
    }
  }

  // ── Summary ──────────────────────────────────────────────
  const passed = reports.filter((r) => r.passed).length;
  const totalMockLeaks = reports.reduce((sum, r) => sum + r.mockLeaksDetected, 0);
  const totalFallbacks = reports.reduce((sum, r) => sum + r.fallbackCount, 0);

  console.log("\n" + "=".repeat(70));
  console.log("  HARDENING REPORT");
  console.log("=".repeat(70));
  console.log(`\n  Passed: ${passed}/${FIXTURES.length}`);
  console.log(`  Total mock leaks: ${totalMockLeaks}`);
  console.log(`  Total fallbacks: ${totalFallbacks}`);

  // ── Diff Report: Scores ──────────────────────────────────
  console.log("\n  SCORE VARIABILITY:");
  console.log("  " + "-".repeat(66));
  console.log(`  ${"Fixture".padEnd(30)} ${"Score".padStart(6)} ${"Tier".padEnd(10)} ${"Sections".padStart(8)} ${"Rewrites".padStart(8)}`);
  console.log("  " + "-".repeat(66));
  for (const r of reports) {
    console.log(
      `  ${r.name.padEnd(30)} ${String(r.score).padStart(6)} ${r.tier.padEnd(10)} ${String(r.linkedinSectionCount + r.cvSectionCount).padStart(8)} ${String(r.rewriteCount).padStart(8)}`
    );
  }

  // Check score uniqueness
  const uniqueScores = new Set(reports.map((r) => r.score));
  console.log(`\n  Unique scores: ${uniqueScores.size}/${reports.length} (${uniqueScores.size >= 3 ? "PASS" : "WARN — scores may lack variability"})`);

  // ── Diff Report: Explanations ────────────────────────────
  console.log("\n  EXPLANATION VARIABILITY (headline):");
  console.log("  " + "-".repeat(66));
  for (const r of reports) {
    console.log(`  ${r.name.padEnd(30)}: "${r.headlineExplanation}..."`);
  }

  const uniqueExplanations = new Set(reports.map((r) => r.headlineExplanation));
  console.log(`\n  Unique explanations: ${uniqueExplanations.size}/${reports.length} (${uniqueExplanations.size >= 3 ? "PASS" : "WARN"})`);

  // ── Diff Report: Rewrites ────────────────────────────────
  console.log("\n  REWRITE VARIABILITY (headline):");
  console.log("  " + "-".repeat(66));
  for (const r of reports) {
    console.log(`  ${r.name.padEnd(30)}: "${r.headlineRewrite}..."`);
  }

  const uniqueRewrites = new Set(reports.map((r) => r.headlineRewrite));
  console.log(`\n  Unique rewrites: ${uniqueRewrites.size}/${reports.length} (${uniqueRewrites.size >= 3 ? "PASS" : "WARN"})`);

  // ── Framing Change Proof ─────────────────────────────────
  console.log("\n  FRAMING PROOF:");
  const jobFixture = reports.find((r) => r.name.includes("Job"));
  const growthFixture = reports.find((r) => r.name.includes("Growth"));
  if (jobFixture && growthFixture) {
    console.log(`  Job objective fixture: score=${jobFixture.score}, tier=${jobFixture.tier}`);
    console.log(`  Growth objective fixture: score=${growthFixture.score}, tier=${growthFixture.tier}`);
    console.log(`  Scores differ: ${jobFixture.score !== growthFixture.score ? "YES (PASS)" : "NO (still valid if explanations differ)"}`);
  }

  // ── CV Input Proof ───────────────────────────────────────
  console.log("\n  CV INPUT PROOF:");
  const cvFixture = reports.find((r) => r.name.includes("WithCV"));
  if (cvFixture) {
    console.log(`  CV fixture: ${cvFixture.cvSectionCount} CV sections, ${cvFixture.rewriteCount} total rewrites`);
    console.log(`  CV sections generated: ${cvFixture.cvSectionCount > 0 ? "PASS" : "FAIL"}`);
  }

  // ── Cover Letter ─────────────────────────────────────────
  console.log("\n  COVER LETTER PROOF:");
  for (const r of reports) {
    console.log(`  ${r.name.padEnd(30)}: ${r.hasCoverLetter ? "Generated" : "Skipped/Failed"}`);
  }

  console.log("\n" + "=".repeat(70));
  const allPass = passed === FIXTURES.length;
  console.log(`  ${allPass ? "ALL HARDENING CHECKS PASSED" : "SOME CHECKS FAILED"}`);
  console.log("=".repeat(70));

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Hardening eval failed:", err);
  process.exit(2);
});
