import { z } from "zod";

export const CreateAuditInput = z.object({
  results: z.record(z.string(), z.unknown()),
  planId: z
    .enum(["starter", "recommended", "pro", "coach"])
    .nullable()
    .optional(),
});

export type CreateAuditInput = z.infer<typeof CreateAuditInput>;

export const AuditResponse = z.object({
  auditId: z.string().uuid(),
});

export type AuditResponse = z.infer<typeof AuditResponse>;
