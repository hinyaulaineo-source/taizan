import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { runRosterSyncFromCsvText } from '@/lib/admin/roster-sync'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const maxDuration = 120

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
  const dryRun = String(form.get('dryRun') ?? '') === 'true'

  const csvFile = form.get('csv')
  if (!(csvFile instanceof File)) {
    return NextResponse.json({ error: 'CSV file is required.' }, { status: 400 })
  }

  const csvText = await csvFile.text()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }
  const admin = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    if (dryRun) {
      const result = await runRosterSyncFromCsvText(admin, csvText, { dryRun: true })
      return NextResponse.json(result)
    }
    const result = await runRosterSyncFromCsvText(admin, csvText, { dryRun: false })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to read CSV'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
