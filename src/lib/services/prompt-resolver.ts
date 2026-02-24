import { prisma } from "@/lib/db/client";
import type { Locale } from "@/lib/types";

/**
 * Resolve the active prompt for a given key and locale.
 * Falls back to "en" if the requested locale has no active prompt.
 */
export async function getActivePrompt(
  key: string,
  locale: Locale = "en"
): Promise<string | null> {
  // Try exact locale match
  const prompt = await prisma.promptRegistry.findFirst({
    where: { promptKey: key, locale, status: "active" },
    orderBy: { version: "desc" },
  });
  if (prompt) return prompt.content;

  // Fallback to "en" if different locale requested
  if (locale !== "en") {
    const fallback = await prisma.promptRegistry.findFirst({
      where: { promptKey: key, locale: "en", status: "active" },
      orderBy: { version: "desc" },
    });
    if (fallback) return fallback.content;
  }

  return null;
}

/**
 * Interpolate `{{variable}}` placeholders in a template string.
 * Unmatched placeholders are left as-is.
 */
export function interpolatePrompt(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (match, key: string) => vars[key] ?? match
  );
}
