/**
 * Builds Supabase Auth email confirmation URL for Send Email Hook payloads.
 * @see https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
 */
export function buildAuthVerifyUrl(
  supabaseUrl: string,
  email_data: {
    token_hash: string
    email_action_type: string
    redirect_to: string
  },
): string {
  let host: string
  try {
    host = new URL(supabaseUrl).hostname
  } catch {
    throw new Error('Invalid NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!host.endsWith('.supabase.co')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a *.supabase.co project URL')
  }

  const projectRef = host.replace('.supabase.co', '')
  const base = `https://${projectRef}.supabase.co/auth/v1/verify`
  const params = new URLSearchParams({
    token: email_data.token_hash,
    type: email_data.email_action_type,
    redirect_to: email_data.redirect_to,
  })
  return `${base}?${params.toString()}`
}
