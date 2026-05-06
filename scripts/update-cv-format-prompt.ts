/**
 * Phase 4.2 Step 7: Update export.updated-cv.format prompt
 *
 * Updates the CV format prompt in the prompt_registry to match the new
 * Wonsulting-style ATS-friendly format implemented in the DOCX + PDF generators.
 *
 * Creates v2 (active), archives v1.
 * Idempotent: checks if v2 already exists before creating.
 *
 * Usage: npx tsx scripts/update-cv-format-prompt.ts
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// New v2 prompts — Wonsulting ATS-friendly format
// ─────────────────────────────────────────────────────────────

const CV_FORMAT_EN_V2 = `Updated CV — Wonsulting ATS-Friendly Format

This CV has been rewritten based on your ProfileScore audit to maximize ATS compatibility and recruiter impact. The format follows Wonsulting best practices: single-column, no tables, no images, no columns — pure text that every ATS can parse.

Font: Times New Roman (serif, universally compatible)
Page size: US Letter (8.5" x 11")
Margins: 1 inch all sides

HEADER:
- Full name (18pt bold, centered)
- Contact line (11pt, centered): City, ST | email | phone | linkedin.com/in/handle
- Horizontal rule separator

SECTION ORDER (adapts to profile):

Professional profiles (1+ years experience):
1. Contact Information
2. Professional Summary
3. Work Experience
4. Skills & Competencies
5. Education
6. Certifications & Awards

Student / recent graduate profiles:
1. Contact Information
2. Professional Summary
3. Education
4. Work Experience (if any)
5. Skills & Competencies
6. Certifications & Awards

ENTRY FORMAT (Work Experience):
- Company Name [right-aligned: Location]
  (Bold, 10pt)
- Position Title [right-aligned: Date Range]
  (Italic, 10pt)
- Achievement bullets with quantified impact
  (10pt, standard bullet character)

Each bullet uses the XYZ impact formula:
"Accomplished [X] as measured by [Y] by doing [Z]"

Funnel approach: Recent roles get 4-6 bullets, older roles 2-3.`;

const CV_FORMAT_ES_V2 = `CV Actualizado — Formato ATS Compatible Estilo Wonsulting

Este CV ha sido reescrito basandose en tu auditoria de ProfileScore para maximizar la compatibilidad con ATS y el impacto con reclutadores. El formato sigue las mejores practicas de Wonsulting: columna unica, sin tablas, sin imagenes, sin columnas — texto puro que cualquier ATS puede analizar.

Fuente: Times New Roman (serif, universalmente compatible)
Tamano de pagina: US Letter (8.5" x 11")
Margenes: 1 pulgada en todos los lados

ENCABEZADO:
- Nombre completo (18pt negrita, centrado)
- Linea de contacto (11pt, centrada): Ciudad, Estado | email | telefono | linkedin.com/in/handle
- Linea separadora horizontal

ORDEN DE SECCIONES (se adapta al perfil):

Perfiles profesionales (1+ anos de experiencia):
1. Informacion de Contacto
2. Resumen Profesional
3. Experiencia Laboral
4. Habilidades y Competencias
5. Educacion
6. Certificaciones y Premios

Perfiles de estudiantes / recien graduados:
1. Informacion de Contacto
2. Resumen Profesional
3. Educacion
4. Experiencia Laboral (si existe)
5. Habilidades y Competencias
6. Certificaciones y Premios

FORMATO DE ENTRADA (Experiencia Laboral):
- Nombre de Empresa [alineado a la derecha: Ubicacion]
  (Negrita, 10pt)
- Titulo del Puesto [alineado a la derecha: Rango de Fechas]
  (Cursiva, 10pt)
- Puntos de logros con impacto cuantificado
  (10pt, caracter de vineta estandar)

Cada vineta usa la formula de impacto XYZ:
"Logre [X] medido por [Y] haciendo [Z]"

Enfoque de embudo: Roles recientes obtienen 4-6 vinetas, roles anteriores 2-3.`;

// ─────────────────────────────────────────────────────────────
// Execution
// ─────────────────────────────────────────────────────────────

interface UpdateResult {
  locale: string;
  oldVersion: number;
  newVersion: number;
  oldChars: number;
  newChars: number;
  status: string;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Phase 4.2 Step 7: Update export.updated-cv.format");
  console.log("═══════════════════════════════════════════════════════════\n");

  const updates = [
    { locale: "en", newContent: CV_FORMAT_EN_V2 },
    { locale: "es", newContent: CV_FORMAT_ES_V2 },
  ];

  const results: UpdateResult[] = [];

  for (const update of updates) {
    console.log(`\n─── export.updated-cv.format (${update.locale}) ───`);

    // 1. Find current active prompt
    const current = await prisma.promptRegistry.findFirst({
      where: {
        promptKey: "export.updated-cv.format",
        locale: update.locale,
        status: "active",
      },
      orderBy: { version: "desc" },
    });

    if (!current) {
      console.log("    ⚠️  No active prompt found — skipping");
      results.push({
        locale: update.locale,
        oldVersion: 0,
        newVersion: 0,
        oldChars: 0,
        newChars: update.newContent.length,
        status: "SKIPPED (no active prompt)",
      });
      continue;
    }

    const newVersion = current.version + 1;

    // 2. Check idempotency
    const existing = await prisma.promptRegistry.findFirst({
      where: {
        promptKey: "export.updated-cv.format",
        locale: update.locale,
        version: newVersion,
      },
    });

    if (existing) {
      console.log(`    ✓ Version ${newVersion} already exists — skipping (idempotent)`);
      results.push({
        locale: update.locale,
        oldVersion: current.version,
        newVersion,
        oldChars: current.content.length,
        newChars: existing.content.length,
        status: "ALREADY EXISTS",
      });
      continue;
    }

    // 3. Create new version (active)
    await prisma.promptRegistry.create({
      data: {
        promptKey: "export.updated-cv.format",
        version: newVersion,
        locale: update.locale,
        modelTarget: current.modelTarget,
        content: update.newContent,
        status: "active",
        updatedBy: "script/update-cv-format-p42",
      },
    });

    // 4. Archive old version
    await prisma.promptRegistry.update({
      where: { id: current.id },
      data: { status: "archived" },
    });

    const charDiff = update.newContent.length - current.content.length;
    const charPct = ((charDiff / current.content.length) * 100).toFixed(1);
    console.log(`    ✅ v${current.version} → v${newVersion}`);
    console.log(`    📏 ${current.content.length} → ${update.newContent.length} chars (${charDiff >= 0 ? "+" : ""}${charDiff}, ${charPct}%)`);

    results.push({
      locale: update.locale,
      oldVersion: current.version,
      newVersion,
      oldChars: current.content.length,
      newChars: update.newContent.length,
      status: "UPDATED",
    });
  }

  // ─── Summary ───
  console.log("\n\n═══════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("| Locale | Old Ver | New Ver | Old Chars | New Chars | Change | Status |");
  console.log("|--------|---------|---------|-----------|-----------|--------|--------|");

  for (const r of results) {
    const diff = r.newChars - r.oldChars;
    const sign = diff >= 0 ? "+" : "";
    console.log(
      `| ${r.locale} | v${r.oldVersion} | v${r.newVersion} | ${r.oldChars} | ${r.newChars} | ${sign}${diff} | ${r.status} |`
    );
  }

  // Verification
  console.log("\n─── Verification ───");
  const activeCount = await prisma.promptRegistry.count({
    where: { promptKey: "export.updated-cv.format", status: "active" },
  });
  const archivedCount = await prisma.promptRegistry.count({
    where: { promptKey: "export.updated-cv.format", status: "archived" },
  });
  console.log(`export.updated-cv.format — Active: ${activeCount}, Archived: ${archivedCount}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal error:", e);
  prisma.$disconnect();
  process.exit(1);
});
