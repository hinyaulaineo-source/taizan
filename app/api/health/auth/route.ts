import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!url) {
    return NextResponse.json(
      {
        ok: false,
        error: 'NEXT_PUBLIC_SUPABASE_URL is not configured.',
      },
      { status: 503 },
    )
  }

  const healthUrl = `${url.replace(/\/$/, '')}/auth/v1/health`

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  try {
    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: anonKey ? { apikey: anonKey } : undefined,
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    })

    const reachable = res.status > 0
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      supabaseReachable: reachable,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Supabase auth health check failed.'
    return NextResponse.json(
      {
        ok: false,
        supabaseReachable: false,
        error: message,
        hint: 'Supabase project may be paused or deleted. Open the Supabase dashboard and restore the project, then redeploy.',
      },
      { status: 503 },
    )
  }
}
