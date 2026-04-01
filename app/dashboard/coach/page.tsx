import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function CoachDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach' && !isOwnerLike(profile?.role)) redirect('/dashboard')

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .order('scheduled_at', { ascending: true })

  const { data: feedbackRows } = await supabase
    .from('feedback')
    .select('athlete_id, created_at, profiles!feedback_athlete_id_fkey(full_name, email)')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const roster = (() => {
    const map = new Map<string, { athlete_id: string; full_name: string | null; email: string; last_created_at: string }>()
    ;(feedbackRows ?? []).forEach((f: any) => {
      if (!f.athlete_id) return
      if (!map.has(f.athlete_id)) {
        map.set(f.athlete_id, {
          athlete_id: f.athlete_id,
          full_name: f.profiles?.full_name ?? null,
          email: f.profiles?.email ?? '',
          last_created_at: f.created_at,
        })
      }
    })
    return Array.from(map.values())
  })()

  const sessionsByCreatedDate = (() => {
    const groups = new Map<string, typeof sessions>()
    ;(sessions ?? []).forEach((s) => {
      const key = s.created_at
        ? new Date(s.created_at).toLocaleDateString()
        : 'Unknown date'
      const arr = groups.get(key) ?? []
      arr.push(s)
      groups.set(key, arr)
    })
    return Array.from(groups.entries())
  })()

  return (
    <main>
      <h1 className="text-2xl font-semibold text-white">Coach Dashboard</h1>
      <p className="mt-1 text-sm text-zinc-400">Welcome, {profile?.full_name ?? user.email}</p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs text-zinc-500">My sessions</p>
            <p className="mt-2 text-3xl font-semibold text-white">{sessions?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-zinc-500">Pending approval</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {sessions?.filter((s) => s.status === 'pending').length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-zinc-500">Published</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {sessions?.filter((s) => s.status === 'published').length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-semibold text-zinc-100">My sessions</h2>
          <div className="flex gap-2">
            <Link
              href="/dashboard/coach/feedback"
              className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              + Add feedback
            </Link>
            <Link
              href="/dashboard/coach/new-session"
              className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200"
            >
              + New session
            </Link>
          </div>
        </div>

        {sessions?.length === 0 && (
          <Card>
            <CardContent>
              <p className="text-sm text-zinc-500">No sessions yet. Create your first one.</p>
            </CardContent>
          </Card>
        )}

        {sessionsByCreatedDate.length > 0 && (
          <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
            {sessionsByCreatedDate.map(([createdDate, group]) => (
              <div key={createdDate}>
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                  Created on {createdDate}
                </p>
                {group?.map((session) => (
                  <Card key={session.id} className="mb-2">
                    <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{session.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {session.session_type} · {new Date(session.scheduled_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          tone={
                            session.status === 'published'
                              ? 'success'
                              : session.status === 'pending'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {session.status}
                        </Badge>
                        <Link
                          href={`/dashboard/coach/edit-session/${session.id}`}
                          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
                        >
                          Edit
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-zinc-100">My roster</h2>
        {roster.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-zinc-500">No athlete feedback saved yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {roster.map((a) => (
              <Card key={a.athlete_id}>
                <CardContent className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{a.full_name ?? 'Unnamed'}</p>
                    <p className="text-xs text-zinc-500">{a.email}</p>
                  </div>
                  <Badge tone="neutral">
                    Last: {new Date(a.last_created_at).toLocaleDateString()}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
