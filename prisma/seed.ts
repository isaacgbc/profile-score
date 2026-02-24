import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const prompts: {
  promptKey: string;
  locale: string;
  content: string;
  modelTarget?: string;
}[] = [
  // ── audit.linkedin.system ──
  {
    promptKey: "audit.linkedin.system",
    locale: "en",
    content: `You are an expert LinkedIn profile auditor. Evaluate the following LinkedIn profile section and provide:
1. A score from 0–100
2. A tier: "excellent" (80+), "good" (60-79), "needs-work" (40-59), or "poor" (0-39)
3. A brief explanation of the score
4. 2-3 specific, actionable suggestions for improvement

Section: {{section_name}}
Content: {{section_content}}
Target role: {{target_role}}

Respond in JSON format with keys: score, tier, explanation, suggestions (array of strings).`,
    modelTarget: "claude-sonnet",
  },
  {
    promptKey: "audit.linkedin.system",
    locale: "es",
    content: `Eres un auditor experto de perfiles de LinkedIn. Evalúa la siguiente sección del perfil de LinkedIn y proporciona:
1. Una puntuación de 0 a 100
2. Un nivel: "excellent" (80+), "good" (60-79), "needs-work" (40-59), o "poor" (0-39)
3. Una breve explicación de la puntuación
4. 2-3 sugerencias específicas y accionables para mejorar

Sección: {{section_name}}
Contenido: {{section_content}}
Rol objetivo: {{target_role}}

Responde en formato JSON con las claves: score, tier, explanation, suggestions (array de strings).`,
    modelTarget: "claude-sonnet",
  },

  // ── audit.cv.system ──
  {
    promptKey: "audit.cv.system",
    locale: "en",
    content: `You are an expert CV/resume auditor. Evaluate the following CV section for ATS compatibility, clarity, and impact. Provide:
1. A score from 0–100
2. A tier: "excellent" (80+), "good" (60-79), "needs-work" (40-59), or "poor" (0-39)
3. A brief explanation of the score
4. 2-3 specific, actionable suggestions for improvement

Section: {{section_name}}
Content: {{section_content}}
Target role: {{target_role}}

Respond in JSON format with keys: score, tier, explanation, suggestions (array of strings).`,
    modelTarget: "claude-sonnet",
  },
  {
    promptKey: "audit.cv.system",
    locale: "es",
    content: `Eres un auditor experto de CV/currículum. Evalúa la siguiente sección del CV en cuanto a compatibilidad ATS, claridad e impacto. Proporciona:
1. Una puntuación de 0 a 100
2. Un nivel: "excellent" (80+), "good" (60-79), "needs-work" (40-59), o "poor" (0-39)
3. Una breve explicación de la puntuación
4. 2-3 sugerencias específicas y accionables para mejorar

Sección: {{section_name}}
Contenido: {{section_content}}
Rol objetivo: {{target_role}}

Responde en formato JSON con las claves: score, tier, explanation, suggestions (array de strings).`,
    modelTarget: "claude-sonnet",
  },

  // ── rewrite.linkedin.section ──
  {
    promptKey: "rewrite.linkedin.section",
    locale: "en",
    content: `Rewrite the following LinkedIn {{section_name}} section to be more compelling, keyword-rich, and optimized for the target role.

Original content:
{{original_content}}

Target role: {{target_role}}
Job objective: {{job_objective}}

Guidelines:
- Maintain the author's authentic voice
- Include relevant industry keywords
- Use strong action verbs
- Quantify achievements where possible
- Keep it concise and scannable

Return only the rewritten content, no explanations.`,
  },
  {
    promptKey: "rewrite.linkedin.section",
    locale: "es",
    content: `Reescribe la siguiente sección {{section_name}} de LinkedIn para que sea más atractiva, rica en palabras clave y optimizada para el rol objetivo.

Contenido original:
{{original_content}}

Rol objetivo: {{target_role}}
Objetivo profesional: {{job_objective}}

Directrices:
- Mantén la voz auténtica del autor
- Incluye palabras clave relevantes de la industria
- Usa verbos de acción contundentes
- Cuantifica logros cuando sea posible
- Mantén el texto conciso y fácil de leer

Devuelve solo el contenido reescrito, sin explicaciones.`,
  },

  // ── rewrite.cv.section ──
  {
    promptKey: "rewrite.cv.section",
    locale: "en",
    content: `Rewrite the following CV {{section_name}} section to be ATS-friendly, impactful, and aligned with the target role.

Original content:
{{original_content}}

Target role: {{target_role}}
Job objective: {{job_objective}}

Guidelines:
- Use ATS-compatible formatting (no tables, columns, or special characters)
- Lead with strong action verbs
- Quantify results and impact (numbers, percentages, metrics)
- Include relevant hard and soft skills
- Prioritize most relevant experience first

Return only the rewritten content, no explanations.`,
  },
  {
    promptKey: "rewrite.cv.section",
    locale: "es",
    content: `Reescribe la siguiente sección {{section_name}} del CV para que sea compatible con ATS, impactante y alineada con el rol objetivo.

Contenido original:
{{original_content}}

Rol objetivo: {{target_role}}
Objetivo profesional: {{job_objective}}

Directrices:
- Usa formato compatible con ATS (sin tablas, columnas ni caracteres especiales)
- Comienza con verbos de acción contundentes
- Cuantifica resultados e impacto (números, porcentajes, métricas)
- Incluye habilidades técnicas y blandas relevantes
- Prioriza la experiencia más relevante primero

Devuelve solo el contenido reescrito, sin explicaciones.`,
  },

  // ── export.results-summary.header ──
  {
    promptKey: "export.results-summary.header",
    locale: "en",
    content: `Profile Audit Results Summary

This report contains a comprehensive analysis of your professional profile. Each section has been evaluated for impact, clarity, keyword optimization, and alignment with your target role.

Generated by Profile Score — {{export_date}}`,
  },
  {
    promptKey: "export.results-summary.header",
    locale: "es",
    content: `Resumen de Resultados de Auditoría de Perfil

Este informe contiene un análisis completo de tu perfil profesional. Cada sección ha sido evaluada en cuanto a impacto, claridad, optimización de palabras clave y alineación con tu rol objetivo.

Generado por Profile Score — {{export_date}}`,
  },

  // ── export.cover-letter.system ──
  {
    promptKey: "export.cover-letter.system",
    locale: "en",
    content: `Generate a professional cover letter based on the following profile audit results.

Target role: {{target_role}}
Job objective: {{job_objective}}
Key strengths identified: {{key_strengths}}
Overall score: {{overall_score}}/100

The cover letter should:
- Open with a compelling hook relevant to the target role
- Highlight 2-3 key strengths from the audit
- Connect experience to the role requirements
- Close with a confident call to action
- Be 3-4 paragraphs, professional tone
- Be ready to customize with specific company details`,
    modelTarget: "claude-sonnet",
  },
  {
    promptKey: "export.cover-letter.system",
    locale: "es",
    content: `Genera una carta de presentación profesional basada en los siguientes resultados de auditoría de perfil.

Rol objetivo: {{target_role}}
Objetivo profesional: {{job_objective}}
Fortalezas clave identificadas: {{key_strengths}}
Puntuación general: {{overall_score}}/100

La carta de presentación debe:
- Abrir con un gancho atractivo relevante para el rol objetivo
- Resaltar 2-3 fortalezas clave de la auditoría
- Conectar la experiencia con los requisitos del rol
- Cerrar con un llamado a la acción seguro
- Tener 3-4 párrafos, tono profesional
- Estar lista para personalizar con detalles específicos de la empresa`,
    modelTarget: "claude-sonnet",
  },

  // ── export.updated-cv.format ──
  {
    promptKey: "export.updated-cv.format",
    locale: "en",
    content: `Updated CV — Optimized for {{target_role}}

This CV has been rewritten based on your Profile Score audit to maximize ATS compatibility and recruiter impact. Each section has been optimized for keyword density, clarity, and relevance to your target role.

Sections are ordered for maximum impact:
1. Contact Information
2. Professional Summary
3. Work Experience
4. Skills & Competencies
5. Education
6. Certifications & Awards`,
  },
  {
    promptKey: "export.updated-cv.format",
    locale: "es",
    content: `CV Actualizado — Optimizado para {{target_role}}

Este CV ha sido reescrito basándose en tu auditoría de Profile Score para maximizar la compatibilidad con ATS y el impacto con reclutadores. Cada sección ha sido optimizada en densidad de palabras clave, claridad y relevancia para tu rol objetivo.

Las secciones están ordenadas para máximo impacto:
1. Información de Contacto
2. Resumen Profesional
3. Experiencia Laboral
4. Habilidades y Competencias
5. Educación
6. Certificaciones y Premios`,
  },
];

async function main() {
  console.log("Seeding prompt registry...");

  for (const p of prompts) {
    const existing = await prisma.promptRegistry.findFirst({
      where: {
        promptKey: p.promptKey,
        locale: p.locale,
        version: 1,
      },
    });

    if (existing) {
      console.log(`  Skip (exists): ${p.promptKey} [${p.locale}]`);
      continue;
    }

    await prisma.promptRegistry.create({
      data: {
        promptKey: p.promptKey,
        version: 1,
        locale: p.locale,
        modelTarget: p.modelTarget ?? null,
        content: p.content,
        status: "active",
      },
    });
    console.log(`  Created: ${p.promptKey} [${p.locale}]`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
