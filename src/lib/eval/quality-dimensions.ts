/**
 * Sprint 1: Quality Dimension Scorers
 *
 * 6 heuristic-based scoring functions that evaluate LLM output quality.
 * Each returns a 0-10 score. All operate on a single section's audit+rewrite output.
 *
 * NO LLM calls — fast, deterministic, reproducible.
 *
 * Composite formula:
 *   (factuality * 0.25 + specificity * 0.20 + actionability * 0.20 +
 *    objectiveAlignment * 0.15 + readability * 0.10 + atsSafety * 0.10) * 10
 *   → 0-100 scale
 */

import { detectBuzzwords, detectHallucinatedMetrics } from "../services/generation-guards";

// ── Types ───────────────────────────────────────────────

export interface DimensionScore {
  dimension: string;
  score: number; // 0-10
  details: string;
}

export interface CompositeDimensionResult {
  factuality: DimensionScore;
  specificity: DimensionScore;
  actionability: DimensionScore;
  objectiveAlignment: DimensionScore;
  readability: DimensionScore;
  atsSafety: DimensionScore;
  composite: number; // 0-100
}

// ── Helpers ─────────────────────────────────────────────

/** Extract significant words (>3 chars, lowercased, deduped) */
function extractWords(text: string): Set<string> {
  if (!text) return new Set();
  const words = text.toLowerCase().match(/[a-z\u00C0-\u024F]{4,}/g) || [];
  return new Set(words);
}

/** Count sentences in text */
function countSentences(text: string): number {
  if (!text) return 0;
  return (text.match(/[.!?]+\s/g) || []).length + 1;
}

/** Average word length */
function avgWordLength(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 0;
  return words.reduce((sum, w) => sum + w.length, 0) / words.length;
}

/** Count words */
function wordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

// ── 1. Factuality ───────────────────────────────────────
/**
 * Checks: no hallucinated metrics, no invented titles/companies.
 * Uses detectHallucinatedMetrics from generation-guards.
 * Also checks for [ADD_METRIC] tags (positive signal — LLM is honest).
 */
export function scoreFactuality(
  original: string,
  rewritten: string
): DimensionScore {
  if (!original || !rewritten) {
    return { dimension: "factuality", score: 5, details: "Insufficient text to evaluate" };
  }

  let score = 10;
  const issues: string[] = [];

  // Check hallucinated metrics
  const hallucinated = detectHallucinatedMetrics(original, rewritten);
  if (hallucinated.severity === "high") {
    score -= 5;
    issues.push(`${hallucinated.count} hallucinated metrics (high severity)`);
  } else if (hallucinated.severity === "low") {
    score -= 2;
    issues.push(`${hallucinated.count} potentially hallucinated metrics`);
  }

  // Bonus for [ADD_METRIC] usage (honest about missing data)
  const addMetricCount = (rewritten.match(/\[ADD_METRIC\]/gi) || []).length;
  if (addMetricCount > 0 && hallucinated.count === 0) {
    score = Math.min(10, score + 1);
    issues.push(`${addMetricCount} [ADD_METRIC] tags (good practice)`);
  }

  // Check for fabricated-looking placeholders like [X%], [XX], etc.
  const fakePlaceholders = (rewritten.match(/\[X+%?\]/gi) || []).length;
  if (fakePlaceholders > 0) {
    score -= 1;
    issues.push(`${fakePlaceholders} generic placeholders instead of [ADD_METRIC]`);
  }

  // Check [NEEDS_VERIFICATION] tags (positive signal)
  const needsVerif = (rewritten.match(/\[NEEDS_VERIFICATION\]/gi) || []).length;
  if (needsVerif > 0) {
    issues.push(`${needsVerif} [NEEDS_VERIFICATION] tags`);
  }

  score = Math.max(0, Math.min(10, score));
  return {
    dimension: "factuality",
    score,
    details: issues.length > 0 ? issues.join("; ") : "No factuality issues detected",
  };
}

// ── 2. Specificity ──────────────────────────────────────
/**
 * Checks whether the explanation references specific content from the original.
 * Generic advice ("Your profile could be stronger") scores low.
 * Specific quotes or references score high.
 */
export function scoreSpecificity(
  explanation: string,
  original: string
): DimensionScore {
  if (!explanation || !original) {
    return { dimension: "specificity", score: 5, details: "Insufficient text to evaluate" };
  }

  let score = 5; // Start at neutral
  const issues: string[] = [];

  const originalWords = extractWords(original);
  const explanationWords = extractWords(explanation);

  // Check overlap: does explanation reference specific terms from original?
  let overlap = 0;
  for (const word of explanationWords) {
    if (originalWords.has(word)) overlap++;
  }
  const overlapRatio = explanationWords.size > 0 ? overlap / explanationWords.size : 0;

  if (overlapRatio >= 0.15) {
    score += 2;
    issues.push(`Good content overlap (${Math.round(overlapRatio * 100)}%)`);
  } else if (overlapRatio < 0.05) {
    score -= 2;
    issues.push(`Very low content overlap (${Math.round(overlapRatio * 100)}%) — may be generic`);
  }

  // Check for quoted content (direct references)
  const hasQuotes = (explanation.match(/[""][^""]+[""]|'[^']+'/g) || []).length;
  if (hasQuotes > 0) {
    score += 2;
    issues.push(`${hasQuotes} direct quote(s) from original`);
  }

  // Penalize known generic phrases
  const GENERIC_PHRASES = [
    "could be stronger",
    "needs improvement",
    "consider adding more",
    "would benefit from",
    "shows promise",
    "demonstrates potential",
    "with some adjustments",
    "a few tweaks",
    "minor improvements",
  ];
  const lower = explanation.toLowerCase();
  const genericCount = GENERIC_PHRASES.filter((p) => lower.includes(p)).length;
  if (genericCount >= 2) {
    score -= 2;
    issues.push(`${genericCount} generic phrases detected`);
  } else if (genericCount === 1) {
    score -= 1;
    issues.push("1 generic phrase detected");
  }

  // Check explanation length (too short = likely generic)
  const words = wordCount(explanation);
  if (words < 20) {
    score -= 1;
    issues.push(`Very short explanation (${words} words)`);
  } else if (words >= 50) {
    score += 1;
    issues.push(`Detailed explanation (${words} words)`);
  }

  score = Math.max(0, Math.min(10, score));
  return {
    dimension: "specificity",
    score,
    details: issues.join("; ") || "Average specificity",
  };
}

// ── 3. Actionability ────────────────────────────────────
/**
 * Checks whether suggestions are concrete with what+why+how.
 * Vague suggestions ("Improve your headline") score low.
 * Specific ones ("Add your target role keywords like X, Y") score high.
 */
export function scoreActionability(suggestions: string[]): DimensionScore {
  if (!suggestions || suggestions.length === 0) {
    return { dimension: "actionability", score: 3, details: "No suggestions provided" };
  }

  let totalScore = 0;
  const issues: string[] = [];

  for (const suggestion of suggestions) {
    let sScore = 5;
    const words = wordCount(suggestion);

    // Length check: too short = vague, too long = unfocused
    if (words < 8) {
      sScore -= 2; // Too short to be actionable
    } else if (words >= 15 && words <= 50) {
      sScore += 1; // Good length for actionable advice
    } else if (words > 50) {
      sScore -= 1; // Overly verbose
    }

    // Check for concrete verbs (action-oriented)
    const ACTION_VERBS = /\b(add|include|replace|remove|change|use|list|mention|quantify|specify|highlight|move|rewrite|rephrase|start|end|split|merge|cut|expand)\b/i;
    if (ACTION_VERBS.test(suggestion)) {
      sScore += 2;
    }

    // Check for examples or specific content
    const hasExample = /e\.g\.|for example|such as|like "|→|:/i.test(suggestion);
    if (hasExample) {
      sScore += 2;
    }

    // Penalize vague language
    const VAGUE_PHRASES = /\b(consider|might want to|perhaps|possibly|maybe|could try|think about)\b/i;
    if (VAGUE_PHRASES.test(suggestion)) {
      sScore -= 1;
    }

    totalScore += Math.max(0, Math.min(10, sScore));
  }

  const avgScore = totalScore / suggestions.length;
  const rounded = Math.round(avgScore * 10) / 10;

  if (suggestions.length < 2) {
    issues.push("Few suggestions");
  }
  if (rounded >= 7) {
    issues.push("Suggestions are concrete and actionable");
  } else if (rounded < 5) {
    issues.push("Suggestions tend to be vague");
  }

  return {
    dimension: "actionability",
    score: Math.max(0, Math.min(10, Math.round(avgScore))),
    details: issues.join("; ") || `Average actionability (${rounded}/10)`,
  };
}

// ── 4. Objective Alignment ──────────────────────────────
/**
 * Checks whether feedback references the objective/target role.
 * For "job" mode: should reference the job description.
 * For "objective" mode: should reference the growth objective.
 */
export function scoreObjectiveAlignment(
  explanation: string,
  suggestions: string[],
  objectiveContext: string
): DimensionScore {
  if (!objectiveContext || objectiveContext.trim().length < 10) {
    return {
      dimension: "objectiveAlignment",
      score: 5,
      details: "No objective context provided — neutral score",
    };
  }

  const objectiveWords = extractWords(objectiveContext);
  if (objectiveWords.size === 0) {
    return { dimension: "objectiveAlignment", score: 5, details: "Objective has no significant words" };
  }

  // Combine explanation + suggestions for analysis
  const allText = [explanation, ...suggestions].join(" ");
  const allWords = extractWords(allText);

  // Count overlap with objective
  let overlap = 0;
  for (const word of objectiveWords) {
    if (allWords.has(word)) overlap++;
  }
  const overlapRatio = objectiveWords.size > 0 ? overlap / objectiveWords.size : 0;

  let score = 5;
  const issues: string[] = [];

  if (overlapRatio >= 0.3) {
    score += 3;
    issues.push(`Strong objective alignment (${Math.round(overlapRatio * 100)}% keyword overlap)`);
  } else if (overlapRatio >= 0.15) {
    score += 1;
    issues.push(`Moderate objective alignment (${Math.round(overlapRatio * 100)}%)`);
  } else if (overlapRatio < 0.05) {
    score -= 3;
    issues.push(`Very low objective alignment (${Math.round(overlapRatio * 100)}%) — feedback may be generic`);
  } else {
    score -= 1;
    issues.push(`Low objective alignment (${Math.round(overlapRatio * 100)}%)`);
  }

  // Check for explicit role/objective mentions
  const lowerText = allText.toLowerCase();
  const roleKeywords = ["role", "position", "opportunity", "target", "objective", "goal"];
  const hasRoleReference = roleKeywords.some((kw) => lowerText.includes(kw));
  if (hasRoleReference) {
    score += 1;
    issues.push("References role/objective explicitly");
  }

  score = Math.max(0, Math.min(10, score));
  return {
    dimension: "objectiveAlignment",
    score,
    details: issues.join("; ") || "Average alignment",
  };
}

// ── 5. Readability ──────────────────────────────────────
/**
 * Checks: appropriate length, no jargon overload, scannable.
 * Good rewrites are concise, use bullet points, avoid filler.
 */
export function scoreReadability(rewritten: string): DimensionScore {
  if (!rewritten || rewritten.trim().length < 10) {
    return { dimension: "readability", score: 5, details: "Insufficient text to evaluate" };
  }

  let score = 7; // Start optimistic
  const issues: string[] = [];

  const words = wordCount(rewritten);
  const sentences = countSentences(rewritten);
  const avgWLen = avgWordLength(rewritten);

  // Word count: penalize extremes
  if (words < 20) {
    score -= 1;
    issues.push("Very short rewrite");
  } else if (words > 500) {
    score -= 2;
    issues.push(`Very long rewrite (${words} words)`);
  }

  // Average word length: >7 chars average suggests jargon overload
  if (avgWLen > 7) {
    score -= 1;
    issues.push(`High average word length (${avgWLen.toFixed(1)}) — possible jargon`);
  }

  // Sentence length: avg > 30 words per sentence is hard to read
  const avgSentenceLen = sentences > 0 ? words / sentences : words;
  if (avgSentenceLen > 30) {
    score -= 1;
    issues.push(`Long sentences (avg ${Math.round(avgSentenceLen)} words)`);
  }

  // Bullet points / structure
  const hasBullets = /^\s*[-•*]\s/m.test(rewritten);
  const hasLineBreaks = (rewritten.match(/\n/g) || []).length >= 2;
  if (hasBullets || hasLineBreaks) {
    score += 1;
    issues.push("Good visual structure (bullets/line breaks)");
  }

  // Filler words
  const FILLER_RE = /\b(basically|actually|really|very|just|quite|somewhat|fairly|rather)\b/gi;
  const fillerCount = (rewritten.match(FILLER_RE) || []).length;
  if (fillerCount >= 3) {
    score -= 1;
    issues.push(`${fillerCount} filler words detected`);
  }

  // Keyword repetition: same word 4+ times in section
  const wordFreq: Record<string, number> = {};
  const lowerWords = rewritten.toLowerCase().match(/[a-z\u00C0-\u024F]{4,}/g) || [];
  for (const w of lowerWords) {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  }
  const maxFreq = Math.max(0, ...Object.values(wordFreq));
  if (maxFreq >= 6) {
    score -= 2;
    issues.push(`Word repeated ${maxFreq} times — possible keyword stuffing`);
  } else if (maxFreq >= 4) {
    score -= 1;
    issues.push(`Word repeated ${maxFreq} times`);
  }

  score = Math.max(0, Math.min(10, score));
  return {
    dimension: "readability",
    score,
    details: issues.join("; ") || "Good readability",
  };
}

// ── 6. ATS Safety ───────────────────────────────────────
/**
 * Checks: no special chars that break ATS, standard formatting, no buzzwords.
 * CV-specific checks are weighted more heavily when isCv=true.
 */
export function scoreAtsSafety(
  rewritten: string,
  isCv: boolean
): DimensionScore {
  if (!rewritten || rewritten.trim().length < 10) {
    return { dimension: "atsSafety", score: 7, details: "Insufficient text to evaluate" };
  }

  let score = 10;
  const issues: string[] = [];

  // Check ATS-unfriendly characters
  const EM_DASH = /\u2014/g;
  const SMART_QUOTES = /[\u201C\u201D\u2018\u2019]/g;
  const BULLET_SYMBOLS = /[\u2022\u25CF\u25CB\u25A0\u25AA]/g;

  const emDashCount = (rewritten.match(EM_DASH) || []).length;
  const smartQuoteCount = (rewritten.match(SMART_QUOTES) || []).length;
  const bulletCount = (rewritten.match(BULLET_SYMBOLS) || []).length;

  if (emDashCount > 0) {
    score -= 1;
    issues.push(`${emDashCount} em-dashes (use hyphens for ATS)`);
  }
  if (smartQuoteCount > 0) {
    score -= 1;
    issues.push(`${smartQuoteCount} smart quotes (use straight quotes)`);
  }
  if (bulletCount > 0 && isCv) {
    score -= 1;
    issues.push(`${bulletCount} special bullet symbols (use simple dashes for ATS)`);
  }

  // Check buzzwords
  const buzzwords = detectBuzzwords(rewritten);
  if (buzzwords.length >= 3) {
    score -= 3;
    issues.push(`${buzzwords.length} buzzwords: ${buzzwords.slice(0, 3).join(", ")}`);
  } else if (buzzwords.length > 0) {
    score -= buzzwords.length;
    issues.push(`${buzzwords.length} buzzword(s): ${buzzwords.join(", ")}`);
  }

  // CV-specific checks
  if (isCv) {
    // Check for multi-column indicators (tables, tabs)
    const hasTabChars = /\t/.test(rewritten);
    if (hasTabChars) {
      score -= 1;
      issues.push("Tab characters detected — may indicate multi-column layout");
    }

    // Check for all-caps sections (some ATS parse these badly)
    const allCapsLines = rewritten.split("\n").filter((l) => l.length > 10 && l === l.toUpperCase()).length;
    if (allCapsLines > 2) {
      score -= 1;
      issues.push(`${allCapsLines} all-caps lines`);
    }
  }

  // Emoji check (non-flag)
  const EMOJI_RE = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojiCount = (rewritten.match(EMOJI_RE) || []).length;
  if (emojiCount > 0) {
    score -= 1;
    issues.push(`${emojiCount} emoji(s) — may break ATS parsing`);
  }

  score = Math.max(0, Math.min(10, score));
  return {
    dimension: "atsSafety",
    score,
    details: issues.length > 0 ? issues.join("; ") : "ATS-safe formatting",
  };
}

// ── Composite Scorer ────────────────────────────────────

const WEIGHTS = {
  factuality: 0.25,
  specificity: 0.20,
  actionability: 0.20,
  objectiveAlignment: 0.15,
  readability: 0.10,
  atsSafety: 0.10,
} as const;

/**
 * Compute all 6 dimension scores for a single section's audit+rewrite output.
 *
 * @param original - Original section text from user
 * @param rewritten - LLM-rewritten text
 * @param explanation - LLM explanation/audit text
 * @param suggestions - LLM improvement suggestions
 * @param objectiveContext - Job description or objective text
 * @param isCv - Whether this is a CV section (enables CV-specific ATS checks)
 */
export function scoreAllDimensions(
  original: string,
  rewritten: string,
  explanation: string,
  suggestions: string[],
  objectiveContext: string,
  isCv: boolean
): CompositeDimensionResult {
  const factuality = scoreFactuality(original, rewritten);
  const specificity = scoreSpecificity(explanation, original);
  const actionability = scoreActionability(suggestions);
  const objectiveAlignment = scoreObjectiveAlignment(explanation, suggestions, objectiveContext);
  const readability = scoreReadability(rewritten);
  const atsSafety = scoreAtsSafety(rewritten, isCv);

  const composite = Math.round(
    (factuality.score * WEIGHTS.factuality +
      specificity.score * WEIGHTS.specificity +
      actionability.score * WEIGHTS.actionability +
      objectiveAlignment.score * WEIGHTS.objectiveAlignment +
      readability.score * WEIGHTS.readability +
      atsSafety.score * WEIGHTS.atsSafety) *
      10
  );

  return {
    factuality,
    specificity,
    actionability,
    objectiveAlignment,
    readability,
    atsSafety,
    composite,
  };
}
