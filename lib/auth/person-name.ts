/** Normalize a displayed person name for login matching. */
export function normalizePersonName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\u00c0-\u024f\s-]/gi, ' ')
    .replace(/[\s-]+/g, ' ')
    .trim()
}

export function namesMatch(stored: string | null | undefined, entered: string | null | undefined): boolean {
  const a = stored ? normalizePersonName(stored) : ''
  const b = entered ? normalizePersonName(entered) : ''
  return a.length >= 2 && a === b
}

export function looksLikeEmail(input: string): boolean {
  return input.includes('@')
}
