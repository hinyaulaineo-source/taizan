import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { parseStudentsFromCsv } from '@/lib/import/student-csv'
import { NextResponse } from 'next/server'

export const maxDuration = 120

function minPasswordLength() {
  const n = parseInt(process.env.CSV_MIN_PASSWORD_LENGTH ?? '6', 10)
  return Number.isFinite(n) && n > 0 ? n : 6
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (normalizeRole(profile?.role) !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const form = await request.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: 'Send multipart/form-data with csv file.' }, { status: 400 })
  }
  const body = {
    dryRun: String(form.get('dryRun') ?? '') === 'true',
  }
  const dryRun = body.dryRun === true

  const csvFile = form.get('csv')
  if (!(csvFile instanceof File)) {
    return NextResponse.json({ error: 'CSV file is required.' }, { status: 400 })
  }

  const csvText = await csvFile.text()
  let sheet: ReturnType<typeof parseStudentsFromCsv>
  try {
    sheet = parseStudentsFromCsv(csvText)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to read CSV'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const minLen = minPasswordLength()
  const skippedPassword: string[] = []
  const readyRows = sheet.rows.filter((r) => {
    if (r.refNo.length < minLen) {
      skippedPassword.push(`${r.email} (ref "${r.refNo}" shorter than ${minLen} chars)`)
      return false
    }
    return true
  })

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldSync: readyRows.length,
      skippedPassword,
      warnings: sheet.warnings,
      sample: readyRows.slice(0, 5),
    })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json(
      { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 },
    )
  }
  const admin = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const emailToUserId = new Map<string, string>()
  let page = 1
  const perPage = 1000
  for (;;) {
    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ page, perPage })
    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 })
    }
    for (const u of listData.users) {
      if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id)
    }
    if (listData.users.length < perPage) break
    page += 1
  }

  const created: string[] = []
  const updated: string[] = []
  const errors: string[] = []

  for (const row of readyRows) {
    const existingId = emailToUserId.get(row.email)

    try {
      if (existingId) {
        const { data: existingProf } = await admin
          .from('profiles')
          .select('role')
          .eq('id', existingId)
          .maybeSingle()
        const existingRole = normalizeRole(existingProf?.role)
        if (existingRole === 'owner' || existingRole === 'coach') {
          errors.push(
            `${row.email}: skipped (existing account is ${existingRole}, not overwritten from sheet)`,
          )
          continue
        }

        const { error: upAuth } = await admin.auth.admin.updateUserById(existingId, {
          password: row.refNo,
          email_confirm: true,
          user_metadata: { full_name: row.fullName, sheet_ref_no: row.refNo },
        })
        if (upAuth) {
          errors.push(`${row.email}: ${upAuth.message}`)
          continue
        }
        const { error: upProf } = await admin
          .from('profiles')
          .upsert(
            {
              id: existingId,
              email: row.email,
              full_name: row.fullName,
              role: 'athlete',
              sheet_ref_no: row.refNo,
            },
            { onConflict: 'id' },
          )
        if (upProf) {
          errors.push(`${row.email} profile: ${upProf.message}`)
          continue
        }
        updated.push(row.email)
      } else {
        const { data: createdUser, error: crErr } = await admin.auth.admin.createUser({
          email: row.email,
          password: row.refNo,
          email_confirm: true,
          user_metadata: { full_name: row.fullName, sheet_ref_no: row.refNo },
        })
        if (crErr || !createdUser.user) {
          errors.push(`${row.email}: ${crErr?.message ?? 'create failed'}`)
          continue
        }
        const uid = createdUser.user.id
        const { error: profErr } = await admin.from('profiles').upsert(
          {
            id: uid,
            email: row.email,
            full_name: row.fullName,
            role: 'athlete',
            sheet_ref_no: row.refNo,
          },
          { onConflict: 'id' },
        )
        if (profErr) {
          errors.push(`${row.email} profile: ${profErr.message}`)
          continue
        }
        emailToUserId.set(row.email, uid)
        created.push(row.email)
      }
    } catch (err) {
      errors.push(`${row.email}: ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  return NextResponse.json({
    ok: true,
    created: created.length,
    updated: updated.length,
    skippedPassword,
    warnings: sheet.warnings,
    errors,
    createdEmails: created,
    updatedEmails: updated,
  })
}
