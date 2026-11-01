import { createClient } from '@/lib/supabase/server'
import { looksLikeEmail, namesMatch, normalizePersonName } from '@/lib/auth/person-name'
import { normalizePhoneDigits } from '@/lib/phone-auth'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { parseBody, passwordSignInSchema } from '@/lib/security/validation'
import { adminEnvMissingResponse, createAdminClientOrNull } from '@/lib/supabase/admin-helpers'
import { NextResponse } from 'next/server'

const GENERIC_FAIL = 'Invalid login credentials.'
const NAME_AMBIGUOUS = 'Multiple accounts share this name. Sign in with your email.'

type ProfileRow = { email: string; full_name: string | null }

async function resolveProfile(
  admin: NonNullable<ReturnType<typeof createAdminClientOrNull>>,
  identifier: string,
): Promise<{ profile: ProfileRow | null; ambiguous: boolean }> {
  if (looksLikeEmail(identifier)) {
    const email = identifier.trim().toLowerCase()
    const { data } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('email', email)
      .maybeSingle()
    return { profile: data ?? null, ambiguous: false }
  }

  const wanted = normalizePersonName(identifier)
  if (wanted.length < 2) return { profile: null, ambiguous: false }

  const { data } = await admin.from('profiles').select('email, full_name').not('full_name', 'is', null)
  const matches = (data ?? []).filter((row) => namesMatch(row.full_name, identifier))
  if (matches.length > 1) return { profile: null, ambiguous: true }
  return { profile: matches[0] ?? null, ambiguous: false }
}

async function tryPasswords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string,
  secret: string,
): Promise<boolean> {
  const candidates = [...new Set([secret, normalizePhoneDigits(secret)].filter(Boolean))]
  for (const password of candidates) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return true
  }
  return false
}

async function tryNameSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: NonNullable<ReturnType<typeof createAdminClientOrNull>>,
  profile: ProfileRow,
  secret: string,
): Promise<boolean> {
  if (!namesMatch(profile.full_name, secret)) return false

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
  })
  const tokenHash = data?.properties?.hashed_token
  if (error || !tokenHash) return false

  const { error: otpError } = await supabase.auth.verifyOtp({
    type: 'email',
    token_hash: tokenHash,
  })
  return !otpError
}

export async function POST(request: Request) {
  const limited = applyRateLimit(request, 'auth')
  if (limited) return limited

  const raw = await safeJsonParse(request)
  if (raw === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
  }
  const parsed = parseBody(passwordSignInSchema, raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const identifier = parsed.data.identifier.trim()
  const secret = parsed.data.secret.trim()
  if (!identifier || !secret) {
    return NextResponse.json({ error: 'Enter your email or name, and your password or name.' }, { status: 400 })
  }

  const admin = createAdminClientOrNull()
  if (!admin) return adminEnvMissingResponse()

  const { profile, ambiguous } = await resolveProfile(admin, identifier)
  if (ambiguous) {
    return NextResponse.json({ error: NAME_AMBIGUOUS }, { status: 401 })
  }
  if (!profile?.email) {
    return NextResponse.json({ error: GENERIC_FAIL }, { status: 401 })
  }

  const supabase = await createClient()
  const signedIn =
    (await tryPasswords(supabase, profile.email, secret)) ||
    (await tryNameSession(supabase, admin, profile, secret))

  if (!signedIn) {
    return NextResponse.json({ error: GENERIC_FAIL }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
