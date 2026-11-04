import { createServerClient } from '@supabase/ssr'
import { looksLikeEmail, namesMatch, normalizePersonName } from '@/lib/auth/person-name'
import { normalizePhoneDigits } from '@/lib/phone-auth'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { parseBody, passwordSignInSchema } from '@/lib/security/validation'
import { adminEnvMissingResponse, createAdminClientOrNull } from '@/lib/supabase/admin-helpers'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const GENERIC_FAIL = 'Invalid login credentials.'
const NAME_AMBIGUOUS = 'Multiple accounts share this name. Sign in with your email.'

type ProfileRow = { email: string; full_name: string | null; phone: string | null }

/** Build password attempts: raw secret, digits-only, and common HK phone variants. */
function passwordCandidates(secret: string, profilePhone?: string | null): string[] {
  const raw = secret.trim()
  const digits = normalizePhoneDigits(secret)
  const out = new Set<string>()

  if (raw) out.add(raw)
  if (digits) out.add(digits)

  if (digits.startsWith('852') && digits.length > 8) {
    out.add(digits.slice(3))
  }
  if (/^[4-9]\d{7}$/.test(digits)) {
    out.add(`852${digits}`)
  }

  const storedPhone = profilePhone ? normalizePhoneDigits(profilePhone) : ''
  if (storedPhone) out.add(storedPhone)

  return [...out].filter(Boolean)
}

async function resolveProfile(
  admin: NonNullable<ReturnType<typeof createAdminClientOrNull>>,
  identifier: string,
): Promise<{ profile: ProfileRow | null; email: string | null; ambiguous: boolean }> {
  if (looksLikeEmail(identifier)) {
    const email = identifier.trim().toLowerCase()
    const { data } = await admin
      .from('profiles')
      .select('email, full_name, phone')
      .ilike('email', email)
      .limit(1)
      .maybeSingle()

    // Always allow attempting auth with the typed email, even if the profile row is missing.
    return {
      profile: data ?? null,
      email: (data?.email ?? email).trim().toLowerCase(),
      ambiguous: false,
    }
  }

  const wanted = normalizePersonName(identifier)
  if (wanted.length < 2) return { profile: null, email: null, ambiguous: false }

  const { data } = await admin.from('profiles').select('email, full_name, phone').not('full_name', 'is', null)
  const matches = (data ?? []).filter((row) => namesMatch(row.full_name, identifier))
  if (matches.length > 1) return { profile: null, email: null, ambiguous: true }
  const profile = matches[0] ?? null
  return {
    profile,
    email: profile?.email ? profile.email.trim().toLowerCase() : null,
    ambiguous: false,
  }
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
    return NextResponse.json({ error: 'Enter your email or name, and your password.' }, { status: 400 })
  }

  const admin = createAdminClientOrNull()
  if (!admin) return adminEnvMissingResponse()

  const { profile, email, ambiguous } = await resolveProfile(admin, identifier)
  if (ambiguous) {
    return NextResponse.json({ error: NAME_AMBIGUOUS }, { status: 401 })
  }
  if (!email) {
    return NextResponse.json({ error: GENERIC_FAIL }, { status: 401 })
  }

  if (profile && namesMatch(profile.full_name, secret)) {
    return NextResponse.json(
      { error: 'Full name cannot be used as a password. Use your phone number or password.' },
      { status: 401 },
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  // Bind auth cookies onto the JSON response (Route Handler-safe).
  const cookieStore = await cookies()
  const successResponse = NextResponse.json({ ok: true })
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          successResponse.cookies.set(name, value, options)
          try {
            cookieStore.set(name, value, options)
          } catch {
            // ignore when the request store is read-only; response cookies still apply
          }
        })
      },
    },
  })

  const candidates = passwordCandidates(secret, profile?.phone)
  let signedIn = false
  let lastError: string | null = null

  for (const password of candidates) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) {
      signedIn = true
      break
    }
    lastError = error.message
  }

  if (!signedIn) {
    // Prefer a clearer hint when Supabase rejects the password.
    if (lastError && /invalid login credentials/i.test(lastError)) {
      return NextResponse.json(
        {
          error:
            'Invalid login credentials. Use your email (or registered name) and phone digits or custom password — not your full name.',
        },
        { status: 401 },
      )
    }
    return NextResponse.json({ error: lastError || GENERIC_FAIL }, { status: 401 })
  }

  return successResponse
}
