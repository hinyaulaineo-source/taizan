import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as {
    full_name?: string | null
    avatar_url?: string | null
  }

  const updates: Record<string, string | null> = {}

  if ('full_name' in body) {
    const v = body.full_name
    updates.full_name =
      v === null || v === undefined ? null : typeof v === 'string' ? v.trim() || null : null
  }

  if ('avatar_url' in body) {
    const v = body.avatar_url
    updates.avatar_url =
      v === null || v === undefined ? null : typeof v === 'string' ? v.trim() || null : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id, full_name, avatar_url, email')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  }

  return NextResponse.json(data)
}
