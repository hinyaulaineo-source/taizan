'use client'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-5xl font-bold text-foreground">Something went wrong</h1>
      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. Please try again or return to the dashboard.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      )}
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-white px-6 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-200"
        >
          Try Again
        </button>
        <a
          href="/dashboard"
          className="rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-accent"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}
