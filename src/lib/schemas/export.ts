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
