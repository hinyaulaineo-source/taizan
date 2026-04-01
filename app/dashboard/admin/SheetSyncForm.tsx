'use client'

import { useState } from 'react'

export default function SheetSyncForm() {
  const [loading, setLoading] = useState<'dry' | 'run' | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<string>('')

  async function run(dryRun: boolean) {
    if (!file) {
      setResult('Error: Please select a CSV file first.')
      return
    }
    setLoading(dryRun ? 'dry' : 'run')
    setResult('')
    const form = new FormData()
    form.set('dryRun', String(dryRun))
    form.set('csv', file)
    const response = await fetch('/api/admin/sync-google-sheet', {
      method: 'POST',
      body: form,
    })
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (!response.ok) {
      setResult(`Error: ${typeof data?.error === 'string' ? data.error : response.statusText}`)
      setLoading(null)
      return
    }
    setResult(JSON.stringify(data, null, 2))
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Upload a CSV exported from your sheet, then create or update Supabase users. Login email =
        CSV &quot;Email&quot;, password = &quot;ref no.&quot;, role = athlete. Re-run monthly; existing
        users get password and name refreshed from the sheet. Owner and coach accounts are never changed.
      </p>
      <div>
        <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">
          Student CSV
        </label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border file:border-zinc-700 file:bg-zinc-900 file:px-3 file:py-2 file:text-zinc-200"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => run(true)}
          className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
        >
          {loading === 'dry' ? 'Checking…' : 'Dry run (preview)'}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => run(false)}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {loading === 'run' ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
      {result && (
        <pre className="max-h-80 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300 whitespace-pre-wrap">
          {result}
        </pre>
      )}
    </div>
  )
}
