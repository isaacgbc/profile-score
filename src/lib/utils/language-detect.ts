/**
 * Lightweight heuristic language detector for EN/ES profiles.
 *
 * Uses character frequency (ñ, á, é, í, ó, ú, ü, ¿, ¡) and
 * common function-word matching to distinguish Spanish from English.
 *
 * Pure synchronous function — no I/O, no LLM calls.
 * Works for all input paths: PDF uploads, pasted text, CV.
 */

// ── Spanish-specific characters ──
const SPANISH_CHARS_RE = /[ñáéíóúüÑÁÉÍÓÚÜ¿¡]/g;

// ── Top-20 function words per language ──
const SPANISH_WORDS = new Set([
  "de", "en", "la", "el", "los", "las", "del", "con",
  "por", "para", "que", "una", "como", "más", "pero",
  "sobre", "este", "esta", "entre", "desde",
]);

const ENGLISH_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from",
  "have", "been", "are", "was", "were", "will", "can",
  "not", "but", "your", "they", "about", "into",
]);

export interface LanguageDetectionResult {
  language: "en" | "es" | "unknown";
  confidence: number;
}

/**
 * Detect whether profile text is primarily English or Spanish.
 *
 * @param text - Raw profile text (PDF or pasted)
 * @returns Detected language and confidence (0-1)
 */
export function detectProfileLanguage(text: string): LanguageDetectionResult {
  if (!text || text.trim().length < 20) {
    return { language: "unknown", confidence: 0 };
  }

  // Sample first 2000 chars (enough signal, fast)
  const sample = text.slice(0, 2000).toLowerCase();

  // Count Spanish-specific characters
  const spanishCharMatches = sample.match(SPANISH_CHARS_RE);
  const spanishCharCount = spanishCharMatches?.length ?? 0;

  // Tokenize: split on whitespace, filter empties
  const words = sample
    .replace(/[^a-záéíóúüñ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  let spanishWordCount = 0;
  let englishWordCount = 0;

  for (const word of words) {
    if (SPANISH_WORDS.has(word)) spanishWordCount++;
    if (ENGLISH_WORDS.has(word)) englishWordCount++;
  }

  // Weighted scoring: Spanish chars count 3x (very distinctive)
  const esScore = spanishCharCount * 3 + spanishWordCount;
  const enScore = englishWordCount;
  const totalScore = esScore + enScore;

  if (totalScore === 0) {
    return { language: "unknown", confidence: 0 };
  }

  // Require 1.5x dominance to classify
  if (esScore > enScore * 1.5) {
    const confidence = Math.min(0.95, esScore / totalScore);
    return { language: "es", confidence };
  }

  if (enScore > esScore * 1.5) {
    const confidence = Math.min(0.95, enScore / totalScore);
    return { language: "en", confidence };
  }

  // Ambiguous — neither language dominates
  return { language: "unknown", confidence: 0.3 };
}

/**
 * Check if generated output text matches the expected target locale.
 * Returns true if the text appears to be in the target language,
 * or if the text is too short / inconclusive to determine.
 */
export function isOutputInTargetLocale(
  text: string,
  targetLocale: "en" | "es"
): boolean {
  if (!text || text.trim().length < 30) return true; // Too short to determine
  const detection = detectProfileLanguage(text);
  if (detection.language === "unknown" || detection.confidence < 0.5) return true; // Inconclusive
  return detection.language === targetLocale;
}
