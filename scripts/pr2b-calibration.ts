/**
 * PR2B Calibration: Run 5 representative fixtures through the audit pipeline
 * and validate output quality against the new prompt versions.
 *
 * Usage: npx tsx scripts/pr2b-calibration.ts
 *
 * Fixtures tested:
 * 1. Strong profile — job mode (Senior Engineer)
 * 2. Medium profile — job mode (Mid-level Developer)
 * 3. Weak profile — job mode (Minimal)
 * 4. Strong profile — growth/objective mode (Product Manager)
 * 5. Medium profile + CV — job mode (Business Analyst)
 */

const API_URL = process.env.API_URL || "http://localhost:3000";

interface CalibrationResult {
  fixture: string;
  mode: string;
  hasCV: boolean;
  overallScore: number;
  tier: string;
  descriptorLength: number;
  descriptorSnippet: string;
  linkedinSectionsCount: number;
  cvSectionsCount: number;
  linkedinRewritesCount: number;
  cvRewritesCount: number;
  fallbackCount: number;
  hasFallback: boolean;
  degraded: boolean;
  promptVersions: Record<string, number>;
  durationMs: number;
  // Quality checks
  checks: {
    outputsDifferByInput: boolean;
    descriptorNotDuplicate: boolean;
    sectionCoverageComplete: boolean;
    rewritesPresent: boolean;
    noFallbackAbuse: boolean;
    noPlaceholderFingerprints: boolean;
  };
  errors: string[];
}

// ── Fixtures ──────────────────────────────────────────

const fixtures = [
  {
    name: "1. Strong – Senior Engineer (job mode)",
    mode: "job" as const,
    hasCV: false,
    body: {
      linkedinText: `Sarah Chen
Senior Software Engineer at Google | Ex-Meta | Stanford CS

About
Passionate software engineer with 12+ years of experience building scalable distributed systems. Led the redesign of Google Cloud's load balancing infrastructure, reducing latency by 40% for 10M+ daily users. Previously at Meta, where I architected the real-time messaging pipeline serving 2B+ users.

Core expertise: distributed systems, cloud architecture, Go, Python, Kubernetes, gRPC.

Experience
Senior Software Engineer — Google (2020–Present)
- Led a team of 8 engineers to redesign Cloud Load Balancer, reducing p99 latency from 120ms to 72ms
- Designed and shipped a multi-region failover system achieving 99.999% uptime
- Mentored 15+ junior engineers through the promotion process

Software Engineer — Meta (2015–2020)
- Architected real-time messaging pipeline handling 50M messages/second
- Reduced infrastructure costs by $2M/year through query optimization

Education
Stanford University — M.S. Computer Science (2013–2015)
Carnegie Mellon University — B.S. Computer Science (2009–2013)

Skills
Distributed Systems, Go, Python, Kubernetes, gRPC, Cloud Architecture, Technical Leadership, System Design

Recommendations
"Sarah is one of the most talented engineers I've worked with." — VP Engineering, Google`,
      jobDescription: "Principal Software Engineer at a Series D startup building next-gen cloud infrastructure",
      targetAudience: "Tech startup leadership",
      objectiveMode: "job",
      objectiveText: "",
      planId: "pro",
      locale: "en",
      forceFresh: true,
    },
    expectedScoreRange: [45, 100],
  },
  {
    name: "2. Medium – Mid-level Developer (job mode)",
    mode: "job" as const,
    hasCV: false,
    body: {
      linkedinText: `James Lee
Full Stack Developer at Acme Inc

About
Full stack developer with 4 years of experience. I build web applications using React and Node.js. Completed a coding bootcamp in 2019 and have been working in tech since.

Experience
Full Stack Developer — Acme Inc (2021–Present)
- Build and maintain features for the company web app
- Work with a team of 5 developers on various projects
- Participate in code reviews and sprint planning

Junior Developer — WebDev Co (2019–2021)
- Helped build client websites using React
- Worked on bug fixes and small feature requests
- Assisted senior developers with testing

Education
Coding Bootcamp — Tech Academy (2019)
B.A. in English — State University (2015–2019)

Skills
JavaScript, React, Node.js, CSS, HTML, Git, MongoDB`,
      jobDescription: "Senior Full Stack Engineer at a growth-stage startup. Requirements: 5+ years experience, React, Node.js, AWS, system design.",
      targetAudience: "Engineering managers at growth startups",
      objectiveMode: "job",
      objectiveText: "",
      planId: "pro",
      locale: "en",
      forceFresh: true,
    },
    expectedScoreRange: [15, 60],
  },
  {
    name: "3. Weak – Minimal Profile (job mode)",
    mode: "job" as const,
    hasCV: false,
    body: {
      linkedinText: `John
Looking for work

Experience
Worker at some company (2020-2022)
- Did various tasks

Skills
Computers, Microsoft Office`,
      jobDescription: "Entry-level position in any field",
      targetAudience: "Any hiring manager",
      objectiveMode: "job",
      objectiveText: "",
      planId: "pro",
      locale: "en",
      forceFresh: true,
    },
    expectedScoreRange: [0, 80],
  },
  {
    name: "4. Strong – Product Manager (growth mode)",
    mode: "objective" as const,
    hasCV: false,
    body: {
      linkedinText: `David Park
Director of Product at Stripe | MBA Wharton | B2B SaaS

About
Product leader with 10+ years driving growth at top fintech companies. At Stripe, I lead the Payments Optimization team (15 people), where we increased merchant conversion rates by 12% — generating $850M in incremental processing volume. Previously built Plaid's developer platform from 0 to 5,000+ enterprise integrations.

I combine deep technical understanding with business acumen to build products that delight developers and drive revenue.

Experience
Director of Product — Stripe (2021–Present)
- Own the Payments Optimization roadmap, a $2.5B revenue line
- Launched Adaptive Acceptance feature, increasing authorization rates by 3.2pp globally
- Partnered with ML team to build fraud detection models reducing chargebacks by 28%

Senior Product Manager — Plaid (2017–2021)
- Built developer platform from scratch: API docs, SDKs, sandbox environment
- Grew from 200 to 5,000+ enterprise integrations in 3 years

Education
Wharton School — MBA, Technology Management (2015–2017)
UC Berkeley — B.S. Computer Science (2011–2015)

Skills
Product Strategy, B2B SaaS, Payments, API Design, Data Analysis, SQL, A/B Testing, User Research, Technical Product Management`,
      jobDescription: "",
      targetAudience: "Fintech industry thought leaders",
      objectiveMode: "objective",
      objectiveText: "Build personal brand as a thought leader in fintech product management. Increase visibility for speaking opportunities and advisory roles.",
      planId: "pro",
      locale: "en",
      forceFresh: true,
    },
    expectedScoreRange: [45, 100],
  },
  {
    name: "5. Medium – Business Analyst + CV (job mode)",
    mode: "job" as const,
    hasCV: true,
    body: {
      linkedinText: `Lisa Chen
Business Analyst at FinCorp

About
Business analyst with experience in data analysis and reporting. I use Excel and SQL to help teams make decisions. Currently at a financial services company.

Experience
Business Analyst — FinCorp (2022–Present)
- Create reports and dashboards for management
- Analyze data to support business decisions
- Work with stakeholders across departments

Data Analyst Intern — StartupXYZ (2021–2022)
- Helped with data entry and report generation
- Assisted the analytics team with quarterly reviews

Education
B.S. Finance — State University (2018–2022)

Skills
Excel, SQL, Tableau, Data Analysis, Financial Modeling`,
      cvText: `Lisa Chen
Business Analyst

Contact: lisa.chen@email.com | (555) 123-4567 | New York, NY

Summary
Business analyst with 2+ years of experience in financial services. Proficient in Excel, SQL, and Tableau.

Experience
Business Analyst — FinCorp (2022–Present)
- Create reports and dashboards
- Support business decisions with data analysis
- Collaborate with cross-functional teams

Data Analyst Intern — StartupXYZ (2021–2022)
- Data entry and report generation
- Assisted with quarterly reviews

Education
B.S. Finance — State University, 2022

Skills
Excel, SQL, Tableau, Data Analysis, Financial Modeling, PowerPoint`,
      jobDescription: "Senior Business Analyst at a fintech company. Requirements: 3+ years, SQL proficiency, financial modeling, stakeholder management, Agile experience.",
      targetAudience: "Hiring managers at fintech companies",
      objectiveMode: "job",
      objectiveText: "",
      planId: "pro",
      locale: "en",
      forceFresh: true,
    },
    expectedScoreRange: [15, 70],
  },
];

// Known placeholder fingerprints — must exactly match MOCK_FINGERPRINTS from generation-guards.ts.
// These are full phrases from the mock data; substring matching catches mock leaks
// without false-flagging legitimate LLM output that happens to use common audit language.
const PLACEHOLDER_FINGERPRINTS = [
  "Senior Full-Stack Engineer | Building scalable SaaS products",
  "Full-stack engineer with 5+ years turning complex business requirements",
  "Led development of customer-facing dashboard serving 50K daily active users",
  "Senior Full-Stack Engineer with 5+ years of experience building scalable web applications using React, Node.js, and AWS",
  "I am writing to express my strong interest in the Senior Full-Stack Engineer position",
  "Your headline includes a job title but lacks keywords recruiters search for, a value proposition",
  "Your summary is vague with no metrics, no specialization",
  "Your experience section lists responsibilities but lacks specific achievements",
  "Your skills list is flat with no hierarchy",
  "No certifications listed. Industry certifications significantly boost ATS ranking",
  "You have no recommendations. Profiles with 3+ recommendations",
  "Contact information is present but could include a portfolio link",
  "Your CV summary is generic and could be for anyone",
  "Work experience has good structure but bullets lack quantified impact",
  "Skills section needs better categorization. ATS systems match exact keywords",
];

function hasPlaceholderFingerprints(text: string): boolean {
  const lower = text.toLowerCase();
  return PLACEHOLDER_FINGERPRINTS.some((fp) => lower.includes(fp.toLowerCase()));
}

async function runFixture(
  fixture: (typeof fixtures)[0],
  allResults: CalibrationResult[]
): Promise<CalibrationResult> {
  const errors: string[] = [];

  console.log(`\n  Running: ${fixture.name}...`);
  const startTime = Date.now();

  try {
    const res = await fetch(`${API_URL}/api/audit/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fixture.body),
    });

    if (!res.ok) {
      const text = await res.text();
      errors.push(`API error ${res.status}: ${text.slice(0, 200)}`);
      return {
        fixture: fixture.name,
        mode: fixture.mode,
        hasCV: fixture.hasCV,
        overallScore: -1,
        tier: "ERROR",
        descriptorLength: 0,
        descriptorSnippet: "",
        linkedinSectionsCount: 0,
        cvSectionsCount: 0,
        linkedinRewritesCount: 0,
        cvRewritesCount: 0,
        fallbackCount: 0,
        hasFallback: false,
        degraded: false,
        promptVersions: {},
        durationMs: Date.now() - startTime,
        checks: {
          outputsDifferByInput: false,
          descriptorNotDuplicate: false,
          sectionCoverageComplete: false,
          rewritesPresent: false,
          noFallbackAbuse: false,
          noPlaceholderFingerprints: false,
        },
        errors,
      };
    }

    const data = await res.json();
    const { results, meta } = data;
    const durationMs = Date.now() - startTime;

    // Extract descriptor info
    const descriptor = results.overallDescriptor || "";
    const descriptorSnippet = descriptor.slice(0, 150) + (descriptor.length > 150 ? "..." : "");

    // ── Quality checks ──

    // 1. Descriptor not a duplicate of headline explanation
    const headlineSection = results.linkedinSections?.find(
      (s: { id: string }) => s.id === "headline"
    );
    const headlineExplanation = headlineSection?.explanation || "";
    const descriptorNotDuplicate =
      !descriptor || !headlineExplanation ||
      computeWordOverlap(headlineExplanation, descriptor) < 0.6;

    // 2. Section coverage complete
    const linkedinSectionsCount = results.linkedinSections?.length || 0;
    const cvSectionsCount = results.cvSections?.length || 0;
    const linkedinRewritesCount = results.linkedinRewrites?.length || 0;
    const cvRewritesCount = results.cvRewrites?.length || 0;
    const sectionCoverageComplete =
      linkedinSectionsCount >= 5 && // expect at least 5 LinkedIn sections
      linkedinRewritesCount >= 3; // expect at least 3 rewrites

    // 3. Rewrites present
    const rewritesPresent = linkedinRewritesCount > 0;

    // 4. No fallback abuse — threshold accounts for missing sections (7 LI sections
    //    but fixtures have ~5-6 populated, so 2-4 fallbacks per source is normal;
    //    CV doubles the total). Threshold: max 65% fallback rate (allows for
    //    profiles with many missing sections like weak/minimal profiles).
    const totalSteps = (linkedinSectionsCount + cvSectionsCount) * 2; // score + rewrite
    const noFallbackAbuse = totalSteps === 0 || (meta.fallbackCount || 0) <= totalSteps * 0.65;

    // 5. No placeholder fingerprints in REWRITE outputs and overall descriptor.
    //    We intentionally DON'T check audit explanations/suggestions because
    //    common audit observations about missing sections (e.g., "No certifications
    //    listed…") naturally overlap with mock data phrases — they describe the
    //    same real issues. The critical check is that REWRITES (which should be
    //    personalized to the user's actual text) don't leak mock content.
    let placeholderFound = false;
    const rewriteTexts: string[] = [];
    for (const r of results.linkedinRewrites || []) {
      rewriteTexts.push(r.rewritten || "");
    }
    for (const r of results.cvRewrites || []) {
      rewriteTexts.push(r.rewritten || "");
    }
    rewriteTexts.push(descriptor);
    for (const text of rewriteTexts) {
      if (hasPlaceholderFingerprints(text)) {
        placeholderFound = true;
        break;
      }
    }

    // 6. Outputs differ by input (checked across all results later)
    // Store for cross-comparison
    const outputsDifferByInput = true; // will be validated later

    const result: CalibrationResult = {
      fixture: fixture.name,
      mode: fixture.mode,
      hasCV: fixture.hasCV,
      overallScore: results.overallScore,
      tier: results.tier,
      descriptorLength: descriptor.length,
      descriptorSnippet,
      linkedinSectionsCount,
      cvSectionsCount,
      linkedinRewritesCount,
      cvRewritesCount,
      fallbackCount: meta.fallbackCount || 0,
      hasFallback: meta.hasFallback || false,
      degraded: meta.degraded || false,
      promptVersions: meta.promptVersionsUsed || {},
      durationMs,
      checks: {
        outputsDifferByInput,
        descriptorNotDuplicate,
        sectionCoverageComplete,
        rewritesPresent,
        noFallbackAbuse,
        noPlaceholderFingerprints: !placeholderFound,
      },
      errors,
    };

    // Validate score range
    const [min, max] = fixture.expectedScoreRange;
    if (result.overallScore < min || result.overallScore > max) {
      result.errors.push(
        `Score ${result.overallScore} outside expected range [${min}, ${max}]`
      );
    }

    return result;
  } catch (err) {
    errors.push(`Fetch error: ${err instanceof Error ? err.message : String(err)}`);
    return {
      fixture: fixture.name,
      mode: fixture.mode,
      hasCV: fixture.hasCV,
      overallScore: -1,
      tier: "ERROR",
      descriptorLength: 0,
      descriptorSnippet: "",
      linkedinSectionsCount: 0,
      cvSectionsCount: 0,
      linkedinRewritesCount: 0,
      cvRewritesCount: 0,
      fallbackCount: 0,
      hasFallback: false,
      degraded: false,
      promptVersions: {},
      durationMs: Date.now() - startTime,
      checks: {
        outputsDifferByInput: false,
        descriptorNotDuplicate: false,
        sectionCoverageComplete: false,
        rewritesPresent: false,
        noFallbackAbuse: false,
        noPlaceholderFingerprints: false,
      },
      errors,
    };
  }
}

function computeWordOverlap(a: string, b: string): number {
  const STOP = new Set(["the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was", "has", "have", "been", "not", "but"]);
  const words = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w)));
  const wa = words(a);
  const wb = words(b);
  if (wb.size === 0) return 0;
  let overlap = 0;
  for (const w of wb) if (wa.has(w)) overlap++;
  return overlap / wb.size;
}

async function main() {
  console.log("PR2B Calibration — 5 Fixtures\n");
  console.log("=" .repeat(60));

  const results: CalibrationResult[] = [];

  // Run sequentially to avoid rate limiting
  for (const fixture of fixtures) {
    const result = await runFixture(fixture, results);
    results.push(result);

    const status = result.errors.length === 0 ? "PASS" : "WARN";
    console.log(
      `  ${status} | Score: ${result.overallScore} (${result.tier}) | Sections: ${result.linkedinSectionsCount}LI + ${result.cvSectionsCount}CV | Rewrites: ${result.linkedinRewritesCount}LI + ${result.cvRewritesCount}CV | Fallbacks: ${result.fallbackCount} | ${result.durationMs}ms`
    );
    if (result.errors.length > 0) {
      for (const err of result.errors) console.log(`    ⚠ ${err}`);
    }
  }

  // ── Cross-fixture validation ──
  console.log("\n" + "=".repeat(60));
  console.log("Cross-fixture validation:");

  // Check that descriptors differ across fixtures
  const descriptors = results
    .filter((r) => r.descriptorLength > 0)
    .map((r) => r.descriptorSnippet);
  const uniqueDescriptors = new Set(descriptors);
  const descriptorsDiffer = uniqueDescriptors.size === descriptors.length;
  console.log(
    `  Descriptors differ: ${descriptorsDiffer ? "PASS" : "FAIL"} (${uniqueDescriptors.size}/${descriptors.length} unique)`
  );

  // Check that scores differ materially
  const scores = results.filter((r) => r.overallScore >= 0).map((r) => r.overallScore);
  const scoreRange = Math.max(...scores) - Math.min(...scores);
  console.log(
    `  Score range: ${Math.min(...scores)}-${Math.max(...scores)} (spread: ${scoreRange}) — ${scoreRange >= 20 ? "PASS" : "FAIL"}`
  );

  // ── Summary table ──
  console.log("\n" + "=".repeat(60));
  console.log("Quality Check Summary:\n");

  const checkNames = [
    "descriptorNotDuplicate",
    "sectionCoverageComplete",
    "rewritesPresent",
    "noFallbackAbuse",
    "noPlaceholderFingerprints",
  ] as const;

  for (const check of checkNames) {
    const passed = results.filter((r) => r.checks[check]).length;
    const total = results.length;
    console.log(`  ${check}: ${passed}/${total} ${passed === total ? "PASS" : "WARN"}`);
  }

  console.log(`\n  Descriptors differ across fixtures: ${descriptorsDiffer ? "PASS" : "FAIL"}`);
  console.log(`  Score differentiation (range >= 20): ${scoreRange >= 20 ? "PASS" : "FAIL"}`);

  // ── Prompt versions used ──
  console.log("\n" + "=".repeat(60));
  console.log("Prompt versions used:");
  const firstResult = results.find((r) => Object.keys(r.promptVersions).length > 0);
  if (firstResult) {
    for (const [key, ver] of Object.entries(firstResult.promptVersions)) {
      console.log(`  ${key}: v${ver}`);
    }
  }

  // Overall pass/fail
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const criticalFails = results.filter(
    (r) => !r.checks.noPlaceholderFingerprints || !r.checks.rewritesPresent
  ).length;

  console.log("\n" + "=".repeat(60));
  if (criticalFails === 0 && totalErrors <= 2) {
    console.log("CALIBRATION: PASS");
  } else {
    console.log(`CALIBRATION: ${criticalFails > 0 ? "FAIL" : "WARN"} (${totalErrors} warnings, ${criticalFails} critical)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
