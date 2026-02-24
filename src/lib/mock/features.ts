import type { Feature } from "../types";

export const mockFeatures: Feature[] = [
  {
    id: "linkedin-audit",
    icon: "search",
    includedInPlans: ["starter", "recommended", "pro", "coach"],
  },
  {
    id: "cv-rewrite",
    icon: "file-text",
    includedInPlans: ["recommended", "pro", "coach"],
  },
  {
    id: "job-optimization",
    icon: "target",
    includedInPlans: ["pro", "coach"],
  },
  {
    id: "cover-letter",
    icon: "mail",
    includedInPlans: ["coach"],
  },
];
