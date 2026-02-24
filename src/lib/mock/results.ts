import type { ProfileResult } from "../types";

export const mockResults: ProfileResult = {
  overallScore: 72,
  maxScore: 100,
  tier: "good",

  linkedinSections: [
    {
      id: "headline",
      score: 85,
      maxScore: 100,
      tier: "excellent",
      locked: false,
      source: "linkedin",
      explanation: "Your headline includes a job title but lacks keywords recruiters search for, a value proposition, and specialization signals.",
      improvementSuggestions: [
        "Add a keyword-rich specialization",
        "Include a measurable value proposition",
        "Mention your seniority level",
      ],
    },
    {
      id: "summary",
      score: 60,
      maxScore: 100,
      tier: "fair",
      locked: false,
      source: "linkedin",
      explanation: "Your summary is vague with no metrics, no specialization, and no proof of impact. It reads passively and lacks a clear narrative.",
      improvementSuggestions: [
        "Add 2-3 quantified achievements",
        "State your specialization clearly",
        "Replace passive language with active voice",
        "Remove 'Looking for opportunities' — it signals desperation",
      ],
    },
    {
      id: "experience",
      score: 78,
      maxScore: 100,
      tier: "good",
      locked: false,
      source: "linkedin",
      explanation: "Your experience section lists responsibilities but lacks specific achievements, metrics, and the STAR format that recruiters prefer.",
      improvementSuggestions: [
        "Add measurable outcomes (e.g., '40% reduction in incidents')",
        "Use STAR format: Situation, Task, Action, Result",
        "Include specific technologies and project scale",
      ],
    },
    {
      id: "skills",
      score: 65,
      maxScore: 100,
      tier: "fair",
      locked: true,
      source: "linkedin",
      explanation: "Your skills list is flat with no hierarchy. Modern frameworks, cloud platforms, and methodology keywords are missing.",
      improvementSuggestions: [
        "Organize skills into categories (Core, Cloud, Practices)",
        "Add modern framework names ATS systems scan for",
        "Include soft skills and methodologies",
      ],
    },
    {
      id: "education",
      score: 90,
      maxScore: 100,
      tier: "excellent",
      locked: true,
      source: "linkedin",
      explanation: "Education section is well-structured. Consider adding relevant coursework, honors, or certifications to maximize impact.",
      improvementSuggestions: [
        "Add relevant coursework or projects",
        "Include any honors or GPA if notable",
      ],
    },
    {
      id: "recommendations",
      score: 40,
      maxScore: 100,
      tier: "poor",
      locked: true,
      source: "linkedin",
      explanation: "You have no recommendations. Profiles with 3+ recommendations are 2x more likely to get recruiter outreach.",
      improvementSuggestions: [
        "Request recommendations from recent managers",
        "Ask colleagues to highlight specific projects",
        "Aim for at least 3 quality recommendations",
      ],
    },
  ],

  cvSections: [
    {
      id: "contact-info",
      score: 80,
      maxScore: 100,
      tier: "good",
      locked: false,
      source: "cv",
      explanation: "Contact information is present but could include a portfolio link and LinkedIn URL for maximum discoverability.",
      improvementSuggestions: [
        "Add LinkedIn profile URL",
        "Include portfolio or GitHub link",
        "Ensure phone number format is consistent",
      ],
    },
    {
      id: "professional-summary",
      score: 55,
      maxScore: 100,
      tier: "fair",
      locked: false,
      source: "cv",
      explanation: "Your CV summary is generic and could be for anyone. ATS systems need specific keywords and a clear value statement.",
      improvementSuggestions: [
        "Lead with years of experience and specialization",
        "Include 2-3 key technical skills",
        "Add a quantified achievement in the first sentence",
      ],
    },
    {
      id: "work-experience",
      score: 70,
      maxScore: 100,
      tier: "good",
      locked: false,
      source: "cv",
      explanation: "Work experience has good structure but bullets lack quantified impact. ATS-friendly formatting could improve parsing.",
      improvementSuggestions: [
        "Start each bullet with a strong action verb",
        "Add metrics to at least 50% of bullets",
        "Use consistent date formatting",
      ],
    },
    {
      id: "skills-section",
      score: 60,
      maxScore: 100,
      tier: "fair",
      locked: true,
      source: "cv",
      explanation: "Skills section needs better categorization. ATS systems match exact keywords from job descriptions.",
      improvementSuggestions: [
        "Group skills by category",
        "Match keywords from target job descriptions",
        "Remove outdated technologies",
      ],
    },
    {
      id: "education-section",
      score: 88,
      maxScore: 100,
      tier: "excellent",
      locked: true,
      source: "cv",
      explanation: "Education is well-formatted. Adding relevant certifications would strengthen this section further.",
      improvementSuggestions: [
        "Add professional certifications",
        "Include relevant online courses",
      ],
    },
    {
      id: "certifications",
      score: 30,
      maxScore: 100,
      tier: "poor",
      locked: true,
      source: "cv",
      explanation: "No certifications listed. Industry certifications significantly boost ATS ranking and recruiter trust.",
      improvementSuggestions: [
        "Add AWS, Google Cloud, or Azure certifications",
        "Include relevant professional development",
        "List any completed specialized training",
      ],
    },
  ],

  linkedinRewrites: [
    {
      sectionId: "headline",
      source: "linkedin",
      original: "Software Developer at Tech Company",
      improvements: "Too generic — no specialization, no value proposition, no keywords recruiters search for. Missing seniority level and industry focus.",
      missingSuggestions: [
        "Seniority level (Senior, Lead, Staff)",
        "Specialization keywords (Full-Stack, Backend, Frontend)",
        "Value proposition (what you deliver)",
        "Industry focus (SaaS, FinTech, HealthTech)",
      ],
      rewritten: "Senior Full-Stack Engineer | Building scalable SaaS products | React, Node.js, AWS | Helping teams ship 3x faster",
      locked: false,
    },
    {
      sectionId: "summary",
      source: "linkedin",
      original: "Experienced developer with 5 years in the industry. I know JavaScript, Python, and various frameworks. Looking for new opportunities.",
      improvements: "Vague and passive. No metrics, no specialization, no proof of impact. 'Looking for new opportunities' signals desperation to recruiters.",
      missingSuggestions: [
        "Quantified achievements (revenue, users, performance)",
        "Clear specialization statement",
        "Proof of leadership or mentoring",
        "What makes you different from other candidates",
      ],
      rewritten: "Full-stack engineer with 5+ years turning complex business requirements into elegant, scalable solutions. Specialized in React/Node.js architectures serving 100K+ users. Passionate about developer experience, clean APIs, and mentoring junior engineers. Previously helped Series B startup reduce page load times by 60% and increase user retention by 25%.",
      locked: false,
    },
    {
      sectionId: "experience",
      source: "linkedin",
      original: "Worked on various projects using JavaScript and Python. Responsible for building features and fixing bugs.",
      improvements: "No specifics — what projects? What scale? 'Fixing bugs' is not an achievement. Needs STAR format with measurable outcomes.",
      missingSuggestions: [
        "Project scale and user impact numbers",
        "Specific technologies used per project",
        "Leadership or mentoring contributions",
        "Business outcomes tied to your work",
      ],
      rewritten: "Led development of customer-facing dashboard serving 50K daily active users, implementing real-time data visualization with React and D3.js. Architected microservices migration that reduced deployment time from 2 hours to 15 minutes. Mentored 3 junior developers, establishing code review practices that decreased production incidents by 40%.",
      locked: false,
    },
    {
      sectionId: "skills",
      source: "linkedin",
      original: "JavaScript, Python, SQL, HTML, CSS",
      improvements: "Flat list with no hierarchy or context. Missing modern frameworks, cloud skills, and methodology keywords that ATS systems scan for.",
      missingSuggestions: [
        "Cloud platform certifications (AWS, GCP, Azure)",
        "Modern framework versions (React 18, Next.js)",
        "DevOps and infrastructure tools",
        "Soft skills and methodologies",
      ],
      rewritten: "Core: TypeScript, React, Node.js, Python, PostgreSQL | Cloud: AWS (Lambda, ECS, S3), Docker, Terraform | Practices: CI/CD, TDD, Agile/Scrum, System Design",
      locked: true,
    },
  ],

  cvRewrites: [
    {
      sectionId: "professional-summary",
      source: "cv",
      original: "Experienced developer with 5 years in the industry. Proficient in JavaScript and Python. Seeking challenging opportunities to grow my career.",
      improvements: "Generic opening that could belong to anyone. CV summaries need to be ATS-optimized with exact keyword matches from job descriptions.",
      missingSuggestions: [
        "Target role title match (e.g., 'Senior Full-Stack Engineer')",
        "Exact technology keywords from job posting",
        "Quantified career highlight in first sentence",
      ],
      rewritten: "Senior Full-Stack Engineer with 5+ years of experience building scalable web applications using React, Node.js, and AWS. Track record of reducing deployment times by 85% and increasing user retention by 25% at Series B startups. Seeking to leverage expertise in system design and team leadership at a high-growth SaaS company.",
      locked: false,
    },
    {
      sectionId: "work-experience",
      source: "cv",
      original: "Software Developer, Tech Company (2020-Present)\n• Built features using JavaScript and Python\n• Worked with the team on various projects\n• Fixed bugs and maintained codebase",
      improvements: "Bullets are task-based, not achievement-based. ATS systems and recruiters look for quantified impact, not job descriptions.",
      missingSuggestions: [
        "Revenue or cost impact of your work",
        "Team size and leadership scope",
        "Performance metrics and improvements",
        "Specific project names and scale",
      ],
      rewritten: "Senior Software Developer, Tech Company (2020-Present)\n• Led development of customer-facing analytics dashboard serving 50K+ DAU, increasing engagement by 35%\n• Architected microservices migration reducing deployment time from 2 hours to 15 minutes\n• Mentored team of 3 junior developers; established code review practices reducing production incidents by 40%\n• Designed and implemented real-time data pipeline processing 1M+ events daily",
      locked: false,
    },
    {
      sectionId: "skills-section",
      source: "cv",
      original: "Technical Skills: JavaScript, Python, SQL, HTML, CSS, React, Node.js, Git",
      improvements: "Single flat list lacks the categorization that ATS systems use for keyword matching. Missing proficiency levels and modern tools.",
      missingSuggestions: [
        "Skill categories (Languages, Frameworks, Cloud, Tools)",
        "Proficiency indicators",
        "Certifications and methodologies",
      ],
      rewritten: "Languages: TypeScript, JavaScript, Python, SQL, GraphQL\nFrameworks: React 18, Next.js, Node.js, Express, Django\nCloud & DevOps: AWS (Lambda, ECS, S3, CloudFormation), Docker, Terraform, CI/CD\nDatabases: PostgreSQL, MongoDB, Redis, DynamoDB\nPractices: TDD, Agile/Scrum, System Design, Code Review, Pair Programming",
      locked: true,
    },
  ],

  coverLetter: {
    content: `Dear Hiring Manager,

I am writing to express my strong interest in the Senior Full-Stack Engineer position at your company. With over 5 years of experience building scalable SaaS products using React, Node.js, and AWS, I bring a proven track record of delivering high-impact solutions that drive measurable business results.

In my current role at Tech Company, I led the development of a customer-facing analytics dashboard that serves over 50,000 daily active users. I architected a microservices migration that reduced deployment time by 85%, and established mentoring and code review practices that decreased production incidents by 40%. These experiences have sharpened my ability to balance technical excellence with team leadership.

What excites me about this opportunity is the chance to apply my system design expertise and leadership experience at a company solving meaningful problems at scale. I am particularly drawn to your team's commitment to developer experience and engineering culture.

I would welcome the opportunity to discuss how my skills and experience align with your team's goals. Thank you for considering my application.

Best regards,
[Your Name]`,
    locked: true,
  },
};
