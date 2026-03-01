/**
 * Detect [ADD_METRIC: ...] and [NEEDS_VERIFICATION] placeholders in text.
 *
 * Robust regex: case-insensitive, allows internal spaces, optional colon payload.
 * Single source of truth — used by:
 * - Studio warnings (StudioEntryEditor, StudioSectionEditor)
 * - Checkout value summary (placeholder count)
 * - Export gating/cleanup logic
 */

/**
 * Global version for .match() counting.
 * Matches: [ADD_METRIC], [ADD_METRIC: dates], [add_metric], [NEEDS_VERIFICATION], etc.
 */
const PLACEHOLDER_RE = /\[\s*(ADD_METRIC|NEEDS_VERIFICATION)(?:\s*:[^\]]+)?\s*\]/gi;

/**
 * Non-global version for .test() — avoids the stateful lastIndex bug
 * where a global regex with .test() returns alternating true/false.
 */
const PLACEHOLDER_RE_TEST = /\[\s*(ADD_METRIC|NEEDS_VERIFICATION)(?:\s*:[^\]]+)?\s*\]/i;

/**
 * Highlighting regex exported for UI overlay rendering.
 * Same pattern as PLACEHOLDER_RE but exported for use in dangerouslySetInnerHTML.
 */
export const PLACEHOLDER_HIGHLIGHT_RE = /\[\s*(?:ADD_METRIC|NEEDS_VERIFICATION)(?:\s*:[^\]]+)?\s*\]/gi;

/**
 * Count the number of placeholders in text.
 */
export function countPlaceholders(text: string): number {
  if (!text) return 0;
  const matches = text.match(PLACEHOLDER_RE);
  return matches?.length ?? 0;
}

/**
 * Check whether text contains any placeholders.
 * Uses a non-global regex to avoid the stateful .test() + /g bug.
 */
export function hasPlaceholders(text: string): boolean {
  if (!text) return false;
  return PLACEHOLDER_RE_TEST.test(text);
}

/**
 * Count placeholders from the correct source of truth for a single section.
 * Priority: userOptimized > userRewritten > rewrite.rewritten
 * Includes both section-level and entry-level text.
 *
 * @param computeStableId - function to compute entry stable IDs (from entry-id.ts)
 */
export function countSectionPlaceholders(
  rewrite: {
    sectionId: string;
    rewritten: string;
    entries?: Array<{ entryTitle: string; original: string; rewritten: string }>;
  },
  userOptimized: Record<string, string>,
  userRewritten?: Record<string, string>,
  computeStableId?: (title: string, original: string) => string,
  deletedEntryKeys?: Set<string> // HOTFIX-8: Exclude deleted entries from count
): { sectionCount: number; entryCount: number; total: number; hiddenCount: number } {
  // Section-level: userOptimized > userRewritten > rewrite.rewritten
  const sectionText =
    userOptimized[rewrite.sectionId] ??
    userRewritten?.[rewrite.sectionId] ??
    rewrite.rewritten;
  const sectionCount = countPlaceholders(sectionText);

  // Entry-level
  let entryCount = 0;
  let hiddenCount = 0;
  if (rewrite.entries) {
    for (const entry of rewrite.entries) {
      const stableId = computeStableId
        ? computeStableId(entry.entryTitle, entry.original)
        : String(entry.entryTitle);
      const entryKey = `${rewrite.sectionId}:${stableId}`;
      const entryText = userOptimized[entryKey] ?? entry.rewritten;
      // HOTFIX-8: Skip deleted entries — count them as hidden instead
      if (deletedEntryKeys?.has(entryKey)) {
        hiddenCount += countPlaceholders(entryText);
        continue;
      }
      entryCount += countPlaceholders(entryText);
    }
  }

  return { sectionCount, entryCount, total: sectionCount + entryCount, hiddenCount };
}

/**
 * Strip all placeholder tokens from text for export cleanup.
 * Removes the bracket tokens entirely and collapses resulting blank lines.
 */
export function stripPlaceholders(text: string): string {
  if (!text) return text;
  return text
    .replace(PLACEHOLDER_RE, "")
    .replace(/\n{3,}/g, "\n\n") // collapse triple+ newlines
    .replace(/^\s*\n/, "") // remove leading blank line
    .trim();
}

/**
 * HOTFIX-5 E.12: Sanitize template output for export.
 * Removes:
 * - Orphan labels (e.g. "Phone:" with empty value, "Email:" with no address)
 * - Dangling punctuation/separators (trailing |, -, :, ;, , at line ends)
 * - Unresolved placeholder tokens (via stripPlaceholders)
 * - Empty lines left after cleanup
 *
 * Apply to both PDF and DOCX export output.
 */
export function sanitizeTemplateOutput(text: string): string {
  if (!text) return text;

  let result = stripPlaceholders(text);

  // Remove orphan labels: lines that are just "Label:" or "Label: " with nothing after
  // Use [A-Za-z ] instead of [A-Za-z\s] to avoid matching across newlines
  result = result.replace(/^[A-Za-z ]+:\s*$/gm, "");

  // Remove lines with only separators/punctuation (e.g. "|", " | ", "- ", ", ")
  result = result.replace(/^\s*[|,;\-–—•·]+\s*$/gm, "");

  // Strip dangling trailing separators from non-empty lines
  result = result.replace(/\s*[|,;\-–—]\s*$/gm, "");

  // Strip trailing colons from lines where the label has no value
  // (but preserve colons that are part of content like "Skills: Python, JS")
  result = result.replace(/^([^:\n]+):\s*$/gm, "$1");

  // Collapse resulting multi-blank lines and trim
  result = result
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*\n/, "")
    .trim();

  return result;
}
