'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const MAIN_EVENT_OPTIONS = [
  '100m',
  '200m',
  '400m',
  '800m',
  '1500m',
  '3000m',
  '5000m',
  '100mh',
  '110mh',
  '400mh',
  'Long jump',
  'Triple jump',
  'High jump',
  'Pole vault',
  'Shot put',
  'Discus throw',
  'Javelin throw',
  'Hammer throw',
] as const

export default function AthleteProfileForm({
  initialFullName,
  initialAvatarUrl,
  initialMainEvents,
  hideMainEvents = false,
  patchPath,
}: {
  initialFullName: string | null
  initialAvatarUrl: string | null
  initialMainEvents: string[]
  /** Omit main events (e.g. coach self-service profile). */
  hideMainEvents?: boolean
  /** Defaults to `/api/profile`; use `/api/coach/athletes/:id` when editing an assigned athlete. */
  patchPath?: string
}) {
  const router = useRouter()
  const [fullName, setFullName] = useState(initialFullName ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? '')
  const [mainEvents, setMainEvents] = useState<string[]>(initialMainEvents ?? [])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    const path = patchPath ?? '/api/profile'
    const payload: Record<string, unknown> = {
      full_name: fullName.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    }
    if (!hideMainEvents) {
      payload.main_events = mainEvents
    }
    const res = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    if (!res.ok) {
      setError(typeof data?.error === 'string' ? data.error : 'Save failed')
      setSaving(false)
      return
    }
    setMessage('Saved.')
    setSaving(false)
    router.refresh()
  }

  function toggleMainEvent(eventName: string) {
    setMainEvents((prev) =>
      prev.includes(eventName)
        ? prev.filter((e) => e !== eventName)
        : [...prev, eventName],
    )
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setError('')
    setMessage('')
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('Not signed in')
        setUploading(false)
        return
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${user.id}/${Date.now()}-${safeName}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(storagePath, file, {
        upsert: true,
      })
      if (upErr) {
        setError(
          upErr.message +
            ' Try pasting an image URL below, or run the avatars storage migration in Supabase.',
        )
        setUploading(false)
        return
      }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(storagePath)
      setAvatarUrl(pub.publicUrl)
      setMessage('Image uploaded — click Save profile to store it.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
    setUploading(false)
  }

  return (
    <form onSubmit={save} className="max-w-md space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Photo</p>
        <div className="mt-3 flex items-start gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-provided dynamic URLs
            <img
              src={avatarUrl}
              alt=""
              className="h-24 w-24 rounded-full border border-zinc-700 object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-zinc-600 bg-zinc-900/50 text-sm text-zinc-500">
              No photo
            </div>
          )}
          <div className="space-y-2 text-sm">
            <label className="block">
              <span className="text-zinc-400">Upload</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={onFileChange}
                disabled={uploading || saving}
                className="mt-1 block w-full text-zinc-300 file:mr-3 file:rounded-md file:border file:border-zinc-600 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:text-zinc-200"
              />
            </label>
            {uploading && <p className="text-xs text-zinc-500">Uploading…</p>}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="avatar_url" className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Or image URL
        </label>
        <input
          id="avatar_url"
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://…"
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="full_name" className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Display name
        </label>
        <input
          id="full_name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {!hideMainEvents ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Main events (choose more than one)</p>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-zinc-700 bg-zinc-950 p-3">
            {MAIN_EVENT_OPTIONS.map((eventName) => {
              const checked = mainEvents.includes(eventName)
              return (
                <label key={eventName} className="flex items-center gap-2 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMainEvent(eventName)}
                    className="h-4 w-4 accent-white"
                  />
                  <span>{eventName}</span>
                </label>
              )
            })}
          </div>
        </div>
      ) : null}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}

      <Button type="submit" disabled={saving || uploading}>
        {saving ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  )
}
