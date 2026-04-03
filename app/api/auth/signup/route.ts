import { NextResponse } from 'next/server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'

import { parseBody, signupSchema } from '@/lib/security/validation'



export async function POST(request: Request) {

  const limited = applyRateLimit(request, 'auth')

  if (limited) return limited



  const rawBody = await safeJsonParse(request)

  if (rawBody === '__TOO_LARGE__') {

    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })

  }



  const parsed = parseBody(signupSchema, rawBody)

  if (!parsed.success) {

    return NextResponse.json({ error: parsed.error }, { status: 400 })

  }



  const email = parsed.data.email

  const password = parsed.data.password

  const fullName = parsed.data.fullName?.trim() || null

  const role = parsed.data.role



  const url = process.env.NEXT_PUBLIC_SUPABASE_URL

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {

    return NextResponse.json(

      { error: 'Server configuration error.' },

      { status: 500 },

    )

  }



  const admin = createSupabaseClient(url, key, {

    auth: { autoRefreshToken: false, persistSession: false },

  })



  const isCoachRequest = role === 'coach'

  const dbRole = isCoachRequest ? 'athlete' : role



  const { data: created, error: createErr } = await admin.auth.admin.createUser({

    email,

    password,

    email_confirm: true,

    user_metadata: { full_name: fullName, desired_role: role },

  })



  if (createErr) {

    const msg = createErr.message.toLowerCase()

    if (msg.includes('already') || msg.includes('duplicate') || msg.includes('exists')) {

      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })

    }

    return NextResponse.json({ error: createErr.message }, { status: 500 })

  }



  if (!created.user) {

    return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 })

  }



  const uid = created.user.id



  const { error: profileErr } = await admin.from('profiles').upsert(

    {

      id: uid,

      email,

      full_name: fullName,

      role: dbRole,

      coach_request_pending: isCoachRequest,

      coach_requested_at: isCoachRequest ? new Date().toISOString() : null,

    },

    { onConflict: 'id' },

  )



  if (profileErr) {

    return NextResponse.json(

      { error: `Account created but profile setup failed: ${profileErr.message}` },

      { status: 500 },

    )

  }



  return NextResponse.json({ ok: true, userId: uid })

}

