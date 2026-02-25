import { z } from "zod";

export const CreateAuditInput = z.object({
  results: z.record(z.string(), z.unknown()),
  planId: z
    .enum(["starter", "recommended", "pro", "coach"])
    .nullable()
    .optional(),
  // Sanitized user input — only non-sensitive fields
  userInput: z
    .object({
      jobDescription: z.string().max(5000).optional(),
      targetAudience: z.string().max(1000).optional(),
      objectiveMode: z.enum(["job", "objective"]).optional(),
      objectiveText: z.string().max(2000).optional(),
    })
    .optional(),
  // Generation metadata for traceability
  generationMeta: z
    .object({
      modelUsed: z.string().max(100).optional(),
      promptVersionsUsed: z.record(z.string(), z.number()).optional(),
      durationMs: z.number().optional(),
      fallbackCount: z.number().optional(),
    })
    .nullable()
    .optional(),
});

export type CreateAuditInput = z.infer<typeof CreateAuditInput>;

export const AuditResponse = z.object({
  auditId: z.string().uuid(),
});

export type AuditResponse = z.infer<typeof AuditResponse>;
