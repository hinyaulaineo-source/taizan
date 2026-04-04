import { normalizeRole } from '@/lib/auth/roles'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseStudentsFromCsv } from '@/lib/import/student-csv'

export function rosterMinPasswordLength() {
  const n = parseInt(process.env.CSV_MIN_PASSWORD_LENGTH ?? '6', 10)
  return Number.isFinite(n) && n > 0 ? n : 6
}

export type RosterDryRunResult = {
  dryRun: true
  wouldSync: number
  skippedPassword: string[]
  warnings: string[]
  sample: ReturnType<typeof parseStudentsFromCsv>['rows']
}

export type RosterSyncResult = {
  ok: true
  created: number
  updated: number
  skippedPassword: string[]
  warnings: string[]
  errors: string[]
  createdEmails: string[]
  updatedEmails: string[]
}

async function buildEmailToUserIdMap(admin: SupabaseClient): Promise<Map<string, string>> {
  const emailToUserId = new Map<string, string>()
  let page = 1
  const perPage = 1000
  for (;;) {
    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ page, perPage })
    if (listErr) throw new Error(listErr.message)
    for (const u of listData.users) {
      if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id)
    }
    if (listData.users.length < perPage) break
    page += 1
  }
  return emailToUserId
}

export async function runRosterSyncFromCsvText(
  admin: SupabaseClient,
  csvText: string,
  options: { dryRun: true },
): Promise<RosterDryRunResult>
export async function runRosterSyncFromCsvText(
  admin: SupabaseClient,
  csvText: string,
  options: { dryRun: false },
): Promise<RosterSyncResult>
export async function runRosterSyncFromCsvText(
  admin: SupabaseClient,
  csvText: string,
  options: { dryRun: boolean },
): Promise<RosterDryRunResult | RosterSyncResult> {
  const sheet = parseStudentsFromCsv(csvText)
  const minLen = rosterMinPasswordLength()
  const skippedPassword: string[] = []
  const readyRows = sheet.rows.filter((r) => {
    if (r.refNo.length < minLen) {
      skippedPassword.push(`${r.email} (ref "${r.refNo}" shorter than ${minLen} chars)`)
      return false
    }

    return true
  })

  if (options.dryRun) {
    return {
      dryRun: true,
      wouldSync: readyRows.length,
      skippedPassword,
      warnings: sheet.warnings,
      sample: readyRows.slice(0, 5),
    }
  }

  const emailToUserId = await buildEmailToUserIdMap(admin)

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

  return {
    ok: true,
    created: created.length,
    updated: updated.length,
    skippedPassword,
    warnings: sheet.warnings,
    errors,
    createdEmails: created,
    updatedEmails: updated,
  }
}
