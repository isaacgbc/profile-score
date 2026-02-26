/**
 * PR2C: Update existing v3 audit prompts with hard limits on suggestion length.
 * The seed skips existing records, so this script updates the content directly.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Check current state
  const prompts = await db.promptRegistry.findMany({
    where: {
      promptKey: { in: ["audit.linkedin.system", "audit.cv.system"] },
      version: 3,
      status: "active",
    },
    select: { id: true, promptKey: true, locale: true, content: true },
  });

  for (const p of prompts) {
    const hasHardLimits =
      p.content.includes("HARD LIMITS") ||
      p.content.includes("LIMITES ESTRICTOS");

    if (hasHardLimits) {
      console.log(`✓ ${p.promptKey} [${p.locale}] already has hard limits`);
      continue;
    }

    // Replace old suggestion rules with new ones (EN)
    let updated = p.content;

    // EN pattern
    if (p.locale === "en") {
      updated = updated.replace(
        /SUGGESTION RULES \(2-3 suggestions\):[\s\S]*?IMPORTANT: Respond with ONLY a valid JSON object\. No markdown, no code fences, no extra text\./,
        `SUGGESTION RULES:
- Return 2 to 4 suggestions. Each suggestion MUST be ONE actionable sentence, max 220 characters.
- Formula: [WHAT to change] + [WHY] + [HOW in brief].
- No paragraphs, no multi-sentence suggestions, no long examples.

Respond in JSON: { "score": number, "tier": string, "explanation": string, "suggestions": ["...", "..."] }

HARD LIMITS: Each suggestion <= 220 chars. Max 4 suggestions. Respond with ONLY valid JSON, no markdown, no code fences.`
      );
    }

    // ES pattern
    if (p.locale === "es") {
      updated = updated.replace(
        /REGLAS DE SUGERENCIAS \(2-3 sugerencias\):[\s\S]*?IMPORTANTE: Responde SOLO con un objeto JSON valido\. Sin markdown, sin bloques de codigo, sin texto adicional\./,
        `REGLAS DE SUGERENCIAS:
- Devuelve 2 a 4 sugerencias. Cada sugerencia DEBE ser UNA oracion accionable, maximo 220 caracteres.
- Formula: [QUE cambiar] + [POR QUE] + [COMO en breve].
- Sin parrafos, sin sugerencias de multiples oraciones.

Responde en JSON: { "score": number, "tier": string, "explanation": string, "suggestions": ["...", "..."] }

LIMITES ESTRICTOS: Cada sugerencia <= 220 caracteres. Maximo 4 sugerencias. Responde SOLO con JSON valido, sin markdown.`
      );
    }

    if (updated === p.content) {
      console.log(
        `⚠ ${p.promptKey} [${p.locale}] — pattern not found, skipping`
      );
      continue;
    }

    await db.promptRegistry.update({
      where: { id: p.id },
      data: { content: updated },
    });
    console.log(
      `✓ ${p.promptKey} [${p.locale}] updated with hard limits (${p.content.length} → ${updated.length} chars)`
    );
  }

  await db.$disconnect();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
