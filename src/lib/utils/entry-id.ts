/** Compute a stable ID from entry title + original content (survives reorders) */
export function computeEntryStableId(title: string, original: string): string {
  const input = `${title}|${original.slice(0, 120)}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
