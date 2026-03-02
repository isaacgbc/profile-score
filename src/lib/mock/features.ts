import type { Feature } from "../types";

export const mockFeatures: Feature[] = [
  {
    id: "linkedin-audit",
    icon: "search",
    includedInPlans: ["starter", "recommended"],
  },
  {
    id: "cv-rewrite",
    icon: "file-text",
    includedInPlans: ["starter", "recommended"],
  },
  {
    id: "job-optimization",
    icon: "target",
    includedInPlans: ["starter", "recommended"],
  },
  {
    id: "cover-letter",
    icon: "mail",
    includedInPlans: ["recommended"],
  },
];
