import type { ExportModule } from "../types";

export const mockExportModules: ExportModule[] = [
  {
    id: "results-summary",
    includedInPlans: ["starter", "recommended"],
  },
  {
    id: "full-audit",
    includedInPlans: ["starter", "recommended"],
  },
  {
    id: "updated-cv",
    includedInPlans: ["starter", "recommended"],
  },
  {
    id: "cover-letter",
    includedInPlans: ["recommended"],
  },
  {
    id: "linkedin-updates",
    includedInPlans: ["starter", "recommended"],
  },
];
