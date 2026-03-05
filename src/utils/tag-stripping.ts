/**
 * Strip <private>...</private> tags from text before sending to observer.
 * Handles nested tags by stripping from innermost out.
 */
export function stripPrivateTags(text: string): string {
  if (!text) return text;

  // Iteratively strip innermost <private>...</private> tags until none remain
  let result = text;
  let prevResult = '';

  while (result !== prevResult) {
    prevResult = result;
    // Match innermost (non-nested) private tags
    result = result.replace(/<private>([^<]*(?:(?!<private>)<[^<]*)*)<\/private>/gi, '');
  }

  return result.trim();
}
