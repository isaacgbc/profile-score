/**
 * Phase 2.2 Wave 2: Client-side input preprocessor.
 *
 * Cleans and previews user input BEFORE generation.
 * Replicates cleaning logic from `linkedin-pdf-cleaner.ts` —
 * does NOT import from `src/lib/services/` (client-safe).
 *
 * Pure synchronous functions — no async, no LLM calls, no network.
 */

// ── Result types ────────────────────────────────────────

export interface DetectedSection {
  /** Normalized section name (e.g. "Experience", "Education") */
  name: string;
  /** Line index where the section header was found */
  lineIndex: number;
}

export interface PreprocessStats {
  /** Original character count */
  originalChars: number;
  /** Cleaned character count */
  cleanedChars: number;
  /** Characters removed */
  removedChars: number;
  /** Original line count */
  originalLines: number;
  /** Cleaned line count */
  cleanedLines: number;
  /** Number of page markers removed */
  pageMarkersRemoved: number;
  /** Number of contact lines removed */
  contactLinesRemoved: number;
  /** Number of sidebar skill lines removed */
  sidebarSkillsRemoved: number;
}

export interface PreprocessResult {
  /** Cleaned text ready for generation */
  cleanedText: string;
  /** Detected profile/CV sections */
  detectedSections: DetectedSection[];
  /** Detected language of the input */
  detectedLanguage: "en" | "es" | "other";
  /** Language detection confidence (0-1) */
  languageConfidence: number;
  /** Preprocessing warnings (i18n keys under input.preview.*) */
  warnings: string[];
  /** Cleaning statistics */
  stats: PreprocessStats;
}

// ── Patterns (replicated from linkedin-pdf-cleaner.ts) ──

/** Page markers: "Page 1 of 3", "Página 2 de 5" */
const PAGE_MARKER_RE =
  /^(?:Page|P[aá]gina)\s+\d+\s+(?:of|de)\s+\d+\s*$/i;

/** Contact header lines */
const CONTACT_HEADER_RE =
  /^(?:Contactar|Contact|Contact\s+info|Datos\s+de\s+contacto)\s*$/i;

/** Email pattern */
const EMAIL_RE = /^[\w.+-]+@[\w.-]+\.\w{2,}$/;

/** Phone pattern (7+ digit sequences with optional country code) */
const PHONE_RE = /^[\+]?\(?\d[\d\s\-\(\)\.]{6,}\d$/;

/** URL pattern (standalone URL lines) */
const URL_LINE_RE = /^(?:https?:\/\/|www\.)[\S]+$/i;

/** LinkedIn footer decoration */
const LINKEDIN_FOOTER_RE = /^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\//i;

/** Sidebar skills header: "Aptitudes principales", "Top Skills", etc. */
const SIDEBAR_SKILLS_HEADER_RE =
  /^(?:Aptitudes\s+principales|Top\s+skills?|Principales\s+aptitudes|Competencias\s+principales)\s*$/i;

/** Sidebar certifications / honors header */
const SIDEBAR_CERTS_HEADER_RE =
  /^(?:Certific(?:ations?|aciones?)|Licenses?\s*&?\s*certific|Honors?\s*(?:&|-)\s*Awards?|Honores?\s*(?:y|&)\s*Premios?)\s*$/i;

/** Known section headers (EN + ES) */
const SECTION_HEADER_RE =
  /^(?:About|Summary|Experience|Education|Skills|Recommendations?|Featured|Activity|Acerca\s+de|Extracto|Experiencia|Educación|Formación|Aptitudes|Habilidades|Recomendaciones?|Destacados?|Honors?\s*(?:&|-)\s*Awards?|Licenses?\s*&?\s*Certific|Projects?|Volunteering|Languages?|Interests?|Publications?|Proyectos?|Voluntariado|Idiomas?|Intereses?|Publicaciones?)(?:\s|$)/i;

/** Canonical section names for badge display */
const SECTION_NAME_MAP: Record<string, string> = {
  about: "About",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  recommendations: "Recommendations",
  recommendation: "Recommendations",
  featured: "Featured",
  activity: "Activity",
  "acerca de": "About",
  extracto: "Summary",
  experiencia: "Experience",
  "educación": "Education",
  "formación": "Education",
  aptitudes: "Skills",
  habilidades: "Skills",
  recomendaciones: "Recommendations",
  "recomendación": "Recommendations",
  destacados: "Featured",
  destacado: "Featured",
  projects: "Projects",
  proyecto: "Projects",
  proyectos: "Projects",
  volunteering: "Volunteering",
  voluntariado: "Volunteering",
  languages: "Languages",
  language: "Languages",
  idiomas: "Languages",
  idioma: "Languages",
  interests: "Interests",
  intereses: "Interests",
  publications: "Publications",
  publicaciones: "Publications",
  "honors & awards": "Honors & Awards",
  "honors - awards": "Honors & Awards",
  "honores y premios": "Honors & Awards",
  "licenses & certifications": "Licenses & Certifications",
  certifications: "Certifications",
  certificaciones: "Certifications",
};

// ── Language detection ───────────────────────────────────

const EN_STOPWORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her",
  "she", "or", "an", "will", "my", "one", "all", "would", "there",
  "their", "what", "so", "up", "out", "if", "about", "who", "get",
  "which", "go", "me", "when", "can", "like", "no", "just", "him",
  "know", "take", "people", "into", "year", "your", "some", "them",
  "than", "then", "now", "look", "only", "come", "its", "over",
  "also", "after", "use", "how", "our", "work", "first", "well",
  "way", "even", "new", "want", "because", "any", "these", "give",
  "most", "us", "are", "is", "was", "were", "been", "has", "had",
  "did", "does", "am",
]);

const ES_STOPWORDS = new Set([
  "de", "la", "que", "el", "en", "y", "a", "los", "del", "se",
  "las", "por", "un", "para", "con", "no", "una", "su", "al",
  "lo", "como", "más", "pero", "sus", "le", "ya", "o", "este",
  "sí", "porque", "esta", "entre", "cuando", "muy", "sin", "sobre",
  "también", "me", "hasta", "hay", "donde", "quien", "desde", "todo",
  "nos", "durante", "todos", "uno", "les", "ni", "contra", "otros",
  "ese", "eso", "ante", "ellos", "e", "esto", "mí", "antes",
  "algunos", "qué", "unos", "yo", "otro", "otras", "otra", "él",
  "tanto", "esa", "estos", "mucho", "quién", "nada", "muchos",
  "cual", "poco", "ella", "estar", "estas", "algunas", "algo",
  "nosotros", "mi", "mis", "tú", "te", "ti", "tu", "tus",
  "es", "son", "fue", "ser", "ha", "era", "han", "sido",
]);

/**
 * Detect language of input text using stopword frequency.
 * Analyzes first 500 words for performance.
 */
export function detectLanguage(text: string): {
  language: "en" | "es" | "other";
  confidence: number;
} {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 50) {
    return { language: "en", confidence: 0 };
  }

  // Take first 500 words
  const words = trimmed
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 500);

  if (words.length < 10) {
    return { language: "en", confidence: 0 };
  }

  let enHits = 0;
  let esHits = 0;

  for (const word of words) {
    // Strip common punctuation for matching
    const clean = word.replace(/[.,;:!?'"()[\]{}]/g, "");
    if (EN_STOPWORDS.has(clean)) enHits++;
    if (ES_STOPWORDS.has(clean)) esHits++;
  }

  const total = words.length;
  const enRatio = enHits / total;
  const esRatio = esHits / total;

  // Need at least 5% stopword hit rate to be confident
  if (enRatio < 0.05 && esRatio < 0.05) {
    return { language: "other", confidence: 0.2 };
  }

  if (esRatio > enRatio * 1.3) {
    // ES clearly dominant
    const confidence = Math.min(1, esRatio * 3);
    return { language: "es", confidence: +confidence.toFixed(2) };
  }

  if (enRatio > esRatio * 1.3) {
    // EN clearly dominant
    const confidence = Math.min(1, enRatio * 3);
    return { language: "en", confidence: +confidence.toFixed(2) };
  }

  // Close race — default to the higher one with lower confidence
  if (esRatio >= enRatio) {
    return { language: "es", confidence: +(Math.min(1, esRatio * 2)).toFixed(2) };
  }
  return { language: "en", confidence: +(Math.min(1, enRatio * 2)).toFixed(2) };
}

// ── Section detection ───────────────────────────────────

function detectSections(lines: string[]): DetectedSection[] {
  const sections: DetectedSection[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // Check if the line is a section header
    if (SECTION_HEADER_RE.test(trimmed) && trimmed.length < 60) {
      const lower = trimmed.toLowerCase().replace(/\s+/g, " ");
      // Try to find a canonical name
      const canonKey = Object.keys(SECTION_NAME_MAP).find((k) =>
        lower.startsWith(k)
      );
      const name = canonKey ? SECTION_NAME_MAP[canonKey] : trimmed;

      if (!seen.has(name)) {
        seen.add(name);
        sections.push({ name, lineIndex: i });
      }
    }
  }

  return sections;
}

// ── LinkedIn text preprocessor ──────────────────────────

/**
 * Preprocess LinkedIn profile text (from PDF export or paste).
 * Replicates cleaning logic from linkedin-pdf-cleaner.ts.
 */
export function preprocessLinkedinText(
  rawText: string,
  source: "paste" | "pdf"
): PreprocessResult {
  const originalChars = rawText.length;
  const originalLines = rawText.split("\n").length;
  const warnings: string[] = [];

  // For paste source with very short text, skip cleaning
  if (rawText.trim().length < 50) {
    return {
      cleanedText: rawText,
      detectedSections: [],
      detectedLanguage: "en",
      languageConfidence: 0,
      warnings: [],
      stats: {
        originalChars,
        cleanedChars: rawText.length,
        removedChars: 0,
        originalLines,
        cleanedLines: originalLines,
        pageMarkersRemoved: 0,
        contactLinesRemoved: 0,
        sidebarSkillsRemoved: 0,
      },
    };
  }

  const lines = rawText.split("\n");
  const cleaned: string[] = [];
  let pageMarkersRemoved = 0;
  let contactLinesRemoved = 0;
  let sidebarSkillsRemoved = 0;

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Remove page markers
    if (PAGE_MARKER_RE.test(trimmed)) {
      pageMarkersRemoved++;
      i++;
      continue;
    }

    // 2. Remove LinkedIn footer decoration lines
    if (LINKEDIN_FOOTER_RE.test(trimmed) && trimmed.length < 80) {
      i++;
      continue;
    }

    // 3. Extract contact block (header + consecutive contact lines)
    if (CONTACT_HEADER_RE.test(trimmed)) {
      contactLinesRemoved++;
      i++;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (next === "") { i++; break; }
        if (SECTION_HEADER_RE.test(next)) break;
        if (
          EMAIL_RE.test(next) ||
          PHONE_RE.test(next) ||
          URL_LINE_RE.test(next) ||
          next.length < 60
        ) {
          contactLinesRemoved++;
          i++;
        } else {
          break;
        }
      }
      continue;
    }

    // 4. Standalone contact-like lines near the top
    if (
      cleaned.length < 10 &&
      (EMAIL_RE.test(trimmed) || PHONE_RE.test(trimmed)) &&
      trimmed.length < 80
    ) {
      contactLinesRemoved++;
      i++;
      continue;
    }

    // 5. Extract sidebar skills block
    if (SIDEBAR_SKILLS_HEADER_RE.test(trimmed)) {
      i++;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (next === "") { i++; break; }
        if (SECTION_HEADER_RE.test(next)) break;
        if (next.length < 80) sidebarSkillsRemoved++;
        i++;
      }
      continue;
    }

    // 6. Extract sidebar certifications block
    if (SIDEBAR_CERTS_HEADER_RE.test(trimmed)) {
      const lookaheadLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && j - i < 10) {
        const la = lines[j].trim();
        if (la === "" || SECTION_HEADER_RE.test(la)) break;
        lookaheadLines.push(la);
        j++;
      }
      const avgLen =
        lookaheadLines.length > 0
          ? lookaheadLines.reduce((s, l) => s + l.length, 0) / lookaheadLines.length
          : 0;

      if (avgLen < 60 && lookaheadLines.length > 0) {
        i++;
        while (i < lines.length) {
          const next = lines[i].trim();
          if (next === "") { i++; break; }
          if (SECTION_HEADER_RE.test(next)) break;
          i++;
        }
        continue;
      }
    }

    // 7. Keep this line
    cleaned.push(line);
    i++;
  }

  // 8. Collapse 3+ consecutive blank lines → 2
  const collapsed: string[] = [];
  let blankCount = 0;
  for (const line of cleaned) {
    if (line.trim() === "") {
      blankCount++;
      if (blankCount <= 2) collapsed.push(line);
    } else {
      blankCount = 0;
      collapsed.push(line);
    }
  }

  const cleanedText = collapsed.join("\n");
  const detectedSections = detectSections(collapsed);
  const langResult = detectLanguage(cleanedText);

  // Warnings
  if (pageMarkersRemoved > 0 && source === "paste") {
    warnings.push("pasteContainsPdfArtifacts");
  }
  if (detectedSections.length === 0 && cleanedText.trim().length >= 50) {
    warnings.push("noSectionsDetected");
  }

  return {
    cleanedText,
    detectedSections,
    detectedLanguage: langResult.language,
    languageConfidence: langResult.confidence,
    warnings,
    stats: {
      originalChars,
      cleanedChars: cleanedText.length,
      removedChars: originalChars - cleanedText.length,
      originalLines,
      cleanedLines: collapsed.length,
      pageMarkersRemoved,
      contactLinesRemoved,
      sidebarSkillsRemoved,
    },
  };
}

// ── CV text preprocessor ────────────────────────────────

/** CV section headers (broader set than LinkedIn) */
const CV_SECTION_RE =
  /^(?:Experience|Education|Skills|Summary|Objective|Profile|Work\s+History|Professional\s+Experience|Technical\s+Skills|Core\s+Competencies|Certifications?|Projects?|Awards?|Publications?|References?|Languages?|Interests?|Hobbies?|Experiencia|Educación|Formación|Habilidades|Resumen|Objetivo|Perfil|Competencias|Certificaciones?|Proyectos?|Premios?|Publicaciones?|Referencias?|Idiomas?|Intereses?)(?:\s|:|$)/i;

const CV_SECTION_NAME_MAP: Record<string, string> = {
  experience: "Experience",
  "work history": "Work History",
  "professional experience": "Experience",
  education: "Education",
  skills: "Skills",
  "technical skills": "Skills",
  "core competencies": "Skills",
  summary: "Summary",
  objective: "Objective",
  profile: "Profile",
  certifications: "Certifications",
  certification: "Certifications",
  projects: "Projects",
  project: "Projects",
  awards: "Awards",
  award: "Awards",
  publications: "Publications",
  references: "References",
  languages: "Languages",
  language: "Languages",
  interests: "Interests",
  hobbies: "Interests",
  experiencia: "Experience",
  "educación": "Education",
  "formación": "Education",
  habilidades: "Skills",
  resumen: "Summary",
  objetivo: "Objective",
  perfil: "Profile",
  competencias: "Skills",
  certificaciones: "Certifications",
  proyectos: "Projects",
  premios: "Awards",
  publicaciones: "Publications",
  referencias: "References",
  idiomas: "Languages",
  intereses: "Interests",
};

function detectCvSections(lines: string[]): DetectedSection[] {
  const sections: DetectedSection[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.length > 60) continue;

    if (CV_SECTION_RE.test(trimmed)) {
      const lower = trimmed.toLowerCase().replace(/[:\s]+$/, "").replace(/\s+/g, " ");
      const canonKey = Object.keys(CV_SECTION_NAME_MAP).find((k) =>
        lower.startsWith(k)
      );
      const name = canonKey ? CV_SECTION_NAME_MAP[canonKey] : trimmed;

      if (!seen.has(name)) {
        seen.add(name);
        sections.push({ name, lineIndex: i });
      }
    }
  }

  return sections;
}

/**
 * Preprocess CV text (from PDF upload or paste).
 * Lighter cleaning than LinkedIn — mainly blank line collapse + section detection.
 */
export function preprocessCvText(
  rawText: string,
  source: "paste" | "pdf"
): PreprocessResult {
  const originalChars = rawText.length;
  const originalLines = rawText.split("\n").length;
  const warnings: string[] = [];

  if (rawText.trim().length < 50) {
    return {
      cleanedText: rawText,
      detectedSections: [],
      detectedLanguage: "en",
      languageConfidence: 0,
      warnings: [],
      stats: {
        originalChars,
        cleanedChars: rawText.length,
        removedChars: 0,
        originalLines,
        cleanedLines: originalLines,
        pageMarkersRemoved: 0,
        contactLinesRemoved: 0,
        sidebarSkillsRemoved: 0,
      },
    };
  }

  const lines = rawText.split("\n");
  const cleaned: string[] = [];
  let pageMarkersRemoved = 0;

  // CV cleaning: only page markers and blank line collapse
  for (const line of lines) {
    const trimmed = line.trim();

    // Remove page markers
    if (PAGE_MARKER_RE.test(trimmed)) {
      pageMarkersRemoved++;
      continue;
    }

    cleaned.push(line);
  }

  // Collapse 3+ consecutive blank lines → 2
  const collapsed: string[] = [];
  let blankCount = 0;
  for (const line of cleaned) {
    if (line.trim() === "") {
      blankCount++;
      if (blankCount <= 2) collapsed.push(line);
    } else {
      blankCount = 0;
      collapsed.push(line);
    }
  }

  const cleanedText = collapsed.join("\n");
  const detectedSections = detectCvSections(collapsed);
  const langResult = detectLanguage(cleanedText);

  if (detectedSections.length === 0 && cleanedText.trim().length >= 50) {
    warnings.push("noSectionsDetected");
  }

  return {
    cleanedText,
    detectedSections,
    detectedLanguage: langResult.language,
    languageConfidence: langResult.confidence,
    warnings,
    stats: {
      originalChars,
      cleanedChars: cleanedText.length,
      removedChars: originalChars - cleanedText.length,
      originalLines,
      cleanedLines: collapsed.length,
      pageMarkersRemoved,
      contactLinesRemoved: 0,
      sidebarSkillsRemoved: 0,
    },
  };
}
