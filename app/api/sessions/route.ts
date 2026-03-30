import { createClient } from '@/lib/supabase/server'
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

  const body = await request.json()
  const status = profile?.role === 'owner' ? 'published' : 'pending'

  const { data, error } = await supabase
    .from('sessions')
    .insert({ ...body, created_by: user.id, status })
    .select()
    .single()

  if (error) return NextResponse.json({ error }, { status: 500 })
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

  if (profile?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, status } = await request.json()

  const { data, error } = await supabase
    .from('sessions')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}
