/**
 * Detect [BRACKET_PLACEHOLDERS] in text for highlighting and counting.
 *
 * Matches patterns like [ADD YOUR METRIC HERE], [COMPANY NAME], [NEEDS_VERIFICATION].
 * Requires uppercase first char and at least 2 chars inside brackets.
 */

const PLACEHOLDER_RE = /\[[A-Z][A-Z0-9_ /'-]*\]/g;

/**
 * Count the number of bracket placeholders in text.
 */
export function countPlaceholders(text: string): number {
  if (!text) return 0;
  const matches = text.match(PLACEHOLDER_RE);
  return matches?.length ?? 0;
}

/**
 * Check whether text contains any bracket placeholders.
 */
export function hasPlaceholders(text: string): boolean {
  if (!text) return false;
  return PLACEHOLDER_RE.test(text);
}
