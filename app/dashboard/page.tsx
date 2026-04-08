import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import Link from 'next/link'
import { redirect } from 'next/navigation'

function profileBootstrapErrors(readErr: string | null, upsertErr: string | null) {
  const parts = [readErr, upsertErr].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let readErrorMessage: string | null = null
  let upsertErrorMessage: string | null = null

  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('role, full_name, coach_request_pending')
    .eq('id', user.id)
    .maybeSingle()

  if (readError) {
    readErrorMessage = readError.message
  }

  let ensuredProfile = profile

  // First-login fallback: if profile row is missing, create one.
  if (!ensuredProfile) {
    const desiredRole = String(user.user_metadata?.desired_role ?? '').toLowerCase()
    const shouldBeParent = desiredRole === 'parent'
    const coachRequested = desiredRole === 'coach'
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ?? user.email?.split('@')[0] ?? 'Athlete'
    const phoneFromMeta = user.user_metadata?.phone
    const phone =
      typeof phoneFromMeta === 'string' && phoneFromMeta.length > 0 ? phoneFromMeta.replace(/\D/g, '') : null

    const fullPayload = {
      id: user.id,
      email: user.email ?? '',
      full_name: fullName,
      ...(phone ? { phone } : {}),
      role: (shouldBeParent ? 'parent' : 'athlete') as 'parent' | 'athlete',
      coach_request_pending: coachRequested,
      coach_requested_at: coachRequested ? new Date().toISOString() : null,
    }

    const { data: created, error: upFull } = await supabase
      .from('profiles')
      .upsert(fullPayload, { onConflict: 'id' })
      .select('role, full_name, coach_request_pending')
      .maybeSingle()

    if (created) {
      ensuredProfile = created
    } else if (!upFull) {
      const { data: again } = await supabase
        .from('profiles')
        .select('role, full_name, coach_request_pending')
        .eq('id', user.id)
        .maybeSingle()
      ensuredProfile = again ?? null
    }

    if (!ensuredProfile && upFull) {
      upsertErrorMessage = upFull.message
      const { data: minimal, error: upMin } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            email: user.email ?? '',
            full_name: fullName,
            ...(phone ? { phone } : {}),
            role: (shouldBeParent ? 'parent' : 'athlete') as 'parent' | 'athlete',
          },
          { onConflict: 'id' },
        )
        .select('role, full_name, coach_request_pending')
        .maybeSingle()

      if (minimal) {
        ensuredProfile = minimal
        upsertErrorMessage = null
      } else if (upMin) {
        upsertErrorMessage = `${upFull.message} (retry: ${upMin.message})`
      }
    }

    if (!ensuredProfile && !upsertErrorMessage && !readErrorMessage) {
      upsertErrorMessage =
        'Profile row still missing after bootstrap. Usually: RLS policy blocks INSERT/SELECT for public.profiles, or the DB schema does not match this app.'
    }
  }

  if (!ensuredProfile) {
    const detail = profileBootstrapErrors(readErrorMessage, upsertErrorMessage)
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-foreground">Couldn’t load your profile</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Signed in as <span className="text-foreground">{user.email ?? user.id}</span>, but the app could not
          read or create the matching row in <code className="text-xs">public.profiles</code>.
        </p>
        {detail ? (
          <p className="mt-4 rounded-md border border-border bg-card px-3 py-2 text-left text-xs text-destructive whitespace-pre-wrap break-words">
            {detail}
          </p>
        ) : null}
        <p className="mt-3 text-left text-xs text-muted-foreground break-all">
          User ID: <code className="text-foreground">{user.id}</code>
        </p>
        <details className="mt-4 text-left text-sm text-muted-foreground">
          <summary className="cursor-pointer text-foreground">Owner: insert profile via SQL (SQL Editor)</summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
{`insert into public.profiles (id, email, full_name, role)
values (
  '${user.id}',
  '${(user.email ?? '').replace(/'/g, "''")}',
  '${(user.user_metadata?.full_name as string | undefined)?.replace(/'/g, "''") || (user.email?.split('@')[0] ?? 'User').replace(/'/g, "''")}',
  'athlete'
)
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role;`}
          </pre>
        </details>
        <ul className="mt-4 list-disc pl-5 text-left text-sm text-muted-foreground space-y-1">
          <li>
            In Supabase → <strong>Table Editor</strong> → <code className="text-xs">profiles</code>, check whether
            a row exists with that <code className="text-xs">id</code> (compare with Auth → Users).
          </li>
          <li>
            Run <code className="text-xs">supabase/schema.sql</code> and migrations so the table and RLS policies
            match this app (including <code className="text-xs">profiles insert own row</code>).
          </li>
          <li>
            Confirm <code className="text-xs">.env.local</code> uses the <strong>same project</strong> as the
            dashboard where the user exists.
          </li>
        </ul>
        <p className="mt-4">
          <Link href="/api/auth/signout" className="text-sm font-medium text-foreground underline">
            Sign out
          </Link>
        </p>
      </main>
    )
  }

  const roleRaw = ensuredProfile.role
  const role = normalizeRole(roleRaw)

  if (role === 'owner') redirect('/dashboard/admin')
  if (role === 'coach') redirect('/dashboard/coach')
  if (role === 'parent') redirect('/dashboard/parent')
  if (role === 'athlete') redirect('/dashboard/athlete')

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-foreground">Unknown account role</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Your profile has role &quot;{String(roleRaw)}&quot;, which this app doesn’t recognize. Contact an owner
        to fix your role in Supabase.
      </p>
      <p className="mt-4">
        <Link href="/api/auth/signout" className="text-sm font-medium text-foreground underline">
          Sign out
        </Link>
      </p>
    </main>
  )
}
