import { z } from "zod";

// ─── Input Schemas ───────────────────────────────────

export const CreatePromptInput = z.object({
  promptKey: z.string().min(1).max(255),
  locale: z.enum(["en", "es"]).default("en"),
  modelTarget: z.string().max(100).nullable().optional(),
  content: z.string().min(1),
});

export type CreatePromptInput = z.infer<typeof CreatePromptInput>;

export const UpdatePromptInput = z.object({
  content: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  modelTarget: z.string().max(100).nullable().optional(),
});

export type UpdatePromptInput = z.infer<typeof UpdatePromptInput>;

// ─── Response Schemas ────────────────────────────────

export const PromptResponse = z.object({
  id: z.string().uuid(),
  promptKey: z.string(),
  version: z.number(),
  locale: z.string(),
  modelTarget: z.string().nullable(),
  content: z.string(),
  status: z.string(),
  updatedBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PromptResponse = z.infer<typeof PromptResponse>;
