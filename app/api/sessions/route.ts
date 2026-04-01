import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const body = (await request.json()) as {
    max_athletes?: number | null
    allowed_tiers?: string[]
    [key: string]: unknown
  }
  const maxAthletes =
    typeof body.max_athletes === 'number' && Number.isFinite(body.max_athletes)
      ? Math.max(1, Math.floor(body.max_athletes))
      : null
  const status = isOwnerLike(profile?.role) ? 'published' : 'pending'

  const { data, error } = await supabase
    .from('sessions')
    .insert({ ...body, max_athletes: maxAthletes, created_by: user.id, status })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    )
  }
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!isOwnerLike(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, status } = (await request.json()) as { id?: string; status?: string }
  if (!id || !status || !['draft', 'published', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sessions')
    .update({
      status,
      approved_by: user.id,
      approved_at: status === 'published' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    )
  }
  return NextResponse.json(data)
}
