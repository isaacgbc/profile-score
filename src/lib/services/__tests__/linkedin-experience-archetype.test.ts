/**
 * LINKEDIN_PDF_EXPERIENCE_ARCHETYPE parser tests.
 *
 * Synthetic benchmark fixtures — NO real profile content.
 * Tests cover: ES/EN dates, multi-role, wrapped org names, locations,
 * sub-roles, long descriptions, no-drop invariant, anti-mix guarantees.
 *
 * Run: npx tsx src/lib/services/__tests__/linkedin-experience-archetype.test.ts
 */

import {
  parseExperienceArchetype,
  archetypeToSectionResult,
  parseLinkedinExperienceArchetype,
} from "../linkedin-experience-archetype";
import type { ArchetypeResult, ArchetypeEntry } from "../linkedin-experience-archetype";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
  }
}

// ════════════════════════════════════════════════════════════
// FIXTURE 1: Standard ES format — 3 entries with locations
// ════════════════════════════════════════════════════════════

const FIXTURE_STANDARD_ES = `
Tecnología Avanzada S.A.
Director de Innovación
noviembre de 2023 - Present (2 años 4 meses)
Ciudad de México, México
Lideré la transformación digital de la empresa, implementando
metodologías ágiles y estableciendo alianzas estratégicas con
partners tecnológicos en toda América Latina.

Consultoría Global Partners
Analista Senior
marzo de 2020 - octubre de 2023 (3 años 7 meses)
Bogotá, Colombia
Responsable del análisis de mercados emergentes y elaboración de
reportes estratégicos para clientes corporativos de la región.

Startup Hub Latam
Coordinador de Programas
enero de 2018 - febrero de 2020 (2 años 1 mes)
Buenos Aires, Argentina
Coordinación de programas de aceleración para startups en
etapas tempranas, mentoría y conexión con inversores.
`.trim();

console.log("\n═══ FIXTURE 1: Standard ES format (3 entries, locations) ═══");
const r1 = parseExperienceArchetype(FIXTURE_STANDARD_ES);

assertEqual(r1.entries.length, 3, "Entry count = 3");
assertEqual(r1.diagnostics.dateAnchorCount, 3, "Date anchors = 3");
assert(r1.diagnostics.noDropInvariant, "No-drop invariant holds");
assert(r1.diagnostics.coveragePercent >= 95, `Coverage >= 95% (got ${r1.diagnostics.coveragePercent}%)`);
assertEqual(r1.diagnostics.spanMismatchCount, 0, "No span overlaps");

// Entry 1
assertEqual(r1.entries[0].organization, "Tecnología Avanzada S.A.", "E1 org");
assertEqual(r1.entries[0].title, "Director de Innovación", "E1 title");
assertEqual(r1.entries[0].dateRange, "noviembre de 2023 - Present", "E1 dateRange (duration stripped)");
assertEqual(r1.entries[0].location, "Ciudad de México, México", "E1 location");
assert(r1.entries[0].description.includes("transformación digital"), "E1 description includes content");
assert(!r1.entries[0].description.includes("Analista Senior"), "E1 description does NOT bleed into E2");

// Entry 2
assertEqual(r1.entries[1].organization, "Consultoría Global Partners", "E2 org");
assertEqual(r1.entries[1].title, "Analista Senior", "E2 title");
assertEqual(r1.entries[1].location, "Bogotá, Colombia", "E2 location");

// Entry 3
assertEqual(r1.entries[2].organization, "Startup Hub Latam", "E3 org");
assertEqual(r1.entries[2].title, "Coordinador de Programas", "E3 title");
assertEqual(r1.entries[2].dateRange, "enero de 2018 - febrero de 2020", "E3 dateRange");
assertEqual(r1.entries[2].location, "Buenos Aires, Argentina", "E3 location");

assertEqual(r1.diagnostics.locationLinesDetected, 3, "3 locations detected");

// ════════════════════════════════════════════════════════════
// FIXTURE 2: EN format — mixed Present/dates, no location entries
// ════════════════════════════════════════════════════════════

const FIXTURE_EN_MIXED = `
Acme Corporation
Software Engineer
July 2022 - Present
Built scalable microservices architecture handling 10M+ requests daily.
Reduced deployment time by 40% through CI/CD pipeline optimization.

Beta Labs Inc.
Junior Developer
January 2020 - June 2022
San Francisco, California
Developed frontend features using React and TypeScript.
Implemented automated testing framework achieving 90% code coverage.

Gamma Solutions
Intern
May 2019 - December 2019
Assisted with database migration and API documentation.
`.trim();

console.log("\n═══ FIXTURE 2: EN format (3 entries, mixed locations) ═══");
const r2 = parseExperienceArchetype(FIXTURE_EN_MIXED);

assertEqual(r2.entries.length, 3, "Entry count = 3");
assert(r2.diagnostics.noDropInvariant, "No-drop invariant holds");
assert(r2.diagnostics.coveragePercent >= 95, `Coverage >= 95% (got ${r2.diagnostics.coveragePercent}%)`);

// Entry 1: no location
assertEqual(r2.entries[0].organization, "Acme Corporation", "E1 org");
assertEqual(r2.entries[0].title, "Software Engineer", "E1 title");
assertEqual(r2.entries[0].dateRange, "July 2022 - Present", "E1 dateRange");
assertEqual(r2.entries[0].location, undefined, "E1 no location");
assert(r2.entries[0].description.includes("microservices"), "E1 has description");

// Entry 2: has location
assertEqual(r2.entries[1].location, "San Francisco, California", "E2 location");
assert(!r2.entries[1].description.includes("San Francisco"), "E2 description excludes location");

// Entry 3
assertEqual(r2.entries[2].organization, "Gamma Solutions", "E3 org");
assertEqual(r2.entries[2].title, "Intern", "E3 title");

// ════════════════════════════════════════════════════════════
// FIXTURE 3: Sub-roles within same organization
// ════════════════════════════════════════════════════════════

const FIXTURE_SUBROLES = `
Asociación Nacional de Tecnología
Director
noviembre de 2021 - mayo de 2024 (2 años 7 meses)
Paraguay
Director Ejecutivo (2021-2024)
Director (2024-)
Desarrollo del ecosistema tecnológico nacional a través de
eventos regionales y programas de capacitación. Organización
de conferencias internacionales y demo days.

Digital Innovation Lab
Senior Researcher
marzo de 2019 - octubre de 2021 (2 años 7 meses)
Asunción, Paraguay
Investigación en inteligencia artificial aplicada al sector
financiero y desarrollo de prototipos.
`.trim();

console.log("\n═══ FIXTURE 3: Sub-roles within same org ═══");
const r3 = parseExperienceArchetype(FIXTURE_SUBROLES);

assertEqual(r3.entries.length, 2, "Entry count = 2 (sub-roles NOT separate entries)");
assert(r3.diagnostics.noDropInvariant, "No-drop invariant holds");
assert(r3.diagnostics.subRoleLinesAbsorbed >= 2, `Sub-role lines absorbed >= 2 (got ${r3.diagnostics.subRoleLinesAbsorbed})`);

// Sub-role lines stay in description of entry 1
assert(r3.entries[0].description.includes("Director Ejecutivo (2021-2024)"), "Sub-role in description");
assert(r3.entries[0].description.includes("Director (2024-)"), "Second sub-role in description");
assertEqual(r3.entries[0].location, "Paraguay", "Single-word location detected");

// Entry 2 is separate
assertEqual(r3.entries[1].organization, "Digital Innovation Lab", "E2 org");
assert(!r3.entries[1].description.includes("Director Ejecutivo"), "E2 description is clean");

// ════════════════════════════════════════════════════════════
// FIXTURE 4: Wrapped organization name (long name spans 2+ lines)
// ════════════════════════════════════════════════════════════

const FIXTURE_WRAPPED_ORG = `
Sociedad Internacional de Economía y Derecho Comparado
(SIEDC)
Presidente
junio de 2020 - julio de 2022 (2 años 2 meses)
Asunción, Paraguay
Secretario General - Socio Fundador 2020-2021
Presidente - Miembro Académico Vitalicio 2021-2022

Fundación para el Desarrollo Tecnológico Regional
Asistente de Dirección
marzo de 2019 - abril de 2023 (4 años 2 meses)
Asunción, Paraguay
`.trim();

console.log("\n═══ FIXTURE 4: Wrapped org name (multi-line header) ═══");
const r4 = parseExperienceArchetype(FIXTURE_WRAPPED_ORG);

assertEqual(r4.entries.length, 2, "Entry count = 2");
assert(r4.diagnostics.noDropInvariant, "No-drop invariant holds");

// Entry 1: org wraps to 2 lines, joined with space
assertEqual(
  r4.entries[0].organization,
  "Sociedad Internacional de Economía y Derecho Comparado (SIEDC)",
  "Wrapped org name joined"
);
assertEqual(r4.entries[0].title, "Presidente", "E1 title");
assertEqual(r4.entries[0].location, "Asunción, Paraguay", "E1 location");
assert(r4.entries[0].description.includes("Secretario General"), "E1 has sub-role text");

// Entry 2
assertEqual(
  r4.entries[1].organization,
  "Fundación para el Desarrollo Tecnológico Regional",
  "E2 org"
);
assertEqual(r4.entries[1].title, "Asistente de Dirección", "E2 title");

// ════════════════════════════════════════════════════════════
// FIXTURE 5: Long descriptions — no truncation, no bleed
// ════════════════════════════════════════════════════════════

const FIXTURE_LONG_DESC = `
Alpha Ventures Capital
Managing Partner
noviembre de 2023 - Present (2 años 4 meses)
Miami, Florida, Estados Unidos
Como Managing Partner lidero un programa intensivo de 12 semanas
diseñado para startups en etapas tempranas en América Latina.
Nuestro enfoque se centra en metodologías ágiles para acelerar
el crecimiento y la escalabilidad de las startups. Además,
fomentamos la colaboración entre emprendedores e inversores,
facilitando oportunidades de co-inversión y compartiendo mejores
prácticas en el ecosistema de innovación latinoamericano.
Graduado de Venture Lab Cohort 15.
Colaboramos estrechamente con organismos multilaterales para
apoyar a startups que impulsan el crecimiento económico, la
inclusión y el avance tecnológico en la región. Nuestra misión
se alinea con el compromiso de estrategias de inversión
sostenibles y orientadas a la equidad, así como con los
principios ESG.

Tech Week Foundation
Director
julio de 2024 - Present (1 año 8 meses)
Asunción, Paraguay
Liderando la iniciativa tecnológica que une, conecta y amplifica
la innovación y el emprendimiento en el país.
`.trim();

console.log("\n═══ FIXTURE 5: Long descriptions — no truncation ═══");
const r5 = parseExperienceArchetype(FIXTURE_LONG_DESC);

assertEqual(r5.entries.length, 2, "Entry count = 2");
assert(r5.diagnostics.noDropInvariant, "No-drop invariant holds");

// Entry 1: long description stays intact
assert(r5.entries[0].description.includes("principios ESG"), "E1 full description preserved");
assert(r5.entries[0].description.includes("12 semanas"), "E1 description not truncated");
assertEqual(r5.entries[0].location, "Miami, Florida, Estados Unidos", "E1 multi-part location");

// Anti-mix: entry 1 description does NOT contain entry 2 content
assert(!r5.entries[0].description.includes("Tech Week"), "E1 desc does NOT bleed into E2 header");
assert(!r5.entries[0].description.includes("Liderando la iniciativa"), "E1 desc does NOT bleed into E2 body");

// Entry 2
assertEqual(r5.entries[1].organization, "Tech Week Foundation", "E2 org");
assert(r5.entries[1].description.includes("innovación"), "E2 has its own description");

// ════════════════════════════════════════════════════════════
// FIXTURE 6: Minimal entries — single title line only
// ════════════════════════════════════════════════════════════

const FIXTURE_MINIMAL = `
SmallCo
Intern
May 2019 - December 2019
`.trim();

console.log("\n═══ FIXTURE 6: Minimal entry — no description ═══");
const r6 = parseExperienceArchetype(FIXTURE_MINIMAL);

assertEqual(r6.entries.length, 1, "Entry count = 1");
assert(r6.diagnostics.noDropInvariant, "No-drop invariant holds");
assertEqual(r6.entries[0].organization, "SmallCo", "E1 org");
assertEqual(r6.entries[0].title, "Intern", "E1 title");
assertEqual(r6.entries[0].description, "", "E1 empty description");

// ════════════════════════════════════════════════════════════
// FIXTURE 7: Mixed ES/EN dates — 5 entries
// ════════════════════════════════════════════════════════════

const FIXTURE_MIXED_DATES = `
Compañía Uno
Gerente General
enero de 2023 - Present (3 años 2 meses)
Santiago, Chile
Gestión integral de operaciones.

Company Two
VP of Engineering
September 2021 - December 2022
New York, United States
Led engineering team of 40+ developers.

Empresa Tres
Analista
julio de 2019 - agosto de 2021 (2 años 1 mes)
Lima, Perú
Análisis de datos y reportes.

Company Four
Associate
March 2018 - June 2019
London, United Kingdom
Advisory services for emerging market clients.

Empresa Cinco
Practicante
febrero de 2017 - febrero de 2018 (1 año)
Montevideo, Uruguay
Apoyo en investigación de mercado.
`.trim();

console.log("\n═══ FIXTURE 7: Mixed ES/EN dates (5 entries) ═══");
const r7 = parseExperienceArchetype(FIXTURE_MIXED_DATES);

assertEqual(r7.entries.length, 5, "Entry count = 5");
assert(r7.diagnostics.noDropInvariant, "No-drop invariant holds");
assert(r7.diagnostics.coveragePercent >= 95, `Coverage >= 95% (got ${r7.diagnostics.coveragePercent}%)`);
assertEqual(r7.diagnostics.locationLinesDetected, 5, "5 locations detected");

// Verify no cross-contamination
assert(!r7.entries[0].description.includes("Led engineering"), "E1 no bleed");
assert(!r7.entries[1].description.includes("Análisis de datos"), "E2 no bleed");
assert(!r7.entries[2].description.includes("Advisory"), "E3 no bleed");
assert(!r7.entries[3].description.includes("investigación"), "E4 no bleed");

// ════════════════════════════════════════════════════════════
// FIXTURE 8: Entry with no org — just title + date
// ════════════════════════════════════════════════════════════

const FIXTURE_NO_ORG = `
Freelance Consultant
January 2022 - Present
Remote consulting for various startups.

BigCorp Inc.
Manager
March 2019 - December 2021
Chicago, Illinois
Managed team operations.
`.trim();

console.log("\n═══ FIXTURE 8: Entry with single header line ═══");
const r8 = parseExperienceArchetype(FIXTURE_NO_ORG);

assertEqual(r8.entries.length, 2, "Entry count = 2");
assert(r8.diagnostics.noDropInvariant, "No-drop invariant holds");

// Entry 1: only one header line → becomes title (no org)
assertEqual(r8.entries[0].title, "Freelance Consultant", "E1 title from single header");
assertEqual(r8.entries[0].organization, "", "E1 no org");

// Entry 2: normal two-line header
assertEqual(r8.entries[1].organization, "BigCorp Inc.", "E2 org");
assertEqual(r8.entries[1].title, "Manager", "E2 title");

// ════════════════════════════════════════════════════════════
// FIXTURE 9: Duration suffix formats
// ════════════════════════════════════════════════════════════

const FIXTURE_DURATIONS = `
ParenCo
Analyst
marzo de 2020 - enero de 2025 (4 años 10 meses)
Handled financial modeling.

DotCo
Engineer
July 2018 - June 2020 · 2 yrs
Built systems.
`.trim();

console.log("\n═══ FIXTURE 9: Duration suffix formats ═══");
const r9 = parseExperienceArchetype(FIXTURE_DURATIONS);

assertEqual(r9.entries.length, 2, "Entry count = 2");
assertEqual(r9.entries[0].dateRange, "marzo de 2020 - enero de 2025", "Parens duration stripped");
assertEqual(r9.entries[1].dateRange, "July 2018 - June 2020", "Dot duration stripped");

// ════════════════════════════════════════════════════════════
// FIXTURE 10: Many entries (10) — stress test + coverage gate
// ════════════════════════════════════════════════════════════

const FIXTURE_TEN_ENTRIES = `
Org Alpha
Role Alpha
enero de 2024 - Present (1 año 2 meses)
Ciudad Alpha, País A
Description for alpha entry.

Org Beta
Role Beta
julio de 2023 - diciembre de 2023 (6 meses)
Description for beta entry.

Org Gamma
Role Gamma
enero de 2023 - junio de 2023 (6 meses)
Ciudad Gamma, País C
Description for gamma entry.

Org Delta
Role Delta
julio de 2022 - diciembre de 2022 (6 meses)
Description for delta.

Org Epsilon
Role Epsilon
enero de 2022 - junio de 2022 (6 meses)
Ciudad Epsilon, País E
Description for epsilon.

Org Zeta
Role Zeta
julio de 2021 - diciembre de 2021 (6 meses)
Description for zeta.

Org Eta
Role Eta
enero de 2021 - junio de 2021 (6 meses)
Ciudad Eta, País G
Description for eta.

Org Theta
Role Theta
julio de 2020 - diciembre de 2020 (6 meses)
Description for theta.

Org Iota
Role Iota
enero de 2020 - junio de 2020 (6 meses)
Ciudad Iota, País I
Description for iota.

Org Kappa
Role Kappa
julio de 2019 - diciembre de 2019 (6 meses)
Description for kappa.
`.trim();

console.log("\n═══ FIXTURE 10: Ten entries stress test ═══");
const r10 = parseExperienceArchetype(FIXTURE_TEN_ENTRIES);

assertEqual(r10.entries.length, 10, "Entry count = 10");
assert(r10.diagnostics.noDropInvariant, "No-drop invariant holds");
assert(r10.diagnostics.coveragePercent >= 98, `Coverage >= 98% (got ${r10.diagnostics.coveragePercent}%)`);
assertEqual(r10.diagnostics.wrongAttachmentCount, 0, "wrongAttachment = 0");
assertEqual(r10.diagnostics.spanMismatchCount, 0, "spanMismatch = 0");

// Verify all entries have org + title
for (let i = 0; i < 10; i++) {
  assert(r10.entries[i].organization.length > 0, `E${i + 1} has org`);
  assert(r10.entries[i].title.length > 0, `E${i + 1} has title`);
  assert(r10.entries[i].dateRange.length > 0, `E${i + 1} has dateRange`);
  assert(r10.entries[i].description.length > 0, `E${i + 1} has description`);
}

// Verify span ordering (non-overlapping, ascending)
for (let i = 1; i < r10.entries.length; i++) {
  assert(
    r10.entries[i].sourceLineStart >= r10.entries[i - 1].sourceLineEnd,
    `E${i + 1} starts after E${i} ends`
  );
}

// ════════════════════════════════════════════════════════════
// FIXTURE 11: Section header prefix (should be unmapped)
// ════════════════════════════════════════════════════════════

const FIXTURE_WITH_HEADER = `
Experiencia

FirstCo
Developer
March 2023 - Present
Building features.
`.trim();

console.log("\n═══ FIXTURE 11: Section header prefix ═══");
const r11 = parseExperienceArchetype(FIXTURE_WITH_HEADER);

assertEqual(r11.entries.length, 1, "Entry count = 1");
assert(r11.diagnostics.noDropInvariant, "No-drop invariant holds");
// "Experiencia" should be unmapped
assert(
  r11.unmappedLines.some((l) => l.text.trim() === "Experiencia"),
  "Section header is unmapped"
);

// ════════════════════════════════════════════════════════════
// FIXTURE 12: archetypeToSectionResult adapter
// ════════════════════════════════════════════════════════════

console.log("\n═══ FIXTURE 12: Adapter — archetypeToSectionResult ═══");
const r12Section = archetypeToSectionResult(r1, FIXTURE_STANDARD_ES);

assertEqual(r12Section.entries.length, 3, "Adapted entries = 3");
assertEqual(r12Section.confidence, "high", "High confidence for good parse");
assert(r12Section.coveredLineCount! > 0, "Has covered line count");
assert(r12Section.totalLineCount! > 0, "Has total line count");

// ════════════════════════════════════════════════════════════
// FIXTURE 13: parseLinkedinExperienceArchetype main entry point
// ════════════════════════════════════════════════════════════

console.log("\n═══ FIXTURE 13: Main entry point ═══");
const r13 = parseLinkedinExperienceArchetype(FIXTURE_STANDARD_ES, "test-123");

assertEqual(r13.entries.length, 3, "Entries = 3 via main entry point");
assertEqual(r13.confidence, "high", "High confidence");

// ════════════════════════════════════════════════════════════
// QUALITY GATES — summary
// ════════════════════════════════════════════════════════════

console.log("\n═══ QUALITY GATES ═══");

// Gate 1: Coverage >= 98% on standard fixtures
const allResults = [r1, r2, r3, r4, r5, r7, r9, r10];
const avgCoverage =
  allResults.reduce((s, r) => s + r.diagnostics.coveragePercent, 0) /
  allResults.length;
assert(avgCoverage >= 98, `Average coverage >= 98% (got ${avgCoverage.toFixed(1)}%)`);

// Gate 2: wrongAttachment = 0 across all fixtures
const totalWrongAttach = allResults.reduce(
  (s, r) => s + r.diagnostics.wrongAttachmentCount,
  0
);
assertEqual(totalWrongAttach, 0, "Total wrongAttachment = 0 across all fixtures");

// Gate 3: spanMismatch = 0 across all fixtures
const totalSpanMismatch = allResults.reduce(
  (s, r) => s + r.diagnostics.spanMismatchCount,
  0
);
assertEqual(totalSpanMismatch, 0, "Total spanMismatch = 0 across all fixtures");

// Gate 4: noDrop invariant holds for ALL fixtures
const allNoDrop = allResults.every((r) => r.diagnostics.noDropInvariant);
assert(allNoDrop, "No-drop invariant holds for ALL fixtures");

// ════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════");
console.log(`  TOTAL: ${passed + failed} assertions, ${passed} passed, ${failed} failed`);
console.log("═══════════════════════════════════════════════════════\n");

if (failed > 0) {
  process.exit(1);
}
