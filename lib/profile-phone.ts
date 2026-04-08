import type { SupabaseClient } from '@supabase/supabase-js'
import { phoneDigitsToAuthPassword } from '@/lib/phone-auth'

/** Returns error message if another profile already uses this normalized phone. */
export async function findProfilePhoneClash(
  admin: SupabaseClient,
  normalizedPhone: string,
  excludeUserId?: string,
): Promise<string | null> {
  let q = admin.from('profiles').select('id').eq('phone', normalizedPhone)
  if (excludeUserId) {
    q = q.neq('id', excludeUserId)
  }
  const { data } = await q.maybeSingle()
  return data ? 'That phone number is already registered to another account.' : null
}

export async function syncAuthPasswordToPhoneDigits(
  admin: SupabaseClient,
  userId: string,
  normalizedDigits: string,
): Promise<{ error: string | null }> {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: phoneDigitsToAuthPassword(normalizedDigits),
  })
  return { error: error?.message ?? null }
}
