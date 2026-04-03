import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-6xl font-bold text-foreground">404</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Page not found. The page you are looking for does not exist.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 rounded-md bg-white px-6 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-200"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
