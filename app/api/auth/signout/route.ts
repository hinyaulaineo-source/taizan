import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function handleSignout(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.url))
}

export async function GET(request: Request) {
  return handleSignout(request)
}

export async function POST(request: Request) {
  return handleSignout(request)
}
