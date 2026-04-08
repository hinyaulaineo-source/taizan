import type { SupabaseClient } from '@supabase/supabase-js'

export type ProfileRowWithPrimaryCoach = {
  role: string
  full_name: string | null
  avatar_url: string | null
  main_events: string[] | null
  primary_coach_id: string | null
  phone: string | null
}

function coerceProfileRow(data: Record<string, unknown>): ProfileRowWithPrimaryCoach {
  return {
    role: String(data.role ?? 'athlete'),
    full_name: (data.full_name as string | null) ?? null,
    avatar_url: (data.avatar_url as string | null) ?? null,
    main_events: Array.isArray(data.main_events)
      ? (data.main_events as string[])
      : data.main_events === null
        ? null
        : [],
    primary_coach_id: (data.primary_coach_id as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
  }
}

/**
 * Loads `profiles` for athlete UI. Tries progressively narrower selects so a missing
 * column (migrations not applied) doesn’t force null while `/dashboard` still routes
 * here — that produced a redirect loop (Chrome -310).
 */
export async function getProfileRowWithOptionalPrimaryCoach(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRowWithPrimaryCoach | null> {
  type Row = Record<string, unknown>

  const attempts: PromiseLike<{ data: Row | null; error: { code?: string } | null }>[] = [
    supabase
      .from('profiles')
      .select('role, full_name, avatar_url, main_events, primary_coach_id, phone')
      .eq('id', userId)
      .single(),
    supabase.from('profiles').select('role, full_name, avatar_url, main_events').eq('id', userId).single(),
    supabase
      .from('profiles')
      .select('role, full_name, avatar_url, primary_coach_id')
      .eq('id', userId)
      .single(),
    supabase.from('profiles').select('role, full_name, avatar_url').eq('id', userId).single(),
    supabase.from('profiles').select('role').eq('id', userId).single(),
  ]

  for (const attempt of attempts) {
    const res = await attempt
    if (res.data) {
      return coerceProfileRow(res.data)
    }
    if (res.error?.code === 'PGRST116') {
      return null
    }
  }

  return null
}
