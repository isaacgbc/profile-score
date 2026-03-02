import type { Plan } from "../types";

export const mockPlans: Plan[] = [
  {
    id: "starter",
    price: 5,
    interval: "one-time",
    features: ["linkedin-audit", "cv-rewrite", "job-optimization"],
    exportModules: ["results-summary", "full-audit", "updated-cv", "linkedin-updates"],
  },
  {
    id: "recommended",
    price: 10,
    interval: "one-time",
    highlighted: true,
    features: ["linkedin-audit", "cv-rewrite", "job-optimization", "cover-letter"],
    exportModules: ["results-summary", "full-audit", "updated-cv", "cover-letter", "linkedin-updates"],
  },
];
