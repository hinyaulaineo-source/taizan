import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import { isCoachTierColumnError } from '@/lib/supabase/admin-helpers'
import { redirect } from 'next/navigation'
import ApprovalButtons from './sessions/ApprovalButtons'
import { Card, CardContent } from '@/components/ui/card'
import LinkParentForm from './LinkParentForm'
import SubscriptionManagerForm from './SubscriptionManagerForm'
import SheetSyncForm from './SheetSyncForm'
import CoachApprovalForm from './CoachApprovalForm'
import AccountManager from './AccountManager'
import CoachManager from './CoachManager'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!isOwnerLike(profile?.role)) redirect('/dashboard')

  const { data: pendingSessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .order('scheduled_at', { ascending: true })

  const { data: athletes } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'athlete')

  const coachListRes = await supabase
    .from('profiles')
    .select('id, full_name, email, role, coach_tier')
    .in('role', ['coach', 'owner'])
    .order('full_name', { ascending: true })

  let coachOrOwnerProfiles = coachListRes.data ?? []
  if (coachListRes.error && !isCoachTierColumnError(coachListRes.error)) {
    console.error('Owner dashboard: coach list query failed:', coachListRes.error.message)
  }
  if (coachListRes.error && isCoachTierColumnError(coachListRes.error)) {
    const { data: withoutTier } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('role', ['coach', 'owner'])
      .order('full_name', { ascending: true })
    coachOrOwnerProfiles = (withoutTier ?? []).map((p) => ({ ...p, coach_tier: null as string | null }))
  }

  const coaches = coachOrOwnerProfiles.filter((p) => p.role === 'coach')

  const { data: coachRequests } = await supabase
    .from('profiles')
    .select('id, full_name, email, coach_requested_at')
    .eq('coach_request_pending', true)
    .order('coach_requested_at', { ascending: true })

  const { data: parents } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'parent')

  const { data: accounts } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, coach_request_pending, primary_coach_id')
    .neq('role', 'owner')

  const allProfileIds = [
    ...(athletes ?? []).map((a) => a.id),
    ...(accounts ?? []).filter((a) => a.role === 'athlete').map((a) => a.id),
  ]
  const uniqueIds = [...new Set(allProfileIds)]
  const { data: subscriptions } = uniqueIds.length > 0
    ? await supabase
        .from('subscriptions')
        .select('user_id, tier, status')
        .in('user_id', uniqueIds)
    : {
        data: [] as Array<{ user_id: string; tier: string; status: string }>
      }

  const subByUserId = new Map<string, { tier: string; status: string }>()
  ;(subscriptions ?? []).forEach((s) => subByUserId.set(s.user_id, { tier: s.tier, status: s.status }))

  const TIER_SORT: Record<string, number> = {
    elite: 1,
    performance_100m: 2,
    performance_400m: 3,
    standard: 4,
    youth_elite: 5,
    youth_standard: 6,
  }

  const sortedAthletes = [...(athletes ?? [])].sort((a, b) => {
    const aTier = subByUserId.get(a.id)?.tier ?? ''
    const bTier = subByUserId.get(b.id)?.tier ?? ''
    const aOrder = TIER_SORT[aTier] ?? 99
    const bOrder = TIER_SORT[bTier] ?? 99
    return aOrder - bOrder
  })

  const pendingSessionsByCreatedDate = (() => {
    const groups = new Map<string, typeof pendingSessions>()
    ;(pendingSessions ?? []).forEach((s) => {
      const key = s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Unknown date'
      const arr = groups.get(key) ?? []
      arr.push(s)
      groups.set(key, arr)
    })
    return Array.from(groups.entries())
  })()

  return (
    <main>
      <h1 className="text-2xl font-semibold text-white">Owner Dashboard</h1>
      <p className="mt-1 text-sm text-zinc-400">Approve sessions, monitor athletes, and run operations.</p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs text-zinc-500">Pending sessions</p>
            <p className="mt-2 text-3xl font-semibold text-white">{pendingSessions?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-zinc-500">Athletes</p>
            <p className="mt-2 text-3xl font-semibold text-white">{athletes?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-zinc-500">Coaches</p>
            <p className="mt-2 text-3xl font-semibold text-white">{coaches?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-zinc-100">Pending sessions awaiting approval</h2>
        {pendingSessions?.length === 0 && (
          <Card>
            <CardContent>
              <p className="text-sm text-zinc-500">No pending sessions right now.</p>
            </CardContent>
          </Card>
        )}
        {pendingSessionsByCreatedDate.length > 0 && (
          <div className="max-h-[500px] space-y-4 overflow-y-auto pr-1">
            {pendingSessionsByCreatedDate.map(([createdDate, group]) => (
              <div key={createdDate}>
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                  Created on {createdDate}
                </p>
                {group?.map((session) => (
                  <Card key={session.id} className="mb-2">
                    <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{session.title}</p>
                        <p className="text-xs text-zinc-500">
                          {session.session_type} · {new Date(session.scheduled_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ApprovalButtons sessionId={session.id} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-zinc-100">Coach approval requests</h2>
        <Card>
          <CardContent className="p-6">
            <CoachApprovalForm requests={coachRequests ?? []} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-zinc-100">
          Manage coaches
          <span className="ml-2 text-sm font-normal text-zinc-500">({coaches?.length ?? 0})</span>
        </h2>
        <Card>
          <CardContent className="p-6">
            <CoachManager
              coaches={(coaches ?? []).map((c) => ({
                id: c.id,
                full_name: c.full_name,
                email: c.email,
                coach_tier: c.coach_tier ?? null,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-zinc-100">
          Athletes
          <span className="ml-2 text-sm font-normal text-zinc-500">({sortedAthletes.length})</span>
        </h2>
        {sortedAthletes.length === 0 && (
          <Card>
            <CardContent>
              <p className="text-sm text-zinc-500">No athletes yet.</p>
            </CardContent>
          </Card>
        )}
        {sortedAthletes.length > 0 && (
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {sortedAthletes.map((athlete) => {
              const sub = subByUserId.get(athlete.id)
              return (
                <Card key={athlete.id}>
                  <CardContent className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{athlete.full_name ?? 'Unnamed'}</p>
                      <p className="text-xs text-zinc-500">{athlete.email}</p>
                    </div>
                    {sub ? (
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        sub.status === 'active'
                          ? 'bg-emerald-900/40 text-emerald-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {sub.tier} · {sub.status}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-500">
                        No subscription
                      </span>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-zinc-100">Manage accounts</h2>
        <Card>
          <CardContent className="p-6">
            <AccountManager
              profiles={accounts ?? []}
              subscriptions={subscriptions ?? []}
              coaches={(coachOrOwnerProfiles ?? []).map((c) => ({
                id: c.id,
                full_name: c.full_name,
                email: c.email,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-zinc-100">Link parent to athlete</h2>
        <Card>
          <CardContent className="p-6">
            <LinkParentForm parents={parents ?? []} athletes={athletes ?? []} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-zinc-100">Import athletes from CSV</h2>
        <Card>
          <CardContent className="p-6">
            <SheetSyncForm />
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-zinc-100">Manage subscriptions</h2>
        <Card>
          <CardContent className="p-6">
            <SubscriptionManagerForm athletes={athletes ?? []} subscriptions={subscriptions ?? []} />
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
