/**
 * LinkedIn Profile Formatter (Phase 01, Plan 05)
 *
 * Converts a HarvestProfile (Apify actor output) into two representations:
 *
 * 1. `profileToSectionRecord()` — Record<string, string> matching the section keys
 *    that the orchestrator Stage 2 consumes (LINKEDIN_SECTION_IDS from linkedin-parser.ts
 *    plus additional sections: projects, publications, honors, volunteer).
 *    This enables Strategy A: bypass regex parsing AND LLM structuring entirely.
 *
 * 2. `profileToMarkdown()` — compact Markdown for the NEW audit.linkedin.system.apify
 *    prompt (D-16, D-17, D-18). Leverages experience bullets, skill endorsements,
 *    recommendation excerpts, and certification details.
 *
 * PURE TypeScript — no DB imports, no server-only imports. Importable from anywhere.
 */
import type { HarvestProfile } from "@/lib/schemas/linkedin-profile";

// ─── Constants ───────────────────────────────────────────────────────────────

/** D-18: Cap recommendation excerpts to reduce PII exposure */
const MAX_RECOMMENDATIONS = 3;

// ─── Private helpers ─────────────────────────────────────────────────────────

/**
 * Extract a string value from a passthrough object, checking multiple field names.
 * Handles actor drift (e.g., position vs title, company vs companyName).
 */
function pick(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

/**
 * Format experience entries into a flat text block.
 * Each entry: "{title} — {company} ({dateRange})\n{description}"
 * Entries joined by "\n\n" so downstream parser can split.
 */
function formatExperience(entries: Record<string, unknown>[]): string {
  return entries
    .map((e) => {
      const title = pick(e, "position", "title");
      const company = pick(e, "company", "companyName");
      const dateRange = pick(e, "dateRange", "duration");
      const description = pick(e, "description");

      let line = "";
      if (title && company) {
        line = `${title} — ${company}`;
      } else if (title) {
        line = title;
      } else if (company) {
        line = company;
      }
      if (dateRange) line += ` (${dateRange})`;
      if (description) line += `\n${description}`;
      return line;
    })
    .filter((l) => l.trim().length > 0)
    .join("\n\n");
}

/**
 * Format education entries.
 * Each entry: "{school} — {degree}, {fieldOfStudy} ({dateRange})"
 */
function formatEducation(entries: Record<string, unknown>[]): string {
  return entries
    .map((e) => {
      const school = pick(e, "schoolName", "school");
      const degree = pick(e, "degree");
      const fieldOfStudy = pick(e, "fieldOfStudy");
      const dateRange = pick(e, "period", "dateRange");

      let line = school;
      if (degree) line += ` — ${degree}`;
      if (fieldOfStudy)
        line += degree ? `, ${fieldOfStudy}` : ` — ${fieldOfStudy}`;
      if (dateRange && dateRange !== "-" && dateRange !== " - ")
        line += ` (${dateRange})`;
      return line;
    })
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

/**
 * Format skills from both `skills` (object array with name/endorsementCount) and
 * `topSkills` (may be string array or object array). Includes endorsement counts
 * when available per D-18.
 */
function formatSkills(p: HarvestProfile): string {
  const items: string[] = [];

  // topSkills: may be string[] or object[] at runtime (schema uses passthrough)
  if (p.topSkills && Array.isArray(p.topSkills)) {
    for (const rawSkill of p.topSkills) {
      const s: unknown = rawSkill;
      if (typeof s === "string" && s.trim()) {
        items.push(s.trim());
      } else if (s && typeof s === "object") {
        const obj = s as Record<string, unknown>;
        const name = pick(obj, "name");
        if (name) items.push(name);
      }
    }
  }

  // skills: object array with name + optional endorsementCount
  if (p.skills && Array.isArray(p.skills)) {
    for (const s of p.skills) {
      if (s && typeof s === "object") {
        const obj = s as Record<string, unknown>;
        const name = pick(obj, "name");
        if (!name) continue;
        // Avoid duplicates from topSkills
        if (items.includes(name)) continue;
        const endorsements = obj.endorsementCount;
        if (typeof endorsements === "number" && endorsements > 0) {
          items.push(`${name} (${endorsements})`);
        } else {
          items.push(name);
        }
      }
    }
  }

  return items.join(", ");
}

/**
 * Format certifications.
 * Each: "{name} — {issuer} ({date})"
 */
function formatCerts(entries: Record<string, unknown>[]): string {
  return entries
    .map((e) => {
      const name = pick(e, "name", "certName");
      const issuer = pick(e, "issuer", "authority", "issuingOrganization");
      const date = pick(e, "date", "issueDate", "dateRange");

      let line = name;
      if (issuer) line += ` — ${issuer}`;
      if (date) line += ` (${date})`;
      return line;
    })
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

/**
 * Format recommendations. Capped at first MAX_RECOMMENDATIONS per D-18.
 * Each: "{author}: "{text}""
 */
function formatRecs(entries: Record<string, unknown>[]): string {
  return entries
    .slice(0, MAX_RECOMMENDATIONS)
    .map((e) => {
      const author =
        pick(e, "author", "recommenderName", "name") || "Anonymous";
      const text = pick(e, "text", "recommendationText", "description");
      if (!text) return "";
      return `${author}: "${text}"`;
    })
    .filter((l) => l.length > 0)
    .join("\n\n");
}

/**
 * Format projects.
 * Each: "{title}: {description}"
 */
function formatProjects(entries: Record<string, unknown>[]): string {
  return entries
    .map((e) => {
      const title = pick(e, "title", "name");
      const description = pick(e, "description");
      let line = title;
      if (description) line += line ? `: ${description}` : description;
      return line;
    })
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

/**
 * Format publications.
 * Each: "{title} — {publisher} ({date})"
 */
function formatPubs(entries: Record<string, unknown>[]): string {
  return entries
    .map((e) => {
      const title = pick(e, "title", "name");
      const publisher = pick(e, "publisher");
      const date = pick(e, "date", "dateRange");

      let line = title;
      if (publisher) line += ` — ${publisher}`;
      if (date) line += ` (${date})`;
      return line;
    })
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

/**
 * Format honors and awards.
 * Each: "{title} — {issuer} ({date})"
 */
function formatHonors(entries: Record<string, unknown>[]): string {
  return entries
    .map((e) => {
      const title = pick(e, "title", "name");
      const issuer = pick(e, "issuer", "issuedBy");
      const date = pick(e, "date", "dateRange");

      let line = title;
      if (issuer) line += ` — ${issuer}`;
      if (date) line += ` (${date})`;
      return line;
    })
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

/**
 * Format volunteering entries.
 * Each: "{role} — {organization} ({dateRange})\n{description}"
 */
function formatVolunteer(entries: Record<string, unknown>[]): string {
  return entries
    .map((e) => {
      const role = pick(e, "role", "title", "position");
      const org = pick(e, "organization", "companyName", "company");
      const dateRange = pick(e, "dateRange", "duration");
      const description = pick(e, "description", "cause");

      let line = "";
      if (role && org) {
        line = `${role} — ${org}`;
      } else if (role) {
        line = role;
      } else if (org) {
        line = org;
      }
      if (dateRange) line += ` (${dateRange})`;
      if (description) line += `\n${description}`;
      return line;
    })
    .filter((l) => l.trim().length > 0)
    .join("\n\n");
}

/**
 * Format featured items.
 */
function formatFeatured(entries: Record<string, unknown>[]): string {
  return entries
    .map((e) => {
      const title = pick(e, "title", "name");
      const description = pick(e, "description");
      const url = pick(e, "url", "link");

      let line = title;
      if (description) line += `: ${description}`;
      if (url) line += ` (${url})`;
      return line;
    })
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

// ─── Resolve field drift for recommendations and honors ──────────────────────

/** Get recommendations array, checking both field names (actor drift) */
function getRecommendations(p: HarvestProfile): Record<string, unknown>[] {
  const recs =
    (p.recommendations as Record<string, unknown>[] | null | undefined) ??
    ((p as Record<string, unknown>).receivedRecommendations as
      | Record<string, unknown>[]
      | null
      | undefined) ??
    [];
  return Array.isArray(recs) && recs.length > 0 ? recs : [];
}

/** Get honors array, checking both field names (actor drift) */
function getHonors(p: HarvestProfile): Record<string, unknown>[] {
  const honors =
    (p.honors as Record<string, unknown>[] | null | undefined) ??
    ((p as Record<string, unknown>).honorsAndAwards as
      | Record<string, unknown>[]
      | null
      | undefined) ??
    [];
  return Array.isArray(honors) && honors.length > 0 ? honors : [];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert a HarvestProfile into a Record<string, string> with keys matching
 * the orchestrator's section ID contract (LINKEDIN_SECTION_IDS from
 * linkedin-parser.ts + extended sections).
 *
 * Keys: headline, summary (mapped from `about`), experience, education, skills,
 * certifications, recommendations, projects, publications, honors, volunteer, featured.
 *
 * Missing/empty sections are OMITTED (not set to empty strings) so the
 * orchestrator's degradation logic works correctly.
 */
export function profileToSectionRecord(
  p: HarvestProfile,
): Record<string, string> {
  const out: Record<string, string> = {};

  // Direct string fields
  if (p.headline && typeof p.headline === "string" && p.headline.trim()) {
    out.headline = p.headline.trim();
  }

  // about -> summary key mapping (orchestrator uses "summary", Apify uses "about")
  if (p.about && typeof p.about === "string" && p.about.trim()) {
    out.summary = p.about.trim();
  }

  // Array sections — only add if helper returns non-empty string
  const experience = p.experience as
    | Record<string, unknown>[]
    | null
    | undefined;
  if (experience && Array.isArray(experience) && experience.length > 0) {
    const formatted = formatExperience(experience);
    if (formatted.trim()) out.experience = formatted;
  }

  const education = p.education as Record<string, unknown>[] | null | undefined;
  if (education && Array.isArray(education) && education.length > 0) {
    const formatted = formatEducation(education);
    if (formatted.trim()) out.education = formatted;
  }

  const skillsText = formatSkills(p);
  if (skillsText.trim()) out.skills = skillsText;

  const certifications = p.certifications as
    | Record<string, unknown>[]
    | null
    | undefined;
  if (
    certifications &&
    Array.isArray(certifications) &&
    certifications.length > 0
  ) {
    const formatted = formatCerts(certifications);
    if (formatted.trim()) out.certifications = formatted;
  }

  const recs = getRecommendations(p);
  if (recs.length > 0) {
    const formatted = formatRecs(recs);
    if (formatted.trim()) out.recommendations = formatted;
  }

  const projects = p.projects as Record<string, unknown>[] | null | undefined;
  if (projects && Array.isArray(projects) && projects.length > 0) {
    const formatted = formatProjects(projects);
    if (formatted.trim()) out.projects = formatted;
  }

  const publications = p.publications as
    | Record<string, unknown>[]
    | null
    | undefined;
  if (publications && Array.isArray(publications) && publications.length > 0) {
    const formatted = formatPubs(publications);
    if (formatted.trim()) out.publications = formatted;
  }

  const honors = getHonors(p);
  if (honors.length > 0) {
    const formatted = formatHonors(honors);
    if (formatted.trim()) out.honors = formatted;
  }

  const volunteering = p.volunteering as
    | Record<string, unknown>[]
    | null
    | undefined;
  if (volunteering && Array.isArray(volunteering) && volunteering.length > 0) {
    const formatted = formatVolunteer(volunteering);
    if (formatted.trim()) out.volunteer = formatted;
  }

  const featured = p.featured as Record<string, unknown>[] | null | undefined;
  if (featured && Array.isArray(featured) && featured.length > 0) {
    const formatted = formatFeatured(featured);
    if (formatted.trim()) out.featured = formatted;
  }

  return out;
}

/**
 * Convert a HarvestProfile into a compact Markdown representation for
 * Claude prompt injection (D-17). Leverages the full richness of structured
 * data: experience timelines with bullets, skill endorsements, recommendation
 * excerpts (first 3), certification details, etc.
 *
 * Sections with no data are omitted entirely. Returns "" for empty profiles.
 */
export function profileToMarkdown(p: HarvestProfile): string {
  const parts: string[] = [];

  // Headline as H1
  if (p.headline && typeof p.headline === "string" && p.headline.trim()) {
    parts.push(`# ${p.headline.trim()}\n`);
  }

  // About / Summary
  if (p.about && typeof p.about === "string" && p.about.trim()) {
    parts.push(`## About\n\n${p.about.trim()}\n`);
  }

  // Experience
  const experience = p.experience as
    | Record<string, unknown>[]
    | null
    | undefined;
  if (experience && Array.isArray(experience) && experience.length > 0) {
    parts.push(`## Experience\n`);
    for (const e of experience) {
      const title = pick(e, "position", "title");
      const company = pick(e, "company", "companyName");
      const dateRange = pick(e, "dateRange", "duration");
      const description = pick(e, "description");

      let header = "";
      if (title && company) {
        header = `### ${title} — ${company}`;
      } else if (title) {
        header = `### ${title}`;
      } else if (company) {
        header = `### ${company}`;
      }
      if (dateRange) header += ` (${dateRange})`;
      if (header) parts.push(header);
      if (description) parts.push(description);
      parts.push("");
    }
  }

  // Education
  const education = p.education as Record<string, unknown>[] | null | undefined;
  if (education && Array.isArray(education) && education.length > 0) {
    const formatted = formatEducation(education);
    if (formatted.trim()) {
      parts.push(`## Education\n\n${formatted}\n`);
    }
  }

  // Skills (with endorsement counts per D-18)
  const skillsText = formatSkills(p);
  if (skillsText.trim()) {
    parts.push(`## Skills\n\n${skillsText}\n`);
  }

  // Certifications
  const certifications = p.certifications as
    | Record<string, unknown>[]
    | null
    | undefined;
  if (
    certifications &&
    Array.isArray(certifications) &&
    certifications.length > 0
  ) {
    const formatted = formatCerts(certifications);
    if (formatted.trim()) {
      parts.push(`## Certifications\n\n${formatted}\n`);
    }
  }

  // Recommendations (first 3 per D-18)
  const recs = getRecommendations(p);
  if (recs.length > 0) {
    const formatted = formatRecs(recs);
    if (formatted.trim()) {
      parts.push(`## Recommendations\n\n${formatted}\n`);
    }
  }

  // Projects
  const projects = p.projects as Record<string, unknown>[] | null | undefined;
  if (projects && Array.isArray(projects) && projects.length > 0) {
    const formatted = formatProjects(projects);
    if (formatted.trim()) {
      parts.push(`## Projects\n\n${formatted}\n`);
    }
  }

  // Publications
  const publications = p.publications as
    | Record<string, unknown>[]
    | null
    | undefined;
  if (publications && Array.isArray(publications) && publications.length > 0) {
    const formatted = formatPubs(publications);
    if (formatted.trim()) {
      parts.push(`## Publications\n\n${formatted}\n`);
    }
  }

  // Honors & Awards
  const honors = getHonors(p);
  if (honors.length > 0) {
    const formatted = formatHonors(honors);
    if (formatted.trim()) {
      parts.push(`## Honors & Awards\n\n${formatted}\n`);
    }
  }

  // Volunteering
  const volunteering = p.volunteering as
    | Record<string, unknown>[]
    | null
    | undefined;
  if (volunteering && Array.isArray(volunteering) && volunteering.length > 0) {
    const formatted = formatVolunteer(volunteering);
    if (formatted.trim()) {
      parts.push(`## Volunteering\n\n${formatted}\n`);
    }
  }

  // Featured
  const featured = p.featured as Record<string, unknown>[] | null | undefined;
  if (featured && Array.isArray(featured) && featured.length > 0) {
    const formatted = formatFeatured(featured);
    if (formatted.trim()) {
      parts.push(`## Featured\n\n${formatted}\n`);
    }
  }

  return parts.join("\n");
}
