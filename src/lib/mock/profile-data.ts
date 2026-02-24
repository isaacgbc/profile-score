import type { UserInput } from "../types";

export const mockUserInput: UserInput = {
  method: "linkedin",
  linkedinUrl: "https://linkedin.com/in/johndoe-dev",
  linkedinText: `Software Developer at Tech Company

About
Experienced developer with 5 years in the industry. I know JavaScript, Python, and various frameworks. Looking for new opportunities.

Experience
Software Developer - Tech Company (2020-Present)
Worked on various projects using JavaScript and Python. Responsible for building features and fixing bugs.

Junior Developer - Startup Inc (2018-2020)
Built web applications and helped with database management. Used React and Node.js for frontend and backend development.

Education
BS Computer Science - State University (2014-2018)

Skills
JavaScript, Python, SQL, HTML, CSS, React, Node.js, Git`,
  cvFileName: null,
  jobDescription:
    "Senior Full-Stack Engineer at a Series B SaaS startup. Requirements: 5+ years experience, React, Node.js, AWS, system design skills. Team lead experience preferred.",
  targetAudience:
    "Tech recruiters and engineering managers at high-growth startups (Series A-C)",
  objectiveMode: "job",
  objectiveText: "",
  targetUrl: "",
  targetFileName: null,
  targetInputType: null,
  email: "",
};

export const emptyUserInput: UserInput = {
  method: null,
  linkedinUrl: "",
  linkedinText: "",
  cvFileName: null,
  jobDescription: "",
  targetAudience: "",
  objectiveMode: "job",
  objectiveText: "",
  targetUrl: "",
  targetFileName: null,
  targetInputType: null,
  email: "",
};
