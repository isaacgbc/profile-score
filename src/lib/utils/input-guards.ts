/**
 * Phase 2.2 Wave 1: Client-side input guards.
 *
 * Pure validation functions that run BEFORE submission.
 * Zero side-effects — safe for use in React components.
 *
 * Guard types:
 *  - Blocking (valid: false)  → prevents Continue
 *  - Soft warning (valid: true, warningKey set) → shows yellow hint, user can proceed
 */

// ── Types ──────────────────────────────────────────────

export interface GuardResult {
  valid: boolean;
  /** i18n key under `input.guards.*` */
  warningKey?: string;
}

export interface QualityResult {
  /** 0-100 */
  score: number;
  level: "low" | "medium" | "high";
}

// ── Constants ──────────────────────────────────────────

/** Warning key for DOCX uploads (no text extraction yet) */
export const DOCX_NO_EXTRACTION_WARNING = "docxNoExtraction" as const;

/** Warning key for job-description PDF uploads (no text extraction yet) */
export const JOB_PDF_NO_EXTRACTION_WARNING = "jobPdfNoExtraction" as const;

const URL_PATTERN = /^https?:\/\/\S+$/i;
const LINKEDIN_URL_PATTERN = /linkedin\.com\/in\//i;
const MIN_CHARS = 50;
const MIN_WORDS = 15;
const JACCARD_DUPLICATE_THRESHOLD = 0.85;

// ── Guard 1: URL-as-text detection (BLOCKING) ─────────

/**
 * Detects when the user pastes a URL instead of profile text.
 * A URL alone cannot be analyzed — we need the actual text content.
 */
export function detectUrlAsText(text: string): GuardResult {
  const trimmed = text.trim();
  if (!trimmed) return { valid: true };

  // Check if the entire input is just a URL (allow up to 2 non-empty lines)
  const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length <= 2) {
    const joined = lines.join(" ").trim();
    if (URL_PATTERN.test(joined) || LINKEDIN_URL_PATTERN.test(joined)) {
      return { valid: false, warningKey: "urlAsText" };
    }
  }

  return { valid: true };
}

// ── Guard 2: Minimum content (BLOCKING) ────────────────

/**
 * Ensures input has at least 50 characters AND 15 words.
 * Returns valid: true for empty text (empty is handled by the canContinue gate).
 */
export function checkMinimumContent(text: string): GuardResult {
  const trimmed = text.trim();
  if (!trimmed) return { valid: true }; // empty handled by canContinue

  if (trimmed.length < MIN_CHARS) {
    return { valid: false, warningKey: "tooShort" };
  }

  const wordCount = trimmed.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount < MIN_WORDS) {
    return { valid: false, warningKey: "tooFewWords" };
  }

  return { valid: true };
}

// ── Guard 3: LinkedIn format sniffing (SOFT WARNING) ───

/**
 * Warns if text in the LinkedIn field doesn't look like a LinkedIn profile.
 * Soft warning — user can proceed regardless.
 */
const LINKEDIN_MARKERS = [
  /\bexperience\b/i,
  /\beducation\b/i,
  /\bskills\b/i,
  /\bsummary\b/i,
  /\babout\b/i,
  /\bexperiencia\b/i,
  /\beducación\b/i,
  /\bhabilidades\b/i,
  /\bacerca\s+de\b/i,
  /\brecommendations?\b/i,
  /\brecomendaciones?\b/i,
];

export function sniffLinkedinFormat(text: string): GuardResult {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < MIN_CHARS) return { valid: true };

  // Count how many LinkedIn section markers are present
  const matchCount = LINKEDIN_MARKERS.filter((rx) => rx.test(trimmed)).length;

  // Fewer than 2 markers → probably not a LinkedIn export
  if (matchCount < 2) {
    return { valid: true, warningKey: "notLinkedinFormat" };
  }

  return { valid: true };
}

// ── Guard 4: Duplicate input detection (SOFT WARNING) ──

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Detects when LinkedIn and CV text are identical or near-identical.
 * Uses Jaccard similarity on tokenized word sets (threshold: 0.85).
 * Soft warning — user can still proceed.
 */
export function detectDuplicateInput(
  linkedinText: string,
  cvText: string
): GuardResult {
  const ltTrimmed = linkedinText.trim();
  const cvTrimmed = cvText.trim();

  // Only check if both fields have substantial content
  if (ltTrimmed.length < MIN_CHARS || cvTrimmed.length < MIN_CHARS) {
    return { valid: true };
  }

  const similarity = jaccardSimilarity(tokenize(ltTrimmed), tokenize(cvTrimmed));

  if (similarity >= JACCARD_DUPLICATE_THRESHOLD) {
    return { valid: true, warningKey: "duplicateInput" };
  }

  return { valid: true };
}

// ── Guard 5: Input quality score (INFORMATIONAL) ───────

/**
 * Computes a quality score (0-100) for input text.
 * Used for an optional quality indicator — never blocks submission.
 *
 * Scoring breakdown:
 *   Length     (0-30) — more text = better
 *   Words      (0-20) — word count
 *   Lines      (0-15) — structured text has more lines
 *   Sections   (0-20) — presence of section headers
 *   Structure  (0-15) — years, bullets, emails
 */
export function computeInputQuality(text: string): QualityResult {
  const trimmed = text.trim();
  if (!trimmed) return { score: 0, level: "low" };

  let score = 0;

  // Length (0-30): 0→0 chars, 30→2000+ chars
  score += Math.min(30, (trimmed.length / 2000) * 30);

  // Words (0-20): 0→0 words, 20→200+ words
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  score += Math.min(20, (words.length / 200) * 20);

  // Lines (0-15): structured text has more non-empty lines
  const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
  score += Math.min(15, (lines.length / 30) * 15);

  // Section markers (0-20): known profile section headers
  const sectionRx = [
    /\bexperience\b/i, /\beducation\b/i, /\bskills\b/i,
    /\bsummary\b/i, /\babout\b/i, /\bexperiencia\b/i,
    /\beducación\b/i, /\bhabilidades\b/i,
    /\bwork\b/i, /\bcontact\b/i, /\bcertif/i, /\bproject/i,
  ];
  const markerHits = sectionRx.filter((rx) => rx.test(trimmed)).length;
  score += Math.min(20, (markerHits / 5) * 20);

  // Structure signals (0-15): years, bullets, email
  const hasYears = /\d{4}/.test(trimmed);
  const hasBullets = /[•\-–—]\s/.test(trimmed);
  const hasEmail = /@/.test(trimmed);
  score += Math.min(15, (hasYears ? 5 : 0) + (hasBullets ? 5 : 0) + (hasEmail ? 5 : 0));

  score = Math.round(Math.min(100, score));

  const level: QualityResult["level"] =
    score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  return { score, level };
}
