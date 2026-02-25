/**
 * Objective Alignment Test — Constraint #5 QA Guardrail
 *
 * Verifies:
 * 1. Growth mode → NO recruiter/ATS language in outputs
 * 2. Job mode → recruiter/interview-oriented outputs
 * 3. Spanish locale growth mode → NO reclutador/ATS language
 *
 * Usage: env $(grep -v '^#' .env.local | grep -v '^$' | xargs) npx tsx --tsconfig tsconfig.json src/lib/eval/test-objective-alignment.ts
 */

import { generateAuditResults, type GenerationResult } from "../services/audit-orchestrator";

const SAMPLE_LINKEDIN = `Sarah Chen
Senior Software Engineer at Google | Ex-Meta | Stanford CS

About
Passionate software engineer with 12+ years of experience building scalable distributed systems. Led the redesign of Google Cloud's load balancing infrastructure, reducing latency by 40% for 10M+ daily users.

Experience
Senior Software Engineer — Google (2020–Present)
- Led a team of 8 engineers to redesign Cloud Load Balancer
- Designed and shipped a multi-region failover system achieving 99.999% uptime

Software Engineer — Meta (2015–2020)
- Architected real-time messaging pipeline handling 50M messages/second

Education
Stanford University — M.S. Computer Science (2013–2015)

Skills
Distributed Systems, Go, Python, Kubernetes, gRPC, Cloud Architecture`;

// Words that indicate recruiter/ATS framing
const RECRUITER_TERMS_EN = /\b(recruiter|recruiting|ATS|applicant tracking|job interview|hiring manager|resume screening|job search|job market|job-market|job application)\b/gi;
const RECRUITER_TERMS_ES = /\b(reclutador|reclutamiento|ATS|sistema de seguimiento|entrevista de trabajo|búsqueda de empleo|mercado laboral|solicitud de empleo)\b/gi;

// Words that indicate growth/audience framing
const GROWTH_TERMS_EN = /\b(audience|followers|visibility|content|reach|engagement|thought leadership|personal brand|community|network growth)\b/gi;
const GROWTH_TERMS_ES = /\b(audiencia|seguidores|visibilidad|contenido|alcance|engagement|liderazgo|marca personal|comunidad|crecimiento)\b/gi;

// Words that indicate job/recruiter framing (positive check for job mode)
const JOB_TERMS_EN = /\b(recruiter|ATS|hiring|interview|candidate|job|resume|application|employability)\b/gi;

function collectAllText(results: GenerationResult["results"]): string {
  const parts: string[] = [];

  // Collect all explanations
  for (const s of results.linkedinSections) {
    parts.push(s.explanation);
    if (s.improvementSuggestions) {
      parts.push(Array.isArray(s.improvementSuggestions) ? s.improvementSuggestions.join(" ") : s.improvementSuggestions);
    }
  }

  // Collect all rewrite improvements
  for (const r of results.linkedinRewrites) {
    parts.push(r.improvements);
  }

  return parts.join("\n");
}

async function testGrowthModeEN(): Promise<{ passed: boolean; evidence: string }> {
  console.log("\n  Test 1: Growth mode (EN) — no recruiter/ATS language...");

  const result = await generateAuditResults(
    {
      linkedinText: SAMPLE_LINKEDIN,
      jobDescription: "",
      targetAudience: "LinkedIn professionals",
      objectiveMode: "objective",
      objectiveText: "Increase my LinkedIn followers and thought leadership visibility",
      planId: "coach",
      isAdmin: true,
    },
    "en"
  );

  const allText = collectAllText(result.results);

  // Check for recruiter terms (should find NONE)
  const recruiterMatches = allText.match(RECRUITER_TERMS_EN) || [];
  const uniqueRecruiterTerms = [...new Set(recruiterMatches.map((m) => m.toLowerCase()))];

  // Check for growth terms (should find some)
  const growthMatches = allText.match(GROWTH_TERMS_EN) || [];
  const uniqueGrowthTerms = [...new Set(growthMatches.map((m) => m.toLowerCase()))];

  const passed = uniqueRecruiterTerms.length === 0 && uniqueGrowthTerms.length > 0;

  const evidence = [
    `  Recruiter terms found: ${uniqueRecruiterTerms.length} → [${uniqueRecruiterTerms.join(", ")}]`,
    `  Growth terms found: ${uniqueGrowthTerms.length} → [${uniqueGrowthTerms.join(", ")}]`,
    `  Sections scored: ${result.results.linkedinSections.length}`,
    `  Overall score: ${result.results.overallScore}`,
  ].join("\n");

  return { passed, evidence };
}

async function testJobModeEN(): Promise<{ passed: boolean; evidence: string }> {
  console.log("\n  Test 2: Job mode (EN) — should have recruiter-oriented language...");

  const result = await generateAuditResults(
    {
      linkedinText: SAMPLE_LINKEDIN,
      jobDescription: "Senior Product Manager at Google — Lead cross-functional teams to build user-facing products",
      targetAudience: "Hiring managers",
      objectiveMode: "job",
      objectiveText: "",
      planId: "coach",
      isAdmin: true,
    },
    "en"
  );

  const allText = collectAllText(result.results);

  // Check for job terms (should find some)
  const jobMatches = allText.match(JOB_TERMS_EN) || [];
  const uniqueJobTerms = [...new Set(jobMatches.map((m) => m.toLowerCase()))];

  const passed = uniqueJobTerms.length > 0;

  const evidence = [
    `  Job/recruiter terms found: ${uniqueJobTerms.length} → [${uniqueJobTerms.join(", ")}]`,
    `  Sections scored: ${result.results.linkedinSections.length}`,
    `  Overall score: ${result.results.overallScore}`,
    `  Sample explanation: "${result.results.linkedinSections[0]?.explanation?.slice(0, 200)}..."`,
  ].join("\n");

  return { passed, evidence };
}

async function testGrowthModeES(): Promise<{ passed: boolean; evidence: string }> {
  console.log("\n  Test 3: Growth mode (ES) — no reclutador/ATS language...");

  const result = await generateAuditResults(
    {
      linkedinText: SAMPLE_LINKEDIN,
      jobDescription: "",
      targetAudience: "Profesionales de LinkedIn",
      objectiveMode: "objective",
      objectiveText: "Aumentar seguidores en LinkedIn y visibilidad de liderazgo de pensamiento",
      planId: "coach",
      isAdmin: true,
    },
    "es"
  );

  const allText = collectAllText(result.results);

  // Check for recruiter terms in Spanish (should find NONE)
  const recruiterMatchesES = allText.match(RECRUITER_TERMS_ES) || [];
  const uniqueRecruiterTermsES = [...new Set(recruiterMatchesES.map((m) => m.toLowerCase()))];

  // Also check English recruiter terms (LLM might slip into English)
  const recruiterMatchesEN = allText.match(RECRUITER_TERMS_EN) || [];
  const uniqueRecruiterTermsEN = [...new Set(recruiterMatchesEN.map((m) => m.toLowerCase()))];

  // Check for growth terms in Spanish (should find some)
  const growthMatchesES = allText.match(GROWTH_TERMS_ES) || [];
  const uniqueGrowthTermsES = [...new Set(growthMatchesES.map((m) => m.toLowerCase()))];

  // Also accept English growth terms (LLM might respond in English despite ES locale)
  const growthMatchesEN = allText.match(GROWTH_TERMS_EN) || [];
  const uniqueGrowthTermsEN = [...new Set(growthMatchesEN.map((m) => m.toLowerCase()))];

  const totalRecruiterTerms = uniqueRecruiterTermsES.length + uniqueRecruiterTermsEN.length;
  const totalGrowthTerms = uniqueGrowthTermsES.length + uniqueGrowthTermsEN.length;

  const passed = totalRecruiterTerms === 0 && totalGrowthTerms > 0;

  const evidence = [
    `  Recruiter terms (ES): ${uniqueRecruiterTermsES.length} → [${uniqueRecruiterTermsES.join(", ")}]`,
    `  Recruiter terms (EN leakage): ${uniqueRecruiterTermsEN.length} → [${uniqueRecruiterTermsEN.join(", ")}]`,
    `  Growth terms (ES): ${uniqueGrowthTermsES.length} → [${uniqueGrowthTermsES.join(", ")}]`,
    `  Growth terms (EN): ${uniqueGrowthTermsEN.length} → [${uniqueGrowthTermsEN.join(", ")}]`,
    `  Sections scored: ${result.results.linkedinSections.length}`,
    `  Overall score: ${result.results.overallScore}`,
  ].join("\n");

  return { passed, evidence };
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Objective Alignment QA — Constraint #5");
  console.log("=".repeat(60));

  const tests = [
    { name: "Growth Mode (EN)", fn: testGrowthModeEN },
    { name: "Job Mode (EN)", fn: testJobModeEN },
    { name: "Growth Mode (ES)", fn: testGrowthModeES },
  ];

  let passed = 0;
  const results: { name: string; passed: boolean; evidence: string }[] = [];

  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, ...result });
      if (result.passed) {
        passed++;
        console.log(`  ✅ ${test.name}: PASS`);
      } else {
        console.log(`  ❌ ${test.name}: FAIL`);
      }
      console.log(result.evidence);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: test.name, passed: false, evidence: `  Error: ${msg}` });
      console.log(`  ❌ ${test.name}: ERROR — ${msg}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`  OBJECTIVE ALIGNMENT: ${passed}/${tests.length} passed`);
  console.log("=".repeat(60));

  // Detailed evidence report
  console.log("\n  Evidence Report:");
  for (const r of results) {
    console.log(`\n  --- ${r.name} [${r.passed ? "PASS" : "FAIL"}] ---`);
    console.log(r.evidence);
  }

  process.exit(passed === tests.length ? 0 : 1);
}

main().catch((err) => {
  console.error("Objective alignment test failed:", err);
  process.exit(2);
});
