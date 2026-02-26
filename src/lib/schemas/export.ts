import { z } from "zod";

// ─── Input Schemas ───────────────────────────────────

export const CreateExportInput = z.object({
  auditId: z.string().uuid(),
  exportType: z.enum([
    "results-summary",
    "full-audit",
    "updated-cv",
    "cover-letter",
    "linkedin-updates",
  ]),
  format: z.enum(["pdf", "json"]),
  language: z.enum(["en", "es"]),
  planId: z
    .enum(["starter", "recommended", "pro", "coach"])
    .nullable()
    .optional(),
  /** User edits from Rewrite Studio to merge into export */
  userEdits: z
    .object({
      /** Edited "Things to Change" text per sectionId */
      userImprovements: z.record(z.string(), z.string().max(5_000)).optional(),
      /** Regenerated optimized text per sectionId */
      userRewritten: z.record(z.string(), z.string().max(15_000)).optional(),
      /** Direct user edits to optimized draft (highest priority) */
      userOptimized: z.record(z.string(), z.string().max(15_000)).optional(),
    })
    .optional(),
});

export type CreateExportInput = z.infer<typeof CreateExportInput>;

// ─── Response Schemas ────────────────────────────────

export const ExportResponse = z.object({
  exportId: z.string().uuid(),
  status: z.enum(["queued", "processing", "ready", "failed"]),
  exportType: z.string(),
  format: z.string(),
  language: z.string(),
  fileUrl: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type ExportResponse = z.infer<typeof ExportResponse>;

export const ModuleExportInfo = z.object({
  moduleId: z.string(),
  unlocked: z.boolean(),
  exports: z.array(ExportResponse),
});

export const AuditExportsResponse = z.object({
  auditId: z.string().uuid(),
  modules: z.array(ModuleExportInfo),
});

export type AuditExportsResponse = z.infer<typeof AuditExportsResponse>;
