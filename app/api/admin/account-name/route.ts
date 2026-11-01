import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import {
  adminDbErrorResponse,
  adminEnvMissingResponse,
  createAdminClientOrNull,
} from '@/lib/supabase/admin-helpers'
import { NextResponse } from 'next/server'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { adminAccountNameSchema, parseBody } from '@/lib/security/validation'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'admin', user.id)
  if (limited) return limited

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (normalizeRole(profile?.role) !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const raw = await safeJsonParse(request)
  if (raw === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  if (raw === null) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = parseBody(adminAccountNameSchema, raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { profileId, fullName } = parsed.data

  const admin = createAdminClientOrNull()
  if (!admin) return adminEnvMissingResponse()

  const { data: existing, error: readErr } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', profileId)
    .maybeSingle()

  if (readErr) {
    return adminDbErrorResponse(readErr)
  }
  if (!existing) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
  }
  if (normalizeRole(existing.role) === 'owner') {
    return NextResponse.json({ error: 'Owner names cannot be changed here.' }, { status: 400 })
  }

  const { data: updated, error } = await admin
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', profileId)
    .select('id, full_name')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: `Update failed: ${error.message}` }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'Update returned no row.' }, { status: 500 })
  }

  const { data: authUser } = await admin.auth.admin.getUserById(profileId)
  if (authUser?.user) {
    const { error: metaErr } = await admin.auth.admin.updateUserById(profileId, {
      user_metadata: {
        ...(authUser.user.user_metadata ?? {}),
        full_name: fullName,
      },
    })
    if (metaErr) {
      return NextResponse.json(
        {
          ok: true,
          updated,
          warning: `Name saved on the profile, but auth metadata could not be updated: ${metaErr.message}`,
        },
        { status: 200 },
      )
    }
  }

  return NextResponse.json({ ok: true, updated })
}
