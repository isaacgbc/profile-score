/**
 * Evaluation test fixtures — 10 profiles of varying quality.
 *
 * Each fixture contains LinkedIn text, optional CV text, job description,
 * target audience, and expected score/tier ranges for validation.
 */

export interface EvalFixture {
  name: string;
  linkedinText: string;
  cvText?: string;
  jobDescription: string;
  targetAudience: string;
  /** Expected overall score range [min, max] */
  expectedScoreRange: [number, number];
  /** Expected tier(s) that would be acceptable */
  expectedTiers: string[];
}

// ── 3 Strong Profiles (expected score 70+) ───────────────

const strongSeniorEngineer: EvalFixture = {
  name: "Strong – Senior Software Engineer",
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
- Contributed to open-source Thrift protocol improvements

Education
Stanford University — M.S. Computer Science (2013–2015)
Carnegie Mellon University — B.S. Computer Science (2009–2013)

Skills
Distributed Systems, Go, Python, Kubernetes, gRPC, Cloud Architecture, Technical Leadership, System Design

Recommendations
"Sarah is one of the most talented engineers I've worked with. Her ability to break down complex problems is exceptional." — VP Engineering, Google`,
  jobDescription: "Principal Software Engineer at a Series D startup building next-gen cloud infrastructure",
  targetAudience: "Tech startup leadership",
  expectedScoreRange: [60, 100],
  expectedTiers: ["excellent", "good"],
};

const strongProductManager: EvalFixture = {
  name: "Strong – Product Manager",
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
- Launched Plaid Exchange, a new revenue stream reaching $50M ARR in year one

Education
Wharton School, University of Pennsylvania — MBA (2015–2017)
MIT — B.S. Computer Science (2011–2015)

Skills
Product Strategy, B2B SaaS, Payments, API Design, Data Analysis, Team Leadership, Fintech

Recommendations
"David has an exceptional ability to translate complex technical capabilities into compelling product narratives." — CTO, Stripe`,
  jobDescription: "VP of Product at a fintech unicorn",
  targetAudience: "C-suite executives",
  expectedScoreRange: [60, 100],
  expectedTiers: ["excellent", "good"],
};

const strongDesigner: EvalFixture = {
  name: "Strong – UX Design Lead",
  linkedinText: `Maria Rodriguez
Design Lead at Figma | Ex-Airbnb | RISD MFA

About
Design leader passionate about creating intuitive, accessible experiences at scale. At Figma, I lead the Design Systems team responsible for the component library used by 4M+ designers worldwide. My work on Figma's Auto Layout v2 was featured at Config 2024 and adopted by 89% of active users within 3 months.

Previously at Airbnb, where I redesigned the host onboarding flow, increasing completion rates by 34% and reducing support tickets by 52%.

Experience
Design Lead — Figma (2021–Present)
- Lead a team of 6 designers building Figma's design system and component library
- Shipped Auto Layout v2, used by 89% of active users
- Established accessibility standards achieving WCAG 2.1 AA compliance across all components

Senior Product Designer — Airbnb (2017–2021)
- Redesigned host onboarding: +34% completion rate, -52% support tickets
- Led design for Airbnb Experiences, generating $120M in first-year revenue
- Built and mentored a design team of 4

Education
RISD — MFA Graphic Design (2015–2017)
UC Berkeley — B.A. Cognitive Science (2011–2015)

Skills
Design Systems, Figma, User Research, Accessibility, Prototyping, Design Leadership, Information Architecture`,
  jobDescription: "Head of Design at a B2B design tool startup",
  targetAudience: "Startup founders and design teams",
  expectedScoreRange: [60, 100],
  expectedTiers: ["excellent", "good"],
};

// ── 4 Average Profiles (expected score 40–69) ────────────

const averageMarketer: EvalFixture = {
  name: "Average – Digital Marketer",
  linkedinText: `Tom Wilson
Digital Marketing Manager

About
Marketing professional with 5 years of experience in digital marketing. I work with social media, email campaigns, and some PPC. Looking for new opportunities.

Experience
Digital Marketing Manager — TechCorp (2021–Present)
- Manage social media accounts
- Run email campaigns
- Help with PPC advertising

Marketing Coordinator — StartupXYZ (2019–2021)
- Created content for blog
- Managed social media
- Assisted with events

Education
State University — B.A. Marketing (2015–2019)

Skills
Social Media, Email Marketing, PPC, Content Writing, Google Analytics`,
  jobDescription: "Senior Digital Marketing Manager at a SaaS company",
  targetAudience: "Marketing directors",
  expectedScoreRange: [35, 69],
  expectedTiers: ["good", "fair"],
};

const averageDeveloper: EvalFixture = {
  name: "Average – Mid-level Developer",
  linkedinText: `James Lee
Full Stack Developer at Acme Inc

About
Full stack developer with 4 years of experience. I build web applications using React and Node.js. I enjoy coding and learning new technologies.

Experience
Full Stack Developer — Acme Inc (2022–Present)
- Develop features using React and Node.js
- Work with PostgreSQL database
- Participate in code reviews

Junior Developer — WebAgency (2020–2022)
- Built websites for clients
- Fixed bugs and maintained existing code
- Learned React and TypeScript

Education
Coding Bootcamp — General Assembly (2020)
University of Oregon — B.S. Biology (2016–2020)

Skills
React, Node.js, TypeScript, PostgreSQL, Git, HTML/CSS`,
  jobDescription: "Senior Full Stack Engineer at a growth-stage startup",
  targetAudience: "Engineering managers",
  expectedScoreRange: [35, 69],
  expectedTiers: ["good", "fair"],
};

const averageAnalyst: EvalFixture = {
  name: "Average – Business Analyst",
  linkedinText: `Lisa Chen
Business Analyst

About
Business analyst with experience in data analysis and reporting. I use Excel and SQL to analyze data and create reports for stakeholders. Team player who enjoys solving problems.

Experience
Business Analyst — FinanceGroup (2020–Present)
- Create monthly reports for management
- Analyze sales data using Excel and SQL
- Present findings to stakeholders
- Support the data team with ad-hoc queries

Analyst Intern — ConsultingFirm (2019–2020)
- Assisted senior analysts
- Created PowerPoint presentations
- Conducted research

Education
NYU — B.S. Economics (2015–2019)

Skills
Excel, SQL, PowerPoint, Data Analysis, Tableau`,
  jobDescription: "Senior Business Analyst at a financial services company",
  targetAudience: "Hiring managers in finance",
  expectedScoreRange: [35, 69],
  expectedTiers: ["good", "fair"],
};

const averageProjectManager: EvalFixture = {
  name: "Average – Project Manager",
  linkedinText: `Rachel Kim
Project Manager at MediumCo

About
Project manager with 3 years of experience. PMP certified. I manage projects and ensure they are delivered on time and within budget.

Experience
Project Manager — MediumCo (2022–Present)
- Manage 3-4 projects simultaneously
- Use Jira for task tracking
- Hold weekly status meetings
- Coordinate with stakeholders

Associate PM — OtherCo (2021–2022)
- Assisted project managers
- Created project documentation
- Tracked project timelines

Education
Boston University — B.S. Business Administration (2017–2021)

Skills
Project Management, Jira, Agile, Scrum, Stakeholder Management, PMP`,
  jobDescription: "Senior Project Manager at a tech company",
  targetAudience: "Program directors",
  expectedScoreRange: [35, 69],
  expectedTiers: ["good", "fair"],
};

// ── 3 Weak Profiles (expected score below 40) ────────────

const weakMinimalProfile: EvalFixture = {
  name: "Weak – Minimal Profile",
  linkedinText: `John
Looking for work

About
I need a job.

Experience
Various companies

Skills
Hard worker`,
  jobDescription: "Any entry-level position",
  targetAudience: "Recruiters",
  expectedScoreRange: [0, 39],
  expectedTiers: ["fair", "poor"],
};

const weakNoDetails: EvalFixture = {
  name: "Weak – No Details",
  linkedinText: `Amy R.
Employee at Company

About
Experienced professional seeking new challenges.

Experience
Employee — Company (2020-Present)
- Did various tasks
- Worked with team

Previous Role — Another Place (2018-2020)
- Responsibilities included work

Education
University

Skills
Communication, Teamwork`,
  jobDescription: "Marketing Manager at a Fortune 500 company",
  targetAudience: "Senior executives",
  expectedScoreRange: [0, 39],
  expectedTiers: ["fair", "poor"],
};

const weakIncomplete: EvalFixture = {
  name: "Weak – Incomplete and Vague",
  linkedinText: `Mike
Student looking for internship

About
I am a student and I want to work in tech because I think it's cool. I like computers.

Experience
Cashier — Local Store (2022-2023)
- Worked the register

Education
Community College — Associates (in progress)

Skills
Microsoft Word, typing`,
  cvText: `Mike
Student
Skills: Word, typing fast
Looking for tech internship`,
  jobDescription: "Software Engineering Intern at Google",
  targetAudience: "Tech recruiters",
  expectedScoreRange: [0, 39],
  expectedTiers: ["fair", "poor"],
};

// ── Export all fixtures ──────────────────────────────────
export const EVAL_FIXTURES: EvalFixture[] = [
  // Strong (3)
  strongSeniorEngineer,
  strongProductManager,
  strongDesigner,
  // Average (4)
  averageMarketer,
  averageDeveloper,
  averageAnalyst,
  averageProjectManager,
  // Weak (3)
  weakMinimalProfile,
  weakNoDetails,
  weakIncomplete,
];
