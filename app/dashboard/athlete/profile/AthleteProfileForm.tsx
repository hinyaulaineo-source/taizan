'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function AthleteProfileForm({
  initialFullName,
  initialAvatarUrl,
}: {
  initialFullName: string | null
  initialAvatarUrl: string | null
}) {
  const router = useRouter()
  const [fullName, setFullName] = useState(initialFullName ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      }),
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
      const path = `${user.id}/${Date.now()}-${safeName}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
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
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
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

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}

      <Button type="submit" disabled={saving || uploading}>
        {saving ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  )
}
