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
  /** Objective mode: "job" (default) or "objective" (growth) */
  objectiveMode?: "job" | "objective";
  /** Objective text for objective mode */
  objectiveText?: string;
}

// ── 3 Strong Profiles ────────────────────────────────────
// Note: scores are lower than raw section quality because ALL 7 standard
// LinkedIn sections are scored — missing sections (e.g. "featured") get
// low scores (~5-15) which pull down the overall average by ~10-15 points.

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
  expectedScoreRange: [45, 100],
  expectedTiers: ["excellent", "good", "fair"],
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
  expectedScoreRange: [45, 100],
  expectedTiers: ["excellent", "good", "fair"],
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
  expectedScoreRange: [45, 100],
  expectedTiers: ["excellent", "good", "fair"],
};

// ── 4 Average Profiles ───────────────────────────────────
// Note: average profiles typically have 5 found sections + 2 missing
// (featured, recommendations). Missing sections scored 5-15 pull the
// overall average down ~15-20 points from raw section quality.

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
  expectedScoreRange: [15, 60],
  expectedTiers: ["good", "fair", "poor"],
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
  expectedScoreRange: [15, 60],
  expectedTiers: ["good", "fair", "poor"],
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
  expectedScoreRange: [15, 60],
  expectedTiers: ["good", "fair", "poor"],
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
  expectedScoreRange: [15, 60],
  expectedTiers: ["good", "fair", "poor"],
};

// ── 3 Weak Profiles (expected score below 35) ────────────

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

// ── Sprint 1: 5 New Fixtures (ES, growth mode, career changer, executive, student) ──

const strongMarketingDirectorES: EvalFixture = {
  name: "Strong – Marketing Director (ES)",
  linkedinText: `Carolina Mendez
Directora de Marketing Digital | Growth Marketing | SaaS B2B | Ex-MercadoLibre

Acerca de
Lidero estrategias de marketing digital que generan resultados medibles. En MercadoLibre, escale el equipo de growth de 3 a 18 personas y aumente los ingresos por canal digital en 240% en 2 anos. Actualmente como Directora de Marketing en Globant, gestiono un presupuesto de $5M USD y un equipo de 12 profesionales enfocados en generacion de demanda para clientes enterprise.

Mi especialidad: convertir datos en estrategias que mueven metricas de negocio.

Experiencia
Directora de Marketing — Globant (2022–Presente)
- Lidero equipo de 12 personas con presupuesto de $5M USD en generacion de demanda B2B
- Implemente estrategia ABM que genero $18M en pipeline cualificado en primer ano
- Reduje CAC en 35% mediante optimizacion de canales y automatizacion con HubSpot

Head of Growth — MercadoLibre (2018–2022)
- Escale equipo de growth marketing de 3 a 18 personas en 2 anos
- Aumente revenue de canales digitales en 240% ($12M a $41M)
- Lance programa de referidos que aporto 22% de nuevos usuarios mensuales

Educacion
Universidad de Buenos Aires — Lic. en Comunicacion (2010–2014)
IE Business School — Master en Marketing Digital (2016–2017)

Habilidades
Growth Marketing, ABM, HubSpot, Salesforce, Google Ads, SEO, Data Analytics, Marketing Automation, B2B SaaS`,
  jobDescription: "VP de Marketing en empresa SaaS B2B con presencia en LATAM",
  targetAudience: "C-suite ejecutivos en tecnologia",
  expectedScoreRange: [45, 92],
  expectedTiers: ["excellent", "good", "fair"],
};

const averageStartupFounderES: EvalFixture = {
  name: "Average – Startup Founder (ES)",
  linkedinText: `Miguel Torres
Fundador & CEO de TechStartup | Emprendedor | Innovacion

Acerca de
Emprendedor apasionado por la tecnologia y la innovacion. Funde mi startup en 2021 donde desarrollamos soluciones SaaS para pymes. Me encanta construir productos que resuelven problemas reales. Busco conectar con inversores y mentores en el ecosistema emprendedor.

Experiencia
Fundador & CEO — TechStartup (2021–Presente)
- Desarrollo plataforma SaaS para gestion de pymes
- Gestion de equipo de 5 personas
- Levante ronda pre-seed

Desarrollador Web — AgenciaDigital (2018–2021)
- Desarrollo de sitios web para clientes
- Trabajo con React y Node.js
- Mantenimiento de sistemas existentes

Educacion
Universidad Politecnica de Madrid — Ing. Informatica (2014–2018)

Habilidades
JavaScript, React, Node.js, Emprendimiento, Liderazgo, Product Management`,
  jobDescription: "",
  targetAudience: "Inversores y mentores del ecosistema startup",
  expectedScoreRange: [25, 70],
  expectedTiers: ["good", "fair", "poor"],
  objectiveMode: "objective",
  objectiveText: "Posicionarme como lider de pensamiento en el ecosistema de startups LATAM y atraer inversores para ronda seed",
};

const careerChangerTeacherToPM: EvalFixture = {
  name: "Career Changer – Teacher to PM",
  linkedinText: `Jennifer Walsh
Aspiring Product Manager | Career Transition from Education

About
After 8 years as a high school math teacher, I am transitioning into product management. I believe my skills in curriculum design, student data analysis, and stakeholder management translate well to PM work. Currently completing a product management bootcamp and seeking entry-level PM roles.

Experience
Math Teacher — Lincoln High School (2016–2024)
- Taught Algebra and Calculus to 150+ students per year
- Designed curriculum that improved standardized test scores
- Used data from student assessments to adjust teaching methods
- Coordinated with parents and administration on student progress

Student Teacher — Jefferson Middle School (2015–2016)
- Assisted lead teacher with lesson planning
- Graded assignments and provided feedback

Education
University of Michigan — B.S. Mathematics (2011–2015)
General Assembly — Product Management Bootcamp (2024)

Skills
Curriculum Design, Data Analysis, Communication, Excel, Problem Solving, Stakeholder Management`,
  cvText: `Jennifer Walsh
Detroit, MI | jennifer.walsh@email.com | (313) 555-0192

Objective: Transitioning from 8 years in education to product management, leveraging data-driven curriculum design and stakeholder coordination skills.

Work Experience
Math Teacher — Lincoln High School (2016–2024)
- Taught Algebra II and AP Calculus to 150+ students annually
- Redesigned Algebra II curriculum based on student performance data
- Improved standardized test pass rates from 68% to 81% over 3 years
- Managed parent-teacher communication for 150+ families

Education
General Assembly — Product Management Certificate (2024)
University of Michigan — B.S. Mathematics, cum laude (2011–2015)

Skills: Excel, Google Analytics (certified), Jira (bootcamp project), SQL (beginner), Figma (beginner)`,
  jobDescription: "Associate Product Manager at an EdTech startup building K-12 learning platforms",
  targetAudience: "Hiring managers in EdTech",
  expectedScoreRange: [20, 55],
  expectedTiers: ["good", "fair", "poor"],
};

const executiveVPEngineeringGrowth: EvalFixture = {
  name: "Executive – VP Engineering (Growth)",
  linkedinText: `Robert Kim
VP of Engineering at DataScale | Building High-Performance Engineering Orgs | Cloud Infrastructure | Ex-AWS

About
I build and scale world-class engineering organizations. At DataScale, I grew the engineering team from 40 to 180 engineers across 5 offices while maintaining top-quartile velocity metrics. Previously at AWS, where I led the S3 Storage team (60 engineers) and shipped Object Lambda, generating $200M in first-year revenue.

I write weekly about engineering leadership, team scaling, and infrastructure architecture. Follow me for practical frameworks from 18 years of building engineering teams.

Experience
VP of Engineering — DataScale (2021–Present)
- Scaled engineering org from 40 to 180 engineers across Seattle, Austin, London, Berlin, and Singapore
- Reduced deployment cycle from 2 weeks to daily, achieving 99.99% deployment success rate
- Implemented engineering career ladder that reduced attrition from 22% to 8%
- Architected migration from monolith to microservices, reducing infrastructure costs by $4.2M/year

Senior Engineering Manager — AWS (2016–2021)
- Led S3 Storage team of 60 engineers, responsible for storing 100+ exabytes of data
- Shipped S3 Object Lambda, new $200M/year product line
- Built and launched S3 Intelligent-Tiering, saving customers $1B+ in storage costs
- Mentored 8 engineers into management roles

Engineering Manager — Dropbox (2012–2016)
- Grew sync engine team from 5 to 22 engineers
- Delivered Smart Sync feature reducing local disk usage by 60%
- Led migration from Python to Rust for core sync operations

Education
MIT — M.S. Computer Science (2010–2012)
UC Berkeley — B.S. EECS (2006–2010)

Skills
Engineering Leadership, Distributed Systems, Cloud Infrastructure, AWS, Team Scaling, Architecture, Go, Rust, Python`,
  jobDescription: "",
  targetAudience: "Engineering leaders, CTOs, and tech community",
  expectedScoreRange: [50, 85],
  expectedTiers: ["excellent", "good"],
  objectiveMode: "objective",
  objectiveText: "Build a personal brand as a thought leader in engineering leadership and infrastructure architecture. Grow LinkedIn following and attract speaking opportunities.",
};

const entryLevelCSStudent: EvalFixture = {
  name: "Entry-Level – CS Student",
  linkedinText: `Alex Rivera
Computer Science Student at UT Austin | Graduating May 2025

About
CS student interested in software engineering. I have done some projects and am looking for a full-time job after graduation.

Experience
Intern — LocalTechCo (Summer 2024)
- Worked on the frontend team
- Built some React components
- Attended stand-up meetings

Barista — Starbucks (2022–2024)
- Made drinks
- Customer service

Education
UT Austin — B.S. Computer Science (Expected May 2025)
GPA: 3.4
Relevant coursework: Data Structures, Algorithms, Operating Systems, Databases

Skills
Java, Python, React, Git`,
  cvText: `Alex Rivera
Austin, TX | alex.rivera@utexas.edu | (512) 555-0147

Education
University of Texas at Austin — B.S. Computer Science (Expected May 2025)
GPA: 3.4/4.0
Coursework: Data Structures, Algorithms, Operating Systems, Database Systems, Software Engineering

Experience
Software Engineering Intern — LocalTechCo (June 2024–August 2024)
- Built React components for customer dashboard
- Participated in daily standups and sprint planning

Barista — Starbucks (2022–2024)
- Provided customer service in high-volume store

Projects
Task Manager App — Personal Project
- Built a full-stack task manager using React and Express
- Used MongoDB for data storage

Skills: Java, Python, JavaScript, React, Node.js, Git, SQL`,
  jobDescription: "New Grad Software Engineer at a mid-size tech company (100-500 employees)",
  targetAudience: "University recruiters and engineering managers",
  expectedScoreRange: [15, 50],
  expectedTiers: ["good", "fair", "poor"],
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
  // Sprint 1: New fixtures (5)
  strongMarketingDirectorES,
  averageStartupFounderES,
  careerChangerTeacherToPM,
  executiveVPEngineeringGrowth,
  entryLevelCSStudent,
];
