/**
 * Normalize user-entered phone to digits-only storage (and Supabase auth password).
 * Strips spaces, dashes, parentheses, leading +.
 */
export function normalizePhoneDigits(input: string): string {
  const s = input.trim()
  const digits = s.replace(/\D/g, '')
  return digits
}

/** Minimum digits so password meets typical Supabase min length (6). */
export const PHONE_PASSWORD_MIN_DIGITS = 6
export const PHONE_PASSWORD_MAX_DIGITS = 20

export function phoneDigitsSchemaMessage(): string {
  return `Phone must be ${PHONE_PASSWORD_MIN_DIGITS}-${PHONE_PASSWORD_MAX_DIGITS} digits (used as your sign-in password).`
}

export function isValidPhoneDigits(digits: string): boolean {
  return (
    digits.length >= PHONE_PASSWORD_MIN_DIGITS &&
    digits.length <= PHONE_PASSWORD_MAX_DIGITS
  )
}

/** Use normalized digits as auth password (must satisfy Supabase min length). */
export function phoneDigitsToAuthPassword(digits: string): string {
  return digits
}
