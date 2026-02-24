import type { Plan } from "../types";

export const mockPlans: Plan[] = [
  {
    id: "starter",
    price: 5,
    interval: "one-time",
    features: ["linkedin-audit"],
    exportModules: ["results-summary"],
  },
  {
    id: "recommended",
    price: 9.99,
    interval: "one-time",
    features: ["linkedin-audit", "cv-rewrite"],
    highlighted: true,
    exportModules: ["results-summary", "full-audit", "updated-cv"],
  },
  {
    id: "pro",
    price: 14.99,
    interval: "monthly",
    features: ["linkedin-audit", "cv-rewrite", "job-optimization"],
    exportModules: ["results-summary", "full-audit", "updated-cv", "linkedin-updates"],
  },
  {
    id: "coach",
    price: 49.99,
    interval: "monthly",
    features: ["linkedin-audit", "cv-rewrite", "job-optimization", "cover-letter"],
    exportModules: ["results-summary", "full-audit", "updated-cv", "cover-letter", "linkedin-updates"],
  },
];
