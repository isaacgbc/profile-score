/**
 * Detect [BRACKET_PLACEHOLDERS] in text for highlighting and counting.
 *
 * Matches patterns like [ADD YOUR METRIC HERE], [COMPANY NAME], [NEEDS_VERIFICATION].
 * Requires uppercase first char and at least 2 chars inside brackets.
 */

const PLACEHOLDER_RE = /\[[A-Z][A-Z0-9_ /'-]*\]/g;

/**
 * Non-global version for .test() — avoids the stateful lastIndex bug
 * where a global regex with .test() returns alternating true/false.
 */
const PLACEHOLDER_RE_TEST = /\[[A-Z][A-Z0-9_ /'-]*\]/;

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
 * Uses a non-global regex to avoid the stateful .test() + /g bug.
 */
export function hasPlaceholders(text: string): boolean {
  if (!text) return false;
  return PLACEHOLDER_RE_TEST.test(text);
}
