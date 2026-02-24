import type { ExportModule } from "../types";

export const mockExportModules: ExportModule[] = [
  {
    id: "results-summary",
    includedInPlans: ["starter", "recommended", "pro", "coach"],
  },
  {
    id: "full-audit",
    includedInPlans: ["recommended", "pro", "coach"],
  },
  {
    id: "updated-cv",
    includedInPlans: ["recommended", "pro", "coach"],
  },
  {
    id: "cover-letter",
    includedInPlans: ["coach"],
  },
  {
    id: "linkedin-updates",
    includedInPlans: ["pro", "coach"],
  },
];
